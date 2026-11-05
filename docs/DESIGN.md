# GeoPoliticalGame: Design Sketch (v0)

A single-player military territory-expansion game. The **geography and living
civilizations of a world sim** (WorldBox-style) combined with the **border-pushing
expansion of an .io territory game** (OpenFront-style). The player is a **General**,
not a god and not a full head of state. Other races (Orc, Elf, ...) are AI.

This document has three parts:
1. What already exists in open source (and what we can legally reuse)
2. Spec sketch (gameplay)
3. Architecture (entities vs. aggregate stats, and how to mix them)

---

## 1. Prior art and open source

### The two parents

| | WorldBox | OpenFront.io |
|---|---|---|
| Source | **Closed source** (commercial, Unity). Only mods are on GitHub. | **Open source**: `github.com/openfrontio/OpenFrontIO` |
| Simulation | Agent-based: each creature is an actor with needs, AI, traits, and items | Aggregate: each player has a troop count, and territory is a pixel/tile ownership map |
| Strength | Emergent stories, races with traits, tech, gear, buildings | Clean, readable, fast territorial war at large scale |
| Weakness for us | Scale limited by per-unit sim, and there is little player agency in war | Low granularity: no geography economy, everyone is the same "nation" |

**OpenFront license details** (checked against its LICENSE / LICENSING.md / LICENSE-ASSETS):
- Code is **AGPL-3.0** (from 2025-09-04). It has Section 7 additional terms: you must keep "© OpenFront and Contributors" visible, and you must not use "OpenFront" as your title.
- Code from before 2025-03-25 is **MIT** and is still usable under MIT from those older commits.
- `/resources` assets are CC BY-SA 4.0. `/proprietary` and CDN-served assets are All Rights Reserved.
- This repo is **MIT**. Copying current OpenFront code would force this project to become AGPL. **Plan: study its architecture, don't copy its code.** (Alternatively, relicense to AGPL on purpose.)
- Its README describes a separate `packages/engine` ("Deterministic game simulation") and a "worker protocol". This is the same split recommended in §3.

### Other projects worth reading

| Project | License | What to learn from it |
|---|---|---|
| Azgaar Fantasy Map Generator (JS) | MIT (plus explicit permission for derived works) | Biomes, rivers, population that depends on biome, cultures, states. Its map uses Voronoi cells, not tiles. This is the best reference for the geography layer. |
| mapgen4, Red Blob Games (JS) | Apache-2.0 | Elevation, rainfall, and rivers on a dual mesh. Red Blob's articles on noise maps and hex/grid are standard references. |
| Unciv (Kotlin, Civ V-like) | MPL-2.0 | Data-driven JSON rulesets for units, buildings, techs, and nations, plus a strategic AI for asymmetric civs. |
| Freeciv | GPL-2.0+ | Tile yields, city growth from food surplus, tech tree. A mature AI design. |
| Widelands (Settlers-like) | GPL-2.0+ | Building and production chains with real carriers. This is the "high granularity" end of the economy. |
| OpenTTD | GPL-2.0 | Industry and transport chains, and long-running sim performance. |
| 0 A.D. | GPL-2.0+ code, CC BY-SA art | RTS with civ asymmetry, entity-component design, and a deterministic sim. |
| bitECS (TS) | MPL-2.0 | Fast struct-of-arrays ECS for JS. MPL is file-level copyleft, so it is fine to depend on from MIT code. |
| PixiJS / Phaser | MIT | WebGL 2D rendering. |

Closed games to steal *ideas* from (design ideas aren't copyrightable, but don't copy names, art, or levels): Territorial.io, Hearts of Iron IV (front lines, generals with traits, supply), Songs of Syx (thousands of citizens with aggregate economics), Dwarf Fortress (individual histories).

---

## 2. Spec sketch

