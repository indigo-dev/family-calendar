import { useEffect, useSyncExternalStore } from 'react';

/**
 * Weather: forecast + pollen + UV from Open-Meteo, official warnings of the DWD via Bright Sky.
 * All free, no API key, CORS enabled. Places and the last fetched data live in localStorage
 * (per device, like the photo frame), so the wall display still shows the last state offline.
 */

export interface Place {
  id: string;
  name: string;
  /** "Bayern" / "Landkreis …" – only to tell places with the same name apart */
  region?: string;
  lat: number;
  lon: number;
}

export interface WeatherSettings {
  /** the first place is "home": calendar header, day columns and screensaver use it */
  places: Place[];
  /** place shown in the weather module */
  activeId?: string;
}

export interface Current {
  time: string;
  temp: number;
  feels: number;
  code: number;
  isDay: boolean;
  wind: number;
  gusts: number;
  /** degrees, where the wind comes from */
  windDir: number;
  humidity: number;
  precipitation: number;
}

export interface Hour {
  time: string;
  temp: number;
  code: number;
  isDay: boolean;
  rainProb: number;
  /** mm in this hour */
  rain: number;
  uv: number;
  feels: number;
  wind: number;
  gusts: number;
  windDir: number;
  humidity: number;
  cloud: number;
}

export interface Day {
  /** yyyy-mm-dd */
  date: string;
  code: number;
  max: number;
  min: number;
  rainProb: number;
  rainSum: number;
  uvMax: number;
  sunrise: string;
  sunset: string;
}

export type PollenType = 'alder' | 'birch' | 'grass' | 'mugwort' | 'ragweed';

export interface PollenDay {
  date: string;
  /** daily maximum in grains/m³ */
  values: Record<PollenType, number>;
}

export interface Alert {
  id: number;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  event: string;
  headline: string;
  description: string;
  instruction: string;
  onset: string;
  expires: string | null;
}

export interface WeatherData {
  fetchedAt: number;
  current: Current;
  hours: Hour[];
  days: Day[];
  /** null when the pollen service failed – the rest still works */
  pollen: PollenDay[] | null;
  /** null when the warning service failed */
  alerts: Alert[] | null;
  /** DWD warn cell, e.g. "Berl. - Mitte" */
  warnCell?: string;
}

/* ------------------------------------------------------------------ settings */

const KEY = 'fc.weather';
/** v2: hourly details (wind, feels like, …) – older caches are ignored */
const DATA_KEY = 'fc.weather.v2.';
/** data older than this is fetched again */
const STALE_MS = 20 * 60_000;
/** don't hammer the services after an error */
const RETRY_MS = 3 * 60_000;

function loadSettings(): WeatherSettings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { places: Array.isArray(v?.places) ? v.places : [], activeId: v?.activeId };
  } catch {
    return { places: [] };
  }
}

let settings = loadSettings();

// caches of the first version lack the hourly details – drop them
try {
  Object.keys(localStorage)
    .filter((k) => k.startsWith('fc.weather.data.'))
    .forEach((k) => localStorage.removeItem(k));
} catch {
  /* ignore */
}
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function setSettings(next: WeatherSettings) {
  settings = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* blocked – keep in memory */
  }
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useWeatherSettings(): WeatherSettings {
  return useSyncExternalStore(subscribe, () => settings);
}

/** Rounds to ~1 km: precise enough for weather, doesn't hand out the exact address. */
const round = (n: number) => Math.round(n * 100) / 100;

export function addPlace(p: Omit<Place, 'id'>): Place {
  const lat = round(p.lat);
  const lon = round(p.lon);
  const existing = settings.places.find((x) => x.lat === lat && x.lon === lon);
  if (existing) {
    setSettings({ ...settings, activeId: existing.id });
    return existing;
  }
  const place: Place = { ...p, lat, lon, id: crypto.randomUUID() };
  setSettings({ places: [...settings.places, place], activeId: place.id });
  return place;
}

export function removePlace(id: string) {
  const places = settings.places.filter((p) => p.id !== id);
  try {
    localStorage.removeItem(DATA_KEY + id);
  } catch {
    /* ignore */
  }
  cache.delete(id);
  setSettings({ places, activeId: settings.activeId === id ? places[0]?.id : settings.activeId });
}

