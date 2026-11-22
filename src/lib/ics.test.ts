import { describe, expect, it } from 'vitest';
import { icsCalendarName, parseIcs, resolveTz } from './ics';

/** Wraps VEVENT bodies into a calendar file with CRLF line endings, like the providers send it. */
function ics(...events: string[][]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-CALNAME:Familie'];
  for (const e of events) lines.push('BEGIN:VEVENT', ...e, 'END:VEVENT');
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

const range = (from: string, to: string) => [new Date(from), new Date(to)] as const;
/** local wall clock of the test zone (Europe/Berlin) */
const local = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ` +
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

describe('single events', () => {
  it('reads a UTC event with title, location and notes', () => {
    const text = ics([
      'UID:a',
      'DTSTART:20260115T090000Z',
      'DTEND:20260115T100000Z',
      'SUMMARY:Zahnarzt',
      'LOCATION:Praxis\\, 1. Stock',
      'DESCRIPTION:Zeile 1\\nZeile 2',
    ]);
    const [e] = parseIcs(text, ...range('2026-01-01', '2026-02-01'));
    expect(e.title).toBe('Zahnarzt');
    expect(e.location).toBe('Praxis, 1. Stock');
    expect(e.notes).toBe('Zeile 1\nZeile 2');
    expect(e.start.toISOString()).toBe('2026-01-15T09:00:00.000Z');
    expect(e.end.toISOString()).toBe('2026-01-15T10:00:00.000Z');
    expect(e.allDay).toBe(false);
  });

  it('unfolds long lines', () => {
    const text = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:a', 'DTSTART:20260115T090000Z', 'SUMMARY:Elternab', ' end', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    expect(parseIcs(text, ...range('2026-01-01', '2026-02-01'))[0].title).toBe('Elternabend');
  });

  it('converts a TZID to the real instant', () => {
    const text = ics(['UID:a', 'DTSTART;TZID=America/New_York:20260701T090000', 'DURATION:PT30M', 'SUMMARY:Call']);
    const [e] = parseIcs(text, ...range('2026-07-01', '2026-07-02'));
    expect(e.start.toISOString()).toBe('2026-07-01T13:00:00.000Z');
    expect(e.end.getTime() - e.start.getTime()).toBe(30 * 60_000);
  });

  it('understands Windows time zone names (Outlook)', () => {
    expect(resolveTz('W. Europe Standard Time')).toBe('Europe/Berlin');
    const text = ics(['UID:a', 'DTSTART;TZID="W. Europe Standard Time":20260115T100000', 'SUMMARY:Outlook']);
    expect(local(parseIcs(text, ...range('2026-01-01', '2026-02-01'))[0].start)).toBe('2026-01-15 10:00');
  });

  it('treats all-day events as local days with an exclusive end', () => {
    const text = ics(['UID:a', 'DTSTART;VALUE=DATE:20261224', 'DTEND;VALUE=DATE:20261227', 'SUMMARY:Weihnachten']);
    const [e] = parseIcs(text, ...range('2026-12-01', '2027-01-01'));
    expect(e.allDay).toBe(true);
    expect(local(e.start)).toBe('2026-12-24 00:00');
    expect(local(e.end)).toBe('2026-12-27 00:00');
  });

  it('keeps events that started before the range but still run', () => {
    const text = ics(['UID:a', 'DTSTART;VALUE=DATE:20260128', 'DTEND;VALUE=DATE:20260203', 'SUMMARY:Urlaub']);
    expect(parseIcs(text, ...range('2026-02-01', '2026-03-01'))).toHaveLength(1);
    expect(parseIcs(text, ...range('2026-02-03', '2026-03-01'))).toHaveLength(0);
  });

  it('skips cancelled events', () => {
    const text = ics(['UID:a', 'DTSTART:20260115T090000Z', 'STATUS:CANCELLED', 'SUMMARY:Fällt aus']);
    expect(parseIcs(text, ...range('2026-01-01', '2026-02-01'))).toHaveLength(0);
  });
});

describe('recurring events', () => {
  it('keeps the wall clock time across the daylight saving switch', () => {
    const text = ics(['UID:a', 'DTSTART;TZID=Europe/Berlin:20260316T100000', 'RRULE:FREQ=WEEKLY;COUNT=4', 'SUMMARY:Turnen']);
    const evs = parseIcs(text, ...range('2026-03-01', '2026-05-01'));
    expect(evs.map((e) => local(e.start))).toEqual(['2026-03-16 10:00', '2026-03-23 10:00', '2026-03-30 10:00', '2026-04-06 10:00']);
    // CET before 29 March, CEST after
    expect(evs[1].start.toISOString()).toBe('2026-03-23T09:00:00.000Z');
    expect(evs[2].start.toISOString()).toBe('2026-03-30T08:00:00.000Z');
  });

  it('expands BYDAY with UNTIL', () => {
    const text = ics([
      'UID:a',
      'DTSTART;TZID=Europe/Berlin:20260504T093000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20260520T215959Z',
      'SUMMARY:Schwimmen',
    ]);
    const evs = parseIcs(text, ...range('2026-05-01', '2026-06-30'));
    expect(evs.map((e) => local(e.start).slice(0, 10))).toEqual([
      '2026-05-04',
      '2026-05-06',
      '2026-05-11',
      '2026-05-13',
      '2026-05-18',
      '2026-05-20',
    ]);
  });

  it('applies EXDATE and moved occurrences (RECURRENCE-ID)', () => {
    const text = ics(
      [
        'UID:s',
        'DTSTART;TZID=Europe/Berlin:20260504T080000',
        'DTEND;TZID=Europe/Berlin:20260504T090000',
        'RRULE:FREQ=DAILY;COUNT=5',
        'EXDATE;TZID=Europe/Berlin:20260505T080000',
        'SUMMARY:Frühdienst',
      ],
      [
        'UID:s',
        'RECURRENCE-ID;TZID=Europe/Berlin:20260506T080000',
        'DTSTART;TZID=Europe/Berlin:20260506T120000',
        'DTEND;TZID=Europe/Berlin:20260506T130000',
        'SUMMARY:Frühdienst (verschoben)',
      ],
    );
    const evs = parseIcs(text, ...range('2026-05-01', '2026-06-01')).sort((a, b) => a.start.getTime() - b.start.getTime());
    expect(evs.map((e) => local(e.start))).toEqual(['2026-05-04 08:00', '2026-05-06 12:00', '2026-05-07 08:00', '2026-05-08 08:00']);
    expect(evs[1].title).toBe('Frühdienst (verschoben)');
  });

  it('finds the last Friday of the month (BYDAY=-1FR)', () => {
    const text = ics(['UID:a', 'DTSTART:20260130T170000Z', 'RRULE:FREQ=MONTHLY;BYDAY=-1FR;COUNT=3', 'SUMMARY:Stammtisch']);
    const evs = parseIcs(text, ...range('2026-01-01', '2026-12-31'));
    expect(evs.map((e) => e.start.toISOString().slice(0, 10))).toEqual(['2026-01-30', '2026-02-27', '2026-03-27']);
  });

  it('picks the last working day with BYSETPOS', () => {
    const text = ics([
      'UID:a',
      'DTSTART:20260130T170000Z',
      'RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;COUNT=3',
      'SUMMARY:Monatsabschluss',
    ]);
    const evs = parseIcs(text, ...range('2026-01-01', '2026-12-31'));
    expect(evs.map((e) => e.start.toISOString().slice(0, 10))).toEqual(['2026-01-30', '2026-02-27', '2026-03-31']);
  });

  it('skips 29 February in non-leap years', () => {
    const text = ics(['UID:a', 'DTSTART;VALUE=DATE:20240229', 'RRULE:FREQ=YEARLY', 'SUMMARY:Schalttag']);
    const evs = parseIcs(text, ...range('2024-01-01', '2029-01-01'));
    expect(evs.map((e) => local(e.start).slice(0, 10))).toEqual(['2024-02-29', '2028-02-29']);
  });

  it('only returns occurrences inside the range of a long-running series', () => {
    const text = ics(['UID:a', 'DTSTART;TZID=Europe/Berlin:20100104T070000', 'RRULE:FREQ=WEEKLY;BYDAY=MO', 'SUMMARY:Müll']);
    const evs = parseIcs(text, ...range('2026-06-01', '2026-06-30'));
    expect(evs.map((e) => local(e.start))).toEqual(['2026-06-01 07:00', '2026-06-08 07:00', '2026-06-15 07:00', '2026-06-22 07:00', '2026-06-29 07:00']);
  });

  // Known gap: negative BYMONTHDAY is only handled for MONTHLY/YEARLY rules, not for DAILY.
  it.fails('handles negative BYMONTHDAY in DAILY rules', () => {
    const text = ics(['UID:a', 'DTSTART:20260131T080000Z', 'RRULE:FREQ=DAILY;BYMONTHDAY=-1;COUNT=2', 'SUMMARY:Monatsende']);
    const evs = parseIcs(text, ...range('2026-01-01', '2026-12-31'));
    expect(evs.map((e) => e.start.toISOString().slice(0, 10))).toEqual(['2026-01-31', '2026-02-28']);
  });
});

describe('icsCalendarName', () => {
  it('reads X-WR-CALNAME', () => {
    expect(icsCalendarName(ics())).toBe('Familie');
    expect(icsCalendarName('BEGIN:VCALENDAR\r\nEND:VCALENDAR')).toBeUndefined();
  });
});