### 2.1 Role: the General as paramount leader
You are a **General who holds near-absolute power**, a single-party paramount leader rather
than a battlefield commander only. You govern mainly through **economic policy**, and you
can also **intervene directly** anywhere.

**Policy levers** (continuous, apply nation-wide or per region):
- Labor allocation: shares going to agriculture, industry, construction, and the military.
- Taxation and grain requisition rates.
- The conscription rate.
- Investment priorities, such as roads, mines, or armories.
- Research focus.
- **Plans**: multi-year targets ("40 armories and 2,000 hexes of road in 5 years") that
  regional governors (AI) try to hit.

**Direct actions** (discrete, each costs **political capital** so that micromanaging
everything is not optimal):
- Order a specific building on a specific hex.
- Relocate population.
- Seize stockpiles.
- Appoint or dismiss governors and generals.
- Take personal command of an army.

**Feedback loop**: overreach has costs. Over-requisition causes famine, and unrest and
**stability** drop. An unrealistic plan leads governors to inflate their reports, so the
numbers you see can lag behind the true ones. Policy is a tool with tradeoffs, not a free
optimizer.

Time: real time with **pause and speed controls** (1×/2×/4×). A match lasts about 30–90 min.

### 2.2 Geography (the foundation)
Map generation goes: heightmap → temperature (latitude + altitude) → moisture → rivers → **biome**.

Tiles are **hexes** (axial coordinates, Red Blob Games hex guide). Each hex has:
- `elevation`, `biome`, `river`/`coast` flags
- **`fertility`** (0–1) from biome × moisture × river/coast bonus
- **resource deposit** (optional): iron, stone, gold, timber (forest), horses (grassland), fish (coast)
- `development` (0–1), which builds up with population and buildings

**Carrying capacity** for a region is `K = Σ fertility × tileArea × techMult × buildingMult × raceBiomeMult`.

**Population growth** is logistic: `dP/dt = r_race × P × (1 − P/K)` (+ migration later).

UI overlays: fertility heatmap, population density, **"+N pop/s" per region**, resources, supply.
Hovering a region shows the breakdown ("+3.2/s = base 4.0 × elf 0.4 × river 1.5 × farm 1.33 …").
Making every multiplier inspectable is a core design rule. It is what makes the geography
*matter* to the player instead of being hidden.

Terrain also affects war: movement cost, defense bonus (hills/forest/mountain/river crossing),
attrition (desert/snow), and naval access (ports).

### 2.3 Races (asymmetric, data-driven)

| Stat (×Human) | Human | Elf | Orc | (later) Dwarf |
|---|---|---|---|---|
| Growth rate `r` | 1.0 | **0.4** | **1.4** | 0.7 |
| Research | 1.0 | **1.7** | 0.6 | 1.0 |
| Base strength | 1.0 | 0.9 | **1.4** | 1.1 |
| Lifespan / XP retention | normal | very long (veterans persist) | short | long |
| Preferred biomes | temperate, plains | forest | steppe, desert, badlands | mountains |
| Signature | flexible, best ports and trade | longbows, forest stealth, fast tech | cheap mass troops, raiding, morale | forts, mining, heavy gear |

The numbers are placeholders. The point is that each race wins differently: Orcs win early
through mass, Elves win late through tech and quality, Humans win through logistics.

### 2.4 Economy and buildings (medium granularity)
This sits between OpenFront's few unit types and Widelands' carriers. Buildings occupy
**tiles inside regions**. Resources are **stockpiled per region and pooled nationally**,
and moving them costs time along roads/rivers/sea. There are no individual carriers.

| Building | Needs | Effect |
|---|---|---|
| Village → Town → City | population thresholds | pop cap, research, tax |
| Farm / Fishery | fertile land / coast | ↑ K (carrying capacity) |
| Lumber camp, Mine, Quarry | matching deposit | resource output |
| Smithy → Armory | iron (+ timber) | gear production (tiered) |
| Barracks | city | troop training rate, unit types |
| Library / Academy | town+ | research |
| Port | coast | naval transport, trade |
| Fort / Wall | stone | zone of control, defense, slows enemy expansion |
| Road | — | supply and move speed |

