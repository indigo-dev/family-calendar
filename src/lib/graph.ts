import type { CalendarRef } from '../types';

const GRAPH = 'https://graph.microsoft.com/v1.0';

export interface GraphCalendar {
  id: string;
  name: string;
  isDefaultCalendar?: boolean;
  owner?: { name?: string; address?: string };
}

export interface GraphDateTime {
  dateTime: string;
  timeZone: string;
}

export interface GraphEvent {
  id: string;
  iCalUId?: string;
  subject?: string;
  start: GraphDateTime;
  end: GraphDateTime;
  isAllDay: boolean;
  isCancelled?: boolean;
  showAs?: string;
  location?: { displayName?: string };
  bodyPreview?: string;
}

async function graphGet<T>(token: string, pathOrUrl: string, attempt = 0): Promise<T> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : GRAPH + pathOrUrl;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      // Return all times in UTC; converted to local time in the browser.
      Prefer: 'outlook.timezone="UTC"',
    },
  });
  if (res.status === 429 && attempt < 2) {
    const wait = Number(res.headers.get('Retry-After') ?? '2');
    await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000));
    return graphGet<T>(token, pathOrUrl, attempt + 1);
  }
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error?.message ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(`Microsoft Graph ${res.status}${detail ? ': ' + detail : ''}`);
  }
  return res.json() as Promise<T>;
}

async function getAllPages<T>(token: string, first: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = first;
  let guard = 0;
  while (next && guard++ < 50) {
    const page: { value: T[]; '@odata.nextLink'?: string } = await graphGet(token, next);
    out.push(...page.value);
    next = page['@odata.nextLink'];
  }
  return out;
}

export async function listCalendars(token: string): Promise<GraphCalendar[]> {
  return getAllPages<GraphCalendar>(token, '/me/calendars?$select=id,name,isDefaultCalendar,owner&$top=100');
}

export async function calendarView(token: string, cal: CalendarRef, start: Date, end: Date): Promise<GraphEvent[]> {
  const select = 'id,iCalUId,subject,start,end,isAllDay,isCancelled,showAs,location,bodyPreview';
  const q = `startDateTime=${encodeURIComponent(start.toISOString())}&endDateTime=${encodeURIComponent(end.toISOString())}&$select=${select}&$top=250`;
  return getAllPages<GraphEvent>(token, `/me/calendars/${encodeURIComponent(cal.id)}/calendarView?${q}`);
}

/** Parses a Graph dateTime (requested in UTC, delivered without 'Z'). */
export function parseGraphDate(dt: GraphDateTime): Date {
  const s = dt.dateTime;
  const hasZone = /[zZ]|[+-]\d\d:?\d\d$/.test(s);
  return new Date(hasZone ? s : s.replace(/(\.\d{3})\d*$/, '$1') + 'Z');
}

/**
 * All-day events are "floating" dates. Depending on the calendar they arrive as midnight UTC
 * or as midnight in the creator's time zone converted to UTC. Rounding to the nearest local
 * midnight gives the correct day in both cases.
 */
export function roundToLocalMidnight(d: Date): Date {
  const x = new Date(d);
  if (x.getHours() >= 12) x.setDate(x.getDate() + 1);
  x.setHours(0, 0, 0, 0);
  return x;
}
