// The full table, so character select can grow to 118 without a new layout.
// Playable fighters are filled in from the roster by atomic number.
// Empty main-table cells (the f-block gap) are not slots; lanthanides and
// actinides sit on the two rows underneath, the way a wall chart does.

const RAW = [
  [1, 'H', 'Hydrogen'], [2, 'He', 'Helium'],
  [3, 'Li', 'Lithium'], [4, 'Be', 'Beryllium'], [5, 'B', 'Boron'], [6, 'C', 'Carbon'],
  [7, 'N', 'Nitrogen'], [8, 'O', 'Oxygen'], [9, 'F', 'Fluorine'], [10, 'Ne', 'Neon'],
  [11, 'Na', 'Sodium'], [12, 'Mg', 'Magnesium'], [13, 'Al', 'Aluminum'], [14, 'Si', 'Silicon'],
  [15, 'P', 'Phosphorus'], [16, 'S', 'Sulfur'], [17, 'Cl', 'Chlorine'], [18, 'Ar', 'Argon'],
  [19, 'K', 'Potassium'], [20, 'Ca', 'Calcium'], [21, 'Sc', 'Scandium'], [22, 'Ti', 'Titanium'],
  [23, 'V', 'Vanadium'], [24, 'Cr', 'Chromium'], [25, 'Mn', 'Manganese'], [26, 'Fe', 'Iron'],
  [27, 'Co', 'Cobalt'], [28, 'Ni', 'Nickel'], [29, 'Cu', 'Copper'], [30, 'Zn', 'Zinc'],
  [31, 'Ga', 'Gallium'], [32, 'Ge', 'Germanium'], [33, 'As', 'Arsenic'], [34, 'Se', 'Selenium'],
  [35, 'Br', 'Bromine'], [36, 'Kr', 'Krypton'],
  [37, 'Rb', 'Rubidium'], [38, 'Sr', 'Strontium'], [39, 'Y', 'Yttrium'], [40, 'Zr', 'Zirconium'],
  [41, 'Nb', 'Niobium'], [42, 'Mo', 'Molybdenum'], [43, 'Tc', 'Technetium'], [44, 'Ru', 'Ruthenium'],
  [45, 'Rh', 'Rhodium'], [46, 'Pd', 'Palladium'], [47, 'Ag', 'Silver'], [48, 'Cd', 'Cadmium'],
  [49, 'In', 'Indium'], [50, 'Sn', 'Tin'], [51, 'Sb', 'Antimony'], [52, 'Te', 'Tellurium'],
  [53, 'I', 'Iodine'], [54, 'Xe', 'Xenon'],
  [55, 'Cs', 'Caesium'], [56, 'Ba', 'Barium'],
  [57, 'La', 'Lanthanum'], [58, 'Ce', 'Cerium'], [59, 'Pr', 'Praseodymium'], [60, 'Nd', 'Neodymium'],
  [61, 'Pm', 'Promethium'], [62, 'Sm', 'Samarium'], [63, 'Eu', 'Europium'], [64, 'Gd', 'Gadolinium'],
  [65, 'Tb', 'Terbium'], [66, 'Dy', 'Dysprosium'], [67, 'Ho', 'Holmium'], [68, 'Er', 'Erbium'],
  [69, 'Tm', 'Thulium'], [70, 'Yb', 'Ytterbium'], [71, 'Lu', 'Lutetium'],
  [72, 'Hf', 'Hafnium'], [73, 'Ta', 'Tantalum'], [74, 'W', 'Tungsten'], [75, 'Re', 'Rhenium'],
  [76, 'Os', 'Osmium'], [77, 'Ir', 'Iridium'], [78, 'Pt', 'Platinum'], [79, 'Au', 'Gold'],
  [80, 'Hg', 'Mercury'], [81, 'Tl', 'Thallium'], [82, 'Pb', 'Lead'], [83, 'Bi', 'Bismuth'],
  [84, 'Po', 'Polonium'], [85, 'At', 'Astatine'], [86, 'Rn', 'Radon'],
  [87, 'Fr', 'Francium'], [88, 'Ra', 'Radium'],
  [89, 'Ac', 'Actinium'], [90, 'Th', 'Thorium'], [91, 'Pa', 'Protactinium'], [92, 'U', 'Uranium'],
  [93, 'Np', 'Neptunium'], [94, 'Pu', 'Plutonium'], [95, 'Am', 'Americium'], [96, 'Cm', 'Curium'],
  [97, 'Bk', 'Berkelium'], [98, 'Cf', 'Californium'], [99, 'Es', 'Einsteinium'], [100, 'Fm', 'Fermium'],
  [101, 'Md', 'Mendelevium'], [102, 'No', 'Nobelium'], [103, 'Lr', 'Lawrencium'],
  [104, 'Rf', 'Rutherfordium'], [105, 'Db', 'Dubnium'], [106, 'Sg', 'Seaborgium'], [107, 'Bh', 'Bohrium'],
  [108, 'Hs', 'Hassium'], [109, 'Mt', 'Meitnerium'], [110, 'Ds', 'Darmstadtium'], [111, 'Rg', 'Roentgenium'],
  [112, 'Cn', 'Copernicium'], [113, 'Nh', 'Nihonium'], [114, 'Fl', 'Flerovium'], [115, 'Mc', 'Moscovium'],
  [116, 'Lv', 'Livermorium'], [117, 'Ts', 'Tennessine'], [118, 'Og', 'Oganesson'],
];