### 2.4b Transport network (roads → railroads)
Goods and troops move over a **network graph** that is laid on top of the hex map.
- **Roads** are built hex by hex. Consecutive road hexes collapse into graph **edges**
  between **nodes** (settlements, junctions, depots). Hexes without a road still allow
  slow, overland movement.
- **Wagons are real entities.** Each wagon has a capacity, a speed, and upkeep (horses,
  fodder). Wagons travel along edges, so their position is `(edge, progress)` and they do
  not pathfind on the hex grid. This makes them cheap to simulate.
- Because wagons are real, logistics become physical. Army supply rides on wagons, so it
  can be **raided**. Roads have **throughput limits** and can become congested. A
  destroyed bridge cuts the line.
- A dispatcher turns region demand (deficits) and supply (surpluses) into shipments, and
  assigns idle vehicles to them.

**Class scaffold.** The same code serves railroads in a later age:

```ts
abstract class Network      { nodes; edges; route(a, b): Path; }       // graph + cached shortest paths
class RoadNetwork  extends Network { /* build per hex, cheap, slow */ }
class RailNetwork  extends Network { /* needs iron+coal, fast, high capacity */ }

abstract class VehicleType  { capacity; speed; upkeep; network: typeof Network; }
class WagonType   extends VehicleType {}   // horses + fodder
class TrainType   extends VehicleType {}   // coal; many cars
class Vehicle     { type: VehicleType; edge; progress; cargo; orders; } // instance
```

Classes fit here well. Vehicles number in the **thousands to tens of thousands**, and the
benchmark in §3.6 shows class instances are as fast as raw arrays at that scale.

### 2.5 Technology and gear
- Research points come from `population × literacy(buildings) × raceResearchMult`.
- A small tech tree arranged in **ages**: Bronze → Iron → Steel → **Early gunpowder** (pike and
  shot, muskets, railroads in a later expansion). The setting is fantasy races on a
  historical tech arc, so it is not pure fantasy. Each age unlocks
  buildings, a gear tier, and unit types.
- **Gear is a physical good**: armories turn iron/timber into weapon/armor stock, and armies
  equip from that stock. Researching Steel does nothing without iron and an armory. This
  ties geography to military power.

### 2.6 Military: the General system
- **Troops** are drawn from population (a manpower pool, roughly a fraction of P). Losing
  troops costs population, so war hurts growth.
- **Armies** are stacks made of **cohorts** (a group of identical soldiers: race, type, gear tier, XP).
- **Generals/Heroes** are individual characters with traits (e.g. *Siegemaster*, *Ranger*,
  *Brutal*, *Logistician*, *Coward*). The player is the top General. Heroes are attached to armies.
- **Orders**: move, attack, hold, siege, raid, and **draw a front line**. When you assign armies
  to a front, they push automatically and the border expands OpenFront-style along that front.
- **Supply**: armies far from friendly supply (roads/rivers/ports) take attrition.
- **Expansion into unowned land** works like OpenFront: you spend troops to claim tiles, and
  harder terrain costs more. **Expansion into owned land** happens through armies and battles.
- **Combat** is resolved per cohort in rounds. The modifiers are: race strength × gear tier ×
  XP × morale × terrain × general traits × supply. Surviving cohorts gain XP. Rarely, an
  exceptional soldier is **promoted into a named hero** (see §3.3).

### 2.7 AI factions
Each AI faction uses a utility AI at three cadences:
- **Strategic** (~every 10 s): pick a target and a posture.
- **Operational** (~2 s): assign armies to fronts, choose builds.
- **Tactical** (every tick): army movement.

Race weights shape behavior: Orcs are aggressive and raid early, Elves defend forests and
tech up, Humans expand along coasts and rivers.

