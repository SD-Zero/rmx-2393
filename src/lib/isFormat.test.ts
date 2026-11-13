import { describe, expect, it } from "vitest";
import { parseIsFile } from "./isFormat";

const good = { format: "glass-canvas", version: 1, width: 2048, height: 1536, activeIndex: 1,
  brush: { tool: "pen", color: "#111111", size: 12, opacity: 100 },
  layers: [{ name: "Background", visible: true, png: "data:image/png;base64,AAA" }, { name: "Layer 1", visible: false, png: "data:image/png;base64,BBB" }] };

describe(".is file", () => {
  it("keeps every layer's name and visibility", () => {
    const d = parseIsFile(JSON.stringify(good));
    expect(d.layers.map((l) => [l.name, l.visible])).toEqual([["Background", true], ["Layer 1", false]]);
    expect(d.activeIndex).toBe(1);
  });
  it("rejects files that aren't .is projects", () => {
    expect(() => parseIsFile("{\"hello\":1}")).toThrow();
    expect(() => parseIsFile("not json")).toThrow();
  });
});
