import { describe, it, expect } from 'vitest';
import { buildSystems, measureBeatsOf } from './layout';
import { prepareSong, type SongNoteJSON } from './song';

function measuresOf(notes: SongNoteJSON[], ts?: [number, number]) {
  const prepared = prepareSong({ id: 'x', title: 'x', instrument: 't', tempo: 80, notes });
  const { systems } = buildSystems(prepared.notes, measureBeatsOf(ts));
  return systems.flatMap((s) => s.measures);
}

describe('measureBeatsOf', () => {
  it('converte a fórmula em tempos de semínima', () => {
    expect(measureBeatsOf([2, 4])).toBe(2);
    expect(measureBeatsOf([4, 4])).toBe(4);
    expect(measureBeatsOf([3, 4])).toBe(3);
    expect(measureBeatsOf([6, 8])).toBe(3);
    expect(measureBeatsOf([2, 2])).toBe(4);
  });
  it('assume 4/4 sem compasso ou com valores zerados', () => {
    expect(measureBeatsOf(undefined)).toBe(4);
    expect(measureBeatsOf([0, 4])).toBe(4);
    expect(measureBeatsOf([4, 0])).toBe(4);
  });
});

describe('buildSystems - agrupamento em compassos', () => {
  it('lista vazia não gera sistemas', () => {
    expect(buildSystems([], 4).systems).toEqual([]);
  });

  it('fecha o compasso ao completar os tempos (2/4)', () => {
    // 4 colcheias = 2 tempos = 1 compasso; depois mais 2 = 2º compasso
    const ms = measuresOf(
      Array.from({ length: 8 }, () => ({ note: 'C5', beats: 0.5 })),
      [2, 4],
    );
    expect(ms).toHaveLength(2);
    expect(ms[0].beats).toBeCloseTo(2);
    expect(ms[1].beats).toBeCloseTo(2);
  });

  it('não deixa uma nota estourar o compasso (abre outro antes)', () => {
    // 3 semínimas em 4/4: 1,1,1 cabem; a mínima seguinte (2) abriria estouro
    const ms = measuresOf(
      [
        { note: 'C5', beats: 1 },
        { note: 'D5', beats: 1 },
        { note: 'E5', beats: 1 },
        { note: 'F5', beats: 2 },
      ],
      [4, 4],
    );
    expect(ms).toHaveLength(2);
    expect(ms[0].beats).toBeCloseTo(3);
    expect(ms[1].beats).toBeCloseTo(2);
  });

  it('permite um último compasso incompleto (escala de 9 tempos em 4/4)', () => {
    const notes: SongNoteJSON[] = [
      ...Array.from({ length: 7 }, () => ({ note: 'D5', beats: 1 })),
      { note: 'D6', beats: 2 },
    ];
    const ms = measuresOf(notes, [4, 4]);
    // 4 | 3 | 2  → o último compasso fica com 2 tempos, sem estourar
    expect(ms.map((m) => m.beats)).toEqual([4, 3, 2]);
  });
});

describe('buildSystems - quebra de linha e mapas', () => {
  // 24 compassos de 4/4 com bastante nota forçam múltiplos sistemas.
  const many: SongNoteJSON[] = [];
  for (let i = 0; i < 24; i += 1) {
    many.push({ note: 'C5', beats: 1 }, { note: 'D5', beats: 1 }, { note: 'E5', beats: 1 }, { note: 'F5', beats: 1 });
  }

  it('quebra em mais de uma linha em vez de crescer sem fim', () => {
    const prepared = prepareSong({ id: 'x', title: 'x', instrument: 't', tempo: 80, notes: many });
    const { systems, sysOfNote, posOfNote } = buildSystems(prepared.notes, 4);
    expect(systems.length).toBeGreaterThan(1);
    // todo índice de nota tem sistema e posição válidos
    expect(sysOfNote).toHaveLength(prepared.notes.length);
    for (let i = 0; i < prepared.notes.length; i += 1) {
      expect(sysOfNote[i]).toBeGreaterThanOrEqual(0);
      expect(posOfNote[i]).toBeGreaterThanOrEqual(0);
      expect(posOfNote[i]).toBeLessThanOrEqual(1);
    }
    // sistemas em ordem não-decrescente ao longo da sequência
    for (let i = 1; i < sysOfNote.length; i += 1) {
      expect(sysOfNote[i]).toBeGreaterThanOrEqual(sysOfNote[i - 1]);
    }
  });

  it('uma nota só vira um sistema com posição 0', () => {
    const prepared = prepareSong({ id: 'x', title: 'x', instrument: 't', tempo: 80, notes: [{ note: 'C5', beats: 1 }] });
    const { systems, posOfNote } = buildSystems(prepared.notes, 4);
    expect(systems).toHaveLength(1);
    expect(posOfNote[0]).toBe(0);
  });
});