export const PERIODIC_ELEMENTS = RAW.map(([n, sym, name]) => ({ n, sym, name, ...tableCell(n) }));

export const TABLE_ROWS = 10;
export const TABLE_COLS = 18;

/** row/col on an 18-column chart. Row 7 is the blank gap above the f-block. */
export function tableCell(z) {
  if (z === 1) return { row: 0, col: 0 };
  if (z === 2) return { row: 0, col: 17 };
  if (z >= 3 && z <= 4) return { row: 1, col: z - 3 };
  if (z >= 5 && z <= 10) return { row: 1, col: z + 7 };
  if (z >= 11 && z <= 12) return { row: 2, col: z - 11 };
  if (z >= 13 && z <= 18) return { row: 2, col: z - 1 };
  if (z >= 19 && z <= 36) return { row: 3, col: z - 19 };
  if (z >= 37 && z <= 54) return { row: 4, col: z - 37 };
  if (z >= 55 && z <= 56) return { row: 5, col: z - 55 };
  if (z >= 72 && z <= 86) return { row: 5, col: z - 69 };
  if (z >= 87 && z <= 88) return { row: 6, col: z - 87 };
  if (z >= 104 && z <= 118) return { row: 6, col: z - 101 };
  if (z >= 57 && z <= 71) return { row: 8, col: z - 55 };
  if (z >= 89 && z <= 103) return { row: 9, col: z - 87 };
  throw new RangeError(`no table cell for Z=${z}`);
}

const FAMILY_COLOR = {
  alkali: 0xc45a4a,
  alkaline: 0xd08a3a,
  transition: 0x4a8fd6,
  'post-transition': 0x4aa88a,
  metalloid: 0x7a8f4a,
  nonmetal: 0x3a9a8a,
  halogen: 0xc4b04a,
  noble: 0x8a6ad6,
  lanthanide: 0xc46a9a,
  actinide: 0xd06a8a,
};

export function familyOf(z) {
  if ([3, 11, 19, 37, 55, 87].includes(z)) return 'alkali';
  if ([4, 12, 20, 38, 56, 88].includes(z)) return 'alkaline';
  if (z === 1 || [6, 7, 8, 15, 16, 34].includes(z)) return 'nonmetal';
  if ([2, 10, 18, 36, 54, 86, 118].includes(z)) return 'noble';
  if ([9, 17, 35, 53, 117].includes(z)) return 'halogen';
  if ([5, 14, 32, 33, 51, 52, 85].includes(z)) return 'metalloid';
  if (z >= 57 && z <= 71) return 'lanthanide';
  if (z >= 89 && z <= 103) return 'actinide';
  if ([13, 31, 49, 50, 81, 82, 83, 84].includes(z) || (z >= 113 && z <= 116)) return 'post-transition';
  return 'transition';
}

export function familyColor(z) {
  return FAMILY_COLOR[familyOf(z)] ?? 0x4a8fd6;
}

const BY_Z = new Map(PERIODIC_ELEMENTS.map((e) => [e.n, e]));
const BY_ROW = new Map();
for (const e of PERIODIC_ELEMENTS) {
  if (!BY_ROW.has(e.row)) BY_ROW.set(e.row, []);
  BY_ROW.get(e.row).push(e);
}
for (const list of BY_ROW.values()) list.sort((a, b) => a.col - b.col);

function neighborZ(z, dir) {
  const cell = BY_Z.get(z);
  if (!cell) return z;
  if (dir === 'left' || dir === 'right') {
    const row = BY_ROW.get(cell.row);
    const i = row.findIndex((e) => e.n === z);
    const step = dir === 'right' ? 1 : -1;
    return row[(i + step + row.length) % row.length].n;
  }
  const step = dir === 'down' ? 1 : -1;
  // Prefer the element in the same column, even if a gap sits in between
  // (lanthanum sits under the empty group-3 cell, so Up from La is yttrium).
  // Only if no column match exists in that direction, step to the nearest
  // element on the closest occupied row.
  let fallback = null;
  for (let row = cell.row + step; row >= 0 && row < TABLE_ROWS; row += step) {
    const mates = BY_ROW.get(row);
    if (!mates?.length) continue;
    const exact = mates.find((e) => e.col === cell.col);
    if (exact) return exact.n;
    if (!fallback) {
      fallback = mates.reduce((best, e) => (
        Math.abs(e.col - cell.col) < Math.abs(best.col - cell.col) ? e : best
      ));
    }
  }
  return fallback ? fallback.n : z;
}

/** Slots in atomic order, with charId filled when that element is playable. */
export function buildSelectSlots(characters) {
  const byZ = new Map();
  for (const c of Object.values(characters)) {
    if (c?.atomicNumber) byZ.set(c.atomicNumber, c);
  }
  return PERIODIC_ELEMENTS.map((e) => {
    const fighter = byZ.get(e.n);
    return {
      n: e.n,
      sym: e.sym,
      element: e.name,
      name: fighter?.name ?? e.name,
      charId: fighter?.id ?? null,
      row: e.row,
      col: e.col,
      family: familyOf(e.n),
    };
  });
}

/** Move a cursor index by one D-pad step. dx/dy are -1, 0, or 1. */
export function stepSlot(slots, index, dx, dy) {
  const cur = slots[index];
  if (!cur || (dx === 0 && dy === 0)) return index;
  const dir = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
  const next = neighborZ(cur.n, dir);
  const i = slots.findIndex((s) => s.n === next);
  return i < 0 ? index : i;
}
