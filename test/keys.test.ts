import { describe, it, expect } from "vitest";
import { parseKey } from "../src/music/keys";

describe("parseKey", () => {
  it("reads a plain major key", () => {
    const k = parseKey("D");
    expect(k.fifths).toBe(2);
    expect(k.accidentals.F).toBe(1);
    expect(k.accidentals.C).toBe(1);
    expect(k.accidentals.G).toBe(0);
  });

  it("reads E dorian as two sharps (F#, C#)", () => {
    const k = parseKey("Edor");
    expect(k.fifths).toBe(2);
    expect(k.accidentals.F).toBe(1);
    expect(k.accidentals.C).toBe(1);
  });

  it("reads G mixolydian as no accidentals (F natural)", () => {
    const k = parseKey("Gmix");
    expect(k.fifths).toBe(0);
    expect(k.accidentals.F).toBe(0);
  });

  it("reads A minor as no accidentals", () => {
    expect(parseKey("Am").fifths).toBe(0);
    expect(parseKey("Amin").fifths).toBe(0);
  });

  it("reads flat keys", () => {
    const k = parseKey("Bb");
    expect(k.fifths).toBe(-2);
    expect(k.accidentals.B).toBe(-1);
    expect(k.accidentals.E).toBe(-1);
  });

  it("falls back to C major on empty or garbage", () => {
    expect(parseKey("").fifths).toBe(0);
    expect(parseKey("???").fifths).toBe(0);
  });
});
