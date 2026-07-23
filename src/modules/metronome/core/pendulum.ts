/**
 * Matemática do pêndulo - pura e testável (sem DOM).
 *
 * Um metrônomo mecânico bate nos extremos do balanço: no instante de cada beat
 * o braço está totalmente para um lado. Modelamos o ângulo como
 * `A * cos(pi * fase)`, onde `fase` é a posição contínua em beats. Em beats
 * inteiros cos(pi*n) = ±1 (extremos), e entre eles o movimento é suave e mais
 * rápido no centro - igual a um pêndulo real. Como é contínuo, o click coincide
 * com o extremo do balanço.
 */
import { clampBpm, MIN_BPM, MAX_BPM } from './scheduler.ts';

/** Ângulo (graus) do braço para a fase/ancoragem dados. */
export function pendulumAngle(
  anchorIndex: number,
  anchorPerf: number,
  beatMs: number,
  now: number,
  amplitude: number,
): number {
  if (beatMs <= 0) return amplitude;
  const phase = anchorIndex + (now - anchorPerf) / beatMs;
  return amplitude * Math.cos(Math.PI * phase);
}

/** Lado que o braço ocupa no beat dado: +1 (direita) em beats pares, -1 nos ímpares. */
export function sideForBeat(beatIndex: number): 1 | -1 {
  return beatIndex % 2 === 0 ? 1 : -1;
}

// Geometria do SVG: braço de y=42 (topo) até o pivô em y=210.
const BOB_TOP = 70;
const BOB_BOTTOM = 186;

/**
 * Posição vertical (cy) do peso conforme o BPM. Como num metrônomo real, peso
 * mais alto = mais lento; então BPM baixo aproxima o peso do topo e BPM alto o
 * aproxima do pivô.
 */
export function bobYForBpm(bpm: number): number {
  const b = clampBpm(bpm);
  const frac = (b - MIN_BPM) / (MAX_BPM - MIN_BPM); // 0..1
  return BOB_TOP + frac * (BOB_BOTTOM - BOB_TOP);
}
