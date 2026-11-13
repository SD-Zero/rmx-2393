import { describe, expect, it } from "vitest";
import { floodMask } from "./paintOps";

// 5x1 strip: empty, empty, black wall, empty, empty
const strip = () => { const d = new Uint8ClampedArray(5 * 4); d.set([0, 0, 0, 255], 2 * 4); return d; };

describe("paint bucket", () => {
  it("fills only the connected area, stopping at (and covering the edge of) a line", () => {
    expect([...floodMask(strip(), 5, 1, 0, 0)]).toEqual([1, 1, 1, 0, 0]);
  });
  it("does nothing when tapped outside the canvas", () => {
    expect([...floodMask(strip(), 5, 1, 9, 0)]).toEqual([0, 0, 0, 0, 0]);
  });
});
