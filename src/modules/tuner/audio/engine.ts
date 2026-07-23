/**
 * Motor do afinador: microfone → worklet coletor → worker YIN → callback.
 *
 * Três decisões que valem explicação:
 *
 * 1. O worklet é burro de propósito. Ele acumula o sinal num ring buffer e posta
 *    a janela; quem pensa é o worker. O padrão é o do time do Chrome - o áudio
 *    nunca espera pela análise, então análise lenta vira pitch atrasado, nunca
 *    estouro no áudio.
 *
 * 2. Sem SharedArrayBuffer. Ele exigiria COOP/COEP, e o GitHub Pages não deixa
 *    mandar header. Então os buffers viajam por `postMessage` com transferência
 *    e voltam pro pool do worklet. Custo: dois saltos. Ganho: roda no host que
 *    temos, sem hack de service worker.
 *
 * 3. O worklet vai como fonte crua num Blob. É pequeno e sem imports, e assim não
 *    depende de como o bundler resolve URL de worklet sob o `base` do Pages.
 */
import { analysisWindow } from "../core/yin";

/**
 * Coletor. Roda na thread de áudio: sem alocação, sem espera, sem log.
 * Quando o pool está vazio o frame é descartado - atrasar é aceitável, travar o
 * áudio não é.
 */
const COLLECTOR_SOURCE = `
class Collector extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = options.processorOptions;
    this.size = o.size;
    this.hop = o.hop;
    this.ring = new Float32Array(this.size);
    this.pool = [];
    for (let i = 0; i < o.poolSize; i += 1) this.pool.push(new Float32Array(this.size));
    this.w = 0;
    this.filled = 0;
    this.since = 0;
    this.port.onmessage = (e) => {
      if (e.data && e.data.b) this.pool.push(new Float32Array(e.data.b));
    };
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    // A spec avisa que o bloco deixará de ser fixo em 128, então lemos o tamanho.
    const n = ch.length;
    const size = this.size;
    const ring = this.ring;
    for (let i = 0; i < n; i += 1) {
      ring[this.w] = ch[i];
      this.w = this.w + 1 === size ? 0 : this.w + 1;
    }
    if (this.filled < size) this.filled = Math.min(size, this.filled + n);
    this.since += n;
    if (this.filled < size || this.since < this.hop) return true;
    this.since = 0;
    const out = this.pool.pop();
    if (!out) return true;
    const head = size - this.w;
    out.set(ring.subarray(this.w), 0);
    out.set(ring.subarray(0, this.w), head);
    this.port.postMessage({ b: out.buffer }, [out.buffer]);
    return true;
  }
}
registerProcessor('pitch-collector', Collector);
`;

/** Análises por segundo. O display anda a 60+; medir mais que isto é queimar CPU. */
const ANALYSIS_HZ = 80;
const POOL_SIZE = 6;
const MS_PER_SECOND = 1000;
/** Faixa de busca padrão até um preset chegar - cobre um whistle em Ré. */
const DEFAULT_MIN_HZ = 500;
const DEFAULT_MAX_HZ = 2600;
/** Bloco mínimo de áudio (o valor histórico do `process()`), piso do hop. */
const AUDIO_BLOCK_SIZE = 128;
/** Corte do passa-altas: uma fração da nota mais grave que interessa. */
const HIGHPASS_MIN_FACTOR = 0.6;

export interface TunerStatus {
  state: "idle" | "starting" | "running" | "error";
  error: string | null;
  sampleRate: number;
  /** Janela de análise - três períodos da nota mais grave do preset. */
  windowMs: number;
  /** Janela + hop: o atraso entre soprar e a leitura existir. */
  responseMs: number;
  /**
   * Processamento de voz que o navegador admitiu manter ligado. AGC e supressão
   * de ruído tratam tom puro sustentado como ruído e o atenuam; parte deles vive
   * abaixo do browser e nenhuma constraint alcança. Se sobrar algo aqui, o
   * usuário merece saber por que a leitura está ruim.
   */
  processing: string[];
}

export type FrameHandler = (hz: number, clarity: number, rms: number, dtMs: number) => void;

