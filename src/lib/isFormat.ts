// ".is" — Glass Canvas project file: every layer plus brush/color settings, so work can be reopened and edited.
export const IS_VERSION = 1;

export type IsLayer = { name: string; visible: boolean; png: string };
export type IsDoc = {
  format: "glass-canvas";
  version: number;
  width: number;
  height: number;
  activeIndex: number;
  brush: { tool: string; color: string; size: number; opacity: number };
  layers: IsLayer[];
};

export function parseIsFile(text: string): IsDoc {
  let d: unknown;
  try { d = JSON.parse(text); } catch { throw new Error("This file isn't a valid .is file."); }
  const doc = d as Partial<IsDoc>;
  if (!doc || doc.format !== "glass-canvas") throw new Error("This file isn't a valid .is file.");
  if (typeof doc.version !== "number" || doc.version > IS_VERSION) throw new Error("This .is file was made by a newer version.");
  if (!Array.isArray(doc.layers) || doc.layers.length === 0) throw new Error("This .is file has no layers.");
  for (const l of doc.layers) {
    if (!l || typeof l.name !== "string" || typeof l.png !== "string" || !l.png.startsWith("data:image/")) throw new Error("This .is file has a damaged layer.");
  }
  const activeIndex = Math.min(doc.layers.length - 1, Math.max(0, Number(doc.activeIndex) || 0));
  return { ...(doc as IsDoc), activeIndex };
}
