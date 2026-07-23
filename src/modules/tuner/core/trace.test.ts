import { describe, it, expect } from "vitest";
import { Trace } from "./trace";

interface Sample {
  cents: number;
  clarity: number;
  voiced: boolean;
  index: number;
}

function collect(trace: Trace): Sample[] {
  const out: Sample[] = [];
  trace.forEach((cents, clarity, voiced, index) => out.push({ cents, clarity, voiced, index }));
  return out;
}

describe("Trace", () => {
  it("defaults to a capacity of 400 samples", () => {
    expect(new Trace().capacity).toBe(400);
  });

  it("starts empty and never calls forEach", () => {
    const trace = new Trace(4);
    expect(trace.length).toBe(0);
    expect(collect(trace)).toEqual([]);
  });

  it("grows length with each push up to the capacity ceiling", () => {
    const trace = new Trace(3);
    trace.push(10, 0.1, true);
    expect(trace.length).toBe(1);
    trace.push(20, 0.2, true);
    trace.push(30, 0.3, true);
    expect(trace.length).toBe(3);
    trace.push(40, 0.4, true);
    expect(trace.length).toBe(3);
  });

  it("overwrites the oldest sample once full, keeping insertion order", () => {
    const trace = new Trace(3);
    trace.push(10, 0.1, true);
    trace.push(20, 0.2, false);
    trace.push(30, 0.3, true);
    trace.push(40, 0.4, false);
    const samples = collect(trace);
    expect(samples.map((sample) => sample.cents)).toEqual([20, 30, 40]);
  });

  it("hands forEach a contiguous index 0..count-1, oldest to newest, across the wrap", () => {
    const trace = new Trace(3);
    trace.push(10, 0.1, true);
    trace.push(20, 0.2, true);
    trace.push(30, 0.3, true);
    trace.push(40, 0.4, true);
    expect(collect(trace).map((sample) => sample.index)).toEqual([0, 1, 2]);
  });

  it("round-trips the voiced flag as a boolean", () => {
    const trace = new Trace(2);
    trace.push(0, 1, true);
    trace.push(0, 1, false);
    expect(collect(trace).map((sample) => sample.voiced)).toEqual([true, false]);
  });

  it("clear() empties the trace and makes forEach a no-op", () => {
    const trace = new Trace(3);
    trace.push(10, 0.1, true);
    trace.push(20, 0.2, true);
    trace.clear();
    expect(trace.length).toBe(0);
    expect(collect(trace)).toEqual([]);
  });
});
