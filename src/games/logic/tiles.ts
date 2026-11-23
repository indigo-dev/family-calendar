/*
 * Tile pairs (a mahjong-solitaire principle): remove two equal tiles that are free. A tile is free when no
 * tile lies on it and its left or right side is open. Deals are always solvable: they are built by
 * playing the game backwards (two free places get the same picture, then they are taken away).
 */

/** a place on the board, in half-tile steps (a tile is 2 × 2), z = layer */
export interface Slot {
  x: number;
  y: number;
  z: number;
}

function layer(z: number, xs: number[], ys: number[]): Slot[] {
  return ys.flatMap((y) => xs.map((x) => ({ x, y, z })));
}
const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i * 2);

/** 72 tiles on three layers: 10 × 4, 8 × 3 offset by half a tile, 4 × 2 */
export const LAYOUT: Slot[] = [
  ...layer(0, range(0, 10), range(0, 4)),
  ...layer(1, range(2, 8), range(1, 3)),
  ...layer(2, range(6, 4), range(2, 2)),
];

/** 18 pictures × 4 tiles */
export const KINDS = 18;

const overlaps = (a: Slot, b: Slot) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;

/** Is the tile at `i` free, given the places that are still taken? */
export function isFree(i: number, taken: Set<number>, layout = LAYOUT): boolean {
  const s = layout[i];
  let left = false;
  let right = false;
  for (const j of taken) {
    if (j === i) continue;
    const o = layout[j];
    if (o.z === s.z + 1 && overlaps(o, s)) return false;
    if (o.z === s.z && Math.abs(o.y - s.y) < 2) {
      if (o.x === s.x - 2) left = true;
      if (o.x === s.x + 2) right = true;
    }
  }
  return !left || !right;
}

/**
 * Gives every place in `places` a picture so that the deal can be solved. `pairs` lists the picture of
 * every pair (each picture twice for four tiles). Null if no solvable order was found.
 */
export function deal(places: number[], pairs: number[], rnd = Math.random, layout = LAYOUT): Map<number, number> | null {
  for (let attempt = 0; attempt < 200; attempt++) {
    const taken = new Set(places);
    const kinds = [...pairs];
    const out = new Map<number, number>();
    let ok = true;
    while (taken.size) {
      const free = [...taken].filter((i) => isFree(i, taken, layout));
      if (free.length < 2) {
        ok = false;
        break;
      }
      const a = free.splice(Math.floor(rnd() * free.length), 1)[0];
      const b = free[Math.floor(rnd() * free.length)];
      const kind = kinds.splice(Math.floor(rnd() * kinds.length), 1)[0];
      out.set(a, kind).set(b, kind);
      taken.delete(a);
      taken.delete(b);
    }
    if (ok) return out;
  }
  return null;
}

/** a new game: every place gets a picture */
export function newDeal(rnd = Math.random): Map<number, number> {
  const pairs = Array.from({ length: KINDS * 2 }, (_, i) => i % KINDS);
  return deal(
    LAYOUT.map((_, i) => i),
    pairs,
    rnd,
  )!;
}

/** mixes the remaining tiles anew (always solvable again) */
export function reshuffle(tiles: Map<number, number>, rnd = Math.random): Map<number, number> {
  const count = new Map<number, number>();
  for (const k of tiles.values()) count.set(k, (count.get(k) ?? 0) + 1);
  const pairs = [...count].flatMap(([k, n]) => Array.from({ length: n / 2 }, () => k));
  return deal([...tiles.keys()], pairs, rnd) ?? tiles;
}

/** a pair of free equal tiles, if there is one */
export function findPair(tiles: Map<number, number>, layout = LAYOUT): [number, number] | null {
  const taken = new Set(tiles.keys());
  const seen = new Map<number, number>();
  for (const i of taken) {
    if (!isFree(i, taken, layout)) continue;
    const kind = tiles.get(i)!;
    const other = seen.get(kind);
    if (other !== undefined) return [other, i];
    seen.set(kind, i);
  }
  return null;
}
