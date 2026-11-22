import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { checkTarget, hostAllowed } from './worker.js';

const ICS =
  'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:1\r\nDTSTART:20260101T100000Z\r\nSUMMARY:Test\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
const APP = 'https://indigo-dev.github.io';

/** the calendar providers the worker talks to: url -> response */
let upstream;
let calls;

beforeEach(() => {
  calls = [];
  upstream = { 'https://calendar.google.com/cal.ics': () => new Response(ICS) };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init) => {
      calls.push({ url, init });
      const make = upstream[url];
      if (!make) throw new TypeError('network');
      return make();
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const post = (body, { key, origin = APP } = {}) =>
  new Request('https://w.example/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, ...(key ? { 'X-Access-Key': key } : {}) },
    body: JSON.stringify(body),
  });
const run = (req, env = {}) => worker.fetch(req, env);

describe('targets', () => {
  it('allows https calendars, never IP addresses or local names', () => {
    expect(hostAllowed('calendar.google.com')).toBe(true);
    for (const h of ['localhost', 'nas.local', 'x.internal', '10.0.0.1', '[::1]', 'intranet']) expect(hostAllowed(h)).toBe(false);
    expect(checkTarget('webcal://p01-caldav.icloud.com/x.ics').url?.protocol).toBe('https:');
    expect(checkTarget('http://example.com/x.ics').error).toBe('Nur https-Links');
  });

  it('can be limited to known providers', () => {
    const env = { ALLOWED_HOSTS: 'calendar.google.com, *.icloud.com' };
    expect(hostAllowed('calendar.google.com', env)).toBe(true);
    expect(hostAllowed('p01-caldav.icloud.com', env)).toBe(true);
    expect(hostAllowed('example.com', env)).toBe(false);
  });
});

describe('POST /', () => {
  it('passes the calendar through with private caching and CORS for the app', async () => {
    const res = await run(post({ url: 'https://calendar.google.com/cal.ics' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(ICS);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=300');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(APP);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(calls[0].init.cf.cacheTtl).toBe(300);
    expect(calls[0].init.redirect).toBe('manual');
  });

  it('fresh bypasses the edge cache', async () => {
    const res = await run(post({ url: 'https://calendar.google.com/cal.ics', fresh: true }));
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(calls[0].init.cf.cacheTtl).toBe(0);
  });

  it('gives foreign pages no CORS header', async () => {
    const res = await run(post({ url: 'https://calendar.google.com/cal.ics' }, { origin: 'https://evil.example' }));
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('requires the access key when one is set', async () => {
    const env = { ACCESS_KEY: 'geheim-123' };
    expect((await run(post({ url: 'https://calendar.google.com/cal.ics' }), env)).status).toBe(401);
    expect((await run(post({ url: 'https://calendar.google.com/cal.ics' }, { key: 'falsch-1234' }), env)).status).toBe(401);
    expect((await run(post({ url: 'https://calendar.google.com/cal.ics' }, { key: 'geheim-123' }), env)).status).toBe(200);
  });

  it('checks every redirect target again', async () => {
    upstream['https://calendar.google.com/moved.ics'] = () => new Response(null, { status: 302, headers: { Location: '/cal.ics' } });
    upstream['https://calendar.google.com/evil.ics'] = () =>
      new Response(null, { status: 302, headers: { Location: 'https://127.0.0.1/' } });
    expect(await (await run(post({ url: 'https://calendar.google.com/moved.ics' }))).text()).toBe(ICS);
    const bad = await run(post({ url: 'https://calendar.google.com/evil.ics' }));
    expect(bad.status).toBe(403);
    expect(calls.some((c) => c.url.includes('127.0.0.1'))).toBe(false);
  });

  it('accepts a calendar that starts with a byte order mark', async () => {
    upstream['https://calendar.google.com/bom.ics'] = () => new Response('﻿' + ICS);
    expect((await run(post({ url: 'https://calendar.google.com/bom.ics' }))).status).toBe(200);
  });

  it('refuses answers that are no calendar and calendars that are too big', async () => {
    upstream['https://calendar.google.com/page'] = () => new Response('<!doctype html><html>…</html>');
    expect((await run(post({ url: 'https://calendar.google.com/page' }))).status).toBe(415);
    upstream['https://calendar.google.com/big.ics'] = () => new Response(ICS, { headers: { 'Content-Length': String(6 * 1024 * 1024) } });
    expect((await run(post({ url: 'https://calendar.google.com/big.ics' }))).status).toBe(413);
  });

  it('reports unreachable providers and their errors', async () => {
    expect((await run(post({ url: 'https://unknown.example/x.ics' }))).status).toBe(502);
    upstream['https://calendar.google.com/gone.ics'] = () => new Response('nope', { status: 404 });
    expect((await run(post({ url: 'https://calendar.google.com/gone.ics' }))).status).toBe(404);
  });
});

describe('GET', () => {
  it('status check tells whether a key is needed and valid', async () => {
    const req = (key) => new Request('https://w.example/', { headers: { Origin: APP, ...(key ? { 'X-Access-Key': key } : {}) } });
    expect(await (await run(req())).json()).toMatchObject({ version: 2, keyRequired: false, keyOk: true });
    expect(await (await run(req('x'), { ACCESS_KEY: 'k' })).json()).toMatchObject({ keyRequired: true, keyOk: false });
  });

  it('still serves older app versions via ?url= – but not once a key is set', async () => {
    const req = new Request('https://w.example/?url=' + encodeURIComponent('https://calendar.google.com/cal.ics'), {
      headers: { Origin: APP },
    });
    expect(await (await run(req)).text()).toBe(ICS);
    expect((await run(req.clone(), { ACCESS_KEY: 'k' })).status).toBe(401);
  });
});
