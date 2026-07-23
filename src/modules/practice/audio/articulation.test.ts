import { describe, it, expect } from 'vitest';
import { ArticulationGate, isArticulationGap, DEFAULT_RELEASE_RMS } from './articulation';

describe('isArticulationGap', () => {
  it('sem pitch é folga', () => {
    expect(isArticulationGap(-1, 0.9)).toBe(true);
    expect(isArticulationGap(0, 0.9)).toBe(true);
  });
  it('amplitude baixa é folga mesmo com pitch', () => {
    expect(isArticulationGap(72, DEFAULT_RELEASE_RMS - 0.01)).toBe(true);
  });
  it('pitch + amplitude ok não é folga', () => {
    expect(isArticulationGap(72, 0.5)).toBe(false);
    expect(isArticulationGap(72, DEFAULT_RELEASE_RMS)).toBe(false);
  });
  it('limiar de release é configurável', () => {
    expect(isArticulationGap(72, 0.3, 0.4)).toBe(true);
    expect(isArticulationGap(72, 0.5, 0.4)).toBe(false);
  });
});

describe('ArticulationGate', () => {
  it('começa fechado', () => {
    expect(new ArticulationGate().isOpen).toBe(false);
  });

  it('LIGATO (som contínuo, nunca há folga) mantém fechado - trava', () => {
    const g = new ArticulationGate();
    for (let i = 0; i < 50; i += 1) g.feed(false);
    expect(g.isOpen).toBe(false);
  });

  it('folga seguida de som (o "tu") abre o gate', () => {
    const g = new ArticulationGate();
    g.feed(true); // língua/silêncio
    expect(g.isOpen).toBe(false);
    g.feed(false); // ataque de volta
    expect(g.isOpen).toBe(true);
  });

  it('primeira nota: silêncio inicial + ataque abre', () => {
    const g = new ArticulationGate();
    g.feed(true);
    g.feed(true); // ainda em silêncio
    g.feed(false); // ataque
    expect(g.isOpen).toBe(true);
  });

  it('continua aberto após abrir (folgas seguintes não fecham)', () => {
    const g = new ArticulationGate();
    g.feed(true);
    g.feed(false);
    g.feed(false);
    g.feed(true);
    g.feed(false);
    expect(g.isOpen).toBe(true);
  });

  it('reset exige nova articulação (a próxima nota trava até tongue)', () => {
    const g = new ArticulationGate();
    g.feed(true);
    g.feed(false);
    expect(g.isOpen).toBe(true);
    g.reset();
    expect(g.isOpen).toBe(false);
    // som contínuo depois do reset não reabre
    g.feed(false);
    g.feed(false);
    expect(g.isOpen).toBe(false);
    // só reabre com folga + ataque
    g.feed(true);
    g.feed(false);
    expect(g.isOpen).toBe(true);
  });

  it('som sem nenhuma folga prévia não abre (só ataque não basta)', () => {
    const g = new ArticulationGate();
    g.feed(false); // som já presente, sem folga anterior
    expect(g.isOpen).toBe(false);
  });
});
