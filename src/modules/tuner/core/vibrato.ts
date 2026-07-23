/**
 * Medida de vibrato: centro, extensão e taxa.
 *
 * O mercado se divide em dois e deixa um buraco no meio. Afinador trata
 * oscilação como erro e treme; ferramenta de análise de voz trata como sinal mas
 * roda offline. Ninguém mede vibrato ao vivo e diz ao músico o que ele fez.
 *
 * Aqui a leitura vira uma frase: "centro +2¢, vibrato ±40¢ a 5,8 Hz". O afinado
 * é julgado pelo CENTRO - vibrato perfeitamente centrado é acerto, não erro, e é
 * exatamente isso que os apps que testam o valor instantâneo erram.
 *
 * A regularidade é o desempate, não enfeite: o próprio autor do Nakano registra
 * que canto instável "pode ser erroneamente julgado como vibrato". Oscilação sem
 * período não é vibrato, é falta de controle - e as duas coisas não podem
 * receber o mesmo elogio.
 */

export interface VibratoConfig {
  /** Quanto de história entra na conta. Precisa cobrir vários ciclos. */
  windowMs: number;
  /** Vibrato musical vive em 4–9 Hz. Fora disso é trêmulo ou deriva. */
  minRateHz: number;
  maxRateHz: number;
  /** Abaixo disto é ruído de leitura, não gesto. */
  minExtentCents: number;
  /** Regularidade mínima pra chamar de vibrato. */
  minRegularity: number;
}

export const DEFAULT_VIBRATO: VibratoConfig = {
  windowMs: 1400,
  minRateHz: 4,
  maxRateHz: 9,
  minExtentCents: 12,
  minRegularity: 0.55,
};

/** Mínimos que a janela precisa juntar antes de afirmar que há vibrato. */
const MIN_SAMPLES = 8;
const MIN_SPAN_MS = 400;
const MIN_CROSSINGS = 4;
const MIN_EXTREMA = 2;
const MS_PER_SECOND = 1000;

export interface VibratoAnalysis {
  /** Passou nos três testes: taxa, extensão e regularidade. */
  active: boolean;
  /** Altura em torno da qual oscila - é este o número que julga a afinação. */
  centerCents: number;
  /** Amplitude em ± cents. */
  extentCents: number;
  rateHz: number;
  /** 0..1. Baixo = oscilação sem período, ou seja, instabilidade. */
  regularity: number;
  samples: number;
}

const IDLE: VibratoAnalysis = {
  active: false,
  centerCents: 0,
  extentCents: 0,
  rateHz: 0,
  regularity: 0,
  samples: 0,
};

export class VibratoTracker {
  private times: number[] = [];
  private values: number[] = [];
  private clock = 0;
  private cfg: VibratoConfig;

  constructor(cfg: Partial<VibratoConfig> = {}) {
    this.cfg = { ...DEFAULT_VIBRATO, ...cfg };
  }

  reset(): void {
    this.times = [];
    this.values = [];
    this.clock = 0;
  }

  push(cents: number, dtMs: number): void {
    this.clock += dtMs;
    this.times.push(this.clock);
    this.values.push(cents);
    const cutoff = this.clock - this.cfg.windowMs;
    let drop = 0;
    while (drop < this.times.length && this.times[drop] < cutoff) drop += 1;
    if (drop > 0) {
      this.times.splice(0, drop);
      this.values.splice(0, drop);
    }
  }

  analyze(): VibratoAnalysis {
    const { times, values, cfg } = this;
    const sampleCount = values.length;
    if (sampleCount < MIN_SAMPLES) return IDLE;
    const span = times[sampleCount - 1] - times[0];
    if (span < MIN_SPAN_MS) return IDLE;

    // Centro provisório pela mediana. Serve só pra achar os cruzamentos: a
    // janela quase nunca fecha num ciclo redondo, e a sobra de meio ciclo puxa a
    // mediana alguns cents pro lado.
    const provisional = medianOf(values);
    const crossings = crossingsOf(times, values, provisional, sampleCount);
    if (crossings.length < MIN_CROSSINGS) return { ...IDLE, centerCents: provisional, samples: sampleCount };

    // Um extremo por meio-ciclo: pico, vale, pico, vale…
    const extrema: number[] = [];
    for (let crossingIndex = 1; crossingIndex < crossings.length; crossingIndex += 1) {
      let extreme = provisional;
      let best = -1;
      for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
        if (times[sampleIndex] < crossings[crossingIndex - 1] || times[sampleIndex] > crossings[crossingIndex]) continue;
        const distance = Math.abs(values[sampleIndex] - provisional);
        if (distance > best) {
          best = distance;
          extreme = values[sampleIndex];
        }
      }
      if (best >= 0) extrema.push(extreme);
    }
    if (extrema.length < MIN_EXTREMA) return { ...IDLE, centerCents: provisional, samples: sampleCount };

    // O centro é a média dos pontos médios entre extremos consecutivos. Cada par
    // pico/vale devolve o centro por conta própria, então sobra de ciclo na borda
    // da janela não enviesa nada - e é o centro que julga a afinação, então esses
    // poucos cents são exatamente os que não podem ser perdidos.
    let midSum = 0;
    for (let extremaIndex = 1; extremaIndex < extrema.length; extremaIndex += 1) {
      midSum += (extrema[extremaIndex - 1] + extrema[extremaIndex]) / 2;
    }
    const center = midSum / (extrema.length - 1);

    const halves: number[] = [];
    for (let crossingIndex = 1; crossingIndex < crossings.length; crossingIndex += 1) {
      halves.push(crossings[crossingIndex] - crossings[crossingIndex - 1]);
    }
    const meanHalf = halves.reduce((sum, value) => sum + value, 0) / halves.length;
    if (meanHalf <= 0) return { ...IDLE, centerCents: center, samples: sampleCount };
    const rateHz = MS_PER_SECOND / (2 * meanHalf);

    const variance = halves.reduce((sum, value) => sum + (value - meanHalf) ** 2, 0) / halves.length;
    const regularity = Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / meanHalf));

    // Extensão = média dos picos. Média, não máximo: um outlier não deve virar a
    // extensão relatada.
    const extentCents =
      extrema.reduce((sum, extreme) => sum + Math.abs(extreme - center), 0) / extrema.length;

    const active =
      rateHz >= cfg.minRateHz &&
      rateHz <= cfg.maxRateHz &&
      extentCents >= cfg.minExtentCents &&
      regularity >= cfg.minRegularity;

    return { active, centerCents: center, extentCents, rateHz, regularity, samples: sampleCount };
  }
}

/** Instantes em que o contorno cruza o centro, interpolados entre amostras. */
function crossingsOf(times: number[], values: number[], center: number, sampleCount: number): number[] {
  const out: number[] = [];
  for (let sampleIndex = 1; sampleIndex < sampleCount; sampleIndex += 1) {
    const previous = values[sampleIndex - 1] - center;
    const current = values[sampleIndex] - center;
    if (previous === 0 || current === 0 || previous * current > 0) continue;
    out.push(times[sampleIndex - 1] + (previous / (previous - current)) * (times[sampleIndex] - times[sampleIndex - 1]));
  }
  return out;
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
