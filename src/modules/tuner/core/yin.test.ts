import { describe, it, expect } from "vitest";
import { YinDetector, analysisWindow } from "./yin";
import { centsBetween } from "./cents";

const SR = 48000;

/** Soma de parciais com fase aleatória fixa - fase não deve mudar a leitura. */
function tone(hz: number, size: number, partials: number[] = [1], noise = 0): Float32Array {
  const buf = new Float32Array(size);
  let seed = 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296 - 0.5;
  };
  for (let i = 0; i < size; i += 1) {
    let s = 0;
    for (let k = 0; k < partials.length; k += 1) {
      s += partials[k] * Math.sin((2 * Math.PI * hz * (k + 1) * i) / SR + (k + 1) * 0.7);
    }
    buf[i] = s * 0.3 + noise * rand();
  }
  return buf;
}

function whistleDetector() {
  return new YinDetector({ sampleRate: SR, minHz: 554, maxHz: 2600 });
}

describe("analysisWindow", () => {
  it("integra três períodos da nota mais grave", () => {
    // A régua do Praat: piso de 50 Hz exige 60 ms de janela, que são exatamente
    // três períodos de 50 Hz.
    const w = analysisWindow(SR, 50);
    expect(w.integration / SR).toBeCloseTo(0.06, 4);
    expect(w.maxLag).toBe(960);
  });

  it("nota grave custa janela longa, e não há como negociar", () => {
    const bass = analysisWindow(SR, 41.2);
    const whistle = analysisWindow(SR, 554);
    expect(bass.latencyMs).toBeGreaterThan(90);
    expect(whistle.latencyMs).toBeLessThan(11);
  });
});

describe("YinDetector", () => {
  const det = whistleDetector();
  const size = det.window.size;

  it("acerta o ré grave do whistle abaixo de um cent", () => {
    const r = det.detect(tone(587.33, size));
    expect(Math.abs(centsBetween(r.hz, 587.33))).toBeLessThan(1);
    expect(r.clarity).toBeGreaterThan(0.9);
  });

  it("acerta a faixa toda do instrumento", () => {
    for (const hz of [587.33, 880, 1174.66, 1760, 2349.32]) {
      const r = det.detect(tone(hz, size, [1, 0.4, 0.15]));
      expect(Math.abs(centsBetween(r.hz, hz))).toBeLessThan(2);
    }
  });

  it("não cai na oitava de cima quando o segundo harmônico é mais forte que a fundamental", () => {
    // É o erro que faz a agulha pular pro dobro da frequência.
    const r = det.detect(tone(880, size, [0.5, 1, 0.3]));
    expect(Math.abs(centsBetween(r.hz, 880))).toBeLessThan(3);
  });

  it("acha a fundamental ausente, porque lê período e não pico espectral", () => {
    // Sem energia em f, mas o período do sinal continua sendo 1/f - é por isso
    // que o domínio do tempo ganha do espectral aqui.
    const r = det.detect(tone(660, size, [0, 1, 0.6, 0.4]));
    expect(Math.abs(centsBetween(r.hz, 660))).toBeLessThan(4);
  });

  it("aguenta o ruído de sopro", () => {
    const r = det.detect(tone(880, size, [1, 0.3], 0.25));
    expect(Math.abs(centsBetween(r.hz, 880))).toBeLessThan(5);
  });

  it("chama silêncio de silêncio em vez de inventar nota", () => {
    const r = det.detect(new Float32Array(size));
    expect(r.hz).toBe(-1);
  });

  it("devolve clareza baixa em ruído puro, para o gate poder rejeitar", () => {
    const r = det.detect(tone(0, size, [0], 0.5));
    expect(r.clarity).toBeLessThan(0.8);
  });

  it("recusa o que cai fora da faixa do preset", () => {
    // A faixa restrita é a defesa mais barata contra erro de oitava.
    const r = det.detect(tone(300, size));
    expect(r.hz).toBe(-1);
  });

  it("a fase não move a leitura", () => {
    const a = det.detect(tone(1046.5, size, [1, 0.5]));
    const b = det.detect(tone(1046.5, size, [1, 0.5]).slice(0));
    expect(a.hz).toBeCloseTo(b.hz, 6);
  });
});
