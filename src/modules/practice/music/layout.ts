/**
 * Layout do pentagrama: agrupa as notas em COMPASSOS (pelo compasso da música)
 * e empacota os compassos em LINHAS (sistemas) que cabem numa largura fixa -
 * é o que troca o "explodir horizontal" por quebra de linha. Tudo puro e
 * testável; a geometria vertical (alturas, hastes) fica no componente Staff.
 */
import type { PreparedNote } from './song';

// Unidades lógicas do viewBox de um sistema.
export const SYS_W = 680;
export const LEAD = 74; // espaço da clave + fórmula de compasso antes da 1ª nota
export const RIGHT_PAD = 16;

export interface LNote {
  note: PreparedNote;
  /** índice original na sequência (para casar com currentIndex). */
  index: number;
}
export interface Measure {
  notes: LNote[];
  beats: number;
}
export interface System {
  measures: Measure[];
}
export interface LayoutResult {
  systems: System[];
  /** índice da nota → índice do sistema onde ela está. */
  sysOfNote: number[];
  /** índice da nota → posição relativa (0..1) dentro do sistema. */
  posOfNote: number[];
}

/** Espaçamento horizontal "natural" de uma nota conforme sua duração. */
export function noteSpacing(beats: number): number {
  return 30 + Math.min(46, beats * 20);
}

/** Largura "natural" de um compasso (soma dos espaçamentos + folga). */
export function measureNaturalWidth(m: Measure): number {
  return m.notes.reduce((a, n) => a + noteSpacing(n.note.beats), 0) + 22;
}

/** Tempos por compasso a partir da fórmula (semínima = 1). 2/4 → 2, 6/8 → 3. */
export function measureBeatsOf(timeSignature?: [number, number]): number {
  if (!timeSignature) return 4;
  const [num, den] = timeSignature;
  if (!num || !den) return 4;
  return (num * 4) / den;
}

/**
 * Divide as notas em compassos (fecha antes de estourar o compasso) e
 * empacota os compassos em sistemas que cabem em SYS_W.
 */
export function buildSystems(notes: PreparedNote[], measureBeats: number): LayoutResult {
  const measures: Measure[] = [];
  let cur: Measure = { notes: [], beats: 0 };
  const cap = measureBeats > 0 ? measureBeats : 4;
  for (let i = 0; i < notes.length; i += 1) {
    const n = notes[i];
    if (cur.notes.length && cur.beats + n.beats > cap + 1e-6) {
      measures.push(cur);
      cur = { notes: [], beats: 0 };
    }
    cur.notes.push({ note: n, index: i });
    cur.beats += n.beats;
  }
  if (cur.notes.length) measures.push(cur);

  const systems: System[] = [];
  let sys: Measure[] = [];
  let w = 0;
  const avail = SYS_W - LEAD - RIGHT_PAD;
  for (const m of measures) {
    const mw = measureNaturalWidth(m);
    if (sys.length && w + mw > avail) {
      systems.push({ measures: sys });
      sys = [];
      w = 0;
    }
    sys.push(m);
    w += mw;
  }
  if (sys.length) systems.push({ measures: sys });

  const sysOfNote: number[] = [];
  const posOfNote: number[] = [];
  systems.forEach((s, si) => {
    const flat = s.measures.flatMap((m) => m.notes);
    flat.forEach((ln, k) => {
      sysOfNote[ln.index] = si;
      posOfNote[ln.index] = flat.length > 1 ? k / (flat.length - 1) : 0;
    });
  });

  return { systems, sysOfNote, posOfNote };
}
