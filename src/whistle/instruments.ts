import type { Fingering } from "./fingerings";

// An instrument is anything we can draw a hole diagram for: a reference note
// (all holes closed), a way to turn a semitone offset above that note into a
// hole pattern, and a physical layout describing where to draw each hole.

export interface HoleSpec {
  x: number; // px within the column, from its left edge
  y: number; // px within the hole area, from its top
  r: number; // radius in px
}

export interface HoleLayout {
  width: number; // column width in px
  height: number; // hole-area height in px (below the note label)
  holes: HoleSpec[];
}

export interface Instrument {
  id: string;
  label: string;
  /** MIDI number of the all-holes-closed note (see pitch.ts middle-C = 60). */
  tonicMidi: number;
  maxOffset: number;
  holeCount: number;
  /** Offset at/above which the note is the over-blown octave. */
  overblowOffset?: number;
  rangeLabel: string;
  fingeringForOffset(offset: number): Fingering | null;
  layout: HoleLayout;
}

// Six holes stacked in a single column, top (nearest the mouthpiece) to bottom.
export const WHISTLE_LAYOUT: HoleLayout = {
  width: 34,
  height: 92,
  holes: [
    { x: 17, y: 0, r: 6 },
    { x: 17, y: 16, r: 6 },
    { x: 17, y: 32, r: 6 },
    { x: 17, y: 48, r: 6 },
    { x: 17, y: 64, r: 6 },
    { x: 17, y: 80, r: 6 },
  ],
};
