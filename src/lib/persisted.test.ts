import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeStorage } from '../test/fakeStorage';
import { arrayOf, isString, numberIn, oneOf, persisted, storage } from './persisted';

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal('localStorage', fakeStorage());
});

const parseList = (raw: unknown) => arrayOf(raw, isString);

describe('persisted', () => {
  it('reads lazily, validates and falls back to the defaults', () => {
    localStorage.setItem('k', JSON.stringify(['a', 1, 'b']));
    const s = persisted('k', parseList);
    expect(s.get()).toEqual(['a', 'b']);
    expect(persisted('missing', parseList).get()).toEqual([]);
  });

  it('survives broken JSON', () => {
    localStorage.setItem('k', '{nope');
    expect(persisted('k', parseList).get()).toEqual([]);
  });

  it('writes on set and notifies subscribers once per change', () => {
    const s = persisted('k', parseList);
    const l = vi.fn();
    const off = s.subscribe(l);
    s.set((cur) => [...cur, 'x']);
    expect(JSON.parse(localStorage.getItem('k')!)).toEqual(['x']);
    expect(l).toHaveBeenCalledTimes(1);
    const same = s.get();
    s.set(same);
    expect(l).toHaveBeenCalledTimes(1);
    off();
    s.set(['y']);
    expect(l).toHaveBeenCalledTimes(1);
  });

  it('keeps working in memory when storage is full', () => {
    vi.stubGlobal('localStorage', {
      ...fakeStorage(),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    const s = persisted('k', parseList);
    s.set(['a']);
    expect(s.get()).toEqual(['a']);
  });

  it('reload picks up changes from another tab', () => {
    const s = persisted('k', parseList);
    expect(s.get()).toEqual([]);
    localStorage.setItem('k', JSON.stringify(['from other tab']));
    const l = vi.fn();
    s.subscribe(l);
    s.reload();
    expect(s.get()).toEqual(['from other tab']);
    expect(l).toHaveBeenCalled();
  });
});

describe('other tabs', () => {
  const fire = (key: string) => window.dispatchEvent(Object.assign(new Event('storage'), { key }));

  it('follows changes of other tabs, unless syncTabs is off', () => {
    vi.stubGlobal('window', new EventTarget());
    const shared = persisted('shared', parseList);
    const local = persisted('local', parseList, { syncTabs: false });
    shared.subscribe(() => {});
    local.subscribe(() => {});
    expect([shared.get(), local.get()]).toEqual([[], []]);
    localStorage.setItem('shared', JSON.stringify(['x']));
    localStorage.setItem('local', JSON.stringify(['x']));
    fire('shared');
    fire('local');
    expect(shared.get()).toEqual(['x']);
    expect(local.get()).toEqual([]);
  });
});

describe('storage', () => {
  it('returns undefined instead of throwing', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(storage.read('k')).toBeUndefined();
    expect(storage.write('k', 1)).toBe(false);
    expect(storage.keys()).toEqual([]);
  });
});

describe('parsers', () => {
  it('oneOf and numberIn', () => {
    expect(oneOf('b', ['a', 'b'] as const, 'a')).toBe('b');
    expect(oneOf('x', ['a', 'b'] as const, 'a')).toBe('a');
    expect(numberIn(5, 0, 10, 1)).toBe(5);
    expect(numberIn(50, 0, 10, 1)).toBe(1);
    expect(numberIn('5', 0, 10, 1)).toBe(1);
  });
});
