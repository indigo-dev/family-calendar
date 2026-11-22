import { describe, expect, it } from 'vitest';
import type { CalEvent, CalendarSource } from '../types';
import { cachedEventsOf, merge } from './events';

const cal = (id: string, name: string, memberIds: string[]): CalendarSource => ({ id, name, url: 'https://x/' + id, memberIds, enabled: true });
const ev = (key: string, calendarId: string, name: string, memberIds: string[]): CalEvent => ({
  key,
  title: key,
  start: new Date('2026-05-04T08:00:00Z'),
  end: new Date('2026-05-04T09:00:00Z'),
  allDay: false,
  calendarName: name,
  calendarIds: [calendarId],
  memberIds,
});

describe('merge', () => {
  it('joins the same event of several calendars and keeps all calendar ids', () => {
    const [e] = merge([[ev('a', 'c1', 'Papa', ['papa'])], [ev('a', 'c2', 'Mama', ['mama'])]]);
    expect(e.memberIds).toEqual(['papa', 'mama']);
    expect(e.calendarIds).toEqual(['c1', 'c2']);
  });
});

describe('cachedEventsOf', () => {
  it('finds the events of a renamed calendar by its id', () => {
    const cached = [ev('a', 'c1', 'Arbeit', ['papa'])];
    expect(cachedEventsOf(cached, cal('c1', 'Büro', ['papa']))).toHaveLength(1);
  });

  it('keeps calendars with the same name apart', () => {
    const cached = [ev('a', 'c1', 'Schule', ['lena']), ev('b', 'c2', 'Schule', ['max'])];
    expect(cachedEventsOf(cached, cal('c2', 'Schule', ['max'])).map((e) => e.key)).toEqual(['b']);
  });

  it('returns shared events with only the people of this calendar', () => {
    const [shared] = merge([[ev('a', 'c1', 'Papa', ['papa'])], [ev('a', 'c2', 'Mama', ['mama'])]]);
    const [e] = cachedEventsOf([shared], cal('c2', 'Mama', ['mama']));
    expect(e.memberIds).toEqual(['mama']);
    expect(e.calendarIds).toEqual(['c2']);
  });

  it('falls back to the name for caches written before calendar ids were stored', () => {
    const old: CalEvent = { ...ev('a', 'c1', 'Arbeit', ['papa']), calendarIds: undefined };
    expect(cachedEventsOf([old], cal('c1', 'Arbeit', ['papa']))).toHaveLength(1);
    expect(cachedEventsOf([old], cal('c1', 'Büro', ['papa']))).toHaveLength(0);
  });
});
