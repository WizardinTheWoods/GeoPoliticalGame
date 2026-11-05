import { describe, expect, it } from 'vitest';
import { ALL_SPRITES, UNIT_SPRITES } from '../src/render/sprites/defs';

describe('sprite definitions', () => {
  it.each(ALL_SPRITES.map((s) => [s.key, s] as const))('%s is rectangular and fully paletted', (_k, s) => {
    const w = s.rows[0].length;
    for (const row of s.rows) {
      expect(row.length).toBe(w);
      for (const ch of row) if (ch !== '.') expect(s.palette[ch]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it('has 3 human man/woman pairs plus elf, dwarf and orc', () => {
    expect(UNIT_SPRITES.filter((s) => s.key.startsWith('human-man')).length).toBe(3);
    expect(UNIT_SPRITES.filter((s) => s.key.startsWith('human-woman')).length).toBe(3);
    for (const k of ['elf', 'dwarf', 'orc']) expect(UNIT_SPRITES.some((s) => s.key === k)).toBe(true);
  });
});
