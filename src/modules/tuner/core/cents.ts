/**
 * Matemática de afinação: Hz ↔ MIDI ↔ cents, nome da nota e calibração do lá.
 *
 * A oitava faz parte do nome. Um afinador cromático calcula a oitava pra achar a
 * nota e joga fora na hora de exibir - e é dessa informação descartada que sai o
 * erro clássico de afinar uma corda uma oitava acima e arrebentá-la. Mostrar
 * "Mi2" em vez de "Mi" custa zero e elimina a classe inteira do erro.
 */

export const A4_DEFAULT = 440;
/** Faixa do slider: cobre barroco (415) até as orquestras mais brilhantes. */
export const A4_MIN = 415;
export const A4_MAX = 466;

/** Constantes de teoria musical, compartilhadas por todo o afinador. */
export const SEMITONES_PER_OCTAVE = 12;
export const CENTS_PER_SEMITONE = 100;
export const CENTS_PER_OCTAVE = 1200;
/** MIDI 69 é o lá central (A4), a âncora da conversão Hz ↔ MIDI. */
export const MIDI_A4 = 69;

export type NoteNaming = "letter" | "solfege";

const LETTERS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const SOLFEGE = ["Dó", "Dó♯", "Ré", "Ré♯", "Mi", "Fá", "Fá♯", "Sol", "Sol♯", "Lá", "Lá♯", "Si"];

export function hzToMidi(hz: number, a4 = A4_DEFAULT): number {
  if (hz <= 0) return -1;
  return MIDI_A4 + SEMITONES_PER_OCTAVE * Math.log2(hz / a4);
}

export function midiToHz(midi: number, a4 = A4_DEFAULT): number {
  return a4 * Math.pow(2, (midi - MIDI_A4) / SEMITONES_PER_OCTAVE);
}

export function centsBetween(hz: number, refHz: number): number {
  if (hz <= 0 || refHz <= 0) return 0;
  return CENTS_PER_OCTAVE * Math.log2(hz / refHz);
}

/** Desvio do lá de referência em relação a 440. Constante em todo o teclado. */
export function calibrationCents(a4: number): number {
  return CENTS_PER_OCTAVE * Math.log2(a4 / A4_DEFAULT);
}

export interface NoteName {
  /** Nome completo com oitava, ex.: "D5" ou "Ré5". */
  full: string;
  /** Só a classe de altura, ex.: "D". */
  pitchClass: string;
  /** Oitava científica: dó central = 4. */
  octave: number;
}

export function noteName(midi: number, naming: NoteNaming = "letter"): NoteName {
  const rounded = Math.round(midi);
  const table = naming === "solfege" ? SOLFEGE : LETTERS;
  const pitchClass = table[((rounded % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE];
  const octave = Math.floor(rounded / SEMITONES_PER_OCTAVE) - 1;
  return { full: `${pitchClass}${octave}`, pitchClass, octave };
}

export interface Deviation {
  /** MIDI fracionário medido. */
  midi: number;
  /** Semitom mais próximo. */
  target: number;
  /** Desvio do alvo, −50..+50. */
  cents: number;
}

export function deviation(hz: number, a4 = A4_DEFAULT): Deviation {
  const midi = hzToMidi(hz, a4);
  const target = Math.round(midi);
  return { midi, target, cents: (midi - target) * CENTS_PER_SEMITONE };
}

/**
 * Quantos Hz vale um cent perto de uma frequência. Serve pra explicar ao usuário
 * por que uma spec em Hz engana: 0,1 Hz é 2,1 cents num Mi2 e 0,5 cent num Mi4 -
 * a precisão piora justamente nos graves, que é onde o afinador já falha.
 */
export function hzPerCent(hz: number): number {
  return hz * (Math.pow(2, 1 / CENTS_PER_OCTAVE) - 1);
}
