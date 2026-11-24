/*
 * Where every dashboard widget sits. Widgets the family placed by hand keep their cell (per column
 * count – a 6-column tablet and a 2-column phone are arranged separately); all others fill the first
 * free place that fits, top to bottom and left to right, like CSS `grid-auto-flow: row dense`.
 */

export interface Box {
  w: number;
  h: number;
}

export interface Cell {
  x: number;
  y: number;
}

class Grid {
  private taken: boolean[][] = [];
  constructor(private cols: number) {}
  fits(x: number, y: number, b: Box): boolean {
    if (x < 0 || y < 0 || x + b.w > this.cols) return false;
    for (let r = y; r < y + b.h; r++) for (let c = x; c < x + b.w; c++) if (this.taken[r]?.[c]) return false;
    return true;
  }
  take(x: number, y: number, b: Box) {
    for (let r = y; r < y + b.h; r++) {
      this.taken[r] ??= [];
      for (let c = x; c < x + b.w; c++) this.taken[r][c] = true;
    }
  }
  first(b: Box): Cell {
    for (let y = 0; ; y++) for (let x = 0; x + b.w <= this.cols; x++) if (this.fits(x, y, b)) return { x, y };
  }
}

/**
 * The cell of every box: boxes with a `pos` keep it (in list order, as long as it is free and inside
 * the grid), the others go to the first free place. Widths are clamped to the columns.
 */
export function arrange(items: (Box & { pos?: Cell })[], cols: number): Cell[] {
  const grid = new Grid(cols);
  const boxes = items.map((b) => ({ w: Math.min(b.w, cols), h: b.h }));
  const out: (Cell | null)[] = items.map((it, i) => {
    const p = it.pos;
    if (!p || !grid.fits(p.x, p.y, boxes[i])) return null;
    grid.take(p.x, p.y, boxes[i]);
    return p;
  });
  return out.map((c, i) => {
    if (c) return c;
    const at = grid.first(boxes[i]);
    grid.take(at.x, at.y, boxes[i]);
    return at;
  });
}

/** number of rows the boxes use */
export const rowsOf = (boxes: Box[], cells: Cell[]) => Math.max(0, ...boxes.map((b, i) => cells[i].y + b.h));

/** free cells in the first `rows` rows */
export function freeCells(boxes: Box[], cells: Cell[], cols: number, rows: number): Cell[] {
  const grid = new Grid(cols);
  boxes.forEach((b, i) => grid.take(cells[i].x, cells[i].y, { w: Math.min(b.w, cols), h: b.h }));
  const out: Cell[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (grid.fits(x, y, { w: 1, h: 1 })) out.push({ x, y });
  return out;
}

/** can box `idx` move to `cell` without covering another box? */
export function fitsAt(boxes: Box[], cells: Cell[], idx: number, cell: Cell, cols: number): boolean {
  const grid = new Grid(cols);
  boxes.forEach((b, i) => i !== idx && grid.take(cells[i].x, cells[i].y, { w: Math.min(b.w, cols), h: b.h }));
  return grid.fits(cell.x, cell.y, { w: Math.min(boxes[idx].w, cols), h: boxes[idx].h });
}