const IDLE: TunerStatus = {
  state: "idle",
  error: null,
  sampleRate: 0,
  windowMs: 0,
  responseMs: 0,
  processing: [],
};

export class TunerEngine {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private highpass: BiquadFilterNode | null = null;
  private node: AudioWorkletNode | null = null;
  private worker: Worker | null = null;
  private moduleUrl: string | null = null;
  private range = { minHz: DEFAULT_MIN_HZ, maxHz: DEFAULT_MAX_HZ };
  private hopMs = MS_PER_SECOND / ANALYSIS_HZ;
  private status: TunerStatus = IDLE;

  constructor(
    private readonly onFrame: FrameHandler,
    private readonly onStatus: (s: TunerStatus) => void,
  ) {}

  getStatus(): TunerStatus {
    return this.status;
  }

  async start(range: { minHz: number; maxHz: number }): Promise<void> {
    if (this.ctx) {
      await this.setRange(range);
      return;
    }
    this.range = range;
    this.patch({ state: "starting", error: null });

    try {
      const { stream, processing } = await openMicrophone();
      this.stream = stream;
      // Perder o dispositivo no meio (fone conectando, aba roubando o mic) tem
      // que virar erro visível, não leitura congelada em silêncio.
      stream.getAudioTracks()[0]?.addEventListener("ended", () => {
        this.patch({ state: "error", error: "device-lost" });
      });

      const ctx = new AudioContext();
      this.ctx = ctx;
      // O iOS ignora sampleRate pedido, então lemos o que veio.
      if (ctx.state !== "running") await ctx.resume();

      await ctx.audioWorklet.addModule(this.ensureModuleUrl());

      this.source = ctx.createMediaStreamSource(stream);
      this.highpass = ctx.createBiquadFilter();
      this.highpass.type = "highpass";
      this.source.connect(this.highpass);

      this.worker = new Worker(new URL("./analyzer.worker.ts", import.meta.url), {
        type: "module",
      });
      this.worker.onmessage = (event: MessageEvent) => this.fromWorker(event.data);

      this.patch({ state: "running", processing, sampleRate: ctx.sampleRate });
      this.build();
    } catch (err) {
      this.patch({ state: "error", error: errorCode(err) });
      this.stop();
    }
  }

  async setRange(range: { minHz: number; maxHz: number }): Promise<void> {
    if (range.minHz === this.range.minHz && range.maxHz === this.range.maxHz) return;
    this.range = range;
    if (this.ctx && this.status.state === "running") this.build();
  }

  /**
   * (Re)cria o coletor e reconfigura o worker. A janela depende da nota mais
   * grave do preset, então trocar de instrumento é trocar de coletor.
   */
  private build(): void {
    const ctx = this.ctx;
    const worker = this.worker;
    const highpass = this.highpass;
    if (!ctx || !worker || !highpass) return;

    this.node?.port.close();
    this.node?.disconnect();

    const windowSpec = analysisWindow(ctx.sampleRate, this.range.minHz);
    const hop = Math.max(AUDIO_BLOCK_SIZE, Math.round(ctx.sampleRate / ANALYSIS_HZ));
    this.hopMs = (hop / ctx.sampleRate) * MS_PER_SECOND;

    // Corta bem abaixo da nota mais grave que interessa. Num whistle isso joga
    // fora o zumbido de 50/60 Hz da rede inteiro, junto com as harmônicas dele -
    // de graça, porque o filtro é nativo.
    highpass.frequency.value = this.range.minHz * HIGHPASS_MIN_FACTOR;

    const node = new AudioWorkletNode(ctx, "pitch-collector", {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      processorOptions: { size: windowSpec.size, hop, poolSize: POOL_SIZE },
    });
    node.port.onmessage = (event: MessageEvent) => {
      const buffer = event.data?.b as ArrayBuffer | undefined;
      if (buffer) worker.postMessage({ type: "frame", b: buffer }, [buffer]);
    };
    highpass.connect(node);
    this.node = node;

    worker.postMessage({
      type: "config",
      opts: {
        sampleRate: ctx.sampleRate,
        minHz: this.range.minHz,
        maxHz: this.range.maxHz,
      },
    });

    this.patch({
      windowMs: windowSpec.latencyMs,
      responseMs: windowSpec.latencyMs + this.hopMs,
      sampleRate: ctx.sampleRate,
    });
  }

