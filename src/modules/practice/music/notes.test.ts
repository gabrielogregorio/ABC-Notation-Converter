import { describe, it, expect } from 'vitest';
import { parseNote, diatonicIndex, ptLabel, ptLabelFromMidi } from './notes';
import { prepareSong } from './song';
import { fingeringForMidi } from './fingerings';

describe('parseNote', () => {
  it('parseia notas naturais', () => {
    expect(parseNote('C4').midi).toBe(60); // dó central
    expect(parseNote('A4').midi).toBe(69); // Lá 440
    expect(parseNote('D5').midi).toBe(74);
  });
  it('aplica acidentes', () => {
    expect(parseNote('Bb4').midi).toBe(70);
    expect(parseNote('F#5').midi).toBe(78);
    expect(parseNote('C#6').midi).toBe(85);
  });
  it('rejeita lixo', () => {
    expect(() => parseNote('H9')).toThrow();
  });
});

describe('diatonicIndex', () => {
  it('Bb4 e B4 ocupam a mesma linha do pentagrama', () => {
    expect(diatonicIndex(parseNote('Bb4'))).toBe(diatonicIndex(parseNote('B4')));
  });
  it('cresce de C para B', () => {
    expect(diatonicIndex(parseNote('C5'))).toBe(diatonicIndex(parseNote('B4')) + 1);
  });
});

describe('rótulos pt-BR', () => {
  it('respeita o spelling pedido', () => {
    expect(ptLabel(parseNote('Bb4'))).toBe('Si♭');
    expect(ptLabel(parseNote('F#5'))).toBe('Fá♯');
  });
  it('rótulo a partir de midi', () => {
    expect(ptLabelFromMidi(69)).toBe('Lá4');
  });
});

describe('prepareSong', () => {
  it('deriva durações e conta notas tocáveis', () => {
    const song = prepareSong({
      id: 't', title: 'T', instrument: 'tin-whistle', tempo: 120,
      notes: [{ note: 'D5', beats: 1 }, { note: 'rest', beats: 1 }, { note: 'A5', beats: 2 }],
    });
    expect(song.playableCount).toBe(2);
    expect(song.notes[0].durationSec).toBeCloseTo(0.5); // 1 tempo a 120bpm
    expect(song.notes[1].isRest).toBe(true);
    expect(song.notes[2].durationSec).toBeCloseTo(1.0);
  });
});

describe('fingeringForMidi (whistle em D)', () => {
  it('D4 (1º grau) = todos fechados', () => {
    const f = fingeringForMidi(62, 'D');
    expect(f?.holes).toEqual([1, 1, 1, 1, 1, 1]);
    expect(f?.overblow).toBe(false);
  });
  it('D5 = oitava com sobressopro', () => {
    const f = fingeringForMidi(74, 'D');
    expect(f?.overblow).toBe(true);
  });
  it('nota fora do range retorna null', () => {
    expect(fingeringForMidi(40, 'D')).toBeNull();
  });
});
