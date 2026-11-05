import { Simulation, TICK_SECONDS } from './sim';
import type { FromWorker, ToWorker } from './protocol';

// The sim runs here, off the main thread: a slow tick slows the game clock but never the frame rate.
const ctx = self as unknown as Worker;
const post = (msg: FromWorker, transfer: Transferable[] = []) => ctx.postMessage(msg, transfer);

let sim: Simulation | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

ctx.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    if (timer) clearInterval(timer);
    const t0 = performance.now();
    sim = new Simulation(msg.seed, msg.w, msg.h);
    const genMs = performance.now() - t0;
    const w = sim.world;
    const out = {
      terrain: w.terrain.slice(), ground: w.ground.slice(), fertility: w.fertility.slice(),
      forest: w.forest.slice(), deposit: w.deposit.slice(),
    };
    post({ type: 'world', seed: msg.seed, w: w.w, h: w.h, genMs, ...out },
      [out.terrain.buffer, out.ground.buffer, out.fertility.buffer, out.forest.buffer, out.deposit.buffer]);
    timer = setInterval(() => {
      if (!sim) return;
      const s0 = performance.now();
      sim.step();
      const vehicles = sim.vehicleSnapshot();
      post({ type: 'tick', tick: sim.tick, stock: { ...sim.stock }, vehicles, stepMs: performance.now() - s0 }, [vehicles.buffer]);
    }, TICK_SECONDS * 1000);
  } else if (msg.type === 'cmd' && sim) {
    const res = sim.apply(msg.cmd);
    if (!res.ok) { post({ type: 'rejected', reason: res.reason }); return; }
    const w = sim.world;
    const idx = Int32Array.from(res.dirty);
    const pick = <A extends Uint8Array | Float32Array>(src: A, make: (n: number) => A) => {
      const a = make(idx.length);
      idx.forEach((i, k) => { a[k] = src[i]; });
      return a;
    };
    const u8 = (n: number) => new Uint8Array(n);
    post({
      type: 'hexes', idx,
      terrain: pick(w.terrain, u8), ground: pick(w.ground, u8), forest: pick(w.forest, u8), deposit: pick(w.deposit, u8),
      fertility: pick(w.fertility, (n) => new Float32Array(n)),
    });
  }
};
