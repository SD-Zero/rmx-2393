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
export type ToolbarLayout = { id: string; slot: number }[];
const DEFAULT_LEFT = ["files", "color", "brush", "bucket", "eraser"];
const DEFAULT_RIGHT = ["more", "undo", "redo", "layers"];
export const DEFAULT_TOOLBAR = [...DEFAULT_LEFT, "title", ...DEFAULT_RIGHT];
export const TOOLBAR_KEY = "glass-canvas.toolbar.v3";
export function toolbarSlots(id: string): number { return TOOL_ITEMS.find((item) => item.id === id)?.slots ?? 1; }
export function toolbarEnd(layout: ToolbarLayout): number { return layout.reduce((end, e) => Math.max(end, e.slot + toolbarSlots(e.id)), 0); }
/** Default placement for a bar with `capacity` slots: left group, centered title, right group. */
export function defaultToolbarLayout(capacity: number): ToolbarLayout {
  const out: ToolbarLayout = [];
  let slot = 0;
  for (const id of DEFAULT_LEFT) { out.push({ id, slot }); slot += toolbarSlots(id); }
  const rightSize = DEFAULT_RIGHT.reduce((n, id) => n + toolbarSlots(id), 0);
  const titleSize = toolbarSlots("title");
  const cols = Math.max(capacity, slot + titleSize + rightSize);
  const rightStart = cols - rightSize;
  out.push({ id: "title", slot: Math.min(Math.max(slot, Math.floor((cols - titleSize) / 2)), rightStart - titleSize) });
  slot = rightStart;
  for (const id of DEFAULT_RIGHT) { out.push({ id, slot }); slot += toolbarSlots(id); }
  return out;
}
/** Keeps known, unique, non-overlapping entries; returns null when the saved value is unusable. */
export function validateToolbarLayout(value: unknown): ToolbarLayout | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const entries = value.filter((e): e is { id: string; slot: number } => !!e && typeof e.id === "string" && TOOL_ITEMS.some((t) => t.id === e.id) && Number.isInteger(e.slot) && e.slot >= 0 && e.slot < 200)
    .sort((a, b) => a.slot - b.slot);
  const out: ToolbarLayout = [];
  let end = 0;
  for (const e of entries) { if (seen.has(e.id) || e.slot < end) continue; seen.add(e.id); out.push({ id: e.id, slot: e.slot }); end = e.slot + toolbarSlots(e.id); }
  return out;
}
/** Start slot for a dragged item centered on the hovered slot. */
export function landingSlot(id: string, hovered: number, cols: number): number {
  const size = toolbarSlots(id);
  return Math.max(0, Math.min(hovered - Math.floor(size / 2), cols - size));
}
/** Places `id` at `start`, keeping gaps; only overlapping neighbours are nudged aside. Returns null when it cannot fit. */
export function placeToolbarItem(layout: ToolbarLayout, id: string, start: number, cols: number): ToolbarLayout | null {
  if (!TOOL_ITEMS.some((t) => t.id === id)) return null;
  const size = toolbarSlots(id);
  if (size > cols) return null;
  start = Math.max(0, Math.min(start, cols - size));
  const others = layout.filter((e) => e.id !== id).sort((a, b) => a.slot - b.slot);
  const splits = [(e: { slot: number }) => e.slot < start, (e: { id: string; slot: number }) => e.slot + toolbarSlots(e.id) <= start];
  for (const isLeft of splits) {
    const left = others.filter(isLeft), right = others.filter((e) => !isLeft(e));
    const out: ToolbarLayout = [{ id, slot: start }];
    let limit = start, ok = true;
    for (let i = left.length - 1; i >= 0; i--) { const slot = Math.min(left[i].slot, limit - toolbarSlots(left[i].id)); if (slot < 0) { ok = false; break; } out.push({ id: left[i].id, slot }); limit = slot; }
    limit = start + size;
    for (const e of right) { if (!ok) break; const slot = Math.max(e.slot, limit); if (slot + toolbarSlots(e.id) > cols) { ok = false; break; } out.push({ id: e.id, slot }); limit = slot + toolbarSlots(e.id); }
    if (ok) return out.sort((a, b) => a.slot - b.slot);
  }
  return null;
}
export function removeToolbarItem(layout: ToolbarLayout, id: string): ToolbarLayout { return layout.filter((e) => e.id !== id); }
export function artworkName(title: string): string {
  return title.trim() || "Untitled";
}
export function artworkFilename(title: string, extension: string): string {
  return `${artworkName(title).replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")}.${extension}`;
}