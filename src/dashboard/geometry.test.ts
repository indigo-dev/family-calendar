import { describe, expect, it } from 'vitest';
import { GAP, gridGeometry } from './geometry';

const ratio = (g: { cellW: number; rowH: number }) => g.rowH / g.cellW;
const rowsIn = (height: number, rowH: number) => Math.round((height + GAP) / (rowH + GAP));

describe('gridGeometry', () => {
  it('keeps 3 rows on a landscape wall tablet', () => {
    const g = gridGeometry(1200, 700);
    expect(g.cols).toBe(6);
    expect(rowsIn(700, g.rowH)).toBe(3);
  });

  it('adds rows on a tall window instead of stretching the cells', () => {
    // the case from the screenshot: a big screen, cells were 300 × 500
    const g = gridGeometry(1860, 1540);
    expect(g.cols).toBe(6);
    expect(rowsIn(1540, g.rowH)).toBe(5);
    expect(ratio(g)).toBeGreaterThanOrEqual(0.9);
    expect(ratio(g)).toBeLessThan(1.2);
    const narrow = gridGeometry(1000, 1500);
    expect(ratio(narrow)).toBeGreaterThanOrEqual(0.9);
    expect(ratio(narrow)).toBeLessThan(1.2);
  });

  it('keeps portrait tablets near square too', () => {
    const g = gridGeometry(740, 980);
    expect(g.cols).toBe(4);
    expect(ratio(g)).toBeGreaterThanOrEqual(0.9);
    expect(ratio(g)).toBeLessThan(1.25);
  });

  it('fills the height exactly with whole rows', () => {
    const g = gridGeometry(1300, 820);
    const rows = rowsIn(820, g.rowH);
    expect(Math.abs(rows * g.rowH + (rows - 1) * GAP - 820)).toBeLessThanOrEqual(rows);
  });

  it('never gets too flat on short screens and lets phones scroll', () => {
    expect(gridGeometry(1400, 260).rowH).toBeGreaterThanOrEqual(118);
    expect(gridGeometry(390, 700)).toMatchObject({ cols: 2, rowH: Math.round(((390 - GAP) / 2) * 0.95) });
  });
});
