import type { TabColumn } from "./whistles";
import type { HoleState } from "./fingerings";
import { WHISTLE_LAYOUT, type HoleLayout } from "./instruments";

// Renders the fingering strip as a standalone SVG string: one diagram per note,
// in playing order, wrapping into rows. The hole positions come from the
// instrument's layout. Closed holes are filled, open holes hollow, half-holes
// split. Used only as a fallback when the staff itself cannot be drawn.

const LABEL_H = 18;
const HOLES_TOP = LABEL_H + 10;
const BOTTOM_PAD = 14;
const PAD = 12;

// Colours (SVG-string builders, so CSS tokens cannot be referenced - these are
// the compliant form).
const OUT_OF_RANGE_RED = "#c0392b";
const BRASS = "#b8860b";
const INK = "#1a1a1a";

// SVG geometry, in user units (px).
const HOLE_STROKE_PX = 1.4;
const LABEL_FONT_PX = 12;
const LABEL_BASELINE_PX = 13;
const AWKWARD_FONT_PX = 11;
const OCTAVE_RING_RADIUS_PX = 2.4;
// The out-of-range "✕" glyph is drawn at a slightly larger half-size in the
// standalone (labelled) column than in the aligned diagram; both are intentional.
const X_MARK_HALF_LABELED_PX = 8;
const X_MARK_HALF_ALIGNED_PX = 7;
const X_MARK_STROKE_PX = 2;
// Octave ring sits above the holes; its rise differs per coordinate origin.
const OCTAVE_RING_RISE_LABELED_PX = 12;
const OCTAVE_RING_RISE_ALIGNED_PX = 10;
// Awkward "*" marker placement, near the top-right of the diagram.
const AWKWARD_MARK_INSET_LABELED_PX = 6;
const AWKWARD_MARK_TOP_LABELED_PX = 10;
const AWKWARD_MARK_INSET_ALIGNED_PX = 4;
const AWKWARD_MARK_RISE_ALIGNED_PX = 4;
const DEFAULT_COLUMNS_PER_ROW = 16;

const TRAILING_DIGIT_RE = /(\d)$/;

export interface TabSvgOptions {
  columnsPerRow?: number;
  layout?: HoleLayout;
}

