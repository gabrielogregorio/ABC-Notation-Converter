/**
 * Pentagrama do Treino em clave de sol, com COMPASSO e QUEBRA DE LINHA.
 *
 * As notas são agrupadas em compassos (barras de compasso) e os compassos em
 * "linhas" (sistemas) que cabem na largura - sem rolagem horizontal. Mostra
 * duas linhas por vez; ao chegar perto do fim da 2ª, a próxima página abre à
 * esquerda pela metade e, quando a nota atual entra nela, expande e assume a
 * tela. Só CSS transitions animam isso (sem dependência de animação).
 *
 * As alturas são exibidas na oitava real (sem deslocamento), então melodias
 * graves aparecem embaixo, com linhas suplementares.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PreparedNote } from '../music/song';
import type { NoteStatus } from '../hooks/usePractice';
import { accidentalGlyph, diatonicIndex } from '../music/notes';
import { STATUS_COLOR } from '../status';
import { tempoMark, beatUnitGlyph } from '../music/tempo';
import {
  buildSystems,
  measureBeatsOf,
  measureNaturalWidth,
  noteSpacing,
  SYS_W,
  LEAD,
  RIGHT_PAD,
  type System,
} from '../music/layout';

const LINE_GAP = 12; // distância entre linhas do pentagrama
const HALF = LINE_GAP / 2; // um passo diatônico (linha↔espaço)
const STAFF_TOP = 44; // y da linha de cima (Fá5)
const BOTTOM_LINE_Y = STAFF_TOP + LINE_GAP * 4; // linha de baixo (Mi4)
const SYS_H = 138; // altura lógica do sistema (folga p/ andamento, suplementares e lírica)
const STAFF_LEFT = 12;
const E4_DIATONIC = diatonicIndex({ letter: 'E', octave: 4, accidental: 'natural', name: 'E4', midi: 64 });
const HEAD_RX = 6;
const HEAD_RY = 4.6;
const STEM_LEN = LINE_GAP * 3.2;
const SYS_PER_PAGE = 2;
const ANIM_MS = 460;
const SPLIT_AT = 0.7; // fração da linha de baixo já tocada antes de abrir o corte
const DEFAULT_TIME_SIGNATURE: [number, number] = [4, 4];
const STAFF_LINE_INDICES = [0, 1, 2, 3, 4];

// Cores próprias do pentagrama (não são a paleta de status): nota já tocada,
// nota por vir e o "buraco" da cabeça vazada (mesma cor da folha).
const PLAYED_NOTE_COLOR = '#2f7d63';
const UPCOMING_NOTE_COLOR = '#6b8a99';
const HOLLOW_HEAD_FILL = '#010f17';
const PLAYED_OPACITY = 0.85;
const UPCOMING_OPACITY = 0.5;
const CURRENT_OPACITY = 1;
const CURRENT_RING_RADIUS = 11;
const RING_STROKE_WIDTH = 2.5;
const RING_TRACK_OPACITY = 0.28;

interface NoteAppearance {
  color: string;
  opacity: number;
}

/** Cor e opacidade de uma nota conforme já passou, é a atual, ou está por vir. */
function noteAppearance(noteIndex: number, currentIndex: number, accent: string): NoteAppearance {
  if (noteIndex < currentIndex) return { color: PLAYED_NOTE_COLOR, opacity: PLAYED_OPACITY };
  if (noteIndex === currentIndex) return { color: accent, opacity: CURRENT_OPACITY };
  return { color: UPCOMING_NOTE_COLOR, opacity: UPCOMING_OPACITY };
}

/** clip-path da página de cima: escondida, meia tela, ou tela cheia. */
function overlayClipForPhase(phase: 'single' | 'split' | 'expand'): string {
  if (phase === 'expand') return 'inset(0 0 0 0)';
  if (phase === 'split') return 'inset(0 50% 0 0)';
  return 'inset(0 100% 0 0)';
}

interface StaffProps {
  notes: PreparedNote[];
  currentIndex: number;
  status: NoteStatus;
  direction: 'up' | 'down' | null;
  holdProgress: number;
  tempo?: number;
  timeSignature?: [number, number];
}

/** y do centro da cabeça da nota a partir do índice diatônico (oitava real). */
function noteY(dia: number): number {
  const step = dia - E4_DIATONIC;
  return BOTTOM_LINE_Y - step * HALF;
}

interface SystemProps {
  system: System;
  index: number; // índice global do sistema (0 = 1ª linha)
  currentIndex: number;
  status: NoteStatus;
  direction: 'up' | 'down' | null;
  holdProgress: number;
  tempo?: number;
  timeSignature?: [number, number];
}

