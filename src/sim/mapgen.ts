import { fbm } from './noise';
import { mulberry32, hash2 } from './rng';
import { DEPOSIT, T } from './terrain';
import { World } from './world';

const SQRT3_2 = 0.8660254037844386; // literal, avoids relying on engine Math functions

/** Value at quantile q (0..1) of a list of numbers. */
function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const s = Float64Array.from(values).sort();
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

export interface MapGenOptions {
  /** Fraction of hexes that are ocean. */
  oceanFraction?: number;
}

/**
 * Layered generation: elevation → ocean / mountains / foothills → moisture → desert / grassland
 * and forest → lakes → rivers (downhill walks) → deposits → fertility → water bodies.
 * Thresholds are percentiles, so every seed gets similar proportions.
 */
export function generateWorld(seed: number, w: number, h: number, opts: MapGenOptions = {}): World {
  const world = new World(w, h);
  const { terrain, ground, elevation, moisture, forest, deposit, nbr, n } = world;
  const rng = mulberry32(seed);
  const oceanFraction = opts.oceanFraction ?? 0.42;
  const H = h * SQRT3_2;

  // 1. Elevation: large continents plus detail, falling off toward the map edge.
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const i = row * w + col;
      const x = col + 0.5 * (row & 1), y = row * SQRT3_2;
      const big = fbm(x / 64, y / 64, seed, 3);
      const detail = fbm(x / 16, y / 16, seed + 31, 4);
      const edge = Math.min(x / w, 1 - x / w, y / H, 1 - y / H);
      const fall = Math.min(1, Math.max(0, edge) / 0.14);
      elevation[i] = big * 0.6 + detail * 0.4 - (1 - fall) * 0.45;
      moisture[i] = fbm(x / 22, y / 22, seed + 77, 4);
    }
  }

  // 2. Ocean, mountains, foothills by percentile.
  const all = Array.from(elevation);
  const seaLevel = quantile(all, oceanFraction);
  const landElev = all.filter((e) => e > seaLevel);
  const mountainLevel = quantile(landElev, 0.92);
  const hillLevel = quantile(landElev, 0.8);

  // 3. Moisture splits flat land into desert and grassland, and sets forest density.
  const flatMoist: number[] = [];
  for (let i = 0; i < n; i++) {
    const e = elevation[i];
    if (e > seaLevel && e <= hillLevel) flatMoist.push(moisture[i]);
  }
  const desertLevel = quantile(flatMoist, 0.22);
  const f1 = quantile(flatMoist, 0.55), f2 = quantile(flatMoist, 0.7), f3 = quantile(flatMoist, 0.85);

  for (let i = 0; i < n; i++) {
    const e = elevation[i], m = moisture[i];
    let t: number;
    if (e <= seaLevel) t = T.OCEAN;
    else if (e > mountainLevel) t = T.MOUNTAIN;
    else if (e > hillLevel) t = T.FOOTHILLS;
    else if (m < desertLevel) t = T.DESERT;
    else t = T.GRASSLAND;
    terrain[i] = t;
    ground[i] = t;
    if (t === T.GRASSLAND) forest[i] = m > f3 ? 3 : m > f2 ? 2 : m > f1 ? 1 : 0;
    else if (t === T.FOOTHILLS) forest[i] = m > f2 ? 1 : 0;
  }

  const touches = (i: number, t: number) => {
    for (let d = 0; d < 6; d++) {
      const j = nbr[i * 6 + d];
      if (j >= 0 && terrain[j] === t) return true;
    }
    return false;
  };

  // 4. Lakes: small low-lying blobs in wet grassland, away from the coast.
  const wetLevel = quantile(flatMoist, 0.6);
  const lakeCount = Math.max(2, Math.round(n / 2500));
  for (let k = 0, tries = 0; k < lakeCount && tries < lakeCount * 40; tries++) {
    const s = Math.floor(rng() * n);
    if (terrain[s] !== T.GRASSLAND || moisture[s] < wetLevel || touches(s, T.OCEAN)) continue;
    const size = 3 + Math.floor(rng() * 8);
    const lake = [s];
    terrain[s] = T.LAKE;
    while (lake.length < size) {
      let best = -1, bestE = Infinity;
      for (const c of lake) {
        for (let d = 0; d < 6; d++) {
          const j = nbr[c * 6 + d];
          if (j < 0 || terrain[j] !== T.GRASSLAND || touches(j, T.OCEAN)) continue;
          if (elevation[j] < bestE) { bestE = elevation[j]; best = j; }
        }
      }
      if (best < 0) break;
      terrain[best] = T.LAKE;
      lake.push(best);
    }
    for (const c of lake) forest[c] = 0;
    k++;
  }

  // 5. Rivers: walk downhill from highlands until reaching ocean, a lake, or another river.
  //    A walk that gets stuck in a pit ends in a new lake.
  const riverAttempts = Math.round(n / 600);
  for (let a = 0; a < riverAttempts; a++) {
    const src = Math.floor(rng() * n);
    const ts = terrain[src];
    if ((ts !== T.MOUNTAIN && ts !== T.FOOTHILLS) || touches(src, T.RIVER)) continue;
    const path = [src];
    const inPath = new Set(path);
    let cur = src, ok = false, pit = -1;
    for (let step = 0; step < 600; step++) {
      let best = -1, bestE = Infinity, reachedWater = false;
      for (let d = 0; d < 6; d++) {
        const j = nbr[cur * 6 + d];
        if (j < 0 || inPath.has(j)) continue;
        const tj = terrain[j];
        if (tj === T.OCEAN || tj === T.LAKE || tj === T.RIVER) { reachedWater = true; break; }
        const ej = elevation[j] + rng() * 0.004;
        if (ej < bestE) { bestE = ej; best = j; }
      }
      if (reachedWater) { ok = true; break; }
      if (best < 0) break;
      if (bestE > elevation[cur] + 0.02) { ok = true; pit = cur; break; }
      path.push(best);
      inPath.add(best);
      cur = best;
    }
    if (!ok || path.length < 4) continue;
    for (const p of path) {
      terrain[p] = p === pit ? T.LAKE : T.RIVER;
      forest[p] = 0;
    }
  }

  // 6. Mineral deposits (hash per hex, so the result doesn't depend on rng call order).
  for (let i = 0; i < n; i++) {
    const t = terrain[i];
    const r = hash2(i, 7, seed);
    if (t === T.MOUNTAIN) deposit[i] = r < 0.04 ? DEPOSIT.IRON : r < 0.06 ? DEPOSIT.COPPER : r < 0.075 ? DEPOSIT.GOLD : 0;
    else if (t === T.FOOTHILLS) deposit[i] = r < 0.03 ? DEPOSIT.COPPER : r < 0.05 ? DEPOSIT.IRON : r < 0.055 ? DEPOSIT.GOLD : 0;
    else if (t === T.DESERT) deposit[i] = r < 0.015 ? DEPOSIT.COPPER : r < 0.023 ? DEPOSIT.GOLD : 0;
    else if (t === T.GRASSLAND) deposit[i] = r < 0.005 ? DEPOSIT.IRON : 0;
  }

  // 7. Derived fields.
  for (let i = 0; i < n; i++) world.computeFertility(i);
  world.computeWaterBodies();
  return world;
}
