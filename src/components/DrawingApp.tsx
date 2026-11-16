import { useCallback, useEffect, useRef, useState } from "react";
import { Undo2, Redo2, Layers, Lock, LockOpen } from "lucide-react";
import { LayersPanel, type LayerAction } from "./LayersPanel";
import { children, defaultProps, descendantIds, insertAbove, isLocked, isShown, moveNode, removeNode, siblingBelow, type DropWhere, type NodeProps } from "@/lib/layerTree";
import { floodMask, smudgeStart, smudgeDab, type Smudge } from "@/lib/paintOps";
import { ChevronDown } from "lucide-react";
import { VerticalSlider } from "./VerticalSlider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IS_VERSION, parseIsFile, type IsDoc } from "@/lib/isFormat";
import { ColorPicker } from "./ColorPicker";
import { rememberColor } from "@/lib/colorValues";
import { ToolShelf } from "./ToolShelf";
import { Button } from "@/components/ui/button";
import { SHAPE_TOOLS, TOOL_ITEMS, artworkFilename, artworkName, type Tool } from "@/lib/toolbar";

type Layer = NodeProps & { kind: "layer"; canvas: HTMLCanvasElement };
type FolderNode = NodeProps & { kind: "folder"; canvas?: undefined };
type Node = Layer | FolderNode;
type Entry = { pixels: { id: number; data: ImageData }[]; nodes?: Node[]; active?: number };
type Pt = { x: number; y: number; p: number };

const W = 2048, H = 1536;
type P2 = { x: number; y: number };
const selPath = (pts: P2[], dx = 0, dy = 0) => {
  const p = new Path2D(); pts.forEach((q, i) => (i ? p.lineTo(q.x + dx, q.y + dy) : p.moveTo(q.x + dx, q.y + dy))); p.closePath(); return p;
};
const mkCanvas = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

const MI = "rounded-xl px-3 py-2 text-[15px] focus:bg-primary focus:text-primary-foreground";
const MS = "mx-2 my-1 bg-glass-border";
const DIV = "mx-1 h-5 w-px shrink-0 bg-glass-border";
const TB = "tool-btn size-8";
const SOON = "ml-auto text-xs text-muted-foreground";

let nextId = 1;
const makeLayer = (name: string): Layer => ({ ...defaultProps(), id: nextId++, kind: "layer", name, canvas: mkCanvas(W, H) });
const makeFolder = (name: string): FolderNode => ({ ...defaultProps(), id: nextId++, kind: "folder", name });

