import { describe, it, expect } from "vitest";
import { Stabilizer, median } from "./stability";
import { midiToHz } from "./cents";

const DT = 12.5; // 80 análises por segundo

/** Alimenta o estabilizador por N ms com uma altura fixa em MIDI. */
function feed(s: Stabilizer, midi: number, ms: number, clarity = 0.95) {
  let last = s.push(midiToHz(midi), clarity, 0.1, DT);
  for (let t = DT; t < ms; t += DT) last = s.push(midiToHz(midi), clarity, 0.1, DT);
  return last;
}

describe("Stabilizer", () => {
  it("não confirma na hora: exige que a nota seja sustentada", () => {
    const s = new Stabilizer({ toleranceCents: 10, dwellMs: 400 });
    const early = feed(s, 74, 200);
    expect(early.state).toBe("seeking");
    expect(early.confirmed).toBe(false);
    expect(early.dwellProgress).toBeGreaterThan(0);

    const later = feed(s, 74, 400);
    expect(later.confirmed).toBe(true);
    expect(later.state).toBe("in-tune");
  });

  it("sai com o dobro da folga com que entra", () => {
    // A assimetria é o que impede o veredito de piscar em cima da fronteira.
    const s = new Stabilizer({ toleranceCents: 10, dwellMs: 300, latchMs: 200 });
    feed(s, 74, 600);
    expect(s.push(midiToHz(74), 0.95, 0.1, DT).confirmed).toBe(true);

    // 15 cents: já fora da banda de entrada, ainda dentro da de saída.
    const drift = feed(s, 74.15, 400);
    expect(drift.confirmed).toBe(true);

    // 25 cents por tempo suficiente: aí sim solta.
    const gone = feed(s, 74.25, 600);
    expect(gone.confirmed).toBe(false);
  });

  it("segura o veredito por um instante quando o pitch escapa", () => {
    // Latch: o músico tirou o dedo, não desafinou.
    const s = new Stabilizer({ toleranceCents: 10, dwellMs: 300, latchMs: 1000 });
    feed(s, 74, 600);
    const blip = feed(s, 74.4, 300);
    expect(blip.confirmed).toBe(true);
  });

  it("mata salto de oitava isolado antes de ele virar leitura", () => {
    const s = new Stabilizer({ medianWindow: 5, toleranceCents: 10 });
    feed(s, 74, 400);
    const spike = s.push(midiToHz(86), 0.95, 0.1, DT); // uma oitava acima, um frame
    expect(spike.note?.full).toBe("D5");
    expect(Math.abs(spike.midi - 74)).toBeLessThan(0.5);
  });

  it("não pisca entre notas vizinhas na fronteira", () => {
    // 50 cents é a fronteira geométrica; a histerese cobra folga além dela.
    const s = new Stabilizer({ noteHysteresisCents: 40, toleranceCents: 10 });
    feed(s, 74, 400);
    const border = feed(s, 74.55, 400); // 55 cents acima: passou da fronteira
    expect(border.note?.full).toBe("D5"); // e mesmo assim continua Ré

    const committed = feed(s, 75.1, 400); // agora foi de verdade
    expect(committed.note?.full).toBe("D♯5");
  });

  it("clareza baixa não vira nota", () => {
    const s = new Stabilizer({ minClarity: 0.8, releaseMs: 100 });
    for (let t = 0; t < 400; t += DT) s.push(midiToHz(74), 0.3, 0.1, DT);
    expect(s.push(midiToHz(74), 0.3, 0.1, DT).state).toBe("silent");
  });

  it("segura a leitura durante a articulação, mas não durante o silêncio", () => {
    // Dar língua apaga o pitch por algumas dezenas de ms. Isso não é parar.
    const s = new Stabilizer({ releaseMs: 250, toleranceCents: 10 });
    feed(s, 74, 600);
    for (let t = 0; t < 100; t += DT) s.push(-1, 0, 0.001, DT);
    expect(s.push(-1, 0, 0.001, DT).note?.full).toBe("D5");

    for (let t = 0; t < 400; t += DT) s.push(-1, 0, 0.001, DT);
    expect(s.push(-1, 0, 0.001, DT).state).toBe("silent");
  });

  it("julga contra o lá calibrado", () => {
    // Um lá de 440 Hz está quase oito cents bemol quando a referência é 442 -
    // dentro da banda larga de um sopro, fora da banda estreita do cromático.
    const wind = new Stabilizer({ a4: 442, toleranceCents: 10, dwellMs: 200 });
    const loose = feed(wind, 69, 500);
    expect(loose.note?.full).toBe("A4");
    expect(loose.cents).toBeCloseTo(-7.85, 0);
    expect(loose.confirmed).toBe(true);

    const strict = new Stabilizer({ a4: 442, toleranceCents: 5, dwellMs: 200 });
    expect(feed(strict, 69, 500).confirmed).toBe(false);
  });

  it("a suavização atrasa mas não distorce o alvo", () => {
    const s = new Stabilizer({ timeConstantMs: 140, toleranceCents: 10 });
    const settled = feed(s, 74.2, 1500);
    expect(settled.cents).toBeCloseTo(20, 0);
  });
});

describe("median", () => {
  it("ímpar pega o do meio, par tira a média dos dois", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(-1);
  });
});
