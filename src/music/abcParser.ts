import { toMidi, type Letter } from "./pitch";
import { parseKey, type KeyInfo } from "./keys";

// A focused ABC reader. It does one job: walk a tune body and pull out the
// ordered melody notes, applying the key signature and bar-scoped accidentals,
// while collecting a plain-language list of anything it could not read. It is
// deliberately narrower than a full ABC engine - ornaments, chord symbols and
// layout tokens are skipped, not interpreted.

export interface ParsedNote {
  midi: number;
  letter: Letter;
  accidental: number; // effective semitone offset applied (explicit or key)
  raw: string; // the exact token as written, e.g. "^g'" or "A,"
}

export type WarningCode = "stray-accidental" | "unknown-symbol";

export interface Warning {
  token: string;
  code: WarningCode;
  reason: string; // human-readable fallback (pt); the UI translates via `code`
}

export interface ParsedTune {
  title: string;
  key: KeyInfo;
  meter: string;
  unitLength: string;
  notes: ParsedNote[];
  warnings: Warning[];
}

const HEADER_RE = /^([A-Za-z]):\s?(.*)$/;
// Fixed patterns used inside the tune-body scan; compiled once at module scope.
const LETTER_RE = /[A-Ga-g]/;
const NOTE_START_RE = /[A-Ga-g_^=]/;
const DURATION_TAIL_RE = /[0-9/<>]/;
const REST_DURATION_RE = /[0-9/]/;
const DIGIT_RE = /[0-9]/;
const TUPLET_ARG_RE = /[0-9:]/;
const INLINE_FIELD_RE = /^\[([A-Za-z]):([^\]]*)\]/;

function splitHeaderAndBody(abc: string): { headers: Record<string, string>; body: string } {
  const headers: Record<string, string> = {};
  const bodyLines: string[] = [];
  let inBody = false;

  for (const line of abc.split(/\r?\n/)) {
    if (!inBody) {
      const match = line.match(HEADER_RE);
      if (match) {
        headers[match[1]] = match[2].trim();
        // The K: field is the last header; everything after it is the tune body.
        if (match[1] === "K") inBody = true;
        continue;
      }
      if (line.trim() === "") continue;
      // A non-header line before K: - treat the rest as body anyway.
      inBody = true;
    }
    bodyLines.push(line);
  }

  return { headers, body: bodyLines.join("\n") };
}

const ACC_DELTA: Record<string, number> = { "^": 1, _: -1, "=": 0 };

