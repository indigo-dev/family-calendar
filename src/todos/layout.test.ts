import { describe, expect, it } from 'vitest';
import type { Todo } from '../lib/todos';
import { autoPlace, dueInfo, NOTE_H, NOTE_W, sortOpen } from './layout';

const todo = (id: string, extra: Partial<Todo> = {}): Todo => ({ id, text: id, memberIds: ['m'], done: false, createdAt: 0, ...extra });
const today = new Date(2026, 10, 22);

describe('dueInfo', () => {
  it('labels late, today, tomorrow and later days', () => {
    expect(dueInfo('2026-11-21', today)).toEqual({ label: 'seit gestern', tone: 'late' });
    expect(dueInfo('2026-11-22', today)).toEqual({ label: 'Heute', tone: 'today' });
    expect(dueInfo('2026-11-23', today)).toEqual({ label: 'Morgen', tone: 'soon' });
    expect(dueInfo('2026-11-25', today)?.label).toBe('Mittwoch');
    expect(dueInfo(undefined, today)).toBeNull();
  });
});

describe('sortOpen', () => {
  it('puts due notes first (earliest first), then the newest', () => {
    const list = [
      todo('old', { createdAt: 1 }),
      todo('later', { due: '2026-12-01' }),
      todo('new', { createdAt: 5 }),
      todo('soon', { due: '2026-11-23' }),
    ];
    expect(list.sort(sortOpen).map((t) => t.id)).toEqual(['soon', 'later', 'new', 'old']);
  });
});

describe('autoPlace', () => {
  const rect = (p: Partial<Todo>) => ({ x: p.x!, y: p.y!, w: NOTE_W * p.size!, h: NOTE_H * p.size! });
  const apart = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) =>
    a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;

  it('places new notes without overlapping each other or placed notes', () => {
    const placed = todo('placed', { x: 14, y: 14, size: 1 });
    const fresh = [1, 2, 3, 4, 5].map((n) => todo(`n${n}`, { createdAt: n }));
    const out = autoPlace([placed, ...fresh], 1000);
    const rects = [rect(placed), ...fresh.map((t) => rect(out[t.id]))];
    expect(Object.keys(out)).toHaveLength(5);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(apart(rects[i], rects[j])).toBe(true);
    rects.forEach((r) => expect(r.x + r.w).toBeLessThanOrEqual(1000));
  });

  it('makes notes smaller on a narrow phone board so two fit side by side', () => {
    const out = autoPlace([todo('a'), todo('b')], 380);
    expect(out.a.size).toBeLessThan(1);
    expect(out.a.y).toBe(out.b.y);
  });
});
