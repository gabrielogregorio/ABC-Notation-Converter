/**
 * Persistência de preferências em localStorage - mesma ideia do afinador do
 * CLEO (chave única + merge com defaults + try/catch defensivo para SSR/testes).
 */
import {
  clampBpm,
  clampBeatsPerBar,
  clampSubdivisions,
  clampSwing,
} from './scheduler.ts';
import type { AccentLevel } from './clicks.ts';

const STORAGE_KEY = 'musicstudio.metronome.prefs';
const ACCENT_LEVELS: AccentLevel[] = ['muted', 'normal', 'accent'];

export interface Prefs {
  bpm: number;
  beatsPerBar: number;
  subdivisions: number;
  swing: number;
  /** Volume do click, 0..1. */
  volume: number;
  /** Override de acento por tempo; vazio = padrão (1º acentuado). */
  accents: AccentLevel[];
}

export const DEFAULT_PREFS: Prefs = {
  bpm: 100,
  beatsPerBar: 4,
  subdivisions: 1,
  swing: 0,
  volume: 0.5,
  accents: [],
};

function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_PREFS.volume;
  return Math.max(0, Math.min(1, v));
}

function sanitizeAccents(raw: unknown): AccentLevel[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a) =>
    ACCENT_LEVELS.includes(a as AccentLevel) ? (a as AccentLevel) : 'normal',
  );
}

/** Normaliza qualquer objeto vindo do storage para um Prefs válido. */
export function normalizePrefs(raw: Partial<Prefs> | null | undefined): Prefs {
  const p = raw ?? {};
  return {
    bpm: clampBpm(p.bpm ?? DEFAULT_PREFS.bpm),
    beatsPerBar: clampBeatsPerBar(p.beatsPerBar ?? DEFAULT_PREFS.beatsPerBar),
    subdivisions: clampSubdivisions(p.subdivisions ?? DEFAULT_PREFS.subdivisions),
    swing: clampSwing(p.swing ?? DEFAULT_PREFS.swing),
    volume: clampVolume(p.volume ?? DEFAULT_PREFS.volume),
    accents: sanitizeAccents(p.accents),
  };
}

export function loadPrefs(): Prefs {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return normalizePrefs(JSON.parse(raw) as Partial<Prefs>);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: Prefs): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePrefs(prefs)));
  } catch {
    /* storage cheio ou indisponível - ignora */
  }
}
