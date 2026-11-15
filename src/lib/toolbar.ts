import { Brush, PaintBucket, Eraser, Lasso, Move, Droplet, Pointer, Hand, Pipette, Scan, RotateCcw, FlipHorizontal2, FlipVertical2, Copy, SquareDashed, Trash2, Plus, ImagePlus, Download, Folder, Type, Ellipsis, Undo2, Redo2, Layers, Circle, type LucideIcon } from "lucide-react";

export type Tool = "brush" | "bucket" | "eraser" | "lasso" | "transform" | "blur" | "smudge" | "hand" | "eyedropper";
export type ToolItem = { id: string; label: string; icon: LucideIcon; tool?: Tool; slots?: number };
export const REARRANGE_HOLD_MS = 2000;
export const TOOL_ITEMS: ToolItem[] = [
  { id: "files", label: "Files", icon: Folder, slots: 2 },
  { id: "title", label: "Artwork title", icon: Type, slots: 4 },
  { id: "more", label: "More tools", icon: Ellipsis },
  { id: "undo", label: "Undo", icon: Undo2 },
  { id: "redo", label: "Redo", icon: Redo2 },
  { id: "color", label: "Color", icon: Circle },
  { id: "layers", label: "Layers", icon: Layers },
  { id: "brush", label: "Brush", icon: Brush, tool: "brush" },
  { id: "bucket", label: "Paint bucket", icon: PaintBucket, tool: "bucket" },
  { id: "eraser", label: "Eraser", icon: Eraser, tool: "eraser" },
  { id: "lasso", label: "Lasso select", icon: Lasso, tool: "lasso" },
  { id: "transform", label: "Transform", icon: Move, tool: "transform" },
  { id: "blur", label: "Blur", icon: Droplet, tool: "blur" },
  { id: "smudge", label: "Smudge", icon: Pointer, tool: "smudge" },
  { id: "hand", label: "Pan", icon: Hand, tool: "hand" },
  { id: "eyedropper", label: "Eyedropper", icon: Pipette, tool: "eyedropper" },
  { id: "fit", label: "Fit canvas", icon: Scan },
  { id: "resetRotation", label: "Reset rotation", icon: RotateCcw },
  { id: "flipH", label: "Flip horizontal", icon: FlipHorizontal2 },
  { id: "flipV", label: "Flip vertical", icon: FlipVertical2 },
  { id: "duplicate", label: "Duplicate layer", icon: Copy },
  { id: "deselect", label: "Deselect", icon: SquareDashed },
  { id: "clear", label: "Clear layer", icon: Trash2 },
  { id: "addLayer", label: "New layer", icon: Plus },
  { id: "import", label: "Import image", icon: ImagePlus },
  { id: "export", label: "Export PNG", icon: Download },
];
export const DEFAULT_TOOLBAR = ["files", "brush", "bucket", "eraser", "lasso", "transform", "blur", "smudge", "title", "more", "undo", "redo", "color", "layers"];
export const TOOLBAR_KEY = "glass-canvas.toolbar.v2";
export const LEGACY_TOOLBAR_KEY = "glass-canvas.toolbar.v1";
export function toolbarSlots(id: string): number { return TOOL_ITEMS.find((item) => item.id === id)?.slots ?? 1; }
export function emptyToolbarSlots(items: string[], capacity: number): number { return Math.max(0, capacity - items.reduce((total, id) => total + toolbarSlots(id), 0)); }
export function migrateToolbar(value: unknown): string[] { return ["files", ...validateToolbar(value).filter((id) => !["files", "title", "more", "undo", "redo", "color", "layers"].includes(id)), "title", "more", "undo", "redo", "color", "layers"]; }
export function validateToolbar(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && TOOL_ITEMS.some((t) => t.id === id)))] : [...DEFAULT_TOOLBAR];
}
export function moveToolbarItem(items: string[], id: string, target: string): string[] {
  if (!TOOL_ITEMS.some((t) => t.id === id) || id === target) return items;
  const next = items.filter((v) => v !== id);
  if (target === "drawer") return next;
  const index = next.indexOf(target);
  next.splice(index < 0 ? next.length : index, 0, id);
  return next;
}
export type ToolbarPlacement = { id: string; slot: number };
export function packToolbar(items: string[]): ToolbarPlacement[] {
  let slot = 0;
  return items.map((id) => { const placement = { id, slot }; slot += toolbarSlots(id); return placement; });
}
export function validatePlacements(value: unknown): ToolbarPlacement[] {
  if (!Array.isArray(value)) return packToolbar(DEFAULT_TOOLBAR);
  if (value.every((entry) => typeof entry === "string")) return packToolbar(validateToolbar(value));
  const next: ToolbarPlacement[] = [];
  for (const entry of value) {
    if (!entry || typeof entry.id !== "string" || !TOOL_ITEMS.some((t) => t.id === entry.id) || next.some((p) => p.id === entry.id) || !Number.isInteger(entry.slot) || entry.slot < 0 || entry.slot > 200) continue;
    next.push({ id: entry.id, slot: entry.slot });
  }
  return next.sort((a, b) => a.slot - b.slot).reduce<ToolbarPlacement[]>((result, entry) => {
    const last = result.at(-1);
    result.push({ ...entry, slot: Math.max(entry.slot, last ? last.slot + toolbarSlots(last.id) : 0) });
    return result;
  }, []);
}
export function placeToolbarItem(items: ToolbarPlacement[], id: string, slot: number | null): ToolbarPlacement[] {
  if (!TOOL_ITEMS.some((t) => t.id === id)) return items;
  const next = items.filter((p) => p.id !== id).map((p) => ({ ...p }));
  if (slot === null) return next;
  const start = Math.max(0, Math.floor(slot));
  let end = start + toolbarSlots(id);
  for (const item of next.sort((a, b) => a.slot - b.slot)) {
    if (item.slot + toolbarSlots(item.id) <= start) continue;
    if (item.slot < end) item.slot = end;
    end = item.slot + toolbarSlots(item.id);
  }
  return [...next, { id, slot: start }].sort((a, b) => a.slot - b.slot);
}
export function artworkName(title: string): string {
  return title.trim() || "Untitled";
}
export function artworkFilename(title: string, extension: string): string {
  return `${artworkName(title).replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")}.${extension}`;
}