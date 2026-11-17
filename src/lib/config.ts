import type { AppConfig, Member, Settings } from '../types';

const CONFIG_KEY = 'fc.config.v1';

export const PALETTE = [
  '#3b82f6', '#e8613c', '#22a06b', '#a855f7', '#eab308', '#ec4899',
  '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#ef4444', '#64748b',
];

export const EMOJIS = [
  '👨', '👩', '👧', '👦', '👶', '👴', '👵', '🧑',
  '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵',
  '🐶', '🐱', '🦄', '🐝', '🐢', '🐬', '🦖', '🐙',
  '⚽', '🎸', '🎨', '📚', '🚀', '🌻', '⭐', '❤️',
];

export const DEFAULT_SETTINGS: Settings = {
  clientId: '',
  authority: 'common',
  loginMode: 'redirect',
  weekStartsOn: 1,
  dayStartHour: 6,
  dayEndHour: 22,
  defaultView: 'week',
  refreshMinutes: 5,
  idleResetMinutes: 3,
  keepAwake: true,
  theme: 'auto',
};

export function defaultConfig(): AppConfig {
  return { schemaVersion: 1, settings: { ...DEFAULT_SETTINGS }, members: [] };
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function newMember(existing: Member[]): Member {
  const used = new Set(existing.map((m) => m.color));
  const color = PALETTE.find((c) => !used.has(c)) ?? PALETTE[existing.length % PALETTE.length];
  return {
    id: uid(),
    name: `Person ${existing.length + 1}`,
    color,
    avatar: { type: 'initials' },
    source: 'outlook',
    calendars: [],
  };
}

export function demoMembers(): Member[] {
  return [
    { id: uid(), name: 'Papa', color: '#3b82f6', avatar: { type: 'emoji', value: '👨' }, source: 'demo', calendars: [] },
    { id: uid(), name: 'Mama', color: '#e8613c', avatar: { type: 'emoji', value: '👩' }, source: 'demo', calendars: [] },
    { id: uid(), name: 'Lena', color: '#a855f7', avatar: { type: 'emoji', value: '🦄' }, source: 'demo', calendars: [] },
    { id: uid(), name: 'Max', color: '#22a06b', avatar: { type: 'emoji', value: '🦖' }, source: 'demo', calendars: [] },
  ];
}

/** Validates and normalises an unknown object (from localStorage or an imported file). */
export function parseConfig(raw: unknown): AppConfig {
  if (!raw || typeof raw !== 'object') throw new Error('Keine gültige Konfiguration.');
  const obj = raw as Partial<AppConfig>;
  if (obj.schemaVersion !== 1) throw new Error('Unbekannte Konfigurationsversion.');
  if (!Array.isArray(obj.members)) throw new Error('Familienmitglieder fehlen.');
  const members: Member[] = obj.members
    .filter((m): m is Member => !!m && typeof m === 'object' && typeof (m as Member).id === 'string')
    .map((m): Member => ({
      id: m.id,
      name: String(m.name ?? ''),
      color: typeof m.color === 'string' ? m.color : PALETTE[0],
      avatar: m.avatar && typeof m.avatar === 'object' ? m.avatar : { type: 'initials' },
      source: m.source === 'demo' ? 'demo' : 'outlook',
      account: m.account,
      calendars: Array.isArray(m.calendars) ? m.calendars : [],
    }));
  return {
    schemaVersion: 1,
    settings: { ...DEFAULT_SETTINGS, ...(obj.settings ?? {}) },
    members,
  };
}

export function loadConfig(): AppConfig {
  try {
    const s = localStorage.getItem(CONFIG_KEY);
    if (s) return parseConfig(JSON.parse(s));
  } catch (e) {
    console.warn('Konfiguration konnte nicht geladen werden', e);
  }
  return defaultConfig();
}

export function saveConfig(cfg: AppConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.warn('Konfiguration konnte nicht gespeichert werden', e);
  }
}

export function exportConfig(cfg: AppConfig): void {
  const payload = { ...cfg, exportedAt: new Date().toISOString(), app: 'family-calendar' };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  a.href = url;
  a.download = `familienkalender-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function readConfigFile(file: File): Promise<AppConfig> {
  const text = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.');
  }
  return parseConfig(json);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Resizes an uploaded photo to a square JPEG data URL (keeps the config small). */
export function imageFileToAvatar(file: File, size = 192): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas nicht verfügbar'));
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Bild konnte nicht gelesen werden'));
    };
    img.src = url;
  });
}
