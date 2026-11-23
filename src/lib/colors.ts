import type { UiStyle } from '../types';

/**
 * Colour palettes. There is no palette setting: every UI style draws with its own palette.
 * Stored colours (people, subjects, shopping departments) stay unchanged in the config; `painter()` maps
 * them to the palette of the style when they are drawn. Colours from the base palette keep their slot
 * (Papa stays "the first colour"), other colours are mapped by hue.
 */

/** base palette – the vivid colours people pick from */
export const PALETTE = [
  '#3b82f6',
  '#e8613c',
  '#22a06b',
  '#a855f7',
  '#eab308',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
  '#ef4444',
  '#64748b',
];

/** "Edel": muted, slightly greyed tones in the spirit of fashion colour cards */
const MUTED = [
  '#4f6d9a', // Dusty Blue
  '#c4705a', // Terrakotta
  '#5f8a6e', // Salbei
  '#8b74a6', // Lavendel
  '#c9a24a', // Ocker
  '#c27a8e', // Altrosa
  '#4f8f8a', // Petrol
  '#d08a52', // Bernstein
  '#6c70a8', // Immergrün
  '#93a35e', // Moos
  '#a9545c', // Marsala
  '#7b8590', // Schiefer
];

/** HomeWally: the spectrum of the logo bars, completed to twelve slots in the same spirit */
const WALLY = [
  '#0ea5e9', // sky
  '#f43f5e', // rose
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ec4899', // pink
  '#14b8a6', // teal
  '#fb923c', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
  '#e11d48', // red
  '#64748b', // slate
];

export type ColorPalette = 'vivid' | 'muted' | 'wally';

/** the palette a UI style draws with */
export function stylePalette(style: UiStyle): ColorPalette {
  if (style === 'wally') return 'wally';
  if (style === 'minimal') return 'muted';
  return 'vivid';
}

/* ---------------------------------------------------------------- colour maths */

type Hsl = [h: number, s: number, l: number];

function hexToHsl(hex: string): Hsl | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  let v = m[1];
  if (v.length === 3) v = v.replace(/./g, (c) => c + c);
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s * 100, l * 100];
}

function hslToHex([h, s, l]: Hsl): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const x = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${x(f(0))}${x(f(8))}${x(f(4))}`;
}

const hueDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** slot of the base palette that is closest in hue (greys go to the grey slot) */
function nearestSlot(hsl: Hsl): number {
  if (hsl[1] < 12) return PALETTE.length - 1;
  let best = 0;
  let bestD = Infinity;
  PALETTE.slice(0, -1).forEach((c, i) => {
    const d = hueDist(hexToHsl(c)![0], hsl[0]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/* ---------------------------------------------------------------- schemes and painting */

/** A palette resolved to its twelve colours. Objects are cached, so equal settings give the same scheme. */
export interface ColorScheme {
  palette: ColorPalette;
  colors: string[];
}

/** Maps a stored colour to a scheme; undefined stays undefined. */
export interface Paint {
  (color: string): string;
  (color: string | undefined): string | undefined;
}

/** the twelve colours of a palette */
export function paletteColors(palette: ColorPalette): string[] {
  return palette === 'muted' ? MUTED : palette === 'wally' ? WALLY : PALETTE;
}

const schemes = new Map<ColorPalette, ColorScheme>();

export function colorScheme(palette: ColorPalette): ColorScheme {
  let s = schemes.get(palette);
  if (!s) {
    s = { palette, colors: paletteColors(palette) };
    schemes.set(palette, s);
  }
  return s;
}

function mapColor(scheme: ColorScheme, color: string): string {
  if (scheme.palette === 'vivid') return color;
  const slot = PALETTE.indexOf(color.toLowerCase());
  if (slot >= 0) return scheme.colors[slot];
  const hsl = hexToHsl(color);
  if (!hsl) return color;
  // muted: greyed, calmer and with medium lightness; wally: the nearest slot of the spectrum
  return scheme.palette === 'muted'
    ? hslToHex([hsl[0], Math.min(hsl[1] * 0.55, 48), 40 + (hsl[2] - 40) * 0.45])
    : scheme.colors[nearestSlot(hsl)];
}

const painters = new WeakMap<ColorScheme, Paint>();

/**
 * The paint function of a scheme (cached per scheme). Stored colours (people, subjects, shopping
 * departments) stay unchanged in the config and are only mapped when they are drawn.
 */
export function painter(scheme: ColorScheme): Paint {
  let p = painters.get(scheme);
  if (!p) {
    const cache = new Map<string, string>();
    p = ((color: string | undefined) => {
      if (!color) return color;
      const key = color.toLowerCase();
      let out = cache.get(key);
      if (out === undefined) {
        out = mapColor(scheme, color);
        cache.set(key, out);
      }
      return out;
    }) as Paint;
    painters.set(scheme, p);
  }
  return p;
}
