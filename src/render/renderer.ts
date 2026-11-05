import { DEPOSIT_RESOURCE, T, TERRAIN, isFresh, isLand } from '../sim/terrain';
import { VEHICLE_KEYS } from '../sim/vehicles';
import { hash2 } from '../sim/rng';
import type { Camera } from './camera';
import { HEX_H, HEX_W, HALF_W, ROW_H, hexX, hexY } from './hexgeom';
import { ctx2d, newCanvas, rgb, type Canvas } from './sprites/pixel';
import { fertilityColor, type Atlas } from './sprites/tiles';
import type { WorldView } from './worldView';

// Canvas 2D renderer. Works with no GPU: browsers rasterise Canvas 2D on the CPU when no
// GPU is present, and accelerate it when one is.
//
// Cost control:
//  * The map is cut into chunks of CHUNK x CHUNK hexes. Each chunk is drawn once into an
//    offscreen canvas and redrawn only when one of its hexes changes. A frame is then a few
//    dozen chunk blits, not tens of thousands of tile draws.
//  * Chunks are built lazily, at most BUILD_BUDGET per frame, and evicted LRU.
//  * When zoomed far out, a 1-colour-per-hex overview image is drawn instead.

const CHUNK = 16;
const CHUNK_PX_W = CHUNK * HEX_W + HALF_W;
const CHUNK_PX_H = (CHUNK - 1) * ROW_H + HEX_H;
const MAX_CHUNKS = 120;
const BUILD_BUDGET = 6;
/** Below this zoom, draw the overview image instead of chunks. */
export const OVERVIEW_ZOOM = 0.45;
/** World pixels per overview pixel. A hex becomes a 7x6 block. */
const OV = 4;

export interface VehicleFrame {
  data: Float32Array;
  receivedAt: number;
}

export class MapRenderer {
  private chunks = new Map<number, Canvas>();
  private readonly cw: number;
  private readonly chh: number;
  private overview: Canvas;
  fertilityOverlay = false;
  hover = -1;
  lastFrame = { chunksDrawn: 0, chunksBuilt: 0, overview: false };

  constructor(private readonly view: WorldView, private readonly atlas: Atlas) {
    this.cw = Math.ceil(view.w / CHUNK);
    this.chh = Math.ceil(view.h / CHUNK);
    this.overview = newCanvas(view.w * 7 + 4, view.h * 6);
    this.rebuildOverview();
  }

  setFertilityOverlay(on: boolean) {
    this.fertilityOverlay = on;
    this.chunks.clear();
    this.rebuildOverview();
  }

