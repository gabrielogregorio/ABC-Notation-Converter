/**
 * Worker de análise: recebe a janela do coletor, roda o YIN, devolve o resultado
 * e o buffer.
 *
 * O YIN mora aqui e não no worklet porque no worklet ele não cabe: o bloco de
 * áudio dá ~2,7 ms pra `process()` retornar, e a difference function da faixa
 * cromática é mais de um milhão de operações por janela. Estourar esse orçamento
 * é glitch audível. Aqui, um frame atrasado é só um frame atrasado.
 *
 * Os buffers voltam pra quem mandou. Nada é alocado no caminho quente.
 */
import { YinDetector, type YinOptions } from "../core/yin";

type Outbound =
  | { type: "ready"; size: number; latencyMs: number }
  | { type: "result"; hz: number; clarity: number; rms: number; b: ArrayBuffer }
  | { type: "recycle"; b: ArrayBuffer };

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage(msg: Outbound, transfer?: Transferable[]): void;
};

let detector: YinDetector | null = null;

ctx.onmessage = (event: MessageEvent) => {
  const msg = event.data as { type: "config"; opts: YinOptions } | { type: "frame"; b: ArrayBuffer };

  if (msg.type === "config") {
    detector = new YinDetector(msg.opts);
    ctx.postMessage({
      type: "ready",
      size: detector.window.size,
      latencyMs: detector.window.latencyMs,
    });
    return;
  }

  if (msg.type === "frame") {
    if (!detector) {
      ctx.postMessage({ type: "recycle", b: msg.b }, [msg.b]);
      return;
    }
    const result = detector.detect(new Float32Array(msg.b));
    ctx.postMessage(
      { type: "result", hz: result.hz, clarity: result.clarity, rms: result.rms, b: msg.b },
      [msg.b],
    );
  }
};
