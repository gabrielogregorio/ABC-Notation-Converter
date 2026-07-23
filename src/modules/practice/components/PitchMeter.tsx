/**
 * Medidor de afinação: ponteiro de cents (-50..+50), seta de direção
 * (subir/abaixar), rótulo da nota detectada e cor por status.
 */
import type { PracticeFeedback, NoteStatus } from '../hooks/usePractice';
import { STATUS_COLOR } from '../status';
import { useTranslate } from '../../../i18n/i18n';

const STATUS_KEY: Record<NoteStatus, string> = {
  good: 'practice.status.good',
  close: 'practice.status.close',
  wrong: 'practice.status.wrong',
  idle: 'practice.status.idle',
};

// O ponteiro cobre -50..+50 cents mapeados em 0..100% da largura da barra.
const CENTS_METER_HALF_RANGE = 50;
const METER_MAX_PCT = 100;

interface PitchMeterProps {
  feedback: PracticeFeedback;
  targetLabel: string;
}

export function PitchMeter({ feedback, targetLabel }: PitchMeterProps) {
  const translate = useTranslate();
  const color = STATUS_COLOR[feedback.status];
  const needlePct = Math.max(
    0,
    Math.min(METER_MAX_PCT, feedback.cents + CENTS_METER_HALF_RANGE),
  );

  return (
    <div className="pitch-meter">
      <div className="pitch-meter-top">
        <div className="pitch-target">
          <span className="pitch-label-dim">{translate('practice.target')}</span>
          <strong>{targetLabel}</strong>
        </div>
        <div className="pitch-status" style={{ color }}>
          {feedback.direction && feedback.status !== 'good' && (
            <span className="pitch-arrow">{feedback.direction === 'up' ? '▲' : '▼'}</span>
          )}
          {translate(STATUS_KEY[feedback.status])}
        </div>
        <div className="pitch-detected">
          <span className="pitch-label-dim">{translate('practice.detected')}</span>
          <strong>{feedback.detectedLabel}</strong>
        </div>
      </div>

      <div className="pitch-bar">
        <div className="pitch-bar-center" />
        <div
          className="pitch-needle"
          style={{ left: `${needlePct}%`, background: color, boxShadow: `0 0 10px ${color}` }}
        />
      </div>
      <div className="pitch-scale">
        <span>{translate('practice.low')}</span>
        <span>{translate('practice.tuned')}</span>
        <span>{translate('practice.high')}</span>
      </div>
    </div>
  );
}
