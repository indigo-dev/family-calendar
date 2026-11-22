import { useEffect, useRef, useState } from 'react';
import type { CalEvent, CalendarSource, DateRange, Member } from '../types';
import { parseIcs, icsCalendarName } from './ics';
import { demoEvents } from './demo';

export type CalStatus = { state: 'ok' } | { state: 'error'; message: string };

const CACHE_PREFIX = 'fc.events.';
const CACHE_INDEX = 'fc.events.index';
const CACHE_MAX = 8;
/** ICS files are kept in memory this long when only the visible range changes */
const TEXT_TTL_MS = 5 * 60_000;

type Serialized = Omit<CalEvent, 'start' | 'end'> & { start: string; end: string };

function cacheKey(range: DateRange, calendars: CalendarSource[]): string {
  const sig = calendars.map((c) => c.id + ':' + c.memberIds.join(',')).join('|');
  return `${range.start.getTime()}-${range.end.getTime()}-${hash(sig)}`;
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function readCache(key: string): CalEvent[] | null {
  try {
    const s = localStorage.getItem(CACHE_PREFIX + key);
    if (!s) return null;
    return (JSON.parse(s) as Serialized[]).map((e) => ({ ...e, start: new Date(e.start), end: new Date(e.end) }));
  } catch {
    return null;
  }
}

function writeCache(key: string, events: CalEvent[]): void {
  try {
    const idx: string[] = JSON.parse(localStorage.getItem(CACHE_INDEX) ?? '[]');
    const next = [key, ...idx.filter((k) => k !== key)];
    for (const old of next.slice(CACHE_MAX)) localStorage.removeItem(CACHE_PREFIX + old);
    localStorage.setItem(CACHE_INDEX, JSON.stringify(next.slice(0, CACHE_MAX)));
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(events));
  } catch {
    // quota exceeded – caching is best effort
  }
}

/* ------------------------------------------------------------------ fetching */

const textCache = new Map<string, { text: string; at: number }>();

export function normalizeIcsUrl(url: string): string {
  return url.trim().replace(/^webcals?:\/\//i, 'https://');
}

/** Loads an ICS link through the Cloudflare worker (calendar providers don't allow direct browser access). */
export async function fetchIcs(proxyUrl: string, url: string, force = false): Promise<string> {
  const target = normalizeIcsUrl(url);
  const hit = textCache.get(target);
  if (!force && hit && Date.now() - hit.at < TEXT_TTL_MS) return hit.text;
  const base = proxyUrl.trim().replace(/\/+$/, '');
  if (!base) throw new Error('Weiterleitung (Worker-Adresse) fehlt in den Einstellungen.');
  let res: Response;
  try {
    res = await fetch(`${base}/?url=${encodeURIComponent(target)}`, { cache: 'no-store' });
  } catch {
    throw new Error('Weiterleitung nicht erreichbar (offline oder falsche Adresse?)');
  }
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 200) || `Fehler ${res.status}`);
  if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) throw new Error('Der Link liefert keinen Kalender.');
  textCache.set(target, { text, at: Date.now() });
  return text;
}

/** For the settings: checks a link and returns the calendar name and number of upcoming events. */
export async function testCalendarLink(proxyUrl: string, url: string): Promise<{ name?: string; upcoming: number }> {
  const text = await fetchIcs(proxyUrl, url, true);
  const from = new Date();
  const to = new Date(from.getTime() + 60 * 86400000);
  return { name: icsCalendarName(text), upcoming: parseIcs(text, from, to).length };
}

async function fetchCalendar(proxyUrl: string, cal: CalendarSource, range: DateRange, force: boolean): Promise<CalEvent[]> {
  const text = await fetchIcs(proxyUrl, cal.url, force);
  return parseIcs(text, range.start, range.end).map((e) => ({
    key: `${e.uid}|${e.start.getTime()}`,
    title: e.title,
    start: e.start,
    end: e.end.getTime() > e.start.getTime() ? e.end : new Date(e.start.getTime() + (e.allDay ? 86400000 : 15 * 60000)),
    allDay: e.allDay,
    location: e.location,
    notes: e.notes,
    calendarName: cal.name,
    calendarIds: [cal.id],
    memberIds: [...cal.memberIds],
  }));
}

/** Merges the same meeting appearing in several family members' calendars into one event. */
export function merge(lists: CalEvent[][]): CalEvent[] {
  const map = new Map<string, CalEvent>();
  for (const list of lists) {
    for (const e of list) {
      const existing = map.get(e.key);
      if (existing) {
        for (const id of e.memberIds) if (!existing.memberIds.includes(id)) existing.memberIds.push(id);
        if (e.calendarIds) existing.calendarIds = [...new Set([...(existing.calendarIds ?? []), ...e.calendarIds])];
      } else {
        map.set(e.key, { ...e, memberIds: [...e.memberIds], calendarIds: e.calendarIds && [...e.calendarIds] });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
}

/**
 * The cached events of one calendar (used when loading it fails). Matched by calendar id, so a
 * renamed calendar or two calendars with the same name keep their own events; caches written
 * before ids were stored fall back to the name.
 */
export function cachedEventsOf(cached: CalEvent[], cal: CalendarSource): CalEvent[] {
  return cached
    .filter((ev) => (ev.calendarIds ? ev.calendarIds.includes(cal.id) : ev.calendarName === cal.name))
    .map((ev) => ({ ...ev, calendarIds: [cal.id], memberIds: ev.memberIds.filter((m) => cal.memberIds.includes(m)) }))
    .filter((ev) => ev.memberIds.length > 0);
}

export interface EventsState {
  events: CalEvent[];
  loading: boolean;
  /** per calendar id */
  status: Record<string, CalStatus>;
  lastUpdated?: Date;
}

export function useEvents(
  range: DateRange,
  members: Member[],
  calendars: CalendarSource[],
  proxyUrl: string,
  refreshNonce: number,
): EventsState {
  const [state, setState] = useState<EventsState>({ events: [], loading: false, status: {} });
  const runId = useRef(0);
  const lastNonce = useRef(refreshNonce);
  const active = calendars.filter((c) => c.enabled && c.url && c.memberIds.length > 0);
  const key = cacheKey(range, active);
  const sig = JSON.stringify([proxyUrl, active.map((c) => [c.id, c.url, c.name, c.memberIds]), members.map((m) => [m.id, m.demo])]);

  useEffect(() => {
    const id = ++runId.current;
    const force = refreshNonce !== lastNonce.current;
    lastNonce.current = refreshNonce;
    const demo = demoEvents(members, range);
    const cached = readCache(key);
    // show cached events at once while the calendars load
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, events: merge([demo, cached ?? []]), loading: active.length > 0 }));

    if (active.length === 0) {
      setState({ events: merge([demo]), loading: false, status: {}, lastUpdated: new Date() });
      return;
    }

    (async () => {
      const status: Record<string, CalStatus> = {};
      const results = await Promise.all(
        active.map(async (cal) => {
          try {
            const evs = await fetchCalendar(proxyUrl, cal, range, force);
            status[cal.id] = { state: 'ok' };
            return evs;
          } catch (e) {
            status[cal.id] = { state: 'error', message: e instanceof Error ? e.message : String(e) };
            // keep previously cached events of this calendar if the fetch failed
            return cachedEventsOf(cached ?? [], cal);
          }
        }),
      );
      if (id !== runId.current) return;
      const real = merge(results);
      if (Object.values(status).every((s) => s.state === 'ok')) writeCache(key, real);
      setState({ events: merge([demo, real]), loading: false, status, lastUpdated: new Date() });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sig, refreshNonce]);

  return state;
}
