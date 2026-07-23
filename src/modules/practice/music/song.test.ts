import { describe, it, expect } from "vitest";
import { prepareSong, validateSongJSON, type SongJSON } from "./song";

function baseSong(overrides: Partial<SongJSON> = {}): SongJSON {
  return {
    id: "test",
    title: "Teste",
    instrument: "tin-whistle",
    tempo: 120,
    notes: [{ note: "D4", beats: 1 }],
    ...overrides,
  };
}

describe("prepareSong", () => {
  it("derives durationSec from tempo (120 bpm => 0.5s per beat)", () => {
    const prepared = prepareSong(baseSong({ notes: [{ note: "D4", beats: 1 }] }));
    expect(prepared.notes[0].durationSec).toBeCloseTo(0.5);
  });

  it("falls back to 100 bpm when tempo is falsy (=> 0.6s per beat)", () => {
    const prepared = prepareSong(baseSong({ tempo: 0, notes: [{ note: "D4", beats: 1 }] }));
    expect(prepared.notes[0].durationSec).toBeCloseTo(0.6);
  });

  it("treats an empty/missing note or 'rest' (any case) as a rest with no parsed pitch", () => {
    const prepared = prepareSong(
      baseSong({ notes: [{ note: "rest", beats: 1 }, { note: "REST", beats: 1 }] }),
    );
    expect(prepared.notes.every((note) => note.isRest && note.parsed === null)).toBe(true);
  });

  it("counts only non-rest notes as playable", () => {
    const prepared = prepareSong(
      baseSong({ notes: [{ note: "D4", beats: 1 }, { note: "rest", beats: 1 }, { note: "E4", beats: 1 }] }),
    );
    expect(prepared.playableCount).toBe(2);
  });

  it("defaults a missing beats field to 1", () => {
    const prepared = prepareSong(baseSong({ tempo: 60, notes: [{ note: "D4" } as never] }));
    expect(prepared.notes[0].beats).toBe(1);
  });

  it("throws when notes is empty", () => {
    expect(() => prepareSong(baseSong({ notes: [] }))).toThrow(/notes/);
  });

  it("propagates the parse error for an invalid note name", () => {
    expect(() => prepareSong(baseSong({ notes: [{ note: "H4", beats: 1 }] }))).toThrow(/H4/);
  });
});

describe("validateSongJSON", () => {
  it("accepts a well-formed song and returns it without error", () => {
    const result = validateSongJSON(JSON.stringify(baseSong()));
    expect(result.error).toBeUndefined();
    expect(result.song?.id).toBe("test");
  });

  it("reports malformed JSON", () => {
    const result = validateSongJSON("{ not json");
    expect(result.song).toBeUndefined();
    expect(result.error).toContain("JSON inválido");
  });

  it("requires id and title", () => {
    const result = validateSongJSON(JSON.stringify(baseSong({ id: "" })));
    expect(result.error).toContain('"id"');
  });

  it("requires a tempo", () => {
    const result = validateSongJSON(JSON.stringify(baseSong({ tempo: 0 })));
    expect(result.error).toContain("tempo");
  });

  it("surfaces an invalid note as the error", () => {
    const result = validateSongJSON(JSON.stringify(baseSong({ notes: [{ note: "H4", beats: 1 }] })));
    expect(result.error).toContain("H4");
  });
});
