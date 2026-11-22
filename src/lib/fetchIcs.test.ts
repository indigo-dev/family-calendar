import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkProxy, fetchIcs } from './events';

const ICS = 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n';
const W = 'https://w.example';
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('fetchIcs', () => {
  it('sends the link in the body (not the URL), with key and fresh flag', async () => {
    fetchMock.mockResolvedValue(new Response(ICS));
    await fetchIcs({ url: W + '/', key: ' k1 ' }, 'webcal://calendar.google.com/a.ics', true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(W + '/');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ url: 'https://calendar.google.com/a.ics', fresh: true });
    expect(init.headers['X-Access-Key']).toBe('k1');
  });

  it('sends no extra header without a key (no CORS preflight)', async () => {
    fetchMock.mockResolvedValue(new Response(ICS));
    await fetchIcs({ url: W, key: '' }, 'https://calendar.google.com/b.ics', true);
    expect(Object.keys(fetchMock.mock.calls[0][1].headers)).toEqual(['Content-Type']);
  });

  it('falls back to GET ?url= for workers of the old version', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Nur GET erlaubt', { status: 405 })).mockResolvedValueOnce(new Response(ICS));
    expect(await fetchIcs({ url: W, key: '' }, 'https://calendar.google.com/c.ics', true)).toBe(ICS);
    expect(fetchMock.mock.calls[1][0]).toBe(W + '/?url=' + encodeURIComponent('https://calendar.google.com/c.ics'));
  });

  it('shows the worker error text', async () => {
    fetchMock.mockResolvedValue(new Response('Schlüssel fehlt oder ist falsch', { status: 401 }));
    await expect(fetchIcs({ url: W, key: '' }, 'https://calendar.google.com/d.ics', true)).rejects.toThrow('Schlüssel fehlt');
  });
});

describe('checkProxy', () => {
  const json = (o: object) => new Response(JSON.stringify(o));
  it('understands the status of the new worker', async () => {
    fetchMock.mockResolvedValueOnce(json({ service: 'Familienkalender-Weiterleitung', version: 2, keyRequired: true, keyOk: false }));
    expect(await checkProxy({ url: W, key: 'x' })).toEqual({ ok: false, text: 'Der Schlüssel ist falsch.' });
    fetchMock.mockResolvedValueOnce(json({ service: 'Familienkalender-Weiterleitung', version: 2, keyRequired: true, keyOk: true }));
    expect((await checkProxy({ url: W, key: 'x' })).ok).toBe(true);
  });

  it('recognises an old worker and asks to update it', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Familienkalender-Weiterleitung läuft. Aufruf: ?url=<ICS-Link>'));
    const r = await checkProxy({ url: W, key: '' });
    expect(r.ok).toBe(true);
    expect(r.text).toContain('ältere Version');
  });
});
