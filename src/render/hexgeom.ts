// Pixel geometry of a pointy-top hex tile: 28 x 32 px. Rows are 24 px apart and odd rows
// shift right by 14 px. The mask tests pixel centres against the hex polygon
// (14,0) (28,8) (28,24) (14,32) (0,24) (0,8). No pixel centre lies exactly on an edge, so
// neighbouring tiles tile perfectly, with no gaps or overlaps.

export const HEX_W = 28;
export const HEX_H = 32;
export const ROW_H = 24;
export const HALF_W = 14;

export function insideHex(x: number, y: number): boolean {
  const px = x + 0.5, py = y + 0.5;
  if (px < 0 || px > HEX_W || py < 0 || py > HEX_H) return false;
  const dx = Math.abs(px - HALF_W);
  return py > (8 * dx) / 14 && py < HEX_H - (8 * dx) / 14;
}

export const HEX_MASK: Uint8Array = (() => {
  const m = new Uint8Array(HEX_W * HEX_H);
  for (let y = 0; y < HEX_H; y++) for (let x = 0; x < HEX_W; x++) m[y * HEX_W + x] = insideHex(x, y) ? 1 : 0;
  return m;
})();

/** Top-left pixel of the hex at (col, row) in world pixel space. */
export const hexX = (col: number, row: number) => col * HEX_W + (row & 1) * HALF_W;
export const hexY = (row: number) => row * ROW_H;

/** World pixel → hex index, or -1. Uses the same mask as rendering, so it is exact. */
export function pixelToHex(wx: number, wy: number, w: number, h: number): number {
  const r0 = Math.floor(wy / ROW_H);
  for (const r of [r0, r0 - 1]) {
    if (r < 0 || r >= h) continue;
    const ox = (r & 1) * HALF_W;
    const c = Math.floor((wx - ox) / HEX_W);
    if (c < 0 || c >= w) continue;
    const lx = Math.floor(wx - (c * HEX_W + ox)), ly = Math.floor(wy - r * ROW_H);
    if (lx >= 0 && lx < HEX_W && ly >= 0 && ly < HEX_H && HEX_MASK[ly * HEX_W + lx]) return r * w + c;
  }
  return -1;
}