  private fromWorker(msg: {
    type: string;
    hz?: number;
    clarity?: number;
    rms?: number;
    b?: ArrayBuffer;
  }): void {
    if (msg.type === "result") {
      this.onFrame(msg.hz ?? -1, msg.clarity ?? 0, msg.rms ?? 0, this.hopMs);
    }
    if (msg.b) this.node?.port.postMessage({ b: msg.b }, [msg.b]);
  }

  /** Retomar depois de aba oculta / tela apagada. No iOS o contexto vai pra
   *  `interrupted` e não volta sozinho - é a maior fonte de bug de campo. */
  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state !== "running") await this.ctx.resume();
  }

  stop(): void {
    this.node?.port.close();
    this.node?.disconnect();
    this.node = null;
    this.highpass?.disconnect();
    this.highpass = null;
    this.source?.disconnect();
    this.source = null;
    this.worker?.terminate();
    this.worker = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.ctx?.close();
    this.ctx = null;
    if (this.moduleUrl) {
      URL.revokeObjectURL(this.moduleUrl);
      this.moduleUrl = null;
    }
    this.patch({ ...IDLE, state: this.status.state === "error" ? "error" : "idle" });
  }

  private ensureModuleUrl(): string {
    if (!this.moduleUrl) {
      this.moduleUrl = URL.createObjectURL(
        new Blob([COLLECTOR_SOURCE], { type: "text/javascript" }),
      );
    }
    return this.moduleUrl;
  }

  private patch(next: Partial<TunerStatus>): void {
    this.status = { ...this.status, ...next };
    this.onStatus(this.status);
  }
}

/**
 * Pede o sinal cru. `{ exact: false }` de propósito: sem o `exact`, o navegador
 * pode ignorar a constraint em silêncio e devolver uma track processada; com
 * ele, falha alto e podemos avisar. Depois conferimos o que realmente veio,
 * porque nem a constraint aceita significa que o processamento morreu.
 */
async function openMicrophone(): Promise<{ stream: MediaStream; processing: string[] }> {
  const raw: MediaTrackConstraints = {
    echoCancellation: { exact: false },
    noiseSuppression: { exact: false },
    autoGainControl: { exact: false },
    channelCount: 1,
  };
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: raw });
  } catch (err) {
    if (errorName(err) !== "OverconstrainedError") throw err;
    // A plataforma se recusa a desligar. Ainda dá pra afinar, só pior - então
    // seguimos e contamos ao usuário.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  }
  return { stream, processing: activeProcessing(stream) };
}

function activeProcessing(stream: MediaStream): string[] {
  const settings = stream.getAudioTracks()[0]?.getSettings() as
    | { echoCancellation?: boolean; noiseSuppression?: boolean; autoGainControl?: boolean }
    | undefined;
  if (!settings) return [];
  const on: string[] = [];
  if (settings.autoGainControl) on.push("agc");
  if (settings.noiseSuppression) on.push("ns");
  if (settings.echoCancellation) on.push("aec");
  return on;
}

/**
 * Nome do erro sem cast permissivo. Duck typing de propósito: getUserMedia rejeita
 * com DOMException, que NÃO é `instanceof Error` no browser - narrow por `instanceof`
 * perderia o `.name` e quebraria a classificação (e o retry de OverconstrainedError).
 */
function errorName(err: unknown): string {
  if (err instanceof Error) return err.name;
  if (typeof err === "object" && err !== null && "name" in err) {
    const named = (err as { name?: unknown }).name;
    return typeof named === "string" ? named : "";
  }
  return "";
}

function errorCode(err: unknown): string {
  const name = errorName(err);
  if (name === "NotAllowedError") return "denied";
  if (name === "NotFoundError") return "no-device";
  return "generic";
}
