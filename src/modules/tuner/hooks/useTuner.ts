/**
 * Cola entre o motor de áudio e o React.
 *
 * O pitch não passa pelo framework. Ele chega a 80 Hz, entra no estabilizador e
 * fica num ref que o canvas lê no rAF - mandar isso pro state seriam 80
 * reconciliações por segundo pra pintar pixel. Pro React sobe só o que é texto
 * (nota, cents, veredito), a 10 Hz, que é a taxa em que um humano lê número.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMountEffect } from "../../../app/useMountEffect";
import { TunerEngine, type TunerStatus } from "../audio/engine";
import { Stabilizer, type Reading } from "../core/stability";
import { VibratoTracker, type VibratoAnalysis } from "../core/vibrato";
import { Trace } from "../core/trace";
import { A4_DEFAULT, type NoteNaming } from "../core/cents";
import {
  DEFAULT_INSTRUMENT,
  instrumentByKind,
  rangeFor,
  type InstrumentKind,
} from "../core/presets";
import { DEFAULT_WHISTLE } from "../../../whistle/whistles";

const STORAGE_KEY = "music-lab:tuner";

// O display sobe pro React a 10 Hz (a taxa em que um humano lê número).
const DISPLAY_INTERVAL_MS = 100;

// A Wake Lock API ainda é não-padrão; o cast declara a forma que usamos.
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> };
};

export interface TunerSettings {
  instrument: InstrumentKind;
  whistleId: string;
  a4: number;
  toleranceCents: number;
  naming: NoteNaming;
}

function defaults(): TunerSettings {
  return {
    instrument: DEFAULT_INSTRUMENT,
    whistleId: DEFAULT_WHISTLE,
    a4: A4_DEFAULT,
    toleranceCents: instrumentByKind(DEFAULT_INSTRUMENT).toleranceCents,
    naming: "letter",
  };
}

function loadSettings(): TunerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
  } catch {
    return defaults();
  }
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

const NO_VIBRATO: VibratoAnalysis = {
  active: false,
  centerCents: 0,
  extentCents: 0,
  rateHz: 0,
  regularity: 0,
  samples: 0,
};

/** O que sobe pro React. Só texto, só a 10 Hz. */
export interface TunerDisplay {
  state: Reading["state"];
  noteFull: string;
  notePitchClass: string;
  octave: number | null;
  cents: number;
  hz: number;
  clarity: number;
  confirmed: boolean;
  vibrato: VibratoAnalysis;
}

const EMPTY_DISPLAY: TunerDisplay = {
  state: "silent",
  noteFull: "",
  notePitchClass: "",
  octave: null,
  cents: 0,
  hz: -1,
  clarity: 0,
  confirmed: false,
  vibrato: NO_VIBRATO,
};

