import { describe, it, expect } from "vitest";
import { VibratoTracker } from "./vibrato";

const DT = 12.5; // 80 análises por segundo

function drive(v: VibratoTracker, ms: number, fn: (tMs: number) => number) {
  for (let t = 0; t < ms; t += DT) v.push(fn(t), DT);
}

/** Ruído determinístico - teste com random de verdade seria flaky. */
function noise(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296 - 0.5;
  };
}

describe("VibratoTracker", () => {
  it("mede taxa, extensão e centro de um vibrato de sopro", () => {
    const v = new VibratoTracker();
    drive(v, 1400, (t) => 40 * Math.sin((2 * Math.PI * 6 * t) / 1000));
    const a = v.analyze();
    expect(a.active).toBe(true);
    expect(a.rateHz).toBeCloseTo(6, 0);
    expect(a.extentCents).toBeGreaterThan(30);
    expect(a.extentCents).toBeLessThan(45);
    expect(Math.abs(a.centerCents)).toBeLessThan(6);
    expect(a.regularity).toBeGreaterThan(0.85);
  });

  it("o centro é o veredito: vibrato largo centrado no alvo está afinado", () => {
    // Um afinador que testa o valor instantâneo reprova isto. É o erro que
    // ensina o músico a soprar torto pra agradar a tela.
    const v = new VibratoTracker();
    drive(v, 1400, (t) => 2 + 50 * Math.sin((2 * Math.PI * 5.5 * t) / 1000));
    const a = v.analyze();
    expect(a.active).toBe(true);
    expect(a.centerCents).toBeCloseTo(2, 0);
    expect(a.extentCents).toBeGreaterThan(40);
  });

  it("acha o centro deslocado quando o vibrato inteiro está desafinado", () => {
    const v = new VibratoTracker();
    drive(v, 1400, (t) => -25 + 30 * Math.sin((2 * Math.PI * 6 * t) / 1000));
    const a = v.analyze();
    expect(a.active).toBe(true);
    expect(a.centerCents).toBeCloseTo(-25, 0);
  });

  it("oscilação sem período não é vibrato, é falta de controle", () => {
    // A regularidade é o desempate. Sem ela, canto instável recebe o mesmo
    // elogio que vibrato controlado - é o modo de falha que o próprio autor do
    // método Nakano registrou.
    const v = new VibratoTracker();
    const rnd = noise(11);
    drive(v, 1400, () => 60 * rnd());
    expect(v.analyze().active).toBe(false);
  });

  it("nota parada não é vibrato", () => {
    const v = new VibratoTracker();
    drive(v, 1400, () => 3);
    expect(v.analyze().active).toBe(false);
  });

  it("tremor pequeno de leitura não é vibrato", () => {
    const v = new VibratoTracker();
    drive(v, 1400, (t) => 4 * Math.sin((2 * Math.PI * 6 * t) / 1000));
    expect(v.analyze().active).toBe(false);
  });

  it("deriva lenta de sopro não é vibrato", () => {
    // Cair 15-20 cents nos primeiros segundos é fisiologia respiratória normal.
    // Chamar isso de vibrato - ou de erro - seria punir a respiração.
    const v = new VibratoTracker();
    drive(v, 1400, (t) => -20 * (t / 1400));
    expect(v.analyze().active).toBe(false);
  });

  it("trêmulo rápido demais fica fora da faixa musical", () => {
    const v = new VibratoTracker();
    drive(v, 1400, (t) => 40 * Math.sin((2 * Math.PI * 14 * t) / 1000));
    expect(v.analyze().active).toBe(false);
  });

  it("não opina sem história suficiente", () => {
    const v = new VibratoTracker();
    drive(v, 200, (t) => 40 * Math.sin((2 * Math.PI * 6 * t) / 1000));
    expect(v.analyze().active).toBe(false);
  });

  it("esquece o que saiu da janela", () => {
    const v = new VibratoTracker({ windowMs: 800 });
    drive(v, 800, () => 0);
    drive(v, 800, (t) => 40 * Math.sin((2 * Math.PI * 6 * t) / 1000));
    const a = v.analyze();
    expect(a.active).toBe(true);
    expect(a.samples).toBeLessThanOrEqual(66);
  });
});
