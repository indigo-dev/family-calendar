/**
 * Minimal iCalendar (RFC 5545) reader for subscription links (Google, Outlook.com, Microsoft 365, iCloud).
 * Handles line folding, time zones (IANA + Windows names), all-day events, DURATION,
 * recurrence rules (DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY,
 * BYMONTH, BYSETPOS, WKST), EXDATE, RDATE, moved/cancelled single occurrences (RECURRENCE-ID).
 */

export interface IcsEvent {
  uid: string;
  title: string;
  start: Date;
  /** exclusive end */
  end: Date;
  allDay: boolean;
  location?: string;
  notes?: string;
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

type Comp = { type: string; props: Prop[]; children: Comp[] };

/* ------------------------------------------------------------------ lexing */

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function parseLine(line: string): Prop | null {
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ':' && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts: string[] = [];
  let cur = '';
  inQuote = false;
  for (const c of head) {
    if (c === '"') inQuote = !inQuote;
    if (c === ';' && !inQuote) {
      parts.push(cur);
      cur = '';
    } else cur += c;
  }
  parts.push(cur);
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: parts[0].toUpperCase(), params, value };
}

function parseTree(text: string): Comp {
  const root: Comp = { type: 'ROOT', props: [], children: [] };
  const stack: Comp[] = [root];
  for (const line of unfold(text)) {
    if (!line.trim()) continue;
    const p = parseLine(line);
    if (!p) continue;
    const top = stack[stack.length - 1];
    if (p.name === 'BEGIN') {
      const c: Comp = { type: p.value.trim().toUpperCase(), props: [], children: [] };
      top.children.push(c);
      stack.push(c);
    } else if (p.name === 'END') {
      if (stack.length > 1) stack.pop();
    } else top.props.push(p);
  }
  return root;
}

