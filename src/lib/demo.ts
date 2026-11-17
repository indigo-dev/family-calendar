import type { CalEvent, DateRange, Member } from '../types';
import { addDays, dayKey, startOfDay } from './dates';

/** Deterministic pseudo random number in [0,1) from a string seed. */
function rand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

type Tpl = { title: string; h: number; m?: number; dur: number; days: number[]; p?: number; location?: string };

const PROFILES: Tpl[][] = [
  [
    { title: 'Team-Meeting', h: 9, dur: 60, days: [1, 3], location: 'Teams' },
    { title: 'Kundentermin', h: 14, dur: 90, days: [2, 4], p: 0.6, location: 'Büro' },
    { title: 'Laufen', h: 19, dur: 45, days: [2, 5], p: 0.7 },
    { title: 'Zahnarzt', h: 16, m: 30, dur: 30, days: [4], p: 0.25 },
  ],
  [
    { title: 'Yoga', h: 18, m: 30, dur: 75, days: [1, 4], location: 'Studio Mitte' },
    { title: 'Projekt-Review', h: 10, dur: 60, days: [2, 3, 5], p: 0.6 },
    { title: 'Elternabend', h: 19, m: 30, dur: 90, days: [3], p: 0.3, location: 'Grundschule' },
    { title: 'Mittag mit Sarah', h: 12, m: 30, dur: 60, days: [5], p: 0.5 },
  ],
  [
    { title: 'Schwimmen', h: 16, dur: 60, days: [2, 4], location: 'Hallenbad' },
    { title: 'Klavier', h: 15, dur: 45, days: [1], location: 'Musikschule' },
    { title: 'Geburtstag Mia', h: 14, m: 30, dur: 150, days: [6], p: 0.35 },
    { title: 'Mathe-Nachhilfe', h: 17, dur: 60, days: [3], p: 0.7 },
  ],
  [
    { title: 'Fußball-Training', h: 16, m: 30, dur: 90, days: [1, 3], location: 'Sportplatz' },
    { title: 'Spieltag', h: 10, dur: 120, days: [6], p: 0.6, location: 'Auswärts' },
    { title: 'Kinderarzt', h: 9, m: 30, dur: 45, days: [2], p: 0.15 },
    { title: 'Spielen bei Ben', h: 15, dur: 120, days: [5], p: 0.5 },
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
      for (const t of PROFILES[idx % PROFILES.length]) {
        if (!t.days.includes(dow)) continue;
        if (t.p !== undefined && rand(m.id + key + t.title) > t.p) continue;
        const start = new Date(d);
        start.setHours(t.h, t.m ?? 0, 0, 0);
        out.push({
          key: `demo-${m.id}-${key}-${t.title}`,
          title: t.title,
          start,
          end: new Date(start.getTime() + t.dur * 60000),
          allDay: false,
          location: t.location,
          calendarName: 'Demo',
          memberIds: [m.id],
        });
      }
      // school / daycare for kids on weekdays
      if (idx >= 2 && dow >= 1 && dow <= 5 && idx < 4) {
        const start = new Date(d);
        start.setHours(idx === 2 ? 8 : 8, idx === 2 ? 0 : 30, 0, 0);
        out.push({
          key: `demo-${m.id}-${key}-school`,
          title: idx === 2 ? 'Schule' : 'Kita',
          start,
          end: new Date(start.getTime() + (idx === 2 ? 6 * 60 : 6.5 * 60) * 60000),
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
        title: 'Familienessen bei Oma',
        start,
        end: new Date(start.getTime() + 150 * 60000),
        allDay: false,
        location: 'Oma & Opa',
        calendarName: 'Demo',
        memberIds: allIds,
      });
    }
    if (d.getDate() === 12 || (d.getDate() === 24 && d.getMonth() % 2 === 0)) {
      out.push({
        key: `demo-allday-${key}`,
        title: d.getDate() === 12 ? 'Müllabfuhr (Papier)' : 'Geburtstag Onkel Tom 🎂',
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
        title: 'Klassenfahrt',
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