### 2.8 Out of scope for now
Multiplayer, diplomacy beyond war/peace, religion/culture, dynasties, and god powers. The
architecture keeps multiplayer possible (deterministic sim, see §3.1).

---

## 3. Architecture

### 3.1 Top-level split

```
┌─────────────── Main thread ────────────────┐       ┌────────── Web Worker ──────────┐
│  Renderer (PixiJS/WebGL)                   │ snap- │  SIMULATION (pure TS, no DOM)  │
│   - tile ownership/biome textures (dirty   │ shots │   fixed tick (10 Hz)           │
│     rects only)                            │◀──────│   seeded RNG → deterministic   │
│   - army/hero sprites (interpolated)       │       │   typed-array tile fields      │
│   - cosmetic soldier crowds (§3.3)         │       │   ECS for entities             │
│  UI (overlays, tooltips, orders)           │──────▶│   systems run in fixed order   │
│  Input → Commands                          │ cmds  │   AI players issue same cmds   │
└────────────────────────────────────────────┘       └────────────────────────────────┘
```

- **Deterministic sim**: same seed + same command log = same game. This gives replays,
  save files as `seed + commands`, easy bug reproduction, and later lockstep multiplayer.
  To keep it deterministic: avoid `Math.random`, and avoid iterating over unordered maps
  where order affects results. Floats are deterministic on a single JS engine. For
  cross-browser multiplayer, plan to use fixed-point for state that feeds combat.
- **The AI uses the same command API as the player.** This means AI cannot cheat by
  accident, and the same code paths get tested.
- **Content is data**: races, biomes, buildings, techs, and traits are TS/JSON definitions,
  in the style of Unciv rulesets.

### 3.2 "Individual entities" vs "icons over stats": the core question

There are two extremes:
- **Pure agents (WorldBox)**: every person is simulated with pathfinding, needs, and combat.
  This gives rich emergence, but cost scales with population, so worlds are capped at
  thousands of units. Aggregate behavior (growth, front lines) is also hard to *balance*
  and hard to *explain* to the player.
- **Pure aggregates (OpenFront)**: numbers on tiles and players. This is cheap, scales to
  huge maps, and is easy to explain, but nothing has identity and there are no stories.

**Recommendation: a level-of-detail (LOD) sim, where the model is aggregate-first and
entities are used where they matter.** Every quantity lives at the cheapest level that
still produces the gameplay we want:

| Tier | What | Representation | Cost |
|---|---|---|---|
| **T0 Field** | terrain, fertility, ownership, population density, development | typed arrays per tile (`Uint16Array owner`, `Float32Array fertility` …) | O(tiles), cache-friendly, mostly sparse/dirty updates |
| **T1 Region** | population P, K, stockpiles, buildings, pop/s | structs per region (Voronoi clusters of ~100–300 tiles) | O(regions), a few thousand at most |
| **T2 Aggregate entities** | armies, cohorts, settlements, building instances, convoys | ECS entities. A cohort = `{count, race, type, gearTier, xp, morale}` | O(armies × cohorts) |
| **T3 Individuals** | the player General, heroes, generals, named veterans, rulers | full ECS entities with traits, inventory, history log | O(dozens–hundreds) |
| **T∞ Cosmetic** | the crowd of little soldiers you *see* fighting | spawned by the renderer from T2 data, never simulated | O(on-screen) |

Why this works:
- **Regions** are the economic and AI unit. They make "pop/s" and breakdown tooltips
  natural, and they give the AI a small graph to reason about instead of a million tiles.
- **Tiles** stay the *ownership* unit, so borders are smooth, organic, and OpenFront-like.
- **Cohorts** keep traits, gear, and XP meaningful without simulating 50,000 soldiers.
  A battle is 2–20 cohorts per side resolving in rounds.
- **Individuals** get the WorldBox-style detail (traits, gear, kill counts, biographies)
  only where the player cares.

