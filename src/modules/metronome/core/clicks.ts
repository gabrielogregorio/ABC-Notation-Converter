/**
 * Especificação sonora de cada pulso - pura e testável (sem Web Audio).
 *
 * Hierarquia de frequências:
 * downbeat ~880–1000 Hz, batida ~440–600 Hz, subdivisão ~220–300 Hz com ganho
 * menor. Altura + volume fazem o ouvido "ler" o compasso. O acento é editável
 * por batida (acento/normal/mudo), o que também serve de gap-trainer.
 */
import type { Pulse } from './scheduler.ts';

export type AccentLevel = 'muted' | 'normal' | 'accent';

const DOWNBEAT_HZ = 1000;
const BEAT_HZ = 500;
const SUBDIV_HZ = 280;

/** Acento padrão: 1º tempo acentuado, demais normais. */
export function defaultAccent(beatInBar: number): AccentLevel {
  return beatInBar === 0 ? 'accent' : 'normal';
}

/** Acento efetivo de um tempo, considerando overrides do usuário. */
export function accentAt(accents: AccentLevel[], beatInBar: number): AccentLevel {
  return accents[beatInBar] ?? defaultAccent(beatInBar);
}

export interface ClickSpec {
  silent: boolean;
  frequency: number;
  /** Ganho relativo (0..1), antes do volume global. */
  gain: number;
}

const SILENT: ClickSpec = { silent: true, frequency: 0, gain: 0 };

/** Traduz um pulso + configuração de acentos no som a tocar. */
export function clickSpec(pulse: Pulse, accents: AccentLevel[]): ClickSpec {
  const level = accentAt(accents, pulse.beatInBar);
  if (level === 'muted') return SILENT; // tempo mudo: também silencia subdivisões
  if (!pulse.isBeat) {
    return { silent: false, frequency: SUBDIV_HZ, gain: 0.32 };
  }
  if (level === 'accent') {
    return { silent: false, frequency: DOWNBEAT_HZ, gain: 1.0 };
  }
  return { silent: false, frequency: BEAT_HZ, gain: 0.68 };
}

/** Cicla o nível de acento ao clicar num tempo: acento → normal → mudo → acento. */
export function cycleAccent(level: AccentLevel): AccentLevel {
  switch (level) {
    case 'accent':
      return 'normal';
    case 'normal':
      return 'muted';
    default:
      return 'accent';
  }
}
