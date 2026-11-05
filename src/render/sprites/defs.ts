// Pixel-art sprites as text: each character is one pixel, looked up in a palette ('.' = transparent).
// Kept as data (no DOM) so they can be unit-tested, palette-swapped and edited by hand.

export interface SpriteDef {
  key: string;
  label: string;
  rows: readonly string[];
  palette: Readonly<Record<string, string>>;
}

const OUTLINE = '#1d1b22';

// ---- People (12x16) -------------------------------------------------------------
const HUMAN_MAN = [
  '....kkkk....',
  '...khhhhk...',
  '..khhhhhhk..',
  '..khsssshk..',
  '..ksesseSk..',
  '..kssssssk..',
  '...kSssSk...',
  '..kkcccckk..',
  '.kcCccccCck.',
  '.kcCccccCck.',
  '.kcCccccCck.',
  '.kskppppksk.',
  '...kppppk...',
  '...kpkkpk...',
  '...kpkkpk...',
  '..kbbkkbbk..',
];

const HUMAN_WOMAN = [
  '....kkkk....',
  '...khhhhk...',
  '..khhhhhhk..',
  '.khhsssshhk.',
  '.khsesseShk.',
  '.khsssssshk.',
  '.khhSssShhk.',
  '.khkcccckhk.',
  '.kcCccccCck.',
  '.kcCccccCck.',
  '.kskccccksk.',
  '..kcccccck..',
  '..kcCccCck..',
  '.kccCccCcck.',
  '.kkkkkkkkkk.',
  '..kbk..kbk..',
];

/** Shared colours for humans; each palette below swaps skin, hair and clothing. */
const HUMAN_BASE = { k: OUTLINE, e: OUTLINE, p: '#4d4034', b: '#2c231b' };

interface HumanPalette {
  key: string;
  label: string;
  skin: string;
  skinShade: string;
  manHair: string;
  womanHair: string;
  shirt: [string, string];
  dress: [string, string];
}

/** The three human colour palettes requested: white, black and Asian. */
export const HUMAN_PALETTES: readonly HumanPalette[] = [
  { key: 'white', label: 'white', skin: '#f1c8a6', skinShade: '#d6a181', manHair: '#7a4a24', womanHair: '#d9b35c', shirt: ['#3f6aa3', '#2e4f7c'], dress: ['#9c3f55', '#742d3f'] },
  { key: 'black', label: 'black', skin: '#8a5432', skinShade: '#6a3d22', manHair: '#1c1410', womanHair: '#1c1410', shirt: ['#c27a2c', '#925a1e'], dress: ['#2f8a7a', '#1f6458'] },
  { key: 'asian', label: 'Asian', skin: '#ecc596', skinShade: '#cfa070', manHair: '#16121a', womanHair: '#16121a', shirt: ['#7a3a8a', '#582a64'], dress: ['#c64a3a', '#93352a'] },
];

const humans: SpriteDef[] = HUMAN_PALETTES.flatMap((p) => [
  {
    key: `human-man-${p.key}`, label: `Human man (${p.label})`, rows: HUMAN_MAN,
    palette: { ...HUMAN_BASE, s: p.skin, S: p.skinShade, h: p.manHair, c: p.shirt[0], C: p.shirt[1] },
  },
  {
    key: `human-woman-${p.key}`, label: `Human woman (${p.label})`, rows: HUMAN_WOMAN,
    palette: { ...HUMAN_BASE, s: p.skin, S: p.skinShade, h: p.womanHair, c: p.dress[0], C: p.dress[1] },
  },
]);

const ELF: SpriteDef = {
  key: 'elf', label: 'Elf',
  rows: [
    '....kkkk....',
    '...khhhhk...',
    '..khhhhhhk..',
    '.kkhsssshkk.',
    'ksksesseSksk',
    '..kssssssk..',
    '..khSssShk..',
    '..khcccchk..',
    '..kcCccCck..',
    '..kcCccCck..',
    '..ksCyyCsk..',
    '...kcCCck...',
    '...kppppk...',
    '...kpkkpk...',
    '...kpkkpk...',
    '...kbkkbk...',
  ],
  palette: { k: OUTLINE, e: '#2a5a3a', s: '#f5ddc2', S: '#dcbc9c', h: '#ece4b0', c: '#3f8a4a', C: '#2d6636', y: '#d6b84a', p: '#6b5a3a', b: '#4a3a26' },
};

const DWARF: SpriteDef = {
  key: 'dwarf', label: 'Dwarf',
  rows: [
    '............',
    '............',
    '............',
    '...kkkkkk...',
    '..kmmmmmmk..',
    '.kmmMmmMmmk.',
    '.kksesseskk.',
    '.krrssssrrk.',
    'krrrrrrrrrrk',
    'kcrrrrrrrrck',
    'kcCrrrrrrCck',
    'kscCrrrrCcsk',
    '.kcyyyyyyck.',
    '..kppkkppk..',
    '..kppkkppk..',
    '.kbbbkkbbbk.',
  ],
  palette: { k: OUTLINE, e: OUTLINE, m: '#9aa3ad', M: '#6c7480', s: '#e8b48f', r: '#b5562a', c: '#7a3b2e', C: '#5a2a20', y: '#c9a23a', p: '#4b3b2a', b: '#2e241a' },
};

