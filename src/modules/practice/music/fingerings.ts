/**
 * Dedilhado para tin whistle diatônico de 6 furos, parametrizado por
 * afinação. Portado do "whistle-forge" do CLEO. O PADRÃO de dedilhado é
 * o mesmo em qualquer whistle - muda só a altura produzida.
 *
 * Arrays de furos: 6 furos do bocal (topo) para a base.
 *   1 = fechado, 0 = aberto, 0.5 = meia-abertura.
 */
export type HoleState = 0 | 0.5 | 1;
export type Fingering = [HoleState, HoleState, HoleState, HoleState, HoleState, HoleState];

export interface WhistleKey {
  id: string;
  label: string;
  /** MIDI do 1º grau (todos os furos fechados). */
  rootMidi: number;
}

export const WHISTLE_KEYS: WhistleKey[] = [
  { id: 'D', label: 'Ré (D) - padrão irlandês', rootMidi: 62 },
  { id: 'C', label: 'Dó (C)', rootMidi: 60 },
  { id: 'G', label: 'Sol (G) - whistle baixo', rootMidi: 55 },
  { id: 'Bb', label: 'Si♭ (B♭)', rootMidi: 58 },
  { id: 'A', label: 'Lá (A)', rootMidi: 57 },
  { id: 'F', label: 'Fá (F)', rootMidi: 53 },
  { id: 'Eb', label: 'Mi♭ (E♭)', rootMidi: 51 },
];

export const DEFAULT_WHISTLE_KEY = 'D';

interface PatternStep {
  semitones: number;
  holes: Fingering;
  overblow: boolean;
}

/** Padrão de dedilhado do whistle diatônico. ~2 oitavas. */
const PATTERN: PatternStep[] = [
  { semitones: 0, holes: [1, 1, 1, 1, 1, 1], overblow: false },
  { semitones: 2, holes: [1, 1, 1, 1, 1, 0], overblow: false },
  { semitones: 4, holes: [1, 1, 1, 1, 0, 0], overblow: false },
  { semitones: 5, holes: [1, 1, 1, 0, 0, 0], overblow: false },
  { semitones: 7, holes: [1, 1, 0, 0, 0, 0], overblow: false },
  { semitones: 9, holes: [1, 0, 0, 0, 0, 0], overblow: false },
  { semitones: 10, holes: [0, 1, 1, 0, 0, 0], overblow: false },
  { semitones: 11, holes: [0, 0, 0, 0, 0, 0], overblow: false },
  { semitones: 12, holes: [0, 1, 1, 1, 1, 1], overblow: true },
  { semitones: 14, holes: [1, 1, 1, 1, 1, 0], overblow: true },
  { semitones: 16, holes: [1, 1, 1, 1, 0, 0], overblow: true },
  { semitones: 17, holes: [1, 1, 1, 0, 0, 0], overblow: true },
  { semitones: 19, holes: [1, 1, 0, 0, 0, 0], overblow: true },
  { semitones: 21, holes: [1, 0, 0, 0, 0, 0], overblow: true },
  { semitones: 22, holes: [0, 1, 1, 0, 0, 0], overblow: true },
  { semitones: 23, holes: [0, 0, 0, 0, 0, 0], overblow: true },
  { semitones: 24, holes: [0, 1, 1, 1, 1, 1], overblow: true },
];

export interface WhistleFingering {
  holes: Fingering;
  overblow: boolean;
}

/**
 * Encontra o dedilhado mais próximo para um dado MIDI numa afinação.
 * Retorna null se a nota cair fora do range do whistle (com 1 semitom
 * de tolerância para enarmonias).
 */
export function fingeringForMidi(
  midi: number,
  keyId: string,
  octaveAgnostic = false,
): WhistleFingering | null {
  const key = WHISTLE_KEYS.find((k) => k.id === keyId) ?? WHISTLE_KEYS[0];
  let best: PatternStep | null = null;
  let bestDist = octaveAgnostic ? Infinity : 1.01;
  for (const step of PATTERN) {
    const stepMidi = key.rootMidi + step.semitones;
    // por classe de nota (ignora oitava) ou por altura exata
    const d = octaveAgnostic
      ? Math.abs((((stepMidi - midi) % 12) + 18) % 12 - 6)
      : Math.abs(stepMidi - midi);
    if (d < bestDist) {
      bestDist = d;
      best = step;
    }
  }
  if (octaveAgnostic && best && bestDist > 0.5) return null; // classe não existe no whistle
  return best ? { holes: best.holes, overblow: best.overblow } : null;
}