export function renamePlace(id: string, name: string) {
  setSettings({ ...settings, places: settings.places.map((p) => (p.id === id ? { ...p, name } : p)) });
}

/** Moves a place to the top – it becomes "home". */
export function makeHome(id: string) {
  const p = settings.places.find((x) => x.id === id);
  if (!p) return;
  setSettings({ ...settings, places: [p, ...settings.places.filter((x) => x.id !== id)] });
}

export function setActivePlace(id: string) {
  setSettings({ ...settings, activeId: id });
}

/* ------------------------------------------------------------------ location */

export interface SearchHit {
  name: string;
  region?: string;
  lat: number;
  lon: number;
}

/** Place search (Open-Meteo geocoding, Germany only). */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=de&countryCode=DE`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    results?: { name: string; latitude: number; longitude: number; admin1?: string; admin3?: string; admin4?: string }[];
  };
  return (json.results ?? []).map((r) => ({
    name: r.name,
    region: [r.admin4 !== r.name ? r.admin4 : undefined, r.admin1].filter(Boolean).join(', ') || undefined,
    lat: r.latitude,
    lon: r.longitude,
  }));
}

export const isApple = () => /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;

/** Why locating failed, with a hint the family can act on. */
export class LocateError extends Error {
  constructor(
    message: string,
    public help?: string[],
  ) {
    super(message);
  }
}

function position(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options));
}

/**
 * Asks the browser for the device position once. Tablets without GPS often fail the first, quick
 * attempt (Wi-Fi positioning still warming up) – then it tries again more patiently.
 */
export async function locate(): Promise<{ lat: number; lon: number }> {
  if (!window.isSecureContext) {
    throw new LocateError('Der Standort ist nur über eine sichere Verbindung (https) verfügbar. Bitte den Ort suchen.');
  }
  if (!('geolocation' in navigator)) throw new LocateError('Dieses Gerät kann seinen Standort nicht ermitteln. Bitte den Ort suchen.');
  let pos: GeolocationPosition;
  try {
    pos = await position({ enableHighAccuracy: false, timeout: 12_000, maximumAge: 60 * 60_000 });
  } catch (e) {
    const err = e as GeolocationPositionError;
    if (err.code === err.PERMISSION_DENIED) throw denied();
    try {
      pos = await position({ enableHighAccuracy: true, timeout: 25_000, maximumAge: 0 });
    } catch (e2) {
      const err2 = e2 as GeolocationPositionError;
      if (err2.code === err2.PERMISSION_DENIED) throw denied();
      throw new LocateError(
        'Das Gerät konnte seinen Standort gerade nicht bestimmen. Ist WLAN eingeschaltet? Sonst den Ort einfach suchen.',
        isApple() ? ['Einstellungen → Datenschutz & Sicherheit → Ortungsdienste muss eingeschaltet sein.'] : undefined,
      );
    }
  }
  return { lat: pos.coords.latitude, lon: pos.coords.longitude };
}

function denied() {
  return new LocateError(
    'Der Zugriff auf den Standort ist nicht erlaubt.',
    isApple()
      ? [
          'Einstellungen → Datenschutz & Sicherheit → Ortungsdienste: einschalten.',
          'Darunter „Safari-Websites“ (bzw. den Browser) auf „Beim Verwenden der App“ stellen.',
          'In Safari: „aA“ bzw. Seiteneinstellungen → Standort → „Erlauben“ oder „Fragen“.',
          'Danach die Seite neu laden und es noch einmal versuchen – oder den Ort einfach suchen.',
        ]
      : ['Im Browser beim Schloss-Symbol neben der Adresse den Standort erlauben, dann erneut versuchen – oder den Ort suchen.'],
  );
}

/* ------------------------------------------------------------------ fetching */

const POLLEN: PollenType[] = ['alder', 'birch', 'grass', 'mugwort', 'ragweed'];

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

interface ForecastJson {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    is_day: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    wind_direction_10m: number;
    relative_humidity_2m: number;
    precipitation: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    is_day: number[];
    precipitation_probability: (number | null)[];
    precipitation: (number | null)[];
    uv_index: (number | null)[];
    apparent_temperature: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    wind_direction_10m: number[];
    relative_humidity_2m: number[];
    cloud_cover: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    precipitation_sum: (number | null)[];
    uv_index_max: (number | null)[];
    sunrise: string[];
    sunset: string[];
  };
}

async function fetchForecast(p: Place) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
    '&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,precipitation' +
    '&hourly=temperature_2m,weather_code,is_day,precipitation_probability,precipitation,uv_index,apparent_temperature,' +
    'wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,cloud_cover' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,uv_index_max,sunrise,sunset' +
    '&timezone=Europe%2FBerlin&past_days=1&forecast_days=8';
  const j = await getJson<ForecastJson>(url);
  const c = j.current;
  const h = j.hourly;
  const d = j.daily;
  return {
    current: {
      time: c.time,
      temp: c.temperature_2m,
      feels: c.apparent_temperature,
      code: c.weather_code,
      isDay: c.is_day === 1,
      wind: c.wind_speed_10m,
      gusts: c.wind_gusts_10m,
      windDir: c.wind_direction_10m,
      humidity: c.relative_humidity_2m,
      precipitation: c.precipitation,
    },
    hours: h.time.map((time, i) => ({
      time,
      temp: h.temperature_2m[i],
      code: h.weather_code[i],
      isDay: h.is_day[i] === 1,
      rainProb: h.precipitation_probability[i] ?? 0,
      rain: h.precipitation[i] ?? 0,
      uv: h.uv_index[i] ?? 0,
      feels: h.apparent_temperature[i],
      wind: h.wind_speed_10m[i],
      gusts: h.wind_gusts_10m[i],
      windDir: h.wind_direction_10m[i],
      humidity: h.relative_humidity_2m[i],
      cloud: h.cloud_cover[i],
    })),
    days: d.time.map((date, i) => ({
      date,
      code: d.weather_code[i],
      max: d.temperature_2m_max[i],
      min: d.temperature_2m_min[i],
      rainProb: d.precipitation_probability_max[i] ?? 0,
      rainSum: d.precipitation_sum[i] ?? 0,
      uvMax: d.uv_index_max[i] ?? 0,
      sunrise: d.sunrise[i],
      sunset: d.sunset[i],
    })),
  };
}

async function fetchPollen(p: Place): Promise<PollenDay[]> {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${p.lat}&longitude=${p.lon}` +
    `&hourly=${POLLEN.map((t) => `${t}_pollen`).join(',')}&timezone=Europe%2FBerlin&forecast_days=4`;
  const j = await getJson<{ hourly: Record<string, (number | null)[]> & { time: string[] } }>(url);
  const byDay = new Map<string, Record<PollenType, number>>();
  j.hourly.time.forEach((t, i) => {
    const date = t.slice(0, 10);
    const rec = byDay.get(date) ?? { alder: 0, birch: 0, grass: 0, mugwort: 0, ragweed: 0 };
    for (const type of POLLEN) rec[type] = Math.max(rec[type], j.hourly[`${type}_pollen`]?.[i] ?? 0);
    byDay.set(date, rec);
  });
  return [...byDay].map(([date, values]) => ({ date, values }));
}

