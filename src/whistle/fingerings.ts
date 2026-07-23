// Six-hole fingering table for a six-hole whistle, indexed by the number of
// semitones above the whistle's lowest (all-holes-closed) note. Because every
// six-hole whistle is the same instrument shifted in pitch, one table serves
// every key - only the reference note changes (D whistle = D, C whistle = C).
//
// A hole state: 1 closed, 0 open, 0.5 half-hole. Holes run top (nearest the
// mouthpiece, index 0) to bottom (index 5). The two-octave chromatic range is
// offsets 0..24; the upper octave repeats the lower fingerings played harder.

export type HoleState = 0 | 0.5 | 1;
export type Holes = HoleState[];

export interface Fingering {
  holes: Holes;
  /** true when the note needs a cross-fingering or half-hole (an accidental). */
  awkward: boolean;
}

const F = (holes: Holes, awkward = false): Fingering => ({ holes, awkward });

// One octave of chromatic fingerings. Naturals are the universally agreed
// diatonic shapes; the in-between accidentals use the common half-hole /
// cross-fingering conventions and are flagged as awkward.
const OCTAVE: Fingering[] = [
  F([1, 1, 1, 1, 1, 1]), //  0  tonic          (D on a D whistle)
  F([1, 1, 1, 1, 1, 0.5], true), //  1  +1 half-hole  (D#/Eb)
  F([1, 1, 1, 1, 1, 0]), //  2  major 2nd     (E)
  F([1, 1, 1, 1, 0.5, 0], true), //  3  minor 3rd half (F natural)
  F([1, 1, 1, 1, 0, 0]), //  4  major 3rd     (F#)
  F([1, 1, 1, 0, 0, 0]), //  5  perfect 4th   (G)
  F([1, 1, 0.5, 0, 0, 0], true), //  6  tritone half  (G#/Ab)
  F([1, 1, 0, 0, 0, 0]), //  7  perfect 5th   (A)
  F([1, 0.5, 0, 0, 0, 0], true), //  8  minor 6th half (A#/Bb)
  F([1, 0, 0, 0, 0, 0]), //  9  major 6th     (B)
  F([0, 1, 1, 0, 0, 0], true), // 10  minor 7th cross (C natural)
  F([0, 0, 0, 0, 0, 0]), // 11  major 7th     (C#)
];

// Two chromatic octaves: offsets 0..24 (the top note repeats the tonic shape).
export const MAX_OFFSET = 24;

// offset -> fingering, for offsets 0..MAX_OFFSET. The upper octave repeats the
// lower fingerings; the very top note (two octaves up) is commonly voiced by
// cracking the top hole but keeps the all-closed shape, same as the tonic.
export function buildFingeringTable(): Fingering[] {
  const table: Fingering[] = [];
  for (let offset = 0; offset <= MAX_OFFSET; offset += 1) {
    const base = OCTAVE[offset % OCTAVE.length];
    table[offset] = { holes: base.holes, awkward: base.awkward };
  }
  return table;
}

const TABLE: Fingering[] = buildFingeringTable();

export function fingeringForOffset(offset: number): Fingering | null {
  if (offset < 0 || offset > MAX_OFFSET) return null;
  return TABLE[offset];
}
