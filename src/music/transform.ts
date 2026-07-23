// Text-level ABC transforms behind the converter's "deixar a música mais calma"
// controls. Both rewrite the raw ABC so abcjs and our own parser see the same
// tune:
//
//   adjustDurations  - add a whole number of unit-lengths to every melody note
//                      and rest, so an eighth (one unit in L:1/8) at +1 becomes
//                      a quarter. Longer, more even notes = a calmer tune.
//   removeSlurs      - strip slurs and ties ("ligados"), leaving tuplet markers
//                      like "(3" intact.
//
// Headers, in-body information fields (w:, K:, ...), comments, chord symbols
// ("..."), decorations (!..!, +..+), grace notes ({..}) and inline fields
// ([K:...]) are copied verbatim in both.

const FIELD_RE = /^[A-Za-z]:/;
// Inline information field such as [K:G] or [M:3/4]; compiled once at module scope.
const INLINE_FIELD_RE = /^\[[A-Za-z]:[^\]]*\]/;

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

// Format a rational note-length (relative to the unit length L:) back into ABC
// duration syntax: 1 -> "", 2 -> "2", 1/2 -> "/2", 3/2 -> "3/2".
function formatDuration(num: number, den: number): string {
  const commonDivisor = gcd(num, den);
  num /= commonDivisor;
  den /= commonDivisor;
  if (den === 1) return num === 1 ? "" : String(num);
  if (num === 1) return `/${den}`;
  return `${num}/${den}`;
}

// Read an ABC duration starting at index i (right after a note/rest and its
// octave marks). Returns the numerator/denominator and the index just past it.
function readDuration(source: string, index: number): { num: number; den: number; end: number } {
  let num = 0;
  let hasNum = false;
  while (index < source.length && source[index] >= "0" && source[index] <= "9") {
    num = num * 10 + Number(source[index]);
    hasNum = true;
    index += 1;
  }
  if (!hasNum) num = 1;

  let den = 1;
  while (index < source.length && source[index] === "/") {
    index += 1;
    if (index < source.length && source[index] >= "0" && source[index] <= "9") {
      let denDigits = 0;
      while (index < source.length && source[index] >= "0" && source[index] <= "9") {
        denDigits = denDigits * 10 + Number(source[index]);
        index += 1;
      }
      den *= denDigits || 1;
      break; // a written denominator ends the duration
    }
    den *= 2; // a bare "/" halves; "//" quarters
  }
  return { num, den, end: index };
}

// Apply `delta` unit-lengths to a duration, clamped to a positive minimum so a
// negative delta can never zero out (or invert) a note.
function shiftDuration(num: number, den: number, delta: number): string {
  let nnum = num + delta * den;
  let nden = den;
  if (nnum <= 0) {
    nnum = 1;
    nden = 2; // floor at half a unit
  }
  return formatDuration(nnum, nden);
}

// Walk the tune body line by line, transforming only real music lines; header
// lines (before and inside the body) and blank lines pass through untouched.
function mapBody(abc: string, transformLine: (line: string) => string): string {
  const lines = abc.split(/\r?\n/);
  let inBody = false;
  const out = lines.map((line) => {
    if (!inBody) {
      if (FIELD_RE.test(line)) {
        if (line[0] === "K") inBody = true; // K: is the last header
        return line;
      }
      if (line.trim() === "") return line;
      inBody = true; // a stray non-header line starts the body
    }
    return transformLine(line);
  });
  return out.join("\n");
}

export function adjustDurations(abc: string, delta: number): string {
  if (!delta) return abc;
  return mapBody(abc, (line) => adjustDurationsLine(line, delta));
}

function adjustDurationsLine(line: string, delta: number): string {
  // In-body information fields (w:, K:, M:, ...) and comments are not music.
  if (FIELD_RE.test(line) || line.startsWith("%")) return line;

  let out = "";
  let index = 0;
  const length = line.length;

  while (index < length) {
    const char = line[index];

    if (char === "%") {
      out += line.slice(index);
      break;
    }
    // Chord symbols / annotations, decorations, grace notes: copy verbatim.
    if (char === '"' || char === "!" || char === "+" || char === "{") {
      const closeChar = char === "{" ? "}" : char;
      const closeIndex = line.indexOf(closeChar, index + 1);
      const end = closeIndex === -1 ? length : closeIndex + 1;
      out += line.slice(index, end);
      index = end;
      continue;
    }
    if (char === "[") {
      const field = line.slice(index).match(INLINE_FIELD_RE);
      if (field) {
        out += field[0];
        index += field[0].length;
        continue;
      }
      if (line[index + 1] === "|") {
        out += "[|"; // "[|" is a bar line, not a chord
        index += 2;
        continue;
      }
      // A chord [CEG]: keep its inner notes as written, then stretch the one
      // duration that applies to the whole chord (after the closing bracket).
      const closeIndex = line.indexOf("]", index + 1);
      if (closeIndex !== -1) {
        out += line.slice(index, closeIndex + 1);
        index = closeIndex + 1;
        const duration = readDuration(line, index);
        out += shiftDuration(duration.num, duration.den, delta);
        index = duration.end;
        continue;
      }
    }
    // Melody note (A-G / a-g) with its octave marks, or a unit rest (z/x).
    const isNote = (char >= "A" && char <= "G") || (char >= "a" && char <= "g");
    const isRest = char === "z" || char === "x";
    if (isNote || isRest) {
      out += char;
      index += 1;
      if (isNote) {
        while (index < length && (line[index] === "'" || line[index] === ",")) {
          out += line[index];
          index += 1;
        }
      }
      const duration = readDuration(line, index);
      out += shiftDuration(duration.num, duration.den, delta);
      index = duration.end;
      continue;
    }

    out += char;
    index += 1;
  }
  return out;
}

export function removeSlurs(abc: string): string {
  return mapBody(abc, removeSlursLine);
}

function removeSlursLine(line: string): string {
  if (FIELD_RE.test(line) || line.startsWith("%")) return line;

  let out = "";
  let index = 0;
  const length = line.length;

  while (index < length) {
    const char = line[index];

    if (char === "%") {
      out += line.slice(index);
      break;
    }
    if (char === '"' || char === "!" || char === "+" || char === "{") {
      const closeChar = char === "{" ? "}" : char;
      const closeIndex = line.indexOf(closeChar, index + 1);
      const end = closeIndex === -1 ? length : closeIndex + 1;
      out += line.slice(index, end);
      index = end;
      continue;
    }
    if (char === "[") {
      const field = line.slice(index).match(INLINE_FIELD_RE);
      if (field) {
        out += field[0];
        index += field[0].length;
        continue;
      }
    }
    // "(3", "(3:2:2" etc. are tuplets, not slurs - keep the "(".
    if (char === "(" && line[index + 1] >= "0" && line[index + 1] <= "9") {
      out += char;
      index += 1;
      continue;
    }
    // Slur open/close and ties are dropped.
    if (char === "(" || char === ")" || char === "-") {
      index += 1;
      continue;
    }

    out += char;
    index += 1;
  }
  return out;
}
