import { describe, it, expect } from 'vitest';
import { clickSpec, accentAt, defaultAccent, cycleAccent, type AccentLevel } from './clicks.ts';
import type { Pulse } from './scheduler.ts';

function pulse(over: Partial<Pulse>): Pulse {
  return {
    index: 0,
    beatIndex: 0,
    beatInBar: 0,
    subIndex: 0,
    isBeat: true,
    isDownbeat: false,
    time: 0,
    ...over,
  };
}

describe('defaultAccent / accentAt', () => {
  it('1º tempo acentua por padrão', () => {
    expect(defaultAccent(0)).toBe('accent');
    expect(defaultAccent(1)).toBe('normal');
  });
  it('override do usuário tem precedência', () => {
    const acc: AccentLevel[] = ['normal', 'accent'];
    expect(accentAt(acc, 0)).toBe('normal');
    expect(accentAt(acc, 1)).toBe('accent');
    expect(accentAt(acc, 5)).toBe('normal'); // fora do array => default
  });
});

describe('cycleAccent', () => {
  it('cicla acento → normal → mudo → acento', () => {
    expect(cycleAccent('accent')).toBe('normal');
    expect(cycleAccent('normal')).toBe('muted');
    expect(cycleAccent('muted')).toBe('accent');
  });
});

describe('clickSpec', () => {
  it('downbeat acentuado é mais agudo e mais alto', () => {
    const spec = clickSpec(pulse({ beatInBar: 0, isBeat: true }), []);
    expect(spec.silent).toBe(false);
    expect(spec.frequency).toBe(1000);
    expect(spec.gain).toBe(1.0);
  });
  it('batida normal é mais grave/baixa que o acento', () => {
    const spec = clickSpec(pulse({ beatInBar: 1, isBeat: true }), []);
    expect(spec.frequency).toBe(500);
    expect(spec.gain).toBeLessThan(1.0);
  });
  it('subdivisão é ainda mais grave e baixa', () => {
    const spec = clickSpec(pulse({ beatInBar: 0, isBeat: false, subIndex: 1 }), []);
    expect(spec.frequency).toBe(280);
    expect(spec.gain).toBeLessThan(0.5);
  });
  it('tempo mudo silencia batida e subdivisões', () => {
    const acc: AccentLevel[] = ['muted'];
    expect(clickSpec(pulse({ beatInBar: 0, isBeat: true }), acc).silent).toBe(true);
    expect(clickSpec(pulse({ beatInBar: 0, isBeat: false, subIndex: 1 }), acc).silent).toBe(true);
  });
});
