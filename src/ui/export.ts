import { jsPDF } from "jspdf";

// Combines the engraved notation (an abcjs <svg>) and the fingering strip into
// one exportable image, then hands it out as SVG, PNG or PDF.

// Paper background for the exported image (an SVG-string builder, so the CSS
// token cannot be referenced here - this is the compliant form).
const PAPER_WHITE = "#ffffff";
// Last-resort dimensions when an SVG reports no measurable size.
const FALLBACK_WIDTH_PX = 600;
const FALLBACK_HEIGHT_PX = 200;
// Object-URL lifetime after a download click, before we revoke it.
const REVOKE_DELAY_MS = 1000;

interface Size {
  width: number;
  height: number;
}

function svgIntrinsicSize(svg: SVGSVGElement): Size {
  const viewBox = svg.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }
  const rect = svg.getBoundingClientRect();
  return { width: rect.width || FALLBACK_WIDTH_PX, height: rect.height || FALLBACK_HEIGHT_PX };
}

export interface CombineInput {
  notationSvg: SVGSVGElement | null;
  tabSvg: string | null;
  tabSize: Size | null;
}

export function buildCombinedSvg({ notationSvg, tabSvg, tabSize }: CombineInput): {
  svg: string;
  size: Size;
} {
  const blocks: { markup: string; size: Size }[] = [];

  if (notationSvg) {
    const size = svgIntrinsicSize(notationSvg);
    const clone = notationSvg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(size.width));
    clone.setAttribute("height", String(size.height));
    clone.removeAttribute("style");
    blocks.push({ markup: clone.outerHTML, size });
  }

  if (tabSvg && tabSize) {
    blocks.push({ markup: tabSvg, size: tabSize });
  }

  const gap = 16;
  const width = Math.max(1, ...blocks.map((block) => block.size.width));
  const height =
    blocks.reduce((sum, block) => sum + block.size.height, 0) +
    gap * Math.max(0, blocks.length - 1);

  let y = 0;
  const nested = blocks
    .map((block) => {
      const element = `<svg x="0" y="${y}" width="${block.size.width}" height="${block.size.height}" viewBox="0 0 ${block.size.width} ${block.size.height}" xmlns="http://www.w3.org/2000/svg">${stripOuter(
        block.markup,
      )}</svg>`;
      y += block.size.height + gap;
      return element;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${PAPER_WHITE}"/>${nested}</svg>`;
  return { svg, size: { width, height } };
}

// Drop the outer <svg ...> wrapper of a markup string, keeping its children,
// so it can be re-nested with our own positioning.
function stripOuter(markup: string): string {
  const open = markup.indexOf(">");
  const close = markup.lastIndexOf("</svg>");
  if (open === -1 || close === -1) return markup;
  return markup.slice(open + 1, close);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

export function downloadSvg(svg: string, filename: string): void {
  triggerDownload(new Blob([svg], { type: "image/svg+xml" }), filename);
}

function rasterize(svg: string, size: Size, scale = 2): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(size.width * scale);
      canvas.height = Math.ceil(size.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = PAPER_WHITE;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao rasterizar o SVG."));
    };
    img.src = url;
  });
}

export async function downloadPng(svg: string, size: Size, filename: string): Promise<void> {
  const canvas = await rasterize(svg, size, 2);
  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, filename);
      resolve();
    }, "image/png");
  });
}

export type PaperSize = "a4" | "letter";

export async function downloadPdf(
  svg: string,
  size: Size,
  filename: string,
  paper: PaperSize = "a4",
): Promise<void> {
  const canvas = await rasterize(svg, size, 2);
  const orientation = size.width >= size.height ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "pt", format: paper });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 32;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const ratio = Math.min(maxW / size.width, maxH / size.height, 1);
  const w = size.width * ratio;
  const h = size.height * ratio;

  pdf.addImage(canvas.toDataURL("image/png"), "PNG", (pageW - w) / 2, margin, w, h);
  pdf.save(filename);
}
