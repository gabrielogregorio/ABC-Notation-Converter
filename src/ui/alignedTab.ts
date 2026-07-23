import { fingeringGroupSvg } from "../whistle/tabSvg";
import type { TabColumn } from "../whistle/whistles";
import type { HoleLayout } from "../whistle/instruments";

// Places one fingering diagram directly under each notehead in an abcjs-rendered
// staff, so a note's fingering lines up horizontally with the note itself and
// each staff line carries its own row of tablature underneath. This relies on
// abcjs's own geometry (the `.abcjs-note` elements and their `.abcjs-staff-
// wrapper` line groups), so the alignment is exact rather than estimated.

const GAP = 8; // px between a staff line's bottom and its fingering row
// Extra height reserved below the diagram holes for the tab row.
const TAB_ROW_PADDING_PX = 14;
// Padding added to the right and bottom of the sized canvas.
const CANVAS_MARGIN_PX = 8;
// Drop below a note when its staff wrapper cannot be located.
const FALLBACK_LINE_GAP_PX = 20;

interface Placed {
  cx: number;
  lineBottom: number;
}

// Map an element's bounding box into the root SVG's viewBox coordinate space,
// following any transforms on the ancestor groups.
function place(element: SVGGraphicsElement): Placed & { top: number } {
  const bbox = element.getBBox();
  const matrix = element.getCTM();
  if (!matrix) {
    return { cx: bbox.x + bbox.width / 2, lineBottom: bbox.y + bbox.height, top: bbox.y };
  }
  const mapPoint = (x: number, y: number) => ({
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  });
  const centre = mapPoint(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
  const bottom = mapPoint(bbox.x, bbox.y + bbox.height);
  const top = mapPoint(bbox.x, bbox.y);
  return { cx: centre.x, lineBottom: bottom.y, top: top.y };
}

export interface AlignResult {
  placed: number;
  total: number;
}

/**
 * Inject aligned fingering diagrams into an abcjs SVG. Notes and columns are
 * matched by playing order (our parser and abcjs agree once grace notes are
 * dropped and chords collapsed). Returns how many were placed.
 */
export function injectAlignedFingerings(
  svg: SVGSVGElement,
  columns: TabColumn[],
  layout: HoleLayout,
): AlignResult {
  // Content bounds before we add anything (user-unit coordinates - abcjs is
  // rendered without responsive scaling, so getCTM/getBBox share this space).
  const contentBox = svg.getBBox();

  const wrappers = Array.from(svg.querySelectorAll<SVGGraphicsElement>(".abcjs-staff-wrapper"));
  const wrapperBottom = new Map<Element, number>();
  for (const wrapper of wrappers) wrapperBottom.set(wrapper, place(wrapper).lineBottom);

  const noteEls = Array.from(svg.querySelectorAll<SVGGraphicsElement>(".abcjs-note"));
  const count = Math.min(noteEls.length, columns.length);

  const tabHeight = layout.height + TAB_ROW_PADDING_PX;
  const groups: string[] = [];
  let maxBottom = 0;

  for (let index = 0; index < count; index += 1) {
    const noteElement = noteEls[index];
    const placed = place(noteElement);
    const wrapper = noteElement.closest(".abcjs-staff-wrapper");
    const lineBottom = (wrapper && wrapperBottom.get(wrapper)) ?? placed.lineBottom + FALLBACK_LINE_GAP_PX;
    const topY = lineBottom + GAP;
    groups.push(fingeringGroupSvg(columns[index], placed.cx, topY, layout));
    maxBottom = Math.max(maxBottom, topY + tabHeight);
  }

  if (groups.length) {
    svg.insertAdjacentHTML("beforeend", `<g class="whistle-tab">${groups.join("")}</g>`);
  }

  // Size the canvas to cover the notation plus the last row of diagrams, and
  // give it an explicit viewBox so CSS can scale it down to fit the container.
  const width = Math.ceil(contentBox.x + contentBox.width + CANVAS_MARGIN_PX);
  // The tab row is the lowest content, so trim to it rather than to the staff's
  // trailing staffsep gap.
  const contentBottom = contentBox.y + contentBox.height;
  const height = Math.ceil((count > 0 ? maxBottom : contentBottom) + CANVAS_MARGIN_PX);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.style.removeProperty("width");
  svg.style.removeProperty("height");

  return { placed: count, total: Math.max(noteEls.length, columns.length) };
}
