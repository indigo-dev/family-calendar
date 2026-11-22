import { CATEGORIES, type CategoryId } from '../lib/shopping';
import { MODULES, type ModuleId } from '../components/ModuleNav';
import { isRecord } from '../lib/persisted';

/*
 * What the model returns for one spoken request – independent of the provider. The speech part
 * (audio → this structure) can be swapped without touching the rest.
 */

export interface ShopRequest {
  name: string;
  qty: number;
  /** only for items that are not in the pantry yet */
  category?: CategoryId;
}

export interface TodoRequest {
  text: string;
  /** names as spoken; empty = the whole family */
  members: string[];
  /** YYYY-MM-DD */
  due?: string;
}

export interface WeatherRequest {
  /** YYYY-MM-DD */
  date: string;
  /** place name as spoken; empty = home */
  place?: string;
}

export interface EventsRequest {
  /** YYYY-MM-DD, both inclusive */
  from: string;
  to: string;
  members: string[];
}

export interface Command {
  /** what was understood, shown to the user */
  transcript: string;
  shopping: ShopRequest[];
  todos: TodoRequest[];
  weather: WeatherRequest[];
  events: EventsRequest[];
  openModule?: ModuleId;
  /** short message when nothing else fits */
  reply?: string;
}

/** What the model needs to know about the app to map a request. */
export interface VoiceContext {
  now: Date;
  members: string[];
  places: string[];
  pantry: string[];
}

const CAT_IDS = CATEGORIES.map((c) => c.id);
const MODULE_IDS = MODULES.map((m) => m.id);

/** Response schema in the OpenAPI subset Gemini understands. */
export const COMMAND_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING', description: 'Wörtliche Abschrift des Gesagten' },
    shopping: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          qty: { type: 'INTEGER' },
          category: { type: 'STRING', enum: CAT_IDS },
        },
        required: ['name', 'qty'],
      },
    },
    todos: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          members: { type: 'ARRAY', items: { type: 'STRING' } },
          due: { type: 'STRING', description: 'YYYY-MM-DD' },
        },
        required: ['text'],
      },
    },
    weather: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING', description: 'YYYY-MM-DD' },
          place: { type: 'STRING' },
        },
        required: ['date'],
      },
    },
    events: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          from: { type: 'STRING', description: 'YYYY-MM-DD' },
          to: { type: 'STRING', description: 'YYYY-MM-DD' },
          members: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['from', 'to'],
      },
    },
    openModule: { type: 'STRING', enum: [...MODULE_IDS, 'none'] },
    reply: { type: 'STRING' },
  },
  required: ['transcript'],
} as const;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function buildPrompt(ctx: VoiceContext): string {
  const weekday = ctx.now.toLocaleDateString('de-DE', { weekday: 'long' });
  const list = (xs: string[], none: string) => (xs.length ? xs.join(', ') : none);
  return [
    'Du bist die Sprachsteuerung einer Familien-App (Kalender, Einkaufsliste, To-dos, Wetter, Stundenplan, Fotos).',
    'Du bekommst eine kurze deutsche Sprachaufnahme (oder Text) und füllst daraus die Antwort-Struktur.',
    '',
    `Heute ist ${weekday}, der ${ymd(ctx.now)}, ${pad(ctx.now.getHours())}:${pad(ctx.now.getMinutes())} Uhr.`,
    `Familienmitglieder: ${list(ctx.members, 'keine')}.`,
    `Wetter-Orte (der erste ist Zuhause): ${list(ctx.places, 'keine')}.`,
    `Artikel im Vorrat der Einkaufsliste: ${list(ctx.pantry, 'keine')}.`,
    '',
    'Regeln:',
    '- transcript: wörtlich, was gesagt wurde. Bei Stille oder Rauschen leer lassen und sonst nichts füllen.',
    '- shopping: Dinge für die Einkaufsliste. Passt ein Artikel aus dem Vorrat, nimm genau dessen Schreibweise',
    '  (auch bei Singular/Plural oder Umgangssprache, z. B. "ne Milch" → "Milch", "Apfel" → "Äpfel").',
    '  qty ist die Anzahl (ohne Angabe 1). Nur für neue Artikel category setzen.',
    '- todos: Aufgaben und Erinnerungen ("erinnere uns …", "auf die To-do-Liste"). text kurz und als Aufgabe formuliert.',
    '  members nur mit Namen aus der Familie, leer = alle. due nur bei genanntem Tag.',
    '- weather: Fragen zum Wetter, ein Eintrag pro Tag. place nur, wenn ein Ort genannt wird.',
    '- events: Fragen zu Terminen ("was steht morgen an?"). Zeiträume als from/to, z. B. "diese Woche" = heute bis Sonntag.',
    '- openModule: nur wenn ausdrücklich ein Bereich geöffnet werden soll ("zeig mir die Einkaufsliste"), sonst "none".',
    '- Relative Angaben wie "morgen", "übermorgen", "nächsten Dienstag" in Daten (YYYY-MM-DD) umrechnen.',
    '- reply: nur wenn die Bitte nicht zu den Bereichen passt oder unklar ist – ein kurzer, freundlicher Satz.',
    '- Termine anlegen geht nicht (die Kalender sind nur abonniert): dann reply mit einem Hinweis.',
  ].join('\n');
}

/* ------------------------------------------------------------------ validation */

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const isYmd = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00`).getTime());
const objs = (v: unknown) => (Array.isArray(v) ? v.filter(isRecord) : []);

/** Turns whatever the model returned into a valid command (drops what does not fit). */
export function parseCommand(raw: unknown): Command {
  const r = isRecord(raw) ? raw : {};
  const shopping = objs(r.shopping)
    .map((s): ShopRequest => {
      const qty = typeof s.qty === 'number' && Number.isFinite(s.qty) ? Math.round(s.qty) : 1;
      const cat = str(s.category) as CategoryId;
      return { name: str(s.name), qty: Math.min(Math.max(qty, 1), 99), category: CAT_IDS.includes(cat) ? cat : undefined };
    })
    .filter((s) => s.name);
  const todos = objs(r.todos)
    .map((t): TodoRequest => ({ text: str(t.text), members: strs(t.members), due: isYmd(str(t.due)) ? str(t.due) : undefined }))
    .filter((t) => t.text);
  const weather = objs(r.weather)
    .map((w): WeatherRequest => ({ date: str(w.date), place: str(w.place) || undefined }))
    .filter((w) => isYmd(w.date));
  const events = objs(r.events)
    .map((e): EventsRequest => {
      const from = str(e.from);
      const to = isYmd(str(e.to)) ? str(e.to) : from;
      return to < from ? { from: to, to: from, members: strs(e.members) } : { from, to, members: strs(e.members) };
    })
    .filter((e) => isYmd(e.from));
  const mod = str(r.openModule) as ModuleId;
  return {
    transcript: str(r.transcript),
    shopping,
    todos,
    weather,
    events,
    openModule: MODULE_IDS.includes(mod) ? mod : undefined,
    reply: str(r.reply) || undefined,
  };
}

/** true if the command asks for nothing at all */
export const isEmpty = (c: Command) =>
  !c.shopping.length && !c.todos.length && !c.weather.length && !c.events.length && !c.openModule && !c.reply;
