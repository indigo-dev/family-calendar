import { useEffect, useRef, useState } from 'react';
import type { CalEvent, DateRange, Member } from '../types';
import { AuthRequiredError, getToken, isAuthConfigured } from './auth';
import { calendarView, parseGraphDate, roundToLocalMidnight } from './graph';
import { demoEvents } from './demo';

export type MemberStatus = { state: 'ok' } | { state: 'auth' ; message: string } | { state: 'error'; message: string };

const CACHE_PREFIX = 'fc.events.';
const CACHE_INDEX = 'fc.events.index';
const CACHE_MAX = 8;

type Serialized = Omit<CalEvent, 'start' | 'end'> & { start: string; end: string };

function cacheKey(range: DateRange, members: Member[]): string {
  const sig = members
    .filter((m) => m.source === 'outlook' && m.account)
    .map((m) => m.id + ':' + m.calendars.map((c) => c.id.slice(-8)).join(','))
    .join('|');
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

async function fetchMember(m: Member, range: DateRange): Promise<CalEvent[]> {
  if (!m.account || m.calendars.length === 0) return [];
  const token = await getToken(m.account);
  const lists = await Promise.all(m.calendars.map((cal) => calendarView(token, cal, range.start, range.end).then((evs) => ({ cal, evs }))));
  const out: CalEvent[] = [];
  for (const { cal, evs } of lists) {
    for (const g of evs) {
      if (g.isCancelled) continue;
      let start = parseGraphDate(g.start);
      let end = parseGraphDate(g.end);
      if (g.isAllDay) {
        start = roundToLocalMidnight(start);
        end = roundToLocalMidnight(end);
        if (end <= start) end = new Date(start.getTime() + 86400000);
      }
      out.push({
        key: `${g.iCalUId ?? g.id}|${start.getTime()}`,
        title: g.subject?.trim() || '(Ohne Titel)',
        start,
        end,
        allDay: g.isAllDay,
        location: g.location?.displayName || undefined,
        notes: g.bodyPreview || undefined,
        calendarName: cal.name,
        memberIds: [m.id],
      });
    }
  }
  return out;
}

/** Merges the same meeting appearing in several family members' calendars into one event. */
function merge(lists: CalEvent[][]): CalEvent[] {
  const map = new Map<string, CalEvent>();
  for (const list of lists) {
    for (const e of list) {
      const existing = map.get(e.key);
      if (existing) {
        for (const id of e.memberIds) if (!existing.memberIds.includes(id)) existing.memberIds.push(id);
      } else {
        map.set(e.key, { ...e, memberIds: [...e.memberIds] });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
}

export interface EventsState {
  events: CalEvent[];
  loading: boolean;
  status: Record<string, MemberStatus>;
  lastUpdated?: Date;
}

export function useEvents(range: DateRange, members: Member[], refreshNonce: number): EventsState {
  const [state, setState] = useState<EventsState>({ events: [], loading: false, status: {} });
  const runId = useRef(0);
  const key = cacheKey(range, members);
  const membersSig = JSON.stringify(members.map((m) => [m.id, m.source, m.account?.homeAccountId, m.calendars.map((c) => c.id)]));

  useEffect(() => {
    const id = ++runId.current;
    const demo = demoEvents(members, range);
    const cached = readCache(key);
    setState((s) => ({ ...s, events: merge([demo, cached ?? []]), loading: true }));

    const outlook = members.filter((m) => m.source === 'outlook' && m.account && m.calendars.length > 0);
    if (outlook.length === 0 || !isAuthConfigured()) {
      const status: Record<string, MemberStatus> = {};
      for (const m of members) {
        if (m.source === 'outlook' && m.account && !isAuthConfigured()) {
          status[m.id] = { state: 'auth', message: 'Client-ID fehlt' };
        }
      }
      setState({ events: merge([demo]), loading: false, status, lastUpdated: new Date() });
      return;
    }

    (async () => {
      const status: Record<string, MemberStatus> = {};
      const results = await Promise.all(
        outlook.map(async (m) => {
          try {
            const evs = await fetchMember(m, range);
            status[m.id] = { state: 'ok' };
            return evs;
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            status[m.id] = e instanceof AuthRequiredError ? { state: 'auth', message } : { state: 'error', message };
            // keep previously cached events of this member if the fetch failed
            return (cached ?? []).filter((ev) => ev.memberIds.includes(m.id));
          }
        }),
      );
      if (id !== runId.current) return;
      const real = merge(results);
      if (Object.values(status).every((s) => s.state === 'ok')) writeCache(key, real);
      setState({ events: merge([demo, real]), loading: false, status, lastUpdated: new Date() });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, membersSig, refreshNonce]);

  return state;
}
