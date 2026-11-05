import { BARGE, ICONS, SHIP, TREES, UNIT_SPRITES, type SpriteDef } from '../render/sprites/defs';
import { makeSprite } from '../render/sprites/pixel';
import type { Atlas } from '../render/sprites/tiles';
import { T, TERRAIN } from '../sim/terrain';

/** Overlay listing every sprite at a readable scale, for reviewing the art. */
export function buildGallery(root: HTMLElement, atlas: Atlas) {
  root.innerHTML = '';
  const section = (title: string) => {
    const h = document.createElement('h3');
    h.textContent = title;
    const grid = document.createElement('div');
    grid.className = 'gallery-grid';
    root.append(h, grid);
    return grid;
  };
  const cell = (grid: HTMLElement, canvas: HTMLCanvasElement, label: string) => {
    const c = document.createElement('figure');
    canvas.className = 'pixel';
    const cap = document.createElement('figcaption');
    cap.textContent = label;
    c.append(canvas, cap);
    grid.append(c);
  };
  const sprite = (grid: HTMLElement, d: SpriteDef, scale: number) => cell(grid, makeSprite(d, scale), d.label);
  const scaled = (src: HTMLCanvasElement, scale: number) => {
    const c = document.createElement('canvas');
    c.width = src.width * scale; c.height = src.height * scale;
    const x = c.getContext('2d')!;
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  };

  const people = section('Peoples');
  for (const d of UNIT_SPRITES) sprite(people, d, 5);

  const tiles = section('Tiles (hex, 28×32 px)');
  for (const id of Object.values(T)) {
    if (id === T.CANAL) continue;
    cell(tiles, scaled(atlas.terrain[id][0], 3), TERRAIN[id].name + (id === T.LAKE || id === T.RIVER ? ' (fresh)' : id === T.OCEAN ? ' (salt)' : ''));
  }
  cell(tiles, scaled(atlas.irrigatedDesert[0], 3), 'Irrigated desert');
  // A canal shown as one rotated half-segment per connection. Here it links E, NW and SW.
  const canal = document.createElement('canvas');
  canal.width = 28; canal.height = 32;
  const cx = canal.getContext('2d')!;
  cx.drawImage(atlas.terrain[T.DESERT][0], 0, 0);
  for (const d of [0, 2, 4]) cx.drawImage(atlas.canalSeg[d], 0, 0);
  cx.drawImage(atlas.canalHub, 0, 0);
  cell(tiles, scaled(canal, 3), 'Canal (E, NW, SW)');
  const forest = document.createElement('canvas');
  forest.width = 28; forest.height = 32;
  const fx = forest.getContext('2d')!;
  fx.drawImage(atlas.terrain[T.GRASSLAND][1], 0, 0);
  [[4, 9], [15, 6], [9, 15], [17, 15], [12, 21]].forEach(([x, y], k) => fx.drawImage(atlas.trees[k % 2], x, y));
  cell(tiles, scaled(forest, 3), 'Grassland + forest overlay');

  const vehicles = section('Vehicles');
  sprite(vehicles, SHIP, 4);
  sprite(vehicles, BARGE, 4);
  const misc = section('Trees and resources');
  for (const d of TREES) sprite(misc, d, 5);
  for (const d of Object.values(ICONS)) sprite(misc, d, 4);
}
