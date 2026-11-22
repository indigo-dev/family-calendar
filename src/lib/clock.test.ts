import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** the clock's visibilitychange listener */
let wake: () => void = () => {};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 22, 10, 0, 30));
  // the tests run in node: the clock only needs timers and the visibility event
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: (_type: string, l: () => void) => (wake = l),
    removeEventListener: () => {},
  });
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('clock', () => {
  it('ticks exactly when the minute changes, not on a fixed interval', async () => {
    const { onMinute } = await import('./clock');
    const fn = vi.fn();
    const off = onMinute(fn);
    vi.advanceTimersByTime(29_000); // 10:00:59
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_100); // just after 10:01:00
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    vi.advanceTimersByTime(120_000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('catches up at once when the page becomes visible after sleep', async () => {
    const { onMinute } = await import('./clock');
    const fn = vi.fn();
    onMinute(fn);
    // timers did not run while the iPad slept; an hour later the page is shown again
    vi.setSystemTime(new Date(2026, 10, 22, 11, 0, 10));
    wake();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
