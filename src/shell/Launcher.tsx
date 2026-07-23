import { useMemo, useState } from "react";
import { APPS } from "../app/registry";
import { detectTempo, looksLikeAbc, scoreMatch } from "../app/detect";
import { setPendingAbc, setPendingTempo, type RouteName } from "../app/router";
import { useTranslate } from "../i18n/i18n";
import { WhistleMark } from "./WhistleMark";

// The home screen is a single smart input, per the wiki-as-launcher idea: paste
// or type, and it routes. Pasted ABC → converter; a tempo → metronome; anything
// else filters the tools by keyword (name + description + aliases).
export function Launcher({ navigate }: { navigate: (r: RouteName) => void }) {
  const translate = useTranslate();
  const [query, setQuery] = useState("");

  const isAbc = useMemo(() => looksLikeAbc(query), [query]);
  const tempo = useMemo(() => (isAbc ? null : detectTempo(query)), [query, isAbc]);

  const matches = useMemo(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || isAbc) return APPS;
    return APPS.map((app) => ({
      app,
      score: scoreMatch(trimmedQuery, `${translate(app.nameKey)} ${translate(app.descKey)} ${translate(app.kwKey)}`),
    }))
      .filter((match) => match.score > 0)
      .sort((first, second) => second.score - first.score)
      .map((match) => match.app);
  }, [query, isAbc, translate]);

  const openAbc = () => {
    setPendingAbc(query);
    navigate("converter");
  };
  const openTempo = (bpm: number) => {
    setPendingTempo(bpm);
    navigate("metronome");
  };

  return (
    <section className="launcher">
      <h1 className="launcher-title">{translate("launcher.title")}</h1>

      <div className="launcher-box">
        <textarea
          className="launcher-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={translate("launcher.placeholder")}
          rows={query.includes("\n") ? 8 : 2}
          spellCheck={false}
          aria-label={translate("launcher.placeholder")}
        />
        <p className="launcher-hint">{translate("launcher.hint")}</p>
      </div>

      {isAbc && (
        <button type="button" className="launcher-suggest" onClick={openAbc}>
          <span className="suggest-icon" aria-hidden="true">
            🎼
          </span>
          <span className="suggest-body">
            <strong>{translate("launcher.abcDetected")}</strong>
            <span>{translate("launcher.abcOpen")}</span>
          </span>
          <span className="suggest-go" aria-hidden="true">
            →
          </span>
        </button>
      )}

      {tempo != null && (
        <button type="button" className="launcher-suggest" onClick={() => openTempo(tempo)}>
          <span className="suggest-icon" aria-hidden="true">
            🕰️
          </span>
          <span className="suggest-body">
            <strong>{translate("launcher.tempoDetected", { n: tempo })}</strong>
          </span>
          <span className="suggest-go" aria-hidden="true">
            →
          </span>
        </button>
      )}

      <div className="launcher-apps">
        {matches.length === 0 && !isAbc && tempo == null ? (
          <p className="launcher-empty">{translate("launcher.noResults")}</p>
        ) : (
          matches.map((app) => (
            <button
              key={app.id}
              type="button"
              className="app-card"
              onClick={() => navigate(app.route)}
            >
              <span className="app-card-icon" aria-hidden="true">
                {app.icon}
              </span>
              <span className="app-card-body">
                <span className="app-card-name">{translate(app.nameKey)}</span>
                <span className="app-card-desc">{translate(app.descKey)}</span>
              </span>
            </button>
          ))
        )}
      </div>

      <div className="launcher-emblem" aria-hidden="true">
        <WhistleMark />
      </div>
    </section>
  );
}
