import { fingeringForOffset, MAX_OFFSET, type Fingering } from "./fingerings";
import { WHISTLE_LAYOUT, type Instrument } from "./instruments";
import type { ParsedNote } from "../music/abcParser";
import { midiToName, midiToSolfege } from "../music/pitch";

// A whistle is a six-hole instrument whose fingerings repeat every octave, so
// one shared table serves every key; only the all-closed note changes. The
// chromatic set of keys mirrors the dropdown of the old mandolintab converter.

function makeWhistle(id: string, label: string, tonicMidi: number): Instrument {
  return {
    id,
    label,
    tonicMidi,
    maxOffset: MAX_OFFSET,
    holeCount: 6,
    overblowOffset: 12,
    rangeLabel: "tessitura de duas oitavas",
    fingeringForOffset,
    layout: WHISTLE_LAYOUT,
  };
}

// Reference note = the written ABC pitch that fingers "all closed", using the
// middle-C = 60 convention (see pitch.ts). A D whistle's low D is `D` = 62.
// Labels are the universal note names; the UI adds a localised "most common" tag.
export const WHISTLES: Instrument[] = [
  makeWhistle("C", "C", 60),
  makeWhistle("C#", "C♯", 61),
  makeWhistle("D", "D", 62),
  makeWhistle("Eb", "E♭", 63),
  makeWhistle("E", "E", 64),
  makeWhistle("F", "F", 65),
  makeWhistle("F#", "F♯", 66),
  makeWhistle("G", "G", 67),
  makeWhistle("Ab", "A♭", 68),
  makeWhistle("A", "A", 69),
  makeWhistle("Bb", "B♭", 70),
  makeWhistle("B", "B", 71),
];

export const DEFAULT_WHISTLE = "D";

export function whistleById(id: string): Instrument {
  return (
    WHISTLES.find((whistle) => whistle.id === id) ??
    WHISTLES.find((whistle) => whistle.id === DEFAULT_WHISTLE) ??
    WHISTLES[0]
  );
}

export type TabColumn =
  | {
      playable: true;
      note: ParsedNote;
      offset: number;
      fingering: Fingering;
      octave: 1 | 2;
      name: string; // scientific pitch name, e.g. "E4"
      solfege: string; // "Mi"
    }
  | {
      playable: false;
      note: ParsedNote;
      offset: number;
      name: string;
      solfege: string;
      reason: string;
    };

export interface TabResult {
  columns: TabColumn[];
  rangeWarnings: string[];
}

/**
 * Map an ordered list of parsed notes onto an instrument's fingerings,
 * reporting any note that falls outside its playable range.
 */
export function buildTab(notes: ParsedNote[], instrument: Instrument): TabResult {
  const columns: TabColumn[] = [];
  const rangeWarnings: string[] = [];
  const seen = new Set<string>();

  for (const note of notes) {
    const offset = note.midi - instrument.tonicMidi;
    const name = midiToName(note.midi);
    const solfege = midiToSolfege(note.midi);
    const fingering = instrument.fingeringForOffset(offset);

    if (!fingering) {
      const where = offset < 0 ? "abaixo" : "acima";
      const reason = `"${name}" (${solfege}) está ${where} do alcance de "${instrument.label}" - ${instrument.rangeLabel}`;
      columns.push({ playable: false, note, offset, name, solfege, reason });
      const dedupe = `${name}|${where}`;
      if (!seen.has(dedupe)) {
        seen.add(dedupe);
        rangeWarnings.push(reason);
      }
      continue;
    }

    const octave: 1 | 2 =
      instrument.overblowOffset !== undefined && offset >= instrument.overblowOffset ? 2 : 1;

    columns.push({ playable: true, note, offset, fingering, octave, name, solfege });
  }

  return { columns, rangeWarnings };
}

export { MAX_OFFSET };