/** Uma "linha" do pentagrama: clave, compasso, barras e notas justificadas. */
function SystemSvg({
  system,
  index,
  currentIndex,
  status,
  direction,
  holdProgress,
  tempo,
  timeSignature,
}: SystemProps) {
  const accent = STATUS_COLOR[status];
  const avail = SYS_W - LEAD - RIGHT_PAD;
  const natWidths = system.measures.map(measureNaturalWidth);
  const totalNat = natWidths.reduce((sum, width) => sum + width, 0) || 1;
  const scale = avail / totalNat;

  const placed: { laidNote: System['measures'][number]['notes'][number]; cx: number }[] = [];
  const bars: number[] = [];
  let cursorX = LEAD;
  system.measures.forEach((measure, measureIndex) => {
    let noteX = cursorX;
    measure.notes.forEach((laidNote) => {
      const spacing = noteSpacing(laidNote.note.beats) * scale;
      placed.push({ laidNote, cx: noteX + spacing / 2 });
      noteX += spacing;
    });
    cursorX += natWidths[measureIndex] * scale;
    bars.push(cursorX);
  });

  return (
    <svg viewBox={`0 0 ${SYS_W} ${SYS_H}`} width="100%" className="staff-system" preserveAspectRatio="xMidYMid meet">
      {/* 5 linhas */}
      {STAFF_LINE_INDICES.map((lineIndex) => (
        <line
          key={lineIndex}
          x1={STAFF_LEFT}
          x2={SYS_W - RIGHT_PAD}
          y1={STAFF_TOP + lineIndex * LINE_GAP}
          y2={STAFF_TOP + lineIndex * LINE_GAP}
          className="staff-line"
        />
      ))}

      {/* clave de sol */}
      <text x={STAFF_LEFT} y={BOTTOM_LINE_Y + 4} className="staff-clef">
        𝄞
      </text>

      {/* marcação de andamento - só na 1ª linha */}
      {index === 0 && tempo != null && (
        <text x={STAFF_LEFT} y={STAFF_TOP - 22} className="staff-tempo">
          {tempoMark(tempo)} {beatUnitGlyph((timeSignature ?? DEFAULT_TIME_SIGNATURE)[1])} = {Math.round(tempo)}
        </text>
      )}

      {/* fórmula de compasso - em toda linha, para a leitura nunca perder o compasso */}
      {timeSignature && (
        <>
          <text x={48} y={STAFF_TOP + LINE_GAP + 4} className="staff-timesig" textAnchor="middle">
            {timeSignature[0]}
          </text>
          <text x={48} y={STAFF_TOP + LINE_GAP * 3 + 4} className="staff-timesig" textAnchor="middle">
            {timeSignature[1]}
          </text>
        </>
      )}

      {/* barras de compasso */}
      {bars.map((barX, barIndex) => (
        <line key={`bar${barIndex}`} x1={barX} x2={barX} y1={STAFF_TOP} y2={BOTTOM_LINE_Y} className="staff-bar" />
      ))}

      {/* notas */}
      {placed.map(({ laidNote, cx }) => {
        const noteIndex = laidNote.index;
        const note = laidNote.note;
        const isCurrent = noteIndex === currentIndex;

        if (note.isRest) {
          return (
            <text key={noteIndex} x={cx - 5} y={STAFF_TOP + LINE_GAP * 2 + 5} className="staff-rest">
              𝄽
            </text>
          );
        }
        const parsed = note.parsed!;
        const dia = diatonicIndex(parsed);
        const cy = noteY(dia);
        const step = dia - E4_DIATONIC;

        const { color, opacity } = noteAppearance(noteIndex, currentIndex, accent);

        const ledgers: number[] = [];
        if (step < 0) for (let ledgerStep = -2; ledgerStep >= step; ledgerStep -= 2) ledgers.push(ledgerStep);
        if (step > 8) for (let ledgerStep = 10; ledgerStep <= step; ledgerStep += 2) ledgers.push(ledgerStep);

        const stemUp = step < 4;
        const stemX = stemUp ? cx + HEAD_RX - 0.4 : cx - HEAD_RX + 0.4;
        const stemY2 = stemUp ? cy - STEM_LEN : cy + STEM_LEN;
        const hollow = note.beats >= 2;

        return (
          <g key={noteIndex} opacity={opacity}>
            {ledgers.map((ledgerStep) => {
              const ledgerY = BOTTOM_LINE_Y - ledgerStep * HALF;
              return (
                <line key={ledgerStep} x1={cx - HEAD_RX - 4} x2={cx + HEAD_RX + 4} y1={ledgerY} y2={ledgerY} className="staff-line" />
              );
            })}

            {parsed.accidental !== 'natural' && (
              <text x={cx - HEAD_RX - 13} y={cy + 5} fill={color} className="staff-accidental">
                {accidentalGlyph(parsed.accidental)}
              </text>
            )}

            {note.beats < 4 && <line x1={stemX} x2={stemX} y1={cy} y2={stemY2} stroke={color} strokeWidth={1.4} />}

            <ellipse
              cx={cx}
              cy={cy}
              rx={HEAD_RX}
              ry={HEAD_RY}
              transform={`rotate(-12 ${cx} ${cy})`}
              fill={hollow ? HOLLOW_HEAD_FILL : color}
              stroke={color}
              strokeWidth={hollow ? 1.8 : 1}
            />

            {note.lyric && (
              <text x={cx} y={BOTTOM_LINE_Y + 30} className="staff-lyric" textAnchor="middle">
                {note.lyric}
              </text>
            )}

            {isCurrent && (
              <>
                <circle cx={cx} cy={cy} r={CURRENT_RING_RADIUS} fill="none" stroke={accent} strokeOpacity={RING_TRACK_OPACITY} strokeWidth={RING_STROKE_WIDTH} />
                <circle
                  cx={cx}
                  cy={cy}
                  r={CURRENT_RING_RADIUS}
                  fill="none"
                  stroke={accent}
                  strokeWidth={RING_STROKE_WIDTH}
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * CURRENT_RING_RADIUS}
                  strokeDashoffset={2 * Math.PI * CURRENT_RING_RADIUS * (1 - holdProgress)}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
                {direction && (
                  <text x={cx} y={STAFF_TOP - 6} textAnchor="middle" className="staff-arrow" fill={accent}>
                    {direction === 'up' ? '▲' : '▼'}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function Staff({ notes, currentIndex, status, direction, holdProgress, tempo, timeSignature }: StaffProps) {
  const measureBeats = measureBeatsOf(timeSignature);
  const { systems, sysOfNote, posOfNote } = useMemo(
    () => buildSystems(notes, measureBeats),
    [notes, measureBeats],
  );
  const nSystems = systems.length;
  const nPages = Math.max(1, Math.ceil(nSystems / SYS_PER_PAGE));

  const [page, setPage] = useState(0);
  const [phase, setPhase] = useState<'single' | 'split' | 'expand'>('single');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const curSys = currentIndex < 0 ? 0 : sysOfNote[currentIndex] ?? 0;

  // Segue a nota atual: abre a próxima página (split) perto do fim e expande
  // quando entramos nela.
  useEffect(() => {
    clearTimeout(timer.current);
    const targetPage = Math.floor(curSys / SYS_PER_PAGE);
    if (targetPage === page) {
      const secondSys = page * SYS_PER_PAGE + (SYS_PER_PAGE - 1);
      const hasNext = page + 1 < nPages;
      const nearEnd = curSys === secondSys && (posOfNote[currentIndex] ?? 0) >= SPLIT_AT;
      setPhase(hasNext && nearEnd ? 'split' : 'single');
    } else if (targetPage === page + 1 && page + 1 < nPages) {
      setPhase('expand');
      timer.current = setTimeout(() => {
        setPage(page + 1);
        setPhase('single');
      }, ANIM_MS);
    } else {
      setPage(targetPage);
      setPhase('single');
    }
    return () => clearTimeout(timer.current);
  }, [curSys, currentIndex, page, nPages, posOfNote]);

  // Nova música com menos páginas: volta ao início. É um ajuste de estado ao
  // mudar o número de páginas, então roda na renderização (não num efeito).
  if (page > nPages - 1) {
    setPage(0);
    setPhase('single');
  }

  const pageSystems = (pageIndex: number) =>
    systems.slice(pageIndex * SYS_PER_PAGE, pageIndex * SYS_PER_PAGE + SYS_PER_PAGE);
  const hasNext = page + 1 < nPages;
  // Split screen por MÁSCARA: as páginas ficam em tamanho real; a próxima fica
  // por cima (z-index maior) e é revelada por um clip-path que cresce da
  // esquerda - escondida → metade da tela → tela cheia. Nada encolhe.
  const overlayClip = overlayClipForPhase(phase);

  const shared = { currentIndex, status, direction, holdProgress, tempo, timeSignature };

  return (
    <div className="staff-frame">
      <div className="staff-book">
        <div key="cur" className="staff-page">
          {pageSystems(page).map((system, slot) => (
            <SystemSvg key={page * SYS_PER_PAGE + slot} system={system} index={page * SYS_PER_PAGE + slot} {...shared} />
          ))}
        </div>
        {hasNext && (
          // key por página: no commit essa overlay DESMONTA (não re-anima);
          // a nova (próxima página) monta já escondida. A 3,4 fica posta pela
          // página atual, sem "rerodar" do zero.
          <div key={`ovl-${page + 1}`} className="staff-page overlay" style={{ clipPath: overlayClip }} aria-hidden>
            {pageSystems(page + 1).map((system, slot) => (
              <SystemSvg key={(page + 1) * SYS_PER_PAGE + slot} system={system} index={(page + 1) * SYS_PER_PAGE + slot} {...shared} />
            ))}
          </div>
        )}
        {/* linha divisória: só existe durante o corte; some no commit */}
        {hasNext && phase !== 'single' && (
          <div className="staff-seam" style={{ left: phase === 'expand' ? '100%' : '50%' }} aria-hidden />
        )}
      </div>
    </div>
  );
}
