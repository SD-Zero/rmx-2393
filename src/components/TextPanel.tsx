import { useEffect, useRef, useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { AlignCenter, AlignLeft, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, Bold, Check, ChevronDown, Italic, Underline, Upload, X, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GOOGLE_FONTS, SYSTEM_FONTS, loadGoogleFonts, type TextStyle } from "@/lib/textRender";

type Props = { style: TextStyle; onChange: (patch: Partial<TextStyle>) => void; onDone: () => void; onCancel: () => void };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border-t border-glass-border pt-3">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Range({ label, value, min, max, onChange, unit = "" }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      <SliderPrimitive.Root aria-label={label} min={min} max={max} step={1} value={[value]} onValueChange={([v]) => onChange(v ?? 0)} className="relative flex h-6 flex-1 cursor-ew-resize touch-none select-none items-center">
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted"><SliderPrimitive.Range className="absolute h-full bg-primary" /></SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-[18px] w-[26px] rounded-full bg-primary-foreground shadow-[0_2px_6px_rgb(0_0_0/0.3)] outline-none" />
      </SliderPrimitive.Root>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums">{value}{unit}</span>
    </div>
  );
}

function Toggle({ icon: Icon, label, on, onClick }: { icon: LucideIcon; label: string; on: boolean; onClick: () => void }) {
  return (
    <button aria-label={label} title={label} aria-pressed={on} onClick={onClick}
      className={`flex h-8 flex-1 items-center justify-center rounded-lg transition-colors ${on ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
      <Icon size={15} />
    </button>
  );
}

function Swatch({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <label className="relative size-9 cursor-pointer overflow-hidden rounded-full border border-glass-border" style={{ background: value }}>
        <input type="color" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function TextPanel({ style, onChange, onDone, onCancel }: Props) {
  const [imported, setImported] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [fontsOpen, setFontsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(loadGoogleFonts, []);
  const q = query.trim().toLowerCase();
  const groups = ([["Imported", imported], ["System", SYSTEM_FONTS], ["Google", GOOGLE_FONTS]] as const)
    .map(([name, list]) => [name, list.filter((f) => f.toLowerCase().includes(q))] as const).filter(([, list]) => list.length);

  async function importFont(file: File) {
    const name = file.name.replace(/\.[^.]+$/, "");
    try {
      const face = new FontFace(name, await file.arrayBuffer());
      await face.load(); document.fonts.add(face);
      setImported((list) => (list.includes(name) ? list : [name, ...list])); onChange({ font: name });
    } catch { window.alert("That font file couldn't be opened."); }
  }

  return (
    <section aria-label="Text options" onKeyDown={(e) => e.stopPropagation()}
      className="glass-strong animate-pop absolute bottom-14 right-3 z-10 flex max-h-[calc(100dvh-140px)] w-80 max-w-[calc(100vw-24px)] flex-col rounded-3xl p-3">
      <div className="mb-2 flex shrink-0 items-center justify-between px-1">
        <p className="text-sm font-semibold">Text</p>
        <div className="flex gap-1">
          <button className="tool-btn size-8" aria-label="Cancel text" title="Cancel" onClick={onCancel}><X size={16} /></button>
          <button className="tool-btn tool-btn-active size-8" aria-label="Place text" title="Done" onClick={onDone}><Check size={16} /></button>
        </div>
      </div>
      <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain px-0.5 pb-1">
        <textarea autoFocus rows={3} value={style.text} placeholder="Type your text…" aria-label="Text"
          onChange={(e) => onChange({ text: e.target.value })}
          className="w-full resize-none rounded-xl bg-muted px-3 py-2 text-sm outline-none ring-primary placeholder:text-muted-foreground focus:ring-2"
          style={{ userSelect: "text", WebkitUserSelect: "text" }} />

        <Section title="Font">
          <div className="flex gap-2">
            <Popover open={fontsOpen} onOpenChange={setFontsOpen}>
              <PopoverTrigger asChild>
                <button aria-label="Font" className="flex h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl bg-muted px-3 text-sm hover:bg-accent">
                  <span className="truncate" style={{ fontFamily: `"${style.font}"` }}>{style.font}</span><ChevronDown size={14} className="shrink-0 opacity-70" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="glass-strong flex max-h-80 w-64 flex-col rounded-2xl border-glass-border p-1.5 text-foreground">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search fonts" aria-label="Search fonts"
                  className="mb-1.5 shrink-0 rounded-lg bg-muted px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground" style={{ userSelect: "text", WebkitUserSelect: "text" }} />
                <div className="min-h-0 overflow-y-auto overscroll-contain">
                  {groups.map(([name, list]) => (
                    <div key={name}>
                      <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{name}</p>
                      {list.map((f) => (
                        <button key={f} onClick={() => { onChange({ font: f }); setFontsOpen(false); }}
                          className={`block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-[15px] ${f === style.font ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                          style={{ fontFamily: `"${f}"` }}>{f}</button>
                      ))}
                    </div>
                  ))}
                  {!groups.length && <p className="px-2.5 py-3 text-center text-xs text-muted-foreground">No fonts found</p>}
                </div>
              </PopoverContent>
            </Popover>
            <button className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-muted px-3 text-xs hover:bg-accent" onClick={() => fileRef.current?.click()} aria-label="Import font">
              <Upload size={14} /> Import
            </button>
            <input ref={fileRef} type="file" accept=".ttf,.otf,.woff,.woff2,font/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFont(f); e.target.value = ""; }} />
          </div>
          <Range label="Size" value={style.size} min={8} max={300} onChange={(size) => onChange({ size })} unit="px" />
        </Section>

        <Section title="Format">
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            <Toggle icon={Bold} label="Bold" on={style.bold} onClick={() => onChange({ bold: !style.bold })} />
            <Toggle icon={Italic} label="Italic" on={style.italic} onClick={() => onChange({ italic: !style.italic })} />
            <Toggle icon={Underline} label="Underline" on={style.underline} onClick={() => onChange({ underline: !style.underline })} />
          </div>
          <div className="flex gap-2">
            <div className="flex flex-1 gap-1 rounded-xl bg-muted p-1">
              <Toggle icon={AlignLeft} label="Align left" on={style.hAlign === "left"} onClick={() => onChange({ hAlign: "left" })} />
              <Toggle icon={AlignCenter} label="Align center" on={style.hAlign === "center"} onClick={() => onChange({ hAlign: "center" })} />
              <Toggle icon={AlignRight} label="Align right" on={style.hAlign === "right"} onClick={() => onChange({ hAlign: "right" })} />
            </div>
            <div className="flex flex-1 gap-1 rounded-xl bg-muted p-1">
              <Toggle icon={AlignVerticalJustifyStart} label="Align top" on={style.vAlign === "top"} onClick={() => onChange({ vAlign: "top" })} />
              <Toggle icon={AlignVerticalJustifyCenter} label="Align middle" on={style.vAlign === "middle"} onClick={() => onChange({ vAlign: "middle" })} />
              <Toggle icon={AlignVerticalJustifyEnd} label="Align bottom" on={style.vAlign === "bottom"} onClick={() => onChange({ vAlign: "bottom" })} />
            </div>
          </div>
        </Section>

        <Section title="Color">
          <div className="flex items-start">
            <Swatch label="Text" value={style.fill} onChange={(fill) => onChange({ fill })} />
            <Swatch label="Border" value={style.border} onChange={(border) => onChange({ border })} />
            <Swatch label="Background" value={style.background ?? "#ffffff"} onChange={(background) => onChange({ background })}>
              <button className={`rounded-full px-2 py-0.5 text-[10px] ${style.background ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                onClick={() => onChange({ background: style.background ? null : "#ffffff" })}>{style.background ? "On" : "Off"}</button>
            </Swatch>
          </div>
          <Range label="Border" value={style.borderWidth} min={0} max={30} onChange={(borderWidth) => onChange({ borderWidth })} unit="px" />
        </Section>

        <Section title="Spacing">
          <Range label="Letters" value={style.letterSpacing} min={-20} max={100} onChange={(letterSpacing) => onChange({ letterSpacing })} />
          <Range label="Lines" value={style.lineSpacing} min={-50} max={200} onChange={(lineSpacing) => onChange({ lineSpacing })} />
          <Range label="Padding ↔" value={style.padX} min={0} max={200} onChange={(padX) => onChange({ padX })} />
          <Range label="Padding ↕" value={style.padY} min={0} max={200} onChange={(padY) => onChange({ padY })} />
        </Section>
      </div>
    </section>
  );
}
