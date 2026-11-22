// Familienkalender – ICS-Weiterleitung (Cloudflare Worker)
//
// Lädt Kalender-Abo-Links (ICS) und gibt sie mit CORS-Headern an die Kalender-App weiter. Speichert nichts.
//
// Aufruf (App):  POST /  Body {"url": "<ICS-Link>", "fresh": false}  Header X-Access-Key: <Schlüssel>
//   – der geheime Link steht im Body, nicht in der URL, und taucht so nicht in Logs auf
//   – fresh: true lädt am Cloudflare-Cache vorbei (Knopf „Neu laden“)
// Alt:           GET /?url=<ICS-Link>   (für ältere App-Versionen; nur ohne ACCESS_KEY)
// Status:        GET /                  (zeigt, ob die Weiterleitung läuft und ob ein Schlüssel nötig/gültig ist)
//
// Einstellungen (wrangler.toml bzw. Cloudflare-Dashboard → Einstellungen → Variablen):
//   ACCESS_KEY       Secret. Gesetzt = nur Anfragen mit diesem Schlüssel werden bedient.
//   ALLOWED_HOSTS    Erlaubte Kalender-Server, durch Komma getrennt, z. B. "calendar.google.com, *.icloud.com".
//                    "*" (Standard) = jeder https-Server. IP-Adressen und localhost sind nie erlaubt.
//   ALLOWED_ORIGINS  Seiten, die den Worker im Browser nutzen dürfen (zusätzlich localhost und Heimnetz).

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;
/** how long Cloudflare keeps a calendar at the edge (normal loads) */
const EDGE_CACHE_S = 300;

const DEFAULT_ORIGINS = 'https://indigo-dev.github.io';
// local development: localhost and the home network
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/;

const list = (v, fallback) =>
  String(v ?? fallback)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export function originAllowed(origin, env = {}) {
  return !!origin && (list(env.ALLOWED_ORIGINS, DEFAULT_ORIGINS).includes(origin.toLowerCase()) || DEV_ORIGIN.test(origin));
}

