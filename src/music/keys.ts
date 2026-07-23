import type { Letter } from "./pitch";

// Resolve an ABC K: field into the set of accidentals implied by its key
// signature, so notes without an explicit ^/_/= inherit the right sharp/flat.

export type Accidentals = Record<Letter, number>; // -1 flat, 0 natural, +1 sharp

type Mode = "maj" | "min" | "dor" | "phr" | "lyd" | "mix" | "loc";

// Distance in fifths from Ionian for each mode. Major key of the tonic plus
// this offset gives the mode's position on the circle of fifths.
const MODE_OFFSET: Record<Mode, number> = {
  maj: 0,
  lyd: 1,
  mix: -1,
  dor: -2,
  min: -3,
  phr: -4,
  loc: -5,
};

// Fifths from C for each natural letter (C G D A E B F -> 0..5, F = -1).
const FIFTHS_FROM_C: Record<Letter, number> = {
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  F: -1,
};

const SHARP_ORDER: Letter[] = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER: Letter[] = ["B", "E", "A", "D", "G", "C", "F"];

const NO_ACCIDENTALS: Accidentals = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };

// Mode names are matched on their first three letters ("dor", "mix", ...).
const MODE_ABBREV_LENGTH = 3;
// A root sharp/flat shifts the key seven positions along the circle of fifths.
const FIFTHS_PER_CHROMATIC_STEP = 7;

export interface KeyInfo {
  root: string;
  mode: Mode;
  fifths: number; // >0 sharps, <0 flats
  accidentals: Accidentals;
  explicit: Partial<Record<Letter, number>>; // accidentals named directly in K:
}

function normaliseMode(raw: string): Mode {
  const modePrefix = raw.trim().toLowerCase().slice(0, MODE_ABBREV_LENGTH);
  switch (modePrefix) {
    case "":
    case "maj":
    case "ion":
      return "maj";
    case "min":
    case "m":
    case "aeo":
      return "min";
    case "dor":
      return "dor";
    case "phr":
      return "phr";
    case "lyd":
      return "lyd";
    case "mix":
      return "mix";
    case "loc":
      return "loc";
    default:
      // A bare trailing "m" (e.g. "Em") also means minor.
      if (raw.trim().toLowerCase() === "m") return "min";
      return "maj";
  }
}

/**
 * Parse a K: field such as "Edor", "Bb", "F#mix", "C", "Am".
 * Unknown or empty keys fall back to C major (no accidentals).
 */
export function parseKey(field: string): KeyInfo {
  const raw = (field ?? "").trim();
  const match = raw.match(/^([A-Ga-g])([#b]?)\s*([A-Za-z]*)/);
  if (!match) {
    return { root: "C", mode: "maj", fifths: 0, accidentals: { ...NO_ACCIDENTALS }, explicit: {} };
  }

  const rootLetter = match[1].toUpperCase() as Letter;
  const rootAcc = match[2];
  const mode = normaliseMode(match[3]);

  // Explicit accidentals appended to the key (e.g. "K:D exp ^c") are rare in
  // session tunes; capture trailing ^x / _x tokens if present.
  const explicit: Partial<Record<Letter, number>> = {};
  const rest = raw.slice(match[0].length);
  for (const accToken of rest.matchAll(/([_^=])([A-Ga-g])/g)) {
    const delta = accToken[1] === "^" ? 1 : accToken[1] === "_" ? -1 : 0;
    explicit[accToken[2].toUpperCase() as Letter] = delta;
  }

  let fifths = FIFTHS_FROM_C[rootLetter] + MODE_OFFSET[mode];
  if (rootAcc === "#") fifths += FIFTHS_PER_CHROMATIC_STEP;
  if (rootAcc === "b") fifths -= FIFTHS_PER_CHROMATIC_STEP;

  const accidentals: Accidentals = { ...NO_ACCIDENTALS };
  if (fifths > 0) {
    for (let sharpIndex = 0; sharpIndex < fifths && sharpIndex < SHARP_ORDER.length; sharpIndex += 1) {
      accidentals[SHARP_ORDER[sharpIndex]] = 1;
    }
  } else if (fifths < 0) {
    for (let flatIndex = 0; flatIndex < -fifths && flatIndex < FLAT_ORDER.length; flatIndex += 1) {
      accidentals[FLAT_ORDER[flatIndex]] = -1;
    }
  }

  for (const [letter, delta] of Object.entries(explicit)) {
    accidentals[letter as Letter] = delta as number;
  }

  return { root: rootLetter + rootAcc, mode, fifths, accidentals, explicit };
}
