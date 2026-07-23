/**
 * Gate de articulação (o "TU" do tin whistle). No modo que exige língua, uma
 * nota só é aceita depois de um ATAQUE NOVO: primeiro uma folga no som
 * (silêncio ou queda de amplitude - a língua/respiração) e então o som
 * voltando. Tocar uma run em LIGATO (ar contínuo, sem cortar) nunca produz a
 * folga, então o gate não abre e a nota trava.
 *
 * Puro e sem estado de áudio: recebe, por frame, só "houve folga?".
 */

/** RMS (0..1, já normalizado no useMic) abaixo do qual contamos como folga. */
export const DEFAULT_RELEASE_RMS = 0.12;

/** Há folga no som neste frame? (sem pitch ou amplitude muito baixa). */
export function isArticulationGap(midi: number, rms: number, releaseRms = DEFAULT_RELEASE_RMS): boolean {
  return midi <= 0 || rms < releaseRms;
}

export class ArticulationGate {
  private gapSeen = false;
  private open = false;

  /** Alimenta um frame. `gap` = houve folga no som agora. */
  feed(gap: boolean): void {
    if (gap) {
      this.gapSeen = true;
    } else if (this.gapSeen) {
      // som voltou depois de uma folga → ataque articulado
      this.open = true;
      this.gapSeen = false;
    }
  }

  /** O gate já foi aberto por uma articulação desde o último reset? */
  get isOpen(): boolean {
    return this.open;
  }

  /** Nova nota: exige uma articulação nova. */
  reset(): void {
    this.gapSeen = false;
    this.open = false;
  }
}
