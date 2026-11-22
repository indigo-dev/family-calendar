import { useSyncExternalStore } from 'react';
import { startOfDay } from './dates';

/**
 * One clock for the whole app. It ticks exactly when the minute changes (and when the page becomes
 * visible again after sleep), so a clock on screen is never behind. Components subscribe to the
 * granularity they need: `useMinute()` re-renders once a minute, `useToday()` only at midnight.
 */

let minute = floorMinute(Date.now());
let today = startOfDay(new Date(minute));
const minuteListeners = new Set<() => void>();
const dayListeners = new Set<() => void>();
let timer: number | undefined;

function floorMinute(ms: number): Date {
  return new Date(ms - (ms % 60_000));
}

function tick() {
  const next = floorMinute(Date.now());
  if (next.getTime() !== minute.getTime()) {
    minute = next;
    minuteListeners.forEach((l) => l());
    const day = startOfDay(next);
    if (day.getTime() !== today.getTime()) {
      today = day;
      dayListeners.forEach((l) => l());
    }
  }
  schedule();
}

/** next tick right after the minute changes */
function schedule() {
  window.clearTimeout(timer);
  timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
}

const onVisible = () => document.visibilityState === 'visible' && tick();

function subscribe(set: Set<() => void>) {
  return (listener: () => void) => {
    if (minuteListeners.size + dayListeners.size === 0) {
      tick();
      document.addEventListener('visibilitychange', onVisible);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
      if (minuteListeners.size + dayListeners.size === 0) {
        window.clearTimeout(timer);
        document.removeEventListener('visibilitychange', onVisible);
      }
    };
  };
}

const subscribeMinute = subscribe(minuteListeners);
const subscribeDay = subscribe(dayListeners);

/** The current time, floored to the minute; re-renders when the minute changes. */
export function useMinute(): Date {
  return useSyncExternalStore(subscribeMinute, () => minute);
}

/** Midnight of today; re-renders only when the day changes. */
export function useToday(): Date {
  return useSyncExternalStore(subscribeDay, () => today);
}

/** Runs `fn` on every minute tick without re-rendering anything (e.g. idle checks). */
export function onMinute(fn: () => void): () => void {
  return subscribeMinute(fn);
}
