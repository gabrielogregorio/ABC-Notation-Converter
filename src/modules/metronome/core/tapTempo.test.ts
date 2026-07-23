import { describe, it, expect } from 'vitest';
import { bpmFromTaps, relevantTaps } from './tapTempo.ts';

describe('bpmFromTaps', () => {
  it('retorna null com menos de 2 toques', () => {
    expect(bpmFromTaps([])).toBeNull();
    expect(bpmFromTaps([1000])).toBeNull();
  });

  it('calcula 120 BPM a partir de intervalos de 500ms', () => {
    expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120);
  });

  it('calcula 60 BPM a partir de intervalos de 1000ms', () => {
    expect(bpmFromTaps([0, 1000, 2000])).toBe(60);
  });

  it('rejeita outlier quando há intervalos suficientes', () => {
    // 5 intervalos de 500ms + 1 toque torto no meio; a mediana/poda protege.
    // taps regulares a cada 500ms, mas um toque atrasa 300ms extra e o próximo compensa.
    const clean = bpmFromTaps([0, 500, 1000, 1500, 2000, 2500]); // 120 BPM
    const noisy = bpmFromTaps([0, 500, 1000, 1800, 2000, 2500]); // um toque torto
    expect(clean).toBe(120);
    // sem rejeição de outliers, o 1800 puxaria o BPM; com poda fica próximo de 120
    expect(Math.abs((noisy ?? 0) - 120)).toBeLessThanOrEqual(5);
  });

  it('faz clamp ao máximo (400) em toques muito rápidos', () => {
    expect(bpmFromTaps([0, 10, 20])).toBe(400);
  });
});

describe('relevantTaps', () => {
  it('descarta toques separados por uma pausa longa', () => {
    const taps = [0, 400, 6000, 6400];
    expect(relevantTaps(taps)).toEqual([6000, 6400]);
  });
  it('limita a janela deslizante', () => {
    const many = Array.from({ length: 30 }, (_, i) => i * 500);
    expect(relevantTaps(many).length).toBeLessThanOrEqual(12);
  });
});
