import { generateWorld } from './mapgen';
import { PathFinder } from './path';
import { START_STOCK, type Stockpile } from './resources';
import { mulberry32, type Rng } from './rng';
import { T, WATER } from './terrain';
import { VEHICLE_KEYS, VEHICLE_TYPES, Vehicle, type VehicleType } from './vehicles';
import type { World } from './world';
import type { Command, CommandResult } from './protocol';

export const TICK_SECONDS = 0.1; // 10 Hz fixed tick
export const CANAL_COST: Partial<Stockpile> = { wood: 5, food: 15 };

/** The whole game state, advanced one fixed tick at a time. Contains no DOM and no wall-clock time. */
export class Simulation {
  readonly world: World;
  readonly rng: Rng;
  readonly paths: PathFinder;
  readonly vehicles: Vehicle[] = [];
  stock: Stockpile = { ...START_STOCK };
  tick = 0;

  constructor(readonly seed: number, w: number, h: number) {
    this.world = generateWorld(seed, w, h);
    this.rng = mulberry32(seed ^ 0x9e3779b9);
    this.paths = new PathFinder(this.world);
    this.spawnDemoBoats();
  }

  private spawn(type: VehicleType, at: number) {
    this.vehicles.push(new Vehicle(this.vehicles.length, type, at));
  }

  /** Demo traffic: a few cogs on the largest sea and barges on the larger fresh-water systems. */
  private spawnDemoBoats() {
    const bodies = [...this.world.bodies].sort((a, b) => b.cells.length - a.cells.length);
    const sea = bodies.find((b) => b.kind === WATER.SALT);
    if (sea) for (let k = 0; k < 8; k++) this.spawn(VEHICLE_TYPES.ship, sea.cells[Math.floor(this.rng() * sea.cells.length)]);
    const fresh = bodies.filter((b) => b.kind === WATER.FRESH && b.cells.length >= 8).slice(0, 6);
    for (const b of fresh) this.spawn(VEHICLE_TYPES.riverBoat, b.cells[Math.floor(this.rng() * b.cells.length)]);
  }

  /** Pick a random destination in the vehicle's water body and route to it. */
  private route(v: Vehicle) {
    const body = this.world.bodies[this.world.waterBody[v.at]];
    if (!body || body.cells.length < 2) return;
    for (let tries = 0; tries < 5; tries++) {
      const dest = body.cells[Math.floor(this.rng() * body.cells.length)];
      if (dest === v.at) continue;
      const path = this.paths.find(v.at, dest, (i) => v.type.canEnter(this.world, i));
      if (path && path.length > 1) { v.setPath(path); return; }
    }
  }

  step() {
    this.tick++;
    for (const v of this.vehicles) {
      if (!v.moving) this.route(v);
      v.advance(TICK_SECONDS);
    }
  }

  apply(cmd: Command): CommandResult {
    switch (cmd.kind) {
      case 'digCanal': return this.digCanal(cmd.i);
    }
  }

  private digCanal(i: number): CommandResult {
    const w = this.world;
    if (i < 0 || i >= w.n) return { ok: false, reason: 'Off the map.' };
    const t = w.terrain[i];
    if (t !== T.GRASSLAND && t !== T.DESERT && t !== T.FOOTHILLS) {
      return { ok: false, reason: 'Canals can only be dug in grassland, desert or foothills.' };
    }
    if (!w.hasFreshNeighbor(i)) return { ok: false, reason: 'A canal must connect to fresh water (river, lake or canal).' };
    for (const [k, v] of Object.entries(CANAL_COST) as [keyof Stockpile, number][]) {
      if (this.stock[k] < v) return { ok: false, reason: `Not enough ${k} (needs ${v}).` };
    }
    for (const [k, v] of Object.entries(CANAL_COST) as [keyof Stockpile, number][]) this.stock[k] -= v;
    w.ground[i] = t;
    w.terrain[i] = T.CANAL;
    w.forest[i] = 0;
    w.deposit[i] = 0;
    const dirty = [i];
    for (let d = 0; d < 6; d++) {
      const j = w.nbr[i * 6 + d];
      if (j >= 0) dirty.push(j);
    }
    for (const j of dirty) w.computeFertility(j);
    w.computeWaterBodies();
    return { ok: true, dirty };
  }

  /** Per vehicle: [typeIndex, fromHex, toHex, progress, speed]. */
  vehicleSnapshot(): Float32Array {
    const out = new Float32Array(this.vehicles.length * 5);
    this.vehicles.forEach((v, k) => {
      out[k * 5] = VEHICLE_KEYS.indexOf(v.type.key as never);
      out[k * 5 + 1] = v.at;
      out[k * 5 + 2] = v.next;
      out[k * 5 + 3] = v.progress;
      out[k * 5 + 4] = v.moving ? v.effectiveSpeed : 0;
    });
    return out;
  }
}