interface AlertsJson {
  alerts: {
    id: number;
    severity: Alert['severity'];
    event_de: string;
    headline_de: string;
    description_de: string;
    instruction_de: string | null;
    onset: string;
    expires: string | null;
  }[];
  location?: { name?: string };
}

async function fetchAlerts(p: Place): Promise<{ alerts: Alert[]; warnCell?: string }> {
  const j = await getJson<AlertsJson>(`https://api.brightsky.dev/alerts?lat=${p.lat}&lon=${p.lon}&tz=Europe/Berlin`);
  return {
    warnCell: j.location?.name,
    alerts: (j.alerts ?? []).map((a) => ({
      id: a.id,
      severity: a.severity,
      event: a.event_de,
      headline: a.headline_de,
      description: a.description_de,
      instruction: a.instruction_de ?? '',
      onset: a.onset,
      expires: a.expires,
    })),
  };
}

/* ------------------------------------------------------------------ data store */

interface Entry {
  data: WeatherData | null;
  loading: boolean;
  error?: string;
  lastTry: number;
}

const cache = new Map<string, Entry>();

function entry(id: string): Entry {
  let e = cache.get(id);
  if (!e) {
    let data: WeatherData | null = null;
    try {
      data = JSON.parse(localStorage.getItem(DATA_KEY + id) ?? 'null');
    } catch {
      /* ignore */
    }
    e = { data, loading: false, lastTry: 0 };
    cache.set(id, e);
  }
  return e;
}

