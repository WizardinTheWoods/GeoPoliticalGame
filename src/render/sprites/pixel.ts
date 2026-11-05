import type { SpriteDef } from './defs';

export type Canvas = HTMLCanvasElement;

export function newCanvas(w: number, h: number): Canvas {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: Canvas): CanvasRenderingContext2D {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

export function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Render a text sprite to a canvas, optionally scaled by an integer factor. */
export function makeSprite(def: SpriteDef, scale = 1): Canvas {
  const h = def.rows.length, w = def.rows[0].length;
  const c = newCanvas(w * scale, h * scale);
  const ctx = ctx2d(c);
  def.rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`Sprite ${def.key}: row ${y} is ${row.length} px, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const col = def.palette[ch];
      if (!col) throw new Error(`Sprite ${def.key}: no palette entry for '${ch}'`);
      ctx.fillStyle = col;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  return c;
}

export function flipX(src: Canvas): Canvas {
  const c = newCanvas(src.width, src.height);
  const ctx = ctx2d(c);
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}
