import { describe, it, expect } from "vitest";
import { tempoTermKey } from "./Metronome";

describe("tempoTermKey", () => {
  it.each([
    [40, "metro.term.largo"],
    [59, "metro.term.largo"],
    [60, "metro.term.adagio"],
    [75, "metro.term.adagio"],
    [76, "metro.term.andante"],
    [107, "metro.term.andante"],
    [108, "metro.term.moderato"],
    [119, "metro.term.moderato"],
    [120, "metro.term.allegro"],
    [167, "metro.term.allegro"],
    [168, "metro.term.presto"],
    [240, "metro.term.presto"],
  ])("maps %i bpm to the %s term", (bpm, key) => {
    expect(tempoTermKey(bpm)).toBe(key);
  });
});
