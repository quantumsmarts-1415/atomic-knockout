// Draft fighters/<id>.json from the character buildout doc.
// Moves stay in src/data/movesets.js. This file is identity, element stats,
// a height, air jumps, and a starter palette.
//
//   node tools/draft-fighters.js --doc "Atomic Knockout - Character Buildout.md" --all
//   node tools/draft-fighters.js --doc buildout.md --element Tantalum
//   node tools/draft-fighters.js --doc buildout.md --id tara --force
//
// Existing files are left alone unless --force is set.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PERIODIC_ELEMENTS, familyOf } from '../src/data/periodic.js';
import { deriveProfile } from '../src/data/balance.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GRAVITY = 1500;
const METAL = new Set(['alkali', 'alkaline', 'transition', 'post-transition', 'lanthanide', 'actinide']);

const BY_ELEMENT = new Map(PERIODIC_ELEMENTS.map((e) => [e.name.toLowerCase(), e]));

function parseArgs(argv) {
  const named = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) named[key] = true;
    else { named[key] = next; i++; }
  }
  return named;
}

function head(text) {
  return String(text).split('(')[0];
}

function firstNumber(text) {
  const m = head(text).match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function rangeOrNumber(text) {
  const h = head(text);
  const range = h.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const n = firstNumber(text);
  return n == null ? 0 : n;
}

function parseMohs(text) {
  if (!/mohs/i.test(text)) return 0;
  const nums = [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
}

function parseDensity(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*g\/cm/i);
  if (m) return Number(m[1]);
  const n = firstNumber(text);
  return n == null ? 0 : n;
}

function parseBoiling(text) {
  if (/no published|unpublished|n\/a/i.test(text)) return null;
  return firstNumber(text);
}

function parseConductivity(text) {
  if (/no published|unpublished/i.test(text) && firstNumber(head(text)) == null) return null;
  const n = firstNumber(head(text));
  if (n == null) return 0;
  return n;
}

function parseEn(text) {
  if (/none|n\/a|no published|unpublished/i.test(text) && !/^\s*\d/.test(head(text))) return null;
  const n = firstNumber(head(text));
  return n == null ? null : n;
}

function parseState(text) {
  const s = text.toLowerCase();
  if (s.includes('gas')) return 'gas';
  if (s.includes('liquid')) return 'liquid';
  return 'solid';
}

function slug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function fieldMap(block) {
  const fields = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*([^:\n]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim().toLowerCase();
    if (fields[key] == null) fields[key] = m[2].trim();
  }
  return fields;
}

/** Parse the buildout markdown into one record per element. */
export function parseBuildout(markdown) {
  const text = String(markdown).replace(/\r\n/g, '\n');
  const chunks = text.split(/\n(?=-)/);
  const out = [];
  for (const chunk of chunks) {
    const header = chunk.match(/^-([A-Za-z][A-Za-z]*)\b/);
    if (!header) continue;
    const element = header[1];
    const known = BY_ELEMENT.get(element.toLowerCase());
    if (!known) continue;
    const fields = fieldMap(chunk);
    if (!fields.name || !fields.density) continue;
    const family = familyOf(known.n);
    const state = parseState(fields['natural state'] || 'solid');
    const elementData = {
      state,
      family,
      metal: METAL.has(family),
      noble: family === 'noble',
      density: parseDensity(fields.density),
      mohs: parseMohs(fields['hardness (kinetic attack)'] || ''),
      tensile: rangeOrNumber(fields['tensile strength (kinetic defense)'] || ''),
      boiling: parseBoiling(fields['boiling point'] || ''),
      conductivity: parseConductivity(fields['electrical conductivity'] || ''),
      en: parseEn(fields.electronegativity || ''),
    };
    const id = slug(fields.name);
    const charge = (fields['charge move'] || '').match(/"([^"]+)"/);
    out.push({
      id,
      name: fields.name.trim(),
      element: known.name,
      symbol: known.sym,
      atomicNumber: known.n,
      tagline: charge ? charge[1] : known.name,
      teach: '',
      elementData,
    });
  }
  return out;
}

export function hopPixels(elementData) {
  const profile = deriveProfile(elementData);
  const g = GRAVITY * (profile.gravityScale ?? 1);
  return (profile.jumpVelocity ** 2) / (2 * g);
}

function shade(hex, toward, t) {
  const ch = (shift) => {
    const c = (hex >> shift) & 255;
    const o = (toward >> shift) & 255;
    return Math.round(c + (o - c) * t) & 255;
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

const FAMILY_HEX = {
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

export function draftPalettes(family) {
  const body = FAMILY_HEX[family] ?? 0x4a8fd6;
  const skin = shade(body, 0xf4e2c8, 0.72);
  const names = ['Standard', 'Deep', 'Pale', 'Night'];
  const mixes = [0, 0.35, 0.62, 0.78];
  const targets = [body, 0x1a120c, 0xf7f1e4, 0x120814];
  return names.map((name, i) => ({
    name,
    skin,
    body: shade(body, targets[i], mixes[i]),
    accent: shade(body, 0xffe08a, 0.45),
    eye: 0xf4fbff,
  }));
}

export function draftFighter(record) {
  const single = hopPixels(record.elementData);
  const height = 132;
  return {
    id: record.id,
    name: record.name,
    element: record.element,
    symbol: record.symbol,
    atomicNumber: record.atomicNumber,
    tagline: record.tagline,
    teach: record.teach,
    height,
    facing: 1,
    airJumps: single < 90 ? 0 : 1,
    bodyW: Math.round(height * 0.34),
    bodyH: Math.round(height * 0.88),
    elementData: record.elementData,
    palettes: draftPalettes(record.elementData.family),
  };
}

export function writeDrafts(records, outDir, { force = false, onlyId = null, onlyElement = null } = {}) {
  mkdirSync(outDir, { recursive: true });
  const written = [];
  const kept = [];
  const matched = records.filter((r) => {
    if (onlyId && r.id !== onlyId) return false;
    if (onlyElement && r.element.toLowerCase() !== String(onlyElement).toLowerCase()) return false;
    return true;
  });
  for (const rec of matched) {
    const file = path.join(outDir, `${rec.id}.json`);
    if (existsSync(file) && !force) {
      kept.push(rec.id);
      continue;
    }
    const draft = draftFighter(rec);
    writeFileSync(file, `${JSON.stringify(draft, null, 2)}\n`);
    written.push(rec.id);
  }
  return { written, kept, matched: matched.length };
}

function main() {
  const named = parseArgs(process.argv);
  if (!named.doc || named.help) {
    console.error('Usage: node tools/draft-fighters.js --doc <buildout.md> [--all | --id tara | --element Tantalum] [--out fighters] [--force]');
    process.exit(named.help ? 0 : 1);
  }
  const records = parseBuildout(readFileSync(path.resolve(named.doc), 'utf8'));
  const outDir = path.resolve(named.out || path.join(ROOT, 'fighters'));
  const onlyId = named.id || null;
  const onlyElement = named.element || null;
  const all = named.all || (!onlyId && !onlyElement);
  const result = writeDrafts(records, outDir, {
    force: !!named.force,
    onlyId: all ? null : onlyId,
    onlyElement: all ? null : onlyElement,
  });
  console.log(`parsed ${records.length} elements`);
  console.log(`wrote ${result.written.length}: ${result.written.join(', ') || '(none)'}`);
  console.log(`kept ${result.kept.length} existing file${result.kept.length === 1 ? '' : 's'}`);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) main();
