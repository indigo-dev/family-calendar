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

  it('shows the proxy error code in the app language', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'host_not_allowed', detail: 'evil.example' }), { status: 403 }));
    await expect(fetchIcs({ url: W, key: '' }, 'https://calendar.google.com/d.ics', true)).rejects.toThrow(
      'Diese Adresse ist nicht erlaubt: evil.example',
    );
  });

  it('falls back to the HTTP status for answers that are not from the proxy', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }));
    await expect(fetchIcs({ url: W, key: '' }, 'https://calendar.google.com/e.ics', true)).rejects.toThrow('Fehler 502');
  });
});

describe('checkProxy', () => {
  const json = (o: object) => new Response(JSON.stringify(o));
  it('understands the HomeWally proxy', async () => {
    fetchMock.mockResolvedValueOnce(json({ service: 'homewally-ics-proxy', keyRequired: true, keyOk: false }));
    expect(await checkProxy({ url: W, key: 'x' })).toEqual({ ok: false, text: 'Der Schlüssel ist falsch.' });
    fetchMock.mockResolvedValueOnce(json({ service: 'homewally-ics-proxy', keyRequired: false, keyOk: true }));
    expect((await checkProxy({ url: W, key: '' })).ok).toBe(true);
  });

  it('does not take other servers for the proxy', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Hello World'));
    expect(await checkProxy({ url: W, key: '' })).toEqual({ ok: false, text: 'Unerwartete Antwort (200). Ist das die Worker-Adresse?' });
  });
});
