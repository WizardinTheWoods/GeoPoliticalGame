import { RESOURCES, RESOURCE_INFO, type Stockpile } from '../sim/resources';
import { makeSprite } from '../render/sprites/pixel';
import { ICONS } from '../render/sprites/defs';

export type Tool = 'inspect' | 'canal';

export interface TopBarHandlers {
  onTool(t: Tool): void;
  onFertility(on: boolean): void;
  onGallery(): void;
}

/** Resource bar (wood, gold, copper, iron, food) plus tool buttons. */
export class TopBar {
  private values = new Map<string, HTMLElement>();
  private toolButtons = new Map<Tool, HTMLButtonElement>();
  private fertBtn: HTMLButtonElement;
  fertility = false;

  constructor(root: HTMLElement, private h: TopBarHandlers) {
    root.innerHTML = '';
    const res = document.createElement('div');
    res.className = 'resources';
    for (const k of RESOURCES) {
      const item = document.createElement('div');
      item.className = 'res';
      item.title = `${RESOURCE_INFO[k].name}: from ${RESOURCE_INFO[k].source}. Measured in CU (cargo units).`;
      const icon = makeSprite(ICONS[k], 2);
      icon.className = 'icon';
      const label = document.createElement('span');
      label.className = 'res-name';
      label.textContent = RESOURCE_INFO[k].name;
      const val = document.createElement('span');
      val.className = 'res-val';
      val.textContent = '–';
      item.append(icon, label, val);
      res.append(item);
      this.values.set(k, val);
    }
    const tools = document.createElement('div');
    tools.className = 'tools';
    const mk = (text: string, title: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.title = title;
      b.onclick = onClick;
      tools.append(b);
      return b;
    };
    this.toolButtons.set('inspect', mk('Inspect [Esc]', 'Hover or click hexes to inspect them', () => this.setTool('inspect')));
    this.toolButtons.set('canal', mk('Dig canal [C]', 'Click a land hex next to fresh water (5 wood, 15 food)', () => this.setTool('canal')));
    this.fertBtn = mk('Fertility [F]', 'Toggle the fertility overlay', () => this.toggleFertility());
    mk('Sprites [G]', 'Show the sprite sheet', () => h.onGallery());
    root.append(res, tools);
    this.setTool('inspect');
  }

  setTool(t: Tool) {
    for (const [k, b] of this.toolButtons) b.classList.toggle('active', k === t);
    this.h.onTool(t);
  }

  toggleFertility() {
    this.fertility = !this.fertility;
    this.fertBtn.classList.toggle('active', this.fertility);
    this.h.onFertility(this.fertility);
  }

  setStock(s: Stockpile) {
    for (const k of RESOURCES) this.values.get(k)!.textContent = Math.floor(s[k]).toLocaleString();
  }
}
