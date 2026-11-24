/*
 * Size of the dashboard grid. The columns follow the width; the rows follow the height so that the
 * cells stay roughly square: as many whole rows as fit, stretched a little to fill the screen exactly.
 * A wall tablet in landscape gets 3 rows as before, a tall window more – instead of cells twice as high
 * as they are wide.
 */

export const GAP = 12;

/** smallest row height; below it the grid scrolls */
const MIN_ROW = 118;
/** a cell may be at most this much lower than wide */
const FLATTEST = 0.9;

export function columnsFor(width: number): number {
  return width >= 960 ? 6 : width >= 560 ? 4 : 2;
}

export interface GridGeometry {
  cols: number;
  cellW: number;
  rowH: number;
}

export function gridGeometry(width: number, height: number): GridGeometry {
  const cols = columnsFor(width);
  const cellW = (width - GAP * (cols - 1)) / cols;
  // phones scroll anyway: cells a little wider than high
  if (cols === 2) return { cols, cellW, rowH: Math.round(Math.max(130, cellW * 0.95)) };
  // as many whole rows as fit without cells flatter than 0.9 × their width; the rest stretches them a little
  const rows = Math.max(2, Math.floor((height + GAP) / (cellW * FLATTEST + GAP)));
  const rowH = (height - GAP * (rows - 1)) / rows;
  return { cols, cellW, rowH: Math.round(Math.max(MIN_ROW, rowH)) };
}
