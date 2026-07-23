/**
 * Presets por instrumento.
 *
 * A faixa de busca não é enfeite: restringi-la é a defesa mais barata que existe
 * contra erro de oitava. Um whistle em Ré não tem o que fazer abaixo de 500 Hz,
 * então nem procuramos lá - e o ✕ na oitava errada, que arrebenta corda em
 * instrumento de corda e confunde em sopro, simplesmente não acontece.
 *
 * A tolerância vem junto do preset porque "afinado" quer dizer coisas
 * diferentes: um sopro varre dezenas de cents só de pressão de ar, e cobrar dele
 * a mesma banda de uma corda solta é reprovar o músico por respirar.
 */
import { whistleById } from "../../../whistle/whistles";
import { midiToHz, SEMITONES_PER_OCTAVE } from "./cents";

export type InstrumentKind = "whistle" | "recorder" | "flute" | "ocarina" | "chromatic";

export interface InstrumentDef {
  kind: InstrumentKind;
  icon: string;
  nameKey: string;
  /** Banda verde padrão. O usuário pode mexer. */
  toleranceCents: number;
  /** Sopro aquece e sobe - vale avisar antes de o músico "consertar" o
   *  instrumento pra agradar o afinador. */
  warmsUp: boolean;
  tipKey?: string;
  /** Faixa fixa em Hz. O whistle deriva a dele da afinação escolhida. */
  range?: { minHz: number; maxHz: number };
}

export const INSTRUMENTS: InstrumentDef[] = [
  {
    kind: "whistle",
    icon: "🎵",
    nameKey: "tuner.inst.whistle",
    toleranceCents: 10,
    warmsUp: true,
    tipKey: "tuner.tip.whistle",
  },
  {
    kind: "recorder",
    icon: "🪈",
    nameKey: "tuner.inst.recorder",
    toleranceCents: 10,
    warmsUp: true,
    tipKey: "tuner.tip.recorder",
    range: { minHz: 480, maxHz: 2500 },
  },
  {
    kind: "flute",
    icon: "🎶",
    nameKey: "tuner.inst.flute",
    toleranceCents: 8,
    warmsUp: true,
    tipKey: "tuner.tip.flute",
    range: { minHz: 240, maxHz: 2300 },
  },
  {
    kind: "ocarina",
    icon: "🏺",
    nameKey: "tuner.inst.ocarina",
    toleranceCents: 10,
    warmsUp: true,
    tipKey: "tuner.tip.ocarina",
    range: { minHz: 430, maxHz: 1600 },
  },
  {
    kind: "chromatic",
    icon: "🎹",
    nameKey: "tuner.inst.chromatic",
    toleranceCents: 5,
    warmsUp: false,
    range: { minHz: 65, maxHz: 2200 },
  },
];

export const DEFAULT_INSTRUMENT: InstrumentKind = "whistle";

export function instrumentByKind(kind: InstrumentKind): InstrumentDef {
  return INSTRUMENTS.find((instrument) => instrument.kind === kind) ?? INSTRUMENTS[0];
}

/** Teto da tessitura útil do whistle: duas oitavas mais uma folga curta. */
const RANGE_SPAN_SEMITONES = 25;

export interface SearchRange {
  minHz: number;
  maxHz: number;
}

/**
 * A tabela de digitação usa a convenção dó-central = 60, em que o whistle em Ré
 * fica no Ré4 escrito; o instrumento soa uma oitava acima. O afinador mede o som
 * real, então some a oitava aqui - este é o único lugar do app onde escrita e
 * som deixam de coincidir.
 */
export function whistleRange(whistleId: string): SearchRange {
  const whistle = whistleById(whistleId);
  const soundingTonic = whistle.tonicMidi + SEMITONES_PER_OCTAVE;
  // Piso com folga de um semitom: um whistle frio toca bemol de verdade, e a
  // faixa precisa alcançar a nota errada pra poder dizer que ela está errada.
  const minHz = midiToHz(soundingTonic - 1);
  // Teto: duas oitavas de tessitura mais uma folga curta.
  const maxHz = midiToHz(soundingTonic + RANGE_SPAN_SEMITONES);
  return { minHz, maxHz };
}

export function rangeFor(kind: InstrumentKind, whistleId: string): SearchRange {
  const def = instrumentByKind(kind);
  return def.range ?? whistleRange(whistleId);
}
