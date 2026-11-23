import type { DateRange, ViewMode } from '../types';
import { getLanguage, locale, t } from '../i18n';

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
/** Date formatter of the active language (cached per locale and options). */
export function dateFormat(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const k = locale() + JSON.stringify(opts);
  let f = fmtCache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat(locale(), opts);
    fmtCache.set(k, f);
  }
  return f;
}

export function fmt(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return dateFormat(opts).format(d);
}

/** true if the active locale uses a 12-hour clock (en-US) */
export const uses12h = (): boolean => !!dateFormat({ hour: 'numeric' }).resolvedOptions().hour12;

/** '14:05', or '2:05 PM' on a 12-hour clock */
export const fmtTime = (d: Date) => fmt(d, uses12h() ? { hour: 'numeric', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' });

/** Short label for a time of day without a date: '08:00' / '14:30', on a 12-hour clock '8 AM' / '2:30 PM'. */
export function fmtClock(h: number, m = 0): string {
  const d = new Date(2000, 0, 1, h, m);
  if (!uses12h()) return `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return fmt(d, m ? { hour: 'numeric', minute: '2-digit' } : { hour: 'numeric' });
}

/** A stored 'HH:MM' time (bell times, ...) in the active clock format */
export function fmtHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return uses12h() ? fmtClock(h || 0, m || 0) : hhmm;
}

/** Hour label of an hourly forecast: '14', on a 12-hour clock '2 PM' */
export const hourLabel = (h: number): string => (uses12h() ? fmtClock(h) : String(h).padStart(2, '0'));

/** Full hour for a setting: '7:00 Uhr', '7:00', '7 AM' */
export const fmtHour = (h: number): string => (uses12h() ? fmtClock(h) : t('common.oClock', { time: `${h}:00` }));

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

export function rangeFor(view: ViewMode, date: Date, weekStartsOn: 0 | 1, nDays = 3): DateRange {
  switch (view) {
    case 'day': {
      const s = startOfDay(date);
      return { start: s, end: addDays(s, 1) };
    }
    case 'days': {
      const s = startOfDay(date);
      return { start: s, end: addDays(s, nDays) };
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

export function stepDate(view: ViewMode, date: Date, dir: 1 | -1, nDays = 3): Date {
  switch (view) {
    case 'day':
      return addDays(date, dir);
    case 'days':
      return addDays(date, nDays * dir);
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

function spanTitle(s: Date, e: Date): string {
  // English: the locale's own range format ("23–29 Nov 2026", "Nov 23 – 29, 2026")
  if (getLanguage() !== 'de') return dateFormat({ day: 'numeric', month: 'short', year: 'numeric' }).formatRange(s, e);
  const sameMonth = s.getMonth() === e.getMonth();
  const left = sameMonth ? fmt(s, { day: 'numeric' }) + '.' : fmt(s, { day: 'numeric', month: 'short' });
  return `${left} – ${fmt(e, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function titleFor(view: ViewMode, date: Date, weekStartsOn: 0 | 1, nDays = 3): string {
  switch (view) {
    case 'day':
      return fmt(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    case 'days':
      return spanTitle(date, addDays(date, nDays - 1));
    case 'week': {
      const s = startOfWeek(date, weekStartsOn);
      return t('calendar.weekTitle', { week: isoWeek(s), span: spanTitle(s, addDays(s, 6)) });
    }
    case 'month':
      return fmt(date, { month: 'long', year: 'numeric' });
    case 'year':
      return String(date.getFullYear());
    case 'agenda': {
      const e = addDays(startOfDay(date), AGENDA_DAYS - 1);
      if (getLanguage() !== 'de') return dateFormat({ day: 'numeric', month: 'short', year: 'numeric' }).formatRange(date, e);
      return `${fmt(date, { day: 'numeric', month: 'short' })} – ${fmt(e, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
  }
}
