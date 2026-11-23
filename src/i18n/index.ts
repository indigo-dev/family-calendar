import { useSyncExternalStore } from 'react';
import { de } from './de';
import { en } from './en';

/*
 * A small typed translation layer. `de.ts` is the source of truth; every other language file is typed
 * against it (`Messages`), so a missing or misspelt key is a compile error. Texts are plain strings with
 * `{name}` placeholders; a text that depends on a count is a plural object ({ one, other, … }) picked
 * with Intl.PluralRules and the `n` parameter.
 *
 * Adding a language: add its file (typed `Messages`), list it in LANGUAGES and MESSAGES, and give it a
 * locale in `locale()`.
 */

/** Plural forms of one text; the categories a language needs (Intl.PluralRules), `zero` = exactly 0. */
export interface Plural {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

type Widen<T> = T extends string ? string : T extends { other: string } ? Plural : { [K in keyof T]: Widen<T[K]> };

/** Shape every language file must have (all keys of de.ts, plain strings or plural objects). */
export type Messages = Widen<typeof de>;

type Keys<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string | Plural ? `${P}${K}` : Keys<T[K], `${P}${K}.`>;
}[keyof T & string];

/** 'nav.calendar', 'todos.count', … */
export type MessageKey = Keys<Messages>;

export type Params = Record<string, string | number>;

export type Language = 'de' | 'en';
export type LanguageSetting = 'auto' | Language;

/** Selectable languages, each named in its own language. */
export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'de', label: 'Deutsch' },
  { id: 'en', label: 'English' },
];

const MESSAGES: Record<Language, Messages> = { de, en };

export const isLanguageSetting = (v: unknown): v is LanguageSetting => v === 'auto' || LANGUAGES.some((l) => l.id === v);

const deviceLanguages = (): readonly string[] =>
  typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language ?? ''];

/** 'auto' = the first device language the app speaks; a device in another language gets English. */
export function resolveLanguage(setting: LanguageSetting, device: readonly string[] = deviceLanguages()): Language {
  if (setting !== 'auto') return setting;
  for (const tag of device) {
    const base = tag.toLowerCase().split('-')[0];
    const hit = LANGUAGES.find((l) => l.id === base);
    if (hit) return hit.id;
  }
  return 'en';
}

/* ------------------------------------------------------------------ active language */

let lang: Language = 'de';
let localeTag = 'de-DE';
const listeners = new Set<() => void>();

/**
 * Locale for dates and numbers. German is always de-DE. English follows the device's English variant
 * (en-US: 12-hour clock, month before day; en-GB, en-AU, …: 24-hour clock), en-GB if the device has none.
 */
function localeFor(l: Language, device: readonly string[] = deviceLanguages()): string {
  if (l === 'de') return 'de-DE';
  const variant = device.find((tag) => /^en(-|$)/i.test(tag) && tag.length > 2);
  return variant ?? 'en-GB';
}

export const getLanguage = (): Language => lang;

/** BCP 47 tag for Intl (dates, numbers, sorting). */
export const locale = (): string => localeTag;

export function setLanguage(next: Language, device?: readonly string[]): void {
  const tag = localeFor(next, device);
  if (next === lang && tag === localeTag) return;
  lang = next;
  localeTag = tag;
  plural = undefined;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  listeners.forEach((l) => l());
}

export function onLanguageChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-renders the component when the language changes; returns the active language. */
export function useLanguage(): Language {
  return useSyncExternalStore(onLanguageChange, getLanguage, getLanguage);
}

/* ------------------------------------------------------------------ lookup */

let plural: Intl.PluralRules | undefined;

function lookup(messages: Messages, key: string): string | Plural | undefined {
  let v: unknown = messages;
  for (const part of key.split('.')) {
    if (!v || typeof v !== 'object') return undefined;
    v = (v as Record<string, unknown>)[part];
  }
  return typeof v === 'string' || (v && typeof v === 'object' && typeof (v as Plural).other === 'string')
    ? (v as string | Plural)
    : undefined;
}

/** Fills `{name}` placeholders; unknown placeholders stay as they are. */
export function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

function pick(forms: Plural, n: number): string {
  if (n === 0 && forms.zero !== undefined) return forms.zero;
  plural ??= new Intl.PluralRules(localeTag);
  return forms[plural.select(n) as keyof Plural] ?? forms.other;
}

/**
 * The text for `key` in the active language (German if a language lacks it), with `{name}` placeholders
 * filled from `params`. Plural texts choose their form by `params.n`.
 */
export function t(key: MessageKey, params?: Params): string {
  const v = lookup(MESSAGES[lang], key) ?? lookup(de, key);
  if (v === undefined) return key;
  const text = typeof v === 'string' ? v : pick(v, Number(params?.n ?? 0));
  return interpolate(text, params);
}

/**
 * Runs `fn` with another language active (texts, dates, plurals) without telling anyone –
 * for previews of a language and for texts that must be in a fixed language.
 */
export function withLanguage<T>(language: Language, fn: () => T): T {
  const prev = lang;
  const prevTag = localeTag;
  lang = language;
  localeTag = localeFor(language);
  plural = undefined;
  try {
    return fn();
  } finally {
    lang = prev;
    localeTag = prevTag;
    plural = undefined;
  }
}
