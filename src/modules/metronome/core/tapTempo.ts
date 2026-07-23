/**
 * Tap tempo - converte timestamps (ms) de toques em BPM.
 *
 * Refinamentos: janela de 8–12 toques, **rejeição de outliers** (descarta maior e menor
 * intervalo quando há amostras suficientes), reset após 2000ms de pausa,
 * BPM = 60000 ÷ intervalo médio, clamp a 20–400.
 */
import { clampBpm } from './scheduler.ts';

/** Pausa máxima entre toques (ms) antes de reiniciar a série. */
export const TAP_RESET_MS = 2000;
/** Janela deslizante de toques considerada. */
export const MAX_TAPS = 12;

/** Recorta a série contígua mais recente (sem pausas > TAP_RESET_MS). */
export function relevantTaps(taps: number[]): number[] {
  if (taps.length === 0) return [];
  const sorted = [...taps].sort((a, b) => a - b);
  const recent: number[] = [sorted[sorted.length - 1]];
  for (let i = sorted.length - 2; i >= 0; i -= 1) {
    if (sorted[i + 1] - sorted[i] > TAP_RESET_MS) break; // pausa longa: corta aqui
    recent.unshift(sorted[i]);
    if (recent.length >= MAX_TAPS) break;
  }
  return recent;
}

/** Intervalos entre toques consecutivos. */
function intervals(taps: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < taps.length; i += 1) out.push(taps[i] - taps[i - 1]);
  return out;
}

/**
 * BPM a partir dos toques, ou null se não houver toques suficientes.
 * Com ≥4 intervalos, descarta o maior e o menor (rejeição de outliers) antes
 * de tirar a média - um toque torto não estraga a leitura.
 */
export function bpmFromTaps(taps: number[]): number | null {
  const relevant = relevantTaps(taps);
  if (relevant.length < 2) return null;
  let iv = intervals(relevant);
  if (iv.length >= 4) {
    iv = [...iv].sort((a, b) => a - b).slice(1, -1); // remove extremos
  }
  const avg = iv.reduce((s, x) => s + x, 0) / iv.length;
  if (avg <= 0) return null;
  return clampBpm(60000 / avg);
}
