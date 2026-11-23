import { CATEGORIES, type CategoryId } from '../lib/shopping';
import { MODULES, type ModuleId } from '../components/ModuleNav';
import { isRecord } from '../lib/persisted';
import { getLanguage, type Language } from '../i18n';

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
  /** names as spoken: open the module filtered to these people ("Stundenplan von Jan") */
  openFor: string[];
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
    transcript: { type: 'STRING', description: 'Verbatim transcript of what was said' },
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
    openFor: { type: 'ARRAY', items: { type: 'STRING' } },
    reply: { type: 'STRING' },
  },
  required: ['transcript'],
} as const;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Instructions for the model. The app language decides the language of the prompt, of the texts the model
 * writes (to-dos, reply) and of the item names it is given; it still understands a request in the other language.
 */
export function buildPrompt(ctx: VoiceContext, lang: Language = getLanguage()): string {
  return lang === 'de' ? germanPrompt(ctx) : englishPrompt(ctx);
}

const list = (xs: string[], none: string) => (xs.length ? xs.join(', ') : none);

function germanPrompt(ctx: VoiceContext): string {
  const weekday = ctx.now.toLocaleDateString('de-DE', { weekday: 'long' });
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
    '  openFor: Namen aus der Familie, wenn der Bereich für bestimmte Personen gezeigt werden soll',
    '  ("zeig mir den Stundenplan von Jan" → openModule "timetable", openFor ["Jan"]; "Lenas To-dos" → "todos", ["Lena"]).',
    '- Relative Angaben wie "morgen", "übermorgen", "nächsten Dienstag" in Daten (YYYY-MM-DD) umrechnen.',
    '- reply: nur wenn die Bitte nicht zu den Bereichen passt oder unklar ist – ein kurzer, freundlicher Satz.',
    '- Termine anlegen geht nicht (die Kalender sind nur abonniert): dann reply mit einem Hinweis.',
  ].join('\n');
}

function englishPrompt(ctx: VoiceContext): string {
  const weekday = ctx.now.toLocaleDateString('en-GB', { weekday: 'long' });
  return [
    'You are the voice control of a family app (calendar, shopping list, to-dos, weather, timetable, photos).',
    'You get a short voice recording (or text), usually in English, and fill in the answer structure from it.',
    'Write all texts you produce (to-do texts, new item names, reply) in English.',
    '',
    `Today is ${weekday}, ${ymd(ctx.now)}, ${pad(ctx.now.getHours())}:${pad(ctx.now.getMinutes())}.`,
    `Family members: ${list(ctx.members, 'none')}.`,
    `Weather places (the first one is home): ${list(ctx.places, 'none')}.`,
    `Items in the shopping list pantry: ${list(ctx.pantry, 'none')}.`,
    '',
    'Rules:',
    '- transcript: verbatim what was said. On silence or noise leave it empty and fill in nothing else.',
    '- shopping: things for the shopping list. If an item from the pantry fits, use exactly its spelling',
    '  (also for singular/plural or casual speech, e.g. "a milk" → "Milk", "an apple" → "Apples").',
    '  qty is the number (1 if none is said). Set category only for new items.',
    '- todos: tasks and reminders ("remind us …", "put … on the to-do list"). text short and phrased as a task.',
    '  members only with names from the family, empty = everyone. due only if a day is mentioned.',
    '- weather: questions about the weather, one entry per day. place only if a place is mentioned.',
    '- events: questions about events ("what\'s on tomorrow?"). Periods as from/to, e.g. "this week" = today to Sunday.',
    '- openModule: only if a section should explicitly be opened ("show me the shopping list"), otherwise "none".',
    '  openFor: names from the family if the section should be shown for certain people',
    '  ("show me Jan\'s timetable" → openModule "timetable", openFor ["Jan"]; "Lena\'s to-dos" → "todos", ["Lena"]).',
    '- Convert relative dates like "tomorrow", "the day after tomorrow", "next Tuesday" into dates (YYYY-MM-DD).',
    '- reply: only if the request does not fit the sections or is unclear – one short, friendly sentence.',
    '- Creating events is not possible (the calendars are only subscribed): then reply with a hint.',
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
    openFor: MODULE_IDS.includes(mod) ? strs(r.openFor) : [],
    reply: str(r.reply) || undefined,
  };
}

/** true if the command asks for nothing at all */
export const isEmpty = (c: Command) =>
  !c.shopping.length && !c.todos.length && !c.weather.length && !c.events.length && !c.openModule && !c.reply;
