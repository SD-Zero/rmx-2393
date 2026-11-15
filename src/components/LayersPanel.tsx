import { useEffect, useRef, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragMoveEvent } from "@dnd-kit/core";
import { ChevronDown, ChevronRight, CornerLeftDown, Ellipsis, Eye, EyeOff, Folder, FolderPlus, Lock, Plus, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { BLEND_MODES, clipBase, descendantIds, displayRows, isLocked, siblingBelow, type BlendMode, type DropWhere, type NodeProps } from "@/lib/layerTree";

export type PanelNode = NodeProps & { canvas?: HTMLCanvasElement | undefined };
export type LayerAction = "add" | "addFolder" | "duplicate" | "mergeDown" | "flatten" | "clear" | "invert" | "flipH" | "flipV" | "delete";
type Props = {
  nodes: PanelNode[]; activeId: number; rev: number;
  onSelect: (id: number) => void; onPatch: (id: number, patch: Partial<NodeProps>) => void;
  onAction: (action: LayerAction, id: number) => void; onMove: (id: number, target: number, where: DropWhere) => void;
};
const MI = "rounded-xl px-3 py-2 text-[14px] focus:bg-primary focus:text-primary-foreground";
const MS = "mx-2 my-1 bg-glass-border";

function Row({ node, depth, active, drop, rev, renaming, nodes, onSelect, onPatch, onAction, setRenaming }: {
  node: PanelNode; depth: number; active: boolean; drop: DropWhere | null; rev: number; renaming: boolean; nodes: PanelNode[];
  onSelect: Props["onSelect"]; onPatch: Props["onPatch"]; onAction: Props["onAction"]; setRenaming: (id: number | null) => void;
}) {
  const drag = useDraggable({ id: node.id });
  const { setNodeRef } = useDroppable({ id: node.id });
  const folder = node.kind === "folder", locked = isLocked(nodes, node.id), clipped = node.clip && !!clipBase(nodes, node.id);
  const below = siblingBelow(nodes, node.id);
  const canMerge = !folder && below?.kind === "layer" && !locked && !isLocked(nodes, below.id);
  const layerCount = nodes.filter((n) => n.kind === "layer").length;
  const removable = !locked && nodes.filter((n) => n.kind === "layer" && (n.id === node.id || descendantIds(nodes, node.id).has(n.id))).length < layerCount;
  return (
    <div ref={setNodeRef} data-layer-row={node.name} onClick={() => onSelect(node.id)} style={{ paddingLeft: 8 + depth * 16 }}
      className={`relative flex cursor-pointer items-center gap-2 rounded-2xl py-1.5 pr-1.5 transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"} ${drop === "into" ? "ring-2 ring-primary" : ""} ${drag.isDragging ? "opacity-40" : ""}`}>
      {drop === "above" && <span className="pointer-events-none absolute inset-x-2 -top-1 h-0.5 rounded bg-primary" />}
      {drop === "below" && <span className="pointer-events-none absolute inset-x-2 -bottom-1 h-0.5 rounded bg-primary" />}
      {folder
        ? <button className="-mr-1 p-0.5" aria-label={node.collapsed ? "Open folder" : "Close folder"} onClick={(e) => { e.stopPropagation(); onPatch(node.id, { collapsed: !node.collapsed }); }}>{node.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>
        : clipped && <CornerLeftDown size={13} className="-mr-1 shrink-0 opacity-70" aria-label="Clipping mask" />}
      <div ref={drag.setNodeRef} {...drag.listeners} {...drag.attributes} aria-label={`Drag ${node.name}`} className={`flex h-10 w-14 shrink-0 cursor-grab touch-none items-center justify-center overflow-hidden rounded-lg ${folder ? "bg-glass" : "checker"}`}>
        {folder ? <Folder size={18} /> : node.canvas && <LayerThumb canvas={node.canvas} tick={rev} />}
      </div>
      <div className="min-w-0 flex-1">
        {renaming
          ? <input autoFocus defaultValue={node.name} aria-label="Layer name" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
              onBlur={(e) => { onPatch(node.id, { name: e.currentTarget.value.trim() || node.name }); setRenaming(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { e.currentTarget.value = node.name; e.currentTarget.blur(); } }}
              className="w-full rounded-md bg-background/80 px-1.5 py-0.5 text-sm text-foreground outline-none ring-1 ring-primary" />
          : <span className="block truncate text-sm font-medium" onDoubleClick={(e) => { e.stopPropagation(); setRenaming(node.id); }}>{node.name}</span>}
        <span className="flex items-center gap-1 text-[10px] opacity-70">
          {BLEND_MODES.find((b) => b.value === node.blend)?.label}{node.opacity < 100 && ` · ${Math.round(node.opacity)}%`}
          {node.alphaLock && <span aria-label="Alpha locked" title="Alpha lock">· α</span>}
        </span>
      </div>
      {node.locked && <button className="p-1" aria-label={`Unlock ${node.name}`} title="Locked" onClick={(e) => { e.stopPropagation(); onPatch(node.id, { locked: false }); }}><Lock size={14} /></button>}
      {active && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button className="p-1" aria-label="Layer options" onClick={(e) => e.stopPropagation()}><Ellipsis size={16} /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="glass-strong min-w-52 rounded-2xl border-glass-border p-1.5 text-foreground" onClick={(e) => e.stopPropagation()} onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem className={MI} onSelect={() => setTimeout(() => setRenaming(node.id), 0)}>Rename</DropdownMenuItem>
            <DropdownMenuItem className={MI} onSelect={() => onAction("duplicate", node.id)}>Duplicate</DropdownMenuItem>
            {folder
              ? <DropdownMenuItem className={MI} disabled={locked} onSelect={() => onAction("flatten", node.id)}>Flatten folder</DropdownMenuItem>
              : <>
                  <DropdownMenuItem className={MI} disabled={!canMerge} onSelect={() => onAction("mergeDown", node.id)}>Merge down</DropdownMenuItem>
                  <DropdownMenuSeparator className={MS} />
                  <DropdownMenuItem className={MI} disabled={locked} onSelect={() => onAction("clear", node.id)}>Clear layer</DropdownMenuItem>
                  <DropdownMenuItem className={MI} disabled={locked} onSelect={() => onAction("invert", node.id)}>Invert colors</DropdownMenuItem>
                  <DropdownMenuItem className={MI} disabled={locked} onSelect={() => onAction("flipH", node.id)}>Flip horizontal</DropdownMenuItem>
                  <DropdownMenuItem className={MI} disabled={locked} onSelect={() => onAction("flipV", node.id)}>Flip vertical</DropdownMenuItem>
                </>}
            <DropdownMenuSeparator className={MS} />
            <DropdownMenuCheckboxItem className={MI} checked={node.locked} onCheckedChange={(v) => onPatch(node.id, { locked: v === true })}>Lock</DropdownMenuCheckboxItem>
            {!folder && <>
              <DropdownMenuCheckboxItem className={MI} checked={node.alphaLock} onCheckedChange={(v) => onPatch(node.id, { alphaLock: v === true })}>Alpha lock</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem className={MI} checked={node.clip} onCheckedChange={(v) => onPatch(node.id, { clip: v === true })}>Clipping mask</DropdownMenuCheckboxItem>
            </>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {active && removable && <button className="p-1" aria-label={folder ? "Delete folder" : "Delete layer"} onClick={(e) => { e.stopPropagation(); onAction("delete", node.id); }}><Trash2 size={16} /></button>}
      <button className="p-1" aria-label="Toggle visibility" onClick={(e) => { e.stopPropagation(); onPatch(node.id, { visible: !node.visible }); }}>
        {node.visible ? <Eye size={16} /> : <EyeOff size={16} className="opacity-50" />}
      </button>
    </div>
  );
}

export function LayersPanel({ nodes, activeId, rev, onSelect, onPatch, onAction, onMove }: Props) {
  const [renaming, setRenaming] = useState<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [drop, setDropState] = useState<{ id: number; where: DropWhere } | null>(null);
  const dropRef = useRef(drop);
  const setDrop = (d: typeof drop) => { dropRef.current = d; setDropState(d); };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const rows = displayRows(nodes);
  const active = nodes.find((n) => n.id === activeId);
  const dragged = nodes.find((n) => n.id === dragId);
  function where(e: DragMoveEvent) {
    const over = e.over, target = over && nodes.find((n) => n.id === over.id);
    if (!over || !target || target.id === e.active.id || descendantIds(nodes, Number(e.active.id)).has(target.id)) return setDrop(null);
    const y = (e.activatorEvent as PointerEvent).clientY + e.delta.y, f = (y - over.rect.top) / over.rect.height;
    let w: DropWhere = target.kind === "folder" ? (f < 0.3 ? "above" : f > 0.7 ? "below" : "into") : f < 0.5 ? "above" : "below";
    // Just under an open folder's row is the top of its contents.
    if (w === "below" && target.kind === "folder" && !target.collapsed && nodes.some((n) => n.parent === target.id)) w = "into";
    setDrop({ id: target.id, where: w });
  }
  return (
    <div className="glass-strong animate-pop absolute right-1/2 top-16 flex max-h-[calc(100dvh-80px)] w-80 max-w-[calc(100vw-24px)] translate-x-1/2 flex-col rounded-3xl p-3 sm:right-6 sm:translate-x-0">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-sm font-semibold">Layers</p>
        <div className="flex">
          <button className="tool-btn size-8" aria-label="New folder" title="New folder" onClick={() => onAction("addFolder", activeId)}><FolderPlus size={16} /></button>
          <button className="tool-btn size-8" aria-label="Add layer" title="New layer" onClick={() => onAction("add", activeId)}><Plus size={16} /></button>
        </div>
      </div>
      <DndContext sensors={sensors} onDragStart={(e) => { setDragId(Number(e.active.id)); setDrop(null); }} onDragMove={where} onDragOver={where}
        onDragCancel={() => { setDragId(null); setDrop(null); }}
        onDragEnd={(e) => { const d = dropRef.current; setDragId(null); setDrop(null); if (d) onMove(Number(e.active.id), d.id, d.where); }}>
        <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto overscroll-contain p-0.5">
          {rows.map(({ node, depth }) => (
            <Row key={node.id} node={node} depth={depth} active={node.id === activeId} drop={drop?.id === node.id ? drop.where : null} rev={rev} renaming={renaming === node.id}
              nodes={nodes} onSelect={onSelect} onPatch={onPatch} onAction={onAction} setRenaming={setRenaming} />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{dragged && <div className="glass-strong rounded-xl px-3 py-2 text-sm font-medium">{dragged.name}</div>}</DragOverlay>
      </DndContext>
      {active && (
        <div className="mt-3 space-y-2.5 border-t border-glass-border px-1 pt-3">
          <div className="flex items-center gap-3">
            <span className="w-14 text-xs text-muted-foreground">Opacity</span>
            <Slider aria-label="Layer opacity" min={0} max={100} step={1} value={[active.opacity]} onValueChange={([v]) => onPatch(active.id, { opacity: v ?? 100 })} className="flex-1" />
            <span className="w-9 text-right text-xs tabular-nums">{Math.round(active.opacity)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-14 text-xs text-muted-foreground">Blend</span>
            <Select value={active.blend} onValueChange={(v) => onPatch(active.id, { blend: v as BlendMode })}>
              <SelectTrigger aria-label="Blend mode" className="h-8 flex-1 rounded-xl text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="glass-strong max-h-72 rounded-xl border-glass-border text-foreground">
                {BLEND_MODES.map((b) => <SelectItem key={b.value} value={b.value} className="text-xs">{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

function LayerThumb({ canvas, tick }: { canvas: HTMLCanvasElement; tick: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current!.getContext("2d")!; c.clearRect(0, 0, 112, 80); c.drawImage(canvas, 0, 0, 112, 80); }, [canvas, tick]);
  return <canvas ref={ref} width={112} height={80} className="size-full" />;
}
