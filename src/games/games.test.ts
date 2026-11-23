import { describe, expect, it } from 'vitest';
import { LEVELS, emptyField, isLost, isWon, layMines, neighbours, open } from './logic/mines';
import { KINDS, LAYOUT, findPair, isFree, newDeal, reshuffle } from './logic/tiles';
import { SIZE, collapse, findMatches, findMove, kindsOf, newBoard } from './logic/gems';
import { FIELD_H, FIELD_W, PADDLE_X, newDuel, step, winner, type Duel } from './logic/paddle';
import { gate, parseGamesSettings, type GamesSettings } from './store';

/** a small seeded random, so the tests are repeatable */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('minefield', () => {
  it('never lays a mine on the first tap or around it', () => {
    const { w, h, mines } = LEVELS[1];
    for (let s = 1; s < 20; s++) {
      const safe = Math.floor(seeded(s)() * w * h);
      const f = layMines(w, h, mines, safe, seeded(s));
      expect(f.filter((x) => x.mine)).toHaveLength(mines);
      for (const i of [safe, ...neighbours(safe, w, h)]) expect(f[i].mine).toBe(false);
    }
  });

  it('opens empty areas at once and knows won and lost', () => {
    const f = layMines(9, 9, 10, 40, seeded(3));
    const opened = open(f, 9, 9, 40);
    expect(opened.filter((x) => x.open).length).toBeGreaterThan(1);
    expect(isLost(opened)).toBe(false);
    const all = f.map((x) => ({ ...x, open: !x.mine }));
    expect(isWon(all)).toBe(true);
    expect(isWon(emptyField(3, 3))).toBe(false);
  });
});

describe('tile pairs', () => {
  it('has 72 places and 18 pictures four times', () => {
    expect(LAYOUT).toHaveLength(72);
    const deal = newDeal(seeded(1));
    const count = new Map<number, number>();
    for (const k of deal.values()) count.set(k, (count.get(k) ?? 0) + 1);
    expect(count.size).toBe(KINDS);
    expect([...count.values()].every((n) => n === 4)).toBe(true);
  });

  it('a tile under another one or between two neighbours is not free', () => {
    const all = new Set(LAYOUT.map((_, i) => i));
    const covered = LAYOUT.findIndex((s) => s.z === 0 && s.x === 8 && s.y === 2);
    const middle = LAYOUT.findIndex((s) => s.z === 0 && s.x === 2 && s.y === 0);
    const edge = LAYOUT.findIndex((s) => s.z === 0 && s.x === 0 && s.y === 0);
    expect(isFree(covered, all)).toBe(false);
    expect(isFree(middle, all)).toBe(false);
    expect(isFree(edge, all)).toBe(true);
  });

  it('every deal can be solved – also after shuffling', () => {
    for (let s = 1; s <= 5; s++) {
      let tiles = newDeal(seeded(s));
      let moves = 0;
      while (tiles.size) {
        let pair = findPair(tiles);
        if (!pair) {
          tiles = reshuffle(tiles, seeded(s + 100));
          pair = findPair(tiles);
        }
        expect(pair).not.toBeNull();
        tiles.delete(pair![0]);
        tiles.delete(pair![1]);
        if (++moves > 100) throw new Error('no end');
      }
    }
  });
});

describe('gem row', () => {
  it('starts without matches but with a possible move', () => {
    for (let s = 1; s < 10; s++) {
      const kinds = kindsOf(newBoard(seeded(s)));
      expect(findMatches(kinds).size).toBe(0);
      expect(findMove(kinds)).not.toBeNull();
    }
  });

  it('finds rows and columns of three or more', () => {
    const k = Array.from({ length: SIZE * SIZE }, (_, i) => (i % 2) + 2 * Math.floor(i / SIZE) * 0 + (Math.floor(i / SIZE) % 2) * 2);
    k[0] = k[1] = k[2] = 5;
    k[SIZE * 3 + 4] = k[SIZE * 4 + 4] = k[SIZE * 5 + 4] = k[SIZE * 6 + 4] = 4;
    const m = findMatches(k);
    expect([0, 1, 2].every((i) => m.has(i))).toBe(true);
    expect([3, 4, 5, 6].every((y) => m.has(y * SIZE + 4))).toBe(true);
  });

  it('lets gems fall and fills the gaps from the top', () => {
    const board = newBoard(seeded(7));
    const bottom = SIZE * (SIZE - 1);
    const above = board[bottom - SIZE];
    const { board: next, fresh } = collapse(board, new Set([bottom]), seeded(8));
    expect(next[bottom].id).toBe(above.id);
    expect(fresh.size).toBe(1);
    expect(fresh.has(next[0].id)).toBe(true);
  });
});

describe('paddle duel', () => {
  it('bounces off a paddle and scores when the ball passes', () => {
    let d: Duel = { ...newDuel(seeded(1)), wait: 0, ball: { x: PADDLE_X + 6, y: FIELD_H / 2, vx: -80, vy: 0 }, left: FIELD_H / 2 };
    for (let i = 0; i < 20; i++) d = step(d, 0.02).duel;
    expect(d.ball.vx).toBeGreaterThan(0);
    d = { ...d, ball: { x: FIELD_W - 2, y: 3, vx: 120, vy: 0 }, right: FIELD_H - 10 };
    for (let i = 0; i < 20; i++) d = step(d, 0.02).duel;
    expect(d.score).toEqual([1, 0]);
    expect(winner({ ...d, score: [7, 3] })).toBe('left');
  });
});

describe('games settings', () => {
  it('the corner is on by default and stays off once switched off', () => {
    expect(parseGamesSettings(undefined)).toEqual({ enabled: true, dailyMinutes: 0, from: 0, to: 24 });
    expect(parseGamesSettings({ dailyMinutes: 30 }).enabled).toBe(true);
    expect(parseGamesSettings({ enabled: false }).enabled).toBe(false);
  });
});

describe('opening hours and play time', () => {
  const s = (p: Partial<GamesSettings>): GamesSettings => ({ enabled: true, dailyMinutes: 0, from: 0, to: 24, ...p });
  const at = (h: number) => new Date(2026, 10, 23, h, 30);
  it('is open without limits, closed outside the hours and after the daily time', () => {
    expect(gate(s({}), at(3), 99999)).toEqual({ open: true, minutesLeft: null });
    expect(gate(s({ from: 14, to: 19 }), at(12), 0)).toEqual({ open: false, reason: 'hours' });
    expect(gate(s({ from: 14, to: 19 }), at(15), 0).open).toBe(true);
    expect(gate(s({ from: 20, to: 8 }), at(23), 0).open).toBe(true);
    expect(gate(s({ dailyMinutes: 30 }), at(15), 20 * 60)).toEqual({ open: true, minutesLeft: 10 });
    expect(gate(s({ dailyMinutes: 30 }), at(15), 30 * 60)).toEqual({ open: false, reason: 'time' });
  });
});
