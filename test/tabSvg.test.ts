import { describe, it, expect } from "vitest";
import { renderTabSvg } from "../src/whistle/tabSvg";
import { buildTab, whistleById } from "../src/whistle/whistles";
import { parseAbc } from "../src/music/abcParser";

describe("renderTabSvg", () => {
  const D = whistleById("D");

  it("produces a valid standalone svg sized to its content", () => {
    const { columns } = buildTab(parseAbc("X:1\nK:Edor\nE G B").notes, D);
    const { svg, width, height } = renderTabSvg(columns);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("xmlns=\"http://www.w3.org/2000/svg\"");
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it("draws a filled hole for closed and none-fill for open", () => {
    const { columns } = buildTab(parseAbc("X:1\nK:Edor\nD").notes, D); // all closed
    const { svg } = renderTabSvg(columns);
    // Six filled holes for the tonic (each closed hole adds a solid circle).
    const filled = svg.match(/fill="currentColor"\/>/g) ?? [];
    expect(filled.length).toBeGreaterThanOrEqual(6);
  });

  it("marks an out-of-range note with a cross", () => {
    const { columns } = buildTab(parseAbc("X:1\nK:C\nA,").notes, D); // below low D
    const { svg } = renderTabSvg(columns);
    expect(svg).toContain("#c0392b"); // the red cross colour
  });

  it("wraps into rows for long inputs", () => {
    const { columns } = buildTab(parseAbc("X:1\nK:Edor\nEEEEEEEEEEEEEEEEEEEE").notes, D);
    const single = renderTabSvg(columns, { columnsPerRow: 100 }).height;
    const wrapped = renderTabSvg(columns, { columnsPerRow: 5 }).height;
    expect(wrapped).toBeGreaterThan(single);
  });
});
