import type { RouteName } from "./router";

// The catalog behind both the top nav and the launcher search. Each app carries
// i18n keys for its name/description plus a space-separated keyword bag (aliases,
// in every language's dictionary) - the wiki model: terse metadata, full-text
// filtered locally, no search server.

export interface AppEntry {
  id: Exclude<RouteName, "home">;
  route: RouteName;
  icon: string;
  nameKey: string;
  descKey: string;
  kwKey: string;
}

export const APPS: AppEntry[] = [
  {
    id: "converter",
    route: "converter",
    icon: "🎼",
    nameKey: "nav.converter",
    descKey: "app.converter.desc",
    kwKey: "app.converter.kw",
  },
  {
    id: "tuner",
    route: "tuner",
    icon: "🎯",
    nameKey: "nav.tuner",
    descKey: "app.tuner.desc",
    kwKey: "app.tuner.kw",
  },
  {
    id: "metronome",
    route: "metronome",
    icon: "🕰️",
    nameKey: "nav.metronome",
    descKey: "app.metronome.desc",
    kwKey: "app.metronome.kw",
  },
  {
    id: "practice",
    route: "practice",
    icon: "🎤",
    nameKey: "nav.practice",
    descKey: "app.practice.desc",
    kwKey: "app.practice.kw",
  },
];
