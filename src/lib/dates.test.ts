import { describe, expect, it } from 'vitest';
import { addMonths, dayKey, isoWeek, rangeFor, startOfWeek, stepDate, titleFor, weekdayNames } from './dates';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('weeks', () => {
  it('startOfWeek honours Monday or Sunday as first day', () => {
    const sun = d(2026, 11, 22);
    expect(dayKey(startOfWeek(sun, 1))).toBe('2026-11-16');
    expect(dayKey(startOfWeek(sun, 0))).toBe('2026-11-22');
  });

  it('isoWeek follows ISO 8601 at the turn of the year', () => {
    expect(isoWeek(d(2026, 11, 22))).toBe(47);
    expect(isoWeek(d(2024, 12, 30))).toBe(1); // Monday already belongs to 2025
    expect(isoWeek(d(2027, 1, 1))).toBe(53); // Friday still belongs to 2026
  });

  it('weekdayNames start with the chosen day', () => {
    expect(weekdayNames(1)[0]).toBe('Mo');
    expect(weekdayNames(0)[0]).toBe('So');
  });
});

describe('months', () => {
  it('addMonths keeps the day but never overflows into the next month', () => {
    expect(dayKey(addMonths(d(2026, 1, 31), 1))).toBe('2026-02-28');
    expect(dayKey(addMonths(d(2024, 1, 31), 1))).toBe('2024-02-29');
    expect(dayKey(addMonths(d(2026, 3, 15), -3))).toBe('2025-12-15');
  });
});

describe('views', () => {
  it('rangeFor covers whole weeks in the month view', () => {
    const r = rangeFor('month', d(2026, 11, 22), 1);
    expect(dayKey(r.start)).toBe('2026-10-26');
    expect(dayKey(r.end)).toBe('2026-12-07'); // 6 weeks, exclusive end
  });

  it('rangeFor and stepDate of the N-days view', () => {
    const r = rangeFor('days', d(2026, 11, 22), 1, 3);
    expect([dayKey(r.start), dayKey(r.end)]).toEqual(['2026-11-22', '2026-11-25']);
    expect(dayKey(stepDate('days', d(2026, 11, 22), -1, 3))).toBe('2026-11-19');
  });

  it('titleFor writes German titles', () => {
    expect(titleFor('week', d(2026, 11, 22), 1)).toBe('KW 47 · 16. – 22. Nov. 2026');
    expect(titleFor('days', d(2026, 11, 30), 1, 3)).toBe('30. Nov. – 2. Dez. 2026');
    expect(titleFor('month', d(2026, 11, 22), 1)).toBe('November 2026');
  });
});
