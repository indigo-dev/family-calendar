/* Gem row (a match-three principle): swap two neighbours; three or more equal in a row or column vanish. */

export const SIZE = 8;
export const KINDS = 6;

/** a gem: picture and a stable id (so it can glide when gems fall) */
export interface Gem {
  id: number;
  kind: number;
}

let nextId = 1;
const gem = (kind: number): Gem => ({ id: nextId++, kind });

/** all cells that are part of a row or column of three or more */
export function findMatches(kinds: number[], size = SIZE): Set<number> {
  const out = new Set<number>();
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const k = kinds[i];
      if (k < 0) continue;
      if (x <= size - 3 && kinds[i + 1] === k && kinds[i + 2] === k) {
        let e = x;
        while (e < size && kinds[y * size + e] === k) out.add(y * size + e++);
      }
      if (y <= size - 3 && kinds[i + size] === k && kinds[i + 2 * size] === k) {
        let e = y;
        while (e < size && kinds[e * size + x] === k) out.add(e++ * size + x);
      }
    }
  return out;
}

export const adjacent = (a: number, b: number, size = SIZE) =>
  (Math.abs(a - b) === 1 && Math.floor(a / size) === Math.floor(b / size)) || Math.abs(a - b) === size;

export function swapped<T>(arr: T[], a: number, b: number): T[] {
  const out = [...arr];
  [out[a], out[b]] = [out[b], out[a]];
  return out;
}

/** a swap that would make a match, if there is one (also used as a hint) */
export function findMove(kinds: number[], size = SIZE): [number, number] | null {
  for (let i = 0; i < size * size; i++)
    for (const j of [i + 1, i + size]) {
      if (j >= size * size || !adjacent(i, j, size)) continue;
      if (findMatches(swapped(kinds, i, j), size).size) return [i, j];
    }
  return null;
}

/** a fresh board without matches and with at least one possible move */
export function newBoard(rnd = Math.random, size = SIZE): Gem[] {
  for (;;) {
    const kinds: number[] = [];
    for (let i = 0; i < size * size; i++) {
      let k: number;
      do k = Math.floor(rnd() * KINDS);
      while (
        (i % size >= 2 && kinds[i - 1] === k && kinds[i - 2] === k) ||
        (i >= 2 * size && kinds[i - size] === k && kinds[i - 2 * size] === k)
      );
      kinds.push(k);
    }
    if (findMove(kinds, size)) return kinds.map(gem);
  }
}

/**
 * Removes the matched cells, lets the gems above fall down and fills the gaps from the top.
 * `fresh` = ids of the new gems (they fall in from above the board).
 */
export function collapse(board: Gem[], removed: Set<number>, rnd = Math.random, size = SIZE): { board: Gem[]; fresh: Set<number> } {
  const out: (Gem | null)[] = [...board];
  const fresh = new Set<number>();
  for (let x = 0; x < size; x++) {
    const column: Gem[] = [];
    for (let y = size - 1; y >= 0; y--) {
      const i = y * size + x;
      if (!removed.has(i)) column.push(board[i]);
    }
    for (let y = size - 1, c = 0; y >= 0; y--, c++) {
      let g = column[c];
      if (!g) {
        g = gem(Math.floor(rnd() * KINDS));
        fresh.add(g.id);
      }
      out[y * size + x] = g;
    }
  }
  return { board: out as Gem[], fresh };
}

export const kindsOf = (board: Gem[]) => board.map((g) => g.kind);
