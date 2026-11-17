import type { Account, AccountKind, AppConfig, CalendarSource, HolidaySettings, Member, Settings } from '../types';

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

export const ACCOUNT_KINDS: Record<AccountKind, { label: string; icon: string; help: string }> = {
  microsoft: {
    label: 'Microsoft privat (Outlook.com / Live / Hotmail)',
    icon: '📧',
    help:
      'outlook.live.com → Einstellungen (Zahnrad) → Kalender → Freigegebene Kalender → „Kalender veröffentlichen“: Kalender wählen, ' +
      '„Kann alle Details anzeigen“, Veröffentlichen. Den ICS-Link kopieren.',
  },
  'microsoft-work': {
    label: 'Microsoft geschäftlich (Microsoft 365)',
    icon: '🏢',
    help:
      'outlook.office.com → Einstellungen → Kalender → Freigegebene Kalender → „Kalender veröffentlichen“ → ICS-Link kopieren. ' +
      'Fehlt die Option, hat die IT das Veröffentlichen gesperrt.',
  },
  google: {
    label: 'Google (Gmail)',
    icon: '📅',
    help:
      'calendar.google.com am Computer → Zahnrad → Einstellungen → links den Kalender wählen → „Kalender integrieren“ → ' +
      '„Privatadresse im iCal-Format“ kopieren.',
  },
  icloud: {
    label: 'Apple iCloud',
    icon: '🍏',
    help: 'Kalender-App → Info neben dem Kalender → „Öffentlicher Kalender“ aktivieren → Link teilen/kopieren.',
  },
  other: {
    label: 'Anderer Kalender (ICS-Link)',
    icon: '🔗',
    help: 'Jeder Abo-Link, der mit https:// oder webcal:// beginnt und auf .ics endet bzw. einen iCal-Kalender liefert.',
  },
};

export const REGIONS: [code: string, name: string][] = [
  ['DE-BW', 'Baden-Württemberg'],
  ['DE-BY', 'Bayern'],
  ['DE-BE', 'Berlin'],
  ['DE-BB', 'Brandenburg'],
  ['DE-HB', 'Bremen'],
  ['DE-HH', 'Hamburg'],
  ['DE-HE', 'Hessen'],
  ['DE-MV', 'Mecklenburg-Vorpommern'],
  ['DE-NI', 'Niedersachsen'],
  ['DE-NW', 'Nordrhein-Westfalen'],
  ['DE-RP', 'Rheinland-Pfalz'],
  ['DE-SL', 'Saarland'],
  ['DE-SN', 'Sachsen'],
  ['DE-ST', 'Sachsen-Anhalt'],
  ['DE-SH', 'Schleswig-Holstein'],
  ['DE-TH', 'Thüringen'],
];

export const DEFAULT_HOLIDAYS: HolidaySettings = { region: '', showPublic: true, showSchool: true };

export const DEFAULT_SETTINGS: Settings = {
  proxyUrl: '',
  holidays: { ...DEFAULT_HOLIDAYS },
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
  return { schemaVersion: 2, settings: { ...DEFAULT_SETTINGS, holidays: { ...DEFAULT_HOLIDAYS } }, members: [], accounts: [], calendars: [] };
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function newMember(existing: Member[]): Member {
  const used = new Set(existing.map((m) => m.color));
  const color = PALETTE.find((c) => !used.has(c)) ?? PALETTE[existing.length % PALETTE.length];
  return { id: uid(), name: `Person ${existing.length + 1}`, color, avatar: { type: 'initials' } };
}

export function newAccount(kind: AccountKind, label: string): Account {
  return { id: uid(), kind, label: label.trim() || ACCOUNT_KINDS[kind].label };
}

export function newCalendar(accountId: string, name: string, url: string, memberIds: string[] = []): CalendarSource {
  return { id: uid(), accountId, name: name.trim() || 'Kalender', url: url.trim(), memberIds, enabled: true };
}

export function demoMembers(): Member[] {
  return [
    { id: uid(), name: 'Papa', color: '#3b82f6', avatar: { type: 'emoji', value: '👨' }, demo: true },
    { id: uid(), name: 'Mama', color: '#e8613c', avatar: { type: 'emoji', value: '👩' }, demo: true },
    { id: uid(), name: 'Lena', color: '#a855f7', avatar: { type: 'emoji', value: '🦄' }, demo: true },
    { id: uid(), name: 'Max', color: '#22a06b', avatar: { type: 'emoji', value: '🦖' }, demo: true },
  ];
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

function parseMember(raw: unknown): Member | null {
  const m = obj(raw);
  if (typeof m.id !== 'string') return null;
  return {
    id: m.id,
    name: str(m.name),
    color: str(m.color, PALETTE[0]),
    avatar: m.avatar && typeof m.avatar === 'object' ? (m.avatar as Member['avatar']) : { type: 'initials' },
    // v1 stored demo members as source: 'demo'
    demo: m.demo === true || m.source === 'demo' || undefined,
  };
}

/** Validates and normalises an unknown object (from localStorage or an imported file). Migrates version 1. */
export function parseConfig(raw: unknown): AppConfig {
  if (!raw || typeof raw !== 'object') throw new Error('Keine gültige Konfiguration.');
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== 1 && o.schemaVersion !== 2) throw new Error('Unbekannte Konfigurationsversion.');
  if (!Array.isArray(o.members)) throw new Error('Familienmitglieder fehlen.');
  const members = o.members.map(parseMember).filter((m): m is Member => !!m);
  const memberIds = new Set(members.map((m) => m.id));

  const accounts: Account[] = (Array.isArray(o.accounts) ? o.accounts : [])
    .map(obj)
    .filter((a) => typeof a.id === 'string')
    .map((a) => ({
      id: a.id as string,
      kind: (Object.keys(ACCOUNT_KINDS).includes(str(a.kind)) ? a.kind : 'other') as AccountKind,
      label: str(a.label, 'Konto'),
    }));
  const accountIds = new Set(accounts.map((a) => a.id));

  const calendars: CalendarSource[] = (Array.isArray(o.calendars) ? o.calendars : [])
    .map(obj)
    .filter((c) => typeof c.id === 'string' && accountIds.has(str(c.accountId)))
    .map((c) => ({
      id: c.id as string,
      accountId: c.accountId as string,
      name: str(c.name, 'Kalender'),
      url: str(c.url),
      memberIds: (Array.isArray(c.memberIds) ? c.memberIds : []).filter((id): id is string => typeof id === 'string' && memberIds.has(id)),
      enabled: c.enabled !== false,
    }));

  const s = obj(o.settings);
  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (k in s && typeof s[k] === typeof DEFAULT_SETTINGS[k]) (settings as unknown as Record<string, unknown>)[k] = s[k];
  }
  settings.holidays = { ...DEFAULT_HOLIDAYS, ...obj(s.holidays) } as HolidaySettings;

  return { schemaVersion: 2, settings, members, accounts, calendars };
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
