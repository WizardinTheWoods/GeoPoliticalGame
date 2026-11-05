# GeoPoliticalGame

A single-player, browser-based military territory-expansion game: the living geography of a
world sim combined with the border-pushing of an .io territory game. You play a General with
paramount-leader powers. See [`docs/DESIGN.md`](docs/DESIGN.md) for the full design.

## Status: M0, first slice
- Hex map generation: ocean (salt), lakes and rivers (fresh), grassland and forest, desert,
  foothills, mountains, and copper/iron/gold deposits.
- **Canals**: dig them next to fresh water to irrigate dry land.
- Fertility overlay, a resource bar (wood, gold, copper, iron, food), hover inspection.
- Sprite sheet: three human man/woman pairs (white, black and Asian palettes), plus elf,
  dwarf, orc, tiles, boats and resource icons.
- Boats (sea cogs and river barges) that pathfind in the sim worker.
- Canvas 2D renderer that works **without a GPU**.

## Run
```bash
npm install
```
```bash
npm run dev
```
Then open the printed URL. Optional query parameters: `?seed=42&w=256&h=160`.

Controls: drag or WASD to pan, wheel to zoom, **C** dig canal, **F** fertility overlay,
**G** sprite sheet, **Esc** inspect.

## Test
```bash
npm test
```
```bash
npm run typecheck
```
