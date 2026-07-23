import { useRef, useState } from "react";
import { useMountEffect } from "../../app/useMountEffect";
import { Metronome as Engine } from "./core/metronome";
import { loadPrefs, savePrefs, type Prefs } from "./core/prefs";
import { clampBpm, clampBeatsPerBar, clampSubdivisions, MIN_BPM, MAX_BPM } from "./core/scheduler";
import { bpmFromTaps } from "./core/tapTempo";
import { accentAt, cycleAccent, type AccentLevel } from "./core/clicks";
import { bobYForBpm, pendulumAngle, sideForBeat } from "./core/pendulum";
import { takePendingTempo } from "../../app/router";
import { useTranslate } from "../../i18n/i18n";

const SUB_KEYS: Record<number, string> = {
  1: "metro.sub1",
  2: "metro.sub2",
  3: "metro.sub3",
  4: "metro.sub4",
};

export function tempoTermKey(bpm: number): string {
  if (bpm < 60) return "metro.term.largo";
  if (bpm < 76) return "metro.term.adagio";
  if (bpm < 108) return "metro.term.andante";
  if (bpm < 120) return "metro.term.moderato";
  if (bpm < 168) return "metro.term.allegro";
  return "metro.term.presto";
}

const SUBDIVISIONS = [1, 2, 3, 4];
const MS_PER_MINUTE = 60000;
const PERCENT_SCALE = 100;
const SWING_MAX_PCT = 75;
const VOLUME_MAX_PCT = 100;
const TAP_RESET_MS = 2000;
const FLASH_MS = 110;
const PENDULUM_AMPLITUDE_PX = 42;
const RESTING_DECAY_PER_FRAME = 0.88;
const RESTING_REST_ANGLE = 0.05;
// Pulso do peso a cada batida: cresce PULSE_GAIN acima de 1 e decai em PULSE_DECAY_MS.
const PULSE_GAIN = 0.35;
const PULSE_DECAY_MS = 110;
const BOB_RADIUS_PX = 13;
const BOB_GLOW_PX = 7;

