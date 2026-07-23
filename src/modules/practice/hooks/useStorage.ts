/**
 * Persistência local: biblioteca de músicas do usuário + histórico de
 * tentativas por música. Tudo em localStorage (app 100% client-side).
 */
import { useCallback, useState } from 'react';
import type { SongJSON } from '../music/song';
import type { AttemptResult } from './usePractice';
import { DEFAULT_SONGS } from '../music/defaultSongs';

const SONGS_KEY = 'perfect-partituras.songs';
const HISTORY_KEY = 'perfect-partituras.history';
const MAX_ATTEMPTS_PER_SONG = 50;

function load<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota/privacidade - ignora */
  }
}

/** Biblioteca: músicas padrão (sempre presentes) + músicas do usuário. */
export function useLibrary() {
  const [userSongs, setUserSongs] = useState<SongJSON[]>(() => load(SONGS_KEY, []));

  // Persiste no próprio evento que muda a biblioteca (Rule 3 da skill): calcula o
  // próximo estado uma vez, salva e seta - sem efeito reagindo a `userSongs`.
  const commitSongs = useCallback((next: SongJSON[]) => {
    save(SONGS_KEY, next);
    setUserSongs(next);
  }, []);

  const upsertSong = useCallback(
    (song: SongJSON) => {
      const existingIndex = userSongs.findIndex((existing) => existing.id === song.id);
      const next =
        existingIndex >= 0
          ? userSongs.map((existing, index) => (index === existingIndex ? song : existing))
          : [...userSongs, song];
      commitSongs(next);
    },
    [userSongs, commitSongs],
  );

  const removeSong = useCallback(
    (id: string) => {
      commitSongs(userSongs.filter((song) => song.id !== id));
    },
    [userSongs, commitSongs],
  );

  // Padrões primeiro; músicas do usuário com mesmo id sobrescrevem.
  const allSongs: SongJSON[] = [
    ...DEFAULT_SONGS.filter(
      (defaultSong) => !userSongs.some((userSong) => userSong.id === defaultSong.id),
    ),
    ...userSongs,
  ];

  const isUserSong = useCallback(
    (id: string) => userSongs.some((song) => song.id === id),
    [userSongs],
  );

  return { allSongs, userSongs, upsertSong, removeSong, isUserSong };
}

export type HistoryMap = Record<string, AttemptResult[]>;

/** Histórico de tentativas, indexado por songId. */
export function useHistory() {
  const [history, setHistory] = useState<HistoryMap>(() => load(HISTORY_KEY, {}));

  const commitHistory = useCallback((next: HistoryMap) => {
    save(HISTORY_KEY, next);
    setHistory(next);
  }, []);

  const addAttempt = useCallback(
    (result: AttemptResult) => {
      const list = history[result.songId] ?? [];
      const nextList = [result, ...list].slice(0, MAX_ATTEMPTS_PER_SONG);
      commitHistory({ ...history, [result.songId]: nextList });
    },
    [history, commitHistory],
  );

  const clearSong = useCallback(
    (songId: string) => {
      const next = { ...history };
      delete next[songId];
      commitHistory(next);
    },
    [history, commitHistory],
  );

  return { history, addAttempt, clearSong };
}
