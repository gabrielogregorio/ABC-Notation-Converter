import { describe, it, expect } from "vitest";
import { toMidi, midiToName, midiToSolfege } from "../src/music/pitch";

describe("toMidi", () => {
  it("uses middle C = 60 with capital letters in octave 4", () => {
    expect(toMidi("C", true, 0, 0)).toBe(60);
    expect(toMidi("D", true, 0, 0)).toBe(62);
    expect(toMidi("A", true, 0, 0)).toBe(69);
  });

  it("puts lowercase letters an octave above", () => {
    expect(toMidi("C", false, 0, 0)).toBe(72);
    expect(toMidi("D", false, 0, 0)).toBe(74);
  });

  it("applies octave marks: comma down, apostrophe up", () => {
    expect(toMidi("A", true, -1, 0)).toBe(57); // A,
    expect(toMidi("D", false, 1, 0)).toBe(86); // d'
  });

  it("applies accidental deltas", () => {
    expect(toMidi("F", true, 0, 1)).toBe(66); // F#
    expect(toMidi("B", true, 0, -1)).toBe(70); // Bb
  });
});

describe("naming", () => {
  it("renders scientific pitch names", () => {
    expect(midiToName(60)).toBe("C4");
    expect(midiToName(62)).toBe("D4");
    expect(midiToName(66)).toBe("F#4");
  });

  it("renders Portuguese solfège", () => {
    expect(midiToSolfege(62)).toBe("Ré");
    expect(midiToSolfege(69)).toBe("Lá");
  });
});