  /** Called after the sim changes hexes. Neighbouring chunks are included because canal links span hexes. */
  markDirty(indices: ArrayLike<number>) {
    const ctx = ctx2d(this.overview);
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      const col = i % this.view.w, row = (i / this.view.w) | 0;
      this.chunks.delete(Math.floor(row / CHUNK) * this.cw + Math.floor(col / CHUNK));
      this.paintOverviewHex(ctx, i);
    }
  }

  private overviewColor(i: number): string {
    const t = this.view.terrain[i];
    if (this.fertilityOverlay && isLand(t)) return fertilityColor(this.view.fertility[i]);
    if (t === T.DESERT && this.view.fertility[i] > 0.3) return '#b8b86a';
    if (t === T.GRASSLAND && this.view.forest[i] >= 2) return '#3f7d3a';
    return TERRAIN[t].overview;
  }

  private paintOverviewHex(ctx: CanvasRenderingContext2D, i: number) {
    const col = i % this.view.w, row = (i / this.view.w) | 0;
    ctx.fillStyle = this.overviewColor(i);
    ctx.fillRect(col * 7 + (row & 1) * 4, row * 6, 7, 6);
  }

  private rebuildOverview() {
    const { w, h } = this.view;
    const ctx = ctx2d(this.overview);
    const img = ctx.createImageData(this.overview.width, this.overview.height);
    const d = img.data;
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const [r, g, b] = rgb(this.overviewColor(row * w + col));
        const x0 = col * 7 + (row & 1) * 4, y0 = row * 6;
        for (let y = y0; y < y0 + 6; y++) {
          for (let x = x0; x < x0 + 7; x++) {
            const o = (y * img.width + x) * 4;
            d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  private drawHex(ctx: CanvasRenderingContext2D, i: number, x: number, y: number) {
    const v = this.view, a = this.atlas;
    const t = v.terrain[i];
    const variant = Math.floor(hash2(i, 3, v.seed) * a.variants);
    if (t === T.CANAL) {
      const g = v.ground[i];
      const under = g === T.DESERT ? a.irrigatedDesert : a.terrain[g];
      ctx.drawImage(under[variant], x, y);
      for (let d = 0; d < 6; d++) {
        const j = v.nbr[i * 6 + d];
        if (j >= 0 && isFresh(v.terrain[j])) ctx.drawImage(a.canalSeg[d], x, y);
      }
      ctx.drawImage(a.canalHub, x, y);
    } else if (t === T.DESERT && v.fertility[i] > 0.3) {
      ctx.drawImage(a.irrigatedDesert[variant], x, y);
    } else {
      ctx.drawImage(a.terrain[t][variant], x, y);
    }
    const f = v.forest[i];
    if (f > 0 && isLand(t)) {
      const spots = [[4, 9], [15, 6], [9, 15], [17, 15], [12, 21]];
      const count = f === 1 ? 2 : f === 2 ? 3 : 5;
      for (let k = 0; k < count; k++) {
        const [sx, sy] = spots[(k + variant) % spots.length];
        const tree = a.trees[hash2(i, k, 11) < (t === T.FOOTHILLS ? 0.8 : 0.45) ? 0 : 1];
        ctx.drawImage(tree, x + sx, y + sy);
      }
    }
    const dep = DEPOSIT_RESOURCE[v.deposit[i]];
    if (dep) ctx.drawImage(a.icons[dep], x + 9, y + 20);
    if (this.fertilityOverlay && isLand(t)) {
      ctx.drawImage(a.fertility[Math.round(v.fertility[i] * 10)], x, y);
    }
  }

  private buildChunk(cx: number, cy: number): Canvas {
    const c = newCanvas(CHUNK_PX_W, CHUNK_PX_H);
    const ctx = ctx2d(c);
    const { w, h } = this.view;
    const ox = cx * CHUNK * HEX_W, oy = cy * CHUNK * ROW_H;
    for (let row = cy * CHUNK; row < Math.min(h, (cy + 1) * CHUNK); row++) {
      for (let col = cx * CHUNK; col < Math.min(w, (cx + 1) * CHUNK); col++) {
        this.drawHex(ctx, row * w + col, hexX(col, row) - ox, hexY(row) - oy);
      }
    }
    return c;
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera, dpr: number, vehicles: VehicleFrame | null, now: number) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const s = cam.zoom * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, W, H);
    const sx = (wx: number) => Math.round((wx - cam.x) * s);
    const sy = (wy: number) => Math.round((wy - cam.y) * s);
    const stats = { chunksDrawn: 0, chunksBuilt: 0, overview: cam.zoom < OVERVIEW_ZOOM };

    if (stats.overview) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.overview, sx(0), sy(0), Math.round(this.overview.width * OV * s), Math.round(this.overview.height * OV * s));
    } else {
      ctx.imageSmoothingEnabled = cam.zoom < 1;
      const [wx0, wy0] = [cam.x, cam.y];
      const [wx1, wy1] = [cam.x + W / s, cam.y + H / s];
      const cx0 = Math.max(0, Math.floor((wx0 - HALF_W) / (CHUNK * HEX_W)));
      const cy0 = Math.max(0, Math.floor((wy0 - HEX_H) / (CHUNK * ROW_H)));
      const cx1 = Math.min(this.cw - 1, Math.floor(wx1 / (CHUNK * HEX_W)));
      const cy1 = Math.min(this.chh - 1, Math.floor(wy1 / (CHUNK * ROW_H)));
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const key = cy * this.cw + cx;
          let c = this.chunks.get(key);
          const ox = cx * CHUNK * HEX_W, oy = cy * CHUNK * ROW_H;
          if (c) {
            this.chunks.delete(key); // refresh LRU position
            this.chunks.set(key, c);
          } else if (stats.chunksBuilt < BUILD_BUDGET) {
            c = this.buildChunk(cx, cy);
            stats.chunksBuilt++;
            this.chunks.set(key, c);
            if (this.chunks.size > MAX_CHUNKS) this.chunks.delete(this.chunks.keys().next().value!);
          } else {
            // Not built yet: show the overview for this area for a frame or two.
            const ovx = ox / OV, ovy = oy / OV;
            ctx.drawImage(this.overview, ovx, ovy, CHUNK_PX_W / OV, CHUNK_PX_H / OV, sx(ox), sy(oy),
              sx(ox + CHUNK_PX_W) - sx(ox), sy(oy + CHUNK_PX_H) - sy(oy));
            continue;
          }
          ctx.drawImage(c, sx(ox), sy(oy), sx(ox + CHUNK_PX_W) - sx(ox), sy(oy + CHUNK_PX_H) - sy(oy));
          stats.chunksDrawn++;
        }
      }
    }

    ctx.imageSmoothingEnabled = false;
    if (vehicles) this.drawVehicles(ctx, vehicles, now, sx, sy, s);
    if (this.hover >= 0 && !stats.overview) {
      const col = this.hover % this.view.w, row = (this.hover / this.view.w) | 0;
      const x = hexX(col, row), y = hexY(row);
      ctx.drawImage(this.atlas.hover, sx(x), sy(y), sx(x + HEX_W) - sx(x), sy(y + HEX_H) - sy(y));
    }
    this.lastFrame = stats;
  }

  private drawVehicles(ctx: CanvasRenderingContext2D, f: VehicleFrame, now: number,
    sx: (x: number) => number, sy: (y: number) => number, s: number) {
    const { w } = this.view;
    const centre = (i: number): [number, number] => {
      const col = i % w, row = (i / w) | 0;
      return [hexX(col, row) + HEX_W / 2, hexY(row) + HEX_H / 2];
    };
    const elapsed = (now - f.receivedAt) / 1000;
    const scale = Math.max(1, Math.round(s));
    for (let k = 0; k < f.data.length; k += 5) {
      const type = VEHICLE_KEYS[f.data[k]];
      const sprites = this.atlas.vehicles[type];
      if (!sprites) continue;
      const from = f.data[k + 1], to = f.data[k + 2];
      // Extrapolate between 10 Hz sim ticks so motion looks smooth at 60 fps.
      const p = Math.min(1, f.data[k + 3] + f.data[k + 4] * elapsed);
      const [ax, ay] = centre(from), [bx, by] = centre(to);
      const x = ax + (bx - ax) * p, y = ay + (by - ay) * p;
      const img = bx < ax ? sprites[1] : sprites[0];
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, sx(x) - dw / 2, sy(y) - dh / 2 - 2 * scale, dw, dh);
    }
  }
}
