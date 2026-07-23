/**
 * Sistema de notas: parsing de notação científica ("Bb4", "F#5", "D4"),
 * conversão para MIDI/Hz, posição no pentagrama (clave de sol) e
 * rótulos pt-BR. Tudo derivável de um nome de nota - é o que o JSON
 * de música usa.
 */

export type Accidental = 'natural' | 'sharp' | 'flat' | 'doubleSharp' | 'doubleFlat';

export interface ParsedNote {
  /** Nome original, ex "Bb4". */
  name: string;
  /** Letra A-G. */
  letter: string;
  accidental: Accidental;
  octave: number;
  midi: number;
}

// Pitch-class da letra natural (C=0).
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// Índice diatônico da letra (C=0..B=6) - usado para a posição vertical no pentagrama.
const LETTER_STEP: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

const ACCIDENTAL_GLYPH: Record<Accidental, string> = {
  natural: '',
  sharp: '♯', // ♯
  flat: '♭', // ♭
  doubleSharp: '×', // ×
  doubleFlat: '♭♭',
};

const ACCIDENTAL_SEMIS: Record<Accidental, number> = {
  natural: 0,
  sharp: 1,
  flat: -1,
  doubleSharp: 2,
  doubleFlat: -2,
};

/** Parseia "Bb4", "F#5", "Cx4" (double sharp), "C4". Lança erro se inválido. */
export function parseNote(name: string): ParsedNote {
  const m = /^([A-Ga-g])(##|x|bb|#|b|n)?(-?\d+)$/.exec(name.trim());
  if (!m) throw new Error(`Nota inválida: "${name}"`);
  const letter = m[1].toUpperCase();
  const accStr = m[2] ?? '';
  const octave = parseInt(m[3], 10);
  let accidental: Accidental = 'natural';
  if (accStr === '#') accidental = 'sharp';
  else if (accStr === 'b') accidental = 'flat';
  else if (accStr === '##' || accStr === 'x') accidental = 'doubleSharp';
  else if (accStr === 'bb') accidental = 'doubleFlat';

  const midi = (octave + 1) * 12 + LETTER_PC[letter] + ACCIDENTAL_SEMIS[accidental];
  return { name, letter, accidental, octave, midi };
}

export function accidentalGlyph(acc: Accidental): string {
  return ACCIDENTAL_GLYPH[acc];
}

export function midiToHz(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Índice diatônico absoluto: passos a partir de C0. Define a linha/espaço
 * no pentagrama independentemente do acidente (Bb e B# ficam na mesma linha).
 */
export function diatonicIndex(note: ParsedNote): number {
  return note.octave * 7 + LETTER_STEP[note.letter];
}

// Notação pt-BR por pitch-class (preferindo bemóis, como no afinador do CLEO).
const PT_FLAT = ['Dó', 'Réb', 'Ré', 'Mib', 'Mi', 'Fá', 'Solb', 'Sol', 'Láb', 'Lá', 'Sib', 'Si'];
const PT_SHARP = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];

/** Rótulo pt-BR fiel ao spelling pedido (Bb → "Sib", não "Lá#"). */
export function ptLabel(note: ParsedNote): string {
  const base: Record<string, string> = {
    C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si',
  };
  return base[note.letter] + accidentalGlyph(note.accidental);
}

/** Rótulo pt-BR a partir de um MIDI fracionário (para a leitura do microfone). */
export function ptLabelFromMidi(midi: number, prefer: 'sharp' | 'flat' = 'flat'): string {
  const r = Math.round(midi);
  const pc = ((r % 12) + 12) % 12;
  const oct = Math.floor(r / 12) - 1;
  const arr = prefer === 'flat' ? PT_FLAT : PT_SHARP;
  return `${arr[pc]}${oct}`;
}
