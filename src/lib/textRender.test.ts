import { describe, expect, it } from "vitest";
import { DEFAULT_TEXT_STYLE, layoutText } from "./textRender";

const measure = (t: string) => t.length * 10;
const style = { ...DEFAULT_TEXT_STYLE, text: "ab\nabcd", size: 10, padX: 5, padY: 3 };

describe("layoutText", () => {
  it("anchors the box at the tap point for left/top", () => {
    expect(layoutText(style, measure, 100, 100).box).toEqual({ x: 100, y: 100, w: 50, h: 30 });
  });
  it("centers and right-aligns lines inside the box", () => {
    expect(layoutText({ ...style, hAlign: "center" }, measure, 100, 0).lines.map((l) => l.x)).toEqual([85, 75]);
    expect(layoutText({ ...style, hAlign: "right" }, measure, 100, 0).lines.map((l) => l.x)).toEqual([75, 55]);
  });
  it("puts the box above the point for bottom alignment", () => {
    expect(layoutText({ ...style, vAlign: "bottom" }, measure, 0, 100).box.y).toBe(70);
  });
  it("adds letter spacing between letters and line spacing between lines", () => {
    const l = layoutText({ ...style, letterSpacing: 2, lineSpacing: 4 }, measure, 0, 0);
    expect(l.lines[1]!.w).toBe(46);
    expect(l.lines[1]!.y - l.lines[0]!.y).toBe(16);
  });
});
