import { describe, it, expect } from "vitest";
import { parseAbc } from "../src/music/abcParser";
import { DROWSY_MAGGIE_2, DROWSY_MAGGIE_7 } from "./fixtures";

describe("parseAbc headers", () => {
  it("extracts title and key", () => {
    const t = parseAbc(DROWSY_MAGGIE_2);
    expect(t.title).toBe("Drowsy Maggie");
    expect(t.key.root).toBe("E");
    expect(t.key.accidentals.F).toBe(1); // F# from Edor
  });
});

describe("parseAbc note reading", () => {
  it("reads the opening notes in order", () => {
    const t = parseAbc("X:1\nK:Edor\nE2 GE BE");
    const names = t.notes.map((n) => n.raw);
    expect(names).toEqual(["E2", "G", "E", "B", "E"]);
  });

  it("applies the key signature so F becomes F#", () => {
    const t = parseAbc("X:1\nK:Edor\nFD");
    expect(t.notes[0].midi).toBe(66); // F#4
    expect(t.notes[1].midi).toBe(62); // D4
  });

  it("expands triplets like (3EEE into three notes, not a duration", () => {
    const t = parseAbc("X:1\nK:Edor\n(3EEE G");
    expect(t.notes.map((n) => n.raw)).toEqual(["E", "E", "E", "G"]);
  });

  it("honours explicit accidentals over the key signature", () => {
    const t = parseAbc("X:1\nK:Edor\n^g a");
    expect(t.notes[0].raw).toBe("^g");
    expect(t.notes[0].midi).toBe(80); // G#5
    expect(t.notes[1].midi).toBe(81); // A5
  });

  it("keeps an explicit accidental for the rest of the bar, resets after the bar", () => {
    const t = parseAbc("X:1\nK:C\n^FF|FF");
    expect(t.notes[0].midi).toBe(66); // ^F
    expect(t.notes[1].midi).toBe(66); // still sharp within the bar
    expect(t.notes[2].midi).toBe(65); // natural again after the bar line
  });

  it("reads low octave marks", () => {
    const t = parseAbc("X:1\nK:Edor\nA,C");
    expect(t.notes[0].midi).toBe(57); // A,
    expect(t.notes[1].midi).toBe(61); // C -> C# from Edor
  });

  it("skips grace notes, chord symbols and decorations", () => {
    const t = parseAbc('X:1\nK:D\n"Gm"{ag}~G !trill!A');
    expect(t.notes.map((n) => n.raw)).toEqual(["G", "A"]);
    expect(t.warnings).toHaveLength(0);
  });
});

describe("parseAbc warnings", () => {
  it("reports symbols it cannot model", () => {
    const t = parseAbc("X:1\nK:D\nA ? B");
    expect(t.warnings.length).toBeGreaterThan(0);
    expect(t.warnings[0].token).toBe("?");
  });

  it("treats % as a comment, not an error", () => {
    const t = parseAbc("X:1\nK:D\nAB % this is a comment with G and stuff\nCD");
    expect(t.warnings).toHaveLength(0);
    expect(t.notes.map((n) => n.raw)).toEqual(["A", "B", "C", "D"]);
  });

  it("parses both reference tunes without spurious warnings", () => {
    expect(parseAbc(DROWSY_MAGGIE_2).warnings).toHaveLength(0);
    expect(parseAbc(DROWSY_MAGGIE_7).warnings).toHaveLength(0);
  });
});
