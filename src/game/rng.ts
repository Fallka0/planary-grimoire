/**
 * Seeded randomness.
 *
 * A run is one seed. Everything the run draws — the pocket the ball falls into,
 * what the shop stocks, which Pit Boss takes the table — comes out of this
 * stream, so a seed replays exactly. The seed itself is drawn from the
 * platform's cryptographic generator, so nobody can predict a fresh run; once
 * it is drawn, the run is a fixed story you are discovering.
 */

/** Mixes a string into a 32-bit seed (xmur3). */
function seedFrom(text: string): number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export class Rng {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === "number" ? seed >>> 0 : seedFrom(seed);
    // A zero state would stick, and the first few draws off a raw seed are poor.
    if (this.state === 0) this.state = 0x9e3779b9;
    for (let i = 0; i < 8; i++) this.next();
  }

  /** mulberry32: small, fast, and good enough that no human will read a pattern in it. */
  private next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** A float in [0, 1). */
  float(): number {
    return this.next();
  }

  /** An integer in [0, n). */
  below(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** An integer in [min, max], both ends included. */
  between(min: number, max: number): number {
    return min + this.below(max - min + 1);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.below(items.length)];
  }

  /** Fisher–Yates on a copy, so the caller keeps their array. */
  shuffled<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.below(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Draws `count` different items, or everything when there aren't enough. */
  sample<T>(items: readonly T[], count: number): T[] {
    return this.shuffled(items).slice(0, count);
  }

  /** Picks by weight. Weights must be positive. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    const total = items.reduce((sum, item) => sum + weight(item), 0);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= weight(item);
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }

  /** Where the stream stands, so a run can be saved mid-round and picked up later. */
  get cursor(): number {
    return this.state;
  }

  static resume(cursor: number): Rng {
    const rng = new Rng(0);
    rng.state = cursor >>> 0;
    return rng;
  }
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A fresh, unguessable run seed that a player can read out loud and share. */
export function newSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