function unescapeText(s: string): string {
  return s.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

/* ------------------------------------------------------------------ time zones */

const WINDOWS_ZONES: Record<string, string> = {
  'W. Europe Standard Time': 'Europe/Berlin',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'Romance Standard Time': 'Europe/Paris',
  'GMT Standard Time': 'Europe/London',
  'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'GTB Standard Time': 'Europe/Bucharest',
  'FLE Standard Time': 'Europe/Kiev',
  'E. Europe Standard Time': 'Europe/Chisinau',
  'Turkey Standard Time': 'Europe/Istanbul',
  'Russian Standard Time': 'Europe/Moscow',
  'Israel Standard Time': 'Asia/Jerusalem',
  'Arabian Standard Time': 'Asia/Dubai',
  'India Standard Time': 'Asia/Kolkata',
  'China Standard Time': 'Asia/Shanghai',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Atlantic Standard Time': 'America/Halifax',
  'UTC': 'UTC',
  'Coordinated Universal Time': 'UTC',
};

const tzCache = new Map<string, string | null>();

function isIana(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** IANA zone name for a TZID, or null = device local time. */
export function resolveTz(tzid: string | undefined): string | null {
  if (!tzid) return null;
  const cached = tzCache.get(tzid);
  if (cached !== undefined) return cached;
  const id = tzid.trim().replace(/^"|"$/g, '');
  // e.g. "/mozilla.org/20050126_1/Europe/Berlin" or "/Europe/Berlin"
  const tail = id.match(/([A-Za-z]+\/[A-Za-z_+-]+(?:\/[A-Za-z_+-]+)?)$/);
  let res: string | null = null;
  if (isIana(id)) res = id;
  else if (tail && isIana(tail[1])) res = tail[1];
  else if (WINDOWS_ZONES[id]) res = WINDOWS_ZONES[id];
  else if (/Berlin|Amsterdam|Vienna|Wien|Rome|Stockholm|Bern/i.test(id)) res = 'Europe/Berlin';
  else if (/Brussels|Copenhagen|Madrid|Paris/i.test(id)) res = 'Europe/Paris';
  else if (/^\(UTC\)|^UTC$|^GMT$|^Z$/i.test(id)) res = 'UTC';
  tzCache.set(tzid, res);
  return res;
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();

/** Offset (ms) of the zone at the given UTC instant: local wall clock - UTC. */
function tzOffset(utcMs: number, tz: string): number {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dtfCache.set(tz, f);
  }
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(new Date(utcMs))) if (part.type !== 'literal') p[part.type] = Number(part.value);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/* ------------------------------------------------------------------ date values */

/**
 * "Naive" wall-clock time: the wall clock fields stored as if they were UTC. All recurrence
 * arithmetic happens on these so daylight-saving switches don't shift events.
 */
type Naive = number;

/** How naive values are turned into real instants. */
type Zone = { kind: 'utc' } | { kind: 'tz'; tz: string } | { kind: 'local' } | { kind: 'date' };

interface DT {
  naive: Naive;
  zone: Zone;
}

function parseDT(value: string, params: Record<string, string>): DT | null {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  const naive = Date.UTC(+y, +mo - 1, +d, h ? +h : 0, mi ? +mi : 0, s ? +s : 0);
  if (!h || params.VALUE === 'DATE') return { naive, zone: { kind: 'date' } };
  if (z) return { naive, zone: { kind: 'utc' } };
  const tz = resolveTz(params.TZID);
  return { naive, zone: tz ? (tz === 'UTC' ? { kind: 'utc' } : { kind: 'tz', tz }) : { kind: 'local' } };
}

function toReal(naive: Naive, zone: Zone): Date {
  switch (zone.kind) {
    case 'utc':
      return new Date(naive);
    case 'tz': {
      let t = naive - tzOffset(naive, zone.tz);
      const o2 = tzOffset(t, zone.tz);
      t = naive - o2;
      return new Date(t);
    }
    default: {
      const d = new Date(naive);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
    }
  }
}

function dateKeyOf(naive: Naive): string {
  return new Date(naive).toISOString().slice(0, 10);
}

/** Duration like P1D, PT1H30M, -P1W → ms. */
function parseDuration(v: string): number | null {
  const m = v.trim().match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const [, sign, w, d, h, mi, s] = m;
  const ms = ((+(w ?? 0) * 7 + +(d ?? 0)) * 86400 + +(h ?? 0) * 3600 + +(mi ?? 0) * 60 + +(s ?? 0)) * 1000;
  return sign === '-' ? -ms : ms;
}

/* ------------------------------------------------------------------ recurrence */

const WD: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const DAY = 86400000;

interface Rule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count?: number;
  until?: DT;
  byDay: { n: number; wd: number }[];
  byMonthDay: number[];
  byMonth: number[];
  bySetPos: number[];
  wkst: number;
}

function parseRule(v: string): Rule | null {
  const parts: Record<string, string> = {};
  for (const kv of v.split(';')) {
    const [k, val] = kv.split('=');
    if (k && val !== undefined) parts[k.toUpperCase()] = val;
  }
  const freq = parts.FREQ as Rule['freq'];
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null;
  const ints = (s?: string) => (s ? s.split(',').map(Number).filter((n) => Number.isFinite(n) && n !== 0) : []);
  return {
    freq,
    interval: Math.max(1, Number(parts.INTERVAL) || 1),
    count: parts.COUNT ? Number(parts.COUNT) : undefined,
    until: parts.UNTIL ? parseDT(parts.UNTIL, {}) ?? undefined : undefined,
    byDay: (parts.BYDAY ?? '')
      .split(',')
      .map((s) => s.trim().toUpperCase().match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => ({ n: m[1] ? Number(m[1]) : 0, wd: WD[m[2]] })),
    byMonthDay: ints(parts.BYMONTHDAY),
    byMonth: ints(parts.BYMONTH),
    bySetPos: ints(parts.BYSETPOS),
    wkst: WD[(parts.WKST ?? 'MO').toUpperCase()] ?? 1,
  };
}

function ymd(n: Naive) {
  const d = new Date(n);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay() };
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

/** Candidate days (naive midnight) of one month for MONTHLY/YEARLY rules. */
function monthDays(y: number, m: number, rule: Rule, startDay: number): Naive[] {
  const dim = daysInMonth(y, m);
  const all = Array.from({ length: dim }, (_, i) => Date.UTC(y, m, i + 1));
  const hasDay = rule.byDay.length > 0;
  const hasMd = rule.byMonthDay.length > 0;
  if (!hasDay && !hasMd) return startDay <= dim ? [Date.UTC(y, m, startDay)] : [];
  return all.filter((n) => {
    const { d, wd } = ymd(n);
    if (hasMd && !rule.byMonthDay.some((md) => (md > 0 ? md === d : dim + md + 1 === d))) return false;
    if (hasDay) {
      return rule.byDay.some((bd) => {
        if (bd.wd !== wd) return false;
        if (!bd.n) return true;
        const nth = Math.floor((d - 1) / 7) + 1;
        const nthFromEnd = Math.floor((dim - d) / 7) + 1;
        return bd.n > 0 ? bd.n === nth : -bd.n === nthFromEnd;
      });
    }
    return true;
  });
}

function applySetPos(list: Naive[], pos: number[]): Naive[] {
  if (pos.length === 0) return list;
  const out: Naive[] = [];
  for (const p of pos) {
    const v = p > 0 ? list[p - 1] : list[list.length + p];
    if (v !== undefined) out.push(v);
  }
  return out.sort((a, b) => a - b);
}

/** Candidate start days (naive midnight) of period k. */
function periodDays(rule: Rule, start: Naive, k: number): Naive[] {
  const s = ymd(start);
  const startMidnight = Date.UTC(s.y, s.m, s.d);
  switch (rule.freq) {
    case 'DAILY': {
      const day = startMidnight + k * rule.interval * DAY;
      const { m, d, wd } = ymd(day);
      if (rule.byMonth.length && !rule.byMonth.includes(m + 1)) return [];
      if (rule.byMonthDay.length && !rule.byMonthDay.includes(d)) return [];
      if (rule.byDay.length && !rule.byDay.some((b) => b.wd === wd)) return [];
      return [day];
    }
    case 'WEEKLY': {
      const weekStart = startMidnight - ((s.wd - rule.wkst + 7) % 7) * DAY + k * rule.interval * 7 * DAY;
      const wds = rule.byDay.length ? rule.byDay.map((b) => b.wd) : [s.wd];
      const out = wds
        .map((wd) => weekStart + ((wd - rule.wkst + 7) % 7) * DAY)
        .filter((n) => !rule.byMonth.length || rule.byMonth.includes(ymd(n).m + 1))
        .sort((a, b) => a - b);
      return applySetPos(out, rule.bySetPos);
    }
    case 'MONTHLY': {
      const total = s.m + k * rule.interval;
      const y = s.y + Math.floor(total / 12);
      const m = ((total % 12) + 12) % 12;
      if (rule.byMonth.length && !rule.byMonth.includes(m + 1)) return [];
      return applySetPos(monthDays(y, m, rule, s.d), rule.bySetPos);
    }
    case 'YEARLY': {
      const y = s.y + k * rule.interval;
      const months = rule.byMonth.length ? rule.byMonth.map((m) => m - 1) : [s.m];
      const days = months.sort((a, b) => a - b).flatMap((m) => {
        // plain yearly on a date: same day, skip invalid (29 Feb)
        if (!rule.byDay.length && !rule.byMonthDay.length) return s.d <= daysInMonth(y, m) ? [Date.UTC(y, m, s.d)] : [];
        return monthDays(y, m, rule, s.d);
      });
      return applySetPos(days, rule.bySetPos);
    }
  }
}

/* ------------------------------------------------------------------ events */

interface RawEvent {
  uid: string;
  start: DT;
  durationMs: number;
  /** all-day events: whole days */
  durationDays: number;
  allDay: boolean;
  title: string;
  location?: string;
  notes?: string;
  cancelled: boolean;
  rrule?: Rule;
  exdates: Set<string>;
  rdates: DT[];
  recurrenceId?: DT;
}

function occKey(dt: DT): string {
  return dt.zone.kind === 'date' ? 'D' + dateKeyOf(dt.naive) : 'T' + toReal(dt.naive, dt.zone).getTime();
}

function readEvent(c: Comp): RawEvent | null {
  const get = (n: string) => c.props.find((p) => p.name === n);
  const startP = get('DTSTART');
  if (!startP) return null;
  const start = parseDT(startP.value, startP.params);
  if (!start) return null;
  const allDay = start.zone.kind === 'date';

  let durationMs = 0;
  let durationDays = 1;
  const endP = get('DTEND');
  const durP = get('DURATION');
  const end = endP ? parseDT(endP.value, endP.params) : null;
  if (end) {
    if (allDay) durationDays = Math.max(1, Math.round((end.naive - start.naive) / DAY));
    else durationMs = Math.max(0, toReal(end.naive, end.zone).getTime() - toReal(start.naive, start.zone).getTime());
  } else if (durP) {
    const ms = parseDuration(durP.value) ?? 0;
    if (allDay) durationDays = Math.max(1, Math.round(ms / DAY));
    else durationMs = Math.max(0, ms);
  }

  const exdates = new Set<string>();
  for (const p of c.props.filter((x) => x.name === 'EXDATE')) {
    for (const v of p.value.split(',')) {
      const dt = parseDT(v, p.params);
      if (!dt) continue;
      exdates.add(occKey(dt));
    }
  }
  const rdates: DT[] = [];
  for (const p of c.props.filter((x) => x.name === 'RDATE' && x.params.VALUE !== 'PERIOD')) {
    for (const v of p.value.split(',')) {
      const dt = parseDT(v, p.params);
      if (dt) rdates.push(dt);
    }
  }
  const rr = get('RRULE');
  const ridP = get('RECURRENCE-ID');
  const text = (n: string) => {
    const p = get(n);
    return p ? unescapeText(p.value).trim() || undefined : undefined;
  };
  return {
    uid: get('UID')?.value.trim() || `${start.naive}-${text('SUMMARY') ?? ''}`,
    start,
    durationMs,
    durationDays,
    allDay,
    title: text('SUMMARY') ?? '(Ohne Titel)',
    location: text('LOCATION'),
    notes: text('DESCRIPTION'),
    cancelled: (get('STATUS')?.value ?? '').trim().toUpperCase() === 'CANCELLED',
    rrule: rr ? parseRule(rr.value) ?? undefined : undefined,
    exdates,
    rdates,
    recurrenceId: ridP ? parseDT(ridP.value, ridP.params) ?? undefined : undefined,
  };
}

function instance(ev: RawEvent, naive: Naive): IcsEvent {
  let start: Date;
  let end: Date;
  if (ev.allDay) {
    const s = ymd(naive);
    start = new Date(s.y, s.m, s.d);
    end = new Date(s.y, s.m, s.d + ev.durationDays);
  } else {
    start = toReal(naive, ev.start.zone);
    end = new Date(start.getTime() + ev.durationMs);
  }
  return { uid: ev.uid, title: ev.title, start, end, allDay: ev.allDay, location: ev.location, notes: ev.notes };
}

function overlaps(e: IcsEvent, from: Date, to: Date): boolean {
  const end = e.end.getTime() > e.start.getTime() ? e.end : new Date(e.start.getTime() + 1);
  return e.start < to && end > from;
}

const MAX_PERIODS = 50000;

function expand(ev: RawEvent, from: Date, to: Date, overridden: Set<string>, out: IcsEvent[]): void {
  const keyOf = (naive: Naive): string => occKey({ naive, zone: ev.start.zone });
  const isExcluded = (naive: Naive) => {
    const k = keyOf(naive);
    // date-only EXDATEs can also cancel occurrences of timed series
    return ev.exdates.has(k) || overridden.has(k) || ev.exdates.has('D' + dateKeyOf(naive));
  };
  const fromMs = from.getTime();
  const spanMs = ev.allDay ? ev.durationDays * DAY : ev.durationMs;
  const emit = (naive: Naive) => {
    // naive and real time differ by less than a day: cheap pre-filter before the time zone math
    if (naive + spanMs + 2 * DAY < fromMs) return;
    if (isExcluded(naive)) return;
    const inst = instance(ev, naive);
    if (overlaps(inst, from, to)) out.push(inst);
  };

  const rule = ev.rrule;
  const seen = new Set<Naive>();
  if (!rule) {
    emit(ev.start.naive);
  } else {
    const s0 = ymd(ev.start.naive);
    const timeOfDay = ev.start.naive - Date.UTC(s0.y, s0.m, s0.d);
    const untilMs = rule.until
      ? rule.until.zone.kind === 'date'
        ? toReal(rule.until.naive + DAY - 1000, ev.allDay ? { kind: 'local' } : ev.start.zone).getTime()
        : toReal(rule.until.naive, rule.until.zone).getTime()
      : Infinity;
    const toMs = to.getTime();
    let count = 0;
    // DTSTART is always the first occurrence
    seen.add(ev.start.naive);
    count++;
    emit(ev.start.naive);
    // without COUNT, periods long before the visible range can be skipped
    const k0 = rule.count === undefined ? firstUsefulPeriod(rule, ev.start.naive, fromMs - spanMs - 2 * DAY) : 0;
    outer: for (let k = k0; k < k0 + MAX_PERIODS; k++) {
      const days = periodDays(rule, ev.start.naive, k);
      for (const day of days) {
        const naive = day + timeOfDay;
        if (naive < ev.start.naive || seen.has(naive)) continue;
        const near = (b: number) => Math.abs(naive - b) < 2 * DAY;
        const real =
          near(fromMs) || near(toMs) || near(untilMs)
            ? ev.allDay
              ? instance(ev, naive).start.getTime()
              : toReal(naive, ev.start.zone).getTime()
            : naive;
        if (real > untilMs) break outer;
        if (rule.count !== undefined && count >= rule.count) break outer;
        if (real >= toMs) break outer;
        seen.add(naive);
        count++;
        emit(naive);
      }
      // a period window entirely past the range end stops the loop even without hits
      if (days.length === 0 && periodStart(rule, ev.start.naive, k) > toMs + 400 * DAY) break;
    }
  }
  for (const r of ev.rdates) if (!seen.has(r.naive)) emit(r.naive);
}

function firstUsefulPeriod(rule: Rule, start: Naive, fromMs: number): number {
  if (fromMs <= start) return 0;
  const a = ymd(start);
  const b = ymd(fromMs);
  let units: number;
  switch (rule.freq) {
    case 'DAILY':
      units = Math.floor((fromMs - start) / DAY);
      break;
    case 'WEEKLY':
      units = Math.floor((fromMs - start) / (7 * DAY));
      break;
    case 'MONTHLY':
      units = (b.y - a.y) * 12 + (b.m - a.m);
      break;
    case 'YEARLY':
      units = b.y - a.y;
      break;
  }
  return Math.max(0, Math.floor(units / rule.interval) - 1);
}

function periodStart(rule: Rule, start: Naive, k: number): number {
  const factor = { DAILY: 1, WEEKLY: 7, MONTHLY: 28, YEARLY: 365 }[rule.freq];
  return start + k * rule.interval * factor * DAY;
}

/** Parses an ICS file and returns all event instances overlapping [from, to). */
export function parseIcs(text: string, from: Date, to: Date): IcsEvent[] {
  const root = parseTree(text);
  const cal = root.children.find((c) => c.type === 'VCALENDAR') ?? root;
  const raw = cal.children.filter((c) => c.type === 'VEVENT').map(readEvent).filter((e): e is RawEvent => !!e);

  // moved / cancelled single occurrences of a series
  const overrides = new Map<string, Set<string>>();
  for (const e of raw) {
    if (!e.recurrenceId) continue;
    const set = overrides.get(e.uid) ?? new Set<string>();
    set.add(occKey(e.recurrenceId));
    set.add('D' + dateKeyOf(e.recurrenceId.naive));
    overrides.set(e.uid, set);
  }

  const out: IcsEvent[] = [];
  for (const e of raw) {
    if (e.recurrenceId) {
      if (!e.cancelled) {
        const inst = instance(e, e.start.naive);
        if (overlaps(inst, from, to)) out.push(inst);
      }
      continue;
    }
    if (e.cancelled) continue;
    const ov = overrides.get(e.uid) ?? new Set<string>();
    // only the exact-instant keys matter for timed series; date keys for all-day series
    const relevant = new Set([...ov].filter((k) => (e.allDay ? k.startsWith('D') : k.startsWith('T'))));
    expand(e, from, to, relevant, out);
  }
  return out;
}

/** Name of the calendar inside the file (X-WR-CALNAME), if present. */
export function icsCalendarName(text: string): string | undefined {
  const m = text.match(/^X-WR-CALNAME(?:;[^:\r\n]*)?:(.*)$/m);
  return m ? unescapeText(m[1]).trim() || undefined : undefined;
}
