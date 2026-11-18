// Familienkalender – ICS-Weiterleitung (Cloudflare Worker)
// Lädt Kalender-Abo-Links (ICS) und gibt sie mit CORS-Headern
// an die Kalender-App weiter. Speichert nichts. Aufruf: https://<worker>/?url=<ICS-Link>

// Jeder https-Kalender ist erlaubt. Schutz vor Missbrauch: Es werden nur echte iCal-Dateien
// (beginnen mit BEGIN:VCALENDAR) bis MAX_BYTES weitergegeben, keine IP-Adressen/localhost.
const MAX_BYTES = 5 * 1024 * 1024;

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
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
  if (/^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[')) return false; // IP-Adressen
  return host.includes('.');
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
    if (!hostAllowed(target.hostname)) return fail(403, 'Diese Adresse ist nicht erlaubt: ' + target.hostname, origin);

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

    const declared = Number(upstream.headers.get('Content-Length') || 0);
    if (declared > MAX_BYTES) return fail(413, 'Kalender ist zu groß', origin);
    const reader = upstream.body.getReader();
    const chunks = [];
    let size = 0;
    let checked = false;
    const looksLikeIcs = () => {
      const head = new Uint8Array(Math.min(size, 64));
      let o = 0;
      for (const c of chunks) {
        const part = c.slice(0, head.length - o);
        head.set(part, o);
        o += part.length;
        if (o >= head.length) break;
      }
      return new TextDecoder().decode(head).replace(/^\uFEFF/, '').trimStart().startsWith('BEGIN:VCALENDAR');
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        reader.cancel();
        return fail(413, 'Kalender ist zu groß', origin);
      }
      chunks.push(value);
      // früh abbrechen, wenn es kein Kalender ist
      if (!checked && size >= 64) {
        checked = true;
        if (!looksLikeIcs()) {
          reader.cancel();
          return fail(415, 'Antwort ist kein Kalender (ICS)', origin);
        }
      }
    }
    if (!checked && !looksLikeIcs()) return fail(415, 'Antwort ist kein Kalender (ICS)', origin);
    const buf = new Uint8Array(size);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.byteLength;
    }
    const body = new TextDecoder().decode(buf).replace(/^\uFEFF/, '');

    return new Response(body, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders(origin),
      },
    });
  },
};
