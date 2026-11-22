import { describe, expect, it } from 'vitest';
import { demoMembers, parseConfig } from './config';
import { demoEvents } from './demo';
import { newTimetable, schoolHours, subjectsFor } from './school';
import { colorScheme, painter } from './colors';

describe('schoolHours', () => {
  it('spans the first to the last lesson, free lessons in between included', () => {
    const t = newTimetable('grundschule');
    t.cells[0][1] = 'de';
    t.cells[0][4] = 'ma';
    expect(schoolHours(t, 0)).toEqual({ start: '08:50', end: '12:30' });
  });

  it('is null on a day without lessons', () => {
    expect(schoolHours(newTimetable('gymnasium'), 2)).toBeNull();
  });
});

describe('demo family', () => {
  const members = demoMembers();
  const [, , lena, max] = members;

  it('has a timetable for both kids that survives export and import', () => {
    expect(lena.timetable?.schoolType).toBe('gymnasium');
    expect(max.timetable?.schoolType).toBe('grundschule');
    const back = parseConfig({ schemaVersion: 3, members, calendars: [], settings: {} });
    expect(back.members[2].timetable).toEqual(lena.timetable);
    expect(back.members[3].timetable).toEqual(max.timetable);
  });

  it('only uses subjects of the matching school type', () => {
    const paint = painter(colorScheme('vivid', '#4f6d9a'));
    for (const kid of [lena, max]) {
      const t = kid.timetable!;
      const allowed = new Set(subjectsFor(t.schoolType, { colors: {}, custom: [] }, paint).map((s) => s.id));
      t.cells.flat().forEach((id) => id && expect(allowed).toContain(id));
    }
  });

  it('puts the school day from the timetable into the calendar', () => {
    // Thursday 2026-11-19: Lena has eight lessons, Max five
    const day = { start: new Date(2026, 10, 19), end: new Date(2026, 10, 20) };
    const school = demoEvents(members, day).filter((e) => e.title === 'Schule');
    const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const of = (id: string) => school.find((e) => e.memberIds[0] === id)!;
    expect([hhmm(of(lena.id).start), hhmm(of(lena.id).end)]).toEqual(['08:00', '15:35']);
    expect([hhmm(of(max.id).start), hhmm(of(max.id).end)]).toEqual(['08:00', '12:30']);
  });
});
