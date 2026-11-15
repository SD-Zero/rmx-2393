import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, pointerWithin, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { Ellipsis, Grip, RotateCcw, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOOLBAR_KEY, REARRANGE_HOLD_MS, TOOL_ITEMS, defaultToolbarLayout, landingSlot, placeToolbarItem, removeToolbarItem, toolbarEnd, toolbarSlots, validateToolbarLayout, type Tool, type ToolItem, type ToolbarLayout } from "@/lib/toolbar";

type Props = { activeTool: Tool; onActivate: (id: string) => void; title: string; onTitleChange: (title: string) => void; controls: Record<string, ReactNode>; onOpen: () => void };
function ShelfItem({ item, drawer, active, editing, activate, remove, children, slot }: { item: ToolItem; drawer?: boolean; active: boolean; editing: boolean; activate: () => void; remove: () => void; children?: ReactNode; slot?: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id, disabled: !editing });
  return <div ref={setNodeRef} style={slot === undefined ? undefined : { gridColumn: `${slot + 1} / span ${toolbarSlots(item.id)}` }} data-shelf-item={item.id} data-slots={toolbarSlots(item.id)} className={`shelf-item relative shrink-0 ${drawer ? "shelf-drawer-item" : `shelf-slots-${toolbarSlots(item.id)}`} ${editing ? "shelf-editing" : ""} ${isDragging ? "opacity-25" : ""}`}>
    <div {...(editing ? attributes : {})} {...(editing ? listeners : {})} aria-label={editing ? `Move ${item.label}` : undefined} className={`shelf-item-content ${editing ? "touch-none cursor-grab" : ""}`}>
      {editing ? <div className={`flex h-8 items-center justify-center gap-1 ${drawer ? "h-20 flex-col gap-2 text-[11px]" : ""}`}><item.icon size={18} />{(drawer || item.id === "files" || item.id === "title") && <span className="truncate">{item.id === "title" && children ? children : item.label}</span>}</div> : children ?? <Button variant="ghost" size={drawer ? "default" : "icon"} aria-label={item.label} title={item.label} aria-pressed={active} onClick={activate} className={`${drawer ? "h-20 w-full flex-col gap-2 rounded-lg px-1 text-[11px] whitespace-normal leading-tight" : "size-8 rounded-full"} ${active ? "bg-primary text-primary-foreground hover:bg-primary" : ""}`}><item.icon size={18} /><span className={drawer ? "" : "sr-only"}>{item.label}</span></Button>}
    </div>
    {editing && !drawer && <Button variant="ghost" size="icon" className="absolute -left-1 -top-1 z-10 size-4 rounded-full bg-glass-strong text-foreground" aria-label={`Remove ${item.label}`} title="Move to tools" onPointerDown={(e) => e.stopPropagation()} onClick={remove}><X className="size-3" /></Button>}
  </div>;
}
function DropArea({ id, children, className }: { id: string; children: ReactNode; className: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} data-drop-area={id} className={`${className} ${isOver ? "bg-primary/15 ring-1 ring-primary" : ""}`}>{children}</div>;
}
function SlotCell({ index, circle }: { index: number; circle: boolean }) {
  const { setNodeRef } = useDroppable({ id: `slot:${index}` });
  return <span ref={setNodeRef} data-empty-slot={circle || undefined} className="shelf-empty-slot" style={{ gridColumn: index + 1 }}>{circle && <span />}</span>;
}
export function ToolShelf({ activeTool, onActivate, title, onTitleChange, controls, onOpen }: Props) {
  const [layout, setLayout] = useState<ToolbarLayout | null>(null);
  const saved = useRef<ToolbarLayout | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  const cancelHold = () => { if (hold.current) clearTimeout(hold.current); hold.current = null; start.current = null; };
  function beginEditing() { setEditing(true); setOpen(true); onOpen(); }
  function press(e: PointerEvent) {
    suppressClick.current = false;
    if (editing || e.button !== 0) return;
    cancelHold(); start.current = { x: e.clientX, y: e.clientY };
    hold.current = setTimeout(() => { suppressClick.current = true; beginEditing(); hold.current = null; }, REARRANGE_HOLD_MS);
  }
  useEffect(() => { try { const raw = localStorage.getItem(TOOLBAR_KEY); if (raw) saved.current = validateToolbarLayout(JSON.parse(raw)); } catch { /* Storage may be blocked or ephemeral. */ } setReady(true); }, []);
  // The layout is fixed once shown; it only changes when the user moves something.
  useEffect(() => { if (ready && capacity && !layout) setLayout(saved.current ?? defaultToolbarLayout(capacity)); }, [ready, capacity, layout]);
  function commit(next: ToolbarLayout) { setLayout(next); try { localStorage.setItem(TOOLBAR_KEY, JSON.stringify(next)); } catch { /* Session-only when unavailable. */ } }
  function reset() { if (!capacity) return; setLayout(defaultToolbarLayout(capacity)); try { localStorage.removeItem(TOOLBAR_KEY); } catch { /* Session-only when unavailable. */ } }
  useEffect(() => { const el = bar.current; if (!el) return; const observer = new ResizeObserver(([entry]) => { if (entry) setCapacity(Math.max(1, Math.floor((entry.contentRect.width - 8) / 36))); }); observer.observe(el); return () => observer.disconnect(); }, []);
  useEffect(() => {
    const close = (e: globalThis.PointerEvent) => { if (!dragging && e.target instanceof Node && !root.current?.contains(e.target)) { setOpen(false); setEditing(false); cancelHold(); } };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setEditing(false); cancelHold(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); cancelHold(); };
  }, [dragging]);
  const placed = layout ?? [];
  const cols = layout ? Math.max(capacity ?? 0, toolbarEnd(layout)) : 0;
  const inBar = (id: string) => placed.some((e) => e.id === id);
  const occupied = new Set(placed.flatMap((e) => Array.from({ length: toolbarSlots(e.id) }, (_, i) => e.slot + i)));
  const hovered = over?.startsWith("slot:") ? Number(over.slice(5)) : null;
  const landing = dragging && hovered !== null ? landingSlot(dragging, hovered, cols) : null;
  function finish(e: DragEndEvent) {
    const id = String(e.active.id), target = e.over ? String(e.over.id) : null;
    if (layout && target === "drawer") commit(removeToolbarItem(layout, id));
    else if (layout && target?.startsWith("slot:")) { const next = placeToolbarItem(layout, id, landingSlot(id, Number(target.slice(5)), cols), cols); if (next) commit(next); }
    setDragging(null); setOver(null);
  }
  const drawer = TOOL_ITEMS.filter((t) => !inBar(t.id));
  const dragged = TOOL_ITEMS.find((t) => t.id === dragging);
  function activate(id: string) { if (editing) return; if (id === "more") { setOpen(!open); onOpen(); return; } setOpen(false); onActivate(id); }
  function content(id: string, inDrawer = false): ReactNode {
    if (id === "title") return editing ? title : <input aria-label="Artwork title" value={title} onChange={(e) => onTitleChange(e.target.value)} onFocus={(e) => e.target.select()} onBlur={() => { if (!title.trim()) onTitleChange("Untitled"); }} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") e.currentTarget.blur(); }} maxLength={120} className="h-8 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-center text-sm font-medium text-foreground outline-none hover:bg-muted focus:border-glass-border focus:bg-muted select-text" />;
    if (editing) return undefined;
    if (id === "more") return <Button variant="ghost" size="icon" aria-label="More tools" title="More tools" aria-expanded={open} className={`size-8 rounded-full ${open ? "bg-accent" : ""}`} onClick={() => activate(id)}><Ellipsis /></Button>;
    return controls[id] ? <div className={`flex items-center justify-center ${inDrawer ? "h-20" : "h-8"}`} onClick={() => { if (inDrawer && id !== "files") setOpen(false); }}>{controls[id]}</div> : undefined;
  }
  return <div ref={root} className="pointer-events-none absolute inset-x-0 top-2.5 z-20 px-3" onPointerDownCapture={press} onPointerMoveCapture={(e) => { if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) cancelHold(); }} onPointerUpCapture={cancelHold} onPointerCancelCapture={cancelHold} onClickCapture={(e) => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false; } }}>
    <DndContext sensors={sensors} collisionDetection={(args) => args.pointerCoordinates ? pointerWithin(args) : closestCenter(args)} onDragStart={(e) => { setDragging(String(e.active.id)); setOpen(true); onOpen(); }} onDragOver={(e) => setOver(e.over ? String(e.over.id) : null)} onDragEnd={finish} onDragCancel={() => { setDragging(null); setOver(null); }}>
      <div ref={bar} data-rearranging={editing} className="glass pointer-events-auto rounded-full p-1">
        <div className="shelf-bar flex min-h-10 items-center overflow-x-auto rounded-full px-1 py-1 [scrollbar-width:none]">
          <div className="shelf-grid mx-auto" style={{ gridTemplateColumns: `repeat(${cols}, 32px)` }}>
            {Array.from({ length: cols }, (_, i) => <SlotCell key={i} index={i} circle={editing && !occupied.has(i)} />)}
            {dragging && landing !== null && <span className="shelf-landing" aria-hidden style={{ gridColumn: `${landing + 1} / span ${toolbarSlots(dragging)}` }}>{Array.from({ length: toolbarSlots(dragging) }, (_, i) => <span key={i} className="shelf-empty-slot" data-landing><span /></span>)}</span>}
            {placed.map(({ id, slot }) => { const item = TOOL_ITEMS.find((t) => t.id === id); return item ? <ShelfItem key={id} item={item} slot={slot} active={item.tool === activeTool} editing={editing} activate={() => activate(id)} remove={() => commit(removeToolbarItem(placed, id))}>{content(id)}</ShelfItem> : null; })}
          </div>
          {layout && !inBar("more") && !open && <Button variant="ghost" size="icon" aria-label="More tools" title="More tools" className="size-8 shrink-0 rounded-full" onClick={() => { setOpen(true); onOpen(); }}><Ellipsis /></Button>}
        </div>
      </div>
      {open && <section aria-label="More tools drawer" className="glass-strong pointer-events-auto animate-pop shelf-drawer absolute right-3 top-16 w-[360px] max-w-[calc(100vw-24px)] rounded-2xl p-3">
        <div className="mb-2 flex items-center justify-between"><h2 className="px-1 text-sm font-semibold">Tools</h2><div className="flex"><Button variant="ghost" size="icon" className="size-7 rounded-full" aria-label={editing ? "Finish rearranging" : "Rearrange toolbar"} title={editing ? "Done" : "Rearrange toolbar"} onClick={() => editing ? setEditing(false) : beginEditing()}>{editing ? <Check /> : <Grip />}</Button><Button variant="ghost" size="icon" className="size-7 rounded-full" aria-label="Reset toolbar" title="Reset toolbar" onClick={reset}><RotateCcw /></Button><Button variant="ghost" size="icon" className="size-7 rounded-full" aria-label="Close tools" title="Close tools" onClick={() => { setOpen(false); setEditing(false); }}><X /></Button></div></div>
        <DropArea id="drawer" className="grid min-h-20 grid-cols-4 gap-2 overflow-y-auto overscroll-contain rounded-lg touch-pan-y p-1">
          {drawer.map((item) => <ShelfItem key={item.id} item={item} drawer active={item.tool === activeTool} editing={editing} activate={() => activate(item.id)} remove={() => {}}>{content(item.id, true)}</ShelfItem>)}
        </DropArea>
      </section>}
      <DragOverlay>{dragged && <div className="glass-strong flex size-12 items-center justify-center rounded-xl text-foreground"><dragged.icon size={22} /></div>}</DragOverlay>
    </DndContext>
  </div>;
}
