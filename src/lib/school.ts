import type { Period, SchoolConfig, SchoolType, Subject, Timetable } from '../types';
import { uid } from './id';
import type { Paint } from './colors';

export const SCHOOL_TYPES: Record<SchoolType, string> = {
  grundschule: 'Grundschule',
  gymnasium: 'Gymnasium',
};

/** Mo..Fr */
export const SCHOOL_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];

/**
 * Predefined subjects. Ids are stable (saved in timetables); subjects that exist at both school types share
 * one id and therefore one colour for siblings.
 */
const CATALOG: (Subject & { schools: SchoolType[] })[] = [
  { id: 'de', name: 'Deutsch', short: 'D', color: '#ef4444', schools: ['grundschule', 'gymnasium'] },
  { id: 'ma', name: 'Mathe', short: 'M', color: '#3b82f6', schools: ['grundschule', 'gymnasium'] },
  { id: 'en', name: 'Englisch', short: 'E', color: '#eab308', schools: ['grundschule', 'gymnasium'] },
  { id: 'su', name: 'Sachunterricht', short: 'SU', color: '#14b8a6', schools: ['grundschule'] },
  { id: 'lz', name: 'Lernzeit', short: 'LZ', color: '#94a3b8', schools: ['grundschule'] },
  { id: 'foe', name: 'Förderunterricht', short: 'Fö', color: '#f59e0b', schools: ['grundschule'] },
  { id: 'kr', name: 'Klassenrat', short: 'KR', color: '#c084fc', schools: ['grundschule'] },
  { id: 'fr', name: 'Französisch', short: 'F', color: '#ec4899', schools: ['gymnasium'] },
  { id: 'la', name: 'Latein', short: 'L', color: '#a16207', schools: ['gymnasium'] },
  { id: 'es', name: 'Spanisch', short: 'S', color: '#f97316', schools: ['gymnasium'] },
  { id: 'bi', name: 'Biologie', short: 'Bio', color: '#22c55e', schools: ['gymnasium'] },
  { id: 'ch', name: 'Chemie', short: 'Ch', color: '#84cc16', schools: ['gymnasium'] },
  { id: 'ph', name: 'Physik', short: 'Ph', color: '#6366f1', schools: ['gymnasium'] },
  { id: 'nw', name: 'Naturwissenschaften', short: 'NW', color: '#65a30d', schools: ['gymnasium'] },
  { id: 'ek', name: 'Erdkunde', short: 'Ek', color: '#0ea5e9', schools: ['gymnasium'] },
  { id: 'ge', name: 'Geschichte', short: 'G', color: '#b45309', schools: ['gymnasium'] },
  { id: 'pw', name: 'Politik/Wirtschaft', short: 'PW', color: '#64748b', schools: ['gymnasium'] },
  { id: 'if', name: 'Informatik', short: 'If', color: '#0f766e', schools: ['gymnasium'] },
  { id: 'kl', name: 'Klassenleitung', short: 'KL', color: '#c084fc', schools: ['gymnasium'] },
  { id: 'ku', name: 'Kunst', short: 'Ku', color: '#a855f7', schools: ['grundschule', 'gymnasium'] },
  { id: 'mu', name: 'Musik', short: 'Mu', color: '#d946ef', schools: ['grundschule', 'gymnasium'] },
  { id: 'sp', name: 'Sport', short: 'Sp', color: '#16a34a', schools: ['grundschule', 'gymnasium'] },
  { id: 'sw', name: 'Schwimmen', short: 'Sw', color: '#06b6d4', schools: ['grundschule', 'gymnasium'] },
  { id: 're', name: 'Religion', short: 'Rel', color: '#92400e', schools: ['grundschule', 'gymnasium'] },
  { id: 'et', name: 'Ethik / Philosophie', short: 'Eth', color: '#78716c', schools: ['grundschule', 'gymnasium'] },
  { id: 'ag', name: 'AG', short: 'AG', color: '#fb7185', schools: ['grundschule', 'gymnasium'] },
];

export const SUBJECT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#16a34a', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#a855f7', '#d946ef', '#ec4899', '#fb7185',
  '#a16207', '#92400e', '#78716c', '#64748b',
];

export const DEFAULT_SCHOOL: SchoolConfig = { colors: {}, custom: [] };

/** 8:00 start, 45 min lessons, 5 min change, big breaks after the 2nd and 4th lesson, lunch after the 6th. */
export const DEFAULT_PERIODS: Period[] = [
  { start: '08:00', end: '08:45' },
  { start: '08:50', end: '09:35' },
  { start: '09:55', end: '10:40' },
  { start: '10:45', end: '11:30' },
  { start: '11:45', end: '12:30' },
  { start: '12:35', end: '13:20' },
  { start: '14:00', end: '14:45' },
  { start: '14:50', end: '15:35' },
];