function put(id: string, patch: Partial<Entry>) {
  cache.set(id, { ...entry(id), ...patch });
  emit();
}

/** Fetches a place if its data is stale (or `force`). Errors keep the last data. */
export async function refresh(place: Place, force = false) {
  const e = entry(place.id);
  if (e.loading) return;
  const now = Date.now();
  if (!force) {
    if (e.data && now - e.data.fetchedAt < STALE_MS) return;
    if (e.error && now - e.lastTry < RETRY_MS) return;
  }
  put(place.id, { loading: true, lastTry: now });
  const [forecast, pollen, alerts] = await Promise.allSettled([fetchForecast(place), fetchPollen(place), fetchAlerts(place)]);
  if (forecast.status === 'rejected') {
    put(place.id, {
      loading: false,
      error: navigator.onLine ? 'Das Wetter konnte nicht geladen werden.' : 'Keine Internetverbindung.',
    });
    return;
  }
  const data: WeatherData = {
    fetchedAt: Date.now(),
    ...forecast.value,
    pollen: pollen.status === 'fulfilled' ? pollen.value : (e.data?.pollen ?? null),
    alerts: alerts.status === 'fulfilled' ? alerts.value.alerts : null,
    warnCell: alerts.status === 'fulfilled' ? alerts.value.warnCell : e.data?.warnCell,
  };
  try {
    localStorage.setItem(DATA_KEY + place.id, JSON.stringify(data));
  } catch {
    /* full – memory only */
  }
  put(place.id, { data, loading: false, error: undefined });
}

const EMPTY: Entry = { data: null, loading: false, lastTry: 0 };

/**
 * Weather of a place; fetches when stale and re-checks every few minutes.
 * Many components may use it for the same place – only one request runs.
 */
