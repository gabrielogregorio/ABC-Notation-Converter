import { describe, it, expect } from "vitest";
import { INSTRUMENTS, instrumentByKind, rangeFor, whistleRange } from "./presets";
import { analysisWindow } from "./yin";

describe("whistleRange", () => {
  it("cobre as duas oitavas do whistle em Ré", () => {
    const r = whistleRange("D");
    expect(r.minHz).toBeLessThan(587.33); // ré grave
    expect(r.maxHz).toBeGreaterThan(2349.32); // ré agudo
  });

  it("alcança o whistle frio, que toca bemol de verdade", () => {
    // Se a faixa começasse no ré exato, um whistle 30 cents bemol sumiria em vez
    // de aparecer errado - e o afinador precisa poder dizer que está errado.
    const r = whistleRange("D");
    const coldD = 587.33 * Math.pow(2, -30 / 1200);
    expect(r.minHz).toBeLessThan(coldD);
  });

  it("acompanha a afinação escolhida", () => {
    expect(whistleRange("C").minHz).toBeLessThan(whistleRange("D").minHz);
    expect(whistleRange("G").minHz).toBeGreaterThan(whistleRange("D").minHz);
  });

  it("não procura onde o instrumento não toca", () => {
    // Faixa restrita é a defesa mais barata contra erro de oitava.
    expect(whistleRange("D").minHz).toBeGreaterThan(500);
  });
});

describe("presets", () => {
  it("cada instrumento resolve para uma faixa utilizável", () => {
    for (const inst of INSTRUMENTS) {
      const r = rangeFor(inst.kind, "D");
      expect(r.minHz).toBeGreaterThan(0);
      expect(r.maxHz).toBeGreaterThan(r.minHz * 2);
    }
  });

  it("sopro ganha banda mais larga que o cromático", () => {
    // Um sopro varre dezenas de cents só de pressão de ar; cobrar dele a banda de
    // uma corda solta é reprovar o músico por respirar.
    expect(instrumentByKind("whistle").toleranceCents).toBeGreaterThan(
      instrumentByKind("chromatic").toleranceCents,
    );
  });

  it("avisa sobre aquecimento em todo instrumento de sopro", () => {
    for (const inst of INSTRUMENTS) {
      if (inst.kind === "chromatic") continue;
      expect(inst.warmsUp).toBe(true);
      expect(inst.tipKey).toBeTruthy();
    }
  });

  it("o preset do whistle compra latência baixa; o cromático paga pelo grave", () => {
    // A janela sai da nota mais grave do preset, e é por isso que restringir a
    // faixa é também restringir o atraso.
    const whistle = analysisWindow(48000, rangeFor("whistle", "D").minHz);
    const chromatic = analysisWindow(48000, rangeFor("chromatic", "D").minHz);
    expect(whistle.latencyMs).toBeLessThan(12);
    expect(chromatic.latencyMs).toBeGreaterThan(whistle.latencyMs * 4);
  });
});
