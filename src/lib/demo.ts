import type { CalEvent, DateRange, Member } from '../types';
import { addDays, dayKey, startOfDay } from './dates';
import { minutes, schoolHours } from './school';
import { t, type Messages } from '../i18n';

type Title = keyof Messages['demo']['titles'];
type Place = keyof Messages['demo']['places'];

/** Deterministic pseudo random number in [0,1) from a string seed. */
function rand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** sample event; title and place are looked up in the active language */
type Tpl = { id: Title; h: number; m?: number; dur: number; days: number[]; p?: number; location?: Place };

const PROFILES: Tpl[][] = [
  [
    { id: 'meeting', h: 9, dur: 60, days: [1, 3], location: 'meetingLoc' },
    { id: 'client', h: 14, dur: 90, days: [2, 4], p: 0.6, location: 'office' },
    { id: 'run', h: 19, dur: 45, days: [2, 5], p: 0.7 },
    { id: 'dentist', h: 16, m: 30, dur: 30, days: [4], p: 0.25 },
  ],
  [
    { id: 'yoga', h: 18, m: 30, dur: 75, days: [1, 4], location: 'studio' },
    { id: 'review', h: 10, dur: 60, days: [2, 3, 5], p: 0.6 },
    { id: 'parentsEvening', h: 19, m: 30, dur: 90, days: [3], p: 0.3, location: 'primarySchool' },
    { id: 'lunch', h: 12, m: 30, dur: 60, days: [5], p: 0.5 },
  ],
  [
    { id: 'swimming', h: 16, dur: 60, days: [2, 4], location: 'pool' },
    { id: 'piano', h: 15, dur: 45, days: [1], location: 'musicSchool' },
    { id: 'birthdayMia', h: 14, m: 30, dur: 150, days: [6], p: 0.35 },
    { id: 'tutoring', h: 17, dur: 60, days: [3], p: 0.7 },
  ],
  [
    { id: 'football', h: 16, m: 30, dur: 90, days: [1, 3], location: 'pitch' },
    { id: 'match', h: 10, dur: 120, days: [6], p: 0.6, location: 'away' },
    { id: 'paediatrician', h: 9, m: 30, dur: 45, days: [2], p: 0.15 },
    { id: 'playdate', h: 15, dur: 120, days: [5], p: 0.5 },
  ],
];

export function demoEvents(members: Member[], range: DateRange): CalEvent[] {
  const demo = members.filter((m) => m.demo);
  if (demo.length === 0) return [];
  const out: CalEvent[] = [];
  const allIds = demo.map((m) => m.id);
  for (let d = startOfDay(range.start); d < range.end; d = addDays(d, 1)) {
    const key = dayKey(d);
    const dow = d.getDay();
    demo.forEach((m, idx) => {
      for (const tpl of PROFILES[idx % PROFILES.length]) {
        if (!tpl.days.includes(dow)) continue;
        if (tpl.p !== undefined && rand(m.id + key + tpl.id) > tpl.p) continue;
        const start = new Date(d);
        start.setHours(tpl.h, tpl.m ?? 0, 0, 0);
        out.push({
          key: `demo-${m.id}-${key}-${tpl.id}`,
          title: t(`demo.titles.${tpl.id}`),
          start,
          end: new Date(start.getTime() + tpl.dur * 60000),
          allDay: false,
          location: tpl.location && t(`demo.places.${tpl.location}`),
          calendarName: 'Demo',
          memberIds: [m.id],
        });
      }
      // school (from the timetable, if the kid has one) / daycare on weekdays
      const hours = m.timetable ? schoolHours(m.timetable, dow - 1) : null;
      if (idx >= 2 && idx < 4 && dow >= 1 && dow <= 5 && (!m.timetable || hours)) {
        const from = hours ? minutes(hours.start) : idx === 2 ? 8 * 60 : 8 * 60 + 30;
        const to = hours ? minutes(hours.end) : from + (idx === 2 ? 6 : 6.5) * 60;
        const start = new Date(d);
        start.setHours(0, from, 0, 0);
        out.push({
          key: `demo-${m.id}-${key}-school`,
          title: t(m.timetable || idx === 2 ? 'demo.titles.school' : 'demo.titles.daycare'),
          start,
          end: new Date(start.getTime() + (to - from) * 60000),
          allDay: false,
          calendarName: 'Demo',
          memberIds: [m.id],
        });
      }
    });
    // family events shared by everyone
    if (dow === 0) {
      const start = new Date(d);
      start.setHours(12, 30, 0, 0);
      out.push({
        key: `demo-family-${key}`,
        title: t('demo.titles.familyLunch'),
        start,
        end: new Date(start.getTime() + 150 * 60000),
        allDay: false,
        location: t('demo.places.grandparents'),
        calendarName: 'Demo',
        memberIds: allIds,
      });
    }
    if (d.getDate() === 12 || (d.getDate() === 24 && d.getMonth() % 2 === 0)) {
      out.push({
        key: `demo-allday-${key}`,
        title: t(d.getDate() === 12 ? 'demo.titles.bins' : 'demo.titles.birthdayTom'),
        start: new Date(d),
        end: addDays(d, 1),
        allDay: true,
        calendarName: 'Demo',
        memberIds: d.getDate() === 12 ? [allIds[0]] : allIds.slice(0, 2),
      });
    }
    if (d.getDate() === 3 && demo.length > 2) {
      out.push({
        key: `demo-trip-${key}`,
        title: t('demo.titles.classTrip'),
        start: new Date(d),
        end: addDays(d, 3),
        allDay: true,
        calendarName: 'Demo',
        memberIds: [allIds[2]],
      });
    }
  }
  return out;
}
