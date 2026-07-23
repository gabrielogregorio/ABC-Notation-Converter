/**
 * Afinador.
 *
 * O que ele faz de diferente: julga pelo centro, não pelo instante. Vibrato
 * centrado no alvo é acerto - e é assim que um sopro soa, varrendo dezenas de
 * cents por ciclo. Afinador que testa o valor instantâneo chama isso de erro e
 * ensina o músico a soprar torto pra agradar a tela.
 */
import { useRef, useState } from "react";
import { useTranslate } from "../../i18n/i18n";
import { useTuner } from "./hooks/useTuner";
import { TunerDial } from "./components/TunerDial";
import { INSTRUMENTS, instrumentByKind, type InstrumentKind } from "./core/presets";
import { A4_MAX, A4_MIN } from "./core/cents";
import { WHISTLES } from "../../whistle/whistles";

type Direction = "sharp" | "flat" | null;

const TOLERANCE_MIN_CENTS = 3;
const TOLERANCE_MAX_CENTS = 25;
const HZ_PER_KHZ = 1000;

/** Mesmo sinal de menos do resto do display: "−3", não "-3". */
function signedCents(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded}`;
  if (rounded < 0) return `−${Math.abs(rounded)}`;
  return "±0";
}

/** Sinal para exibir antes do valor absoluto de cents. */
function centsSign(cents: number): string {
  if (cents > 0) return "+";
  if (cents < 0) return "−";
  return "±";
}

/** Direção do desvio - null quando não há nota ou o veredito já confirmou. */
function directionFor(hasNote: boolean, confirmed: boolean, cents: number): Direction {
  if (!hasNote || confirmed) return null;
  return cents > 0 ? "sharp" : "flat";
}

/** Chave i18n do veredito, um eixo por vez (sem cor sozinha - texto + forma). */
function verdictKeyFor(running: boolean, hasNote: boolean, confirmed: boolean, direction: Direction): string {
  if (!running) return "tuner.idle";
  if (!hasNote) return "tuner.silent";
  if (confirmed) return "tuner.inTune";
  return direction === "sharp" ? "tuner.sharp" : "tuner.flat";
}

/** Forma do veredito (✓ ▲ ▼ ·) - redundância com o texto, não só cor. */
function verdictMark(confirmed: boolean, direction: Direction): string {
  if (confirmed) return "✓";
  if (direction === "sharp") return "▲";
  if (direction === "flat") return "▼";
  return "·";
}

export function Tuner() {
  const translate = useTranslate();
  const { settings, setSettings, status, display, readingRef, vibratoRef, trace, start, stop, running } =
    useTuner();
  const instrument = instrumentByKind(settings.instrument);

  const [announcement, setAnnouncement] = useState("");
  const spoken = useRef({ note: "", confirmed: false });

  // Duas mensagens, só em evento discreto: mudou de nota, e afinou. Uma região
  // viva que fala a cada leitura vira ruído - e falar por cima da nota polui o
  // próprio sinal que o microfone está medindo. Ajustamos o estado durante a
  // renderização comparando com o valor anterior (padrão "storing previous value"
  // do React), em vez de num efeito reagindo ao display.
  if (display.noteFull && display.noteFull !== spoken.current.note) {
    spoken.current = { note: display.noteFull, confirmed: false };
    setAnnouncement(display.noteFull);
  } else if (display.confirmed && !spoken.current.confirmed) {
    spoken.current.confirmed = true;
    setAnnouncement(translate("tuner.a11y.inTune", { note: display.noteFull }));
  } else if (!display.confirmed && spoken.current.confirmed) {
    spoken.current.confirmed = false;
  }

  const cents = Math.round(display.cents);
  const hasNote = display.state !== "silent";
  const direction = directionFor(hasNote, display.confirmed, cents);
  const verdictKey = verdictKeyFor(running, hasNote, display.confirmed, direction);

  return (
    <section className="tuner">
      <div className="tuner-head">
        <h1>{translate("tuner.title")}</h1>
        <p className="sub">{translate("tuner.sub")}</p>
      </div>

      <div className="tuner-stage">
        <div className="tuner-readout">
          <div className={`tuner-note${display.confirmed ? " confirmed" : ""}`}>
            {hasNote ? (
              <>
                <strong>{display.notePitchClass}</strong>
                {/* A oitava fica na tela. É a informação que o cromático calcula
                    e joga fora, e é dela que sai o erro de afinar uma oitava
                    acima do que se queria. */}
                <span className="tuner-octave">{display.octave}</span>
              </>
            ) : (
              <strong className="tuner-dash">-</strong>
            )}
          </div>

          <div className="tuner-verdict">
            <span className="tuner-mark" aria-hidden="true">
              {verdictMark(display.confirmed, direction)}
            </span>
            {translate(verdictKey)}
          </div>

          <div className="tuner-cents">
            {hasNote ? (
              <>
                <strong>
                  {centsSign(cents)}
                  {Math.abs(cents)}
                </strong>
                <span>¢</span>
              </>
            ) : (
              <span className="tuner-hz-idle">{running ? translate("tuner.waiting") : ""}</span>
            )}
          </div>
          {hasNote && <div className="tuner-hz">{display.hz.toFixed(1)} Hz</div>}
        </div>

        <TunerDial
          readingRef={readingRef}
          vibratoRef={vibratoRef}
          trace={trace}
          toleranceCents={settings.toleranceCents}
          running={running}
        />
      </div>

      <p className="tuner-live" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <div className="tuner-vibrato">
        {display.vibrato.active ? (
          <span className="vib-on">
            <span className="vib-tag">{translate("tuner.vibrato.title")}</span>
            {translate("tuner.vibrato.line", {
              center: signedCents(display.vibrato.centerCents),
              extent: display.vibrato.extentCents.toFixed(0),
              rate: display.vibrato.rateHz.toFixed(1),
            })}
          </span>
        ) : (
          <span className="vib-off">{translate("tuner.vibrato.none")}</span>
        )}
      </div>

      <div className="tuner-actions">
        <button type="button" className="btn-primary" onClick={running ? stop : start}>
          {running ? translate("tuner.stop") : translate("tuner.start")}
        </button>
        {running && (
          // Publicar o tempo de resposta é diferenciação num eixo vazio: nenhum
          // dos afinadores de mercado publica o dele, só a precisão em cents.
          <span className="tuner-spec">
            {translate("tuner.spec.window", { ms: status.windowMs.toFixed(0) })} ·{" "}
            {translate("tuner.spec.response", { ms: status.responseMs.toFixed(0) })} ·{" "}
            {(status.sampleRate / HZ_PER_KHZ).toFixed(1)} kHz
          </span>
        )}
      </div>

      {status.error && (
        <p className="msg msg-warn">
          <span className="msg-tag">{translate("msg.tag.warn")}</span>
          {translate(`tuner.err.${status.error}`)}
        </p>
      )}

      {status.processing.length > 0 && (
        <p className="msg msg-warn">
          <span className="msg-tag">{translate("msg.tag.warn")}</span>
          {translate("tuner.warn.processing")}
        </p>
      )}

      <div className="panel tuner-controls">
        <div className="field">
          <label className="field-label" htmlFor="tuner-inst">
            {translate("tuner.label.instrument")}
          </label>
          <select
            id="tuner-inst"
            value={settings.instrument}
            onChange={(event) => setSettings({ instrument: event.target.value as InstrumentKind })}
          >
            {INSTRUMENTS.map((instrumentOption) => (
              <option key={instrumentOption.kind} value={instrumentOption.kind}>
                {instrumentOption.icon} {translate(instrumentOption.nameKey)}
              </option>
            ))}
          </select>
        </div>

        {settings.instrument === "whistle" && (
          <div className="field">
            <label className="field-label" htmlFor="tuner-key">
              {translate("tuner.label.whistleKey")}
            </label>
            <select
              id="tuner-key"
              value={settings.whistleId}
              onChange={(event) => setSettings({ whistleId: event.target.value })}
            >
              {WHISTLES.map((whistle) => (
                <option key={whistle.id} value={whistle.id}>
                  {whistle.label}
                  {whistle.id === "D" ? translate("whistle.mostCommon") : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="tuner-a4">
            {translate("tuner.label.a4", { hz: settings.a4 })}
          </label>
          <input
            id="tuner-a4"
            type="range"
            min={A4_MIN}
            max={A4_MAX}
            step={1}
            value={settings.a4}
            onChange={(event) => setSettings({ a4: Number(event.target.value) })}
          />
          <p className="hint">{translate("tuner.hint.a4")}</p>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="tuner-tol">
            {translate("tuner.label.tolerance", { n: settings.toleranceCents })}
          </label>
          <input
            id="tuner-tol"
            type="range"
            min={TOLERANCE_MIN_CENTS}
            max={TOLERANCE_MAX_CENTS}
            step={1}
            value={settings.toleranceCents}
            onChange={(event) => setSettings({ toleranceCents: Number(event.target.value) })}
          />
          <p className="hint">{translate("tuner.hint.tolerance")}</p>
        </div>

        <div className="field">
          <span className="field-label">{translate("tuner.label.naming")}</span>
          <div className="segmented">
            <button
              type="button"
              className={settings.naming === "letter" ? "on" : ""}
              onClick={() => setSettings({ naming: "letter" })}
            >
              {translate("tuner.naming.letter")}
            </button>
            <button
              type="button"
              className={settings.naming === "solfege" ? "on" : ""}
              onClick={() => setSettings({ naming: "solfege" })}
            >
              {translate("tuner.naming.solfege")}
            </button>
          </div>
        </div>
      </div>

      {instrument.tipKey && (
        <p className="msg msg-info">
          <span className="msg-tag">{translate("msg.tag.info")}</span>
          {translate(instrument.tipKey)}
        </p>
      )}
      <p className="msg msg-info">
        <span className="msg-tag">{translate("msg.tag.info")}</span>
        {translate("tuner.honesty")}
      </p>
    </section>
  );
}