export function useTuner() {
  const [settings, setSettingsState] = useState<TunerSettings>(loadSettings);
  const [status, setStatus] = useState<TunerStatus>(() => ({
    state: "idle",
    error: null,
    sampleRate: 0,
    windowMs: 0,
    responseMs: 0,
    processing: [],
  }));
  const [display, setDisplay] = useState<TunerDisplay>(EMPTY_DISPLAY);

  const readingRef = useRef<Reading>(SILENT);
  const vibratoRef = useRef<VibratoAnalysis>(NO_VIBRATO);
  const stabilizer = useRef(new Stabilizer()).current;
  const vibrato = useRef(new VibratoTracker()).current;
  const trace = useRef(new Trace(400)).current;
  const engineRef = useRef<TunerEngine | null>(null);
  const wakeLockRef = useRef<{ release(): Promise<void> } | null>(null);

  const range = useMemo(
    () => rangeFor(settings.instrument, settings.whistleId),
    [settings.instrument, settings.whistleId],
  );

  // O estabilizador é um objeto externo, não React. Configuramos no próprio
  // evento que muda a preferência (aqui) e ao iniciar (em `start`), nunca num
  // efeito reagindo a `settings`.
  const configureStabilizer = useCallback(
    (config: Pick<TunerSettings, "a4" | "naming" | "toleranceCents">) => {
      stabilizer.configure({
        a4: config.a4,
        naming: config.naming,
        toleranceCents: config.toleranceCents,
      });
    },
    [stabilizer],
  );

  const setSettings = useCallback(
    (patch: Partial<TunerSettings>) => {
      const next = { ...settings, ...patch };
      // Trocar de instrumento traz a tolerância dele junto, a menos que o
      // usuário esteja mexendo justamente nela.
      if (patch.instrument && patch.toleranceCents === undefined) {
        next.toleranceCents = instrumentByKind(patch.instrument).toleranceCents;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* modo privado: a preferência morre com a aba, e tudo bem */
      }
      configureStabilizer(next);
      setSettingsState(next);
    },
    [settings, configureStabilizer],
  );

  const onFrame = useCallback(
    (hz: number, clarity: number, rms: number, dtMs: number) => {
      const reading = stabilizer.push(hz, clarity, rms, dtMs);
      readingRef.current = reading;
      const voiced = reading.state !== "silent";
      trace.push(voiced ? reading.rawCents : 0, clarity, voiced);
      if (voiced) {
        vibrato.push(reading.rawCents, dtMs);
        vibratoRef.current = vibrato.analyze();
      } else {
        vibrato.reset();
        vibratoRef.current = NO_VIBRATO;
      }
    },
    [stabilizer, trace, vibrato],
  );

  const engine = useMemo(() => {
    if (!engineRef.current) engineRef.current = new TunerEngine(onFrame, setStatus);
    return engineRef.current;
  }, [onFrame]);

  const start = useCallback(async () => {
    configureStabilizer(settings);
    stabilizer.reset();
    vibrato.reset();
    trace.clear();
    await engine.start(range);
    // Afinar é olhar pra tela sem tocar nela. Sem isso o celular apaga no meio.
    try {
      const navigatorWithWakeLock = navigator as NavigatorWithWakeLock;
      wakeLockRef.current = (await navigatorWithWakeLock.wakeLock?.request("screen")) ?? null;
    } catch {
      /* wake lock é conforto, não requisito */
    }
  }, [engine, range, stabilizer, vibrato, trace, configureStabilizer, settings]);

  const stop = useCallback(() => {
    engine.stop();
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    stabilizer.reset();
    vibrato.reset();
    trace.clear();
    readingRef.current = SILENT;
    vibratoRef.current = NO_VIBRATO;
    setDisplay(EMPTY_DISPLAY);
  }, [engine, stabilizer, vibrato, trace]);

  useEffect(() => {
    if (status.state === "running") void engine.setRange(range);
  }, [engine, range, status.state]);

  // Voltar de aba oculta ou tela apagada: no iOS o contexto cai em `interrupted`
  // e não volta sozinho, e o wake lock é solto pelo navegador de qualquer jeito.
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== "visible" || status.state !== "running") return;
      await engine.resume();
      try {
        const navigatorWithWakeLock = navigator as NavigatorWithWakeLock;
        wakeLockRef.current = (await navigatorWithWakeLock.wakeLock?.request("screen")) ?? null;
      } catch {
        /* idem */
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [engine, status.state]);

  useEffect(() => {
    if (status.state !== "running") return;
    const intervalId = setInterval(() => {
      const reading = readingRef.current;
      const vibratoAnalysis = vibratoRef.current;
      setDisplay({
        state: reading.state,
        noteFull: reading.note?.full ?? "",
        notePitchClass: reading.note?.pitchClass ?? "",
        octave: reading.note?.octave ?? null,
        cents: reading.cents,
        hz: reading.hz,
        clarity: reading.clarity,
        confirmed: reading.confirmed,
        vibrato: vibratoAnalysis,
      });
    }, DISPLAY_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [status.state]);

  useMountEffect(() => () => engineRef.current?.stop());

  return {
    settings,
    setSettings,
    status,
    display,
    readingRef,
    vibratoRef,
    trace,
    range,
    start,
    stop,
    running: status.state === "running",
  };
}
