// Pitch helpers built around MIDI note numbers, using the ABC convention that
// an unmarked capital letter sits in octave 4 (middle C = `C` = MIDI 60) and a
// lowercase letter sits one octave above it.

export type Letter = "C" | "D" | "E" | "F" | "G" | "A" | "B";

const SEMITONE: Record<Letter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const SEMITONES_PER_OCTAVE = 12;
// ABC convention: an unmarked capital letter sits in octave 4.
const BASE_OCTAVE = 4;

const NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Portuguese solfège labels, handy for the UI and for warnings.
const SOLFEGE = ["Dó", "Dó#", "Ré", "Ré#", "Mi", "Fá", "Fá#", "Sol", "Sol#", "Lá", "Lá#", "Si"];

export function letterSemitone(letter: Letter): number {
  return SEMITONE[letter];
}

/**
 * MIDI number for a written ABC pitch.
 *
 * @param letter    note letter, always upper case here
 * @param upper     true when the ABC token was a capital letter (octave 4 base)
 * @param octaveShift  net octave marks: +1 per apostrophe, -1 per comma
 * @param accidental   semitone delta from an explicit ^/_/= (0 when none)
 */
export function toMidi(
  letter: Letter,
  upper: boolean,
  octaveShift: number,
  accidental: number,
): number {
  const octave = (upper ? BASE_OCTAVE : BASE_OCTAVE + 1) + octaveShift;
  return (octave + 1) * SEMITONES_PER_OCTAVE + SEMITONE[letter] + accidental;
}

export function midiToName(midi: number): string {
  const name = NAMES_SHARP[((midi % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE];
  const octave = Math.floor(midi / SEMITONES_PER_OCTAVE) - 1;
  return `${name}${octave}`;
}

export function midiToSolfege(midi: number): string {
  return SOLFEGE[((midi % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE];
}
