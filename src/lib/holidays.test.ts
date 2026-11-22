import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeStorage } from '../test/fakeStorage';
import { loadHolidays } from './holidays';

const api = {
  PublicHolidays: [
    { id: 'p1', startDate: '2026-12-25', endDate: '2026-12-25', name: [{ language: 'DE', text: '1. Weihnachtstag' }], nationwide: true },
    // only valid in a part of Bavaria
    {
      id: 'p2',
      startDate: '2026-08-08',
      endDate: '2026-08-08',
      name: [{ language: 'DE', text: 'Augsburger Friedensfest' }],
      nationwide: false,
      subdivisions: [{ code: 'DE-BY-AU' }],
    },
  ],
  // school holidays around new year come back for both years
  SchoolHolidays: [{ id: 's1', startDate: '2026-12-23', endDate: '2027-01-05', name: [{ language: 'DE', text: 'Weihnachtsferien' }] }],
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
  fetchMock = vi.fn(async (url: string) => {
    const path = new URL(url).pathname.slice(1) as keyof typeof api;
    return { ok: true, status: 200, json: async () => api[path] } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('loadHolidays', () => {
  it('maps the API data, marks regional holidays and removes duplicates across years', async () => {
    const list = await loadHolidays('DE-BY', [2026, 2027]);
    expect(list.map((h) => [h.start, h.end, h.name, h.type])).toEqual([
      ['2026-08-08', '2026-08-08', 'Augsburger Friedensfest (regional)', 'public'],
      ['2026-12-23', '2027-01-05', 'Weihnachtsferien', 'school'],
      ['2026-12-25', '2026-12-25', '1. Weihnachtstag', 'public'],
    ]);
  });

  it('uses the cache instead of asking the API again', async () => {
    await loadHolidays('DE-NW', [2026]);
    const calls = fetchMock.mock.calls.length;
    await loadHolidays('DE-NW', [2026]);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it('falls back to an outdated copy when offline', async () => {
    localStorage.setItem(
      'fc.hol.DE-NW.2026',
      JSON.stringify({ at: 0, list: [{ id: 'old', start: '2026-01-01', end: '2026-01-01', name: 'Neujahr', type: 'public' }] }),
    );
    fetchMock.mockRejectedValue(new TypeError('offline'));
    expect((await loadHolidays('DE-NW', [2026])).map((h) => h.name)).toEqual(['Neujahr']);
    await expect(loadHolidays('DE-HH', [2026])).rejects.toThrow('offline');
  });
});
