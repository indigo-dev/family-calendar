// HomeWally ICS proxy (Cloudflare Worker)
//
// Fetches calendar subscription links (ICS) and hands them to the HomeWally web app with CORS headers.
// Stores nothing.
//
// Fetch:   POST /  body {"url": "<ICS link>", "fresh": false}  header X-Access-Key: <key>
//   - the secret link travels in the body, not in the URL, so it never shows up in logs
//   - fresh: true bypasses the Cloudflare cache (the app's "reload" button)
// Status:  GET /   tells whether the proxy runs and whether a key is required / valid
// Errors:  JSON {"error": "<code>", "detail"?: "<host or status>"} - the app translates the codes,
//          so the worker itself never needs to know the user's language
//
// Settings (wrangler.toml or Cloudflare dashboard -> Settings -> Variables):
//   ACCESS_KEY       secret. When set, only requests with this key are served.
//   ALLOWED_HOSTS    allowed calendar servers, comma-separated, e.g. "calendar.google.com, *.icloud.com".
//                    "*" (default) = any https server. IP addresses and localhost are never allowed.
//   ALLOWED_ORIGINS  sites allowed to use the worker from the browser (plus localhost and the home network).

export const SERVICE = 'homewally-ics-proxy';

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

/** https link (webcal:// counts as https) that may be fetched, or an error code */
export function checkTarget(raw, env = {}) {
  let url;
  try {
    url = new URL(
      String(raw)
        .trim()
        .replace(/^webcals?:\/\//i, 'https://'),
    );
  } catch {
    return { error: 'invalid_link' };
  }
  if (url.protocol !== 'https:') return { error: 'https_only' };
  if (!hostAllowed(url.hostname, env)) return { error: 'host_not_allowed', detail: url.hostname, status: 403 };
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

/** error answer: an English code (plus host or status as detail) that the app turns into its own language */
function fail(status, error, request, env, detail) {
  return new Response(JSON.stringify(detail == null ? { error } : { error, detail: String(detail) }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...baseHeaders(request, env) },
  });
}

/**
 * Fetches the calendar; every redirect target is checked again (a provider must not be able to send the
 * worker to an address it would refuse).
 */
async function fetchUpstream(url, fresh, env) {
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'HomeWally/2.0', Accept: 'text/calendar, */*' },
      // fresh: the cached copy expires at once, so the provider is asked again
      cf: { cacheTtl: fresh ? 0 : EDGE_CACHE_S, cacheEverything: true },
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status < 300 || res.status >= 400) return { res };
    const location = res.headers.get('Location');
    if (!location) return { res };
    const next = checkTarget(new URL(location, url).toString(), env);
    if (next.error) return { error: 'redirect_not_allowed', detail: next.detail };
    url = next.url;
  }
  return { error: 'too_many_redirects' };
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
  if (request.method !== 'GET' && request.method !== 'POST') return fail(405, 'method_not_allowed', request, env);

  const keyRequired = !!env.ACCESS_KEY;
  const keyOk = !keyRequired || keyMatches(request.headers.get('X-Access-Key'), env.ACCESS_KEY);

  // GET: status check for the settings
  if (request.method === 'GET') {
    return new Response(JSON.stringify({ service: SERVICE, keyRequired, keyOk }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...baseHeaders(request, env) },
    });
  }
  if (!keyOk) return fail(401, 'key_invalid', request, env);

  let input;
  try {
    input = await request.json();
  } catch {
    return fail(400, 'bad_request', request, env);
  }
  const raw = input?.url;
  const fresh = input?.fresh === true;
  if (!raw) return fail(400, 'missing_url', request, env);

  const target = checkTarget(raw, env);
  if (target.error) return fail(target.status ?? 400, target.error, request, env, target.detail);

  let upstream;
  try {
    const r = await fetchUpstream(target.url, fresh, env);
    if (r.error) return fail(403, r.error, request, env, r.detail);
    upstream = r.res;
  } catch (e) {
    return fail(e?.name === 'TimeoutError' ? 504 : 502, 'unreachable', request, env);
  }
  if (!upstream.ok) return fail(upstream.status >= 500 ? 502 : upstream.status, 'upstream_error', request, env, upstream.status);
  if (Number(upstream.headers.get('Content-Length') || 0) > MAX_BYTES) return fail(413, 'too_large', request, env);
  if (!upstream.body) return fail(415, 'not_calendar', request, env);

  // check the start, then pass the rest through without buffering or decoding (little CPU time)
  const reader = upstream.body.getReader();
  const head = await readHead(reader, 64);
  if (!looksLikeIcs(head.chunks)) {
    reader.cancel().catch(() => {});
    return fail(415, 'not_calendar', request, env);
  }
  let size = head.size;
  if (size > MAX_BYTES) {
    reader.cancel().catch(() => {});
    return fail(413, 'too_large', request, env);
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
        return controller.error(new Error('too_large'));
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
