/**
 * Tiny deterministic PRNG. Suitable for repeatable simulations, not cryptography.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns a function that emits standard normal samples using Box-Muller.
 */
export function boxMuller(rand: () => number): () => number {
  let spare: number | null = null;

  return () => {
    if (spare !== null) {
      const next = spare;
      spare = null;
      return next;
    }

    let u = 0;
    let v = 0;

    while (u <= Number.EPSILON) {
      u = rand();
    }

    while (v <= Number.EPSILON) {
      v = rand();
    }

    const mag = Math.sqrt(-2.0 * Math.log(u));
    const theta = 2.0 * Math.PI * v;

    spare = mag * Math.sin(theta);
    return mag * Math.cos(theta);
  };
}

/**
 * q in [0, 1]. Input must be sorted ascending.
 */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) {
    return 0;
  }

  if (q <= 0) {
    return sorted[0];
  }

  if (q >= 1) {
    return sorted[sorted.length - 1];
  }

  const pos = (sorted.length - 1) * q;
  const low = Math.floor(pos);
  const high = Math.ceil(pos);

  if (low === high) {
    return sorted[low];
  }

  const weight = pos - low;
  return sorted[low] * (1 - weight) + sorted[high] * weight;
}
