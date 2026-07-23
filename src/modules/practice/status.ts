/**
 * Paleta de feedback do treino - fonte única. Antes o mesmo mapa estava copiado
 * em quatro componentes (Practice, PitchMeter, Staff, HistoryPanel) e já havia
 * divergido (um laranja diferente na barra de histórico). Aqui mora uma vez só.
 *
 * Verde/laranja/vermelho/ciano = acerto, perto, erro, ocioso. É uma paleta de
 * status (não os tokens verde/latão da marca), então vive em constantes nomeadas
 * em TS: os valores alimentam atributos `fill` de SVG, onde `var(--token)` do CSS
 * não resolve.
 */
import type { NoteStatus } from "./hooks/usePractice";
import type { HoleState } from "./music/fingerings";

export const STATUS_COLOR: Record<NoteStatus, string> = {
  good: "#34D399",
  close: "#F59E5C",
  wrong: "#F2735C",
  idle: "#57CBED",
};

/** Traço do furo quando não há dedilhado ativo (o whistle fica "apagado"). */
export const INACTIVE_HOLE_STROKE = "#3a5563";

const HISTORY_GOOD_MIN_PCT = 80;
const HISTORY_MID_MIN_PCT = 50;

/** Cor da barra de histórico por acurácia (0..100%). */
export function historyBarColor(accuracyPercent: number): string {
  if (accuracyPercent >= HISTORY_GOOD_MIN_PCT) return STATUS_COLOR.good;
  if (accuracyPercent >= HISTORY_MID_MIN_PCT) return STATUS_COLOR.close;
  return STATUS_COLOR.wrong;
}

// Sufixo alfa (~50%) para a meia-abertura, no formato #RRGGBBAA.
const HALF_HOLE_ALPHA_HEX = "80";

/** Preenchimento de um furo: cheio, meia-abertura (translúcido) ou vazado. */
export function holeFill(state: HoleState, color: string): string {
  if (state === 1) return color;
  if (state === 0.5) return `${color}${HALF_HOLE_ALPHA_HEX}`;
  return "transparent";
}
