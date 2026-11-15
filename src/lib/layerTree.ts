// Layer stack rules: a flat list where each node points at its parent folder (null = top level).
// Siblings are ordered by list position, bottom of the stack first.
export const BLEND_MODES = [
  { value: "source-over", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color dodge" },
  { value: "color-burn", label: "Color burn" },
  { value: "hard-light", label: "Hard light" },
  { value: "soft-light", label: "Soft light" },
  { value: "difference", label: "Difference" },
  { value: "exclusion", label: "Exclusion" },
  { value: "hue", label: "Hue" },
  { value: "saturation", label: "Saturation" },
  { value: "color", label: "Color" },
  { value: "luminosity", label: "Luminosity" },
] as const;
export type BlendMode = (typeof BLEND_MODES)[number]["value"];
export const isBlendMode = (v: unknown): v is BlendMode => BLEND_MODES.some((b) => b.value === v);

export type NodeProps = {
  id: number; parent: number | null; kind: "layer" | "folder"; name: string;
  visible: boolean; locked: boolean; opacity: number; blend: BlendMode;
  alphaLock: boolean; clip: boolean; collapsed: boolean;
};
type T = { id: number; parent: number | null; kind: "layer" | "folder" };
export type DropWhere = "above" | "below" | "into";

export const defaultProps = (): Omit<NodeProps, "id" | "kind" | "name"> => ({ parent: null, visible: true, locked: false, opacity: 100, blend: "source-over", alphaLock: false, clip: false, collapsed: false });
export const children = <N extends T>(nodes: N[], parent: number | null) => nodes.filter((n) => n.parent === parent);
export function descendantIds(nodes: T[], id: number): Set<number> {
  const out = new Set<number>(); let grew = true;
  while (grew) { grew = false; for (const n of nodes) if (n.parent !== null && (n.parent === id || out.has(n.parent)) && !out.has(n.id)) { out.add(n.id); grew = true; } }
  return out;
}
export function ancestors<N extends T>(nodes: N[], id: number): N[] {
  const out: N[] = []; let cur = nodes.find((n) => n.id === id);
  while (cur && cur.parent !== null && out.length < nodes.length) { const p = nodes.find((n) => n.id === cur!.parent); if (!p) break; out.push(p); cur = p; }
  return out;
}
/** A layer can't be painted when it or any folder around it is locked. */
export const isLocked = (nodes: (T & { locked: boolean })[], id: number) => [nodes.find((n) => n.id === id), ...ancestors(nodes, id)].some((n) => n?.locked);
/** A layer is shown only when it and every folder around it are visible. */
export const isShown = (nodes: (T & { visible: boolean })[], id: number) => [nodes.find((n) => n.id === id), ...ancestors(nodes, id)].every((n) => n?.visible);
/** Sibling directly below in the stack, or null. */
export function siblingBelow<N extends T>(nodes: N[], id: number): N | null {
  const n = nodes.find((x) => x.id === id); if (!n) return null;
  const sibs = children(nodes, n.parent), i = sibs.findIndex((x) => x.id === id);
  return i > 0 ? sibs[i - 1]! : null;
}
/** Layer that a clipping mask clips to: the nearest non-clipping sibling below, if it is a layer. */
export function clipBase<N extends T & { clip: boolean }>(nodes: N[], id: number): N | null {
  let cur = siblingBelow(nodes, id);
  while (cur && cur.kind === "layer" && cur.clip) cur = siblingBelow(nodes, cur.id);
  return cur && cur.kind === "layer" ? cur : null;
}
/** Moves a node (with its contents) above/below a target or into the top of a folder. Null when impossible. */
export function moveNode<N extends T>(nodes: N[], id: number, target: number, where: DropWhere): N[] | null {
  const n = nodes.find((x) => x.id === id), t = nodes.find((x) => x.id === target);
  if (!n || !t || id === target || descendantIds(nodes, id).has(target)) return null;
  if (where === "into" && t.kind !== "folder") return null;
  const rest = nodes.filter((x) => x.id !== id);
  const moved = { ...n, parent: where === "into" ? t.id : t.parent };
  if (where === "into") return [...rest, moved];
  const ti = rest.findIndex((x) => x.id === target);
  rest.splice(where === "above" ? ti + 1 : ti, 0, moved);
  return rest;
}
/** Removes a node and everything inside it. */
export function removeNode<N extends T>(nodes: N[], id: number): N[] { const gone = descendantIds(nodes, id); gone.add(id); return nodes.filter((n) => !gone.has(n.id)); }
/** Inserts `node` directly above `ref` in the same folder, or at the top level when ref is missing. */
export function insertAbove<N extends T>(nodes: N[], node: N, ref: number | null): N[] {
  const r = nodes.find((x) => x.id === ref); if (!r) return [...nodes, { ...node, parent: null }];
  const i = nodes.indexOf(r), out = [...nodes]; out.splice(i + 1, 0, { ...node, parent: r.parent }); return out;
}
/** Wraps a node in a new folder that takes its place in the stack. */
export function wrapInFolder<N extends T>(nodes: N[], folder: N, id: number): N[] {
  const n = nodes.find((x) => x.id === id); if (!n) return [...nodes, folder];
  return nodes.flatMap((x) => (x.id === id ? [{ ...folder, parent: n.parent }, { ...x, parent: folder.id }] : [x]));
}
/** Rows for the layers list, top of the stack first, hiding the contents of collapsed folders. */
export function displayRows<N extends T & { collapsed: boolean }>(nodes: N[], parent: number | null = null, depth = 0): { node: N; depth: number }[] {
  return children(nodes, parent).reverse().flatMap((n) => [{ node: n, depth }, ...(n.kind === "folder" && !n.collapsed ? displayRows(nodes, n.id, depth + 1) : [])]);
}
