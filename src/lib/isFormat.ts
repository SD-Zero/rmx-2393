// ".is" — Glass Canvas project file: every layer and folder plus brush/color settings, so work can be reopened and edited.
import { isBlendMode, type BlendMode } from "./layerTree";

export const IS_VERSION = 2;

/** `parent` is the index of the containing folder in `layers`, or null. Folders have no png. */
export type IsLayer = {
  name: string; visible: boolean; png?: string; kind?: "layer" | "folder"; parent?: number | null;
  opacity?: number; blend?: BlendMode; locked?: boolean; alphaLock?: boolean; clip?: boolean; collapsed?: boolean;
};
export type IsDoc = {
  format: "glass-canvas";
  version: number;
  width: number;
  height: number;
  title?: string;
  activeIndex: number;
  brush: { tool: string; color: string; size: number; opacity: number };
  layers: IsLayer[];
};

const bad = () => new Error("This .is file has a damaged layer.");
export function parseIsFile(text: string): IsDoc {
  let d: unknown;
  try { d = JSON.parse(text); } catch { throw new Error("This file isn't a valid .is file."); }
  const doc = d as Partial<IsDoc>;
  if (!doc || doc.format !== "glass-canvas") throw new Error("This file isn't a valid .is file.");
  if (typeof doc.version !== "number" || doc.version > IS_VERSION) throw new Error("This .is file was made by a newer version.");
  if (!Array.isArray(doc.layers) || doc.layers.length === 0) throw new Error("This .is file has no layers.");
  const raw = doc.layers as Partial<IsLayer>[];
  const layers: IsLayer[] = raw.map((l) => {
    if (!l || typeof l.name !== "string") throw bad();
    const kind = l.kind === "folder" ? "folder" : "layer";
    if (kind === "layer" && (typeof l.png !== "string" || !l.png.startsWith("data:image/"))) throw bad();
    const op = Number(l.opacity);
    return {
      name: l.name, visible: l.visible !== false, kind, ...(kind === "layer" ? { png: l.png } : {}),
      parent: null, opacity: Number.isFinite(op) ? Math.min(100, Math.max(0, op)) : 100,
      blend: isBlendMode(l.blend) ? l.blend : "source-over", locked: l.locked === true,
      alphaLock: l.alphaLock === true, clip: l.clip === true, collapsed: l.collapsed === true,
    };
  });
  if (!layers.some((l) => l.kind === "layer")) throw new Error("This .is file has no layers.");
  // Keep only parents that point at a folder, then drop any loop.
  raw.forEach((l, i) => { const p = l.parent; if (typeof p === "number" && Number.isInteger(p) && p !== i && layers[p]?.kind === "folder") layers[i]!.parent = p; });
  layers.forEach((l, i) => {
    const seen = new Set([i]); let p = l.parent;
    while (p !== null && p !== undefined) { if (seen.has(p)) { l.parent = null; break; } seen.add(p); p = layers[p]!.parent; }
  });
  const activeIndex = Math.min(layers.length - 1, Math.max(0, Number(doc.activeIndex) || 0));
  return { ...(doc as IsDoc), layers, activeIndex };
}
