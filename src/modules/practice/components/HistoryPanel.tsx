/**
 * Histórico de tentativas de uma música: lista cronológica com acurácia,
 * duração e melhor resultado destacado.
 */
import type { AttemptResult } from '../hooks/usePractice';
import { historyBarColor } from '../status';
import { useI18n, LANGS } from '../../../i18n/i18n';

const PERCENT_SCALE = 100;

interface HistoryPanelProps {
  attempts: AttemptResult[];
  onClear: () => void;
}

export function HistoryPanel({ attempts, onClear }: HistoryPanelProps) {
  const { translate, lang } = useI18n();
  const locale = LANGS.find((language) => language.code === lang)?.htmlLang ?? 'en';
  const formatDate = (iso: string): string =>
    new Date(iso).toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (attempts.length === 0) {
    return <p className="dim history-empty">{translate('practice.historyEmpty')}</p>;
  }
  const best = Math.max(...attempts.map((attempt) => attempt.accuracy));

  return (
    <div className="history">
      <div className="history-head">
        <span className="dim">
          {translate('practice.historyCount', { n: attempts.length, best: (best * 100).toFixed(0) })}
        </span>
        <button type="button" className="btn btn-sm" onClick={onClear}>
          {translate('practice.clear')}
        </button>
      </div>
      <ul className="history-list">
        {attempts.map((attempt) => {
          const accuracyPercent = attempt.accuracy * PERCENT_SCALE;
          const isBest = attempt.accuracy === best;
          return (
            <li key={attempt.date} className="history-item">
              <span className="history-date">{formatDate(attempt.date)}</span>
              <div className="history-bar">
                <div
                  className="history-bar-fill"
                  style={{
                    width: `${accuracyPercent}%`,
                    background: historyBarColor(accuracyPercent),
                  }}
                />
              </div>
              <span className="history-acc">
                {accuracyPercent.toFixed(0)}% {isBest && <span title={translate('practice.best')}>★</span>}
              </span>
              <span className="history-dur dim">{attempt.durationSec.toFixed(0)}s</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
