// Every resource amount and every vehicle's cargo capacity is measured in the same unit,
// the cargo unit (CU). One CU is "one standard load" of anything. This keeps stockpiles,
// wagons, boats and (later) trains interchangeable.

export const RESOURCES = ['wood', 'gold', 'copper', 'iron', 'food'] as const; // top-bar order
export type ResourceKey = (typeof RESOURCES)[number];
export type Stockpile = Record<ResourceKey, number>;

export const RESOURCE_INFO: Record<ResourceKey, { name: string; source: string }> = {
  wood: { name: 'Wood', source: 'forest cover' },
  gold: { name: 'Gold', source: 'gold deposits (mountains, foothills, rare in desert)' },
  copper: { name: 'Copper', source: 'copper deposits (foothills, mountains)' },
  iron: { name: 'Iron', source: 'iron deposits (mountains, foothills)' },
  food: { name: 'Food', source: 'fertile land (grassland, irrigated desert)' },
};

/** Placeholder starting stockpile until the economy milestone (M4) produces resources. */
export const START_STOCK: Stockpile = { wood: 150, gold: 20, copper: 40, iron: 25, food: 300 };
