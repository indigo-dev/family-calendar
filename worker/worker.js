// Familienkalender – ICS-Weiterleitung (Cloudflare Worker)
// Lädt Kalender-Abo-Links (ICS) von Google/Microsoft/iCloud und gibt sie mit CORS-Headern
// an die Kalender-App weiter. Speichert nichts. Aufruf: https://<worker>/?url=<ICS-Link>

const ALLOWED_HOSTS = [
  'calendar.google.com',
  'outlook.live.com',
  'outlook.office365.com',
  'outlook.office.com',
];
const ALLOWED_HOST_SUFFIXES = ['.icloud.com'];

const ALLOWED_ORIGINS = ['https://indigo-dev.github.io'];
// lokale Entwicklung: localhost und Heimnetz
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/;

function corsHeaders(origin) {
  const ok = origin && (ALLOWED_ORIGINS.includes(origin) || DEV_ORIGIN.test(origin));
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function hostAllowed(host) {
  return ALLOWED_HOSTS.includes(host) || ALLOWED_HOST_SUFFIXES.some((s) => host.endsWith(s));
}

function fail(status, msg, origin) {
  return new Response(msg, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders(origin) } });
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
    if (request.method !== 'GET') return fail(405, 'Nur GET erlaubt', origin);

    const raw = new URL(request.url).searchParams.get('url');
    if (!raw) return fail(200, 'Familienkalender-Weiterleitung läuft. Aufruf: ?url=<ICS-Link>', origin);

    let target;
    try {
      target = new URL(raw.trim().replace(/^webcals?:\/\//i, 'https://'));
    } catch {
      return fail(400, 'Ungültiger Link', origin);
    }
    if (target.protocol !== 'https:') return fail(400, 'Nur https-Links', origin);
    if (!hostAllowed(target.hostname)) return fail(403, 'Dieser Kalender-Anbieter ist nicht freigegeben: ' + target.hostname, origin);

    let upstream;
    try {
      upstream = await fetch(target.toString(), {
        headers: { 'User-Agent': 'Familienkalender/1.0', Accept: 'text/calendar, */*' },
        cf: { cacheTtl: 300, cacheEverything: true },
        redirect: 'follow',
      });
    } catch (e) {
      return fail(502, 'Kalender nicht erreichbar', origin);
    }
    if (!upstream.ok) return fail(upstream.status, 'Kalender-Anbieter antwortet mit ' + upstream.status, origin);

    const body = await upstream.text();
    if (!body.trimStart().startsWith('BEGIN:VCALENDAR')) return fail(502, 'Antwort ist kein Kalender (ICS)', origin);

    return new Response(body, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders(origin),
      },
    });
  },
};
