import { describe, expect, it } from 'vitest';
import { buildNeighbors, hexDistance, neighborOffset, opposite } from '../src/sim/hex';
import { HEX_H, HEX_MASK, HEX_W, HALF_W, ROW_H, pixelToHex } from '../src/render/hexgeom';

describe('hex math', () => {
  it('neighbor in opposite direction returns to origin, at distance 1', () => {
    for (const [c, r] of [[5, 4], [5, 5], [0, 1], [10, 7]]) {
      for (let d = 0; d < 6; d++) {
        const [c2, r2] = neighborOffset(c, r, d);
        expect(neighborOffset(c2, r2, opposite(d))).toEqual([c, r]);
        expect(hexDistance(c, r, c2, r2)).toBe(1);
      }
    }
  });
  it('neighbor table is symmetric', () => {
    const w = 9, h = 7, nbr = buildNeighbors(w, h);
    for (let i = 0; i < w * h; i++) {
      for (let d = 0; d < 6; d++) {
        const j = nbr[i * 6 + d];
        if (j >= 0) expect(nbr[j * 6 + opposite(d)]).toBe(i);
      }
    }
  });
});

describe('hex pixel geometry', () => {
  it('tiles cover the plane with no gaps or overlaps', () => {
    // Paint a 6x6 block of hexes into a pixel grid and count coverage in the interior.
    const cols = 6, rows = 6, W = cols * HEX_W + HALF_W, H = (rows - 1) * ROW_H + HEX_H;
    const cover = new Uint8Array(W * H);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const ox = c * HEX_W + (r & 1) * HALF_W, oy = r * ROW_H;
      for (let y = 0; y < HEX_H; y++) for (let x = 0; x < HEX_W; x++) if (HEX_MASK[y * HEX_W + x]) cover[(oy + y) * W + ox + x]++;
    }
    for (let y = HEX_H; y < H - HEX_H; y++) for (let x = HEX_W; x < W - HEX_W; x++) expect(cover[y * W + x]).toBe(1);
  });
  it('pixelToHex inverts the layout', () => {
    expect(pixelToHex(14, 16, 10, 10)).toBe(0);
    expect(pixelToHex(14 + 28, 16, 10, 10)).toBe(1);
    expect(pixelToHex(28, 24 + 16, 10, 10)).toBe(10); // odd row is shifted right by 14
  });
});
