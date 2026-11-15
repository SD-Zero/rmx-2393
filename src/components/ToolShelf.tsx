import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDroppable, useSensor, useSensors, pointerWithin, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, sortableKeyboardCoordinates, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { Ellipsis, Grip, RotateCcw, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_TOOLBAR, TOOLBAR_KEY, LEGACY_TOOLBAR_KEY, REARRANGE_HOLD_MS, TOOL_ITEMS, emptyToolbarSlots, migrateToolbar, toolbarSlots, moveToolbarItem, validateToolbar, type Tool, type ToolItem } from "@/lib/toolbar";

type Props = { activeTool: Tool; onActivate: (id: string) => void; title: string; onTitleChange: (title: string) => void; controls: Record<string, ReactNode>; onOpen: () => void };
function ShelfItem({ item, drawer, active, editing, activate, remove, children }: { item: ToolItem; drawer?: boolean; active: boolean; editing: boolean; activate: () => void; remove: () => void; children?: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: item.id, disabled: !editing });
  return <div ref={setNodeRef} data-shelf-item={item.id} data-slots={toolbarSlots(item.id)} className={`shelf-item relative shrink-0 ${drawer ? "shelf-drawer-item" : `shelf-slots-${toolbarSlots(item.id)}`} ${editing ? "shelf-editing" : ""} ${isDragging ? "opacity-25" : ""}`}>
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
export function ToolShelf({ activeTool, onActivate, title, onTitleChange, controls, onOpen }: Props) {
  const [items, setItems] = useState([...DEFAULT_TOOLBAR]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [capacity, setCapacity] = useState(18);
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const cancelHold = () => { if (hold.current) clearTimeout(hold.current); hold.current = null; start.current = null; };
  function beginEditing() { setEditing(true); setOpen(true); onOpen(); }
  function press(e: PointerEvent) {
    suppressClick.current = false;
    if (editing || e.button !== 0) return;
    cancelHold(); start.current = { x: e.clientX, y: e.clientY };
    hold.current = setTimeout(() => { suppressClick.current = true; beginEditing(); hold.current = null; }, REARRANGE_HOLD_MS);
  }
  useEffect(() => { try { const saved = localStorage.getItem(TOOLBAR_KEY); const legacy = localStorage.getItem(LEGACY_TOOLBAR_KEY); if (saved) setItems(validateToolbar(JSON.parse(saved))); else if (legacy) setItems(migrateToolbar(JSON.parse(legacy))); } catch { /* Storage may be blocked or ephemeral. */ } setReady(true); }, []);
  useEffect(() => { if (ready) { try { localStorage.setItem(TOOLBAR_KEY, JSON.stringify(items)); } catch { /* Session-only when unavailable. */ } } }, [items, ready]);
  useEffect(() => { const el = bar.current; if (!el) return; const observer = new ResizeObserver(([entry]) => { if (entry) setCapacity(Math.max(1, Math.floor((entry.contentRect.width - 8) / 36))); }); observer.observe(el); return () => observer.disconnect(); }, []);
  useEffect(() => {
    const close = (e: globalThis.PointerEvent) => { if (!dragging && e.target instanceof Node && !root.current?.contains(e.target)) { setOpen(false); setEditing(false); cancelHold(); } };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setEditing(false); cancelHold(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); cancelHold(); };
  }, [dragging]);
  function finish(e: DragEndEvent) {
    if (e.over) { const target = String(e.over.id); setItems((v) => moveToolbarItem(v, String(e.active.id), target === "drawer" || (!v.includes(target) && target !== "toolbar") ? "drawer" : target)); }
    setDragging(null);
  }
  const drawer = TOOL_ITEMS.filter((t) => !items.includes(t.id));
  const dragged = TOOL_ITEMS.find((t) => t.id === dragging);
  function activate(id: string) { if (editing) return; if (id === "more") { setOpen(!open); onOpen(); return; } setOpen(false); onActivate(id); }
  function content(id: string, inDrawer = false): ReactNode {
    if (id === "title") return editing ? title : <input aria-label="Artwork title" value={title} onChange={(e) => onTitleChange(e.target.value)} onFocus={(e) => e.target.select()} onBlur={() => { if (!title.trim()) onTitleChange("Untitled"); }} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") e.currentTarget.blur(); }} maxLength={120} className="h-8 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-center text-sm font-medium text-foreground outline-none hover:bg-muted focus:border-glass-border focus:bg-muted select-text" />;
    if (editing) return undefined;
    if (id === "more") return <Button variant="ghost" size="icon" aria-label="More tools" title="More tools" aria-expanded={open} className={`size-8 rounded-full ${open ? "bg-accent" : ""}`} onClick={() => activate(id)}><Ellipsis /></Button>;
    return controls[id] ? <div className={`flex items-center justify-center ${inDrawer ? "h-20" : "h-8"}`} onClick={() => { if (inDrawer && id !== "files") setOpen(false); }}>{controls[id]}</div> : undefined;
  }
  return <div ref={root} className="pointer-events-none absolute inset-x-0 top-2.5 z-20 px-3" onPointerDownCapture={press} onPointerMoveCapture={(e) => { if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) cancelHold(); }} onPointerUpCapture={cancelHold} onPointerCancelCapture={cancelHold} onClickCapture={(e) => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false; } }}>
    <DndContext sensors={sensors} collisionDetection={(args) => args.pointerCoordinates ? pointerWithin(args) : closestCenter(args)} onDragStart={(e) => { setDragging(String(e.active.id)); setOpen(true); onOpen(); }} onDragEnd={finish} onDragCancel={() => setDragging(null)}>
      <div ref={bar} data-rearranging={editing} className="glass pointer-events-auto rounded-full p-1">
        <DropArea id="toolbar" className="shelf-bar flex min-h-10 items-center overflow-x-auto rounded-full px-1 py-1 [scrollbar-width:none]">
          <SortableContext items={items} strategy={horizontalListSortingStrategy}>
            {items.map((id) => { const item = TOOL_ITEMS.find((t) => t.id === id); return item ? <ShelfItem key={id} item={item} active={item.tool === activeTool} editing={editing} activate={() => activate(id)} remove={() => setItems((v) => moveToolbarItem(v, id, "drawer"))}>{content(id)}</ShelfItem> : null; })}
          </SortableContext>
          {editing && Array.from({ length: emptyToolbarSlots(items, capacity) }, (_, i) => <span key={i} data-empty-slot className="shelf-empty-slot"><span /></span>)}
          {!items.includes("more") && !open && <Button variant="ghost" size="icon" aria-label="More tools" title="More tools" className="size-8 shrink-0 rounded-full" onClick={() => { setOpen(true); onOpen(); }}><Ellipsis /></Button>}
        </DropArea>
      </div>
      {open && <section aria-label="More tools drawer" className="glass-strong pointer-events-auto animate-pop shelf-drawer absolute right-3 top-16 w-[360px] max-w-[calc(100vw-24px)] rounded-2xl p-3">
        <div className="mb-2 flex items-center justify-between"><h2 className="px-1 text-sm font-semibold">Tools</h2><div className="flex"><Button variant="ghost" size="icon" className="size-7 rounded-full" aria-label={editing ? "Finish rearranging" : "Rearrange toolbar"} title={editing ? "Done" : "Rearrange toolbar"} onClick={() => editing ? setEditing(false) : beginEditing()}>{editing ? <Check /> : <Grip />}</Button><Button variant="ghost" size="icon" className="size-7 rounded-full" aria-label="Reset toolbar" title="Reset toolbar" onClick={() => setItems([...DEFAULT_TOOLBAR])}><RotateCcw /></Button><Button variant="ghost" size="icon" className="size-7 rounded-full" aria-label="Close tools" title="Close tools" onClick={() => { setOpen(false); setEditing(false); }}><X /></Button></div></div>
        <DropArea id="drawer" className="grid min-h-20 grid-cols-4 gap-2 overflow-y-auto overscroll-contain rounded-lg touch-pan-y p-1">
          <SortableContext items={drawer.map((t) => t.id)}>{drawer.map((item) => <ShelfItem key={item.id} item={item} drawer active={item.tool === activeTool} editing={editing} activate={() => activate(item.id)} remove={() => {}}>{content(item.id, true)}</ShelfItem>)}</SortableContext>
        </DropArea>
      </section>}
      <DragOverlay>{dragged && <div className="glass-strong flex size-12 items-center justify-center rounded-xl text-foreground"><dragged.icon size={22} /></div>}</DragOverlay>
    </DndContext>
  </div>;
}
