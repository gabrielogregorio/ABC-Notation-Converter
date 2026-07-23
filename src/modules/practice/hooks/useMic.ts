/**
 * Captura de microfone + detecção de pitch num único loop de áudio.
 * Padrão portado do afinador do CLEO (getUserMedia sem processamento,
 * AnalyserNode, RAF). Expõe a leitura atual via state (para UI) e via
 * listeners por frame (para o motor de prática integrar tempo sem
 * sofrer com a cadência de re-render do React).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { detectPitch, hzToMidi, PitchSmoother } from '../audio/pitch';

export interface PitchReading {
  active: boolean;
  hz: number;
  /** MIDI fracionário, ou -1 se sem pitch. */
  midi: number;
  clarity: number;
  /** RMS normalizado 0..1. */
  rms: number;
}

export type FrameListener = (reading: PitchReading, dtSec: number) => void;

const SILENT: PitchReading = { active: false, hz: -1, midi: -1, clarity: 0, rms: 0 };

const A4_HZ = 440;
const SMOOTHER_WINDOW = 6;
const FFT_SIZE = 4096;
const MAX_FRAME_DT_SEC = 0.1;
const MS_PER_SECOND = 1000;
/** Ganho para mapear o RMS cru (baixo) para uma barra de volume visível 0..1. */
const RMS_DISPLAY_GAIN = 8;

export function useMic(a4 = A4_HZ) {
  const [state, setState] = useState<PitchReading>(SILENT);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const smootherRef = useRef(new PitchSmoother(SMOOTHER_WINDOW));
  const lastTsRef = useRef(0);
  const listenersRef = useRef<Set<FrameListener>>(new Set());
  const readingRef = useRef<PitchReading>(SILENT);

  /** Inscreve um callback executado a cada frame de áudio. Retorna o unsubscribe. */
  const onFrame = useCallback((cb: FrameListener) => {
    listenersRef.current.add(cb);
    return () => listenersRef.current.delete(cb);
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const micSource = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      micSource.connect(analyser);
      const sampleBuffer = new Float32Array(analyser.fftSize);
      smootherRef.current.reset();
      lastTsRef.current = performance.now();
      setError(null);

      const loop = () => {
        const now = performance.now();
        const deltaSec = Math.min(MAX_FRAME_DT_SEC, (now - lastTsRef.current) / MS_PER_SECOND);
        lastTsRef.current = now;

        analyser.getFloatTimeDomainData(sampleBuffer);
        const detection = detectPitch(sampleBuffer, ctx.sampleRate);
        let reading: PitchReading;
        if (detection.hz > 0) {
          const smoothedHz = smootherRef.current.push(detection.hz);
          const hz = smoothedHz > 0 ? smoothedHz : detection.hz;
          reading = {
            active: true,
            hz,
            midi: hzToMidi(hz, a4),
            clarity: detection.clarity,
            rms: Math.min(1, detection.rms * RMS_DISPLAY_GAIN),
          };
        } else {
          smootherRef.current.push(-1);
          reading = {
            active: true,
            hz: -1,
            midi: -1,
            clarity: 0,
            rms: Math.min(1, detection.rms * RMS_DISPLAY_GAIN),
          };
        }
        readingRef.current = reading;
        for (const listener of listenersRef.current) listener(reading, deltaSec);
        setState(reading);
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState(SILENT);
    }
  }, [a4]);

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    ctxRef.current?.close();
    ctxRef.current = null;
    smootherRef.current.reset();
    readingRef.current = SILENT;
    setState(SILENT);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { state, error, active: state.active, start, stop, onFrame, readingRef };
}
