/**
 * História rolante da leitura.
 *
 * Existe porque o dilema "responder rápido ou ficar estável" é falso, e só um
 * display escalar o força: uma agulha só pode mentir de um jeito ou de outro. Um
 * traço não escolhe - ele mostra o contorno cru e deixa a retina integrar, que é
 * o que ela sabe fazer melhor que qualquer filtro.
 *
 * Ring pré-alocado: o caminho quente escreve a 80 Hz e não deve gerar lixo.
 */

/** Amostras que o ring guarda por padrão: ~5 s a 80 Hz de análise. */
const DEFAULT_TRACE_CAPACITY = 400;

export class Trace {
  readonly capacity: number;
  private readonly cents: Float32Array;
  private readonly clarity: Float32Array;
  private readonly voiced: Uint8Array;
  private head = 0;
  private count = 0;

  constructor(capacity = DEFAULT_TRACE_CAPACITY) {
    this.capacity = capacity;
    this.cents = new Float32Array(capacity);
    this.clarity = new Float32Array(capacity);
    this.voiced = new Uint8Array(capacity);
  }

  push(cents: number, clarity: number, voiced: boolean): void {
    this.cents[this.head] = cents;
    this.clarity[this.head] = clarity;
    this.voiced[this.head] = voiced ? 1 : 0;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count += 1;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }

  get length(): number {
    return this.count;
  }

  /**
   * Percorre do mais antigo ao mais novo. `clarity` vem junto porque o detector
   * sabe quando está inseguro - e o traço deve desbotar aí, em vez de desenhar o
   * transiente dele com o mesmo peso da nota e fazer parecer erro do músico.
   */
  forEach(fn: (cents: number, clarity: number, voiced: boolean, index: number) => void): void {
    const start = this.count < this.capacity ? 0 : this.head;
    for (let index = 0; index < this.count; index += 1) {
      const ringIndex = (start + index) % this.capacity;
      fn(this.cents[ringIndex], this.clarity[ringIndex], this.voiced[ringIndex] === 1, index);
    }
  }
}
