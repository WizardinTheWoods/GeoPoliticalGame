// Tile types. Water hexes carry a water kind (fresh or salt), which drives fertility
// (fresh water irrigates neighbors) and navigation (which boat types can enter).

export const T = {
  OCEAN: 0,
  LAKE: 1,
  RIVER: 2,
  CANAL: 3,
  GRASSLAND: 4,
  DESERT: 5,
  FOOTHILLS: 6,
  MOUNTAIN: 7,
} as const;
export type Terrain = (typeof T)[keyof typeof T];

export const WATER = { NONE: 0, FRESH: 1, SALT: 2 } as const;
export type WaterKind = (typeof WATER)[keyof typeof WATER];
export const WATER_NAMES = ['none', 'fresh', 'salt'] as const;

export interface TerrainDef {
  readonly id: Terrain;
  readonly key: string;
  readonly name: string;
  readonly water: WaterKind;
  /** Soil quality before water bonuses, 0..1. */
  readonly baseFertility: number;
  /** Flat colour for the zoomed-out overview. */
  readonly overview: string;
}

export const TERRAIN: readonly TerrainDef[] = [
  { id: T.OCEAN, key: 'ocean', name: 'Ocean', water: WATER.SALT, baseFertility: 0, overview: '#2b5d8a' },
  { id: T.LAKE, key: 'lake', name: 'Lake', water: WATER.FRESH, baseFertility: 0, overview: '#4f9fc4' },
  { id: T.RIVER, key: 'river', name: 'River', water: WATER.FRESH, baseFertility: 0, overview: '#4f9fc4' },
  { id: T.CANAL, key: 'canal', name: 'Canal', water: WATER.FRESH, baseFertility: 0, overview: '#6fb6d6' },
  { id: T.GRASSLAND, key: 'grassland', name: 'Grassland', water: WATER.NONE, baseFertility: 0.6, overview: '#5c9a3c' },
  { id: T.DESERT, key: 'desert', name: 'Desert', water: WATER.NONE, baseFertility: 0.05, overview: '#d9c27a' },
  { id: T.FOOTHILLS, key: 'foothills', name: 'Foothills', water: WATER.NONE, baseFertility: 0.35, overview: '#8e9a54' },
  { id: T.MOUNTAIN, key: 'mountain', name: 'Mountain', water: WATER.NONE, baseFertility: 0, overview: '#8a8174' },
];

export const waterOf = (t: number): WaterKind => TERRAIN[t].water;
export const isFresh = (t: number) => TERRAIN[t].water === WATER.FRESH;
export const isLand = (t: number) => TERRAIN[t].water === WATER.NONE;

/** Mineral deposits. Wood comes from forest cover and food from fertility, so they are not deposits. */
export const DEPOSIT = { NONE: 0, COPPER: 1, IRON: 2, GOLD: 3 } as const;
export const DEPOSIT_RESOURCE = [null, 'copper', 'iron', 'gold'] as const;
