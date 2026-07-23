/**
 * Núcleo de timing do metrônomo - lógica pura, sem áudio nem DOM.
 *
 * Padrão canônico (Chris Wilson, "A Tale of Two Clocks"): separar *quando o
 * código roda* (timer grosso ~25ms) de *quando o som toca* (agendado no relógio de
 * amostras do AudioContext). Um timer de 25ms só decide o QUE agendar num
 * horizonte de ~100ms; `osc.start(time)` decide QUANDO soa. Drift ~0.
 *
 * Esta classe é só a matemática: recebe o tempo atual e devolve os *pulsos* que
 * caem na janela de lookahead, então é testável com um relógio falso. Suporta
 * subdivisões (2/3/4 por tempo) e swing. `nextPulse` recalcula do BPM atual a
 * cada passo → mudar tempo se propaga sem drift.
 */

export const MIN_BPM = 20;
export const MAX_BPM = 400; // metrônomos sérios vão até 400
export const MIN_BEATS = 1;
export const MAX_BEATS = 12;
export const MIN_SUBDIV = 1;
export const MAX_SUBDIV = 4;
export const MAX_SWING = 0.75;

export function clampBpm(bpm: number): number {
  if (Number.isNaN(bpm)) return MIN_BPM;
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)));
}

export function clampBeatsPerBar(beats: number): number {
  if (Number.isNaN(beats)) return MIN_BEATS;
  return Math.max(MIN_BEATS, Math.min(MAX_BEATS, Math.round(beats)));
}

export function clampSubdivisions(sub: number): number {
  if (Number.isNaN(sub)) return MIN_SUBDIV;
  return Math.max(MIN_SUBDIV, Math.min(MAX_SUBDIV, Math.round(sub)));
}

export function clampSwing(swing: number): number {
  if (!Number.isFinite(swing)) return 0;
  return Math.max(0, Math.min(MAX_SWING, swing));
}

/** Duração de um tempo (semínima), em segundos. */
export function secondsPerBeat(bpm: number): number {
  return 60 / clampBpm(bpm);
}

/** Índice do beat dentro do compasso (0-based). */
export function beatInBar(beatIndex: number, beatsPerBar: number): number {
  const b = clampBeatsPerBar(beatsPerBar);
  return ((beatIndex % b) + b) % b;
}

/** O primeiro tempo do compasso é o downbeat (acento estrutural). */
export function isDownbeat(beatIndex: number, beatsPerBar: number): boolean {
  return beatInBar(beatIndex, beatsPerBar) === 0;
}

/**
 * Duração até o próximo pulso, em segundos. Swing só se aplica a subdivisões
 * pares (2 ou 4): o pulso "on" (par) fica mais longo e o "off" (ímpar), mais
 * curto - mantendo a soma do par igual a um tempo. swing 0 = reto;
 * swing ~0.33 ≈ feel de tercina; até 0.75.
 */
export function pulseDuration(
  bpm: number,
  subdivisions: number,
  subIndex: number,
  swing: number,
): number {
  const spb = secondsPerBeat(bpm);
  const sub = clampSubdivisions(subdivisions);
  const base = spb / sub;
  const s = clampSwing(swing);
  if (s > 0 && sub % 2 === 0) {
    // desloca cada par (on mais longo, off mais curto)
    const long = base * (1 + s);
    const short = base * (1 - s);
    return subIndex % 2 === 0 ? long : short;
  }
  return base;
}

export interface Pulse {
  /** Índice absoluto do pulso desde o start. */
  index: number;
  /** Índice absoluto do beat (semínima). */
  beatIndex: number;
  /** Posição do beat no compasso (0..beatsPerBar-1). */
  beatInBar: number;
  /** Subdivisão dentro do beat (0..subdivisions-1). */
  subIndex: number;
  /** true quando é o início de um tempo (subIndex 0). */
  isBeat: boolean;
  /** true no primeiro tempo do compasso (downbeat estrutural). */
  isDownbeat: boolean;
  /** Instante no relógio do AudioContext (s) em que o pulso deve soar. */
  time: number;
}

export interface SequencerOptions {
  bpm: number;
  beatsPerBar: number;
  subdivisions?: number;
  swing?: number;
  /** Horizonte de agendamento (s). Default 0.1s. */
  lookahead?: number;
}

export class Sequencer {
  bpm: number;
  beatsPerBar: number;
  subdivisions: number;
  swing: number;
  lookahead: number;

  private nextTime = 0;
  private pulseIndex = 0;
  private beatAbs = 0;
  private subInBeat = 0;
  private running = false;

  constructor(opts: SequencerOptions) {
    this.bpm = clampBpm(opts.bpm);
    this.beatsPerBar = clampBeatsPerBar(opts.beatsPerBar);
    this.subdivisions = clampSubdivisions(opts.subdivisions ?? 1);
    this.swing = clampSwing(opts.swing ?? 0);
    this.lookahead = opts.lookahead ?? 0.1;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(currentTime: number): void {
    this.nextTime = currentTime;
    this.pulseIndex = 0;
    this.beatAbs = 0;
    this.subInBeat = 0;
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  setBpm(bpm: number): void {
    this.bpm = clampBpm(bpm);
  }
  setBeatsPerBar(beats: number): void {
    this.beatsPerBar = clampBeatsPerBar(beats);
  }
  setSubdivisions(sub: number): void {
    this.subdivisions = clampSubdivisions(sub);
  }
  setSwing(swing: number): void {
    this.swing = clampSwing(swing);
  }

  /**
   * Devolve, em ordem, os pulsos cujo horário cai em [currentTime,
   * currentTime + lookahead]. Avança o estado interno. Vazio quando parado.
   */
  tick(currentTime: number): Pulse[] {
    if (!this.running) return [];
    const out: Pulse[] = [];
    const horizon = currentTime + this.lookahead;
    let guard = 0;
    while (this.nextTime <= horizon && guard < 10_000) {
      guard += 1;
      // normaliza wrap de subdivisão (inclui mudanças de config em tempo real)
      if (this.subInBeat >= this.subdivisions) {
        this.subInBeat = 0;
        this.beatAbs += 1;
      }
      const bib = beatInBar(this.beatAbs, this.beatsPerBar);
      out.push({
        index: this.pulseIndex,
        beatIndex: this.beatAbs,
        beatInBar: bib,
        subIndex: this.subInBeat,
        isBeat: this.subInBeat === 0,
        isDownbeat: this.subInBeat === 0 && bib === 0,
        time: this.nextTime,
      });
      this.nextTime += pulseDuration(
        this.bpm,
        this.subdivisions,
        this.subInBeat,
        this.swing,
      );
      this.pulseIndex += 1;
      this.subInBeat += 1;
    }
    return out;
  }
}
