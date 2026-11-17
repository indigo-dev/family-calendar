import type { DateRange, ViewMode } from '../types';

export const LOCALE = 'de-DE';

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  x.setDate(Math.min(d.getDate(), daysInMonth(x)));
  return x;
}

export function addYears(d: Date, n: number): Date {
  return addMonths(d, n * 12);
}

export function startOfWeek(d: Date, weekStartsOn: 0 | 1): Date {
  const x = startOfDay(d);
  const diff = (x.getDay() - weekStartsOn + 7) % 7;
  return addDays(x, -diff);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
export function fmt(d: Date, opts: Intl.DateTimeFormatOptions): string {
  const k = JSON.stringify(opts);
  let f = fmtCache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, opts);
    fmtCache.set(k, f);
  }
  return f.format(d);
}

export const fmtTime = (d: Date) => fmt(d, { hour: '2-digit', minute: '2-digit' });

/** Weekday names starting at weekStartsOn, e.g. ['Mo','Di',...] */
export function weekdayNames(weekStartsOn: 0 | 1, style: 'short' | 'narrow' | 'long' = 'short'): string[] {
  const base = startOfWeek(new Date(2024, 0, 10), weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => fmt(addDays(base, i), { weekday: style }).replace('.', ''));
}

/** Overlap test with exclusive ends. */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export const AGENDA_DAYS = 28;

export function rangeFor(view: ViewMode, date: Date, weekStartsOn: 0 | 1): DateRange {
  switch (view) {
    case 'day': {
      const s = startOfDay(date);
      return { start: s, end: addDays(s, 1) };
    }
    case 'week': {
      const s = startOfWeek(date, weekStartsOn);
      return { start: s, end: addDays(s, 7) };
    }
    case 'month': {
      const s = startOfWeek(startOfMonth(date), weekStartsOn);
      return { start: s, end: addDays(s, 42) };
    }
    case 'year': {
      const s = startOfYear(date);
      return { start: s, end: new Date(s.getFullYear() + 1, 0, 1) };
    }
    case 'agenda': {
      const s = startOfDay(date);
      return { start: s, end: addDays(s, AGENDA_DAYS) };
    }
  }
}

export function stepDate(view: ViewMode, date: Date, dir: 1 | -1): Date {
  switch (view) {
    case 'day':
      return addDays(date, dir);
    case 'week':
      return addDays(date, 7 * dir);
    case 'month':
      return addMonths(date, dir);
    case 'year':
      return addYears(date, dir);
    case 'agenda':
      return addDays(date, AGENDA_DAYS * dir);
  }
}

export function titleFor(view: ViewMode, date: Date, weekStartsOn: 0 | 1): string {
  switch (view) {
    case 'day':
      return fmt(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    case 'week': {
      const s = startOfWeek(date, weekStartsOn);
      const e = addDays(s, 6);
      const sameMonth = s.getMonth() === e.getMonth();
      const left = sameMonth ? fmt(s, { day: 'numeric' }) + '.' : fmt(s, { day: 'numeric', month: 'short' });
      return `KW ${isoWeek(s)} · ${left} – ${fmt(e, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    case 'month':
      return fmt(date, { month: 'long', year: 'numeric' });
    case 'year':
      return String(date.getFullYear());
    case 'agenda': {
      const e = addDays(startOfDay(date), AGENDA_DAYS - 1);
      return `${fmt(date, { day: 'numeric', month: 'short' })} – ${fmt(e, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
  }
}
