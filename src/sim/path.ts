import { offsetToAxial } from './hex';
import type { World } from './world';

/**
 * A* over the hex grid. All scratch memory is allocated once and reused, so a search creates
 * no garbage apart from the returned path. Version stamps avoid clearing arrays between searches.
 */
export class PathFinder {
  private readonly g: Float32Array;
  private readonly came: Int32Array;
  private readonly seen: Uint32Array;
  private readonly closed: Uint32Array;
  private readonly heapIdx: Int32Array;
  private readonly heapF: Float32Array;
  private readonly aq: Int32Array;
  private readonly ar: Int32Array;
  private stamp = 0;
  /** Nodes expanded by the last search (for profiling). */
  lastExpanded = 0;

  constructor(private readonly world: World) {
    const n = world.n;
    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.seen = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.heapIdx = new Int32Array(n * 6 + 8);
    this.heapF = new Float32Array(n * 6 + 8);
    this.aq = new Int32Array(n);
    this.ar = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const [q, r] = offsetToAxial(world.col(i), world.row(i));
      this.aq[i] = q;
      this.ar[i] = r;
    }
  }

  private h(i: number, goal: number): number {
    const dq = this.aq[i] - this.aq[goal], dr = this.ar[i] - this.ar[goal];
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  }

  /**
   * Returns the hex indices from start to goal inclusive, or null if unreachable.
   * `cost(i)` is the cost of entering hex i (>= 1 keeps the heuristic admissible).
   */
  find(start: number, goal: number, passable: (i: number) => boolean, cost: (i: number) => number = () => 1): number[] | null {
    const { g, came, seen, closed, heapIdx, heapF } = this;
    const nbr = this.world.nbr;
    const s = ++this.stamp;
    let size = 0;
    const push = (i: number, f: number) => {
      let k = size++;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heapF[p] <= f) break;
        heapIdx[k] = heapIdx[p]; heapF[k] = heapF[p]; k = p;
      }
      heapIdx[k] = i; heapF[k] = f;
    };
    const pop = (): number => {
      const top = heapIdx[0];
      const li = heapIdx[--size], lf = heapF[size];
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        if (l >= size) break;
        const r = l + 1;
        const m = r < size && heapF[r] < heapF[l] ? r : l;
        if (heapF[m] >= lf) break;
        heapIdx[k] = heapIdx[m]; heapF[k] = heapF[m]; k = m;
      }
      heapIdx[k] = li; heapF[k] = lf;
      return top;
    };

    g[start] = 0; seen[start] = s; came[start] = -1;
    push(start, this.h(start, goal));
    let expanded = 0;
    while (size > 0) {
      const i = pop();
      if (closed[i] === s) continue;
      closed[i] = s;
      expanded++;
      if (i === goal) {
        this.lastExpanded = expanded;
        const path: number[] = [];
        for (let c = goal; c !== -1; c = came[c]) path.push(c);
        return path.reverse();
      }
      for (let d = 0; d < 6; d++) {
        const j = nbr[i * 6 + d];
        if (j < 0 || closed[j] === s || !passable(j)) continue;
        const ng = g[i] + cost(j);
        if (seen[j] !== s || ng < g[j]) {
          seen[j] = s; g[j] = ng; came[j] = i;
          if (size < heapIdx.length) push(j, ng + this.h(j, goal));
        }
      }
    }
    this.lastExpanded = expanded;
    return null;
  }
}
