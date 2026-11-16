export type HAlign = "left" | "center" | "right";
export type VAlign = "top" | "middle" | "bottom";
export type TextStyle = {
  text: string; font: string; size: number; bold: boolean; italic: boolean; underline: boolean;
  hAlign: HAlign; vAlign: VAlign; fill: string; border: string; borderWidth: number;
  background: string | null; padX: number; padY: number; letterSpacing: number; lineSpacing: number;
};
export const DEFAULT_TEXT_STYLE: TextStyle = {
  text: "", font: "Helvetica", size: 48, bold: false, italic: false, underline: false,
  hAlign: "left", vAlign: "top", fill: "#000000", border: "#ffffff", borderWidth: 0,
  background: null, padX: 0, padY: 0, letterSpacing: 0, lineSpacing: 0,
};

export const SYSTEM_FONTS = ["Helvetica", "Arial", "Georgia", "Times New Roman", "Courier New", "Verdana", "Trebuchet MS", "Impact", "Comic Sans MS",
  "Gill Sans", "Futura", "Avenir", "Menlo", "Palatino", "Optima", "Didot", "Baskerville", "Marker Felt", "Chalkboard SE", "Noteworthy",
  "American Typewriter", "Copperplate", "Papyrus", "Snell Roundhand", "Zapfino", "Bradley Hand"];
export const GOOGLE_FONTS = ["Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Oswald", "Raleway", "Nunito", "Rubik", "Quicksand",
  "Josefin Sans", "Work Sans", "Space Grotesk", "Comfortaa", "Fredoka", "Baloo 2", "Playfair Display", "Merriweather", "Lora", "PT Serif",
  "Cinzel", "Cormorant Garamond", "EB Garamond", "Libre Baskerville", "Crimson Text", "DM Serif Display", "Roboto Slab", "Zilla Slab", "Arvo", "Bitter",
  "Bebas Neue", "Anton", "Archivo Black", "Abril Fatface", "Alfa Slab One", "Bowlby One", "Titan One", "Lilita One", "Righteous", "Bangers",
  "Luckiest Guy", "Chewy", "Sniglet", "Bungee", "Bungee Shade", "Monoton", "Black Ops One", "Creepster", "Orbitron", "Audiowide",
  "Press Start 2P", "VT323", "Silkscreen", "Rubik Mono One", "Lobster", "Pacifico", "Dancing Script", "Great Vibes", "Satisfy", "Sacramento",
  "Parisienne", "Yellowtail", "Kaushan Script", "Marck Script", "Cookie", "Courgette", "Homemade Apple", "Caveat", "Shadows Into Light", "Indie Flower",
  "Amatic SC", "Permanent Marker", "Patrick Hand", "Gloria Hallelujah", "Kalam", "Rock Salt", "Special Elite", "Courier Prime", "Source Code Pro", "JetBrains Mono",
  "Fira Code", "Space Mono", "Noto Sans JP", "M PLUS Rounded 1c", "Zen Maru Gothic", "Kosugi Maru", "Yusei Magic", "Dela Gothic One", "DotGothic16", "Reggae One",
  "RocknRoll One", "Stick", "Train One", "Hachi Maru Pop", "Mochiy Pop One", "Potta One", "Klee One", "Yomogi"];

let googleLoaded = false;
/** Adds the Google font stylesheets once, in small batches so one bad name can't block the rest. */
export function loadGoogleFonts() {
  if (googleLoaded || typeof document === "undefined") return;
  googleLoaded = true;
  for (let i = 0; i < GOOGLE_FONTS.length; i += 12) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${GOOGLE_FONTS.slice(i, i + 12).map((f) => `family=${f.replace(/ /g, "+")}`).join("&")}&display=swap`;
    document.head.appendChild(link);
  }
}

export const fontString = (s: TextStyle) => `${s.italic ? "italic " : ""}${s.bold ? "bold " : ""}${s.size}px "${s.font}", sans-serif`;

type Measure = (text: string) => number;
export type TextLayout = { box: { x: number; y: number; w: number; h: number }; lines: { text: string; x: number; y: number; w: number }[] };

/** Positions the text box so the anchor point sits at its chosen horizontal/vertical edge. */
export function layoutText(s: TextStyle, measure: Measure, ax: number, ay: number): TextLayout {
  const rows = s.text.split("\n");
  const widths = rows.map((r) => [...r].reduce((w, ch) => w + measure(ch) + s.letterSpacing, 0) - (r.length ? s.letterSpacing : 0));
  const step = s.size * 1.2 + s.lineSpacing;
  const contentW = Math.max(0, ...widths), contentH = s.size * 1.2 + step * (rows.length - 1);
  const w = contentW + s.padX * 2, h = contentH + s.padY * 2;
  const x = s.hAlign === "left" ? ax : s.hAlign === "center" ? ax - w / 2 : ax - w;
  const y = s.vAlign === "top" ? ay : s.vAlign === "middle" ? ay - h / 2 : ay - h;
  const lines = rows.map((text, i) => {
    const lw = widths[i]!, free = contentW - lw;
    return { text, w: lw, x: x + s.padX + (s.hAlign === "left" ? 0 : s.hAlign === "center" ? free / 2 : free), y: y + s.padY + i * step };
  });
  return { box: { x, y, w, h }, lines };
}

export function measureWith(ctx: CanvasRenderingContext2D, s: TextStyle): Measure {
  ctx.font = fontString(s);
  return (t) => ctx.measureText(t).width;
}

export function drawText(ctx: CanvasRenderingContext2D, s: TextStyle, ax: number, ay: number) {
  ctx.save();
  const { box, lines } = layoutText(s, measureWith(ctx, s), ax, ay);
  if (s.background) { ctx.fillStyle = s.background; ctx.fillRect(box.x, box.y, box.w, box.h); }
  ctx.font = fontString(s); ctx.textBaseline = "top"; ctx.lineJoin = "round"; ctx.miterLimit = 2;
  ctx.fillStyle = s.fill; ctx.strokeStyle = s.border; ctx.lineWidth = s.borderWidth * 2;
  const ul = Math.max(1, s.size / 16);
  for (const pass of s.borderWidth > 0 ? ["stroke", "fill"] : ["fill"]) {
    for (const l of lines) {
      let cx = l.x;
      const y = l.y + s.size * 0.1;
      for (const ch of s.letterSpacing ? [...l.text] : [l.text]) {
        if (pass === "stroke") ctx.strokeText(ch, cx, y); else ctx.fillText(ch, cx, y);
        cx += ctx.measureText(ch).width + s.letterSpacing;
      }
      if (s.underline && l.w > 0) {
        const uy = l.y + s.size * 1.12;
        if (pass === "stroke") ctx.strokeRect(l.x, uy, l.w, ul); else ctx.fillRect(l.x, uy, l.w, ul);
      }
    }
  }
  ctx.restore();
}