export function parseAbc(abc: string): ParsedTune {
  const { headers, body } = splitHeaderAndBody(abc);
  const key = parseKey(headers.K ?? "");
  const notes: ParsedNote[] = [];
  const warnings: Warning[] = [];

  // Accidentals that stay in force until the next bar line, keyed by letter.
  let barAccidentals: Partial<Record<Letter, number>> = {};

  let cursor = 0;
  const length = body.length;

  const skipBalanced = (open: string, close: string) => {
    // assumes body[cursor] === open
    let depth = 0;
    while (cursor < length) {
      if (body[cursor] === open) depth += 1;
      else if (body[cursor] === close) {
        depth -= 1;
        if (depth === 0) {
          cursor += 1;
          return;
        }
      }
      cursor += 1;
    }
  };

  const readNote = (): void => {
    const start = cursor;

    let acc = 0;
    let hasExplicit = false;
    while (
      cursor < length &&
      (body[cursor] === "^" || body[cursor] === "_" || body[cursor] === "=")
    ) {
      acc += ACC_DELTA[body[cursor]];
      hasExplicit = true;
      cursor += 1;
    }

    const char = body[cursor];
    if (!char || !LETTER_RE.test(char)) {
      // A stray accidental with no note behind it.
      if (hasExplicit) {
        warnings.push({
          token: body.slice(start, cursor + 1),
          code: "stray-accidental",
          reason: "acidental sem nota logo em seguida",
        });
      }
      cursor += 1;
      return;
    }
    const upper = char === char.toUpperCase();
    const letter = char.toUpperCase() as Letter;
    cursor += 1;

    let octaveShift = 0;
    while (cursor < length && (body[cursor] === "'" || body[cursor] === ",")) {
      octaveShift += body[cursor] === "'" ? 1 : -1;
      cursor += 1;
    }

    // Duration digits / fractions don't affect pitch; consume and ignore them.
    while (cursor < length && DURATION_TAIL_RE.test(body[cursor])) cursor += 1;

    let effectiveAcc: number;
    if (hasExplicit) {
      effectiveAcc = acc;
      barAccidentals[letter] = acc;
    } else if (letter in barAccidentals) {
      effectiveAcc = barAccidentals[letter]!;
    } else {
      effectiveAcc = key.accidentals[letter];
    }

    notes.push({
      midi: toMidi(letter, upper, octaveShift, effectiveAcc),
      letter,
      accidental: effectiveAcc,
      raw: body.slice(start, cursor),
    });
  };

  while (cursor < length) {
    const char = body[cursor];

    if (char === "\n" || char === " " || char === "\t") {
      cursor += 1;
      continue;
    }
    // % starts a comment (and %% a stylesheet directive) to end of line.
    if (char === "%") {
      while (cursor < length && body[cursor] !== "\n") cursor += 1;
      continue;
    }
    // Grace notes, chord symbols, decorations, annotations - skip wholesale.
    if (char === "{") {
      skipBalanced("{", "}");
      continue;
    }
    if (char === '"') {
      cursor += 1;
      while (cursor < length && body[cursor] !== '"') cursor += 1;
      cursor += 1;
      continue;
    }
    if (char === "!" || char === "+") {
      const close = char;
      cursor += 1;
      while (cursor < length && body[cursor] !== close && body[cursor] !== "\n") cursor += 1;
      cursor += 1;
      continue;
    }
    // Inline field such as [K:D] or [M:3/4]; [ also starts a chord or a "[|" bar.
    if (char === "[") {
      const inline = body.slice(cursor).match(INLINE_FIELD_RE);
      if (inline) {
        if (inline[1] === "K") {
          const inlineKey = parseKey(inline[2]);
          Object.assign(key.accidentals, inlineKey.accidentals);
        }
        cursor += inline[0].length;
        continue;
      }
      if (body[cursor + 1] === "|") {
        // "[|" is a bar line, not a chord.
        barAccidentals = {};
        cursor += 1;
        continue;
      }
      // Otherwise it's a chord [CEG]. abcjs draws it as one notehead group, so
      // to keep our note stream aligned with the engraving we collapse it to a
      // single note - the top (highest) pitch, the usual melody voice.
      cursor += 1;
      const before = notes.length;
      while (cursor < length && body[cursor] !== "]") {
        if (NOTE_START_RE.test(body[cursor])) readNote();
        else cursor += 1;
      }
      cursor += 1;
      if (notes.length > before + 1) {
        let top = notes[before];
        for (let chordIndex = before + 1; chordIndex < notes.length; chordIndex += 1) {
          if (notes[chordIndex].midi > top.midi) top = notes[chordIndex];
        }
        notes.length = before;
        notes.push(top);
      }
      continue;
    }
    // Bar lines and repeats reset bar-scoped accidentals. Consume the run of
    // bar/repeat glyphs plus any trailing volta number (|1, :|2).
    if (char === "|" || char === ":") {
      barAccidentals = {};
      cursor += 1;
      while (cursor < length && (body[cursor] === "|" || body[cursor] === ":" || body[cursor] === "]")) {
        cursor += 1;
      }
      while (cursor < length && DIGIT_RE.test(body[cursor])) cursor += 1;
      continue;
    }
    // Tuplet marker "(3", slur/tie punctuation, broken rhythm, ties.
    if (char === "(") {
      cursor += 1;
      while (cursor < length && TUPLET_ARG_RE.test(body[cursor])) cursor += 1;
      continue;
    }
    if (char === ")" || char === "-" || char === ">" || char === "<") {
      cursor += 1;
      continue;
    }
    // Rests carry no fingering.
    if (char === "z" || char === "x" || char === "Z" || char === "X") {
      cursor += 1;
      while (cursor < length && REST_DURATION_RE.test(body[cursor])) cursor += 1;
      continue;
    }
    if (char === "y" || char === "*" || char === "$") {
      cursor += 1;
      continue;
    }
    // Shorthand decorations attached to the following note (roll, staccato).
    if (char === "~" || char === ".") {
      cursor += 1;
      continue;
    }
    if (char === "^" || char === "_" || char === "=" || LETTER_RE.test(char)) {
      readNote();
      continue;
    }

    // Anything left is something the reader does not model.
    warnings.push({ token: char, code: "unknown-symbol", reason: "símbolo não reconhecido" });
    cursor += 1;
  }

  return {
    title: headers.T ?? "",
    key,
    meter: headers.M ?? "",
    unitLength: headers.L ?? "",
    notes,
    warnings,
  };
}
