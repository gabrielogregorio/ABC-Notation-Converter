import { describe, it, expect } from "vitest";
import { adjustDurations, removeSlurs } from "../src/music/transform";
import { parseAbc } from "../src/music/abcParser";
import { DROWSY_MAGGIE_2 } from "./fixtures";

const HEAD = "X:1\nL:1/8\nK:D\n";

describe("adjustDurations", () => {
  it("turns an eighth (one unit) into a quarter at +1", () => {
    // The user's spec: a half-beat note (an eighth in L:1/8) at +1 becomes a
    // full beat (a quarter). A plain `E` (length 1) -> `E2`.
    expect(adjustDurations(HEAD + "E", 1)).toBe(HEAD + "E2");
  });

  it("adds the delta in unit-lengths to explicit durations", () => {
    expect(adjustDurations(HEAD + "E2 GE", 1)).toBe(HEAD + "E3 G2E2");
    expect(adjustDurations(HEAD + "E", 2)).toBe(HEAD + "E3");
    expect(adjustDurations(HEAD + "E", 4)).toBe(HEAD + "E5");
  });

  it("adds to fractional durations", () => {
    expect(adjustDurations(HEAD + "A/2", 1)).toBe(HEAD + "A3/2");
    expect(adjustDurations(HEAD + "A/", 1)).toBe(HEAD + "A3/2");
  });

  it("keeps octave marks and accidentals attached to the note", () => {
    expect(adjustDurations(HEAD + "^g' _B,", 1)).toBe(HEAD + "^g'2 _B,2");
  });

  it("lengthens unit rests but not the note letter's neighbours", () => {
    expect(adjustDurations(HEAD + "z E", 1)).toBe(HEAD + "z2 E2");
  });

  it("shortens with a negative delta and never drops below half a unit", () => {
    expect(adjustDurations(HEAD + "A2", -1)).toBe(HEAD + "A"); // 2 - 1 = 1
    expect(adjustDurations(HEAD + "A", -1)).toBe(HEAD + "A/2"); // 1 - 1 clamped to 1/2
  });

  it("is a no-op at delta 0", () => {
    expect(adjustDurations(DROWSY_MAGGIE_2, 0)).toBe(DROWSY_MAGGIE_2);
  });

  it("never touches headers, only the tune body", () => {
    const out = adjustDurations(DROWSY_MAGGIE_2, 1);
    expect(out).toContain("L: 1/8");
    expect(out).toContain("M: 4/4");
    expect(out).toContain("K: Edor");
  });

  it("stretches the chord as a whole, not each inner note", () => {
    expect(adjustDurations(HEAD + "[CEG]", 1)).toBe(HEAD + "[CEG]2");
    expect(adjustDurations(HEAD + "[CEG]2", 2)).toBe(HEAD + "[CEG]4");
  });

  it("leaves tuplet markers and inline fields alone", () => {
    expect(adjustDurations(HEAD + "(3EEE", 1)).toBe(HEAD + "(3E2E2E2");
    expect(adjustDurations(HEAD + "[K:G]E", 1)).toBe(HEAD + "[K:G]E2");
  });

  it("keeps the note stream identical, only longer", () => {
    const before = parseAbc(HEAD + "E2 GE BEGE").notes.map((n) => n.midi);
    const after = parseAbc(adjustDurations(HEAD + "E2 GE BEGE", 2)).notes.map((n) => n.midi);
    expect(after).toEqual(before);
  });
});

describe("removeSlurs", () => {
  it("drops slur parentheses but keeps tuplet markers", () => {
    expect(removeSlurs(HEAD + "(3EEE (GA) Bc")).toBe(HEAD + "(3EEE GA Bc");
  });

  it("drops ties", () => {
    expect(removeSlurs(HEAD + "A-A B-c")).toBe(HEAD + "AA Bc");
  });

  it("leaves chord symbols and decorations untouched", () => {
    expect(removeSlurs(HEAD + '"Am"A !trill!B')).toBe(HEAD + '"Am"A !trill!B');
  });

  it("does not alter headers or a slur-free body", () => {
    expect(removeSlurs(HEAD + "EGE BEGE")).toBe(HEAD + "EGE BEGE");
  });
});
