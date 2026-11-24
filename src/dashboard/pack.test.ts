import { describe, expect, it } from 'vitest';
import { arrange, fitsAt, freeCells, rowsOf } from './pack';

const s = { w: 1, h: 1 };
const m = { w: 2, h: 1 };
const l = { w: 2, h: 2 };
const t = { w: 1, h: 2 };

describe('dashboard arrangement', () => {
  it('fills like grid-auto-flow: row dense when nothing is placed by hand', () => {
    expect(arrange([l, s, s, m], 4)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 2, y: 1 },
    ]);
    // a later small box goes back into an earlier gap
    expect(arrange([m, t, m, s], 4)[3]).toEqual({ x: 3, y: 0 });
    // wider than the grid: clamped to the columns
    expect(arrange([{ w: 3, h: 1 }], 2)).toEqual([{ x: 0, y: 0 }]);
  });

  it('keeps hand-placed widgets where they are, the others flow around them', () => {
    // the screenshot: a small widget moved into the gap next to another one
    const cells = arrange([l, { ...s, pos: { x: 3, y: 1 } }, s], 4);
    expect(cells).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 1 },
      { x: 2, y: 0 },
    ]);
  });

  it('places a widget automatically if its cell is taken or outside the grid', () => {
    const cells = arrange(
      [
        { ...m, pos: { x: 0, y: 0 } },
        { ...s, pos: { x: 1, y: 0 } },
        { ...s, pos: { x: 5, y: 0 } },
      ],
      4,
    );
    expect(cells).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it('finds free cells and whether a widget fits into them', () => {
    const boxes = [l, s, { ...s, pos: { x: 3, y: 1 } }];
    const cells = arrange(boxes, 4);
    expect(rowsOf(boxes, cells)).toBe(2);
    expect(freeCells(boxes, cells, 4, 2)).toEqual([
      { x: 3, y: 0 },
      { x: 2, y: 1 },
    ]);
    expect(fitsAt(boxes, cells, 1, { x: 2, y: 1 }, 4)).toBe(true);
    // the big one does not fit into a single free cell
    expect(fitsAt(boxes, cells, 0, { x: 2, y: 1 }, 4)).toBe(false);
    // moving onto its own old place is fine
    expect(fitsAt(boxes, cells, 0, { x: 0, y: 0 }, 4)).toBe(true);
  });
});
