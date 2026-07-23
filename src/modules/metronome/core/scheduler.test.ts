import { describe, it, expect } from 'vitest';
import {
  clampBpm,
  clampBeatsPerBar,
  clampSubdivisions,
  clampSwing,
  secondsPerBeat,
  pulseDuration,
  beatInBar,
  isDownbeat,
  Sequencer,
  MIN_BPM,
  MAX_BPM,
  MIN_BEATS,
  MAX_BEATS,
} from './scheduler.ts';

describe('clampBpm', () => {
  it('mantém valores no intervalo', () => {
    expect(clampBpm(120)).toBe(120);
  });
  it('limita abaixo e acima (até 400)', () => {
    expect(clampBpm(0)).toBe(MIN_BPM);
    expect(clampBpm(9999)).toBe(MAX_BPM);
    expect(MAX_BPM).toBe(400);
  });
  it('arredonda e trata não-finito', () => {
    expect(clampBpm(120.7)).toBe(121);
    expect(clampBpm(NaN)).toBe(MIN_BPM);
    expect(clampBpm(Infinity)).toBe(MAX_BPM);
  });
});

describe('clampBeatsPerBar', () => {
  it('limita ao intervalo', () => {
    expect(clampBeatsPerBar(0)).toBe(MIN_BEATS);
    expect(clampBeatsPerBar(99)).toBe(MAX_BEATS);
    expect(clampBeatsPerBar(4)).toBe(4);
  });
});

describe('clampSubdivisions / clampSwing', () => {
  it('subdivisões entre 1 e 4', () => {
    expect(clampSubdivisions(0)).toBe(1);
    expect(clampSubdivisions(9)).toBe(4);
    expect(clampSubdivisions(3)).toBe(3);
  });
  it('swing entre 0 e 0.75', () => {
    expect(clampSwing(-1)).toBe(0);
    expect(clampSwing(2)).toBe(0.75);
    expect(clampSwing(0.5)).toBe(0.5);
    expect(clampSwing(NaN)).toBe(0);
  });
});

describe('secondsPerBeat', () => {
  it('60 BPM = 1s por beat', () => {
    expect(secondsPerBeat(60)).toBe(1);
  });
  it('120 BPM = 0.5s por beat', () => {
    expect(secondsPerBeat(120)).toBe(0.5);
  });
});

describe('pulseDuration', () => {
  it('sem subdivisão = um tempo inteiro', () => {
    expect(pulseDuration(60, 1, 0, 0)).toBe(1);
  });
  it('divide o tempo igualmente sem swing', () => {
    expect(pulseDuration(60, 2, 0, 0)).toBe(0.5);
    expect(pulseDuration(60, 4, 3, 0)).toBe(0.25);
  });
  it('swing alonga o on-beat e encurta o off-beat, somando um tempo', () => {
    const on = pulseDuration(60, 2, 0, 0.5); // par
    const off = pulseDuration(60, 2, 1, 0.5); // ímpar
    expect(on).toBeGreaterThan(off);
    expect(on + off).toBeCloseTo(1); // par preserva o tempo
  });
  it('swing só afeta subdivisões pares', () => {
    expect(pulseDuration(60, 3, 0, 0.5)).toBeCloseTo(1 / 3);
  });
});

describe('beatInBar / isDownbeat', () => {
  it('cicla dentro do compasso', () => {
    expect(beatInBar(0, 4)).toBe(0);
    expect(beatInBar(4, 4)).toBe(0);
    expect(beatInBar(5, 4)).toBe(1);
  });
  it('downbeat só no primeiro tempo', () => {
    expect(isDownbeat(0, 4)).toBe(true);
    expect(isDownbeat(4, 4)).toBe(true);
    expect(isDownbeat(1, 4)).toBe(false);
  });
});

describe('Sequencer', () => {
  it('não emite pulsos quando parado', () => {
    const seq = new Sequencer({ bpm: 120, beatsPerBar: 4 });
    expect(seq.tick(10)).toEqual([]);
    expect(seq.isRunning).toBe(false);
  });

  it('agenda pulsos dentro da janela de lookahead', () => {
    const seq = new Sequencer({ bpm: 60, beatsPerBar: 4, lookahead: 0.1 });
    seq.start(0);
    let pulses = seq.tick(0);
    expect(pulses.map((p) => p.beatIndex)).toEqual([0]);
    expect(pulses[0].isDownbeat).toBe(true);
    expect(seq.tick(0.5)).toEqual([]);
    pulses = seq.tick(0.95);
    expect(pulses.map((p) => p.beatIndex)).toEqual([1]);
    expect(pulses[0].isDownbeat).toBe(false);
    expect(pulses[0].time).toBeCloseTo(1);
  });

  it('emite estrutura correta com subdivisões', () => {
    const seq = new Sequencer({ bpm: 120, beatsPerBar: 2, subdivisions: 2, lookahead: 1 });
    seq.start(0);
    const pulses = seq.tick(0);
    // 120 BPM => 0.5s/beat => 0.25s/subpulso
    expect(pulses.map((p) => p.subIndex)).toEqual([0, 1, 0, 1, 0]);
    expect(pulses.map((p) => p.isBeat)).toEqual([true, false, true, false, true]);
    expect(pulses.map((p) => p.beatInBar)).toEqual([0, 0, 1, 1, 0]);
    expect(pulses.map((p) => p.time)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('não drifta ao longo de muitos beats', () => {
    const seq = new Sequencer({ bpm: 100, beatsPerBar: 4, lookahead: 0.05 });
    const spb = secondsPerBeat(100);
    seq.start(0);
    const times: number[] = [];
    for (let t = 0; t < spb * 40; t += 0.01) {
      for (const p of seq.tick(t)) times.push(p.time);
    }
    times.forEach((time, i) => expect(time).toBeCloseTo(i * spb, 9));
    expect(times.length).toBeGreaterThan(35);
  });

  it('aplica novo BPM só a partir do beat seguinte ao já posicionado', () => {
    const seq = new Sequencer({ bpm: 60, beatsPerBar: 4, lookahead: 0.1 });
    seq.start(0);
    seq.tick(0); // beat 0; próximo já posicionado em t=1
    seq.setBpm(120);
    expect(seq.tick(0.95)[0].time).toBeCloseTo(1);
    expect(seq.tick(1.45)[0].time).toBeCloseTo(1.5); // 1 + 0.5 (novo BPM)
  });

  it('stop interrompe a emissão', () => {
    const seq = new Sequencer({ bpm: 120, beatsPerBar: 4 });
    seq.start(0);
    expect(seq.tick(0).length).toBeGreaterThan(0);
    seq.stop();
    expect(seq.tick(1)).toEqual([]);
  });

  it('não trava se o relógio andar para trás', () => {
    const seq = new Sequencer({ bpm: 120, beatsPerBar: 4, lookahead: 0.1 });
    seq.start(100);
    expect(() => seq.tick(0)).not.toThrow();
  });
});
