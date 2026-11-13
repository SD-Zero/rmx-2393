// Pure pixel helpers for the paint bucket.

/** Pixels connected to (x0,y0) whose color is within `tol` (per channel) of the start pixel. Grown by 1px to cover anti-aliased edges. */
export function floodMask(data: Uint8ClampedArray, w: number, h: number, x0: number, y0: number, tol = 40): Uint8Array {
  const mask = new Uint8Array(w * h);
  if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return mask;
  const i0 = (y0 * w + x0) * 4;
  const r0 = data[i0]!, g0 = data[i0 + 1]!, b0 = data[i0 + 2]!, a0 = data[i0 + 3]!;
  const match = (p: number) => {
    const i = p * 4;
    return Math.abs(data[i]! - r0) <= tol && Math.abs(data[i + 1]! - g0) <= tol && Math.abs(data[i + 2]! - b0) <= tol && Math.abs(data[i + 3]! - a0) <= tol;
  };
  const stack = new Int32Array(w * h); let sp = 0;
  stack[sp++] = y0 * w + x0; mask[y0 * w + x0] = 1;
  while (sp) {
    const p = stack[--sp]!, x = p % w;
    if (x > 0 && !mask[p - 1] && match(p - 1)) { mask[p - 1] = 1; stack[sp++] = p - 1; }
    if (x < w - 1 && !mask[p + 1] && match(p + 1)) { mask[p + 1] = 1; stack[sp++] = p + 1; }
    if (p >= w && !mask[p - w] && match(p - w)) { mask[p - w] = 1; stack[sp++] = p - w; }
    if (p < w * (h - 1) && !mask[p + w] && match(p + w)) { mask[p + w] = 1; stack[sp++] = p + w; }
  }
  const out = mask.slice();
  for (let p = 0; p < w * h; p++) if (mask[p]) {
    const x = p % w;
    if (x > 0) out[p - 1] = 1; if (x < w - 1) out[p + 1] = 1;
    if (p >= w) out[p - w] = 1; if (p < w * (h - 1)) out[p + w] = 1;
  }
  return out;
}

// ---- Smudge (runs on a CPU pixel buffer: no GPU readbacks per dab, which is what made it lag on iPad) ----

export type Smudge = { R: number; d: number; mask: Float32Array; carry: Float32Array };

/** Soft round falloff matching the old gradient: 1 at center, 0.7 halfway, 0 at the edge. */
const falloff = (t: number) => (t >= 1 ? 0 : t <= 0.5 ? 1 - 0.6 * t : 1.4 * (1 - t));

/** Start a smudge stroke: the brush picks up the (premultiplied) paint under it. */
export function smudgeStart(px: Uint8ClampedArray, w: number, h: number, cx: number, cy: number, r: number): Smudge {
  const R = Math.max(1, Math.ceil(r)), d = R * 2 + 1;
  const mask = new Float32Array(d * d), carry = new Float32Array(d * d * 4);
  for (let j = 0; j < d; j++) for (let i = 0; i < d; i++) mask[j * d + i] = falloff(Math.hypot(i - R, j - R) / r);
  const ox = Math.round(cx) - R, oy = Math.round(cy) - R;
  for (let j = 0; j < d; j++) for (let i = 0; i < d; i++) {
    const X = ox + i, Y = oy + j; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
    const k = (Y * w + X) * 4, a = px[k + 3]!, c = (j * d + i) * 4;
    carry[c] = (px[k]! * a) / 255; carry[c + 1] = (px[k + 1]! * a) / 255; carry[c + 2] = (px[k + 2]! * a) / 255; carry[c + 3] = a;
  }
  return { R, d, mask, carry };
}

/** One smudge dab at (cx,cy): blends carried paint into the canvas, then picks some of the result back up.
 *  `clip` (one byte per pixel) limits changes to a selection. Returns the touched box [x0,y0,x1,y1) or null. */
export function smudgeDab(px: Uint8ClampedArray, w: number, h: number, s: Smudge, cx: number, cy: number, strength: number, clip?: Uint8Array | null, pickup = 0.3): [number, number, number, number] | null {
  const { R, d, mask, carry } = s, ox = Math.round(cx) - R, oy = Math.round(cy) - R;
  const x0 = Math.max(0, ox), y0 = Math.max(0, oy), x1 = Math.min(w, ox + d), y1 = Math.min(h, oy + d);
  if (x0 >= x1 || y0 >= y1) return null;
  for (let Y = y0; Y < y1; Y++) for (let X = x0; X < x1; X++) {
    const mi = (Y - oy) * d + (X - ox), m = mask[mi]! * strength; if (m <= 0) continue;
    const p = Y * w + X; if (clip && !clip[p]) continue;
    const k = p * 4, c = mi * 4, a = px[k + 3]!;
    const r0 = (px[k]! * a) / 255, g0 = (px[k + 1]! * a) / 255, b0 = (px[k + 2]! * a) / 255;
    const nr = r0 + (carry[c]! - r0) * m, ng = g0 + (carry[c + 1]! - g0) * m, nb = b0 + (carry[c + 2]! - b0) * m, na = a + (carry[c + 3]! - a) * m;
    if (na < 0.5) { px[k] = px[k + 1] = px[k + 2] = px[k + 3] = 0; }
    else { const f = 255 / na; px[k] = nr * f; px[k + 1] = ng * f; px[k + 2] = nb * f; px[k + 3] = na; }
    carry[c] = carry[c]! + (nr - carry[c]!) * pickup; carry[c + 1] = carry[c + 1]! + (ng - carry[c + 1]!) * pickup;
    carry[c + 2] = carry[c + 2]! + (nb - carry[c + 2]!) * pickup; carry[c + 3] = carry[c + 3]! + (na - carry[c + 3]!) * pickup;
  }
  return [x0, y0, x1, y1];
}
