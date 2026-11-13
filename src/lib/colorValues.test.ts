import { describe, expect, it } from "vitest";
import { colorFields, parseColorFields, rememberColor } from "./colorValues";

describe("custom color values", () => {
  it("accepts hex codes including short hex", () => {
    expect(parseColorFields(["#f00"], "Hex")).toBe("#ff0000");
    expect(parseColorFields(["FFFFFF"], "Hex")).toBe("#ffffff");
    expect(parseColorFields(["#nope"], "Hex")).toBeNull();
  });
  it("accepts RGB colors and both black and white", () => {
    expect(parseColorFields(["255", "0", "0"], "RGB")).toBe("#ff0000");
    expect(parseColorFields(["0", "0", "0"], "RGB")).toBe("#000000");
    expect(parseColorFields(["255", "255", "255"], "RGB")).toBe("#ffffff");
    expect(parseColorFields(["256", "0", "0"], "RGB")).toBeNull();
  });
  it("accepts HSL and converts between the switchable formats", () => {
    expect(parseColorFields(["120", "100", "50"], "HSL")).toBe("#00ff00");
    expect(colorFields("#00ff00", "RGB")).toEqual(["0", "255", "0"]);
    expect(colorFields("#00ff00", "HSL")).toEqual(["120", "100", "50"]);
    expect(parseColorFields(["120", "101", "50"], "HSL")).toBeNull();
  });
  it("keeps recent colors newest first without duplicates", () => {
    expect(rememberColor(["#ff0000", "#000000"], "#000000")).toEqual(["#000000", "#ff0000"]);
  });
});