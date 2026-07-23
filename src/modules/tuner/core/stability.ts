/**
 * Estabilização da leitura - a parte que separa um afinador usável de uma agulha
 * epilética.
 *
 * A regra estrutural, roubada do hardware: display contínuo e evento de
 * confirmação são coisas diferentes. O display pode tremer, porque tremer é o
 * sinal real; a confirmação não pode, porque é ela que o músico obedece. Então o
 * contorno cru vai pra tela e o veredito passa por deadband assimétrico + dwell
 * + latch.
 *
 * Tudo aqui trabalha em semitons/cents, nunca em Hz: vibrato é senoidal na
 * escala log e torto na linear, e a média aritmética em cents já é a média
 * geométrica em Hz - o lado que a psicoacústica prefere, de graça.
 */
import {
  CENTS_PER_SEMITONE,
  hzToMidi,
  midiToHz,
  noteName,
  type NoteName,
  type NoteNaming,
} from "./cents";

export type TuneState = "silent" | "seeking" | "in-tune";

export interface StabilizerConfig {
  a4: number;
  naming: NoteNaming;
  /** Abaixo disto o frame não é nota - o display congela em vez de inventar. */
  minClarity: number;
  /**
   * Constante da média exponencial, em ms. 140 ms é o que d'Alessandro &
   * Castellengo mediram como a integração do próprio ouvido ao julgar a altura
   * de um tom vibrado (banda ~7 Hz). Suavizar aqui é imitar quem escuta, não
   * "deixar bonito".
   */
  timeConstantMs: number;
  /** Mediana sobre N frames: é o que mata salto de oitava isolado. */
  medianWindow: number;
  /**
   * Margem extra pra trocar de nota. Sem isso a leitura pisca entre Ré e Ré♯ na
   * fronteira.
   */
  noteHysteresisCents: number;
  /** Banda verde. Configurável de propósito: "afinado" quer dizer coisas
   *  diferentes num whistle e numa guitarra. */
  toleranceCents: number;
  /** Sustentar dentro da banda por este tempo antes de confirmar. */
  dwellMs: number;
  /** Depois de confirmado, segura o veredito mesmo se o pitch escapar. */
  latchMs: number;
  /** Silêncio contínuo que zera a máquina. */
  releaseMs: number;
}

export const DEFAULT_STABILIZER: StabilizerConfig = {
  a4: 440,
  naming: "letter",
  minClarity: 0.8,
  timeConstantMs: 140,
  medianWindow: 5,
  noteHysteresisCents: 40,
  toleranceCents: 10,
  dwellMs: 400,
  latchMs: 1000,
  releaseMs: 250,
};

/** Meio semitom: a fronteira geométrica entre uma nota e a vizinha. */
const HALF_SEMITONE_CENTS = 50;

export interface Reading {
  state: TuneState;
  /** Frequência suavizada, ou −1. */
  hz: number;
  /** MIDI fracionário suavizado. */
  midi: number;
  /** MIDI fracionário do frame, sem suavizar - é isto que o traço desenha. */
  rawMidi: number;
  note: NoteName | null;
  /** Desvio suavizado do alvo, em cents. */
  cents: number;
  /** Desvio do frame, sem suavizar. */
  rawCents: number;
  clarity: number;
  rms: number;
  /** Confirmado = passou pelo dwell e está travado. */
  confirmed: boolean;
  /** 0..1 - quanto do dwell já foi cumprido. Alimenta o anel de progresso. */
  dwellProgress: number;
}

const SILENT: Reading = {
  state: "silent",
  hz: -1,
  midi: -1,
  rawMidi: -1,
  note: null,
  cents: 0,
  rawCents: 0,
  clarity: 0,
  rms: 0,
  confirmed: false,
  dwellProgress: 0,
};

export class Stabilizer {
  private cfg: StabilizerConfig;
  private history: number[] = [];
  private smoothed = -1;
  private target = -1;
  private inBandMs = 0;
  private outBandMs = 0;
  private silentMs = 0;
  private confirmed = false;

  constructor(cfg: Partial<StabilizerConfig> = {}) {
    this.cfg = { ...DEFAULT_STABILIZER, ...cfg };
  }

