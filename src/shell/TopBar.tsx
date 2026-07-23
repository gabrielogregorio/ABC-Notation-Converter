import { LANGS, useI18n } from "../i18n/i18n";

// Language flags. Shared across every route. (The app is locked to the light
// theme, so there is no dark/light toggle.)
export function TopBar() {
  const { lang, setLang, translate } = useI18n();

  return (
    <div className="topbar">
      <div className="lang-switch" role="group" aria-label={translate("lang.label")}>
        {LANGS.map((language) => (
          <button
            key={language.code}
            type="button"
            className={`lang-btn${language.code === lang ? " active" : ""}`}
            onClick={() => setLang(language.code)}
            title={language.name}
            aria-label={language.name}
            aria-pressed={language.code === lang}
          >
            <span className="flag" aria-hidden="true">
              {language.flag}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
