// Seedable random number generator so every simulation is reproducible.
// mulberry32: tiny, fast, and good enough for Monte Carlo sampling.

export type Rng = () => number;

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sample from a Poisson distribution (Knuth's method, fine for football-sized rates). */
export function samplePoisson(rng: Rng, lambda: number): number {
  if (!(lambda >= 0)) {
    throw new Error(`Poisson rate must be a number >= 0, got ${lambda}`);
  }
  const limit = Math.exp(-lambda);
  let count = 0;
  let product = rng();
  while (product > limit) {
    count += 1;
    product *= rng();
  }
  return count;
}
