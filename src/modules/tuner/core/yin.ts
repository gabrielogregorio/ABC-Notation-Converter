/**
 * Detector de F0 pelo YIN (de Cheveigné & Kawahara, 2002).
 *
 * Por que YIN e não FFT/HPS: whistle e flauta têm espectro quase senoidal - não
 * há harmônico forte pra um método espectral casar, e o produto do HPS vira o
 * próprio pico mais ruído. Sinal periódico no domínio do tempo dá pico limpo.
 *
 * Os quatro estágios que importam:
 *  - difference function, não autocorrelação crua (a ACF decai com o lag e puxa
 *    a leitura pra oitava de cima);
 *  - CMNDF, que mata o mínimo trivial em lag 0 e torna o limiar independente do
 *    nível do sinal;
 *  - primeiro mínimo abaixo do limiar, não o mínimo global (o global cai em
 *    subharmônico e reporta a oitava de baixo);
 *  - interpolação parabólica, que leva o erro de dezenas de cents pra menos de um.
 */

export interface YinResult {
  /** Hz, ou -1 quando não há pitch. */
  hz: number;
  /** 1 − d′(τ) no mínimo escolhido. É a confiança que o display deve exibir. */
  clarity: number;
  /** RMS da janela. */
  rms: number;
}

export interface AnalysisWindow {
  /** Amostras somadas na difference function. */
  integration: number;
  /** Maior lag testado: um período da nota mais grave. */
  maxLag: number;
  /** Buffer total que o coletor precisa acumular antes de analisar. */
  size: number;
  /** Latência intrínseca da janela. */
  latencyMs: number;
}

/** Períodos da nota mais grave somados na janela: a régua de três do Praat. */
const ANALYSIS_PERIODS = 3;
const MS_PER_SECOND = 1000;
/** Limiar absoluto do YIN: 0.1 é o do artigo original. */
const DEFAULT_THRESHOLD = 0.1;
/** RMS abaixo disto é silêncio - nem roda o detector. */
const DEFAULT_MIN_RMS = 0.005;
/** Lag mínimo: garante vizinhos (tau-1, tau+1) pra interpolação parabólica. */
const MIN_LAG = 2;

/**
 * A janela sai da nota mais grave, não do gosto do usuário: o Praat exige três
 * períodos do piso pra estimar F0 ("These 60 milliseconds correspond to 3
 * maximum pitch periods"). Pedir menos não compra responsividade, compra lixo -
 * por isso a UI mostra o resultado disto como leitura, não como slider.
 */
export function analysisWindow(sampleRate: number, minHz: number): AnalysisWindow {
  const maxLag = Math.ceil(sampleRate / minHz);
  const integration = ANALYSIS_PERIODS * maxLag;
  const size = integration + maxLag;
  return { integration, maxLag, size, latencyMs: (size / sampleRate) * MS_PER_SECOND };
}

export interface YinOptions {
  sampleRate: number;
  minHz: number;
  maxHz: number;
  /** Limiar absoluto do YIN. 0.1 é o do artigo. */
  threshold?: number;
  /** Abaixo disto o frame é silêncio e nem roda o detector. */
  minRms?: number;
}

export class YinDetector {
  readonly window: AnalysisWindow;
  private readonly sampleRate: number;
  private readonly minHz: number;
  private readonly maxHz: number;
  private readonly threshold: number;
  private readonly minRms: number;
  private readonly minLag: number;
  private readonly diff: Float32Array;
  private readonly cmndf: Float32Array;

  constructor(opts: YinOptions) {
    this.sampleRate = opts.sampleRate;
    this.minHz = opts.minHz;
    this.maxHz = opts.maxHz;
    this.threshold = opts.threshold ?? DEFAULT_THRESHOLD;
    this.minRms = opts.minRms ?? DEFAULT_MIN_RMS;
    this.window = analysisWindow(opts.sampleRate, opts.minHz);
    this.minLag = Math.max(MIN_LAG, Math.floor(opts.sampleRate / opts.maxHz));
    // Tudo alocado aqui: o caminho quente não pode gerar lixo pro GC.
    this.diff = new Float32Array(this.window.maxLag + 1);
    this.cmndf = new Float32Array(this.window.maxLag + 1);
  }

  detect(samples: Float32Array): YinResult {
    const maxLag = Math.min(this.window.maxLag, samples.length - 1);
    const integrationLength = Math.min(this.window.integration, samples.length - maxLag);
    if (integrationLength <= 0 || maxLag <= this.minLag) return { hz: -1, clarity: 0, rms: 0 };

    let energy = 0;
    for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
      energy += samples[sampleIndex] * samples[sampleIndex];
    }
    const rms = Math.sqrt(energy / samples.length);
    if (rms < this.minRms) return { hz: -1, clarity: 0, rms };

    // `tau` (τ, do artigo do YIN) é o lag em amostras: o candidato a período.
    // A frequência final sai de sampleRate / τ refinado.
    const { diff, cmndf } = this;
    for (let tau = 1; tau <= maxLag; tau += 1) {
      let sum = 0;
      for (let sampleIndex = 0; sampleIndex < integrationLength; sampleIndex += 1) {
        const delta = samples[sampleIndex] - samples[sampleIndex + tau];
        sum += delta * delta;
      }
      diff[tau] = sum;
    }

    // d′(0) = 1 por definição; sem isso o lag 0 é sempre o mínimo global.
    cmndf[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= maxLag; tau += 1) {
      running += diff[tau];
      cmndf[tau] = running === 0 ? 1 : (diff[tau] * tau) / running;
    }

    // Primeiro mínimo local abaixo do limiar. Descer o vale antes de parar evita
    // travar na borda de entrada dele.
    let tau = -1;
    for (let lag = this.minLag; lag <= maxLag; lag += 1) {
      if (cmndf[lag] < this.threshold) {
        while (lag + 1 <= maxLag && cmndf[lag + 1] < cmndf[lag]) lag += 1;
        tau = lag;
        break;
      }
    }
    // Nada abaixo do limiar: o frame provavelmente é aperiódico. Ainda devolvemos
    // o melhor candidato, mas com a clareza baixa que ele merece - quem decide
    // engolir ou não é o gate, não este módulo.
    if (tau < 0) {
      let best = this.minLag;
      for (let lag = this.minLag; lag <= maxLag; lag += 1) if (cmndf[lag] < cmndf[best]) best = lag;
      tau = best;
    }

    const refined = parabolicMinimum(cmndf, tau, maxLag);
    const hz = this.sampleRate / refined;
    if (hz < this.minHz || hz > this.maxHz) return { hz: -1, clarity: 0, rms };

    const clarity = Math.max(0, Math.min(1, 1 - cmndf[tau]));
    return { hz, clarity, rms };
  }
}

/** Vértice da parábola pelos três pontos ao redor de tau. Devolve lag fracionário. */
function parabolicMinimum(values: Float32Array, tau: number, maxLag: number): number {
  if (tau <= 0 || tau >= maxLag) return tau;
  const before = values[tau - 1];
  const at = values[tau];
  const after = values[tau + 1];
  const denom = before - 2 * at + after;
  if (denom === 0) return tau;
  const shift = (0.5 * (before - after)) / denom;
  // Deslocamento acima de meia amostra significa que o mínimo não é aqui.
  return Math.abs(shift) > 1 ? tau : tau + shift;
}
