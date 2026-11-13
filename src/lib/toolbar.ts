import { Brush, PaintBucket, Eraser, Lasso, Move, Droplet, Pointer, Hand, Pipette, Scan, RotateCcw, FlipHorizontal2, FlipVertical2, Copy, SquareDashed, Trash2, Plus, ImagePlus, Download, type LucideIcon } from "lucide-react";

export type Tool = "brush" | "bucket" | "eraser" | "lasso" | "transform" | "blur" | "smudge" | "hand" | "eyedropper";
export type ToolItem = { id: string; label: string; icon: LucideIcon; tool?: Tool };
export const TOOL_ITEMS: ToolItem[] = [
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
export const DEFAULT_TOOLBAR = ["brush", "bucket", "eraser", "lasso", "transform", "blur", "smudge"];
export const TOOLBAR_KEY = "glass-canvas.toolbar.v1";
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
export function artworkName(title: string): string {
  return title.trim() || "Untitled";
}
export function artworkFilename(title: string, extension: string): string {
  return `${artworkName(title).replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")}.${extension}`;
}