import { hash2 } from '../../sim/rng';
import { T } from '../../sim/terrain';
import { HEX_H, HEX_MASK, HEX_W } from '../hexgeom';
import { TREES, ICONS, SHIP, BARGE } from './defs';
import { ctx2d, flipX, makeSprite, newCanvas, rgb, type Canvas } from './pixel';

// Hex tile textures generated procedurally as pixel art: a dithered base colour plus terrain
// details. Each terrain gets several variants, so large areas don't look tiled.

const VARIANTS = 4;

class HexPainter {
  readonly img: ImageData;
  constructor() { this.img = new ImageData(HEX_W, HEX_H); }
  put(x: number, y: number, hex: string, alpha = 255) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= HEX_W || y >= HEX_H || !HEX_MASK[y * HEX_W + x]) return;
    const [r, g, b] = rgb(hex);
    const o = (y * HEX_W + x) * 4;
    const d = this.img.data;
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = alpha;
  }
  /** Dithered fill: mostly shade 0, with some shade 1 and 2. Edge pixels are slightly darker to hint at the hex grid. */
  base(shades: readonly string[], seed: number) {
    for (let y = 0; y < HEX_H; y++) {
      for (let x = 0; x < HEX_W; x++) {
        if (!HEX_MASK[y * HEX_W + x]) continue;
        const r = hash2(x, y, seed);
        this.put(x, y, shades[r < 0.7 ? 0 : r < 0.85 ? 1 : 2]);
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const nx = x + dx, ny = y + dy;
          return nx < 0 || ny < 0 || nx >= HEX_W || ny >= HEX_H || !HEX_MASK[ny * HEX_W + nx];
        });
        if (edge) this.darken(x, y, 0.9);
      }
    }
  }
  darken(x: number, y: number, f: number) {
    const o = (y * HEX_W + x) * 4, d = this.img.data;
    d[o] *= f; d[o + 1] *= f; d[o + 2] *= f;
  }
  toCanvas(): Canvas {
    const c = newCanvas(HEX_W, HEX_H);
    ctx2d(c).putImageData(this.img, 0, 0);
    return c;
  }
}

type Painter = (p: HexPainter, rnd: () => number, seed: number) => void;
const rndFrom = (seed: number) => { let k = 0; return () => hash2(k++, 99, seed); };

const ocean: Painter = (p, rnd, seed) => {
  p.base(['#2b5d8a', '#285885', '#2f6391'], seed);
  for (let k = 0; k < 4; k++) {
    const x = 3 + rnd() * 19, y = 7 + rnd() * 18;
    [[0, 0], [1, -1], [2, -1], [3, 0]].forEach(([dx, dy]) => p.put(x + dx, y + dy, '#5d8fc0'));
  }
};
const fresh: Painter = (p, rnd, seed) => {
  p.base(['#4f9fc4', '#4b9ac0', '#56a7cb'], seed);
  for (let k = 0; k < 3; k++) p.put(4 + rnd() * 20, 7 + rnd() * 18, '#b9e4f4');
  for (let k = 0; k < 2; k++) {
    const x = 5 + rnd() * 16, y = 9 + rnd() * 14;
    p.put(x, y, '#78bedb'); p.put(x + 1, y, '#78bedb');
  }
};
const grass: Painter = (p, rnd, seed) => {
  p.base(['#5c9a3c', '#58943a', '#62a142'], seed);
  for (let k = 0; k < 8; k++) {
    const x = 3 + rnd() * 22, y = 6 + rnd() * 21;
    p.put(x, y, '#457d2e'); p.put(x, y - 1, '#457d2e');
  }
  if (rnd() < 0.6) p.put(5 + rnd() * 18, 8 + rnd() * 16, '#e8e070');
};
const desertDetail = (p: HexPainter, rnd: () => number) => {
  for (let k = 0; k < 3; k++) {
    const x0 = 2 + rnd() * 16, y0 = 9 + rnd() * 16;
    for (let t = 0; t <= 8; t++) {
      const y = y0 - Math.round(2 * Math.sin((Math.PI * t) / 8));
      p.put(x0 + t, y, '#c4a85f');
      p.put(x0 + t, y - 1, '#ecd99e');
    }
  }
};
const desert: Painter = (p, rnd, seed) => {
  p.base(['#dcc47c', '#d6bd74', '#e2cb86'], seed);
  desertDetail(p, rnd);
};
const irrigated: Painter = (p, rnd, seed) => {
  p.base(['#dcc47c', '#d6bd74', '#e2cb86'], seed);
  for (let y = 8; y <= 25; y += 3) {
    const x0 = 3 + rnd() * 6, len = 8 + rnd() * 12;
    for (let x = x0; x < x0 + len; x++) p.put(x, y, (x | 0) % 3 === 0 ? '#7c9a3f' : '#8daa4a');
  }
};
const foothills: Painter = (p, rnd, seed) => {
  p.base(['#8e9a54', '#89954f', '#949f5a'], seed);
  const bumps = [[8 + rnd() * 3, 15 + rnd() * 3, 6], [17 + rnd() * 3, 20 + rnd() * 3, 7]];
  for (const [cx, cy, rx] of bumps) {
    const ry = 4;
    for (let y = Math.floor(cy - ry); y <= cy; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const v = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (v > 1) continue;
        p.put(x, y, v > 0.75 ? '#5f6a30' : y < cy - ry * 0.4 && x < cx ? '#a7b267' : '#7d8a44');
      }
    }
  }
};
const peak = (p: HexPainter, ax: number, ay: number, baseY: number, slope: number) => {
  for (let y = ay; y <= baseY; y++) {
    const hw = (y - ay) * slope;
    const xl = Math.round(ax - hw), xr = Math.round(ax + hw);
    for (let x = xl; x <= xr; x++) {
      const snow = y < ay + 4;
      let c = x < ax ? (snow ? '#f4f6f8' : '#a39b8f') : snow ? '#c9d1da' : '#6b6359';
      if (x === xl || x === xr) c = '#3d362e';
      p.put(x, y, c);
    }
  }
};
const mountain: Painter = (p, rnd, seed) => {
  p.base(['#857b6c', '#7f7566', '#8b8172'], seed);
  if (rnd() < 0.7) peak(p, 7 + Math.round(rnd() * 2), 11, 24, 0.55);
  peak(p, 15 + Math.round(rnd() * 2), 5, 26, 0.62);
};

