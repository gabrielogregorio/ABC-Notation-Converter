/**
 * O mostrador: fita de história rolante em cents.
 *
 * Tempo no eixo x, desvio no y, agora na borda direita. Uma agulha sozinha
 * obriga a escolher entre responder rápido e ficar parada; a fita não escolhe -
 * mostra o contorno cru e deixa quem olha integrar. E é ela que transforma
 * "tremeu" em informação legível: deriva de sopro vira rampa, vibrato vira onda,
 * desafinação vira uma linha deslocada do centro.
 *
 * Duas camadas de canvas porque a grade não muda e o dado muda 60×/s - redesenhar
 * régua e rótulos a cada frame é a conta que não precisa ser paga.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import type { Reading } from "../core/stability";
import type { VibratoAnalysis } from "../core/vibrato";
import type { Trace } from "../core/trace";

const SPAN = 50; // cents visíveis para cada lado
const PAD_TOP = 14;
const PAD_BOTTOM = 14;
const PAD_RIGHT = 80; // marcador de "agora" + régua de cents

// Marcas da régua de cents (a linha do 0 é a de referência).
const GRID_CENTS = [-50, -25, 0, 25, 50];
const GRID_LABEL_FONT = "500 10px system-ui, sans-serif";

// Sombreado, não colorido: quem julga é a posição do traço dentro da banda.
const TOLERANCE_BAND_ALPHA = 0.1;
const VIBRATO_BAND_ALPHA = 0.14;

// A opacidade do traço segue a clareza do detector, com um piso pra não sumir.
const MIN_TRACE_ALPHA = 0.25;
const CLARITY_ALPHA_RANGE = 0.75;
const ALPHA_BUCKETS = 6;

const CHECKMARK_COLOR = "#fff";

// Fallbacks dos tokens de tema, caso o CSS ainda não tenha resolvido.
const TOKEN_FALLBACK = {
  ink: "#17251d",
  inkSoft: "#566b60",
  line: "#d6ded6",
  accent: "#1d7a4b",
  brass: "#b8860b",
};

interface TunerDialProps {
  readingRef: RefObject<Reading>;
  vibratoRef: RefObject<VibratoAnalysis>;
  trace: Trace;
  toleranceCents: number;
  running: boolean;
}

interface Palette {
  ink: string;
  inkSoft: string;
  line: string;
  accent: string;
  brass: string;
}

function palette(element: HTMLElement): Palette {
  const styles = getComputedStyle(element);
  const get = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    ink: get("--ink", TOKEN_FALLBACK.ink),
    inkSoft: get("--ink-soft", TOKEN_FALLBACK.inkSoft),
    line: get("--line", TOKEN_FALLBACK.line),
    accent: get("--accent", TOKEN_FALLBACK.accent),
    brass: get("--brass", TOKEN_FALLBACK.brass),
  };
}

export function TunerDial({
  readingRef,
  vibratoRef,
  trace,
  toleranceCents,
  running,
}: TunerDialProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setBox({
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        dpr: window.devicePixelRatio || 1,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Grade: só quando muda tamanho ou tolerância.
  useEffect(() => {
    const canvas = gridRef.current;
    const host = boxRef.current;
    if (!canvas || !host || box.w === 0) return;
    const ctx = prepare(canvas, box);
    if (!ctx) return;
    drawGrid(ctx, box.w, box.h, toleranceCents, palette(host));
  }, [box, toleranceCents]);

  useEffect(() => {
    const canvas = liveRef.current;
    const host = boxRef.current;
    if (!canvas || !host || box.w === 0) return;
    const ctx = prepare(canvas, box);
    if (!ctx) return;
    const pal = palette(host);

    if (!running) {
      ctx.clearRect(0, 0, box.w, box.h);
      return;
    }

    let animationFrame = 0;
    const loop = () => {
      drawLive(ctx, box.w, box.h, trace, readingRef.current, vibratoRef.current, toleranceCents, pal);
      animationFrame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrame);
  }, [box, running, trace, readingRef, vibratoRef, toleranceCents]);

  return (
    <div className="tuner-dial" ref={boxRef}>
      <canvas ref={gridRef} className="tuner-canvas" aria-hidden="true" />
      <canvas ref={liveRef} className="tuner-canvas" aria-hidden="true" />
    </div>
  );
}

function prepare(canvas: HTMLCanvasElement, box: { w: number; h: number; dpr: number }) {
  canvas.width = Math.round(box.w * box.dpr);
  canvas.height = Math.round(box.h * box.dpr);
  canvas.style.width = `${box.w}px`;
  canvas.style.height = `${box.h}px`;
  // O fundo é opaco: dizer isso ao navegador libera um caminho de composição
  // mais rápido, e a fita não precisa de transparência atrás.
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;
  ctx.setTransform(box.dpr, 0, 0, box.dpr, 0, 0);
  return ctx;
}

function yFor(cents: number, h: number): number {
  const usable = h - PAD_TOP - PAD_BOTTOM;
  const clamped = Math.max(-SPAN, Math.min(SPAN, cents));
  return PAD_TOP + ((SPAN - clamped) / (SPAN * 2)) * usable;
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tolerance: number,
  pal: Palette,
) {
  ctx.clearRect(0, 0, w, h);

  // Banda de tolerância. Sombreada, não colorida de vermelho/verde: quem lê o
  // veredito é a posição do traço dentro dela.
  const top = yFor(tolerance, h);
  const bottom = yFor(-tolerance, h);
  ctx.fillStyle = withAlpha(pal.accent, TOLERANCE_BAND_ALPHA);
  ctx.fillRect(0, top, w - PAD_RIGHT, bottom - top);

  ctx.font = GRID_LABEL_FONT;
  ctx.textBaseline = "middle";
  for (const centsMark of GRID_CENTS) {
    const y = Math.floor(yFor(centsMark, h)) + 0.5;
    const isCenter = centsMark === 0;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w - PAD_RIGHT, y);
    ctx.strokeStyle = isCenter ? pal.brass : pal.line;
    ctx.lineWidth = isCenter ? 1.5 : 1;
    if (!isCenter) ctx.setLineDash([2, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = isCenter ? pal.brass : pal.inkSoft;
    ctx.textAlign = "left";
    ctx.fillText(isCenter ? "0 ¢" : `${centsMark > 0 ? "+" : ""}${centsMark}`, w - PAD_RIGHT + 50, y);
  }
}

function drawLive(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  trace: Trace,
  reading: Reading,
  vibrato: VibratoAnalysis,
  tolerance: number,
  pal: Palette,
) {
  ctx.clearRect(0, 0, w, h);
  const plotWidth = w - PAD_RIGHT;
  if (trace.length === 0) return;

  // Vibrato: a banda que ele varre, com o centro marcado. É o centro que julga a
  // afinação - oscilar em torno do alvo é acerto, e um app que testa o valor
  // instantâneo chama isso de erro.
  if (vibrato.active) {
    const top = yFor(vibrato.centerCents + vibrato.extentCents, h);
    const bottom = yFor(vibrato.centerCents - vibrato.extentCents, h);
    ctx.fillStyle = withAlpha(pal.brass, VIBRATO_BAND_ALPHA);
    ctx.fillRect(0, top, plotWidth, bottom - top);
    const centerY = Math.floor(yFor(vibrato.centerCents, h)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(plotWidth, centerY);
    ctx.strokeStyle = pal.brass;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // O contorno. A opacidade segue a clareza do detector: no ataque ele sabe que
  // está inseguro, e desenhar essa insegurança com peso cheio mostraria o
  // transiente dele como se fosse desafinação do músico.
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const step = plotWidth / (trace.capacity - 1);
  let drawing = false;
  let lastAlpha = -1;
  trace.forEach((cents, clarity, voiced, index) => {
    const x = index * step;
    if (!voiced) {
      if (drawing) {
        ctx.stroke();
        drawing = false;
      }
      return;
    }
    const alpha = MIN_TRACE_ALPHA + CLARITY_ALPHA_RANGE * Math.min(1, Math.max(0, clarity));
    // Só reabre o traço quando a opacidade muda de faixa: um stroke por ponto
    // seria caro, um stroke só perderia o desbotamento.
    const bucket = Math.round(alpha * ALPHA_BUCKETS);
    if (!drawing || bucket !== lastAlpha) {
      if (drawing) ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = withAlpha(pal.accent, alpha);
      ctx.moveTo(x, yFor(cents, h));
      drawing = true;
      lastAlpha = bucket;
    } else {
      ctx.lineTo(x, yFor(cents, h));
    }
  });
  if (drawing) ctx.stroke();

  if (reading.state === "silent") return;

  // Marcador do agora. A posição é o veredito - dentro da banda ou fora dela -
  // e a forma repete a informação sem depender de cor: ✓ afinado, ▲ agudo,
  // ▼ grave.
  const y = yFor(reading.cents, h);
  const x = plotWidth + 4;
  const inBand = Math.abs(reading.cents) <= tolerance;
  const color = markerColor(reading.confirmed, inBand, pal);

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 11, y - 7);
  ctx.lineTo(x + 11, y + 7);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  // Anel de progresso do dwell: mostra que o afinado está sendo *sustentado*,
  // não só tocado de raspão. Sem isso o usuário não entende por que o veredito
  // demora - e é essa demora que impede o falso positivo.
  if (reading.dwellProgress > 0 && !reading.confirmed) {
    ctx.beginPath();
    ctx.arc(x + 28, y, 8, -Math.PI / 2, -Math.PI / 2 + reading.dwellProgress * Math.PI * 2);
    ctx.strokeStyle = pal.brass;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  if (reading.confirmed) {
    ctx.beginPath();
    ctx.arc(x + 28, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = pal.accent;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 24, y);
    ctx.lineTo(x + 27, y + 3.5);
    ctx.lineTo(x + 32, y - 3.5);
    ctx.strokeStyle = CHECKMARK_COLOR;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

// A cor do marcador do agora repete o veredito: verde confirmado, latão dentro
// da banda, tinta fora dela.
function markerColor(confirmed: boolean, inBand: boolean, pal: Palette): string {
  if (confirmed) return pal.accent;
  if (inBand) return pal.brass;
  return pal.ink;
}

function withAlpha(color: string, alpha: number): string {
  const hex = color.startsWith("#") ? color : null;
  if (!hex) return color;
  const hexDigits =
    hex.length === 4
      ? hex
          .slice(1)
          .split("")
          .map((char) => char + char)
          .join("")
      : hex.slice(1);
  const red = parseInt(hexDigits.slice(0, 2), 16);
  const green = parseInt(hexDigits.slice(2, 4), 16);
  const blue = parseInt(hexDigits.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
