import { describe, it, expect } from "vitest";
import {
  calibrationCents,
  centsBetween,
  deviation,
  hzPerCent,
  hzToMidi,
  midiToHz,
  noteName,
} from "./cents";

describe("conversões", () => {
  it("ancora nas frequências canônicas", () => {
    expect(midiToHz(69)).toBeCloseTo(440, 6);
    expect(midiToHz(60)).toBeCloseTo(261.6256, 3);
    expect(midiToHz(74)).toBeCloseTo(587.3295, 3); // ré grave do whistle em D
    expect(hzToMidi(440)).toBeCloseTo(69, 6);
  });

  it("ida e volta fecha", () => {
    for (const midi of [40, 60, 69, 74, 96]) {
      expect(hzToMidi(midiToHz(midi))).toBeCloseTo(midi, 9);
    }
  });

  it("uma oitava são 1200 cents e um semitom são 100", () => {
    expect(centsBetween(880, 440)).toBeCloseTo(1200, 9);
    expect(centsBetween(440, 880)).toBeCloseTo(-1200, 9);
    expect(centsBetween(midiToHz(61), midiToHz(60))).toBeCloseTo(100, 9);
  });
});

describe("noteName", () => {
  it("carrega a oitava, que é a informação que evita afinar no lugar errado", () => {
    expect(noteName(64).full).toBe("E4");
    expect(noteName(40).full).toBe("E2");
    expect(noteName(74).full).toBe("D5");
    expect(noteName(60).octave).toBe(4);
  });

  it("fala solfejo quando pedem", () => {
    expect(noteName(74, "solfege").full).toBe("Ré5");
    expect(noteName(69, "solfege").pitchClass).toBe("Lá");
  });

  it("não quebra em nota negativa nem no extremo grave", () => {
    expect(noteName(0).full).toBe("C-1");
    expect(noteName(21).full).toBe("A0");
  });
});

describe("calibração", () => {
  it("o barroco fica um semitom abaixo", () => {
    expect(calibrationCents(415)).toBeCloseTo(-101.27, 1);
  });

  it("442 é quase oito cents acima de 440", () => {
    expect(calibrationCents(442)).toBeCloseTo(7.85, 1);
  });

  it("calibrar move o alvo, não só o rótulo", () => {
    // O mesmo lá lido com referência 442 tem que aparecer bemol.
    const d = deviation(440, 442);
    expect(d.target).toBe(69);
    expect(d.cents).toBeCloseTo(-7.85, 1);
  });
});

describe("hzPerCent", () => {
  it("mostra por que spec em Hz engana: o mesmo 0,1 Hz vale coisas diferentes", () => {
    // Num Mi2 0,1 Hz é mais de dois cents; num Mi4 é meio cent. Especificar em
    // Hz esconde que a precisão piora justamente nos graves.
    expect(0.1 / hzPerCent(82.41)).toBeCloseTo(2.1, 1);
    expect(0.1 / hzPerCent(329.63)).toBeCloseTo(0.5, 1);
  });
});

describe("deviation", () => {
  it("mede o desvio do semitom mais próximo", () => {
    expect(deviation(440).cents).toBeCloseTo(0, 6);
    expect(deviation(midiToHz(69.25)).cents).toBeCloseTo(25, 6);
    expect(deviation(midiToHz(68.75)).cents).toBeCloseTo(-25, 6);
  });
});
