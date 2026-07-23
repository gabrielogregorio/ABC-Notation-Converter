import { describe, it, expect, beforeEach } from 'vitest';
import { loadPrefs, savePrefs, normalizePrefs, DEFAULT_PREFS } from './prefs.ts';

beforeEach(() => {
  localStorage.clear();
});

describe('normalizePrefs', () => {
  it('preenche defaults a partir de objeto vazio', () => {
    expect(normalizePrefs({})).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
  });
  it('faz clamp de valores inválidos', () => {
    const p = normalizePrefs({ bpm: 5, beatsPerBar: 99, subdivisions: 9, swing: 2, volume: 5 });
    expect(p.bpm).toBe(20);
    expect(p.beatsPerBar).toBe(12);
    expect(p.subdivisions).toBe(4);
    expect(p.swing).toBe(0.75);
    expect(p.volume).toBe(1);
  });
  it('sanitiza acentos inválidos', () => {
    const p = normalizePrefs({ accents: ['accent', 'x', 'muted'] as never });
    expect(p.accents).toEqual(['accent', 'normal', 'muted']);
  });
  it('acentos não-array viram vazio', () => {
    expect(normalizePrefs({ accents: 'nope' as never }).accents).toEqual([]);
  });
});

describe('load/save prefs', () => {
  it('retorna defaults sem nada salvo', () => {
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('faz round-trip', () => {
    const p = {
      bpm: 140,
      beatsPerBar: 3,
      subdivisions: 2,
      swing: 0.5,
      volume: 0.8,
      accents: ['accent', 'muted', 'normal'] as const,
    };
    savePrefs({ ...p, accents: [...p.accents] });
    expect(loadPrefs()).toEqual({ ...p, accents: [...p.accents] });
  });

  it('normaliza ao salvar valores fora do intervalo', () => {
    savePrefs({ bpm: 9999, beatsPerBar: 0, subdivisions: 9, swing: 3, volume: 2, accents: [] });
    const p = loadPrefs();
    expect(p.bpm).toBe(400);
    expect(p.beatsPerBar).toBe(1);
    expect(p.subdivisions).toBe(4);
    expect(p.swing).toBe(0.75);
    expect(p.volume).toBe(1);
  });

  it('recupera de JSON corrompido', () => {
    localStorage.setItem('musicstudio.metronome.prefs', '{not json');
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });
});
