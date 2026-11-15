import { describe, expect, it } from "vitest";
import { artworkName, artworkFilename, DEFAULT_TOOLBAR, REARRANGE_HOLD_MS, defaultToolbarLayout, landingSlot, placeToolbarItem, removeToolbarItem, toolbarSlots, validateToolbarLayout } from "./toolbar";
describe("artwork and toolbar rules", () => {
  it("starts unnamed artwork as Untitled", () => { expect(artworkName("")).toBe("Untitled"); expect(artworkFilename("Sunset", "png")).toBe("Sunset.png"); });
  it("requires a two-second hold to start rearranging", () => { expect(REARRANGE_HOLD_MS).toBe(2000); });
  it("allocates one slot per tool and multiple slots for wider controls", () => { expect(toolbarSlots("brush")).toBe(1); expect(toolbarSlots("files")).toBe(2); expect(toolbarSlots("title")).toBe(4); });
  it("places the color circle right after files by default", () => { expect(DEFAULT_TOOLBAR.slice(0, 2)).toEqual(["files", "color"]); expect(defaultToolbarLayout(20).slice(0, 2)).toEqual([{ id: "files", slot: 0 }, { id: "color", slot: 2 }]); });
  it("keeps lasso, transform, blur and smudge in the tools menu by default", () => { for (const id of ["lasso", "transform", "blur", "smudge"]) expect(defaultToolbarLayout(20).some((e) => e.id === id)).toBe(false); });
  it("allows dropping into empty space leaving gaps", () => { expect(placeToolbarItem([{ id: "brush", slot: 0 }], "hand", 7, 10)).toEqual([{ id: "brush", slot: 0 }, { id: "hand", slot: 7 }]); });
  it("moves an item to a far empty slot without closing gaps", () => { expect(placeToolbarItem([{ id: "brush", slot: 0 }, { id: "eraser", slot: 1 }], "brush", 9, 10)).toEqual([{ id: "eraser", slot: 1 }, { id: "brush", slot: 9 }]); });
  it("nudges only overlapping items aside", () => { expect(placeToolbarItem([{ id: "brush", slot: 3 }, { id: "eraser", slot: 4 }, { id: "bucket", slot: 8 }], "hand", 3, 10)).toEqual([{ id: "hand", slot: 3 }, { id: "brush", slot: 4 }, { id: "eraser", slot: 5 }, { id: "bucket", slot: 8 }]); });
  it("refuses a drop that cannot fit", () => { expect(placeToolbarItem([{ id: "brush", slot: 0 }, { id: "eraser", slot: 1 }], "hand", 1, 2)).toBeNull(); });
  it("removing an item leaves its slots empty", () => { expect(removeToolbarItem([{ id: "brush", slot: 0 }, { id: "eraser", slot: 1 }, { id: "hand", slot: 2 }], "eraser")).toEqual([{ id: "brush", slot: 0 }, { id: "hand", slot: 2 }]); });
  it("centers wide items on the hovered slot", () => { expect(landingSlot("title", 5, 12)).toBe(3); expect(landingSlot("title", 11, 12)).toBe(8); });
  it("restores validated saved placement", () => { expect(validateToolbarLayout([{ id: "hand", slot: 3 }, { id: "hand", slot: 5 }, { id: "fake", slot: 1 }, { id: "brush", slot: 0 }])).toEqual([{ id: "brush", slot: 0 }, { id: "hand", slot: 3 }]); expect(validateToolbarLayout(null)).toBeNull(); });
});
describe("tools menu", () => {
  it("no longer holds layer editing tools", async () => { const { TOOL_ITEMS } = await import("./toolbar"); for (const id of ["flipH", "flipV", "duplicate", "clear", "addLayer"]) expect(TOOL_ITEMS.some((t) => t.id === id)).toBe(false); });
});
