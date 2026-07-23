import { describe, it, expect } from "vitest";
import { buildFingeringTable, fingeringForOffset, MAX_OFFSET } from "./fingerings";

describe("buildFingeringTable", () => {
  it("fills every offset from 0 to MAX_OFFSET inclusive", () => {
    const table = buildFingeringTable();
    expect(table).toHaveLength(MAX_OFFSET + 1);
    expect(table.every((fingering) => fingering.holes.length === 6)).toBe(true);
  });

  it("wraps the octave so offset 12 repeats offset 0", () => {
    const table = buildFingeringTable();
    expect(table[12].holes).toEqual(table[0].holes);
  });
});

describe("fingeringForOffset", () => {
  it("gives the all-closed tonic shape at offset 0", () => {
    expect(fingeringForOffset(0)).toEqual({ holes: [1, 1, 1, 1, 1, 1], awkward: false });
  });

  it("flags the half-hole accidental at offset 1 as awkward", () => {
    expect(fingeringForOffset(1)).toEqual({ holes: [1, 1, 1, 1, 1, 0.5], awkward: true });
  });

  it("repeats the lower-octave fingering an octave up (offset 12 == offset 0)", () => {
    expect(fingeringForOffset(12)?.holes).toEqual(fingeringForOffset(0)?.holes);
  });

  it("still resolves the top of the two-octave range", () => {
    expect(fingeringForOffset(MAX_OFFSET)?.holes).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("returns null below the range", () => {
    expect(fingeringForOffset(-1)).toBeNull();
  });

  it("returns null above MAX_OFFSET", () => {
    expect(fingeringForOffset(MAX_OFFSET + 1)).toBeNull();
  });

  it("exposes a two-octave chromatic ceiling", () => {
    expect(MAX_OFFSET).toBe(24);
  });
});