### 3.3 Promotion and demotion between tiers
This is the trick that keeps WorldBox flavor at OpenFront scale:
- **Promotion**: after a battle, a cohort that did exceptionally well rolls to spawn a T3
  hero ("Grukk Skullsplitter, survivor of the Siege of Ashford"). The hero inherits the
  cohort's race, gear, and XP, plus a trait drawn from the battle's context (forest
  battle → *Ranger*).
- **Demotion**: unremarkable individuals get folded back into cohort averages. For
  example, a hero who sits idle for a long time retires and becomes a stat bonus on a region.
- **Zoom-in**: when the camera zooms close to a battle, the renderer spawns cosmetic
  soldiers whose number, race, and gear sprites come from the cohort data, and they
  animate the losses the sim reports. It *looks* agent-based but costs nothing in the sim.

### 3.4 Tick pipeline (fixed order, deterministic)

```
1. applyCommands        (player + AI queued commands)
2. ai.strategic/operational (on cadence)
3. growth               (regions: logistic P, manpower pool)
4. economy              (production, stockpiles, transport queues)
5. construction         (build progress)
6. research             (points → techs)
7. equip/train          (gear stock → cohorts, troops from manpower)
8. movement             (armies on region/tile graph, A* cached)
9. expansion            (border tiles claimed by fronts and troop spending)
10. combat              (cohort rounds where armies meet)
11. supply/attrition
12. promotion/demotion  (T2 ⇄ T3)
13. emit snapshot diff  (dirty tiles, entity deltas) → main thread
```

### 3.5 Tech stack (proposal)
- **TypeScript + Vite**, running in the browser. OpenFront shows this stack is enough for
  large territory maps, and a browser game is easy to share.
- **Sim in a Web Worker** using typed arrays. Use bitECS or a small hand-rolled ECS
  (entity counts are modest because of the LOD design).
- **PixiJS / raw WebGL2** for rendering. Hex state lives in a **data texture** (1 texel = 1 hex)
  that we update by dirty rows. A fragment shader converts each pixel → axial hex (hex
  rounding) → samples the texture, and draws owner colour, borders, and overlays. This
  costs the same at any map size, with no per-hex geometry.
- **Plain DOM / Preact** for UI panels.
- **Vitest** for sim tests, plus determinism tests (run twice, hash state, compare).
- The alternative, **Godot**, gives better tooling for sprites and animation but makes web
  sharing and determinism a bit harder. The TS route is recommended for a vibe-coded
  iteration loop.

### 3.6 Performance: where JS hits limits, and whether to use WebAssembly
These are measured numbers from `bench/microbench.js`: Node 22 (V8, the same engine as Chrome) on this 4-core cloud
container. They come from trivial microbenchmarks, so treat them as order-of-magnitude
guides only. Real per-entity logic costs more.

| Workload | Time |
|---|---|
| Logistic growth over **1M hexes** (Float32Array) | 2.7 ms |
| 100k movers, struct-of-arrays | 0.34 ms |
| 100k movers, class instances | 0.57 ms |
| 1M movers, struct-of-arrays | 3.4 ms |
| 1M movers, class instances | 10.3 ms |
| **One A\*** on a 1024×512 hex map, ~300-hex path, 20% obstacles (~9k nodes expanded) | **6.3 ms** |
| Full-map BFS flow field (512k hexes) | 29 ms |

**Budget**: the tick is 10 Hz, and at 4× speed that leaves about 25 ms per tick. The sim
runs in a worker, so a slow tick slows the game down but never freezes rendering.

**What this means:**
1. **The number of entities is not the limit. The work each entity does is.** Iterating
   100k–1M simple entities is cheap in JS. Classes vs typed arrays only matters at
   ~10⁵–10⁶ entities, where classes are about 3× slower.
