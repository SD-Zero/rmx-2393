import { describe, expect, it } from "vitest";
import { artworkName, artworkFilename, DEFAULT_TOOLBAR, moveToolbarItem, validateToolbar } from "./toolbar";
describe("artwork and toolbar rules", () => {
  it("starts unnamed artwork as Untitled", () => { expect(artworkName("")).toBe("Untitled"); expect(artworkFilename("Sunset", "png")).toBe("Sunset.png"); });
  it("moves tools from the drawer into the toolbar", () => { expect(moveToolbarItem(["brush", "eraser"], "hand", "eraser")).toEqual(["brush", "hand", "eraser"]); });
  it("moves toolbar tools back into the drawer", () => { expect(moveToolbarItem(["brush", "eraser"], "eraser", "drawer")).toEqual(["brush"]); });
  it("reorders without duplicating tools", () => { expect(moveToolbarItem(["brush", "eraser", "hand"], "hand", "brush")).toEqual(["hand", "brush", "eraser"]); });
  it("restores validated saved placement including an empty toolbar", () => { expect(validateToolbar(["hand", "hand", "fake", "brush"])).toEqual(["hand", "brush"]); expect(validateToolbar([])).toEqual([]); expect(validateToolbar(null)).toEqual(DEFAULT_TOOLBAR); });
});