const PAINTERS: Record<number, Painter> = {
  [T.OCEAN]: ocean, [T.LAKE]: fresh, [T.RIVER]: fresh, [T.CANAL]: fresh,
  [T.GRASSLAND]: grass, [T.DESERT]: desert, [T.FOOTHILLS]: foothills, [T.MOUNTAIN]: mountain,
};

/** Fertility colour ramp: 0 = red-brown, 0.5 = yellow, 1 = green. */
export function fertilityColor(f: number): string {
  const stops: [number, number, number][] = [[122, 46, 46], [201, 178, 58], [63, 174, 63]];
  const t = Math.max(0, Math.min(1, f)) * 2;
  const k = Math.min(1, Math.floor(t)), u = t - k;
  const c = stops[k].map((v, j) => Math.round(v + (stops[k + 1][j] - v) * u));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export interface Atlas {
  terrain: Canvas[][]; // [terrainId][variant]
  irrigatedDesert: Canvas[];
  /** Canal half-segment from the hex centre to edge d, pre-rotated to -60° * d. */
  canalSeg: Canvas[];
  canalHub: Canvas;
  trees: Canvas[];
  icons: Record<string, Canvas>;
  /** Hex-shaped translucent tints for the fertility overlay, buckets 0..10. */
  fertility: Canvas[];
  hover: Canvas;
  vehicles: Record<string, [Canvas, Canvas]>; // [facing right, facing left]
  variants: number;
}

function hexTint(color: string, alpha: number): Canvas {
  const p = new HexPainter();
  for (let y = 0; y < HEX_H; y++) for (let x = 0; x < HEX_W; x++) p.put(x, y, color, alpha);
  return p.toCanvas();
}

function hoverOutline(): Canvas {
  const p = new HexPainter();
  for (let y = 0; y < HEX_H; y++) {
    for (let x = 0; x < HEX_W; x++) {
      if (!HEX_MASK[y * HEX_W + x]) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        return nx < 0 || ny < 0 || nx >= HEX_W || ny >= HEX_H || !HEX_MASK[ny * HEX_W + nx];
      });
      if (edge) p.put(x, y, '#ffffff', 230);
    }
  }
  return p.toCanvas();
}

function canalPieces(): { segs: Canvas[]; hub: Canvas } {
  // One horizontal half-segment (centre → east edge). Rotating it by 60° steps gives every
  // direction, and any canal shape is the union of its half-segments.
  const seg = newCanvas(HEX_W, HEX_H);
  const s = ctx2d(seg);
  const row = (y: number, c: string) => { s.fillStyle = c; s.fillRect(13, y, HEX_W - 13, 1); };
  row(13, '#8b7d6b'); row(14, '#6fb6d6'); row(15, '#4f9fc4'); row(16, '#4f9fc4'); row(17, '#4f9fc4'); row(18, '#6f6354');
  const segs: Canvas[] = [];
  for (let d = 0; d < 6; d++) {
    const c = newCanvas(HEX_W, HEX_H);
    const x = ctx2d(c);
    x.translate(14, 16);
    x.rotate((-Math.PI / 3) * d);
    x.drawImage(seg, -14, -16);
    segs.push(c);
  }
  const hub = newCanvas(HEX_W, HEX_H);
  const h = ctx2d(hub);
  h.fillStyle = '#7a6d5c'; h.fillRect(10, 12, 8, 8);
  h.fillStyle = '#4f9fc4'; h.fillRect(11, 13, 6, 6);
  h.fillStyle = '#6fb6d6'; h.fillRect(11, 13, 6, 1);
  return { segs, hub };
}

export function buildAtlas(): Atlas {
  const terrain: Canvas[][] = [];
  for (const id of Object.values(T)) {
    terrain[id] = [];
    for (let v = 0; v < VARIANTS; v++) {
      const p = new HexPainter();
      const seed = id * 100 + v;
      PAINTERS[id](p, rndFrom(seed), seed);
      terrain[id].push(p.toCanvas());
    }
  }
  const irrigatedDesert = Array.from({ length: VARIANTS }, (_, v) => {
    const p = new HexPainter();
    irrigated(p, rndFrom(900 + v), 900 + v);
    return p.toCanvas();
  });
  const { segs, hub } = canalPieces();
  const icons: Record<string, Canvas> = {};
  for (const [k, def] of Object.entries(ICONS)) icons[k] = makeSprite(def);
  const ship = makeSprite(SHIP), barge = makeSprite(BARGE);
  return {
    terrain, irrigatedDesert, canalSeg: segs, canalHub: hub,
    trees: TREES.map((t) => makeSprite(t)), icons,
    fertility: Array.from({ length: 11 }, (_, k) => hexTint(fertilityColor(k / 10), 140)),
    hover: hoverOutline(),
    vehicles: { ship: [ship, flipX(ship)], riverBoat: [barge, flipX(barge)] },
    variants: VARIANTS,
  };
}
