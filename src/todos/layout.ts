import type { CSSProperties } from 'react';
import type { Member } from '../types';
import { fmt } from '../lib/dates';
import type { Todo } from '../lib/todos';

/* Geometry of the to-do board: note size, placement and the shapes of the touch gestures. */

/** note size at scale 1 */
export const NOTE_W = 208;
export const NOTE_H = 168;
const GAP = 14;
export const PAD = 14;
const MIN_SIZE = 0.6;
const MAX_SIZE = 2.2;
export const clampSize = (s: number) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, s));

const tint = (c: string, pct = 16) => `color-mix(in srgb, ${c} ${pct}%, var(--surface))`;

export function noteStyle(members: Member[]): CSSProperties {
  const colors = members.map((m) => m.color);
  if (colors.length === 0) colors.push('var(--muted)');
  return {
    background: colors.length === 1 ? tint(colors[0]) : `linear-gradient(135deg, ${colors.map((c) => tint(c)).join(', ')})`,
    ['--note-c' as string]: colors[0],
    ['--note-strip' as string]: colors.length === 1 ? colors[0] : `linear-gradient(90deg, ${colors.join(', ')})`,
  };
}

export function dueInfo(due: string | undefined, today: Date): { label: string; tone: 'late' | 'today' | 'soon' | '' } | null {
  if (!due) return null;
  const [y, m, d] = due.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { label: diff === -1 ? 'seit gestern' : `seit ${fmt(date, { day: 'numeric', month: 'numeric' })}`, tone: 'late' };
  if (diff === 0) return { label: 'Heute', tone: 'today' };
  if (diff === 1) return { label: 'Morgen', tone: 'soon' };
  if (diff < 7) return { label: fmt(date, { weekday: 'long' }), tone: '' };
  return { label: fmt(date, { weekday: 'short', day: 'numeric', month: 'numeric' }), tone: '' };
}

/** board order for auto placement: due first, then newest */
export function sortOpen(a: Todo, b: Todo): number {
  if (a.due && b.due) return a.due.localeCompare(b.due) || b.createdAt - a.createdAt;
  if (a.due) return -1;
  if (b.due) return 1;
  return b.createdAt - a.createdAt;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;

/** finds a free spot (row by row, left to right) for every note without a position */
export function autoPlace(open: Todo[], width: number): Record<string, Partial<Todo>> {
  const placed: Rect[] = open
    .filter((t) => t.x != null && t.y != null)
    .map((t) => ({ x: t.x!, y: t.y!, w: NOTE_W * (t.size ?? 1), h: NOTE_H * (t.size ?? 1) }));
  const fresh = open.filter((t) => t.x == null || t.y == null).sort(sortOpen);
  // narrow boards (phones): two notes side by side
  const defaultSize = width < 560 ? Math.max(MIN_SIZE, Math.floor(((width - 2 * PAD - GAP - 4) / 2 / NOTE_W) * 100) / 100) : 1;
  const out: Record<string, Partial<Todo>> = {};
  for (const t of fresh) {
    const size = t.size ?? defaultSize;
    const w = NOTE_W * size;
    const h = NOTE_H * size;
    const stepX = (NOTE_W * defaultSize + GAP) / 2;
    const stepY = (NOTE_H * defaultSize + GAP) / 2;
    let spot: Rect | null = null;
    for (let row = 0; row < 400 && !spot; row++) {
      for (let col = 0; ; col++) {
        const x = PAD + col * stepX;
        if (col > 0 && x + w > width - PAD) break;
        const r = { x, y: PAD + row * stepY, w, h };
        if (!placed.some((p) => overlaps(p, r))) {
          spot = r;
          break;
        }
      }
    }
    if (!spot) spot = { x: PAD, y: PAD, w, h };
    placed.push(spot);
    out[t.id] = { x: Math.round(spot.x), y: Math.round(spot.y), size };
  }
  return out;
}

export interface Live {
  id: string;
  x: number;
  y: number;
  size: number;
  z: number;
}

export interface Gesture {
  id: string;
  mode: 'press' | 'drag' | 'pinch' | 'resize';
  pointers: Map<number, { x: number; y: number }>;
  /** pointer position when the current mode started */
  origin: { x: number; y: number };
  start: Live;
  startDist?: number;
  /** midpoint of the fingers relative to the note's top left (board px) when the pinch started */
  anchor?: { x: number; y: number };
}
