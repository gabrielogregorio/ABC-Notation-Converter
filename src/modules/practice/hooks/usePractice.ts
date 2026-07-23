/**
 * Motor de prática. Percorre a música nota a nota; só avança quando a nota
 * alvo é sustentada DENTRO da tolerância pelo tempo exigido (derivado da
 * duração da nota). Produz feedback em tempo real: cor (verde/laranja/
 * vermelho), seta (subir/descer) e progresso de sustentação.
 *
 * Lê os frames de áudio do useMic via onFrame - integra o tempo de
 * sustentação com o dt real de cada frame, independente do re-render.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FrameListener, PitchReading } from './useMic';
import type { PreparedSong } from '../music/song';
import { ptLabelFromMidi } from '../music/notes';
import { ArticulationGate, isArticulationGap } from '../audio/articulation';

export type NoteStatus = 'idle' | 'wrong' | 'close' | 'good';

export interface PracticeSettings {
  /** Tolerância em cents. 0 = quase perfeito; maior = range mais largo. */
  toleranceCents: number;
  /** Fração da duração da nota que é preciso sustentar (0.3..1). */
  holdScale: number;
  /** Tempo mínimo de sustentação em ms, independente da duração. */
  minHoldMs: number;
  /** Aceita a nota certa em qualquer oitava (casa por nome, não por altura). */
  ignoreOctave: boolean;
  /** Exige articulação (o "TU"): cada nota precisa de ataque novo; ligato trava. */
  requireTongue: boolean;
}

export const DEFAULT_SETTINGS: PracticeSettings = {
  toleranceCents: 30,
  holdScale: 0.7,
  minHoldMs: 350,
  ignoreOctave: true,
  requireTongue: false,
};

export interface PracticeFeedback {
  status: NoteStatus;
  /** 'up' = você está baixo (suba); 'down' = você está alto (abaixe). */
  direction: 'up' | 'down' | null;
  /** Desvio em cents, limitado a [-100, 100] para o ponteiro. */
  cents: number;
  /** Progresso de sustentação da nota atual, 0..1. */
  holdProgress: number;
  detectedMidi: number;
  detectedLabel: string;
  /** No modo TU: está na nota certa mas travado esperando o ataque (língua). */
  needsArticulation: boolean;
}

export interface NoteScore {
  index: number;
  /** Desvio médio absoluto (cents) enquanto dentro da tolerância. */
  avgDevCents: number;
  /** Acurácia da nota 0..1. */
  accuracy: number;
}

export interface AttemptResult {
  songId: string;
  date: string;
  /** Acurácia geral 0..1 (média das notas). */
  accuracy: number;
  durationSec: number;
  notes: NoteScore[];
}

const IDLE_FEEDBACK: PracticeFeedback = {
  status: 'idle',
  direction: null,
  cents: 0,
  holdProgress: 0,
  detectedMidi: -1,
  detectedLabel: '-',
  needsArticulation: false,
};

const CENTS_PER_SEMITONE = 100;
const SEMITONES_PER_OCTAVE = 12;
const MS_PER_SECOND = 1000;
/** A tolerância nunca é 0: dividir a acurácia por 0 estouraria. */
const MIN_TOLERANCE_CENTS = 1;
/** A banda "perto" vai até este múltiplo da tolerância. */
const CLOSE_TOLERANCE_FACTOR = 2.5;
/** Ponteiro do medidor limita o desvio exibido a ±100 cents. */
const CENTS_METER_CLAMP = 100;
/** Sem pitch: a sustentação esfria devagar. Fora de tom: esfria mais rápido. */
const IDLE_COOLDOWN_RATE = 0.8;
const OUT_OF_TUNE_COOLDOWN_RATE = 1.5;

/** Classifica o desvio absoluto (cents) em relação à tolerância. */
export function statusForCents(absCents: number, toleranceCents: number): NoteStatus {
  if (absCents <= toleranceCents) return 'good';
  if (absCents <= toleranceCents * CLOSE_TOLERANCE_FACTOR) return 'close';
  return 'wrong';
}

/** Acurácia 0..1 da nota a partir do desvio médio dentro da tolerância. */
export function noteAccuracy(avgDevCents: number, toleranceCents: number): number {
  return Math.max(0, Math.min(1, 1 - avgDevCents / toleranceCents));
}

