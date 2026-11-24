import type { ViewMode } from '../types';

/*
 * Lets other parts of the app (the voice control) switch the calendar's view and date. The calendar keeps
 * both as its own state; a request waits here until the calendar is on screen and picks it up.
 */

export interface CalendarRequest {
  view?: ViewMode;
  date?: Date;
}

let pending: CalendarRequest | null = null;
const listeners = new Set<(r: CalendarRequest) => void>();

function deliver() {
  if (!pending || !listeners.size) return;
  const r = pending;
  pending = null;
  listeners.forEach((fn) => fn(r));
}

export function requestCalendar(r: CalendarRequest) {
  if (!r.view && !r.date) return;
  pending = r;
  deliver();
}

/** The calendar listens here; a request made before it was mounted arrives right away. */
export function onCalendarRequest(fn: (r: CalendarRequest) => void): () => void {
  listeners.add(fn);
  deliver();
  return () => listeners.delete(fn);
}
