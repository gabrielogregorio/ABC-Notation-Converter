// i18n for Music Lab. One dictionary per language (see ./pt, ./en, ./es, ./zh,
// ./ja), an English fallback, and a React context so components re-render when the
// language changes. Parameterised strings are stored as functions. The shared types
// live in ./types and are re-exported here so consumers keep one import path.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { pt } from "./pt";
import { en } from "./en";
import { es } from "./es";
import { zh } from "./zh";
import { ja } from "./ja";
import { ga } from "./ga";
import { fr } from "./fr";
import { de } from "./de";
import { cy } from "./cy";
import { gd } from "./gd";
import { af } from "./af";
import type { Lang, Params, Dict } from "./types";

export type { Lang, Params, Dict } from "./types";

export const LANGS: { code: Lang; flag: string; name: string; htmlLang: string }[] = [
  { code: "pt", flag: "🇧🇷", name: "Português", htmlLang: "pt-BR" },
  { code: "en", flag: "🇺🇸", name: "English", htmlLang: "en" },
  { code: "es", flag: "🇪🇸", name: "Español", htmlLang: "es" },
  { code: "zh", flag: "🇨🇳", name: "中文", htmlLang: "zh" },
  { code: "ja", flag: "🇯🇵", name: "日本語", htmlLang: "ja" },
  { code: "ga", flag: "🇮🇪", name: "Gaeilge", htmlLang: "ga" },
  { code: "gd", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", name: "Gàidhlig", htmlLang: "gd" },
  { code: "cy", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", name: "Cymraeg", htmlLang: "cy" },
  { code: "fr", flag: "🇫🇷", name: "Français", htmlLang: "fr" },
  { code: "de", flag: "🇩🇪", name: "Deutsch", htmlLang: "de" },
  { code: "af", flag: "🇿🇦", name: "Afrikaans", htmlLang: "af" },
];

const DICTS: Record<Lang, Dict> = { pt, en, es, zh, ja, ga, gd, cy, fr, de, af };
const LANG_KEY = "music-lab:lang";

export function detectInitialLang(): Lang {
  const stored = localStorage.getItem(LANG_KEY) as Lang | null;
  if (stored && stored in DICTS) return stored;
  const nav = (navigator.language || "pt").slice(0, 2) as Lang;
  return nav in DICTS ? nav : "pt";
}

// Sincroniza o `document` (idioma e título) com o idioma escolhido. É I/O num
// sistema externo (o DOM do documento), então mora no evento que troca de idioma
// e na inicialização em main.tsx - nunca num efeito reagindo a `lang`.
export function applyDocumentLanguage(lang: Lang): void {
  const meta = LANGS.find((language) => language.code === lang) ?? LANGS[0];
  document.documentElement.lang = meta.htmlLang;
  document.title = translate(lang, "meta.title");
}

export function translate(lang: Lang, key: string, params?: Params): string {
  const entry = DICTS[lang][key] ?? DICTS.en[key];
  if (entry === undefined) return key;
  return typeof entry === "function" ? entry(params ?? {}) : entry;
}

export type TranslateFn = (key: string, params?: Params) => string;

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  translate: TranslateFn;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang: (language: Lang) => {
        localStorage.setItem(LANG_KEY, language);
        applyDocumentLanguage(language);
        setLangState(language);
      },
      translate: (key, params) => translate(lang, key, params),
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}

// Convenience: just the translator.
export function useTranslate(): TranslateFn {
  return useI18n().translate;
}