const ORC: SpriteDef = {
  key: 'orc', label: 'Orc',
  rows: [
    '.....kk.....',
    '....khhk....',
    '...kkhhkk...',
    '..kggggggk..',
    '.kgGeggeGgk.',
    '.kggggggggk.',
    '.kgwggggwgk.',
    '..kGggggGk..',
    'kgllllllllgk',
    'kgLllllllLgk',
    'kgLllllllLgk',
    'kGkllllllkGk',
    '.kkppppppkk.',
    '..kppkkppk..',
    '..kppkkppk..',
    '.kbbbkkbbbk.',
  ],
  palette: { k: OUTLINE, h: '#1d1d1d', g: '#6f9a3e', G: '#4f7428', e: '#e0d040', w: '#f2eee0', l: '#6b4a2e', L: '#4d331f', p: '#3d3a35', b: '#241d18' },
};

export const UNIT_SPRITES: readonly SpriteDef[] = [...humans, ELF, DWARF, ORC];

// ---- Vehicles -------------------------------------------------------------------
export const SHIP: SpriteDef = {
  key: 'ship', label: 'Cog (sea, salt water)',
  rows: [
    '.......k........',
    '.......kk.......',
    '.......kwk......',
    '.......kwwk.....',
    '.......kwwwk....',
    '.......kwwwwk...',
    '.......kkkkkkk..',
    '.......k........',
    'kkkkkkkkkkkkkkkk',
    '.kHHHHHHHHHHHHk.',
    '..kHhhhhhhhhHk..',
    '...kkkkkkkkkk...',
  ],
  palette: { k: OUTLINE, w: '#f1ead8', H: '#7a4f2c', h: '#9a6a3c' },
};

export const BARGE: SpriteDef = {
  key: 'riverBoat', label: 'River barge (fresh water)',
  rows: [
    '....kkkkk.....',
    '....kyyyk.....',
    'kkkkkkkkkkkkkk',
    '.kHHHHHHHHHHk.',
    '..kkkkkkkkkk..',
  ],
  palette: { k: OUTLINE, y: '#c9a23a', H: '#8a5a30' },
};

// ---- Trees (forest overlay) -----------------------------------------------------
export const TREES: readonly SpriteDef[] = [
  {
    key: 'conifer', label: 'Conifer',
    rows: ['...k...', '..kgk..', '..kgk..', '.kgggk.', '.kgGgk.', 'kgggGgk', 'kgGgggk', '.kkTkk.', '...T...', '...T...'],
    palette: { k: '#1c3320', g: '#2f6b3a', G: '#245530', T: '#5a3d22' },
  },
  {
    key: 'broadleaf', label: 'Broadleaf',
    rows: ['..kkk..', '.kgggk.', 'kggGggk', 'kgGgggk', '.kgggk.', '..kTk..', '...T...', '...T...'],
    palette: { k: '#1f3a1c', g: '#4a8a3a', G: '#3a6f2e', T: '#5a3d22' },
  },
];

// ---- Resource icons (top bar + deposit markers) ---------------------------------
const INGOT = ['...kkkk...', '..kLLLLk..', '.kLLLLLLk.', 'kMMMMMMMMk', 'kMMMMMMMDk', 'kDDDDDDDDk', '.kkkkkkkk.'];

export const ICONS: Readonly<Record<'wood' | 'gold' | 'copper' | 'iron' | 'food', SpriteDef>> = {
  wood: {
    key: 'wood', label: 'Wood',
    rows: ['.kkkkkkkk.', 'kTTtTTTkRk', 'kTTTTtTkrk', 'kTtTTTTkRk', '.kkkkkkkk.'],
    palette: { k: OUTLINE, T: '#8a5a30', t: '#6e4523', R: '#d9b07a', r: '#b98c55' },
  },
  gold: {
    key: 'gold', label: 'Gold',
    rows: ['...kkkk...', '..kyyyyk..', '.kyYyyyyk.', 'kyYyyyyyyk', 'kyYyyyyyOk', 'kyyyyyyyOk', 'kyyyyyyOOk', '.kyyyyyOk.', '..kyyOOk..', '...kkkk...'],
    palette: { k: OUTLINE, y: '#f4d03f', Y: '#fff1a0', O: '#c9a227' },
  },
  copper: { key: 'copper', label: 'Copper', rows: INGOT, palette: { k: OUTLINE, L: '#f0a070', M: '#d07a42', D: '#9a5228' } },
  iron: { key: 'iron', label: 'Iron', rows: INGOT, palette: { k: OUTLINE, L: '#c9ced6', M: '#9aa2ad', D: '#6b7380' } },
  food: {
    key: 'food', label: 'Food',
    rows: ['..kkkkkk..', '.kBBbBBbk.', 'kBbBBbBBBk', 'kBBBBBBBBk', 'kDDDDDDDDk', '.kkkkkkkk.'],
    palette: { k: OUTLINE, B: '#d9963f', b: '#f0c070', D: '#a8682a' },
  },
};

export const ALL_SPRITES: readonly SpriteDef[] = [...UNIT_SPRITES, SHIP, BARGE, ...TREES, ...Object.values(ICONS)];
