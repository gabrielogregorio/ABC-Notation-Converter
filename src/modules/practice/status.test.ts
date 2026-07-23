import { describe, it, expect } from "vitest";
import { STATUS_COLOR, historyBarColor, holeFill } from "./status";

describe("historyBarColor", () => {
  it("uses the good color at and above 80%", () => {
    expect(historyBarColor(80)).toBe(STATUS_COLOR.good);
  });

  it("uses the close color from 50% up to just under 80%", () => {
    expect(historyBarColor(79)).toBe(STATUS_COLOR.close);
    expect(historyBarColor(50)).toBe(STATUS_COLOR.close);
  });

  it("uses the wrong color below 50%", () => {
    expect(historyBarColor(49)).toBe(STATUS_COLOR.wrong);
  });
});

describe("holeFill", () => {
  it("fills a closed hole with the solid color", () => {
    expect(holeFill(1, "#123456")).toBe("#123456");
  });

  it("renders a half-hole as the translucent color", () => {
    expect(holeFill(0.5, "#123456")).toBe("#12345680");
  });

  it("leaves an open hole transparent", () => {
    expect(holeFill(0, "#123456")).toBe("transparent");
  });
});
