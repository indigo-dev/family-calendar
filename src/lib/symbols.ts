import manifest from './symbol-manifest.json';
import { t } from '../i18n';

/**
 * Symbol styles for emoji (shopping catalogue, departments, ...). The files live in
 * public/symbols/<set>/ and are fetched by scripts/fetch-symbols.mjs – nothing is loaded from the internet.
 */
export type SymbolSet =
  | 'fluent-3d'
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
  /** name and note in the active language */
  label: string;
  group: 'color' | 'mono' | 'line';
  mode: Mode;
  ext?: 'svg' | 'png';
  note?: string;
}

const SETS: Omit<SymbolSetInfo, 'label' | 'note'>[] = [
  { id: 'fluent-3d', group: 'color', mode: 'image', ext: 'png' },
  { id: 'fluent-flat', group: 'color', mode: 'image', ext: 'svg' },
  { id: 'noto-3d', group: 'color', mode: 'image', ext: 'png' },
  { id: 'noto', group: 'color', mode: 'image', ext: 'svg' },
  { id: 'twemoji', group: 'color', mode: 'image', ext: 'svg' },
  { id: 'openmoji', group: 'color', mode: 'image', ext: 'svg' },
  { id: 'fluent-mono', group: 'mono', mode: 'mask', ext: 'svg' },
  { id: 'openmoji-line', group: 'mono', mode: 'mask', ext: 'svg' },
  { id: 'tabler', group: 'line', mode: 'mask', ext: 'svg' },
  { id: 'phosphor', group: 'line', mode: 'mask', ext: 'svg' },
  { id: 'phosphor-duotone', group: 'line', mode: 'mask', ext: 'svg' },
  { id: 'lucide', group: 'line', mode: 'mask', ext: 'svg' },
];

export const SYMBOL_SETS: SymbolSetInfo[] = SETS.map((s) => ({
  ...s,
  get label() {
    return t(`symbolSets.${s.id}.label`);
  },
  get note() {
    return t(`symbolSets.${s.id}.note`);
  },
}));

export const DEFAULT_SYMBOL_SET: SymbolSet = 'twemoji';

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
