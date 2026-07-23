import { describe, it, expect } from 'vitest';
import { pendulumAngle, sideForBeat, bobYForBpm } from './pendulum.ts';
import { MIN_BPM, MAX_BPM } from './scheduler.ts';

describe('pendulumAngle', () => {
  const A = 40;
  it('fica no extremo positivo em beats pares', () => {
    // now == anchorPerf => fase = anchorIndex (par) => cos(0)= +1
    expect(pendulumAngle(0, 1000, 500, 1000, A)).toBeCloseTo(A);
    expect(pendulumAngle(2, 1000, 500, 1000, A)).toBeCloseTo(A);
  });
  it('fica no extremo negativo em beats ímpares', () => {
    expect(pendulumAngle(1, 1000, 500, 1000, A)).toBeCloseTo(-A);
    expect(pendulumAngle(3, 1000, 500, 1000, A)).toBeCloseTo(-A);
  });
  it('passa pelo centro no meio do beat', () => {
    // meio caminho => fase = index + 0.5 => cos(pi/2)=0
    expect(pendulumAngle(0, 1000, 500, 1250, A)).toBeCloseTo(0);
  });
  it('é monotônico e contínuo do início ao fim do beat', () => {
    const start = pendulumAngle(0, 0, 500, 0, A); // +A
    const end = pendulumAngle(0, 0, 500, 500, A); // -A (== início do beat 1)
    expect(start).toBeCloseTo(A);
    expect(end).toBeCloseTo(-A);
  });
  it('protege contra beatMs inválido', () => {
    expect(pendulumAngle(0, 0, 0, 0, A)).toBe(A);
  });
});

describe('sideForBeat', () => {
  it('alterna direita/esquerda', () => {
    expect(sideForBeat(0)).toBe(1);
    expect(sideForBeat(1)).toBe(-1);
    expect(sideForBeat(2)).toBe(1);
    expect(sideForBeat(3)).toBe(-1);
  });
});

describe('bobYForBpm', () => {
  it('BPM mínimo => peso mais alto (cy menor)', () => {
    const yMin = bobYForBpm(MIN_BPM);
    const yMax = bobYForBpm(MAX_BPM);
    expect(yMin).toBeLessThan(yMax);
  });
  it('é monotônico crescente com o BPM', () => {
    expect(bobYForBpm(60)).toBeLessThan(bobYForBpm(180));
  });
  it('faz clamp de valores fora do intervalo', () => {
    expect(bobYForBpm(-100)).toBeCloseTo(bobYForBpm(MIN_BPM));
    expect(bobYForBpm(99999)).toBeCloseTo(bobYForBpm(MAX_BPM));
  });
});
