// Pointy-top hexes stored in "odd-r" offset layout (odd rows shifted right by half a hex),
// so the map is a plain rectangle in memory. Math is done in axial coordinates.
// Reference: https://www.redblobgames.com/grids/hexagons/

/** Axial direction vectors. Index d also gives the screen angle: -60° * d (y down). */
export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], // 0 E
  [1, -1], // 1 NE
  [0, -1], // 2 NW
  [-1, 0], // 3 W
  [-1, 1], // 4 SW
  [0, 1], // 5 SE
];
export const DIR_NAMES = ['E', 'NE', 'NW', 'W', 'SW', 'SE'] as const;
export const opposite = (d: number) => (d + 3) % 6;

export function offsetToAxial(col: number, row: number): [number, number] {
  return [col - ((row - (row & 1)) >> 1), row];
}

export function axialToOffset(q: number, r: number): [number, number] {
  return [q + ((r - (r & 1)) >> 1), r];
}

export function neighborOffset(col: number, row: number, dir: number): [number, number] {
  const [q, r] = offsetToAxial(col, row);
  const d = DIRS[dir];
  return axialToOffset(q + d[0], r + d[1]);
}

export function hexDistance(c1: number, r1: number, c2: number, r2: number): number {
  const [q1, a1] = offsetToAxial(c1, r1);
  const [q2, a2] = offsetToAxial(c2, r2);
  const dq = q1 - q2, dr = a1 - a2;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Neighbor table: nbr[i*6 + d] is the index of hex i's neighbor in direction d, or -1 off-map. */
export function buildNeighbors(w: number, h: number): Int32Array {
  const nbr = new Int32Array(w * h * 6);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const i = row * w + col;
      for (let d = 0; d < 6; d++) {
        const [c2, r2] = neighborOffset(col, row, d);
        nbr[i * 6 + d] = c2 >= 0 && c2 < w && r2 >= 0 && r2 < h ? r2 * w + c2 : -1;
      }
    }
  }
  return nbr;
}
