/**
 * Diagrama de dedilhado do tin whistle para a nota alvo atual.
 * 6 furos verticais: cheio = fechado, vazado = aberto, meio = meia-abertura.
 */
import { fingeringForMidi, type HoleState } from '../music/fingerings';
import { holeFill, INACTIVE_HOLE_STROKE } from '../status';
import { useTranslate } from '../../../i18n/i18n';

const ALL_OPEN: HoleState[] = [0, 0, 0, 0, 0, 0];
const FIRST_HOLE_Y = 40;
const HOLE_SPACING_Y = 28;
const HOLE_RADIUS = 8;
const HOLE_CENTER_X = 24;

interface WhistleDiagramProps {
  midi: number | null;
  whistleKey: string;
  color: string;
  octaveAgnostic?: boolean;
}

export function WhistleDiagram({ midi, whistleKey, color, octaveAgnostic }: WhistleDiagramProps) {
  const translate = useTranslate();
  const fingering = midi != null ? fingeringForMidi(midi, whistleKey, octaveAgnostic) : null;
  return (
    <div className="whistle-diagram">
      <svg width={48} height={210} viewBox="0 0 48 210">
        {/* corpo */}
        <rect x={14} y={6} width={20} height={198} rx={10} className="whistle-body" />
        {/* bocal */}
        <rect x={10} y={2} width={28} height={14} rx={6} className="whistle-body" />
        {(fingering?.holes ?? ALL_OPEN).map((holeState, holeIndex) => (
          <circle
            key={holeIndex}
            cx={HOLE_CENTER_X}
            cy={FIRST_HOLE_Y + holeIndex * HOLE_SPACING_Y}
            r={HOLE_RADIUS}
            fill={holeFill(holeState, color)}
            stroke={fingering ? color : INACTIVE_HOLE_STROKE}
            strokeWidth={2}
          />
        ))}
      </svg>
      {fingering?.overblow && <span className="whistle-overblow" style={{ color }}>{translate('practice.overblow')}</span>}
      {!fingering && midi != null && <span className="whistle-na">{translate('practice.outOfRange')}</span>}
    </div>
  );
}
