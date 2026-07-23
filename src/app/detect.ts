// Pure heuristics for the launcher: figure out what the user pasted/typed so we
// can route straight to the right module. Kept framework-free and unit-tested.

const MIN_TEMPO_BPM = 20;
const MAX_TEMPO_BPM = 400;
const MIN_ABC_LENGTH = 3;

// ABC tunes carry header fields like "X:", "K:", "M:", "T:". One of the
// structural headers (index, key or metre) is a strong, low-false-positive signal.
export function looksLikeAbc(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < MIN_ABC_LENGTH) return false;
  // A header field for tune index (X:), key (K:) or metre (M:) with a value is a
  // strong, low-false-positive signal - a plain sentence won't have one.
  return /(^|\n)\s*[XKM]:\s*\S/.test(trimmed);
}

// Pull a tempo out of "120 bpm", "tempo 96", or a bare number in metronome range.
export function detectTempo(text: string): number | null {
  const trimmed = text.trim();
  const bpm = trimmed.match(/(\d{2,3})\s*bpm/i);
  if (bpm) return clampTempo(Number(bpm[1]));
  if (/^\d{2,3}$/.test(trimmed)) {
    const value = Number(trimmed);
    if (value >= MIN_TEMPO_BPM && value <= MAX_TEMPO_BPM) return value;
  }
  const withWord = trimmed.match(/(?:tempo|bpm|andamento|metron\w*|テンポ|节拍|速度)\D{0,6}(\d{2,3})/i);
  if (withWord) return clampTempo(Number(withWord[1]));
  return null;
}

function clampTempo(n: number): number {
  return Math.max(MIN_TEMPO_BPM, Math.min(MAX_TEMPO_BPM, Math.round(n)));
}

// Normalise for accent-insensitive, case-insensitive keyword matching.
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Score an app against a query: sum of matched query tokens found in its haystack
// (name + description + keywords). 0 = no match.
export function scoreMatch(query: string, haystack: string): number {
  const queryTokens = normalize(query).split(/\s+/).filter(Boolean);
  if (queryTokens.length === 0) return 0;
  const normalizedHaystack = normalize(haystack);
  let score = 0;
  for (const token of queryTokens) {
    if (normalizedHaystack.includes(token)) score += 1;
  }
  return score;
}