export function DrawingApp() {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const strokeRef = useRef<HTMLCanvasElement | null>(null);
  const [layers, setLayers] = useState<Node[]>([]);
  const [activeId, setActiveId] = useState(0);
  const [tool, setTool] = useState<Tool>("brush");
  const [title, setTitle] = useState("Untitled");
  const [color, setColor] = useState("#111111");
  const [recentColors, setRecentColors] = useState(["#111111"]);
  const [size, setSize] = useState(12);
  const [opacity, setOpacity] = useState(100);
  const [panel, setPanel] = useState<null | "color" | "layers">(null);
  const [view, setViewState] = useState({ x: 0, y: 0, s: 1, r: 0 });
  // Always-current copy of the view so rapid events never read a stale value.
  const viewNow = useRef(view);
  const setView = (v: typeof view) => { viewNow.current = v; setViewState(v); };
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [zoomLock, setZoomLock] = useState(false);
  const [rotLock, setRotLock] = useState(false);
  const tap = useRef<{ t: number; max: number; moved: boolean; starts: Map<number, { x: number; y: number }> } | null>(null);
  const undo = useRef<Entry[]>([]);
  const redo = useRef<Entry[]>([]);
  const [rev, force] = useState(0);
  type SmudgeRun = { s: Smudge; work: ImageData; clip: Uint8Array | null; dirty: [number, number, number, number] | null };
  const drawing = useRef<{ pts: Pt[]; layer: Layer; before: ImageData; direct: boolean; sm?: SmudgeRun; shape?: boolean } | null>(null);
  const [sel, setSel] = useState<P2[] | null>(null);
  const lasso = useRef<P2[] | null>(null);
  const [lassoPts, setLassoPts] = useState<P2[] | null>(null);
  const xf = useRef<{ layer: Layer; float: HTMLCanvasElement; sx: number; sy: number; dx: number; dy: number; before: ImageData } | null>(null);
  const [xfOff, setXfOff] = useState({ dx: 0, dy: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ d: number; a: number; cx: number; cy: number; v: typeof view } | null>(null);

  useEffect(() => {
    const bg = makeLayer("Background");
    const ctx = bg.canvas.getContext("2d")!; ctx.fillStyle = "#fbfaf7"; ctx.fillRect(0, 0, W, H);
    const l1 = makeLayer("Layer 1");
    setLayers([bg, l1]); setActiveId(l1.id);
    const s = document.createElement("canvas"); s.width = W; s.height = H; strokeRef.current = s;
    const s0 = Math.min((innerWidth - 40) / W, (innerHeight - 40) / H);
    setView({ s: s0, r: 0, x: (innerWidth - W * s0) / 2, y: (innerHeight - H * s0) / 2 });
    let lw = innerWidth, lh = innerHeight;
    const onResize = () => {
      const v = viewNow.current;
      setView({ ...v, x: v.x + (innerWidth - lw) / 2, y: v.y + (innerHeight - lh) / 2 });
      lw = innerWidth; lh = innerHeight;
    };
    addEventListener("resize", onResize); return () => removeEventListener("resize", onResize);
  }, []);

  const render = useCallback(() => {
    const v = viewRef.current; if (!v) return;
    flushSmudge();
    const ctx = v.getContext("2d")!; ctx.clearRect(0, 0, W, H);
    drawGroup(ctx, layers, null, 0);
  }, [layers, tool, opacity, sel]);
  // Only repaint when layers change — not on every slider tick.
  const renderLatest = useRef(render); renderLatest.current = render;
  useEffect(() => renderLatest.current(), [layers]);

  // Fast strokes fire pointermove far more often than the screen repaints; coalesce to one per frame.
  const pending = useRef(false);
  const scheduleRender = useCallback(() => {
    if (pending.current) return;
    pending.current = true;
    requestAnimationFrame(() => { pending.current = false; renderLatest.current(); });
  }, []);

  // Blur/smudge clip against the selection on every dab, so build that outline once per selection.
  const clipCache = useRef<{ key: P2[] | null; path: Path2D | null }>({ key: null, path: null });
  function selClip() {
    if (!sel) return null;
    const c = clipCache.current;
    if (c.key !== sel) { c.key = sel; c.path = selPath(sel); }
    return c.path;
  }

  // Composites one folder level: folders render into their own buffer, clipping masks are cut to their base layer's pixels.
  const groupBufs = useRef<HTMLCanvasElement[]>([]);
  const clipBuf = useRef<HTMLCanvasElement | null>(null), xfBuf = useRef<HTMLCanvasElement | null>(null);
  function layerSource(l: Layer): HTMLCanvasElement {
    if (drawing.current && !drawing.current.direct && drawing.current.layer.id === l.id && strokeRef.current) return composeLive(l);
    const t = xf.current;
    if (t && t.layer.id === l.id) {
      const b = (xfBuf.current ??= mkCanvas(W, H)), c = b.getContext("2d")!;
      c.globalCompositeOperation = "copy"; c.drawImage(l.canvas, 0, 0); c.globalCompositeOperation = "source-over"; c.drawImage(t.float, t.dx, t.dy); return b;
    }
    return l.canvas;
  }
  function paintNode(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, n: Node) {
    ctx.save(); ctx.globalAlpha = n.opacity / 100; ctx.globalCompositeOperation = n.blend; ctx.drawImage(src, 0, 0); ctx.restore();
  }
  function drawGroup(ctx: CanvasRenderingContext2D, all: Node[], parent: number | null, depth: number) {
    let base: { visible: boolean; src: HTMLCanvasElement } | null = null;
    for (const n of children(all, parent)) {
      if (n.kind === "layer" && n.clip && base) {
        if (!base.visible || !n.visible) continue;
        const b = (clipBuf.current ??= mkCanvas(W, H)), c = b.getContext("2d")!;
        c.globalCompositeOperation = "copy"; c.drawImage(layerSource(n), 0, 0);
        c.globalCompositeOperation = "destination-in"; c.drawImage(base.src, 0, 0); c.globalCompositeOperation = "source-over";
        paintNode(ctx, b, n); continue;
      }
      if (n.kind === "folder") {
        base = null; if (!n.visible) continue;
        const g = (groupBufs.current[depth] ??= mkCanvas(W, H)), gc = g.getContext("2d")!; gc.clearRect(0, 0, W, H);
        drawGroup(gc, all, n.id, depth + 1); paintNode(ctx, g, n); continue;
      }
      const src = layerSource(n); base = { visible: n.visible, src };
      if (n.visible) paintNode(ctx, src, n);
    }
  }

  const liveBuf = useRef<HTMLCanvasElement | null>(null);
  function composeLive(l: Layer) {
    if (!liveBuf.current) { liveBuf.current = document.createElement("canvas"); liveBuf.current.width = W; liveBuf.current.height = H; }
    const c = liveBuf.current.getContext("2d")!;
    c.globalCompositeOperation = "copy"; c.globalAlpha = 1; c.drawImage(l.canvas, 0, 0);
    c.globalCompositeOperation = tool === "eraser" ? "destination-out" : l.alphaLock ? "source-atop" : "source-over";
    c.save(); const clip = selClip(); if (clip) c.clip(clip);
    c.globalAlpha = opacity / 100; c.drawImage(strokeRef.current!, 0, 0); c.restore();
    c.globalCompositeOperation = "source-over"; c.globalAlpha = 1;
    return liveBuf.current;
  }

  const toWorld = (cx: number, cy: number, v = viewNow.current) => {
    const dx = cx - v.x, dy = cy - v.y, a = (-v.r * Math.PI) / 180;
    return { x: (dx * Math.cos(a) - dy * Math.sin(a)) / v.s, y: (dx * Math.sin(a) + dy * Math.cos(a)) / v.s };
  };
  // place view so world point (wx,wy) sits at screen (cx,cy)
  const anchor = (wx: number, wy: number, cx: number, cy: number, s: number, r: number) => {
    const a = (r * Math.PI) / 180, X = wx * s, Y = wy * s;
    return { s, r, x: cx - (X * Math.cos(a) - Y * Math.sin(a)), y: cy - (X * Math.sin(a) + Y * Math.cos(a)) };
  };
  const toCanvas = (e: { clientX: number; clientY: number }) => toWorld(e.clientX, e.clientY);

  function stamp(a: Pt, b: Pt) {
    const ctx = strokeRef.current!.getContext("2d")!;
    const col = tool === "eraser" ? "#000" : color;
    const w = tool === "eraser" ? size : size * (0.25 + b.p * 1.1);
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.5, w);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(a.x, a.y);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    ctx.quadraticCurveTo(a.x, a.y, mx, my); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  // Soft round mask used by blur & smudge dabs: replaces pixels as orig*(1-m) + patch*m.
  const maskCache = useRef(new Map<number, HTMLCanvasElement>());
  function dabMask(d: number) {
    let m = maskCache.current.get(d); if (m) return m;
    m = mkCanvas(d, d); const c = m.getContext("2d")!, g = c.createRadialGradient(d / 2, d / 2, 0, d / 2, d / 2, d / 2);
    g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.5, "rgba(0,0,0,0.7)"); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(0, 0, d, d); maskCache.current.set(d, m); return m;
  }
  const patchBuf = useRef<HTMLCanvasElement | null>(null), smallBuf = useRef<HTMLCanvasElement | null>(null);
  function dab(l: Layer, from: P2, to: P2) {
    const r = Math.max(4, size), d = Math.ceil(r * 2), k = (opacity / 100) * (tool === "blur" ? 0.5 : 0.75);
    if (!patchBuf.current || patchBuf.current.width < d) { patchBuf.current = mkCanvas(d, d); }
    const patch = patchBuf.current, pc = patch.getContext("2d")!;
    pc.globalCompositeOperation = "copy";
    if (tool === "blur") {
      const sz = Math.max(2, Math.round(d / 6));
      if (!smallBuf.current) smallBuf.current = mkCanvas(64, 64);
      const sc = smallBuf.current.getContext("2d")!; sc.globalCompositeOperation = "copy";
      sc.drawImage(l.canvas, to.x - r, to.y - r, d, d, 0, 0, sz, sz);
      pc.imageSmoothingQuality = "high"; pc.drawImage(smallBuf.current, 0, 0, sz, sz, 0, 0, d, d);
    } else pc.drawImage(l.canvas, from.x - r, from.y - r, d, d, 0, 0, d, d);
    pc.globalCompositeOperation = "destination-in"; pc.drawImage(dabMask(d), 0, 0);
    const lc = l.canvas.getContext("2d")!;
    const clip = selClip();
    lc.save(); if (clip) lc.clip(clip); lc.globalAlpha = k;
    lc.globalCompositeOperation = "destination-out"; lc.drawImage(dabMask(d), to.x - r, to.y - r);
    lc.globalCompositeOperation = "lighter"; lc.drawImage(patch, 0, 0, d, d, to.x - r, to.y - r, d, d);
    lc.restore();
  }
  // Smudge paints into a pixel buffer; copy only the changed box onto the layer, once per frame.
  function flushSmudge() {
    const d = drawing.current, sm = d?.sm; if (!d || !sm?.dirty) return;
    const [x0, y0, x1, y1] = sm.dirty; sm.dirty = null;
    d.layer.canvas.getContext("2d")!.putImageData(sm.work, 0, 0, x0, y0, x1 - x0, y1 - y0);
  }
  function smudgeLine(sm: SmudgeRun, a: P2, b: P2) {
    const step = Math.max(1.5, sm.s.R * 0.3), n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    const k = (opacity / 100) * 0.8;
    for (let i = 1; i <= n; i++) {
      const box = smudgeDab(sm.work.data, W, H, sm.s, a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, k, sm.clip);
      if (!box) continue;
      const dt = sm.dirty;
      sm.dirty = dt ? [Math.min(dt[0], box[0]), Math.min(dt[1], box[1]), Math.max(dt[2], box[2]), Math.max(dt[3], box[3])] : box;
    }
  }
  function selMask() {
    if (!sel) return null;
    const c = mkCanvas(W, H), x = c.getContext("2d", { willReadFrequently: true })!;
    x.fill(selPath(sel)); const a = x.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H);
    for (let i = 0; i < m.length; i++) m[i] = a[i * 4 + 3]! > 127 ? 1 : 0;
    return m;
  }
  function dabLine(l: Layer, a: P2, b: P2) {
    const step = Math.max(2, Math.max(4, size) * 0.5), n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step);
    let prev = a;
    for (let i = 1; i <= n; i++) { const q = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }; dab(l, prev, q); prev = q; }
  }
  function pushEntry(e: Entry) {
    undo.current.push(e); if (undo.current.length > 40) undo.current.shift();
    redo.current = []; force((n) => n + 1);
  }
  const pushUndo = (id: number, data: ImageData) => pushEntry({ pixels: [{ id, data }] });
  /** Undo point for changes to the layer list itself (plus any pixels it rewrites). */
  const snapshot = (pixels: Entry["pixels"] = []): Entry => ({ pixels, nodes: layers, active: activeId });
  function bucket(l: Layer, p: P2) {
    const ctx = l.canvas.getContext("2d")!, before = ctx.getImageData(0, 0, W, H);
    const m = floodMask(before.data, W, H, Math.floor(p.x), Math.floor(p.y));
    const n = parseInt(color.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const fill = new ImageData(W, H), fd = fill.data; let any = false;
    for (let i = 0; i < m.length; i++) if (m[i]) { const j = i * 4; fd[j] = r; fd[j + 1] = g; fd[j + 2] = b; fd[j + 3] = 255; any = true; }
    if (!any) return;
    const tmp = mkCanvas(W, H); tmp.getContext("2d")!.putImageData(fill, 0, 0);
    ctx.save(); if (sel) ctx.clip(selPath(sel)); ctx.globalAlpha = opacity / 100; if (l.alphaLock) ctx.globalCompositeOperation = "source-atop"; ctx.drawImage(tmp, 0, 0); ctx.restore();
    pushUndo(l.id, before); render();
  }
  function startTransform(l: Layer, p: P2) {
    const ctx = l.canvas.getContext("2d")!, before = ctx.getImageData(0, 0, W, H);
    const f = mkCanvas(W, H), fc = f.getContext("2d")!;
    fc.save(); if (sel) fc.clip(selPath(sel)); fc.drawImage(l.canvas, 0, 0); fc.restore();
    ctx.save(); if (sel) ctx.clip(selPath(sel)); ctx.clearRect(0, 0, W, H); ctx.restore();
    xf.current = { layer: l, float: f, sx: p.x, sy: p.y, dx: 0, dy: 0, before }; render();
  }
  function finishTransform() {
    const t = xf.current!; xf.current = null;
    t.layer.canvas.getContext("2d")!.drawImage(t.float, t.dx, t.dy);
    if (sel) setSel(sel.map((q) => ({ x: q.x + t.dx, y: q.y + t.dy })));
    setXfOff({ dx: 0, dy: 0 }); if (t.dx || t.dy) pushUndo(t.layer.id, t.before); render();
  }
  function cancelTransient() {
    lasso.current = null; setLassoPts(null);
    const t = xf.current; if (t) { t.layer.canvas.getContext("2d")!.putImageData(t.before, 0, 0); xf.current = null; setXfOff({ dx: 0, dy: 0 }); render(); }
  }

  // Re-tapping the lasso cancels the selection: the marquee goes away, the paint inside stays untouched.
  function pickTool(id: Tool) {
    if (id === "lasso" && tool === "lasso") { lasso.current = null; setLassoPts(null); setSel(null); return; }
    setTool(id);
  }

  const activeNode = layers.find((l) => l.id === activeId);
  const active = activeNode?.kind === "layer" ? activeNode : undefined;

  function onDown(e: React.PointerEvent) {
    setPanel(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === "touch") {
      if (!tap.current || pointers.current.size === 1) tap.current = { t: performance.now(), max: 0, moved: false, starts: new Map() };
      tap.current.starts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      tap.current.max = Math.max(tap.current.max, pointers.current.size);
    }
    if (pointers.current.size > 2) return;
    if (pointers.current.size === 2) {
      if (drawing.current) { drawing.current.layer.canvas.getContext("2d")!.putImageData(drawing.current.before, 0, 0); cancelStroke(); render(); }
      cancelTransient();
      const [p1, p2] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      gesture.current = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), a: Math.atan2(p2.y - p1.y, p2.x - p1.x), cx: (p1.x + p2.x) / 2, cy: (p1.y + p2.y) / 2, v: viewNow.current };
      return;
    }
    if (tool === "hand" || e.button === 1) { gesture.current = { d: 0, a: 0, cx: e.clientX, cy: e.clientY, v: viewNow.current }; return; }
    if (tool === "eyedropper") {
      const p = toCanvas(e), x = Math.floor(p.x), y = Math.floor(p.y);
      if (x >= 0 && y >= 0 && x < W && y < H) {
        const ctx = flatten().getContext("2d");
        const px = ctx?.getImageData(x, y, 1, 1).data;
        if (px && (px[3] ?? 0) > 0) { const c = `#${[px[0] ?? 0, px[1] ?? 0, px[2] ?? 0].map((n) => n.toString(16).padStart(2, "0")).join("")}`; setColor(c); setRecentColors((recent) => rememberColor(recent, c)); }
      }
      return;
    }
    if (!active || !isShown(layers, active.id) || isLocked(layers, active.id)) return;
    const p = toCanvas(e), pr = e.pointerType === "pen" ? e.pressure || 0.5 : 0.5;
    if (tool === "lasso") { lasso.current = [p]; setLassoPts([p]); return; }
    if (tool === "bucket") { bucket(active, p); return; }
    if (tool === "transform") { startTransform(active, p); return; }
    if (tool === "text") { placeText(active, p); return; }
    const direct = tool === "blur" || tool === "smudge";
    const before = active.canvas.getContext("2d")!.getImageData(0, 0, W, H);
    strokeRef.current!.getContext("2d")!.clearRect(0, 0, W, H);
    drawing.current = { pts: [{ ...p, p: pr }], layer: active, before, direct };
    if (tool === "smudge") {
      const work = new ImageData(new Uint8ClampedArray(before.data), W, H);
      drawing.current.sm = { work, clip: selMask(), dirty: null, s: smudgeStart(work.data, W, H, p.x, p.y, Math.max(3, size / 2)) };
    }
    if (SHAPE_TOOLS.includes(tool)) drawing.current.shape = true;
    else if (direct) { if (tool === "blur") dab(active, p, p); } else stamp({ ...p, p: pr }, { ...p, p: pr });
    render();
  }
  function drawShape(a: Pt, b: Pt) {
    const c = strokeRef.current!.getContext("2d")!;
    c.clearRect(0, 0, W, H);
    let dx = b.x - a.x, dy = b.y - a.y;
    if (tool === "circle" || tool === "square") { const m = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * m; dy = Math.sign(dy || 1) * m; }
    const x = Math.min(a.x, a.x + dx), y = Math.min(a.y, a.y + dy), w = Math.abs(dx), h = Math.abs(dy);
    c.save(); c.strokeStyle = color; c.lineWidth = size; c.lineJoin = "round"; c.beginPath();
    if (tool === "circle" || tool === "ellipse") c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (tool === "triangle") { c.moveTo(x + w / 2, y); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath(); }
    else c.rect(x, y, w, h);
    c.stroke(); c.restore();
  }
  function placeText(l: Layer, p: Pt) {
    const text = window.prompt("Text");
    if (!text) return;
    const ctx = l.canvas.getContext("2d")!, before = ctx.getImageData(0, 0, W, H);
    ctx.save(); if (sel) ctx.clip(selPath(sel));
    ctx.globalAlpha = opacity / 100; if (l.alphaLock) ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = color; ctx.font = `${Math.max(12, size * 3)}px -apple-system, system-ui, sans-serif`; ctx.textBaseline = "top";
    text.split("\n").forEach((line, i) => ctx.fillText(line, p.x, p.y + i * Math.max(12, size * 3) * 1.2));
    ctx.restore(); pushUndo(l.id, before); render(); force((n) => n + 1);
  }
  function onMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const st = tap.current?.starts.get(e.pointerId);
    if (st && tap.current && Math.hypot(st.x - e.clientX, st.y - e.clientY) > 12) tap.current.moved = true;
    if (pointers.current.size > 2) return;
    const g = gesture.current;
    if (g) {
      if (pointers.current.size === 2) {
        const [p1, p2] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y), cx = (p1.x + p2.x) / 2, cy = (p1.y + p2.y) / 2;
        const s = zoomLock ? g.v.s : Math.min(8, Math.max(0.1, g.v.s * (d / g.d)));
        let r = g.v.r;
        if (!rotLock) {
          r = g.v.r + ((Math.atan2(p2.y - p1.y, p2.x - p1.x) - g.a) * 180) / Math.PI;
          r = ((r % 360) + 540) % 360 - 180;
          for (const snap of [-180, -90, 0, 90, 180]) if (Math.abs(r - snap) < 3) r = snap;
        }
        const w = toWorld(g.cx, g.cy, g.v);
        setView(anchor(w.x, w.y, cx, cy, s, r));
      } else setView({ ...g.v, x: g.v.x + e.clientX - g.cx, y: g.v.y + e.clientY - g.cy });
      return;
    }
    if (lasso.current) { lasso.current.push(toCanvas(e)); setLassoPts([...lasso.current]); return; }
    const t = xf.current;
    if (t) { const p = toCanvas(e); t.dx = p.x - t.sx; t.dy = p.y - t.sy; setXfOff({ dx: t.dx, dy: t.dy }); scheduleRender(); return; }
    const d = drawing.current; if (!d) return;
    if (d.shape) { drawShape(d.pts[0]!, toCanvas(e)); scheduleRender(); return; }
    const evs = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of evs) {
      const p = toCanvas(ev), pr = ev.pointerType === "pen" ? ev.pressure || 0.5 : 0.5;
      const last = d.pts[d.pts.length - 1]!, np = { ...p, p: last.p * 0.6 + pr * 0.4 };
      if (d.sm) smudgeLine(d.sm, last, np); else if (d.direct) dabLine(d.layer, last, np); else stamp(last, np);
      d.pts.push(np);
    }
    scheduleRender();
  }
  function cancelStroke() { drawing.current = null; strokeRef.current!.getContext("2d")!.clearRect(0, 0, W, H); }
  function onUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    const tp = tap.current;
    if (tp && pointers.current.size === 0) {
      tap.current = null;
      if (!tp.moved && performance.now() - tp.t < 300) {
        if (tp.max === 2) { gesture.current = null; doUndo(); return; }
        if (tp.max === 3) { gesture.current = null; doRedo(); return; }
      }
    }
    if (gesture.current) {
      // A finger lifted mid-gesture: restart from where the view is now so it never jumps back.
      const rest = [...pointers.current.values()];
      if (rest.length === 0) gesture.current = null;
      else if (rest.length === 1) gesture.current = { d: 0, a: 0, cx: rest[0]!.x, cy: rest[0]!.y, v: viewNow.current };
      else if (rest.length === 2) {
        const [p1, p2] = rest as [{ x: number; y: number }, { x: number; y: number }];
        gesture.current = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), a: Math.atan2(p2.y - p1.y, p2.x - p1.x), cx: (p1.x + p2.x) / 2, cy: (p1.y + p2.y) / 2, v: viewNow.current };
      }
      return;
    }
    if (pointers.current.size > 0 && tp && tp.max > 2) return;
    if (lasso.current) {
      const pts = lasso.current; lasso.current = null; setLassoPts(null);
      let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i]!, b = pts[(i + 1) % pts.length]!; area += a.x * b.y - b.x * a.y; }
      setSel(Math.abs(area) / 2 > 16 ? pts : null); return;
    }
    if (xf.current) { finishTransform(); return; }
    const d = drawing.current; if (!d) return;
    if (!d.direct) {
      const ctx = d.layer.canvas.getContext("2d")!;
      ctx.save(); if (sel) ctx.clip(selPath(sel));
      ctx.globalAlpha = opacity / 100; ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : d.layer.alphaLock ? "source-atop" : "source-over";
      ctx.drawImage(strokeRef.current!, 0, 0); ctx.restore();
    }
    flushSmudge();
    if (d.direct && d.layer.alphaLock) {
      // Alpha lock: blur/smudge may recolor pixels but never change where the layer has paint.
      const ctx = d.layer.canvas.getContext("2d")!, now = ctx.getImageData(0, 0, W, H);
      for (let i = 3; i < now.data.length; i += 4) now.data[i] = d.before.data[i]!;
      ctx.putImageData(now, 0, 0);
    }
    pushUndo(d.layer.id, d.before); cancelStroke(); render();
  }
  function wheel(e: WheelEvent) {
    e.preventDefault();
    if (zoomLock) return;
    const v = viewNow.current;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    const s = Math.min(8, Math.max(0.1, v.s * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015))));
    const w = toWorld(e.clientX, e.clientY, v);
    setView(anchor(w.x, w.y, e.clientX, e.clientY, s, v.r));
  }
  const wheelRef = useRef(wheel); wheelRef.current = wheel;
  useEffect(() => {
    const el = surfaceRef.current; if (!el) return;
    const h = (e: WheelEvent) => wheelRef.current(e);
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);

  function history(from: typeof undo, to: typeof undo) {
    const h = from.current.pop(); if (!h) return;
    const pool = [...layers, ...(h.nodes ?? [])];
    const canvasOf = (id: number) => pool.find((x): x is Layer => x.id === id && x.kind === "layer")?.canvas;
    const pixels = h.pixels.filter((p) => canvasOf(p.id));
    to.current.push({ pixels: pixels.map((p) => ({ id: p.id, data: canvasOf(p.id)!.getContext("2d")!.getImageData(0, 0, W, H) })), ...(h.nodes ? { nodes: layers, active: activeId } : {}) });
    for (const p of pixels) canvasOf(p.id)!.getContext("2d")!.putImageData(p.data, 0, 0);
    if (h.nodes) { setLayers(h.nodes); if (h.active !== undefined) setActiveId(h.active); }
    render(); force((n) => n + 1);
  }
  const doUndo = () => history(undo, redo), doRedo = () => history(redo, undo);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.closest('[aria-label="Color picker"]') || e.target.matches("input, textarea, [contenteditable=true]"))) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
      if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d")) { e.preventDefault(); setSel(null); return; }
      const map: Record<string, Tool> = { b: "brush", g: "bucket", e: "eraser", s: "lasso", v: "transform", r: "blur", u: "smudge", h: "hand" };
      if (!e.metaKey && !e.ctrlKey && map[e.key]) setTool(map[e.key]!);
      if (e.key === "[") setSize((s) => Math.max(1, s - 2)); if (e.key === "]") setSize((s) => Math.min(120, s + 2));
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });

  const download = (href: string, name: string) => { const a = document.createElement("a"); a.download = name; a.href = href; a.click(); };
  function flatten(bg?: string) {
    const c = document.createElement("canvas"); c.width = W; c.height = H; const ctx = c.getContext("2d")!;
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
    drawGroup(ctx, layers, null, 0);
    return c;
  }
  const exportPng = () => download(flatten().toDataURL("image/png"), artworkFilename(title, "png"));
  const exportJpeg = () => download(flatten("#ffffff").toDataURL("image/jpeg", 0.92), artworkFilename(title, "jpeg"));
  function exportIs() {
    const doc: IsDoc = { format: "glass-canvas", version: IS_VERSION, width: W, height: H, title: artworkName(title),
      activeIndex: Math.max(0, layers.findIndex((l) => l.id === activeId)),
      brush: { tool, color, size, opacity },
      layers: layers.map((l) => ({ name: l.name, visible: l.visible, kind: l.kind, parent: l.parent === null ? null : layers.findIndex((x) => x.id === l.parent),
        opacity: l.opacity, blend: l.blend, locked: l.locked, alphaLock: l.alphaLock, clip: l.clip, collapsed: l.collapsed,
        ...(l.kind === "layer" ? { png: l.canvas.toDataURL("image/png") } : {}) })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc)], { type: "application/json" }));
    download(url, artworkFilename(title, "is")); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function resetHistory() { undo.current = []; redo.current = []; setSel(null); force((n) => n + 1); }
  function newCanvas() {
    if (!confirm("Start a new canvas? Anything you haven't exported will be lost.")) return;
    const bg = makeLayer("Background"); const ctx = bg.canvas.getContext("2d")!; ctx.fillStyle = "#fbfaf7"; ctx.fillRect(0, 0, W, H);
    const l1 = makeLayer("Layer 1"); setLayers([bg, l1]); setActiveId(l1.id); setTitle("Untitled"); resetHistory(); fit();
  }
  const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Couldn't read that image.")); i.src = src; });
  const pickFile = (accept: string, then: (f: File) => void) => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = accept;
    inp.onchange = () => { const f = inp.files?.[0]; if (f) then(f); }; inp.click();
  };
  const openIs = () => pickFile(".is,application/json", async (f) => {
    try {
      const doc = parseIsFile(await f.text());
      setTitle(typeof doc.title === "string" ? artworkName(doc.title) : "Untitled");
      const ids = doc.layers.map(() => nextId++);
      const next = await Promise.all(doc.layers.map(async (d, i): Promise<Node> => {
        const props = { ...defaultProps(), id: ids[i]!, name: d.name, visible: d.visible !== false, parent: d.parent == null ? null : ids[d.parent]!,
          opacity: d.opacity ?? 100, blend: d.blend ?? "source-over", locked: !!d.locked, alphaLock: !!d.alphaLock, clip: !!d.clip, collapsed: !!d.collapsed };
        if (d.kind === "folder") return { ...props, kind: "folder" };
        const l: Layer = { ...props, kind: "layer", canvas: mkCanvas(W, H) };
        l.canvas.getContext("2d")!.drawImage(await loadImg(d.png!), 0, 0, W, H); return l;
      }));
      setLayers(next); setActiveId(next[doc.activeIndex]!.id);
      const b = doc.brush;
      if (b) { const item = TOOL_ITEMS.find((t) => t.tool === b.tool); if (item?.tool) setTool(item.tool); if (/^#[0-9a-f]{6}$/i.test(b.color)) setColor(b.color); setSize(b.size || 12); setOpacity(b.opacity || 100); }
      resetHistory(); fit();
    } catch (err) { alert((err as Error).message); }
  });
  const importImage = () => pickFile("image/*", async (f) => {
    const url = URL.createObjectURL(f);
    try {
      const img = await loadImg(url);
      const k = Math.min(1, W / img.width, H / img.height), w = img.width * k, h = img.height * k;
      const l = makeLayer(f.name.replace(/\.[^.]+$/, "") || "Image");
      l.canvas.getContext("2d")!.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      setLayers((ls) => [...ls, l]); setActiveId(l.id);
    } catch (err) { alert((err as Error).message); } finally { URL.revokeObjectURL(url); }
  });
  function fit() { const s = Math.min((innerWidth - 40) / W, (innerHeight - 40) / H); setView({ s, r: 0, x: (innerWidth - W * s) / 2, y: (innerHeight - H * s) / 2 }); }

  function activateShelf(id: string) {
    setPanel(null);
    if (id === "undo") { doUndo(); return; }
    if (id === "redo") { doRedo(); return; }
    const item = TOOL_ITEMS.find((t) => t.id === id);
    if (item?.tool) { pickTool(item.tool); return; }
    if (id === "fit") { fit(); return; }
  }

  function patchNode(id: number, patch: Partial<NodeProps>) { setLayers((ls) => ls.map((n) => (n.id === id ? ({ ...n, ...patch } as Node) : n))); }
  function moveLayer(id: number, target: number, where: DropWhere) {
    const next = moveNode(layers, id, target, where); if (!next) return;
    pushEntry(snapshot()); setLayers(next.map((x) => (where === "into" && x.id === target ? { ...x, collapsed: false } : x)));
  }
  function layerAction(a: LayerAction, id: number) {
    const n = layers.find((x) => x.id === id);
    if (a === "add") {
      const l = makeLayer(`Layer ${layers.filter((x) => x.kind === "layer").length}`);
      pushEntry(snapshot());
      setLayers(n?.kind === "folder" ? [...layers.map((x) => (x.id === n.id ? { ...x, collapsed: false } : x)), { ...l, parent: n.id }] : insertAbove<Node>(layers, l, n?.id ?? null));
      setActiveId(l.id); return;
    }
    if (a === "addFolder") {
      const f = makeFolder(`Folder ${layers.filter((x) => x.kind === "folder").length + 1}`);
      pushEntry(snapshot()); setLayers(insertAbove<Node>(layers, f, n?.id ?? null)); setActiveId(f.id); return;
    }
    if (!n) return;
    if (a === "duplicate") {
      const inside = descendantIds(layers, n.id), group = layers.filter((x) => x.id === n.id || inside.has(x.id));
      const ids = new Map(group.map((x) => [x.id, nextId++]));
      const clones = group.map((x): Node => {
        const props = { ...x, id: ids.get(x.id)!, parent: x.id === n.id ? x.parent : ids.get(x.parent!)!, name: x.id === n.id ? `${x.name} copy` : x.name };
        if (x.kind === "folder") return { ...props, kind: "folder", canvas: undefined };
        const c = mkCanvas(W, H); c.getContext("2d")!.drawImage(x.canvas, 0, 0); return { ...props, kind: "layer", canvas: c };
      });
      const i = layers.indexOf(n);
      pushEntry(snapshot()); setLayers([...layers.slice(0, i + 1), ...clones, ...layers.slice(i + 1)]); setActiveId(ids.get(n.id)!); return;
    }
    if (a === "delete") {
      const rest = removeNode(layers, n.id); if (!rest.some((x) => x.kind === "layer") || isLocked(layers, n.id)) return;
      const next = siblingBelow(layers, n.id) ?? layers.find((x) => x.id === n.parent) ?? [...rest].reverse().find((x) => x.kind === "layer")!;
      pushEntry(snapshot()); setLayers(rest); setActiveId(next.id); return;
    }
    if (a === "flatten") {
      if (n.kind !== "folder" || isLocked(layers, n.id)) return;
      const l: Layer = { ...makeLayer(n.name), parent: n.parent, visible: n.visible, opacity: n.opacity, blend: n.blend };
      drawGroup(l.canvas.getContext("2d")!, layers, n.id, 0);
      const inside = descendantIds(layers, n.id);
      pushEntry(snapshot()); setLayers(layers.filter((x) => !inside.has(x.id)).map((x) => (x.id === n.id ? l : x))); setActiveId(l.id); return;
    }
    if (n.kind !== "layer" || isLocked(layers, n.id)) return;
    const ctx = n.canvas.getContext("2d")!, before = ctx.getImageData(0, 0, W, H);
    if (a === "mergeDown") {
      const below = siblingBelow(layers, n.id);
      if (!below || below.kind !== "layer" || isLocked(layers, below.id)) return;
      const bctx = below.canvas.getContext("2d")!, belowBefore = bctx.getImageData(0, 0, W, H);
      const out = mkCanvas(W, H), oc = out.getContext("2d")!;
      oc.globalAlpha = below.opacity / 100; oc.drawImage(below.canvas, 0, 0);
      let src = n.canvas;
      if (n.clip && !below.clip) { src = mkCanvas(W, H); const sc = src.getContext("2d")!; sc.drawImage(n.canvas, 0, 0); sc.globalCompositeOperation = "destination-in"; sc.drawImage(below.canvas, 0, 0); }
      oc.globalAlpha = n.opacity / 100; oc.globalCompositeOperation = n.blend; oc.drawImage(src, 0, 0);
      pushEntry(snapshot([{ id: below.id, data: belowBefore }]));
      bctx.globalCompositeOperation = "copy"; bctx.drawImage(out, 0, 0); bctx.globalCompositeOperation = "source-over";
      setLayers(layers.filter((x) => x.id !== n.id).map((x) => (x.id === below.id ? { ...x, opacity: 100 } : x))); setActiveId(below.id); return;
    }
    if (a === "clear") ctx.clearRect(0, 0, W, H);
    if (a === "invert") {
      const inv = new ImageData(new Uint8ClampedArray(before.data), W, H), d = inv.data;
      for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]!; d[i + 1] = 255 - d[i + 1]!; d[i + 2] = 255 - d[i + 2]!; }
      if (!sel) ctx.putImageData(inv, 0, 0);
      else { const t = mkCanvas(W, H); t.getContext("2d")!.putImageData(inv, 0, 0); ctx.save(); ctx.clip(selPath(sel)); ctx.clearRect(0, 0, W, H); ctx.drawImage(t, 0, 0); ctx.restore(); }
    }
    if (a === "flipH" || a === "flipV") {
      const copy = mkCanvas(W, H); copy.getContext("2d")!.drawImage(n.canvas, 0, 0);
      ctx.save(); ctx.clearRect(0, 0, W, H); ctx.translate(a === "flipH" ? W : 0, a === "flipV" ? H : 0); ctx.scale(a === "flipH" ? -1 : 1, a === "flipV" ? -1 : 1); ctx.drawImage(copy, 0, 0); ctx.restore();
    }
    pushUndo(n.id, before); render();
  }

  return (
    <div className="fixed inset-0 overflow-hidden touch-none">
      <div ref={surfaceRef} className="absolute inset-0" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ cursor: tool === "hand" ? "grab" : tool === "transform" ? "move" : "crosshair" }}>
        <canvas ref={viewRef} width={W} height={H} className="absolute left-0 top-0 origin-top-left rounded-sm shadow-2xl"
          style={{ transform: `translate(${view.x}px, ${view.y}px) rotate(${view.r}deg) scale(${view.s})` }} />
        {(sel || lassoPts) && (
          <svg width={W} height={H} className="pointer-events-none absolute left-0 top-0 origin-top-left overflow-visible"
            style={{ transform: `translate(${view.x}px, ${view.y}px) rotate(${view.r}deg) scale(${view.s})` }}>
            {sel && <polygon points={sel.map((q) => `${q.x + xfOff.dx},${q.y + xfOff.dy}`).join(" ")} className="ants fill-primary/10 stroke-primary" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeDasharray="6 4" />}
            {lassoPts && <polyline points={lassoPts.map((q) => `${q.x},${q.y}`).join(" ")} className="fill-none stroke-primary" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeDasharray="6 4" />}
          </svg>
        )}
      </div>

      {/* Top bar */}
      <ToolShelf activeTool={tool} onActivate={activateShelf} title={title} onTitleChange={setTitle} onOpen={() => setPanel(null)}
        controls={{
          color: <Button variant="ghost" onClick={() => setPanel(panel === "color" ? null : "color")} aria-label="Color" title="Color" className="size-5 shrink-0 rounded-full border border-foreground/60 p-0" style={{ background: color }} />,
          undo: <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={doUndo} disabled={!undo.current.length} aria-label="Undo" title="Undo"><Undo2 size={16} /></Button>,
          redo: <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={doRedo} disabled={!redo.current.length} aria-label="Redo" title="Redo"><Redo2 size={16} /></Button>,
          layers: <Button variant="ghost" size="icon" className={`size-8 rounded-full ${panel === "layers" ? "bg-accent" : ""}`} onClick={() => setPanel(panel === "layers" ? null : "layers")} aria-label="Layers" title="Layers"><Layers size={16} /></Button>,
          files: <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" aria-label="File" className="flex h-8 w-full shrink-0 items-center gap-1 rounded-full px-2 text-[13px] font-semibold outline-none transition-colors hover:bg-accent data-[state=open]:bg-accent">
              File <ChevronDown size={13} className="opacity-70" />
            </Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={10} className="glass-strong min-w-56 rounded-2xl border-glass-border p-1.5 text-foreground">
              <DropdownMenuItem className={MI} onSelect={newCanvas}>New Canvas</DropdownMenuItem>
              <DropdownMenuSeparator className={MS} />
              <DropdownMenuItem className={MI} onSelect={openIs}>Open .is file</DropdownMenuItem>
              <DropdownMenuSeparator className={MS} />
              <DropdownMenuItem className={MI} onSelect={importImage}>Import Image</DropdownMenuItem>
              <DropdownMenuSeparator className={MS} />
              <DropdownMenuItem className={MI} onSelect={exportPng}>Export as .png</DropdownMenuItem>
              <DropdownMenuItem className={MI} onSelect={exportJpeg}>Export as .jpeg</DropdownMenuItem>
              <DropdownMenuItem className={MI} onSelect={exportIs}>Export as .is</DropdownMenuItem>
              <DropdownMenuSeparator className={MS} />
              <DropdownMenuItem className={MI} disabled>Animation Mode<span className={SOON}>Soon</span></DropdownMenuItem>
              <DropdownMenuSeparator className={MS} />
              <DropdownMenuItem className={MI} disabled>FX<span className={SOON}>Soon</span></DropdownMenuItem>
              <DropdownMenuSeparator className={MS} />
              <DropdownMenuItem className={MI} disabled>View Timelapse<span className={SOON}>Soon</span></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu> }} />

      {panel === "color" && (
        <ColorPicker color={color} recent={recentColors} onChange={setColor} onCommit={(c) => setRecentColors((recent) => rememberColor(recent, c))} onClose={() => setPanel(null)} />
      )}

      {panel === "layers" && (
        <LayersPanel nodes={layers} activeId={activeId} rev={rev} onSelect={setActiveId} onPatch={patchNode} onAction={layerAction} onMove={moveLayer} />
      )}

      {/* Left sliders */}
      <div className="absolute left-3 top-1/2 flex -translate-y-1/2 flex-col gap-2.5">
        <VerticalSlider label="Brush size" value={size} min={1} max={120} onChange={setSize} format={(v) => `${v}`}
          preview={<div className="rounded-full border border-primary-foreground/80 shadow-[0_0_0_1px_rgb(0_0_0/0.35)]" style={{ width: Math.max(2, size * view.s), height: Math.max(2, size * view.s), background: color }} />} />
        <VerticalSlider label="Opacity" value={opacity} min={1} max={100} onChange={setOpacity} format={(v) => `${v}%`} />
      </div>

      <div className="glass absolute bottom-3 right-3 flex items-center gap-1 rounded-full p-1 text-xs tabular-nums">
        <button onClick={() => setZoomLock(!zoomLock)} aria-label="Lock zoom" className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors ${zoomLock ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
          {zoomLock ? <Lock size={12} /> : <LockOpen size={12} />}{Math.round(view.s * 100)}%
        </button>
        <button onClick={() => setRotLock(!rotLock)} aria-label="Lock rotation" className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors ${rotLock ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
          {rotLock ? <Lock size={12} /> : <LockOpen size={12} />}{Math.round(view.r)}°
        </button>
      </div>
    </div>
  );
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
