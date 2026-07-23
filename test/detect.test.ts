import { describe, it, expect } from "vitest";
import { looksLikeAbc, detectTempo, scoreMatch, normalize } from "../src/app/detect";

describe("looksLikeAbc", () => {
  it("recognises a pasted tune with X:/K: headers", () => {
    const tune = "X:1\nT:Drowsy Maggie\nM:4/4\nK:Edor\nE2BE dEBE|";
    expect(looksLikeAbc(tune)).toBe(true);
  });

  it("recognises a fragment with just a key field", () => {
    expect(looksLikeAbc("K:D\nDEF GAB")).toBe(true);
  });

  it("rejects a plain sentence", () => {
    expect(looksLikeAbc("open the metronome at 120 bpm")).toBe(false);
  });

  it("rejects empty / tiny input", () => {
    expect(looksLikeAbc("")).toBe(false);
    expect(looksLikeAbc("ab")).toBe(false);
  });
});

describe("detectTempo", () => {
  it("reads N bpm", () => {
    expect(detectTempo("play at 132 bpm")).toBe(132);
  });
  it("reads a bare number in range", () => {
    expect(detectTempo("96")).toBe(96);
  });
  it("reads a word + number", () => {
    expect(detectTempo("tempo 84")).toBe(84);
  });
  it("clamps out-of-range bpm", () => {
    expect(detectTempo("900 bpm")).toBe(400);
  });
  it("returns null for prose without a tempo", () => {
    expect(detectTempo("tin whistle fingering")).toBeNull();
  });
});

describe("scoreMatch", () => {
  it("is accent- and case-insensitive", () => {
    expect(normalize("Metrônomo")).toBe("metronomo");
    expect(scoreMatch("metronomo", "Metrônomo tempo bpm")).toBeGreaterThan(0);
  });
  it("counts matched tokens", () => {
    expect(scoreMatch("tempo bpm", "metronome tempo bpm pendulum")).toBe(2);
  });
  it("returns 0 when nothing matches", () => {
    expect(scoreMatch("guitar", "tin whistle fingering")).toBe(0);
  });
});
