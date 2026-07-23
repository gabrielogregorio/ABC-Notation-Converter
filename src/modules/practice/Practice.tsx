import { useCallback, useMemo, useState } from "react";
import { useMic } from "./hooks/useMic";
import { usePractice, DEFAULT_SETTINGS, type PracticeSettings } from "./hooks/usePractice";
import { useLibrary, useHistory } from "./hooks/useStorage";
import { prepareSong, type SongJSON } from "./music/song";
import { DEFAULT_WHISTLE_KEY } from "./music/fingerings";
import { ptLabel } from "./music/notes";
import { STATUS_COLOR } from "./status";
import { Staff } from "./components/Staff";
import { PitchMeter } from "./components/PitchMeter";
import { WhistleDiagram } from "./components/WhistleDiagram";
import { SongEditor } from "./components/SongEditor";
import { HistoryPanel } from "./components/HistoryPanel";
import { useTranslate } from "../../i18n/i18n";

const DEFAULT_TIME_SIGNATURE: [number, number] = [4, 4];
const PERCENT_SCALE = 100;
const TOLERANCE_MIN_CENTS = 5;
const TOLERANCE_MAX_CENTS = 60;
const HOLD_MIN_PCT = 20;
const HOLD_MAX_PCT = 100;

export function Practice() {
  const translate = useTranslate();
  const { allSongs, upsertSong, removeSong, isUserSong } = useLibrary();
  const { history, addAttempt, clearSong } = useHistory();

  const [selectedId, setSelectedId] = useState<string>(() => allSongs[0]?.id ?? "");
  const [editing, setEditing] = useState<SongJSON | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [settings, setSettings] = useState<PracticeSettings>(DEFAULT_SETTINGS);

  const songJson = allSongs.find((song) => song.id === selectedId) ?? allSongs[0];
  const prepared = useMemo(() => {
    if (!songJson) return null;
    try {
      return prepareSong(songJson);
    } catch {
      return null;
    }
  }, [songJson]);

  const whistleKey = songJson?.whistleKey ?? DEFAULT_WHISTLE_KEY;

  // Ao trocar de música, adota a tolerância padrão dela - mas sem useEffect: é um
  // ajuste de estado quando um id muda, então roda na própria renderização (padrão
  // oficial do React), e não num efeito que dispara um segundo render defasado.
  const [toleranceAppliedFor, setToleranceAppliedFor] = useState<string>();
  if (songJson && songJson.id !== toleranceAppliedFor) {
    setToleranceAppliedFor(songJson.id);
    const songTolerance = songJson.toleranceCents;
    if (songTolerance != null) {
      setSettings((prev) => ({ ...prev, toleranceCents: songTolerance }));
    }
  }

  const mic = useMic();
  const onComplete = useCallback(
    (result: Parameters<typeof addAttempt>[0]) => addAttempt(result),
    [addAttempt],
  );
  const practice = usePractice(prepared, mic.onFrame, settings, onComplete);

  const handleStart = useCallback(async () => {
    if (!mic.active) await mic.start();
    practice.start();
  }, [mic, practice]);

  const currentNote =
    practice.currentIndex >= 0 ? prepared?.notes[practice.currentIndex] ?? null : null;
  const targetLabel = currentNote?.parsed ? ptLabel(currentNote.parsed) : "-";
  const targetMidi = currentNote?.parsed?.midi ?? null;
  const feedbackColor = STATUS_COLOR[practice.feedback.status];

  const songHistory = history[selectedId] ?? [];
  const playedCount =
    practice.currentIndex >= 0
      ? prepared?.notes.slice(0, practice.currentIndex).filter((note) => !note.isRest).length ?? 0
      : 0;

  return (
    <div className="practice">
      <aside className="sidebar">
        <div className="brand-mini">
          <h1>{translate("practice.title")}</h1>
          <span className="dim">{translate("practice.sub")}</span>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => {
            setEditing(null);
            setShowEditor(true);
          }}
        >
          {translate("practice.newSong")}
        </button>
        <ul className="song-list">
          {allSongs.map((song) => (
            <li
              key={song.id}
              className={`song-item ${song.id === selectedId ? "active" : ""}`}
              onClick={() => setSelectedId(song.id)}
            >
              <div className="song-item-main">
                <span className="song-title">{song.title}</span>
                <span className="dim song-meta">
                  {translate("practice.songMeta", {
                    tempo: song.tempo,
                    notes: song.notes.length,
                    mine: isUserSong(song.id) ? 1 : 0,
                  })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <main className="practice-main">
        {!songJson ? (
          <div className="empty-state">{translate("practice.empty")}</div>
        ) : (
          <>
            <header className="main-head">
              <div>
                <h2>{songJson.title}</h2>
                <span className="dim">
                  {translate("practice.songHead", {
                    tempo: songJson.tempo,
                    sig: (songJson.timeSignature ?? DEFAULT_TIME_SIGNATURE).join("/"),
                    key: whistleKey,
                  })}
                </span>
              </div>
              <div className="head-actions">
                {isUserSong(songJson.id) && (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        setEditing(songJson);
                        setShowEditor(true);
                      }}
                    >
                      {translate("practice.edit")}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => removeSong(songJson.id)}>
                      {translate("practice.delete")}
                    </button>
                  </>
                )}
                {practice.running ? (
                  <button type="button" className="btn btn-stop" onClick={practice.stop}>
                    ■ {translate("practice.stop")}
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={handleStart}>
                    {mic.active ? "▶" : "🎤"} {translate("practice.play")}
                  </button>
                )}
              </div>
            </header>

            {mic.error && <div className="banner-error">{translate("practice.micError", { err: mic.error })}</div>}

            {prepared && (
              <Staff
                notes={prepared.notes}
                currentIndex={practice.currentIndex}
                status={practice.feedback.status}
                direction={practice.feedback.direction}
                holdProgress={practice.feedback.holdProgress}
                tempo={songJson.tempo}
                timeSignature={songJson.timeSignature}
              />
            )}

            <section className="practice-row">
              <WhistleDiagram
                midi={targetMidi}
                whistleKey={whistleKey}
                color={feedbackColor}
                octaveAgnostic={settings.ignoreOctave}
              />
              <div className="practice-center">
                <PitchMeter feedback={practice.feedback} targetLabel={targetLabel} />
                {practice.running && practice.feedback.needsArticulation && (
                  <div className="articulate-hint">{translate("practice.articulate")}</div>
                )}
                {practice.running && prepared && (
                  <div className="progress-line dim">
                    {translate("practice.noteProgress", { i: playedCount + 1, total: prepared.playableCount })}
                  </div>
                )}
                {practice.finished && <div className="finished-banner">{translate("practice.finished")}</div>}
              </div>
            </section>

            <section className="settings-row">
              <label className="setting">
                <span>
                  {translate("practice.tolerance")} <strong>{settings.toleranceCents}¢</strong>
                  <span className="dim"> {translate("practice.tolerancePerfect")}</span>
                </span>
                <input
                  type="range"
                  min={TOLERANCE_MIN_CENTS}
                  max={TOLERANCE_MAX_CENTS}
                  value={settings.toleranceCents}
                  onChange={(event) =>
                    setSettings((prev) => ({ ...prev, toleranceCents: Number(event.target.value) }))
                  }
                />
              </label>
              <label className="setting">
                <span>
                  {translate("practice.hold")} <strong>{Math.round(settings.holdScale * PERCENT_SCALE)}%</strong>
                  <span className="dim"> {translate("practice.holdOf")}</span>
                </span>
                <input
                  type="range"
                  min={HOLD_MIN_PCT}
                  max={HOLD_MAX_PCT}
                  value={Math.round(settings.holdScale * PERCENT_SCALE)}
                  onChange={(event) =>
                    setSettings((prev) => ({ ...prev, holdScale: Number(event.target.value) / PERCENT_SCALE }))
                  }
                />
              </label>
              <label className="setting setting-check">
                <input
                  type="checkbox"
                  checked={settings.ignoreOctave}
                  onChange={(event) => setSettings((prev) => ({ ...prev, ignoreOctave: event.target.checked }))}
                />
                <span>
                  {translate("practice.ignoreOctave")}
                  <span className="dim"> {translate("practice.ignoreOctaveHint")}</span>
                </span>
              </label>
              <label className="setting setting-check">
                <input
                  type="checkbox"
                  checked={settings.requireTongue}
                  onChange={(event) => setSettings((prev) => ({ ...prev, requireTongue: event.target.checked }))}
                />
                <span>
                  {translate("practice.requireTongue")}
                  <span className="dim"> {translate("practice.requireTongueHint")}</span>
                </span>
              </label>
            </section>
          </>
        )}
      </main>

      <aside className="history-panel">
        <h3>{translate("practice.history")}</h3>
        <HistoryPanel attempts={songHistory} onClear={() => clearSong(selectedId)} />
      </aside>

      {showEditor && (
        <div className="modal-overlay" onClick={() => setShowEditor(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <SongEditor
              initial={editing ?? undefined}
              onCancel={() => setShowEditor(false)}
              onSave={(song) => {
                upsertSong(song);
                setSelectedId(song.id);
                setShowEditor(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
