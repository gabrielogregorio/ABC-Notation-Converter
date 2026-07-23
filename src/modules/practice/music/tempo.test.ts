import { describe, it, expect } from 'vitest';
import { tempoMark, beatUnitGlyph, tempoLine } from './tempo';

describe('tempoMark', () => {
  it('classifica os BPMs das músicas do app como Andante', () => {
    // escala 80, twinkle 96, asa trecho 88, asa completa 80, imagine 76
    for (const bpm of [76, 80, 88, 96]) expect(tempoMark(bpm)).toBe('Andante');
  });

  it('respeita os limites de cada faixa (limite superior exclusivo)', () => {
    expect(tempoMark(39)).toBe('Grave');
    expect(tempoMark(40)).toBe('Largo');
    expect(tempoMark(59)).toBe('Largo');
    expect(tempoMark(60)).toBe('Larghetto');
    expect(tempoMark(65)).toBe('Larghetto');
    expect(tempoMark(66)).toBe('Adagio');
    expect(tempoMark(75)).toBe('Adagio');
    expect(tempoMark(76)).toBe('Andante');
    expect(tempoMark(107)).toBe('Andante');
    expect(tempoMark(108)).toBe('Moderato');
    expect(tempoMark(119)).toBe('Moderato');
    expect(tempoMark(120)).toBe('Allegro');
    expect(tempoMark(167)).toBe('Allegro');
    expect(tempoMark(168)).toBe('Presto');
    expect(tempoMark(199)).toBe('Presto');
    expect(tempoMark(200)).toBe('Prestissimo');
    expect(tempoMark(400)).toBe('Prestissimo');
  });

  it('trata BPM fracionário pela faixa exata (75.9 ainda é Adagio)', () => {
    expect(tempoMark(75.9)).toBe('Adagio');
    expect(tempoMark(76.0001)).toBe('Andante');
  });

  it('devolve "-" para BPM inválido em vez de quebrar', () => {
    expect(tempoMark(0)).toBe('-');
    expect(tempoMark(-10)).toBe('-');
    expect(tempoMark(NaN)).toBe('-');
    expect(tempoMark(Infinity)).toBe('-');
    expect(tempoMark(-Infinity)).toBe('-');
  });
});

describe('beatUnitGlyph', () => {
  it('mapeia denominadores comuns para o glifo da nota', () => {
    expect(beatUnitGlyph(4)).toBe('♩'); // semínima
    expect(beatUnitGlyph(8)).toBe('♪'); // colcheia
  });

  it('semibreve/mínima/semicolcheia são glifos distintos e não vazios', () => {
    for (const den of [1, 2, 16]) {
      expect(beatUnitGlyph(den)).toBeTruthy();
      expect(beatUnitGlyph(den)).not.toBe(beatUnitGlyph(4));
    }
  });

  it('cai no ♩ para denominadores fora da tabela', () => {
    expect(beatUnitGlyph(3)).toBe('♩');
    expect(beatUnitGlyph(0)).toBe('♩');
    expect(beatUnitGlyph(-1)).toBe('♩');
    expect(beatUnitGlyph(32)).toBe('♩');
  });
});

describe('tempoLine', () => {
  it('monta a linha completa com andamento, pulso e compasso', () => {
    expect(tempoLine(80, [2, 4])).toBe('Andante · ♩ = 80 · 2/4');
    expect(tempoLine(76, [4, 4])).toBe('Andante · ♩ = 76 · 4/4');
  });

  it('assume 4/4 quando não há compasso', () => {
    expect(tempoLine(80)).toBe('Andante · ♩ = 80 · 4/4');
  });

  it('usa o glifo do denominador em compasso composto', () => {
    expect(tempoLine(120, [6, 8])).toBe('Allegro · ♪ = 120 · 6/8');
  });

  it('arredonda o BPM para exibição', () => {
    expect(tempoLine(79.6, [4, 4])).toBe('Andante · ♩ = 80 · 4/4');
  });

  it('omite o "= n" quando o BPM é inválido, sem quebrar', () => {
    expect(tempoLine(NaN, [3, 4])).toBe('- · ♩ · 3/4');
    expect(tempoLine(0, [2, 4])).toBe('- · ♩ · 2/4');
  });
});
