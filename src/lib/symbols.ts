import manifest from './symbol-manifest.json';

/**
 * Symbol styles for emoji (shopping catalogue, departments, ...). The files live in
 * public/symbols/<set>/ and are fetched by scripts/fetch-symbols.mjs – nothing is loaded from the internet.
 */
export type SymbolSet =
  | 'system'
  | 'fluent-3d'
  | 'fluent-color'
  | 'fluent-flat'
  | 'noto'
  | 'noto-3d'
  | 'twemoji'
  | 'openmoji'
  | 'fluent-mono'
  | 'openmoji-line'
  | 'tabler'
  | 'phosphor'
  | 'phosphor-duotone'
  | 'lucide';

/** 'image' = coloured picture, 'mask' = one-colour shape tinted via CSS (department colour) */
type Mode = 'native' | 'image' | 'mask';

export interface SymbolSetInfo {
  id: SymbolSet;
  label: string;
  group: 'Farbig' | 'Einfarbig' | 'Strich-Icons';
  mode: Mode;
  ext?: 'svg' | 'png';
  note?: string;
}

export const SYMBOL_SETS: SymbolSetInfo[] = [
  {
    id: 'system',
    label: 'Gerät (Standard)',
    group: 'Farbig',
    mode: 'native',
    note: 'Emoji des Geräts – sieht auf iPad, Windows und Android verschieden aus',
  },
  { id: 'fluent-3d', label: 'Fluent 3D', group: 'Farbig', mode: 'image', ext: 'png', note: 'Plastisch, 3D' },
  { id: 'fluent-color', label: 'Fluent Farbig', group: 'Farbig', mode: 'image', ext: 'svg', note: 'Mit Farbverläufen' },
  { id: 'fluent-flat', label: 'Fluent Flach', group: 'Farbig', mode: 'image', ext: 'svg', note: 'Flache Farben' },
  { id: 'noto-3d', label: 'Noto 3D', group: 'Farbig', mode: 'image', ext: 'png', note: 'Plastisch, weich' },
  { id: 'noto', label: 'Noto', group: 'Farbig', mode: 'image', ext: 'svg', note: 'Rund und freundlich' },
  { id: 'twemoji', label: 'Twemoji', group: 'Farbig', mode: 'image', ext: 'svg', note: 'Flach und kräftig' },
  { id: 'openmoji', label: 'OpenMoji', group: 'Farbig', mode: 'image', ext: 'svg', note: 'Gezeichnet, mit Umriss' },
  { id: 'fluent-mono', label: 'Fluent Einfarbig', group: 'Einfarbig', mode: 'mask', ext: 'svg', note: 'In der Farbe der Abteilung' },
  { id: 'openmoji-line', label: 'OpenMoji Umriss', group: 'Einfarbig', mode: 'mask', ext: 'svg', note: 'In der Farbe der Abteilung' },
  { id: 'tabler', label: 'Tabler', group: 'Strich-Icons', mode: 'mask', ext: 'svg', note: 'Gleichmäßige Linien' },
  { id: 'phosphor', label: 'Phosphor', group: 'Strich-Icons', mode: 'mask', ext: 'svg', note: 'Weiche Linien' },
  { id: 'phosphor-duotone', label: 'Phosphor Duoton', group: 'Strich-Icons', mode: 'mask', ext: 'svg', note: 'Linien mit Flächen' },
  { id: 'lucide', label: 'Lucide', group: 'Strich-Icons', mode: 'mask', ext: 'svg', note: 'Schlicht, viele Lebensmittel' },
];

export const DEFAULT_SYMBOL_SET: SymbolSet = 'system';

const available = new Map<string, Set<string>>(
  Object.entries(manifest as Record<string, string[]>).map(([set, keys]) => [set, new Set(keys)]),
);
const infoById = new Map(SYMBOL_SETS.map((s) => [s.id, s]));

export function isSymbolSet(v: unknown): v is SymbolSet {
  return typeof v === 'string' && infoById.has(v as SymbolSet);
}

/** code points without FE0F, lower-case hex, joined by '-' (same as the fetch script) */
export function emojiKey(e: string): string {
  return [...e]
    .map((c) => c.codePointAt(0)!)
    .filter((cp) => cp !== 0xfe0f)
    .map((cp) => cp.toString(16))
    .join('-');
}

export type Resolved = { mode: 'native'; text: string } | { mode: 'image' | 'mask'; src: string };

/** Picks the file for an emoji in a set; falls back to `fallback` (e.g. the department), then to the device emoji. */
export function resolveSymbol(set: SymbolSet, emoji: string, fallback?: string): Resolved {
  const info = infoById.get(set);
  if (info && info.mode !== 'native') {
    for (const e of fallback ? [emoji, fallback] : [emoji]) {
      const key = emojiKey(e);
      if (available.get(set)?.has(key)) return { mode: info.mode, src: `symbols/${set}/${key}.${info.ext}` };
    }
  }
  return { mode: 'native', text: emoji };
}