2. **Pathfinding and decision-making are the real limit.** At about 6 ms per long A*, you
   can afford roughly a handful per tick, not thousands. This is why fully agent-based
   games bog down. The fixes are algorithmic and give 100–1000× gains:
   - wagons route on the **small road graph**, not the hex grid
   - armies use **hierarchical pathing** (region graph first, then hexes)
   - shared **flow fields** for many units with the same goal
   - **cached** routes
3. **Allocation.** Creating objects every tick in hot loops causes garbage-collection
   pauses. V8 removed the allocations in this microbenchmark, but real code is less
   forgiving. Pre-allocate and pool objects in the sim.

**JS vs WebAssembly (Rust/C++/AssemblyScript):**
- **Speed.** Expect **~1–2×** on hot numeric loops versus well-written typed-array JS, not
  10×. A peer-reviewed study (Jangda et al., USENIX ATC 2019) found Wasm itself runs about
  45–55% slower than native code. Wasm's clearer wins are:
  - **predictable** performance: no JIT deoptimizations and no GC pauses
  - **SIMD**
  - no GC for large data
- **Determinism.** Basic JS arithmetic (+ − × ÷) is IEEE-754 and deterministic. JS's
  `Math.sin/exp/pow` are *implementation-approximated* by the spec and can differ between
  browsers, so the sim should avoid them in state that matters or use its own versions.
  Wasm with a bundled math library sidesteps this. It only matters for cross-browser
  multiplayer.
- **Costs.** A second toolchain, overhead at the JS↔Wasm boundary (copying is avoidable
  with shared memory), harder debugging, and slower vibe-coding iteration.
- **Threads.** More than one sim thread needs `SharedArrayBuffer`. That requires
  cross-origin isolation headers (COOP/COEP). GitHub Pages cannot set these headers, so
  a service-worker shim or a different host would be needed.

**Decision**: write everything in **TypeScript** first.
- Use **struct-of-arrays** for hex fields and any population of 10⁵ or more.
- Use **classes** for definitions and for rich objects with low counts: networks,
  settlements, armies, vehicles, heroes.
- Keep hot kernels (pathfinding, flow fields, growth, combat rounds) as **pure functions
  over typed arrays** behind a small interface. Then any of them can be ported to
  Rust→Wasm *if profiling shows it*, without touching the rest.

**Map size** follows from this. The sim can afford ~10⁶ hexes for per-tick field passes,
and slower-changing fields can update less often. Pathfinding, AI cadence, and the
player's ability to read the map are the practical limits. Start at **512×256 (~131k
hexes)**, profile, then scale up.

### 3.7 Milestones
1. **M0 World**: map gen (height/temp/moisture/biome/rivers), regions, render + overlays.
2. **M1 Life**: one faction, settlements, logistic growth, the pop/s UI with breakdown tooltip.
3. **M2 Expansion**: OpenFront-style claiming of neutral land with troops, multiple
   factions, simple aggregate combat.
4. **M3 Races + AI**: Human/Elf/Orc definitions, utility AI.
5. **M4 Economy**: resources, buildings, roads + wagon entities, dispatcher, policy levers.
6. **M5 Tech + Gear**: research, ages, armories, gear tiers on cohorts.
7. **M6 The General**: armies, cohorts, front lines, supply, orders UI.
8. **M7 Heroes**: traits, promotion/demotion, battle zoom with cosmetic crowds, chronicle log.

### 3.8 Decisions log
| Decision | Choice |
|---|---|
| Tiles | **Hex** (axial coordinates) |
| Setting | Fantasy races on a historical tech arc. **Muskets/gunpowder** come in a later age. |
| Player powers | **Paramount leader**: governs mainly by economic policy. Direct actions cost political capital. |
| Overland transport | **Roads + wagon entities**, using a network/vehicle class scaffold that railroads reuse later |
| Platform | **Browser only.** TypeScript first, with kernels ready for a Wasm port. |
| Map size | TBD by profiling. Start at 512×256. |

Still open: how political capital is earned, how stability works, and the scope of naval transport.
