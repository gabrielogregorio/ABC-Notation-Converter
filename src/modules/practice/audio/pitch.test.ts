import { describe, it, expect } from "vitest";
import { detectPitch, hzToMidi, midiToHz, PitchSmoother } from "./pitch";

describe("hzToMidi", () => {
  it("maps A4 (440 Hz) to MIDI 69", () => {
    expect(hzToMidi(440)).toBeCloseTo(69);
  });

  it("maps one octave up (880 Hz) to MIDI 81", () => {
    expect(hzToMidi(880)).toBeCloseTo(81);
  });

  it("returns -1 for non-positive Hz", () => {
    expect(hzToMidi(0)).toBe(-1);
    expect(hzToMidi(-100)).toBe(-1);
  });

  it("honours a custom reference pitch", () => {
    expect(hzToMidi(442, 442)).toBeCloseTo(69);
  });
});

describe("midiToHz", () => {
  it("maps MIDI 69 to 440 Hz", () => {
    expect(midiToHz(69)).toBeCloseTo(440);
  });

  it("round-trips with hzToMidi", () => {
    expect(hzToMidi(midiToHz(72))).toBeCloseTo(72);
  });
});

describe("detectPitch", () => {
  it("reports no pitch for a silent buffer", () => {
    const silent = new Float32Array(2048);
    expect(detectPitch(silent, 44100)).toEqual({ hz: -1, clarity: 0, rms: 0 });
  });

  it("finds the fundamental of a harmonic (whistle-like) tone within a bracketed range", () => {
    const sampleRate = 44100;
    const frequency = 440;
    const buffer = new Float32Array(4096);
    for (let sample = 0; sample < buffer.length; sample += 1) {
      const phase = (2 * Math.PI * frequency * sample) / sampleRate;
      buffer[sample] = 0.5 * Math.sin(phase) + 0.25 * Math.sin(2 * phase) + 0.12 * Math.sin(3 * phase);
    }
    const result = detectPitch(buffer, sampleRate, 300, 700);
    expect(result.hz).toBeCloseTo(frequency, 0);
    expect(result.clarity).toBeGreaterThan(0.9);
  });
});

describe("PitchSmoother", () => {
  it("returns the median of its window", () => {
    const smoother = new PitchSmoother(3);
    smoother.push(100);
    smoother.push(200);
    expect(smoother.push(300)).toBe(200);
  });

  it("drops the oldest reading once the window is full", () => {
    const smoother = new PitchSmoother(3);
    smoother.push(100);
    smoother.push(200);
    smoother.push(300);
    expect(smoother.push(400)).toBe(300);
  });

  it("shrinks the window on a dropout (-1) instead of recording it", () => {
    const smoother = new PitchSmoother(3);
    smoother.push(300);
    smoother.push(400);
    expect(smoother.push(-1)).toBe(400);
  });

  it("returns -1 after reset with no readings", () => {
    const smoother = new PitchSmoother(3);
    smoother.push(300);
    smoother.reset();
    expect(smoother.push(-1)).toBe(-1);
  });
});
