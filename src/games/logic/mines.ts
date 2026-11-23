/* Minefield: open fields, avoid mines. The mines are laid after the first tap, never around it. */

export interface Field {
  mine: boolean;
  /** mines around */
  n: number;
  open: boolean;
  flag: boolean;
}

export interface Level {
  id: 'easy' | 'medium' | 'hard';
  w: number;
  h: number;
  mines: number;
}

export const LEVELS: Level[] = [
  { id: 'easy', w: 9, h: 9, mines: 10 },
  { id: 'medium', w: 14, h: 10, mines: 24 },
  { id: 'hard', w: 18, h: 12, mines: 42 },
];

export function neighbours(i: number, w: number, h: number): number[] {
  const x = i % w;
  const y = Math.floor(i / w);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(ny * w + nx);
    }
  return out;
}

export const emptyField = (w: number, h: number): Field[] =>
  Array.from({ length: w * h }, () => ({ mine: false, n: 0, open: false, flag: false }));

/** Lays the mines – none on the first tapped field and its neighbours, so the game starts with an opening. */
export function layMines(w: number, h: number, count: number, safe: number, rnd = Math.random): Field[] {
  const keepFree = new Set([safe, ...neighbours(safe, w, h)]);
  const candidates = Array.from({ length: w * h }, (_, i) => i).filter((i) => !keepFree.has(i));
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const mines = new Set(candidates.slice(0, count));
  return Array.from({ length: w * h }, (_, i) => ({
    mine: mines.has(i),
    n: neighbours(i, w, h).filter((j) => mines.has(j)).length,
    open: false,
    flag: false,
  }));
}

/** Opens a field; empty fields (n = 0) open their neighbours as well. */
export function open(fields: Field[], w: number, h: number, start: number): Field[] {
  const next = fields.map((f) => ({ ...f }));
  const todo = [start];
  while (todo.length) {
    const i = todo.pop()!;
    const f = next[i];
    if (f.open || f.flag) continue;
    f.open = true;
    if (!f.mine && f.n === 0) todo.push(...neighbours(i, w, h).filter((j) => !next[j].open));
  }
  return next;
}

export const isWon = (fields: Field[]) => fields.every((f) => f.mine || f.open);
export const isLost = (fields: Field[]) => fields.some((f) => f.mine && f.open);
