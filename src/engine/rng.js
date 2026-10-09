// Small deterministic RNG so a fast sim and a real-time match can share a seed.
// Returns a function in [0, 1), same shape as Math.random.

export function mulberry32(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
