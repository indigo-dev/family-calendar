import { t } from '../i18n';
/**
 * Weather icon styles. The files live in public/weather-icons/<set>/<key>.<ext> and are fetched by
 * scripts/fetch-weather-icons.mjs – nothing is loaded from the internet at runtime.
 */
export type WeatherIconSet = 'mc-fill' | 'mc-flat' | 'mc-line' | 'mc-mono' | 'material' | 'fluent-3d' | 'fluent-flat' | 'system';

export type WeatherKey =
  | 'clear-day'
  | 'clear-night'
  | 'partly-cloudy-day'
  | 'partly-cloudy-night'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'sleet'
  | 'rain'
  | 'partly-cloudy-day-rain'
  | 'partly-cloudy-night-rain'
  | 'snow'
  | 'partly-cloudy-day-snow'
  | 'partly-cloudy-night-snow'
  | 'thunderstorms-day-rain'
  | 'thunderstorms-night-rain'
  | 'hail';

export interface WeatherIconSetInfo {
  id: WeatherIconSet;
  label: string;
  note: string;
  /** image = coloured file, mask = one-colour shape in the text colour, native = device emoji */
  mode: 'image' | 'mask' | 'native';
  ext?: 'svg' | 'png';
  /** the Meteocons draw with a margin inside their box – shown a bit larger */
  padded?: boolean;
}

const SETS: Omit<WeatherIconSetInfo, 'label' | 'note'>[] = [
  { id: 'mc-fill', mode: 'image', ext: 'svg', padded: true },
  { id: 'mc-flat', mode: 'image', ext: 'svg', padded: true },
  { id: 'mc-line', mode: 'image', ext: 'svg', padded: true },
  { id: 'mc-mono', mode: 'mask', ext: 'svg', padded: true },
  { id: 'material', mode: 'mask', ext: 'svg' },
  { id: 'fluent-3d', mode: 'image', ext: 'png' },
  { id: 'fluent-flat', mode: 'image', ext: 'svg' },
  { id: 'system', mode: 'native' },
];

/** the sets with name and note in the active language */
export const WEATHER_ICON_SETS: WeatherIconSetInfo[] = SETS.map((s) => ({
  ...s,
  get label() {
    return t(`weatherSets.${s.id}.label`);
  },
  get note() {
    return t(`weatherSets.${s.id}.note`);
  },
}));

export const DEFAULT_WEATHER_ICONS: WeatherIconSet = 'mc-fill';

export function isWeatherIconSet(v: unknown): v is WeatherIconSet {
  return WEATHER_ICON_SETS.some((s) => s.id === v);
}

/** WMO weather code (+ day/night) -> icon key */
export function weatherKey(code: number, isDay = true): WeatherKey {
  const dn = isDay ? 'day' : 'night';
  if (code === 0) return isDay ? 'clear-day' : 'clear-night';
  if (code === 1 || code === 2) return `partly-cloudy-${dn}`;
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 55) return 'drizzle';
  if (code === 56 || code === 57 || code === 66 || code === 67) return 'sleet';
  if (code >= 61 && code <= 65) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return `partly-cloudy-${dn}-rain`;
  if (code === 85 || code === 86) return `partly-cloudy-${dn}-snow`;
  if (code === 95) return `thunderstorms-${dn}-rain`;
  if (code === 96 || code === 99) return 'hail';
  return 'overcast';
}

const EMOJI: Record<WeatherKey, string> = {
  'clear-day': '☀️',
  'clear-night': '🌙',
  'partly-cloudy-day': '⛅',
  'partly-cloudy-night': '☁️',
  overcast: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  sleet: '🌧️',
  rain: '🌧️',
  'partly-cloudy-day-rain': '🌦️',
  'partly-cloudy-night-rain': '🌧️',
  snow: '🌨️',
  'partly-cloudy-day-snow': '🌨️',
  'partly-cloudy-night-snow': '🌨️',
  'thunderstorms-day-rain': '⛈️',
  'thunderstorms-night-rain': '⛈️',
  hail: '⛈️',
};

export const weatherEmoji = (key: WeatherKey) => EMOJI[key];

export function weatherIconSrc(set: WeatherIconSetInfo, key: WeatherKey): string {
  return `weather-icons/${set.id}/${key}.${set.ext}`;
}

/** Rough sky mood of a key – drives the gradient behind the big icon. */
export function skyOf(key: WeatherKey): 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog' | 'night' {
  if (key.endsWith('night') || key === 'clear-night') return 'night';
  if (key.startsWith('thunder') || key === 'hail') return 'storm';
  if (key.includes('snow') || key === 'sleet') return key.includes('night') ? 'night' : 'snow';
  if (key.includes('rain') || key === 'drizzle') return key.includes('night') ? 'night' : 'rain';
  if (key === 'fog') return 'fog';
  if (key === 'overcast') return 'cloudy';
  if (key.includes('night')) return 'night';
  return key === 'clear-day' ? 'clear' : 'cloudy';
}