export function useWeather(place: Place | undefined): Entry {
  const e = useSyncExternalStore(subscribe, () => (place ? entry(place.id) : EMPTY));
  useEffect(() => {
    if (!place) return;
    refresh(place);
    const t = setInterval(() => refresh(place), 5 * 60_000);
    const onVis = () => document.visibilityState === 'visible' && refresh(place);
    const onOnline = () => refresh(place, true);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
    };
    // the coordinates identify the request; a rename must not refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.id, place?.lat, place?.lon]);
  return e;
}

/** Weather of the home place (first in the list). */
export function useHomeWeather() {
  const { places } = useWeatherSettings();
  const home = places[0];
  return { place: home, ...useWeather(home) };
}

/** Daily forecast of the home place by `yyyy-mm-dd`, for the calendar's day columns. */
export function useHomeDays(): Map<string, Day> {
  const { data } = useHomeWeather();
  const map = new Map<string, Day>();
  data?.days.forEach((d) => map.set(d.date, d));
  return map;
}

/* ------------------------------------------------------------------ presentation helpers */

/** WMO weather code -> German text + emoji (night variant for clear/partly cloudy). */
export function describe(code: number, isDay = true): { text: string; icon: string } {
  const night = !isDay;
  switch (code) {
    case 0:
      return { text: 'Klar', icon: night ? '🌙' : '☀️' };
    case 1:
      return { text: 'Überwiegend klar', icon: night ? '🌙' : '🌤️' };
    case 2:
      return { text: 'Teilweise bewölkt', icon: night ? '☁️' : '⛅' };
    case 3:
      return { text: 'Bedeckt', icon: '☁️' };
    case 45:
    case 48:
      return { text: 'Nebel', icon: '🌫️' };
    case 51:
    case 53:
    case 55:
      return { text: 'Nieselregen', icon: '🌦️' };
    case 56:
    case 57:
      return { text: 'Gefrierender Niesel', icon: '🌧️' };
    case 61:
      return { text: 'Leichter Regen', icon: '🌦️' };
    case 63:
      return { text: 'Regen', icon: '🌧️' };
    case 65:
      return { text: 'Starker Regen', icon: '🌧️' };
    case 66:
    case 67:
      return { text: 'Gefrierender Regen', icon: '🌧️' };
    case 71:
      return { text: 'Leichter Schneefall', icon: '🌨️' };
    case 73:
      return { text: 'Schneefall', icon: '🌨️' };
    case 75:
      return { text: 'Starker Schneefall', icon: '❄️' };
    case 77:
      return { text: 'Schneegriesel', icon: '🌨️' };
    case 80:
      return { text: 'Regenschauer', icon: '🌦️' };
    case 81:
      return { text: 'Kräftige Schauer', icon: '🌧️' };
    case 82:
      return { text: 'Heftige Schauer', icon: '⛈️' };
    case 85:
    case 86:
      return { text: 'Schneeschauer', icon: '🌨️' };
    case 95:
      return { text: 'Gewitter', icon: '⛈️' };
    case 96:
    case 99:
      return { text: 'Gewitter mit Hagel', icon: '⛈️' };
    default:
      return { text: '–', icon: '🌡️' };
  }
}

export const deg = (t: number) => `${Math.round(t)}°`;

export type Level = 0 | 1 | 2 | 3 | 4;

/** UV index -> WHO level 0 (none) … 4 (very high / extreme). */
export function uvLevel(uv: number): { level: Level; label: string } {
  if (uv < 0.5) return { level: 0, label: 'keine' };
  if (uv < 3) return { level: 1, label: 'niedrig' };
  if (uv < 6) return { level: 2, label: 'mittel' };
  if (uv < 8) return { level: 3, label: 'hoch' };
  return { level: 4, label: uv < 11 ? 'sehr hoch' : 'extrem' };
}

/** Hours of a day with UV ≥ 3 ("Sonnenschutz nötig"), e.g. "11–16 Uhr". */
export function protectionWindow(hours: Hour[], date: string): string | null {
  const hs = hours.filter((h) => h.time.startsWith(date) && h.uv >= 3).map((h) => Number(h.time.slice(11, 13)));
  if (!hs.length) return null;
  return `${Math.min(...hs)}–${Math.max(...hs) + 1} Uhr`;
}

export const POLLEN_TYPES: { id: PollenType; label: string; limits: [number, number, number] }[] = [
  // grains/m³ for gering / mittel / hoch (rough thresholds used by European pollen services)
  { id: 'alder', label: 'Erle', limits: [1, 10, 100] },
  { id: 'birch', label: 'Birke', limits: [1, 10, 100] },
  { id: 'grass', label: 'Gräser', limits: [1, 10, 50] },
  { id: 'mugwort', label: 'Beifuß', limits: [1, 10, 50] },
  { id: 'ragweed', label: 'Ambrosia', limits: [1, 5, 20] },
];

export const POLLEN_LABELS = ['keine', 'gering', 'mittel', 'hoch'] as const;

export function pollenLevel(type: PollenType, value: number): 0 | 1 | 2 | 3 {
  const l = POLLEN_TYPES.find((t) => t.id === type)!.limits;
  if (value < l[0]) return 0;
  if (value < l[1]) return 1;
  if (value < l[2]) return 2;
  return 3;
}

export const SEVERITY_LABEL: Record<Alert['severity'], string> = {
  minor: 'Wetterwarnung',
  moderate: 'Markante Wetterwarnung',
  severe: 'Unwetterwarnung',
  extreme: 'Extreme Unwetterwarnung',
};

/** Alerts that are still valid at `now`. */
export function activeAlerts(data: WeatherData | null, now: Date): Alert[] {
  return (data?.alerts ?? []).filter((a) => !a.expires || new Date(a.expires) > now);
}

export const fmtTime = (iso: string) => iso.slice(11, 16);
