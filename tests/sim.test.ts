import { describe, expect, it } from 'vitest';
import { generateWorld } from '../src/sim/mapgen';
import { Simulation } from '../src/sim/sim';
import { T, WATER, isFresh } from '../src/sim/terrain';
import { VEHICLE_TYPES } from '../src/sim/vehicles';

const hashArr = (a: ArrayLike<number>) => { let h = 0; for (let i = 0; i < a.length; i++) h = (Math.imul(h, 31) + a[i]) | 0; return h; };

describe('map generation', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const a = generateWorld(42, 96, 64), b = generateWorld(42, 96, 64), c = generateWorld(43, 96, 64);
    expect(hashArr(a.terrain)).toBe(hashArr(b.terrain));
    expect(hashArr(a.fertility)).toBe(hashArr(b.fertility));
    expect(hashArr(a.terrain)).not.toBe(hashArr(c.terrain));
  });
  it('produces every terrain type in plausible proportions', () => {
    const w = generateWorld(1337, 192, 128);
    const count = (t: number) => w.terrain.filter((x) => x === t).length;
    expect(count(T.OCEAN) / w.n).toBeGreaterThan(0.3);
    expect(count(T.OCEAN) / w.n).toBeLessThan(0.55);
    for (const t of [T.LAKE, T.RIVER, T.GRASSLAND, T.DESERT, T.FOOTHILLS, T.MOUNTAIN]) expect(count(t)).toBeGreaterThan(0);
    expect(count(T.CANAL)).toBe(0); // canals are only ever built
  });
  it('rivers and lakes are fresh, the ocean is salt, and fresh water irrigates neighbours', () => {
    const w = generateWorld(7, 128, 96);
    for (let i = 0; i < w.n; i++) {
      if (w.terrain[i] === T.RIVER || w.terrain[i] === T.LAKE) expect(w.waterKind(i)).toBe(WATER.FRESH);
      if (w.terrain[i] === T.OCEAN) expect(w.waterKind(i)).toBe(WATER.SALT);
      if (w.terrain[i] === T.DESERT && w.hasFreshNeighbor(i)) expect(w.fertility[i]).toBeGreaterThan(0.3);
    }
  });
});

describe('boats', () => {
  it('only path through their water kind, along adjacent hexes', () => {
    const sim = new Simulation(1337, 128, 96);
    for (let t = 0; t < 50; t++) sim.step();
    expect(sim.vehicles.length).toBeGreaterThan(0);
    for (const v of sim.vehicles) {
      for (let k = 0; k < v.path.length; k++) {
        expect(v.type.canEnter(sim.world, v.path[k])).toBe(true);
        if (k > 0) {
          const a = v.path[k - 1], b = v.path[k];
          expect(Array.from(sim.world.nbr.subarray(a * 6, a * 6 + 6))).toContain(b);
        }
      }
    }
  });
  it('respect cargo capacity (all vehicles share the CU unit)', () => {
    const sim = new Simulation(3, 64, 48);
    const v = sim.vehicles[0];
    const cap = v.type.cargoCapacity;
    expect(v.load('iron', cap - 5)).toBe(cap - 5);
    expect(v.load('wood', 50)).toBe(5);
    expect(v.cargoUsed).toBe(cap);
    expect(VEHICLE_TYPES.ship.maxHealth).toBeGreaterThan(0);
  });
});

describe('canals', () => {
  it('can only be dug next to fresh water, and irrigate dry neighbours', () => {
    const sim = new Simulation(1337, 192, 128);
    const w = sim.world;
    const far = Array.from({ length: w.n }, (_, i) => i).find((i) => w.terrain[i] === T.DESERT && !w.hasFreshNeighbor(i));
    expect(far).toBeDefined();
    expect(sim.apply({ kind: 'digCanal', i: far! }).ok).toBe(false);

    const site = Array.from({ length: w.n }, (_, i) => i).find((i) => (w.terrain[i] === T.GRASSLAND || w.terrain[i] === T.DESERT) && w.hasFreshNeighbor(i));
    expect(site).toBeDefined();
    const before = { ...sim.stock };
    const res = sim.apply({ kind: 'digCanal', i: site! });
    expect(res.ok).toBe(true);
    expect(w.terrain[site!]).toBe(T.CANAL);
    expect(isFresh(w.terrain[site!])).toBe(true);
    expect(sim.stock.wood).toBeLessThan(before.wood);
    for (let d = 0; d < 6; d++) {
      const j = w.nbr[site! * 6 + d];
      if (j >= 0 && w.terrain[j] === T.DESERT) expect(w.fertility[j]).toBeGreaterThan(0.3);
    }
  });
});