/** never IP addresses or local names; otherwise the ALLOWED_HOSTS patterns ("*", "example.com", "*.example.com") */
export function hostAllowed(host, env = {}) {
  host = host.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (/^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[')) return false; // IP addresses
  if (!host.includes('.')) return false;
  return list(env.ALLOWED_HOSTS, '*').some((p) => p === '*' || p === host || (p.startsWith('*.') && host.endsWith(p.slice(1))));
}

/** https link (webcal:// counts as https) that may be fetched, or an error text */
export function checkTarget(raw, env = {}) {
  let url;
  try {
    url = new URL(
      String(raw)
        .trim()
        .replace(/^webcals?:\/\//i, 'https://'),
    );
  } catch {
    return { error: 'Ungültiger Link' };
  }
  if (url.protocol !== 'https:') return { error: 'Nur https-Links' };
  if (!hostAllowed(url.hostname, env)) return { error: 'Diese Adresse ist nicht erlaubt: ' + url.hostname, status: 403 };
  return { url };
}

/** compares the access key in constant time */
function keyMatches(given, expected) {
  if (typeof given !== 'string' || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function baseHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const h = { Vary: 'Origin', 'X-Content-Type-Options': 'nosniff' };
  // foreign pages get no CORS header at all, so their browsers refuse the answer
  if (originAllowed(origin, env)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type, X-Access-Key';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

function fail(status, msg, request, env) {
  return new Response(msg, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...baseHeaders(request, env) } });
}

/**
 * Fetches the calendar; every redirect target is checked again (a provider must not be able to send the
 * worker to an address it would refuse).
 */
async function fetchUpstream(url, fresh, env) {
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Familienkalender/2.0', Accept: 'text/calendar, */*' },
      // fresh: the cached copy expires at once, so the provider is asked again
      cf: { cacheTtl: fresh ? 0 : EDGE_CACHE_S, cacheEverything: true },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status < 300 || res.status >= 400) return { res };
    const location = res.headers.get('Location');
    if (!location) return { res };
    const next = checkTarget(new URL(location, url).toString(), env);
    if (next.error) return { error: 'Weiterleitung nicht erlaubt: ' + next.error.replace(/^Diese Adresse ist nicht erlaubt: /, '') };
    url = next.url;
  }
  return { error: 'Zu viele Weiterleitungen' };
}

/** concatenates the first chunks until at least n bytes (or the end) are there */
async function readHead(reader, n) {
  const chunks = [];
  let size = 0;
  while (size < n) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  return { chunks, size };
}

const looksLikeIcs = (chunks) => {
  const head = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let o = 0;
  for (const c of chunks) {
    head.set(c, o);
    o += c.byteLength;
  }
  return new TextDecoder().decode(head.subarray(0, 256)).trimStart().startsWith('BEGIN:VCALENDAR');
};

async function handle(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: baseHeaders(request, env) });
  if (request.method !== 'GET' && request.method !== 'POST') return fail(405, 'Nur GET und POST erlaubt', request, env);

  const keyRequired = !!env.ACCESS_KEY;
  const keyOk = !keyRequired || keyMatches(request.headers.get('X-Access-Key'), env.ACCESS_KEY);

  let raw;
  let fresh = false;
  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return fail(400, 'Ungültige Anfrage', request, env);
    }
    raw = body?.url;
    fresh = body?.fresh === true;
  } else {
    raw = new URL(request.url).searchParams.get('url');
    if (!raw) {
      // status check for the settings
      return new Response(JSON.stringify({ service: 'Familienkalender-Weiterleitung', version: 2, keyRequired, keyOk }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...baseHeaders(request, env) },
      });
    }
  }
  if (!keyOk) return fail(401, 'Schlüssel fehlt oder ist falsch', request, env);
  if (!raw) return fail(400, 'Kein Kalender-Link angegeben', request, env);

  const target = checkTarget(raw, env);
  if (target.error) return fail(target.status ?? 400, target.error, request, env);

  let upstream;
  try {
    const r = await fetchUpstream(target.url, fresh, env);
    if (r.error) return fail(403, r.error, request, env);
    upstream = r.res;
  } catch (e) {
    return fail(e?.name === 'TimeoutError' ? 504 : 502, 'Kalender nicht erreichbar', request, env);
  }
  if (!upstream.ok)
    return fail(upstream.status >= 500 ? 502 : upstream.status, 'Kalender-Anbieter antwortet mit ' + upstream.status, request, env);
  if (Number(upstream.headers.get('Content-Length') || 0) > MAX_BYTES) return fail(413, 'Kalender ist zu groß', request, env);
  if (!upstream.body) return fail(415, 'Antwort ist kein Kalender (ICS)', request, env);

  // check the start, then pass the rest through without buffering or decoding (little CPU time)
  const reader = upstream.body.getReader();
  const head = await readHead(reader, 64);
  if (!looksLikeIcs(head.chunks)) {
    reader.cancel().catch(() => {});
    return fail(415, 'Antwort ist kein Kalender (ICS)', request, env);
  }
  let size = head.size;
  if (size > MAX_BYTES) {
    reader.cancel().catch(() => {});
    return fail(413, 'Kalender ist zu groß', request, env);
  }
  const body = new ReadableStream({
    start(controller) {
      head.chunks.forEach((c) => controller.enqueue(c));
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) return controller.close();
      size += value.byteLength;
      // the status is already sent – breaking the stream makes the app see a failed load
      if (size > MAX_BYTES) {
        reader.cancel().catch(() => {});
        return controller.error(new Error('Kalender ist zu groß'));
      }
      controller.enqueue(value);
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // secret data: browsers may keep it briefly, shared caches must not
      'Cache-Control': fresh ? 'no-store' : `private, max-age=${EDGE_CACHE_S}`,
      ...baseHeaders(request, env),
    },
  });
}

export default {
  fetch(request, env) {
    return handle(request, env ?? {});
  },
};
