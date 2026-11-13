import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type KeyboardEvent } from "react";
import { colord } from "colord";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { colorFields, parseColorFields, type ColorMode } from "@/lib/colorValues";

type Props = { color: string; recent: string[]; onChange: (color: string) => void; onCommit: (color: string) => void; onClose: () => void };
const MODES: ColorMode[] = ["Hex", "RGB", "HSL"];
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function ColorPicker({ color, recent, onChange, onCommit, onClose }: Props) {
  const [hsv, setHsv] = useState(() => colord(color).toHsv());
  const current = useRef(hsv);
  const [mode, setMode] = useState<ColorMode>("Hex");
  const [fields, setFields] = useState(() => colorFields(color, "Hex"));
  const [error, setError] = useState(false);
  const dragging = useRef<number | null>(null);

  useEffect(() => {
    const next = colord(color).toHsv();
    // Keep the hue when selecting white/black, so returning to color is seamless.
    if (next.s === 0 || next.v === 0) next.h = current.current.h;
    current.current = next;
    setHsv(next);
    setFields(colorFields(color, mode));
    setError(false);
  }, [color, mode]);

  function update(next: typeof hsv, commit = false) {
    current.current = next; setHsv(next);
    const hex = colord(next).toHex();
    onChange(hex);
    if (commit) onCommit(hex);
  }

  function point(e: PointerEvent<HTMLDivElement>, kind: "hue" | "square") {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const next = { ...current.current };
    if (kind === "hue") {
      next.h = (Math.atan2(y - rect.height / 2, x - rect.width / 2) * 180 / Math.PI + 90 + 360) % 360;
    } else {
      next.s = clamp(x / rect.width * 100);
      next.v = clamp(100 - y / rect.height * 100);
    }
    update(next);
  }
  function start(e: PointerEvent<HTMLDivElement>, kind: "hue" | "square") {
    if (dragging.current !== null) return;
    e.preventDefault(); e.currentTarget.focus();
    dragging.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId); point(e, kind);
  }
  function end(e: PointerEvent<HTMLDivElement>) {
    if (dragging.current !== e.pointerId) return;
    dragging.current = null; onCommit(colord(current.current).toHex());
  }
  function keys(e: KeyboardEvent<HTMLDivElement>, kind: "hue" | "square") {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next = { ...current.current }, step = e.shiftKey ? 10 : 1;
    if (kind === "hue") {
      next.h = e.key === "Home" ? 0 : e.key === "End" ? 359 : (next.h + (e.key === "ArrowRight" || e.key === "ArrowUp" ? step : -step) + 360) % 360;
    } else {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") next.s = clamp(next.s + (e.key === "ArrowRight" ? step : -step));
      if (e.key === "ArrowUp" || e.key === "ArrowDown") next.v = clamp(next.v + (e.key === "ArrowUp" ? step : -step));
      if (e.key === "Home") { next.s = 0; next.v = 100; }
      if (e.key === "End") next.v = 0;
    }
    update(next, true);
  }
  const angle = (hsv.h - 90) * Math.PI / 180;
  const labels = mode === "Hex" ? ["Hex code"] : mode === "RGB" ? ["R", "G", "B"] : ["H", "S", "L"];

  return (
    <section aria-label="Color picker" className="glass-strong animate-pop color-panel absolute left-3 top-16 z-10 rounded-3xl p-4 sm:left-36" onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") onClose(); }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Colors</h2>
        <div className="flex items-center gap-2">
          <span className="size-6 rounded-full border border-foreground/40" style={{ backgroundColor: color }} aria-label={`Current color ${color}`} />
          <Button variant="ghost" size="icon" className="size-7 rounded-full text-muted-foreground" aria-label="Close colors" title="Close colors" onClick={onClose}><X /></Button>
        </div>
      </div>
      <div className="color-wheel mx-auto mb-4">
        <div role="slider" tabIndex={0} aria-label="Hue" aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round(hsv.h)} className="hue-ring absolute inset-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onPointerDown={(e) => start(e, "hue")} onPointerMove={(e) => { if (dragging.current === e.pointerId) point(e, "hue"); }} onPointerUp={end} onPointerCancel={end} onKeyDown={(e) => keys(e, "hue")}>
          <span className="color-handle" style={{ left: `${50 + 44 * Math.cos(angle)}%`, top: `${50 + 44 * Math.sin(angle)}%`, backgroundColor: colord({ h: hsv.h, s: 100, v: 100 }).toHex() }} />
        </div>
        <div role="slider" tabIndex={0} aria-label="Saturation and brightness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hsv.v)} aria-valuetext={`${Math.round(hsv.s)}% saturation, ${Math.round(hsv.v)}% brightness`} className="color-square absolute rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={{ "--picker-hue": colord({ h: hsv.h, s: 100, v: 100 }).toHex() } as CSSProperties}
          onPointerDown={(e) => { e.stopPropagation(); start(e, "square"); }} onPointerMove={(e) => { if (dragging.current === e.pointerId) point(e, "square"); }} onPointerUp={end} onPointerCancel={end} onKeyDown={(e) => keys(e, "square")}>
          <span className="color-handle" style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, backgroundColor: color }} />
        </div>
      </div>
      <div className="mb-4">
        <h3 className="mb-2 text-xs font-medium text-muted-foreground">Recent</h3>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 12 }, (_, i) => {
            const c = recent[i];
            return c ? <Button key={i} variant="ghost" aria-label={`Recent ${c}`} title={c.toUpperCase()} className={`h-auto w-full aspect-square rounded-lg border p-0 ${color.toLowerCase() === c ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent" : "border-glass-border"}`} style={{ backgroundColor: c }} onClick={() => { onChange(c); onCommit(c); }} />
              : <span key={i} className="aspect-square rounded-lg border border-glass-border bg-muted" />;
          })}
        </div>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Color format">
        {MODES.map((m) => <Button key={m} variant="ghost" size="sm" aria-pressed={mode === m} className={`h-7 ${mode === m ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => { setMode(m); setFields(colorFields(color, m)); setError(false); }}>{m}</Button>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); const next = parseColorFields(fields, mode); if (!next) { setError(true); return; } onChange(next); onCommit(next); setFields(colorFields(next, mode)); setError(false); }}>
        <div className="flex items-end gap-2">
          {labels.map((label, i) => <label key={`${mode}-${label}`} className="min-w-0 flex-1 text-xs text-muted-foreground">
            <span className="mb-1 block">{label}{mode === "HSL" ? i === 0 ? " °" : " %" : ""}</span>
            <input aria-label={label} aria-invalid={error} type="text" inputMode={mode === "Hex" ? "text" : "decimal"} spellCheck={false} autoComplete="off" value={fields[i] ?? ""} onChange={(e) => { setFields((f) => f.map((v, n) => n === i ? e.target.value : v)); setError(false); }} className="h-9 w-full min-w-0 rounded-lg border border-glass-border bg-muted px-2 text-sm font-medium text-foreground outline-none focus:border-primary select-text" />
          </label>)}
          <Button variant="ghost" size="icon" type="submit" aria-label="Apply color" title="Apply color" className="size-9 shrink-0 bg-accent"><Check /></Button>
        </div>
        {error && <p role="alert" className="mt-2 text-xs text-destructive">{mode === "Hex" ? "Enter a valid 3- or 6-digit hex code." : mode === "RGB" ? "RGB values must be between 0 and 255." : "Hue: 0–360. Saturation and lightness: 0–100."}</p>}
      </form>
    </section>
  );
}