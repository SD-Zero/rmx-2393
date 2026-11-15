import { describe, expect, it } from "vitest";
import { parseIsFile } from "./isFormat";

const good = { format: "glass-canvas", version: 1, width: 2048, height: 1536, activeIndex: 1,
  brush: { tool: "pen", color: "#111111", size: 12, opacity: 100 },
  layers: [{ name: "Background", visible: true, png: "data:image/png;base64,AAA" }, { name: "Layer 1", visible: false, png: "data:image/png;base64,BBB" }] };
const png = "data:image/png;base64,AAA";

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
  it("opens older files with normal, unlocked, fully opaque layers", () => {
    const l = parseIsFile(JSON.stringify(good)).layers[0]!;
    expect([l.kind, l.opacity, l.blend, l.locked, l.alphaLock, l.clip, l.parent]).toEqual(["layer", 100, "source-over", false, false, false, null]);
  });
  it("keeps folders and layer settings", () => {
    const d = parseIsFile(JSON.stringify({ ...good, version: 2, layers: [
      { name: "Folder", visible: true, kind: "folder", parent: null, collapsed: true },
      { name: "Ink", visible: true, png, parent: 0, opacity: 40, blend: "multiply", locked: true, alphaLock: true, clip: true },
    ] }));
    expect(d.layers[0]!.collapsed).toBe(true);
    expect(d.layers[1]).toMatchObject({ parent: 0, opacity: 40, blend: "multiply", locked: true, alphaLock: true, clip: true });
  });
  it("ignores broken folder links and unknown blend modes", () => {
    const d = parseIsFile(JSON.stringify({ ...good, version: 2, layers: [
      { name: "A", visible: true, kind: "folder", parent: 1 }, { name: "B", visible: true, kind: "folder", parent: 0 },
      { name: "C", visible: true, png, parent: 2, blend: "sparkle" },
    ] }));
    expect(d.layers.map((l) => l.parent)).toEqual([null, 0, null]);
    expect(d.layers[2]!.blend).toBe("source-over");
  });
});