export function Metronome() {
  const translate = useTranslate();
  const prefs0 = useRef<Prefs>(loadPrefs());

  // Um tempo entregue pelo launcher entra na inicialização do estado (lazy), não
  // num efeito de montagem; o motor abaixo nasce já com esse mesmo bpm inicial.
  const [bpm, setBpmState] = useState(() => {
    const pending = takePendingTempo();
    return clampBpm(pending != null ? pending : prefs0.current.bpm);
  });
  const [beats, setBeatsState] = useState(prefs0.current.beatsPerBar);
  const [subdivisions, setSubState] = useState(prefs0.current.subdivisions);
  const [swing, setSwingState] = useState(prefs0.current.swing);
  const [volume, setVolumeState] = useState(prefs0.current.volume);
  const [accents, setAccents] = useState<AccentLevel[]>(() =>
    Array.from({ length: prefs0.current.beatsPerBar }, (_, beatIndex) =>
      accentAt(prefs0.current.accents, beatIndex),
    ),
  );
  const [playing, setPlaying] = useState(false);

  const engineRef = useRef<Engine | null>(null);
  const armRef = useRef<SVGGElement>(null);
  const bobRef = useRef<SVGCircleElement>(null);
  const lampLRef = useRef<SVGCircleElement>(null);
  const lampRRef = useRef<SVGCircleElement>(null);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const accentsRef = useRef(accents);
  accentsRef.current = accents;

  // One engine instance + one rAF loop for the whole lifetime of the module.
  useMountEffect(() => {
    const engine = new Engine({
      bpm,
      beatsPerBar: prefs0.current.beatsPerBar,
      subdivisions: prefs0.current.subdivisions,
      swing: prefs0.current.swing,
      volume: prefs0.current.volume,
      accents: accentsRef.current,
    });
    engineRef.current = engine;

    const reduceMotion =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const amplitude = reduceMotion ? 0 : PENDULUM_AMPLITUDE_PX;

    let anchorIndex = 0;
    let anchorPerf = 0;
    let beatMs = MS_PER_MINUTE / engine.bpm;
    let pulsePerf = Number.NEGATIVE_INFINITY;
    let restingAngle = 0;
    let raf = 0;

    const flashDot = (beatInBar: number) => {
      dotRefs.current.forEach((dot) => dot?.classList.remove("active"));
      const active = dotRefs.current[beatInBar];
      if (active) {
        active.classList.add("active");
        window.setTimeout(() => active.classList.remove("active"), FLASH_MS);
      }
    };
    const flashLamp = (beatIndex: number, isAccent: boolean) => {
      const lamp = sideForBeat(beatIndex) === 1 ? lampRRef.current : lampLRef.current;
      if (!lamp) return;
      lamp.classList.add("lit");
      if (isAccent) lamp.classList.add("accent");
      window.setTimeout(() => lamp.classList.remove("lit", "accent"), FLASH_MS);
    };

    const animate = () => {
      for (const beat of engine.drainDueBeats()) {
        if (!beat.isBeat) continue;
        anchorIndex = beat.beatIndex;
        anchorPerf = performance.now();
        beatMs = MS_PER_MINUTE / engine.bpm;
        pulsePerf = anchorPerf;
        flashDot(beat.beatInBar);
        flashLamp(beat.beatIndex, accentsRef.current[beat.beatInBar] === "accent");
      }

      const now = performance.now();
      let angle: number;
      if (engine.isPlaying) {
        angle = pendulumAngle(anchorIndex, anchorPerf, beatMs, now, amplitude);
        restingAngle = angle;
      } else {
        restingAngle *= RESTING_DECAY_PER_FRAME;
        if (Math.abs(restingAngle) < RESTING_REST_ANGLE) restingAngle = 0;
        angle = restingAngle;
      }
      armRef.current?.setAttribute("transform", `rotate(${angle.toFixed(2)} 100 210)`);

      const sincePulse = now - pulsePerf;
      const pulse = sincePulse >= 0 ? 1 + PULSE_GAIN * Math.exp(-sincePulse / PULSE_DECAY_MS) : 1;
      if (bobRef.current) {
        bobRef.current.setAttribute("r", (BOB_RADIUS_PX * pulse).toFixed(2));
        bobRef.current.style.filter = `drop-shadow(0 0 ${(BOB_GLOW_PX * pulse).toFixed(1)}px var(--accent))`;
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      engine.dispose();
      engineRef.current = null;
    };
  });

  const engine = () => engineRef.current;

  // Persiste a preferência no próprio handler que a muda (Rule 3 da skill),
  // mesclando o campo alterado com o resto do estado atual - sem efeito reagindo
  // a bpm/beats/swing/etc.
  function persist(patch: Partial<Prefs>) {
    savePrefs({ bpm, beatsPerBar: beats, subdivisions, swing, volume, accents, ...patch });
  }

  function setBpm(value: number) {
    const clamped = clampBpm(value);
    setBpmState(clamped);
    persist({ bpm: clamped });
    engine()?.setBpm(clamped);
    bobRef.current?.setAttribute("cy", String(bobYForBpm(clamped)));
  }
  function setBeats(value: number) {
    const clamped = clampBeatsPerBar(value);
    // Muda de compasso e empurra os novos acentos ao motor no próprio handler -
    // não num efeito reagindo a `accents` (era o único setter que fazia isso).
    const nextAccents = Array.from({ length: clamped }, (_, beatIndex) => accentAt(accents, beatIndex));
    setBeatsState(clamped);
    setAccents(nextAccents);
    persist({ beatsPerBar: clamped, accents: nextAccents });
    engine()?.setBeatsPerBar(clamped);
    engine()?.setAccents(nextAccents);
  }
  function setSubdivisions(value: number) {
    const clamped = clampSubdivisions(value);
    setSubState(clamped);
    persist({ subdivisions: clamped });
    engine()?.setSubdivisions(clamped);
  }
  function setSwing(value: number) {
    setSwingState(value);
    persist({ swing: value });
    engine()?.setSwing(value);
  }
  function setVolume(value: number) {
    setVolumeState(value);
    persist({ volume: value });
    engine()?.setVolume(value);
  }
  function cycleDot(dotIndex: number) {
    const nextAccents = accents.map((level, beatIndex) =>
      beatIndex === dotIndex ? cycleAccent(level) : level,
    );
    setAccents(nextAccents);
    persist({ accents: nextAccents });
    engine()?.setAccents(nextAccents);
  }
  function togglePlay() {
    const activeEngine = engine();
    if (!activeEngine) return;
    if (activeEngine.isPlaying) {
      activeEngine.stop();
      setPlaying(false);
    } else {
      activeEngine.start();
      setPlaying(true);
    }
  }

  // Tap tempo.
  const tapsRef = useRef<number[]>([]);
  function tap() {
    const now = performance.now();
    if (tapsRef.current.length && now - tapsRef.current[tapsRef.current.length - 1] > TAP_RESET_MS) {
      tapsRef.current = [];
    }
    tapsRef.current.push(now);
    const tappedBpm = bpmFromTaps(tapsRef.current);
    if (tappedBpm != null) setBpm(tappedBpm);
  }

  // Space = play/pause when not typing in a field.
  useMountEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space" && event.target === document.body) {
        event.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const swingDisabled = subdivisions % 2 !== 0;

  return (
    <div className="metro panel">
      <div className="metro-head">
        <h1>{translate("metro.title")}</h1>
        <p className="sub">{translate("metro.sub")}</p>
      </div>

      <div className="stage">
        <svg className="pendulum" viewBox="0 0 200 250" aria-hidden="true">
          <path className="body" d="M64 244 L136 244 L118 92 L82 92 Z" />
          <line className="scale" x1="100" y1="110" x2="100" y2="210" />
          <circle ref={lampLRef} className="lamp" cx="40" cy="70" r="6" />
          <circle ref={lampRRef} className="lamp" cx="160" cy="70" r="6" />
          <g ref={armRef}>
            <line className="rod" x1="100" y1="210" x2="100" y2="42" />
            <circle ref={bobRef} className="bob" cx="100" cy={bobYForBpm(bpm)} r={BOB_RADIUS_PX} />
          </g>
          <circle className="pivot" cx="100" cy="210" r="6" />
        </svg>
      </div>

      <div className="beats" title={translate("metro.beatsHint")}>
        {accents.map((level, beatIndex) => (
          <button
            key={beatIndex}
            ref={(element) => {
              dotRefs.current[beatIndex] = element;
            }}
            type="button"
            className={`dot ${level}`}
            aria-label={`${beatIndex + 1}: ${level}`}
            onClick={() => cycleDot(beatIndex)}
          />
        ))}
      </div>

      <div className="bpm-display">{bpm}</div>
      <div className="bpm-label">{translate(tempoTermKey(bpm))} · BPM</div>
      <input
        type="range"
        min={MIN_BPM}
        max={MAX_BPM}
        value={bpm}
        onChange={(event) => setBpm(Number(event.target.value))}
        aria-label="BPM"
      />

      <div className="row">
        <label>{translate("metro.bar")}</label>
        <div className="stepper">
          <button type="button" aria-label={translate("metro.lessBeats")} onClick={() => setBeats(beats - 1)}>
            −
          </button>
          <span>{beats}</span>
          <button type="button" aria-label={translate("metro.moreBeats")} onClick={() => setBeats(beats + 1)}>
            +
          </button>
        </div>
      </div>

      <div className="row">
        <label>{translate("metro.subdivision")}</label>
        <div className="segmented">
          {SUBDIVISIONS.map((subdivision) => (
            <button
              key={subdivision}
              type="button"
              className={subdivision === subdivisions ? "on" : ""}
              onClick={() => setSubdivisions(subdivision)}
            >
              {subdivision}
            </button>
          ))}
        </div>
      </div>
      <div className="hint metro-sublabel">{translate(SUB_KEYS[subdivisions])}</div>

      <div className="row">
        <label>
          {translate("metro.swing")} <span>{Math.round(swing * PERCENT_SCALE)}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={SWING_MAX_PCT}
          value={Math.round(swing * PERCENT_SCALE)}
          disabled={swingDisabled}
          onChange={(event) => setSwing(Number(event.target.value) / PERCENT_SCALE)}
        />
      </div>

      <div className="row">
        <label>{translate("metro.volume")}</label>
        <input
          type="range"
          min={0}
          max={VOLUME_MAX_PCT}
          value={Math.round(volume * PERCENT_SCALE)}
          onChange={(event) => setVolume(Number(event.target.value) / PERCENT_SCALE)}
        />
      </div>

      <div className="row metro-taprow">
        <button type="button" className="tap" onClick={tap}>
          {translate("metro.tap")}
        </button>
        <button type="button" aria-label="BPM -1" onClick={() => setBpm(bpm - 1)}>
          −1
        </button>
        <button type="button" aria-label="BPM +1" onClick={() => setBpm(bpm + 1)}>
          +1
        </button>
      </div>

      <button type="button" className={`play${playing ? " playing" : ""}`} onClick={togglePlay}>
        {playing ? `■  ${translate("metro.stop")}` : `▶  ${translate("metro.start")}`}
      </button>
    </div>
  );
}
