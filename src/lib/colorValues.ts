import { colord } from "colord";

export type ColorMode = "Hex" | "RGB" | "HSL";

export function colorFields(color: string, mode: ColorMode): string[] {
  const c = colord(color);
  if (mode === "Hex") return [c.toHex().toUpperCase()];
  if (mode === "RGB") { const { r, g, b } = c.toRgb(); return [r, g, b].map(String); }
  const { h, s, l } = c.toHsl();
  return [h, s, l].map(String);
}

export function parseColorFields(fields: string[], mode: ColorMode): string | null {
  if (mode === "Hex") {
    const value = fields[0]?.trim().replace(/^#/, "") ?? "";
    return /^(?:[\da-f]{3}|[\da-f]{6})$/i.test(value) ? colord(`#${value}`).toHex() : null;
  }
  if (fields.length !== 3 || fields.some((v) => !/^\d+(?:\.\d+)?$/.test(v.trim()))) return null;
  const [a = 0, b = 0, c = 0] = fields.map(Number);
  const limits = mode === "RGB" ? [255, 255, 255] : [360, 100, 100];
  if ([a, b, c].some((v, i) => v < 0 || v > (limits[i] ?? 0))) return null;
  return colord(mode === "RGB" ? { r: a, g: b, b: c } : { h: a, s: b, l: c }).toHex();
}

export function rememberColor(recent: string[], color: string): string[] {
  const hex = colord(color).toHex();
  return [hex, ...recent.filter((c) => colord(c).toHex() !== hex)].slice(0, 12);
}