// Campaign terrain. cost = move points to enter (Infinity = impassable),
// def = unused: terrain defense was retired in the stat rework. avoid = points added to the attacker's miss chance (terrain dodge stays).
// heal = fraction of max HP restored at the start of the owner's phase.
// Each terrain has a tile image in assets/campaign/tiles/<id>.jpg.

export const TERRAIN = {
  plain: { id: 'plain', name: 'Plain', cost: 1, def: 0, avoid: 0, glyph: '.' },
  road: { id: 'road', name: 'Road', cost: 1, def: 0, avoid: 0, glyph: ',' },
  floor: { id: 'floor', name: 'Courtyard', cost: 1, def: 0, avoid: 0, glyph: '_' },
  forest: { id: 'forest', name: 'Forest', cost: 2, def: 0, avoid: 20, glyph: 'f' },
  mountain: { id: 'mountain', name: 'Mountain', cost: 3, def: 0, avoid: 30, glyph: '^' },
  water: { id: 'water', name: 'Water', cost: Infinity, def: 0, avoid: 0, glyph: '~' },
  wall: { id: 'wall', name: 'Wall', cost: Infinity, def: 0, avoid: 0, glyph: '#' },
  fort: { id: 'fort', name: 'Fort', cost: 1, def: 0, avoid: 20, heal: 0.2, glyph: 'F' },
  village: { id: 'village', name: 'Village', cost: 1, def: 0, avoid: 10, heal: 0.2, glyph: 'v' },
  throne: { id: 'throne', name: 'Throne', cost: 1, def: 0, avoid: 30, heal: 0.2, glyph: 'T' },
};

export const GLYPH_TO_TERRAIN = Object.fromEntries(Object.values(TERRAIN).map((t) => [t.glyph, t.id]));
export const TERRAIN_IDS = Object.keys(TERRAIN);

export function terrainAt(map, x, y) {
  const id = map.tiles[y]?.[x];
  return id ? TERRAIN[id] : null;
}
