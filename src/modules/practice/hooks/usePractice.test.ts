import { describe, it, expect } from "vitest";
import { statusForCents, noteAccuracy } from "./usePractice";

const TOLERANCE = 30;

describe("statusForCents", () => {
  it("is good exactly at the tolerance boundary", () => {
    expect(statusForCents(TOLERANCE, TOLERANCE)).toBe("good");
  });

  it("is close just past the tolerance and up to 2.5x it", () => {
    expect(statusForCents(TOLERANCE + 1, TOLERANCE)).toBe("close");
    expect(statusForCents(TOLERANCE * 2.5, TOLERANCE)).toBe("close");
  });

  it("is wrong past 2.5x the tolerance", () => {
    expect(statusForCents(TOLERANCE * 2.5 + 1, TOLERANCE)).toBe("wrong");
  });
});

describe("noteAccuracy", () => {
  it("is a perfect 1 with no deviation", () => {
    expect(noteAccuracy(0, TOLERANCE)).toBe(1);
  });

  it("is 0 at the tolerance edge", () => {
    expect(noteAccuracy(TOLERANCE, TOLERANCE)).toBe(0);
  });

  it("is linear in between", () => {
    expect(noteAccuracy(TOLERANCE / 2, TOLERANCE)).toBeCloseTo(0.5);
  });

  it("clamps to 0 for deviation beyond the tolerance", () => {
    expect(noteAccuracy(TOLERANCE * 2, TOLERANCE)).toBe(0);
  });
});
