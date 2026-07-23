import { useSyncExternalStore } from "react";

// Hash routing so every module has a shareable URL (#/converter, #/metronome,
// #/practice) that survives a static host with no server rewrites - exactly what
// GitHub Pages needs.

export type RouteName = "home" | "converter" | "tuner" | "metronome" | "practice";

const PATHS: Record<string, RouteName> = {
  "": "home",
  "/": "home",
  "/converter": "converter",
  "/tuner": "tuner",
  "/metronome": "metronome",
  "/practice": "practice",
};

const ROUTE_TO_HASH: Record<RouteName, string> = {
  home: "#/",
  converter: "#/converter",
  tuner: "#/tuner",
  metronome: "#/metronome",
  practice: "#/practice",
};

function parseHash(): RouteName {
  const raw = location.hash.replace(/^#/, "");
  const path = raw.split("?")[0];
  return PATHS[path] ?? "home";
}

// A URL (o hash) é o estado externo; a rota é derivada dele via
// useSyncExternalStore - o jeito idiomático do React de assinar um store de fora,
// sem useEffect nem useMountEffect. Navegar é só escrever no hash: o próprio
// evento `hashchange` propaga a nova rota.
function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useHashRoute(): [RouteName, (r: RouteName) => void] {
  const route = useSyncExternalStore(subscribeToHash, parseHash);

  const navigate = (targetRoute: RouteName) => {
    location.hash = ROUTE_TO_HASH[targetRoute];
  };

  return [route, navigate];
}

// Small in-memory hand-off channel: the launcher stashes pasted ABC here and
// navigates to the converter, which reads and clears it on mount. Keeps the URL
// clean instead of cramming a whole tune into the hash.
let pendingAbc: string | null = null;
export function setPendingAbc(abc: string): void {
  pendingAbc = abc;
}
export function takePendingAbc(): string | null {
  const value = pendingAbc;
  pendingAbc = null;
  return value;
}

// Same channel for a tempo the launcher recognised, handed to the metronome.
let pendingTempo: number | null = null;
export function setPendingTempo(bpm: number): void {
  pendingTempo = bpm;
}
export function takePendingTempo(): number | null {
  const value = pendingTempo;
  pendingTempo = null;
  return value;
}
