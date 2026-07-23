import { describe, it, expect } from "vitest";
import { buildCombinedSvg } from "./export";

function svgWithViewBox(viewBox: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", viewBox);
  return svg;
}

describe("buildCombinedSvg", () => {
  it("sizes to a single notation block from its viewBox", () => {
    const { size } = buildCombinedSvg({
      notationSvg: svgWithViewBox("0 0 100 40"),
      tabSvg: null,
      tabSize: null,
    });
    expect(size).toEqual({ width: 100, height: 40 });
  });

  it("stacks notation over the tab with a 16px gap and the widest block wins", () => {
    const { size } = buildCombinedSvg({
      notationSvg: svgWithViewBox("0 0 100 40"),
      tabSvg: "<svg><g>tab</g></svg>",
      tabSize: { width: 120, height: 30 },
    });
    // width = max(100, 120); height = 40 + 30 + 16 (single gap between two blocks)
    expect(size).toEqual({ width: 120, height: 86 });
  });

  it("falls back to 600x200 when a notation svg has no usable viewBox", () => {
    const { size } = buildCombinedSvg({
      notationSvg: document.createElementNS("http://www.w3.org/2000/svg", "svg"),
      tabSvg: null,
      tabSize: null,
    });
    expect(size).toEqual({ width: 600, height: 200 });
  });

  it("paints a white background and a matching viewBox", () => {
    const { svg } = buildCombinedSvg({
      notationSvg: svgWithViewBox("0 0 100 40"),
      tabSvg: null,
      tabSize: null,
    });
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('viewBox="0 0 100 40"');
  });

  it("strips the outer <svg> wrapper of the tab markup, re-nesting only its children", () => {
    const { svg } = buildCombinedSvg({
      notationSvg: null,
      tabSvg: '<svg xmlns="http://www.w3.org/2000/svg"><g id="inner">Z</g></svg>',
      tabSize: { width: 10, height: 10 },
    });
    expect(svg).toContain('<g id="inner">Z</g>');
  });
});
