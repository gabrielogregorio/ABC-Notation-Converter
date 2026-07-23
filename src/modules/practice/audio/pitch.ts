/**
 * Detector de pitch via NSDF (McLeod Pitch Method - MPM).
 * Portado do afinador do CLEO. JS puro, sem FFT - ótimo para instrumentos
 * monofônicos de sopro como tin whistle. Range largo (~55Hz a ~2100Hz).
 *
 * Referência: Philip McLeod & Geoff Wyvill - "A Smarter Way to Find Pitch".
 */

export interface PitchResult {
  /** Frequência em Hz. -1 se não detectado. */
  hz: number;
  /** Clareza/confiança 0..1. */
  clarity: number;
  /** RMS do buffer (volume). */
  rms: number;
}

const MIN_RMS = 0.006;
const CLARITY_THRESHOLD = 0.88;

export function detectPitch(
  buf: Float32Array,
  sampleRate: number,
  minHz = 55,
  maxHz = 2100,
): PitchResult {
  const size = buf.length;
  let rms = 0;
  for (let i = 0; i < size; i += 1) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / size);
  if (rms < MIN_RMS) return { hz: -1, clarity: 0, rms };

  const maxLag = Math.min(size - 1, Math.floor(sampleRate / minHz));
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));

  const nsdf = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let acf = 0;
    let m = 0;
    const n = size - lag;
    for (let i = 0; i < n; i += 1) {
      const a = buf[i];
      const b = buf[i + lag];
      acf += a * b;
      m += a * a + b * b;
    }
    nsdf[lag] = m > 0 ? (2 * acf) / m : 0;
  }

  let bestLag = -1;
  let bestVal = CLARITY_THRESHOLD;
  let inPositive = false;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    if (nsdf[lag] > 0) inPositive = true;
    if (!inPositive) continue;
    const prev = nsdf[lag - 1] ?? 0;
    const next = nsdf[lag + 1] ?? 0;
    if (nsdf[lag] > bestVal && nsdf[lag] > prev && nsdf[lag] >= next) {
      bestVal = nsdf[lag];
      bestLag = lag;
    }
  }

  if (bestLag < 0) return { hz: -1, clarity: 0, rms };

  const x0 = nsdf[bestLag - 1] ?? bestVal;
  const x1 = bestVal;
  const x2 = nsdf[bestLag + 1] ?? bestVal;
  const denom = x0 - 2 * x1 + x2;
  const shift = denom !== 0 ? (0.5 * (x0 - x2)) / denom : 0;
  const refinedLag = bestLag + shift;

  const hz = sampleRate / refinedLag;
  return { hz, clarity: bestVal, rms };
}

/** Hz → nota MIDI (fracionária). -1 se Hz inválido. */
export function hzToMidi(hz: number, a4 = 440): number {
  if (hz <= 0) return -1;
  return 69 + 12 * Math.log2(hz / a4);
}

export function midiToHz(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** Filtro mediano para estabilizar a leitura de Hz. */
export class PitchSmoother {
  private hzHistory: number[] = [];
  private max: number;

  constructor(windowSize = 6) {
    this.max = windowSize;
  }

  push(hz: number): number {
    if (hz > 0) {
      this.hzHistory.push(hz);
      if (this.hzHistory.length > this.max) this.hzHistory.shift();
    } else if (this.hzHistory.length > 0) {
      this.hzHistory.shift();
    }
    if (this.hzHistory.length === 0) return -1;
    const sorted = [...this.hzHistory].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  reset(): void {
    this.hzHistory = [];
  }
}
