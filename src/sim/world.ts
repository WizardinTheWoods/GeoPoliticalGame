import { buildNeighbors } from './hex';
import { T, TERRAIN, WATER, isFresh, isLand, type WaterKind } from './terrain';

export interface WaterBody {
  id: number;
  kind: WaterKind;
  cells: number[];
}

/**
 * Tier-0 "field" state: one entry per hex, stored as typed arrays (struct-of-arrays).
 * Index i = row * w + col (odd-r offset layout, see hex.ts).
 */
export class World {
  readonly n: number;
  readonly terrain: Uint8Array;
  /** The land type under a canal or river (what the hex was before it became water). */
  readonly ground: Uint8Array;
  readonly elevation: Float32Array;
  readonly moisture: Float32Array;
  readonly fertility: Float32Array;
  /** Forest cover density 0..3, drawn as a tree overlay (not entities). */
  readonly forest: Uint8Array;
  readonly deposit: Uint8Array;
  readonly nbr: Int32Array;
  /** Connected water body id per hex (-1 on land). Boats route only inside their body. */
  readonly waterBody: Int32Array;
  bodies: WaterBody[] = [];

  constructor(readonly w: number, readonly h: number) {
    const n = (this.n = w * h);
    this.terrain = new Uint8Array(n);
    this.ground = new Uint8Array(n);
    this.elevation = new Float32Array(n);
    this.moisture = new Float32Array(n);
    this.fertility = new Float32Array(n);
    this.forest = new Uint8Array(n);
    this.deposit = new Uint8Array(n);
    this.waterBody = new Int32Array(n).fill(-1);
    this.nbr = buildNeighbors(w, h);
  }

  col(i: number) { return i % this.w; }
  row(i: number) { return (i / this.w) | 0; }
  idx(col: number, row: number) { return row * this.w + col; }
  waterKind(i: number): WaterKind { return TERRAIN[this.terrain[i]].water; }

  hasFreshNeighbor(i: number): boolean {
    for (let d = 0; d < 6; d++) {
      const j = this.nbr[i * 6 + d];
      if (j >= 0 && isFresh(this.terrain[j])) return true;
    }
    return false;
  }

  /**
   * Fertility = soil quality plus a fresh-water bonus. Fresh water (river, lake, canal) next to
   * a hex irrigates it: desert becomes farmable, and grassland and foothills improve.
   */
  computeFertility(i: number): void {
    const t = this.terrain[i];
    if (!isLand(t) || t === T.MOUNTAIN) { this.fertility[i] = 0; return; }
    let f = t === T.GRASSLAND ? 0.5 + 0.35 * this.moisture[i] : TERRAIN[t].baseFertility;
    if (this.hasFreshNeighbor(i)) {
      if (t === T.DESERT) f = 0.55;
      else if (t === T.GRASSLAND) f += 0.2;
      else if (t === T.FOOTHILLS) f += 0.15;
    }
    this.fertility[i] = Math.min(1, f);
  }

  isIrrigatedDesert(i: number): boolean {
    return this.terrain[i] === T.DESERT && this.fertility[i] > 0.3;
  }

  /** Flood-fill connected fresh and salt water separately (fresh and salt never merge). */
  computeWaterBodies(): void {
    this.waterBody.fill(-1);
    this.bodies = [];
    const stack: number[] = [];
    for (let s = 0; s < this.n; s++) {
      const kind = this.waterKind(s);
      if (kind === WATER.NONE || this.waterBody[s] >= 0) continue;
      const body: WaterBody = { id: this.bodies.length, kind, cells: [] };
      this.bodies.push(body);
      this.waterBody[s] = body.id;
      stack.push(s);
      while (stack.length) {
        const i = stack.pop()!;
        body.cells.push(i);
        for (let d = 0; d < 6; d++) {
          const j = this.nbr[i * 6 + d];
          if (j >= 0 && this.waterBody[j] < 0 && this.waterKind(j) === kind) {
            this.waterBody[j] = body.id;
            stack.push(j);
          }
        }
      }
    }
  }
}