export function usePractice(
  song: PreparedSong | null,
  onFrame: (cb: FrameListener) => () => void,
  settings: PracticeSettings,
  onComplete?: (result: AttemptResult) => void,
) {
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [feedback, setFeedback] = useState<PracticeFeedback>(IDLE_FEEDBACK);

  // refs vivos para o loop de áudio
  const songRef = useRef(song);
  songRef.current = song;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const runningRef = useRef(false);
  const indexRef = useRef(-1);
  const heldRef = useRef(0); // segundos sustentados na nota atual
  const startTimeRef = useRef(0);
  const gateRef = useRef(new ArticulationGate()); // gate do "TU" por nota
  // acumuladores de score por nota
  const devSumRef = useRef(0);
  const devCountRef = useRef(0);
  const scoresRef = useRef<NoteScore[]>([]);

  // Avança até a próxima nota tocável (pulando pausas). Retorna false se acabou.
  const advanceToPlayable = useCallback((from: number): boolean => {
    const notes = songRef.current?.notes ?? [];
    let noteIndex = from;
    while (noteIndex < notes.length && notes[noteIndex].isRest) noteIndex += 1;
    if (noteIndex >= notes.length) return false;
    indexRef.current = noteIndex;
    setCurrentIndex(noteIndex);
    heldRef.current = 0;
    devSumRef.current = 0;
    devCountRef.current = 0;
    gateRef.current.reset(); // a próxima nota exige uma articulação nova
    return true;
  }, []);

  const finishAttempt = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setFinished(true);
    setCurrentIndex(-1);
    indexRef.current = -1;
    setFeedback(IDLE_FEEDBACK);

    const scores = scoresRef.current;
    const accuracy = scores.length
      ? scores.reduce((sum, score) => sum + score.accuracy, 0) / scores.length
      : 0;
    const result: AttemptResult = {
      songId: songRef.current?.json.id ?? 'unknown',
      date: new Date().toISOString(),
      accuracy,
      durationSec: (performance.now() - startTimeRef.current) / MS_PER_SECOND,
      notes: scores,
    };
    onCompleteRef.current?.(result);
  }, []);

  const start = useCallback(() => {
    if (!songRef.current) return;
    scoresRef.current = [];
    heldRef.current = 0;
    devSumRef.current = 0;
    devCountRef.current = 0;
    startTimeRef.current = performance.now();
    setFinished(false);
    runningRef.current = true;
    setRunning(true);
    if (!advanceToPlayable(0)) finishAttempt();
  }, [advanceToPlayable, finishAttempt]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setCurrentIndex(-1);
    indexRef.current = -1;
    setFeedback(IDLE_FEEDBACK);
  }, []);

  // Registra a nota atual como concluída e avança.
  const completeCurrentNote = useCallback(() => {
    const tolerance = Math.max(MIN_TOLERANCE_CENTS, settingsRef.current.toleranceCents);
    const avgDev = devCountRef.current ? devSumRef.current / devCountRef.current : tolerance;
    const accuracy = noteAccuracy(avgDev, tolerance);
    scoresRef.current.push({ index: indexRef.current, avgDevCents: avgDev, accuracy });
    if (!advanceToPlayable(indexRef.current + 1)) finishAttempt();
  }, [advanceToPlayable, finishAttempt]);

  // Loop de áudio: integra a sustentação da nota alvo.
  useEffect(() => {
    const handle: FrameListener = (reading: PitchReading, deltaSec: number) => {
      if (!runningRef.current) return;
      const currentSong = songRef.current;
      if (!currentSong) return;
      const note = currentSong.notes[indexRef.current];
      if (!note || !note.parsed) return;

      const currentSettings = settingsRef.current;
      const tolerance = Math.max(MIN_TOLERANCE_CENTS, currentSettings.toleranceCents);
      const requiredHold = Math.max(
        currentSettings.minHoldMs / MS_PER_SECOND,
        note.durationSec * currentSettings.holdScale,
      );

      // Gate do "TU": alimenta com "houve folga?" e vê se um ataque novo abriu.
      // Sem exigir língua, o gate é sempre considerado aberto.
      gateRef.current.feed(isArticulationGap(reading.midi, reading.rms));
      const gateOpen = !currentSettings.requireTongue || gateRef.current.isOpen;

      if (reading.midi <= 0) {
        // sem pitch - esfria a sustentação devagar
        heldRef.current = Math.max(0, heldRef.current - deltaSec * IDLE_COOLDOWN_RATE);
        setFeedback({
          status: 'idle',
          direction: null,
          cents: 0,
          holdProgress: heldRef.current / requiredHold,
          detectedMidi: -1,
          detectedLabel: '-',
          needsArticulation: false,
        });
        return;
      }

      // alvo efetivo: se ignorar oitava, aproxima o alvo da oitava tocada
      let effectiveTarget = note.parsed.midi;
      if (currentSettings.ignoreOctave) {
        const octavesOff = Math.round((reading.midi - effectiveTarget) / SEMITONES_PER_OCTAVE);
        effectiveTarget += octavesOff * SEMITONES_PER_OCTAVE;
      }
      const cents = (reading.midi - effectiveTarget) * CENTS_PER_SEMITONE;
      const absCents = Math.abs(cents);
      const status = statusForCents(absCents, tolerance);

      if (status === 'good' && gateOpen) {
        heldRef.current += deltaSec;
        devSumRef.current += absCents;
        devCountRef.current += 1;
      } else if (status !== 'good') {
        // fora da tolerância: esfria mais rápido - exige sustentação contínua
        heldRef.current = Math.max(0, heldRef.current - deltaSec * OUT_OF_TUNE_COOLDOWN_RATE);
      }
      // nota certa mas gate fechado: a sustentação congela, esperando o ataque

      const needsArticulation = status === 'good' && !gateOpen;
      const holdProgress = Math.min(1, heldRef.current / requiredHold);
      setFeedback({
        status,
        direction: cents < 0 ? 'up' : 'down',
        cents: Math.max(-CENTS_METER_CLAMP, Math.min(CENTS_METER_CLAMP, cents)),
        holdProgress,
        detectedMidi: reading.midi,
        detectedLabel: ptLabelFromMidi(reading.midi),
        needsArticulation,
      });

      if (gateOpen && heldRef.current >= requiredHold) completeCurrentNote();
    };
    return onFrame(handle);
  }, [onFrame, completeCurrentNote]);

  return { running, finished, currentIndex, feedback, start, stop };
}
