import type { ResourceKey } from './resources';
import { T, WATER, type WaterKind } from './terrain';
import type { World } from './world';

/**
 * Every vehicle type has health and a cargo capacity in CU (see resources.ts).
 * Subclasses only decide where the vehicle may go. Roads/rails add network graphs
 * later (docs/DESIGN.md §2.4b), and wagons and trains plug into the same base class.
 */
export abstract class VehicleType {
  constructor(
    readonly key: string,
    readonly name: string,
    readonly maxHealth: number,
    /** Cargo capacity in CU. */
    readonly cargoCapacity: number,
    /** Hexes per second at full health. */
    readonly speed: number,
  ) {}
  abstract canEnter(world: World, i: number): boolean;
}

export class BoatType extends VehicleType {
  constructor(key: string, name: string, maxHealth: number, cargoCapacity: number, speed: number, readonly waters: readonly WaterKind[]) {
    super(key, name, maxHealth, cargoCapacity, speed);
  }
  canEnter(world: World, i: number): boolean {
    return this.waters.includes(world.waterKind(i));
  }
}

export class WagonType extends VehicleType {
  canEnter(world: World, i: number): boolean {
    return world.waterKind(i) === WATER.NONE && world.terrain[i] !== T.MOUNTAIN;
  }
}

export const VEHICLE_TYPES = {
  riverBoat: new BoatType('riverBoat', 'River barge', 40, 20, 1.2, [WATER.FRESH]),
  ship: new BoatType('ship', 'Cog', 100, 100, 2.0, [WATER.SALT]),
  wagon: new WagonType('wagon', 'Wagon', 30, 10, 1.0),
} as const;
export type VehicleKey = keyof typeof VEHICLE_TYPES;
export const VEHICLE_KEYS = Object.keys(VEHICLE_TYPES) as VehicleKey[];

export class Vehicle {
  health: number;
  readonly cargo: Partial<Record<ResourceKey, number>> = {};
  path: number[] = [];
  /** Index into path of the hex the vehicle is leaving. */
  seg = 0;
  /** 0..1 progress toward path[seg + 1]. */
  progress = 0;

  constructor(readonly id: number, readonly type: VehicleType, public at: number) {
    this.health = type.maxHealth;
  }

  get cargoUsed(): number {
    let s = 0;
    for (const v of Object.values(this.cargo)) s += v ?? 0;
    return s;
  }

  /** Loads up to `amount` CU and returns how much fit. */
  load(res: ResourceKey, amount: number): number {
    const fit = Math.max(0, Math.min(amount, this.type.cargoCapacity - this.cargoUsed));
    this.cargo[res] = (this.cargo[res] ?? 0) + fit;
    return fit;
  }

  get moving(): boolean { return this.seg < this.path.length - 1; }
  get next(): number { return this.moving ? this.path[this.seg + 1] : this.at; }

  setPath(path: number[]) {
    this.path = path;
    this.seg = 0;
    this.progress = 0;
  }

  /** Damaged vehicles slow down, to a minimum of half speed. */
  get effectiveSpeed(): number {
    return this.type.speed * (0.5 + 0.5 * (this.health / this.type.maxHealth));
  }

  advance(dt: number) {
    if (!this.moving) return;
    this.progress += this.effectiveSpeed * dt;
    while (this.progress >= 1 && this.moving) {
      this.progress -= 1;
      this.seg++;
      this.at = this.path[this.seg];
    }
    if (!this.moving) this.progress = 0;
  }
}
