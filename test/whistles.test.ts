import { describe, it, expect } from "vitest";
import { fingeringForOffset, MAX_OFFSET } from "../src/whistle/fingerings";
import { buildTab, whistleById, WHISTLES } from "../src/whistle/whistles";
import { parseAbc } from "../src/music/abcParser";
import { DROWSY_MAGGIE_2 } from "./fixtures";

describe("fingeringForOffset", () => {
  it("closes every hole for the tonic", () => {
    expect(fingeringForOffset(0)!.holes).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("opens the bottom hole for the major second", () => {
    expect(fingeringForOffset(2)!.holes).toEqual([1, 1, 1, 1, 1, 0]);
  });

  it("opens everything for the major seventh", () => {
    expect(fingeringForOffset(11)!.holes).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("repeats the tonic shape one octave up", () => {
    expect(fingeringForOffset(12)!.holes).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("flags accidentals as awkward", () => {
    expect(fingeringForOffset(3)!.awkward).toBe(true); // F natural, half-hole
    expect(fingeringForOffset(2)!.awkward).toBe(false); // E, clean
  });

  it("rejects offsets outside the two-octave range", () => {
    expect(fingeringForOffset(-1)).toBeNull();
    expect(fingeringForOffset(MAX_OFFSET + 1)).toBeNull();
  });
});

describe("whistle catalogue", () => {
  it("offers the full chromatic set of keys like mandolintab", () => {
    const ids = WHISTLES.map((w) => w.id);
    expect(ids).toEqual(["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]);
  });

  it("spaces each key one semitone apart from C4", () => {
    expect(whistleById("C").tonicMidi).toBe(60);
    expect(whistleById("Eb").tonicMidi).toBe(63);
    expect(whistleById("F#").tonicMidi).toBe(66);
    expect(whistleById("B").tonicMidi).toBe(71);
  });

  it("fingers the same shape for each whistle's own tonic", () => {
    for (const w of WHISTLES) {
      const notes = [{ midi: w.tonicMidi, letter: "C" as const, accidental: 0, raw: "" }];
      const col = buildTab(notes, w).columns[0];
      expect(col.playable).toBe(true);
      if (col.playable) expect(col.fingering.holes).toEqual([1, 1, 1, 1, 1, 1]);
    }
  });

  it("defaults to the D whistle for an unknown id", () => {
    expect(whistleById("nope").id).toBe("D");
  });
});

describe("buildTab range handling", () => {
  const D = whistleById("D");
  const C = whistleById("C");

  it("marks notes below the D whistle's low D as unplayable", () => {
    const notes = parseAbc("X:1\nK:Edor\nA,C").notes; // A,=57, C=61(C#)
    const { columns, rangeWarnings } = buildTab(notes, D);
    expect(columns[0].playable).toBe(false); // A, is below low D
    expect(rangeWarnings.length).toBeGreaterThan(0);
  });

  it("lets a C whistle play a low C that a D whistle cannot", () => {
    const notes = parseAbc("X:1\nK:C\nC").notes; // C = 60
    expect(buildTab(notes, D).columns[0].playable).toBe(false);
    const onC = buildTab(notes, C).columns[0];
    expect(onC.playable).toBe(true);
    if (onC.playable) {
      expect(onC.offset).toBe(0);
      expect(onC.fingering.holes).toEqual([1, 1, 1, 1, 1, 1]);
    }
  });

  it("places high lowercase notes in the second octave", () => {
    const notes = parseAbc("X:1\nK:Edor\nb").notes; // b = 83
    const col = buildTab(notes, D).columns[0];
    expect(col.playable).toBe(true);
    if (col.playable) {
      expect(col.offset).toBe(21);
      expect(col.octave).toBe(2);
    }
  });

  it("produces a column for every parsed note in a full tune", () => {
    const notes = parseAbc(DROWSY_MAGGIE_2).notes;
    const { columns } = buildTab(notes, D);
    expect(columns).toHaveLength(notes.length);
    // The tune sits mostly in range; only the low A,/C dip is unplayable.
    const unplayable = columns.filter((c) => !c.playable);
    expect(unplayable.length).toBeGreaterThan(0);
    expect(unplayable.every((c) => !c.playable && c.offset < 0)).toBe(true);
  });
});
