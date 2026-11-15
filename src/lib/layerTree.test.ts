import { describe, expect, it } from "vitest";
import { clipBase, defaultProps, displayRows, insertAbove, isLocked, isShown, moveNode, removeNode, siblingBelow, wrapInFolder, type NodeProps } from "./layerTree";

const n = (id: number, kind: "layer" | "folder", parent: number | null = null, extra: Partial<NodeProps> = {}): NodeProps => ({ ...defaultProps(), id, kind, name: `${kind} ${id}`, parent, ...extra });
const ids = (nodes: NodeProps[]) => nodes.map((x) => x.id);
// Stack (bottom→top): 1 layer, 2 folder [3 layer, 4 layer], 5 layer
const stack = () => [n(1, "layer"), n(2, "folder"), n(3, "layer", 2), n(4, "layer", 2), n(5, "layer")];

describe("layer folders", () => {
  it("lists rows top first with folder contents indented", () => {
    expect(displayRows(stack()).map((r) => [r.node.id, r.depth])).toEqual([[5, 0], [2, 0], [4, 1], [3, 1], [1, 0]]);
  });
  it("hides contents of a collapsed folder", () => {
    const s = stack(); s[1] = { ...s[1]!, collapsed: true };
    expect(displayRows(s).map((r) => r.node.id)).toEqual([5, 2, 1]);
  });
  it("moves a layer into a folder at the top", () => {
    const out = moveNode(stack(), 5, 2, "into")!;
    expect(out.find((x) => x.id === 5)!.parent).toBe(2);
    expect(displayRows(out).map((r) => r.node.id)).toEqual([2, 5, 4, 3, 1]);
  });
  it("moves a layer out of a folder", () => {
    const out = moveNode(stack(), 3, 1, "below")!;
    expect(out.find((x) => x.id === 3)!.parent).toBeNull();
    expect(displayRows(out).map((r) => r.node.id)).toEqual([5, 2, 4, 1, 3]);
  });
  it("refuses to put a folder inside itself", () => {
    const s = [...stack(), n(6, "folder", 2)];
    expect(moveNode(s, 2, 6, "into")).toBeNull();
    expect(moveNode(s, 2, 3, "above")).toBeNull();
  });
  it("deleting a folder deletes what's inside it", () => { expect(ids(removeNode(stack(), 2))).toEqual([1, 5]); });
  it("a locked folder locks the layers inside", () => {
    const s = stack(); s[1] = { ...s[1]!, locked: true };
    expect(isLocked(s, 3)).toBe(true); expect(isLocked(s, 5)).toBe(false);
  });
  it("a hidden folder hides the layers inside", () => {
    const s = stack(); s[1] = { ...s[1]!, visible: false };
    expect(isShown(s, 4)).toBe(false); expect(isShown(s, 1)).toBe(true);
  });
  it("new folder takes the layer's place and holds it", () => {
    const out = wrapInFolder(stack(), n(9, "folder"), 4);
    expect(out.find((x) => x.id === 9)!.parent).toBe(2); expect(out.find((x) => x.id === 4)!.parent).toBe(9);
  });
  it("new layer goes right above the current one in the same folder", () => {
    const out = insertAbove(stack(), n(9, "layer"), 3);
    expect(out.find((x) => x.id === 9)!.parent).toBe(2); expect(siblingBelow(out, 4)!.id).toBe(9);
  });
});
describe("clipping masks", () => {
  it("clip to the nearest normal layer below, skipping other clipped layers", () => {
    const s = [n(1, "layer"), n(2, "layer", null, { clip: true }), n(3, "layer", null, { clip: true })];
    expect(clipBase(s, 3)!.id).toBe(1);
  });
  it("can't clip to a folder or to nothing", () => {
    expect(clipBase([n(1, "folder"), n(2, "layer", null, { clip: true })], 2)).toBeNull();
    expect(clipBase([n(2, "layer", null, { clip: true })], 2)).toBeNull();
  });
});
