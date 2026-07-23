/**
 * Motor de áudio do metrônomo: Sequencer (timing puro) + Web Audio.
 *
 * Arquitetura:
 *  - Um timer grosso (Web Worker, 25ms) só "acorda" e chama `schedule()`.
 *  - `schedule()` pega os pulsos da janela de lookahead (100ms) e agenda cada
 *    click com `osc.start(pulse.time)` no relógio de amostras - sample-accurate.
 *  - O feedback visual NÃO usa o timer: os pulsos vão para uma fila e são
 *    drenados lendo `ctx.currentTime` (compensado por `outputLatency`), para o
 *    flash bater com o som que a pessoa realmente ouve.
 *
 * Click anti-pop: envelope de ganho (ataque ~2ms, decay exponencial p/ alvo ≠ 0).
 */
import { Sequencer, type Pulse } from './scheduler.ts';
import { clickSpec, type AccentLevel, type ClickSpec } from './clicks.ts';

const LOOKAHEAD_S = 0.1; // horizonte de agendamento
const TICK_MS = 25; // timer grosso

export interface MetronomeOptions {
  bpm: number;
  beatsPerBar: number;
  subdivisions: number;
  swing: number;
  volume: number;
  accents: AccentLevel[];
}

export class Metronome {
  private ctx: AudioContext | null = null;
  private worker: Worker | null = null;
  private fallbackTimer: number | null = null;
  private readonly seq: Sequencer;
  private volume: number;
  private accents: AccentLevel[];
  /** Fila de pulsos agendados, aguardando o momento visual. */
  private queue: { time: number; pulse: Pulse }[] = [];

  constructor(opts: MetronomeOptions) {
    this.seq = new Sequencer({
      bpm: opts.bpm,
      beatsPerBar: opts.beatsPerBar,
      subdivisions: opts.subdivisions,
      swing: opts.swing,
      lookahead: LOOKAHEAD_S,
    });
    this.volume = clamp01(opts.volume);
    this.accents = [...opts.accents];
  }

  get isPlaying(): boolean {
    return this.seq.isRunning;
  }
  get bpm(): number {
    return this.seq.bpm;
  }
  get beatsPerBar(): number {
    return this.seq.beatsPerBar;
  }

  setBpm(bpm: number): void {
    this.seq.setBpm(bpm);
  }
  setBeatsPerBar(beats: number): void {
    this.seq.setBeatsPerBar(beats);
  }
  setSubdivisions(sub: number): void {
    this.seq.setSubdivisions(sub);
  }
  setSwing(swing: number): void {
    this.seq.setSwing(swing);
  }
  setVolume(v: number): void {
    this.volume = clamp01(v);
  }
  setAccents(accents: AccentLevel[]): void {
    this.accents = [...accents];
  }

  /** Instante atual do relógio de áudio (0 se ainda não iniciado). */
  audioTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /**
   * Remove e devolve os pulsos cujo som já deveria ter sido ouvido agora
   * (compensando a latência de saída). Chame no loop de rAF para o visual.
   */
  drainDueBeats(): Pulse[] {
    if (!this.ctx) return [];
    const heardTime = this.ctx.currentTime - this.outputLatency();
    const due: Pulse[] = [];
    while (this.queue.length && this.queue[0].time <= heardTime) {
      due.push(this.queue.shift()!.pulse);
    }
    return due;
  }

  private outputLatency(): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    // outputLatency é o ideal; baseLatency como fallback
    const out = (ctx as AudioContext & { outputLatency?: number }).outputLatency;
    if (typeof out === 'number' && out > 0) return out;
    return ctx.baseLatency || 0;
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  start(): void {
    if (this.seq.isRunning) return;
    const ctx = this.ensureCtx();
    this.queue = [];
    this.seq.start(ctx.currentTime + 0.1); // folga para o primeiro pulso
    this.startTimer();
    this.schedule();
  }

  stop(): void {
    this.seq.stop();
    this.stopTimer();
    this.queue = [];
  }

  dispose(): void {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  private startTimer(): void {
    const onTick = () => this.schedule();
    try {
      if (!this.worker) {
        this.worker = new Worker(new URL('./timerWorker.ts', import.meta.url), {
          type: 'module',
        });
      }
      this.worker.onmessage = onTick;
      this.worker.postMessage({ command: 'start', interval: TICK_MS });
    } catch {
      // Sem Worker (ambiente restrito): cai para setInterval na main thread.
      this.fallbackTimer = window.setInterval(onTick, TICK_MS);
    }
  }

  private stopTimer(): void {
    this.worker?.postMessage({ command: 'stop' });
    if (this.fallbackTimer != null) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  /** Agenda no Web Audio todos os pulsos que entraram na janela de lookahead. */
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.seq.isRunning) return;
    for (const pulse of this.seq.tick(ctx.currentTime)) {
      const spec = clickSpec(pulse, this.accents);
      if (!spec.silent) this.scheduleClick(ctx, pulse.time, spec);
      this.queue.push({ time: pulse.time, pulse });
    }
  }

  private scheduleClick(ctx: AudioContext, time: number, spec: ClickSpec): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = spec.frequency;
    const peak = Math.max(0.0001, spec.gain * this.volume);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.07);
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
