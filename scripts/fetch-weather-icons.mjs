// Downloads the weather icon sets into public/weather-icons/<set>/<key>.<ext>.
// The files are committed, so the app never loads icons from the internet.
//
//   node scripts/fetch-weather-icons.mjs           -> fetch what is missing
//   node scripts/fetch-weather-icons.mjs --force   -> fetch everything again
//
// Keys follow the Meteocons names; src/lib/weatherIcons.ts maps the WMO weather codes onto them.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

// pinned sources
const METEOCONS = 'https://cdn.jsdelivr.net/npm/@meteocons/svg@3.0.0-next.10';
const MATERIAL = 'https://cdn.jsdelivr.net/npm/@material-symbols/svg-400@0.44.4/rounded';
const FLUENT = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@1ffb34c752ecf5d402f04cfb4b392c77f57c54bc/assets';

export const KEYS = [
  'clear-day',
  'clear-night',
  'partly-cloudy-day',
  'partly-cloudy-night',
  'overcast',
  'fog',
  'drizzle',
  'sleet',
  'rain',
  'partly-cloudy-day-rain',
  'partly-cloudy-night-rain',
  'snow',
  'partly-cloudy-day-snow',
  'partly-cloudy-night-snow',
  'thunderstorms-day-rain',
  'thunderstorms-night-rain',
  'hail',
];

const MATERIAL_NAMES = {
  'clear-day': 'sunny',
  'clear-night': 'bedtime',
  'partly-cloudy-day': 'partly_cloudy_day',
  'partly-cloudy-night': 'partly_cloudy_night',
  overcast: 'cloud',
  fog: 'foggy',
  drizzle: 'rainy_light',
  sleet: 'weather_mix',
  rain: 'rainy',
  'partly-cloudy-day-rain': 'rainy_light',
  'partly-cloudy-night-rain': 'rainy_light',
  snow: 'weather_snowy',
  'partly-cloudy-day-snow': 'sunny_snowing',
  'partly-cloudy-night-snow': 'snowing',
  'thunderstorms-day-rain': 'thunderstorm',
  'thunderstorms-night-rain': 'thunderstorm',
  hail: 'weather_hail',
};

// Fluent emoji folder names (the emoji's English name)
const FLUENT_NAMES = {
  'clear-day': 'Sun',
  'clear-night': 'Crescent moon',
  'partly-cloudy-day': 'Sun behind cloud',
  'partly-cloudy-night': 'Cloud',
  overcast: 'Cloud',
  fog: 'Fog',
  drizzle: 'Cloud with rain',
  sleet: 'Cloud with snow',
  rain: 'Cloud with rain',
  'partly-cloudy-day-rain': 'Sun behind rain cloud',
  'partly-cloudy-night-rain': 'Cloud with rain',
  snow: 'Cloud with snow',
  'partly-cloudy-day-snow': 'Cloud with snow',
  'partly-cloudy-night-snow': 'Cloud with snow',
  'thunderstorms-day-rain': 'Cloud with lightning and rain',
  'thunderstorms-night-rain': 'Cloud with lightning and rain',
  hail: 'Cloud with lightning and rain',
};

const fluent = (style, ext) => (k) => {
  const name = FLUENT_NAMES[k];
  const file = `${name.toLowerCase().replace(/ /g, '_')}_${style.toLowerCase()}.${ext}`;
  return `${FLUENT}/${encodeURIComponent(name)}/${style}/${file}`;
};

const SETS = [
  { id: 'mc-fill', ext: 'svg', url: (k) => `${METEOCONS}/fill/${k}.svg` },
  { id: 'mc-flat', ext: 'svg', url: (k) => `${METEOCONS}/flat/${k}.svg` },
  { id: 'mc-line', ext: 'svg', url: (k) => `${METEOCONS}/line/${k}.svg` },
  { id: 'mc-mono', ext: 'svg', url: (k) => `${METEOCONS}/monochrome/${k}.svg` },
  { id: 'material', ext: 'svg', url: (k) => `${MATERIAL}/${MATERIAL_NAMES[k]}-fill.svg` },
  { id: 'fluent-3d', ext: 'png', url: fluent('3D', 'png') },
  { id: 'fluent-flat', ext: 'svg', url: fluent('Flat', 'svg') },
];

const force = process.argv.includes('--force');
const cache = new Map();

async function download(url) {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url).then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${url}`);
        return Buffer.from(await res.arrayBuffer());
      }),
    );
  }
  return cache.get(url);
}

let failed = 0;
for (const set of SETS) {
  const dir = `public/weather-icons/${set.id}`;
  mkdirSync(dir, { recursive: true });
  await Promise.all(
    KEYS.map(async (k) => {
      const file = `${dir}/${k}.${set.ext}`;
      if (!force && existsSync(file)) return;
      try {
        writeFileSync(file, await download(set.url(k)));
      } catch (e) {
        failed++;
        console.error(`✗ ${set.id}/${k}: ${e.message}`);
      }
    }),
  );
  console.log(`✓ ${set.id}`);
}
if (failed) process.exitCode = 1;
