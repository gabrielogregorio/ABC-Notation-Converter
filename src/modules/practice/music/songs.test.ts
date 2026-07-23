import { describe, it, expect } from 'vitest';
import { DEFAULT_SONGS } from './defaultSongs';
import { prepareSong, validateSongJSON } from './song';
import { parseNote } from './notes';
import { tempoMark, tempoLine } from './tempo';

describe('DEFAULT_SONGS - integridade', () => {
  it('toda música prepara sem erro e tem conteúdo tocável', () => {
    for (const s of DEFAULT_SONGS) {
      const prepared = prepareSong(s);
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.tempo).toBeGreaterThan(0);
      expect(prepared.playableCount).toBeGreaterThan(0);
      // durações válidas
      for (const n of s.notes) expect(n.beats).toBeGreaterThan(0);
    }
  });

  it('os ids são únicos', () => {
    const ids = DEFAULT_SONGS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('toda música tem uma linha de andamento definida (nunca "-")', () => {
    for (const s of DEFAULT_SONGS) {
      expect(tempoMark(s.tempo)).not.toBe('-');
      expect(tempoLine(s.tempo, s.timeSignature)).toContain(`/${(s.timeSignature ?? [4, 4])[1]}`);
    }
  });
});

describe('Asa Branca e Imagine - transcrição', () => {
  const NEW = ['asa-branca-completa', 'imagine'];

  it('as duas foram adicionadas', () => {
    for (const id of NEW) expect(DEFAULT_SONGS.find((s) => s.id === id)).toBeDefined();
  });

  it('não usam acidentes além de Si♭ (regra do usuário)', () => {
    for (const id of NEW) {
      const song = DEFAULT_SONGS.find((s) => s.id === id)!;
      for (const n of song.notes) {
        if (!n.note || n.note.toLowerCase() === 'rest') continue;
        const p = parseNote(n.note);
        const ok = p.accidental === 'natural' || (p.accidental === 'flat' && p.letter === 'B');
        expect(ok, `${song.id}: nota ${n.note} usa acidente proibido`).toBe(true);
      }
    }
  });

  it('cada compasso da Asa Branca fecha em 2 tempos (2/4)', () => {
    const song = DEFAULT_SONGS.find((s) => s.id === 'asa-branca-completa')!;
    const total = song.notes.reduce((a, n) => a + n.beats, 0);
    expect(song.timeSignature).toEqual([2, 4]);
    expect(total).toBe(32); // 16 compassos × 2 tempos
  });

  it('Imagine fecha em compassos inteiros de 4/4', () => {
    const song = DEFAULT_SONGS.find((s) => s.id === 'imagine')!;
    const total = song.notes.reduce((a, n) => a + n.beats, 0);
    expect(total % 4).toBe(0);
  });
});

describe('prepareSong / validateSongJSON - edge cases', () => {
  it('rejeita lista de notas vazia', () => {
    expect(() => prepareSong({ id: 'x', title: 'x', instrument: 't', tempo: 80, notes: [] })).toThrow();
  });

  it('rejeita nota inválida ao preparar', () => {
    expect(() =>
      prepareSong({ id: 'x', title: 'x', instrument: 't', tempo: 80, notes: [{ note: 'H9', beats: 1 }] }),
    ).toThrow();
  });

  it('validateSongJSON: JSON malformado devolve erro, não lança', () => {
    const { song, error } = validateSongJSON('{ nope');
    expect(song).toBeUndefined();
    expect(error).toContain('JSON inválido');
  });

  it('validateSongJSON: campos obrigatórios ausentes', () => {
    expect(validateSongJSON(JSON.stringify({ title: 'sem id', tempo: 80, notes: [] })).error).toContain('id');
    expect(validateSongJSON(JSON.stringify({ id: 'a', title: 'b', notes: [] })).error).toContain('tempo');
  });

  it('validateSongJSON: música válida passa', () => {
    const raw = JSON.stringify({
      id: 'ok',
      title: 'ok',
      instrument: 'tin-whistle',
      tempo: 90,
      timeSignature: [3, 4],
      notes: [{ note: 'C5', beats: 1 }, { note: 'rest', beats: 1 }],
    });
    const { song, error } = validateSongJSON(raw);
    expect(error).toBeUndefined();
    expect(song?.id).toBe('ok');
  });
});
