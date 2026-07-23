import type { SongJSON } from './song';

/** Músicas que acompanham o app. Servem de exemplo do formato JSON. */
export const DEFAULT_SONGS: SongJSON[] = [
  {
    id: 'escala-re-maior',
    title: 'Escala de Ré maior (aquecimento)',
    instrument: 'tin-whistle',
    whistleKey: 'D',
    tempo: 80,
    timeSignature: [4, 4],
    toleranceCents: 35,
    notes: [
      { note: 'D5', beats: 1, lyric: 'Dó' },
      { note: 'E5', beats: 1 },
      { note: 'F#5', beats: 1 },
      { note: 'G5', beats: 1 },
      { note: 'A5', beats: 1 },
      { note: 'B5', beats: 1 },
      { note: 'C#6', beats: 1 },
      { note: 'D6', beats: 2 },
    ],
  },
  {
    id: 'twinkle-twinkle',
    title: 'Brilha Brilha Estrelinha',
    instrument: 'tin-whistle',
    whistleKey: 'D',
    tempo: 96,
    timeSignature: [4, 4],
    toleranceCents: 30,
    notes: [
      { note: 'D5', beats: 1, lyric: 'Bri' },
      { note: 'D5', beats: 1, lyric: 'lha' },
      { note: 'A5', beats: 1, lyric: 'bri' },
      { note: 'A5', beats: 1, lyric: 'lha' },
      { note: 'B5', beats: 1, lyric: 'es' },
      { note: 'B5', beats: 1, lyric: 'tre' },
      { note: 'A5', beats: 2, lyric: 'la' },
      { note: 'G5', beats: 1, lyric: 'co' },
      { note: 'G5', beats: 1, lyric: 'mo' },
      { note: 'F#5', beats: 1, lyric: 'eu' },
      { note: 'F#5', beats: 1, lyric: 'que' },
      { note: 'E5', beats: 1, lyric: 'ro' },
      { note: 'E5', beats: 1, lyric: 'sa' },
      { note: 'D5', beats: 2, lyric: 'ber' },
    ],
  },
  {
    id: 'asabranca-trecho',
    title: 'Asa Branca (trecho)',
    instrument: 'tin-whistle',
    whistleKey: 'D',
    tempo: 88,
    timeSignature: [4, 4],
    toleranceCents: 30,
    notes: [
      { note: 'D5', beats: 0.5 },
      { note: 'F#5', beats: 0.5 },
      { note: 'A5', beats: 1 },
      { note: 'A5', beats: 1 },
      { note: 'B5', beats: 1 },
      { note: 'A5', beats: 1 },
      { note: 'F#5', beats: 1 },
      { note: 'rest', beats: 1 },
      { note: 'D5', beats: 0.5 },
      { note: 'F#5', beats: 0.5 },
      { note: 'A5', beats: 1 },
      { note: 'A5', beats: 1 },
      { note: 'G5', beats: 1 },
      { note: 'F#5', beats: 1 },
      { note: 'E5', beats: 2 },
    ],
  },
  {
    // Transcrição fiel da partitura (Luiz Gonzaga), 16 compassos em Dó maior,
    // 2/4, ♩=80, na oitava exata do papel (Dó3=C4). Cifras: C/F/G.
    id: 'asa-branca-completa',
    title: 'Asa Branca (completa)',
    instrument: 'tin-whistle',
    whistleKey: 'C',
    tempo: 80,
    timeSignature: [2, 4],
    toleranceCents: 30,
    notes: [
      // 1
      { note: 'rest', beats: 0.5 },
      { note: 'C4', beats: 0.5 },
      { note: 'C4', beats: 0.5 },
      { note: 'D4', beats: 0.5 },
      // 2 (C)
      { note: 'E4', beats: 1 },
      { note: 'G4', beats: 1 },
      // 3
      { note: 'G4', beats: 1 },
      { note: 'E4', beats: 1 },
      // 4 (F)
      { note: 'F4', beats: 2 },
      // 5
      { note: 'rest', beats: 0.5 },
      { note: 'C4', beats: 0.5 },
      { note: 'C4', beats: 0.5 },
      { note: 'D4', beats: 0.5 },
      // 6 (C)
      { note: 'E4', beats: 1 },
      { note: 'G4', beats: 1 },
      // 7 (G)
      { note: 'G4', beats: 1 },
      { note: 'F4', beats: 1 },
      // 8 (C)
      { note: 'E4', beats: 2 },
      // 9
      { note: 'rest', beats: 0.5 },
      { note: 'C4', beats: 0.5 },
      { note: 'C4', beats: 0.5 },
      { note: 'D4', beats: 0.5 },
      // 10 (C)
      { note: 'E4', beats: 1 },
      { note: 'G4', beats: 1 },
      // 11
      { note: 'rest', beats: 0.5 },
      { note: 'G4', beats: 0.5 },
      { note: 'F4', beats: 0.5 },
      { note: 'E4', beats: 0.5 },
      // 12 (F)
      { note: 'C4', beats: 1 },
      { note: 'F4', beats: 1 },
      // 13
      { note: 'rest', beats: 0.5 },
      { note: 'F4', beats: 0.5 },
      { note: 'E4', beats: 0.5 },
      { note: 'D4', beats: 0.5 },
      // 14 (G)
      { note: 'D4', beats: 1 },
      { note: 'E4', beats: 1 },
      // 15
      { note: 'rest', beats: 0.5 },
      { note: 'D4', beats: 0.5 },
      { note: 'D4', beats: 0.5 },
      { note: 'C4', beats: 0.5 },
      // 16 (C) - Dó final ligado (ligadura) = uma semínima, + pausa de semínima
      { note: 'C4', beats: 1 },
      { note: 'rest', beats: 1 },
    ],
  },
  {
    // Imagine (John Lennon), nível fácil: o verso de abertura em Dó maior,
    // 4/4, ♩=76 (Andante). Registro grave (Mi4–Si4) para ler embaixo do
    // pentagrama; só notas naturais - sem acidentes.
    id: 'imagine',
    title: 'Imagine (fácil)',
    instrument: 'tin-whistle',
    whistleKey: 'C',
    tempo: 76,
    timeSignature: [4, 4],
    toleranceCents: 30,
    notes: [
      // "Imagine there's no heaven"
      { note: 'E4', beats: 0.5 },
      { note: 'G4', beats: 0.5 },
      { note: 'E4', beats: 0.5 },
      { note: 'G4', beats: 0.5 },
      { note: 'B4', beats: 1 },
      { note: 'B4', beats: 1 },
      { note: 'A4', beats: 2 },
      { note: 'rest', beats: 2 },
      // "It's easy if you try"
      { note: 'E4', beats: 0.5 },
      { note: 'G4', beats: 0.5 },
      { note: 'E4', beats: 0.5 },
      { note: 'G4', beats: 0.5 },
      { note: 'B4', beats: 1 },
      { note: 'B4', beats: 1 },
      { note: 'A4', beats: 2 },
      { note: 'rest', beats: 2 },
    ],
  },
];