export function newTimetable(schoolType: SchoolType): Timetable {
  return {
    schoolType,
    periods: DEFAULT_PERIODS.map((p) => ({ ...p })),
    cells: SCHOOL_DAYS.map(() => DEFAULT_PERIODS.map(() => null)),
  };
}

export function newSubject(name: string, color: string): Subject {
  const n = name.trim();
  return { id: 'c-' + uid(), name: n, short: n.slice(0, 3), color };
}

/** All subjects with the family's colours applied (as stored), lookup by id. */
function rawSubjectMap(school: SchoolConfig): Map<string, Subject> {
  const map = new Map<string, Subject>();
  for (const s of CATALOG) map.set(s.id, { id: s.id, name: s.name, short: s.short, color: school.colors[s.id] ?? s.color });
  for (const s of school.custom) map.set(s.id, s);
  return map;
}

/** All subjects for display: colours mapped to the chosen palette, lookup by id. Cheap – no memo needed. */
export function subjectMap(school: SchoolConfig, paint: Paint): Map<string, Subject> {
  const map = rawSubjectMap(school);
  for (const [id, s] of map) map.set(id, { ...s, color: paint(s.color) });
  return map;
}

/** Subjects offered for a school type: predefined ones of that type, then the family's own subjects. */
export function subjectsFor(type: SchoolType, school: SchoolConfig, paint: Paint): Subject[] {
  const map = subjectMap(school, paint);
  return [...CATALOG.filter((s) => s.schools.includes(type)).map((s) => map.get(s.id)!), ...school.custom.map((s) => map.get(s.id)!)];
}

/** Predefined subjects grouped by school type (for the settings). */
export function catalogGroups(school: SchoolConfig): { label: string; subjects: Subject[] }[] {
  const map = rawSubjectMap(school);
  const both = CATALOG.filter((s) => s.schools.length > 1);
  const only = (t: SchoolType) => CATALOG.filter((s) => s.schools.length === 1 && s.schools[0] === t);
  return [
    { label: 'Beide Schularten', subjects: both.map((s) => map.get(s.id)!) },
    { label: 'Nur Grundschule', subjects: only('grundschule').map((s) => map.get(s.id)!) },
    { label: 'Nur Gymnasium', subjects: only('gymnasium').map((s) => map.get(s.id)!) },
  ];
}

export function catalogColor(id: string): string | undefined {
  return CATALOG.find((s) => s.id === id)?.color;
}

/** Start of the first and end of the last lesson on a weekday (0 = Mo), null on a day without lessons. */
export function schoolHours(t: Timetable, day: number): Period | null {
  const row = t.cells[day] ?? [];
  const first = row.findIndex((c) => c);
  if (first < 0) return null;
  const last = row.length - 1 - [...row].reverse().findIndex((c) => c);
  const start = t.periods[first]?.start;
  const end = t.periods[last]?.end;
  return start && end ? { start, end } : null;
}

export function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Bring a timetable into shape (5 days, one cell per lesson). */
export function normalizeTimetable(t: Timetable): Timetable {
  const n = t.periods.length;
  return {
    ...t,
    cells: SCHOOL_DAYS.map((_, d) => Array.from({ length: n }, (_, p) => t.cells[d]?.[p] ?? null)),
  };
}

const TIME = /^\d{2}:\d{2}$/;

export function parseTimetable(raw: unknown): Timetable | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const schoolType: SchoolType = o.schoolType === 'gymnasium' ? 'gymnasium' : 'grundschule';
  const periods = (Array.isArray(o.periods) ? o.periods : [])
    .filter((p): p is Period => !!p && TIME.test((p as Period).start) && TIME.test((p as Period).end))
    .map((p) => ({ start: p.start, end: p.end }));
  const cells = (Array.isArray(o.cells) ? o.cells : []).map((day) =>
    (Array.isArray(day) ? day : []).map((c) => (typeof c === 'string' ? c : null)),
  );
  return normalizeTimetable({ schoolType, periods: periods.length ? periods : DEFAULT_PERIODS.map((p) => ({ ...p })), cells });
}

export function parseSchool(raw: unknown): SchoolConfig {
  if (!raw || typeof raw !== 'object') return { colors: {}, custom: [] };
  const o = raw as Record<string, unknown>;
  const colors: Record<string, string> = {};
  if (o.colors && typeof o.colors === 'object') {
    for (const [k, v] of Object.entries(o.colors)) if (typeof v === 'string') colors[k] = v;
  }
  const custom = (Array.isArray(o.custom) ? o.custom : [])
    .filter((s): s is Subject => !!s && typeof s.id === 'string' && typeof s.name === 'string')
    .map((s) => ({ id: s.id, name: s.name, short: typeof s.short === 'string' ? s.short : s.name.slice(0, 3), color: s.color || '#64748b' }));
  return { colors, custom };
}
