import { Camera } from './render/camera';
import { HEX_H, HEX_W, hexX, hexY, pixelToHex } from './render/hexgeom';
import { MapRenderer, type VehicleFrame } from './render/renderer';
import { buildAtlas } from './render/sprites/tiles';
import { WorldView } from './render/worldView';
import type { FromWorker, ToWorker } from './sim/protocol';
import { DEPOSIT_RESOURCE, T, TERRAIN, WATER_NAMES, isLand } from './sim/terrain';
import { buildGallery } from './ui/gallery';
import { TopBar, type Tool } from './ui/topbar';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1337);
const mapW = Number(params.get('w') ?? 192);
const mapH = Number(params.get('h') ?? 128);

const canvas = document.getElementById('map') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false })!;
const info = document.getElementById('info')!;
const toast = document.getElementById('toast')!;
const galleryEl = document.getElementById('gallery')!;
const status = document.getElementById('status')!;

const atlas = buildAtlas();
buildGallery(galleryEl.querySelector('.gallery-body') as HTMLElement, atlas);
galleryEl.querySelector('.close')!.addEventListener('click', () => galleryEl.classList.add('hidden'));

const cam = new Camera();
let view: WorldView | null = null;
let renderer: MapRenderer | null = null;
let vehicles: VehicleFrame | null = null;
let tool: Tool = 'inspect';
let lastStepMs = 0;

const topbar = new TopBar(document.getElementById('topbar')!, {
  onTool: (t) => { tool = t; canvas.style.cursor = t === 'canal' ? 'crosshair' : 'default'; },
  onFertility: (on) => renderer?.setFertilityOverlay(on),
  onGallery: () => galleryEl.classList.toggle('hidden'),
});

const worker = new Worker(new URL('./sim/worker.ts', import.meta.url), { type: 'module' });
const send = (m: ToWorker) => worker.postMessage(m);

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function showToast(text: string) {
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

worker.onmessage = (e: MessageEvent<FromWorker>) => {
  const m = e.data;
  switch (m.type) {
    case 'world': {
      view = new WorldView(m);
      renderer = new MapRenderer(view, atlas);
      if (topbar.fertility) renderer.setFertilityOverlay(true);
      // Start zoomed in on a river hex near the centre if there is one, so the art is visible.
      let target = Math.floor(view.h / 2) * view.w + Math.floor(view.w / 2);
      let best = Infinity;
      for (let i = 0; i < view.n; i++) {
        if (view.terrain[i] !== T.RIVER) continue;
        const dc = (i % view.w) - view.w / 2, dr = ((i / view.w) | 0) - view.h / 2;
        const d = dc * dc + dr * dr;
        if (d < best) { best = d; target = i; }
      }
      const c = target % view.w, r = (target / view.w) | 0;
      cam.zoom = 2;
      cam.centerOn(hexX(c, r) + HEX_W / 2, hexY(r) + HEX_H / 2, canvas.clientWidth, canvas.clientHeight);
      status.textContent = `seed ${m.seed} · ${m.w}×${m.h} hexes · generated in ${m.genMs.toFixed(0)} ms`;
      break;
    }
    case 'tick':
      vehicles = { data: m.vehicles, receivedAt: performance.now() };
      topbar.setStock(m.stock);
      lastStepMs = m.stepMs;
      break;
    case 'hexes':
      view?.apply(m);
      renderer?.markDirty(m.idx);
      updateInfo();
      break;
    case 'rejected':
      showToast(m.reason);
      break;
  }
};
send({ type: 'init', seed, w: mapW, h: mapH });

// ---- Input --------------------------------------------------------------------------
let mouse: [number, number] = [-1, -1];
let drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;

function hexUnderMouse(): number {
  if (!view) return -1;
  const [wx, wy] = cam.toWorld(mouse[0], mouse[1]);
  return pixelToHex(wx, wy, view.w, view.h);
}

function updateInfo() {
  if (!view || !renderer) return;
  const i = renderer.hover;
  if (i < 0) { info.textContent = 'Drag to pan · wheel to zoom · WASD/arrows'; return; }
  const t = view.terrain[i];
  const def = TERRAIN[t];
  const parts = [`(${i % view.w}, ${(i / view.w) | 0})`, def.name];
  if (def.water) parts.push(`${WATER_NAMES[def.water]} water`);
  if (t === T.CANAL) parts.push(`dug through ${TERRAIN[view.ground[i]].name.toLowerCase()}`);
  if (isLand(t)) parts.push(`fertility ${view.fertility[i].toFixed(2)}`);
  if (t === T.DESERT && view.fertility[i] > 0.3) parts.push('irrigated');
  if (view.forest[i]) parts.push(`forest ${'▮'.repeat(view.forest[i])}`);
  const dep = DEPOSIT_RESOURCE[view.deposit[i]];
  if (dep) parts.push(`${dep} deposit`);
  info.textContent = parts.join(' · ');
}

canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  mouse = [e.offsetX, e.offsetY];
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (drag.moved) { cam.x = drag.cx - dx / cam.zoom; cam.y = drag.cy - dy / cam.zoom; }
  }
  if (renderer) { renderer.hover = hexUnderMouse(); updateInfo(); }
});
canvas.addEventListener('pointerup', () => {
  if (drag && !drag.moved && tool === 'canal') {
    const i = hexUnderMouse();
    if (i >= 0) send({ type: 'cmd', cmd: { kind: 'digCanal', i } });
  }
  drag = null;
});
canvas.addEventListener('pointerleave', () => { if (renderer) { renderer.hover = -1; updateInfo(); } });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });

const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'f') topbar.toggleFertility();
  else if (k === 'c') topbar.setTool('canal');
  else if (k === 'escape') topbar.setTool('inspect');
  else if (k === 'g') galleryEl.classList.toggle('hidden');
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

// ---- Frame loop ---------------------------------------------------------------------
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}
window.addEventListener('resize', resize);
resize();

let lastT = performance.now();
let fpsAcc = 0, fpsFrames = 0, fps = 0;
function frame(now: number) {
  const dt = (now - lastT) / 1000;
  lastT = now;
  const pan = 600 * dt / cam.zoom;
  if (keys.has('a') || keys.has('arrowleft')) cam.x -= pan;
  if (keys.has('d') || keys.has('arrowright')) cam.x += pan;
  if (keys.has('w') || keys.has('arrowup')) cam.y -= pan;
  if (keys.has('s') || keys.has('arrowdown')) cam.y += pan;
  if (renderer) {
    const t0 = performance.now();
    renderer.draw(ctx, cam, window.devicePixelRatio || 1, vehicles, now);
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc > 0.5) { fps = fpsFrames / fpsAcc; fpsAcc = 0; fpsFrames = 0; }
    const lf = renderer.lastFrame;
    document.getElementById('perf')!.textContent =
      `${fps.toFixed(0)} fps · draw ${(performance.now() - t0).toFixed(1)} ms · ` +
      `${lf.overview ? 'overview' : `${lf.chunksDrawn} chunks`} · sim tick ${lastStepMs.toFixed(2)} ms · zoom ${cam.zoom.toFixed(2)}`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
