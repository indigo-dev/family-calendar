import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeStorage } from '../test/fakeStorage';

// the layout is a persisted module store – load it fresh for every test
async function load(stored?: unknown) {
  vi.stubGlobal('localStorage', fakeStorage());
  if (stored !== undefined) localStorage.setItem('fc.dashboard', JSON.stringify(stored));
  vi.resetModules();
  return import('./dashboard');
}
const layoutOf = () => JSON.parse(localStorage.getItem('fc.dashboard')!) as { id: string; type: string; size: string }[];

beforeEach(() => vi.unstubAllGlobals());

describe('dashboard layout', () => {
  it('drops unknown widgets and sizes a widget does not support', async () => {
    const d = await load([
      { id: 'a', type: 'clock', size: 's' },
      { id: 'b', type: 'gone', size: 's' },
      { id: 'c', type: 'clock', size: 'xl' },
    ]);
    d.addWidget('todos', 't');
    expect(
      layoutOf()
        .map((w) => w.id)
        .slice(0, 1),
    ).toEqual(['a']);
    expect(layoutOf().map((w) => w.type)).toEqual(['clock', 'todos']);
  });

  it('moves, resizes and removes widgets', async () => {
    const d = await load([
      { id: 'a', type: 'clock', size: 's' },
      { id: 'b', type: 'weather', size: 'm' },
      { id: 'c', type: 'todos', size: 't' },
    ]);
    d.moveWidget('c', 'a');
    expect(layoutOf().map((w) => w.id)).toEqual(['c', 'a', 'b']);
    d.resizeWidget('b', 'l');
    expect(layoutOf().find((w) => w.id === 'b')?.size).toBe('l');
    d.removeWidget('a');
    expect(layoutOf().map((w) => w.id)).toEqual(['c', 'b']);
  });

  it('starts with the default layout on a new device', async () => {
    const d = await load();
    d.resetLayout();
    expect(layoutOf().length).toBeGreaterThan(5);
    expect(layoutOf()[0].type).toBe('clock');
  });
});
