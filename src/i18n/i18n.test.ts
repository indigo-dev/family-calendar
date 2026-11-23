import { afterEach, describe, expect, it } from 'vitest';
import { de } from './de';
import { en } from './en';
import { getLanguage, interpolate, isLanguageSetting, locale, resolveLanguage, setLanguage, t, withLanguage, type Messages } from './index';
import { fmtClock, fmtHHMM, fmtTime, titleFor, weekdayNames } from '../lib/dates';

afterEach(() => setLanguage('de'));

/** all keys of a language file with their text(s) */
function flatten(obj: unknown, prefix = ''): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix + k;
    if (typeof v === 'string') out.set(key, [v]);
    else if (v && typeof v === 'object' && typeof (v as { other?: unknown }).other === 'string')
      out.set(key, Object.values(v as Record<string, string>));
    else for (const [k2, v2] of flatten(v, key + '.')) out.set(k2, v2);
  }
  return out;
}
const placeholders = (texts: string[]) => new Set(texts.flatMap((s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1])));

describe('t', () => {
  it('looks up nested keys in the active language', () => {
    expect(t('nav.calendar')).toBe('Kalender');
    setLanguage('en');
    expect(t('nav.calendar')).toBe('Calendar');
    expect(getLanguage()).toBe('en');
  });

  it('fills placeholders and keeps unknown ones', () => {
    expect(t('calendar.weekTitle', { week: 48, span: 'x' })).toBe('KW 48 · x');
    expect(interpolate('{a} und {b}', { a: 1 })).toBe('1 und {b}');
  });

  it('chooses plural forms by n', () => {
    expect(t('settings.calendars.testOk', { n: 1 })).toBe('OK · 1 Termin in den nächsten 60 Tagen');
    expect(t('settings.calendars.testOk', { n: 3 })).toBe('OK · 3 Termine in den nächsten 60 Tagen');
    setLanguage('en');
    expect(t('dashboard.openTasks', { n: 1 })).toBe('open task');
    expect(t('dashboard.openTasks', { n: 0 })).toBe('open tasks');
    expect(t('frame.unreadable', { n: 2 })).toBe('2 files could not be read.');
  });

  it('returns the key for an unknown key instead of crashing', () => {
    expect(t('nope.missing' as never)).toBe('nope.missing');
  });

  it('withLanguage switches only for the callback', () => {
    expect(withLanguage('en', () => t('common.today'))).toBe('Today');
    expect(t('common.today')).toBe('Heute');
  });
});

describe('language files', () => {
  const deKeys = flatten(de);
  const enKeys = flatten(en satisfies Messages);

  it('English has exactly the German keys', () => {
    expect([...enKeys.keys()].sort()).toEqual([...deKeys.keys()].sort());
  });

  it('every translation uses the same placeholders', () => {
    const wrong = [...deKeys].filter(([k, texts]) => {
      const a = placeholders(texts);
      const b = placeholders(enKeys.get(k) ?? []);
      return a.size !== b.size || [...a].some((p) => !b.has(p));
    });
    expect(wrong.map(([k]) => k)).toEqual([]);
  });

  it('has no empty texts', () => {
    const empty = [...deKeys, ...enKeys].filter(([, texts]) => texts.some((s) => !s.trim()));
    expect(empty.map(([k]) => k)).toEqual([]);
  });
});

describe('language setting', () => {
  it('auto takes the first device language the app speaks, else English', () => {
    expect(resolveLanguage('auto', ['de-AT', 'en-US'])).toBe('de');
    expect(resolveLanguage('auto', ['fr-FR', 'en-GB'])).toBe('en');
    expect(resolveLanguage('auto', ['es-ES'])).toBe('en');
    expect(resolveLanguage('auto', [])).toBe('en');
    expect(resolveLanguage('de', ['en-US'])).toBe('de');
  });

  it('validates stored values', () => {
    expect(isLanguageSetting('auto')).toBe(true);
    expect(isLanguageSetting('en')).toBe(true);
    expect(isLanguageSetting('es')).toBe(false);
    expect(isLanguageSetting(undefined)).toBe(false);
  });

  it('English follows the device variant, en-GB without one', () => {
    setLanguage('en', ['en-US']);
    expect(locale()).toBe('en-US');
    setLanguage('en', ['de-DE']);
    expect(locale()).toBe('en-GB');
    setLanguage('de', ['en-US']);
    expect(locale()).toBe('de-DE');
  });
});

describe('dates in English', () => {
  const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min);

  it('writes titles with the locale range format', () => {
    setLanguage('en', ['en-GB']);
    expect(titleFor('week', d(2026, 11, 22), 1)).toMatch(/^Week 47 · 16\s?–\s?22 Nov 2026$/);
    expect(titleFor('month', d(2026, 11, 22), 1)).toBe('November 2026');
    expect(weekdayNames(1)[0]).toBe('Mon');
  });

  it('uses a 24-hour clock in en-GB and a 12-hour clock in en-US', () => {
    setLanguage('en', ['en-GB']);
    expect(fmtTime(d(2026, 11, 22, 14, 5))).toBe('14:05');
    expect(fmtClock(8)).toBe('08:00');
    setLanguage('en', ['en-US']);
    expect(fmtTime(d(2026, 11, 22, 14, 5)).replace(/\s/g, ' ')).toBe('2:05 PM');
    expect(fmtClock(8).replace(/\s/g, ' ')).toBe('8 AM');
    expect(fmtHHMM('13:20').replace(/\s/g, ' ')).toBe('1:20 PM');
  });

  it('keeps German times unchanged', () => {
    expect(fmtTime(d(2026, 11, 22, 9, 5))).toBe('09:05');
    expect(fmtHHMM('13:20')).toBe('13:20');
  });
});
