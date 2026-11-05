import { buildNeighbors } from '../sim/hex';
import type { HexUpdateMessage, WorldMessage } from '../sim/protocol';

/** The main thread's read-only mirror of the sim's hex fields, kept in sync by worker messages. */
export class WorldView {
  readonly w: number;
  readonly h: number;
  readonly n: number;
  readonly seed: number;
  readonly terrain: Uint8Array;
  readonly ground: Uint8Array;
  readonly fertility: Float32Array;
  readonly forest: Uint8Array;
  readonly deposit: Uint8Array;
  readonly nbr: Int32Array;

  constructor(m: WorldMessage) {
    this.w = m.w; this.h = m.h; this.n = m.w * m.h; this.seed = m.seed;
    this.terrain = m.terrain; this.ground = m.ground; this.fertility = m.fertility;
    this.forest = m.forest; this.deposit = m.deposit;
    this.nbr = buildNeighbors(m.w, m.h);
  }

  apply(u: HexUpdateMessage) {
    u.idx.forEach((i, k) => {
      this.terrain[i] = u.terrain[k];
      this.ground[i] = u.ground[k];
      this.fertility[i] = u.fertility[k];
      this.forest[i] = u.forest[k];
      this.deposit[i] = u.deposit[k];
    });
  }
}