function hole(
  cx: number,
  cy: number,
  radius: number,
  state: HoleState,
  color = "currentColor",
): string {
  const base = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${color}" stroke-width="${HOLE_STROKE_PX}"/>`;
  if (state === 1) {
    return `${base}<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}"/>`;
  }
  if (state === 0.5) {
    const half = `<path d="M ${cx} ${cy - radius} A ${radius} ${radius} 0 0 0 ${cx} ${cy + radius} Z" fill="${color}"/>`;
    return base + half;
  }
  return base;
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function column(tabColumn: TabColumn, x: number, y: number, layout: HoleLayout): string {
  const cx = x + layout.width / 2;
  const parts: string[] = [];

  const labelColor = tabColumn.playable ? "currentColor" : OUT_OF_RANGE_RED;
  parts.push(
    `<text x="${cx}" y="${y + LABEL_BASELINE_PX}" text-anchor="middle" font-size="${LABEL_FONT_PX}" font-weight="600" fill="${labelColor}">${escapeText(
      tabColumn.name.replace(TRAILING_DIGIT_RE, ""),
    )}</text>`,
  );

  if (!tabColumn.playable) {
    const midY = y + HOLES_TOP + layout.height / 2;
    parts.push(
      `<line x1="${cx - X_MARK_HALF_LABELED_PX}" y1="${midY - X_MARK_HALF_LABELED_PX}" x2="${cx + X_MARK_HALF_LABELED_PX}" y2="${midY + X_MARK_HALF_LABELED_PX}" stroke="${OUT_OF_RANGE_RED}" stroke-width="${X_MARK_STROKE_PX}"/>`,
      `<line x1="${cx - X_MARK_HALF_LABELED_PX}" y1="${midY + X_MARK_HALF_LABELED_PX}" x2="${cx + X_MARK_HALF_LABELED_PX}" y2="${midY - X_MARK_HALF_LABELED_PX}" stroke="${OUT_OF_RANGE_RED}" stroke-width="${X_MARK_STROKE_PX}"/>`,
    );
    return `<g>${parts.join("")}</g>`;
  }

  layout.holes.forEach((holeSpec, holeIndex) => {
    parts.push(
      hole(x + holeSpec.x, y + HOLES_TOP + holeSpec.y, holeSpec.r, tabColumn.fingering.holes[holeIndex]),
    );
  });

  // Upper-octave marker (whistles): a small ring above the diagram, blow harder.
  if (tabColumn.octave === 2) {
    parts.push(
      `<circle cx="${cx}" cy="${y + HOLES_TOP - OCTAVE_RING_RISE_LABELED_PX}" r="${OCTAVE_RING_RADIUS_PX}" fill="none" stroke="currentColor" stroke-width="${HOLE_STROKE_PX}"/>`,
    );
  }
  if (tabColumn.fingering.awkward) {
    parts.push(
      `<text x="${cx + layout.width / 2 - AWKWARD_MARK_INSET_LABELED_PX}" y="${y + AWKWARD_MARK_TOP_LABELED_PX}" text-anchor="middle" font-size="${AWKWARD_FONT_PX}" fill="${BRASS}">*</text>`,
    );
  }

  return `<g>${parts.join("")}</g>`;
}

// A single fingering diagram centered horizontally on `cx`, with its holes
// starting at `topY`. Used to place a diagram directly under a notehead when
// the tablature is aligned with the staff (no note label - the staff shows it).
export function fingeringGroupSvg(
  tabColumn: TabColumn,
  cx: number,
  topY: number,
  layout: HoleLayout,
  color = INK,
): string {
  const parts: string[] = [];

  if (!tabColumn.playable) {
    const midY = topY + layout.height / 2;
    parts.push(
      `<line x1="${cx - X_MARK_HALF_ALIGNED_PX}" y1="${midY - X_MARK_HALF_ALIGNED_PX}" x2="${cx + X_MARK_HALF_ALIGNED_PX}" y2="${midY + X_MARK_HALF_ALIGNED_PX}" stroke="${OUT_OF_RANGE_RED}" stroke-width="${X_MARK_STROKE_PX}"/>`,
      `<line x1="${cx - X_MARK_HALF_ALIGNED_PX}" y1="${midY + X_MARK_HALF_ALIGNED_PX}" x2="${cx + X_MARK_HALF_ALIGNED_PX}" y2="${midY - X_MARK_HALF_ALIGNED_PX}" stroke="${OUT_OF_RANGE_RED}" stroke-width="${X_MARK_STROKE_PX}"/>`,
    );
    return `<g>${parts.join("")}</g>`;
  }

  const left = cx - layout.width / 2;
  layout.holes.forEach((holeSpec, holeIndex) => {
    parts.push(
      hole(left + holeSpec.x, topY + holeSpec.y, holeSpec.r, tabColumn.fingering.holes[holeIndex], color),
    );
  });
  if (tabColumn.octave === 2) {
    parts.push(
      `<circle cx="${cx}" cy="${topY - OCTAVE_RING_RISE_ALIGNED_PX}" r="${OCTAVE_RING_RADIUS_PX}" fill="none" stroke="${color}" stroke-width="${HOLE_STROKE_PX}"/>`,
    );
  }
  if (tabColumn.fingering.awkward) {
    parts.push(
      `<text x="${cx + layout.width / 2 - AWKWARD_MARK_INSET_ALIGNED_PX}" y="${topY - AWKWARD_MARK_RISE_ALIGNED_PX}" text-anchor="middle" font-size="${AWKWARD_FONT_PX}" fill="${BRASS}">*</text>`,
    );
  }
  return `<g>${parts.join("")}</g>`;
}

export interface TabSvg {
  svg: string;
  width: number;
  height: number;
}

export function renderTabSvg(columns: TabColumn[], opts: TabSvgOptions = {}): TabSvg {
  const layout = opts.layout ?? WHISTLE_LAYOUT;
  const colW = layout.width;
  const rowH = HOLES_TOP + layout.height + BOTTOM_PAD;

  const perRow = Math.max(1, opts.columnsPerRow ?? DEFAULT_COLUMNS_PER_ROW);
  const rows = Math.max(1, Math.ceil(columns.length / perRow));
  const usedPerRow = Math.min(perRow, Math.max(1, columns.length));

  const width = PAD * 2 + usedPerRow * colW;
  const height = PAD * 2 + rows * rowH;

  const body: string[] = [];
  columns.forEach((tabColumn, index) => {
    const rowIndex = Math.floor(index / perRow);
    const columnIndex = index % perRow;
    body.push(column(tabColumn, PAD + columnIndex * colW, PAD + rowIndex * rowH, layout));
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="system-ui, sans-serif" color="${INK}">${body.join(
    "",
  )}</svg>`;

  return { svg, width, height };
}