  configure(cfg: Partial<StabilizerConfig>): void {
    this.cfg = { ...this.cfg, ...cfg };
  }

  reset(): void {
    this.history = [];
    this.smoothed = -1;
    this.target = -1;
    this.inBandMs = 0;
    this.outBandMs = 0;
    this.silentMs = 0;
    this.confirmed = false;
  }

  /** Entra o frame do detector; sai a leitura que a UI mostra. */
  push(hz: number, clarity: number, rms: number, dtMs: number): Reading {
    const cfg = this.cfg;
    const voiced = hz > 0 && clarity >= cfg.minClarity;

    if (!voiced) {
      this.silentMs += dtMs;
      if (this.silentMs >= cfg.releaseMs) {
        this.reset();
        return { ...SILENT, rms };
      }
      // Dentro da janela de release seguramos a última leitura: articular uma
      // nota (tonguing) apaga o pitch por algumas dezenas de ms e não é silêncio.
      return this.emit(clarity, rms, 0);
    }

    this.silentMs = 0;
    const midi = hzToMidi(hz, cfg.a4);

    // Mediana primeiro: um salto de oitava isolado morre aqui, antes de
    // contaminar a média.
    this.history.push(midi);
    if (this.history.length > cfg.medianWindow) this.history.shift();
    const medianMidi = median(this.history);

    if (this.smoothed < 0) this.smoothed = medianMidi;
    else {
      const alpha = 1 - Math.exp(-dtMs / cfg.timeConstantMs);
      this.smoothed += alpha * (medianMidi - this.smoothed);
    }

    this.updateTarget();

    const cents = (this.smoothed - this.target) * CENTS_PER_SEMITONE;
    const enter = cfg.toleranceCents;
    // Sai com o dobro da folga com que entra. A assimetria é o que impede o
    // veredito de piscar quando a leitura passeia em cima da fronteira.
    const exit = cfg.toleranceCents * 2;

    if (!this.confirmed) {
      if (Math.abs(cents) <= enter) this.inBandMs += dtMs;
      else this.inBandMs = 0;
      if (this.inBandMs >= cfg.dwellMs) {
        this.confirmed = true;
        this.outBandMs = 0;
      }
    } else if (Math.abs(cents) > exit) {
      this.outBandMs += dtMs;
      if (this.outBandMs >= cfg.latchMs) {
        this.confirmed = false;
        this.inBandMs = 0;
      }
    } else {
      this.outBandMs = 0;
    }

    return this.emit(clarity, rms, midi);
  }

  /**
   * A nota só troca quando a leitura passa da fronteira com folga. Meio semitom
   * é a fronteira geométrica; a histerese é o que evita o pisca-pisca em cima
   * dela.
   */
  private updateTarget(): void {
    const nearest = Math.round(this.smoothed);
    if (this.target < 0) {
      this.target = nearest;
      return;
    }
    if (nearest === this.target) return;
    const distanceCents = Math.abs(this.smoothed - this.target) * CENTS_PER_SEMITONE;
    if (distanceCents > HALF_SEMITONE_CENTS + this.cfg.noteHysteresisCents) {
      this.target = nearest;
      this.inBandMs = 0;
      this.outBandMs = 0;
      this.confirmed = false;
    }
  }

  private emit(clarity: number, rms: number, rawMidi: number): Reading {
    if (this.smoothed < 0 || this.target < 0) return { ...SILENT, rms };
    const cents = (this.smoothed - this.target) * CENTS_PER_SEMITONE;
    return {
      state: this.confirmed ? "in-tune" : "seeking",
      hz: midiToHz(this.smoothed, this.cfg.a4),
      midi: this.smoothed,
      rawMidi,
      note: noteName(this.target, this.cfg.naming),
      cents,
      rawCents: rawMidi > 0 ? (rawMidi - this.target) * CENTS_PER_SEMITONE : cents,
      clarity,
      rms,
      confirmed: this.confirmed,
      dwellProgress: this.confirmed ? 1 : Math.min(1, this.inBandMs / this.cfg.dwellMs),
    };
  }
}

export function median(values: number[]): number {
  if (values.length === 0) return -1;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
