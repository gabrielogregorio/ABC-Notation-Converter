/**
 * Formato JSON de uma música. É o contrato central do app: tudo (partitura,
 * sequência de prática, dedilhados) é derivado daqui.
 */
import { parseNote, type ParsedNote } from './notes';

export interface SongNoteJSON {
  /** Notação científica: "D4", "Bb4", "F#5". Use "rest" para pausa. */
  note: string;
  /** Duração em tempos (semínima = 1, colcheia = 0.5, mínima = 2...). */
  beats: number;
  /** Letra/sílaba opcional para exibir sob a nota. */
  lyric?: string;
}

export interface SongJSON {
  id: string;
  title: string;
  /** Instrumento alvo. Foco atual: "tin-whistle". */
  instrument: string;
  /** Afinação do whistle (D, C, G, Bb...). Define os dedilhados exibidos. */
  whistleKey?: string;
  /** Andamento em BPM. */
  tempo: number;
  /** Fórmula de compasso [numerador, denominador]. */
  timeSignature?: [number, number];
  /** Tolerância de afinação padrão, em cents. 0 = quase perfeito. */
  toleranceCents?: number;
  notes: SongNoteJSON[];
}

export interface PreparedNote {
  index: number;
  isRest: boolean;
  /** Nota parseada (null se pausa). */
  parsed: ParsedNote | null;
  beats: number;
  lyric?: string;
  /** Tempo (segundos) que a nota deve durar no andamento da música. */
  durationSec: number;
}

export interface PreparedSong {
  json: SongJSON;
  notes: PreparedNote[];
  /** Notas tocáveis (sem pausas) - o que a prática percorre. */
  playableCount: number;
}

/** Valida e prepara uma música a partir do JSON, derivando MIDI e durações. */
export function prepareSong(json: SongJSON): PreparedSong {
  if (!json || !Array.isArray(json.notes) || json.notes.length === 0) {
    throw new Error('Música precisa de um array "notes" não vazio.');
  }
  const secPerBeat = 60 / (json.tempo || 100);
  let playable = 0;
  const notes: PreparedNote[] = json.notes.map((n, index) => {
    const isRest = !n.note || n.note.toLowerCase() === 'rest';
    if (!isRest) playable += 1;
    return {
      index,
      isRest,
      parsed: isRest ? null : parseNote(n.note),
      beats: n.beats ?? 1,
      lyric: n.lyric,
      durationSec: (n.beats ?? 1) * secPerBeat,
    };
  });
  return { json, notes, playableCount: playable };
}

/** Valida um JSON cru vindo do editor; retorna a música ou uma mensagem de erro. */
export function validateSongJSON(raw: string): { song?: SongJSON; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { error: `JSON inválido: ${(e as Error).message}` };
  }
  const s = parsed as SongJSON;
  if (!s.id || !s.title) return { error: 'Campos "id" e "title" são obrigatórios.' };
  if (!s.tempo) return { error: 'Campo "tempo" (BPM) é obrigatório.' };
  try {
    prepareSong(s); // exercita o parsing de todas as notas
  } catch (e) {
    return { error: (e as Error).message };
  }
  return { song: s };
}
