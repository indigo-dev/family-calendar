import { useEffect, useMemo, useState } from 'react';
import type { DateRange, DayMarks, HolidaySettings } from '../types';
import { addDays, dayKey } from './dates';
import { isRecord, storage } from './persisted';

/**
 * Public and school holidays of the German federal states from the OpenHolidays API
 * (https://www.openholidaysapi.org, data licence ODbL). Loaded per year and kept on the device.
 */

const API = 'https://openholidaysapi.org';
const CACHE_PREFIX = 'fc.hol.';
const MAX_AGE_MS = 14 * 86400000;
const NO_HOLIDAYS: Holiday[] = [];

export interface Holiday {
  id: string;
  /** yyyy-mm-dd */
  start: string;
  /** yyyy-mm-dd, inclusive */
  end: string;
  name: string;
  type: 'public' | 'school';
}

interface ApiHoliday {
  id?: string;
  startDate?: string;
  endDate?: string;
  name?: { language?: string; text?: string }[];
  nationwide?: boolean;
  subdivisions?: { code?: string }[];
}

function toHoliday(h: ApiHoliday, type: Holiday['type'], region: string): Holiday | null {
  if (!h.startDate || !h.endDate) return null;
  const name = h.name?.find((n) => n.language === 'DE')?.text ?? h.name?.[0]?.text ?? (type === 'school' ? 'Ferien' : 'Feiertag');
  // holidays only valid in parts of the state (e.g. Friedensfest in Augsburg)
  const partial = !h.nationwide && !!h.subdivisions?.length && !h.subdivisions.some((s) => s.code === region);
  return {
    id: h.id ?? `${type}-${h.startDate}-${name}`,
    start: h.startDate.slice(0, 10),
    end: h.endDate.slice(0, 10),
    name: partial ? `${name} (regional)` : name,
    type,
  };
}

async function loadYear(region: string, year: number): Promise<Holiday[]> {
  const key = `${CACHE_PREFIX}${region}.${year}`;
  const raw = storage.read(key);
  const cached = isRecord(raw) && typeof raw.at === 'number' && Array.isArray(raw.list) ? (raw as { at: number; list: Holiday[] }) : null;
  if (cached && Date.now() - cached.at < MAX_AGE_MS) return cached.list;

  try {
    const q = `countryIsoCode=DE&subdivisionCode=${encodeURIComponent(region)}&languageIsoCode=DE&validFrom=${year}-01-01&validTo=${year}-12-31`;
    const get = async (path: string): Promise<ApiHoliday[]> => {
      const res = await fetch(`${API}/${path}?${q}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`OpenHolidays ${res.status}`);
      return res.json();
    };
    const [pub, school] = await Promise.all([get('PublicHolidays'), get('SchoolHolidays')]);
    const list = [...pub.map((h) => toHoliday(h, 'public', region)), ...school.map((h) => toHoliday(h, 'school', region))].filter(
      (h): h is Holiday => !!h,
    );
    storage.write(key, { at: Date.now(), list }); // best effort
    return list;
  } catch (e) {
    // offline: an outdated copy is better than nothing
    if (cached) return cached.list;
    throw e;
  }
}

/** All holidays of the given years (deduplicated – school holidays around new year appear in both years). */
export async function loadHolidays(region: string, years: number[]): Promise<Holiday[]> {
  const lists = await Promise.all(years.map((y) => loadYear(region, y)));
  const map = new Map<string, Holiday>();
  for (const h of lists.flat()) map.set(h.id, h);
  return [...map.values()].sort((a, b) => a.start.localeCompare(b.start));
}

function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** dayKey → names of public/school holidays on that day, for the visible range. */
export function useHolidayMarks(range: DateRange, settings: HolidaySettings): { marks: Map<string, DayMarks>; error?: string } {
  const { region, showPublic, showSchool } = settings;
  const enabled = !!region && (showPublic || showSchool);
  const y0 = range.start.getFullYear();
  const y1 = new Date(range.end.getTime() - 1).getFullYear();
  const [state, setState] = useState<{ list: Holiday[]; error?: string }>({ list: [] });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const years = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i);
    loadHolidays(region, years)
      .then((list) => alive && setState({ list }))
      .catch((e) => alive && setState({ list: [], error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [enabled, region, y0, y1]);

  const list = enabled ? state.list : NO_HOLIDAYS;
  const marks = useMemo(() => {
    const map = new Map<string, DayMarks>();
    for (const h of list) {
      if (h.type === 'public' ? !showPublic : !showSchool) continue;
      const end = parseDay(h.end);
      for (let d = parseDay(h.start); d <= end; d = addDays(d, 1)) {
        if (d < addDays(range.start, -1) || d > range.end) continue;
        const k = dayKey(d);
        const m = map.get(k) ?? { publicNames: [], schoolNames: [] };
        (h.type === 'public' ? m.publicNames : m.schoolNames).push(h.name);
        map.set(k, m);
      }
    }
    return map;
  }, [list, showPublic, showSchool, range.start, range.end]);

  return { marks, error: enabled ? state.error : undefined };
}
