import { describe, expect, it } from "vitest";
import { artworkName, artworkFilename, DEFAULT_TOOLBAR, REARRANGE_HOLD_MS, emptyToolbarSlots, migrateToolbar, toolbarSlots, moveToolbarItem, validateToolbar, placeToolbarItem, validatePlacements } from "./toolbar";
describe("artwork and toolbar rules", () => {
  it("places an item far right without filling the gap", () => { expect(placeToolbarItem([{ id: "brush", slot: 0 }], "color", 20)).toEqual([{ id: "brush", slot: 0 }, { id: "color", slot: 20 }]); });
  it("leaves the original slots empty when removing or moving", () => { expect(placeToolbarItem([{ id: "files", slot: 0 }, { id: "brush", slot: 5 }], "files", null)).toEqual([{ id: "brush", slot: 5 }]); });
  it("reserves all four title slots and shifts only overlapping items", () => { expect(placeToolbarItem([{ id: "brush", slot: 0 }, { id: "color", slot: 8 }], "title", 6)).toEqual([{ id: "brush", slot: 0 }, { id: "title", slot: 6 }, { id: "color", slot: 10 }]); });
  it("restores gaps and accepts old saved toolbars", () => { expect(validatePlacements([{ id: "brush", slot: 0 }, { id: "color", slot: 20 }])).toEqual([{ id: "brush", slot: 0 }, { id: "color", slot: 20 }]); expect(validatePlacements(["files", "brush"])).toEqual([{ id: "files", slot: 0 }, { id: "brush", slot: 2 }]); });
  it("starts unnamed artwork as Untitled", () => { expect(artworkName("")).toBe("Untitled"); expect(artworkFilename("Sunset", "png")).toBe("Sunset.png"); });
  it("moves tools from the drawer into the toolbar", () => { expect(moveToolbarItem(["brush", "eraser"], "hand", "eraser")).toEqual(["brush", "hand", "eraser"]); });
  it("moves toolbar tools back into the drawer", () => { expect(moveToolbarItem(["brush", "eraser"], "eraser", "drawer")).toEqual(["brush"]); });
  it("reorders without duplicating tools", () => { expect(moveToolbarItem(["brush", "eraser", "hand"], "hand", "brush")).toEqual(["hand", "brush", "eraser"]); });
  it("restores validated saved placement including an empty toolbar", () => { expect(validateToolbar(["hand", "hand", "fake", "brush"])).toEqual(["hand", "brush"]); expect(validateToolbar([])).toEqual([]); expect(validateToolbar(null)).toEqual(DEFAULT_TOOLBAR); });
  it("requires a two-second hold to start rearranging", () => { expect(REARRANGE_HOLD_MS).toBe(2000); });
  it("allocates one slot per tool and multiple slots for wider controls", () => { expect(toolbarSlots("brush")).toBe(1); expect(toolbarSlots("files")).toBe(2); expect(toolbarSlots("title")).toBe(4); expect(emptyToolbarSlots(["files", "title", "brush"], 10)).toBe(3); expect(emptyToolbarSlots(["title"], 2)).toBe(0); });
  it("allows every toolbar control to be moved into and out of the drawer", () => { for (const id of ["files", "title", "more", "undo", "redo", "color", "layers"]) { expect(moveToolbarItem([id, "brush"], id, "drawer")).toEqual(["brush"]); expect(moveToolbarItem(["brush"], id, "toolbar")).toEqual(["brush", id]); } });
  it("places the color circle between redo and layers by default", () => { expect(DEFAULT_TOOLBAR.slice(-3)).toEqual(["redo", "color", "layers"]); });
  it("preserves legacy drawing-tool order while adding movable controls", () => { expect(migrateToolbar(["hand", "brush"])).toEqual(["files", "hand", "brush", "title", "more", "undo", "redo", "color", "layers"]); });
});