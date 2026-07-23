/**
 * Andamento (marcação de tempo) da música: o termo italiano derivado do BPM,
 * o glifo da nota que vale um tempo (a partir do denominador do compasso) e a
 * "linha de andamento" estilo partitura - "Andante · ♩ = 80 · 2/4".
 *
 * Tudo puro: a UI só formata. É o núcleo testável da feature (edge cases de
 * BPM inválido, limites de faixa e denominadores estranhos ficam aqui).
 */

/**
 * Termo italiano de andamento para um BPM. Faixas com o limite superior
 * exclusivo (ex.: 108 já é Moderato, 76 é o primeiro Andante). BPM não
 * finito ou ≤ 0 devolve "-" (andamento indefinido) em vez de quebrar.
 */
export function tempoMark(bpm: number): string {
  if (!Number.isFinite(bpm) || bpm <= 0) return '-';
  if (bpm < 40) return 'Grave';
  if (bpm < 60) return 'Largo';
  if (bpm < 66) return 'Larghetto';
  if (bpm < 76) return 'Adagio';
  if (bpm < 108) return 'Andante';
  if (bpm < 120) return 'Moderato';
  if (bpm < 168) return 'Allegro';
  if (bpm < 200) return 'Presto';
  return 'Prestissimo';
}

// Nota que vale um tempo, por denominador do compasso.
const BEAT_GLYPH: Record<number, string> = {
  1: '\u{1D15D}', // 𝅝 semibreve
  2: '\u{1D15E}', // 𝅗𝅥 mínima
  4: '♩', // ♩ semínima
  8: '♪', // ♪ colcheia
  16: '\u{1D161}', // 𝅘𝅥𝅯 semicolcheia
};

/** Glifo da unidade de tempo a partir do denominador do compasso (fallback ♩). */
export function beatUnitGlyph(denominator: number): string {
  return BEAT_GLYPH[denominator] ?? '♩';
}

/**
 * Linha de andamento pronta para exibir: "Andante · ♩ = 80 · 2/4".
 * Sem compasso, assume 4/4. Com BPM inválido, omite o "= n" e mostra só o
 * pulso e o compasso.
 */
export function tempoLine(tempo: number, timeSignature?: [number, number]): string {
  const [num, den] = timeSignature ?? [4, 4];
  const bpm = Number.isFinite(tempo) && tempo > 0 ? Math.round(tempo) : null;
  const pulse = bpm ? `${beatUnitGlyph(den)} = ${bpm}` : beatUnitGlyph(den);
  return `${tempoMark(tempo)} · ${pulse} · ${num}/${den}`;
}
