import { useEffect, useRef, useState, type ReactNode } from "react";
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDroppable, useSensor, useSensors, pointerWithin, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, sortableKeyboardCoordinates, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { Ellipsis, Pin, PinOff, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_TOOLBAR, TOOLBAR_KEY, TOOL_ITEMS, moveToolbarItem, validateToolbar, type Tool, type ToolItem } from "@/lib/toolbar";

type Props = { activeTool: Tool; onActivate: (id: string) => void; title: string; onTitleChange: (title: string) => void; leading: ReactNode; trailing: ReactNode; color: ReactNode; onOpen: () => void };
function ShelfItem({ item, drawer, active, activate, move }: { item: ToolItem; drawer?: boolean; active: boolean; activate: () => void; move: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: item.id });
  return <div ref={setNodeRef} data-shelf-item={item.id} className={`relative shrink-0 ${drawer ? "min-w-0" : ""} ${isDragging ? "opacity-25" : ""}`}>
    <Button {...attributes} {...listeners} variant="ghost" size={drawer ? "default" : "icon"} aria-label={item.label} title={item.label} aria-pressed={active} onClick={activate}
      className={`${drawer ? "h-20 w-full flex-col gap-2 rounded-lg px-1 text-[11px] whitespace-normal leading-tight" : "size-8 rounded-full"} touch-none ${active ? "bg-primary text-primary-foreground hover:bg-primary" : ""}`}><item.icon /><span className={drawer ? "" : "sr-only"}>{item.label}</span></Button>
    <Button variant="ghost" size="icon" className={`shelf-pin ${drawer ? "absolute right-0 top-0 size-5" : "absolute -bottom-1 right-0 size-4"} rounded-full bg-glass-strong text-muted-foreground`} aria-label={`${drawer ? "Pin" : "Unpin"} ${item.label}`} title={`${drawer ? "Pin to toolbar" : "Move to tools"}`} onClick={move}>{drawer ? <Pin /> : <PinOff />}</Button>
  </div>;
}
function DropArea({ id, children, className }: { id: string; children: ReactNode; className: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} data-drop-area={id} className={`${className} ${isOver ? "bg-primary/15 ring-1 ring-primary" : ""}`}>{children}</div>;
}
export function ToolShelf({ activeTool, onActivate, title, onTitleChange, leading, trailing, color, onOpen }: Props) {
  const [items, setItems] = useState([...DEFAULT_TOOLBAR]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 220, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  useEffect(() => { try { const saved = localStorage.getItem(TOOLBAR_KEY); if (saved) setItems(validateToolbar(JSON.parse(saved))); } catch { /* Storage may be blocked or ephemeral. */ } setReady(true); }, []);
  useEffect(() => { if (ready) { try { localStorage.setItem(TOOLBAR_KEY, JSON.stringify(items)); } catch { /* Session-only when unavailable. */ } } }, [items, ready]);
  useEffect(() => {
    const close = (e: globalThis.PointerEvent) => { if (!dragging && e.target instanceof Node && !root.current?.contains(e.target)) setOpen(false); };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [dragging]);
  function finish(e: DragEndEvent) {
    if (e.over) { const target = String(e.over.id); setItems((v) => moveToolbarItem(v, String(e.active.id), target === "drawer" || !items.includes(target) && target !== "toolbar" ? "drawer" : target)); }
    setDragging(null);
  }
  const drawer = TOOL_ITEMS.filter((t) => !items.includes(t.id));
  const dragged = TOOL_ITEMS.find((t) => t.id === dragging);
  function activate(id: string) { onActivate(id); setOpen(false); }
  return <div ref={root} className="pointer-events-none absolute inset-x-0 top-2.5 z-20 px-3">
    <DndContext sensors={sensors} collisionDetection={(args) => { const hits = pointerWithin(args); return hits.length ? hits : closestCenter(args); }} onDragStart={(e) => { setDragging(String(e.active.id)); setOpen(true); onOpen(); }} onDragEnd={finish} onDragCancel={() => setDragging(null)}>
      <div className="glass pointer-events-auto shelf-bar rounded-full p-1">
        <div className="flex min-w-0 items-center gap-1 overflow-hidden">
          {leading}<div className="h-5 w-px shrink-0 bg-glass-border" />
          <DropArea id="toolbar" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-full py-1 [scrollbar-width:none]">
            <SortableContext items={items} strategy={horizontalListSortingStrategy}>
              {items.map((id) => { const item = TOOL_ITEMS.find((t) => t.id === id); return item ? <ShelfItem key={id} item={item} active={item.tool === activeTool} activate={() => activate(id)} move={() => setItems((v) => moveToolbarItem(v, id, "drawer"))} /> : null; })}
            </SortableContext>
            {!items.length && <span className="w-8 shrink-0" />}
          </DropArea>
          {color}
        </div>
        <input aria-label="Artwork title" value={title} onChange={(e) => onTitleChange(e.target.value)} onFocus={(e) => e.target.select()} onBlur={() => { if (!title.trim()) onTitleChange("Untitled"); }} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") e.currentTarget.blur(); }} maxLength={120} className="h-8 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-center text-sm font-medium text-foreground outline-none hover:bg-muted focus:border-glass-border focus:bg-muted select-text" />
        <div className="flex items-center justify-end gap-0.5">
          <div className="mx-1 h-5 w-px bg-glass-border" />
          <Button variant="ghost" size="icon" aria-label="More tools" title="More tools" aria-expanded={open} className={`size-8 rounded-full ${open ? "bg-accent" : ""}`} onClick={() => { setOpen(!open); onOpen(); }}><Ellipsis /></Button>
          {trailing}
        </div>
      </div>
      {open && <section aria-label="More tools drawer" className="glass-strong pointer-events-auto animate-pop absolute right-3 top-16 w-[360px] max-w-[calc(100vw-24px)] rounded-2xl p-3">
        <div className="mb-2 flex items-center justify-between"><h2 className="px-1 text-sm font-semibold">Tools</h2><div className="flex"><Button variant="ghost" size="icon" className="size-7 rounded-full" aria-label="Reset toolbar" title="Reset toolbar" onClick={() => setItems([...DEFAULT_TOOLBAR])}><RotateCcw /></Button><Button variant="ghost" size="icon" className="size-7 rounded-full" aria-label="Close tools" title="Close tools" onClick={() => setOpen(false)}><X /></Button></div></div>
        <DropArea id="drawer" className="grid max-h-[min(360px,calc(100dvh-150px))] min-h-20 grid-cols-4 gap-2 overflow-y-auto overscroll-contain rounded-lg touch-pan-y p-1">
          <SortableContext items={drawer.map((t) => t.id)}>{drawer.map((item) => <ShelfItem key={item.id} item={item} drawer active={item.tool === activeTool} activate={() => activate(item.id)} move={() => setItems((v) => moveToolbarItem(v, item.id, "toolbar"))} />)}</SortableContext>
        </DropArea>
      </section>}
      <DragOverlay>{dragged && <div className="glass-strong flex size-12 items-center justify-center rounded-xl text-foreground"><dragged.icon size={22} /></div>}</DragOverlay>
    </DndContext>
  </div>;
}