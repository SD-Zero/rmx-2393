import { useRef, useState } from "react";

type Props = {
  value: number; min: number; max: number; onChange: (v: number) => void; label: string; format: (v: number) => string;
  /** Shown beside the thumb only while dragging, then fades out. */
  preview?: React.ReactNode;
};

const THUMB_H = 30; // px — rounded pill, like iPadOS
const THUMB_W = 22; // px — a little wider than the thin track

export function VerticalSlider({ value, min, max, onChange, label, format, preview }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const pct = (value - min) / (max - min);
  const update = (clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, 1 - (clientY - r.top - THUMB_H / 2) / (r.height - THUMB_H)));
    onChange(Math.round(min + p * (max - min)));
  };
  // thumb center, measured from the bottom of the track
  const center = `calc(${THUMB_H / 2}px + (100% - ${THUMB_H}px) * ${pct})`;
  const end = (e: React.PointerEvent) => { setDragging(false); e.currentTarget.releasePointerCapture?.(e.pointerId); };
  return (
    <div className="glass flex w-10 flex-col items-center gap-1.5 rounded-full py-2.5">
      <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{format(value)}</span>
      <div
        ref={ref}
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        className="relative h-40 w-3 cursor-ns-resize touch-none"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); update(e.clientY); }}
        onPointerMove={(e) => { if (e.buttons) update(e.clientY); }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="absolute inset-0 overflow-hidden rounded-full bg-muted">
          <div className="absolute inset-x-0 bottom-0 bg-primary" style={{ height: center }} />
        </div>
        <div
          className="absolute left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary-foreground shadow-[0_2px_6px_rgb(0_0_0/0.3)]"
          style={{ width: THUMB_W, height: THUMB_H, bottom: center }}
        />
        {preview && (
          <div
            className={`pointer-events-none absolute bottom-1/2 left-full ml-5 translate-y-1/2 transition-opacity ${dragging ? "opacity-100 duration-75" : "opacity-0 duration-500"}`}
          >
            {preview}
          </div>
        )}
      </div>
    </div>
  );
}
