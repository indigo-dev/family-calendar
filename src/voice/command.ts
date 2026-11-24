import { CATEGORIES, type CategoryId } from '../lib/shopping';
import { MODULES, type ModuleId } from '../components/ModuleNav';
import { isRecord } from '../lib/persisted';
import { getLanguage, type Language } from '../i18n';
import type { ViewMode } from '../types';

/*
 * What the model returns for one spoken request – independent of the provider. The speech part
 * (audio → this structure) can be swapped without touching the rest.
 *
 * Three kinds of request, kept apart on purpose:
 *  - change: put on / check off the shopping list and the to-dos
 *  - ask:    questions; the answer is shown on the card and read aloud, the screen behind stays
 *  - show:   switch the screen (section, people, calendar view and date) – nothing is read aloud
 */

/** stands for the whole family in a list of names ("alle", "wir", "uns") */
export const EVERYONE = '*';

export interface ShopRequest {
  name: string;
  qty: number;
  /** only for items that are not in the pantry yet */
  category?: CategoryId;
}

export interface TodoRequest {
  text: string;
  /** names as spoken, or EVERYONE; empty = nobody named → the app asks "für wen?" */
  members: string[];
  /** YYYY-MM-DD */
  due?: string;
}

/** "Müll rausbringen ist erledigt" */
export interface CheckTodoRequest {
  text: string;
  members: string[];
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
  /** empty = the whole family */
  members: string[];
}

/** "Welche Aufgaben hat Jan?" */
export interface TodosQuestion {
  /** names or EVERYONE; empty → the app asks */
  members: string[];
}

/** "Was hat Jan morgen?" */
export interface TimetableQuestion {
  /** YYYY-MM-DD */
  date: string;
  /** names or EVERYONE; empty → the app asks */
  members: string[];
}

export interface ShowRequest {
  module: ModuleId;
  /** person filter; empty = leave it as it is */
  members: string[];
  /** calendar only */
  view?: ViewMode;
  /** calendar only: a day inside the period to show, YYYY-MM-DD */
  date?: string;
}

export interface Command {
  /** what was understood, shown to the user */
  transcript: string;
  addShopping: ShopRequest[];
  /** item names that were bought */
  checkShopping: string[];
  addTodos: TodoRequest[];
  checkTodos: CheckTodoRequest[];
  askWeather: WeatherRequest[];
  askEvents: EventsRequest[];
  askShopping: boolean;
  askTodos: TodosQuestion[];
  askTimetable: TimetableQuestion[];
  show?: ShowRequest;
  /** short message when nothing else fits */
  reply?: string;
}

/** What the model needs to know about the app to map a request. */
export interface VoiceContext {
  now: Date;
  members: string[];
  places: string[];
  pantry: string[];
  /** texts of the open to-dos (to check one off by name) */
  todos?: string[];
}

const CAT_IDS = CATEGORIES.map((c) => c.id);
const MODULE_IDS = MODULES.map((m) => m.id);
export const VIEW_IDS: ViewMode[] = ['day', 'days', 'week', 'month', 'year', 'agenda'];

const NAMES = { type: 'ARRAY', items: { type: 'STRING' } } as const;
const DATE = { type: 'STRING', description: 'YYYY-MM-DD' } as const;

/** Response schema in the OpenAPI subset Gemini understands. */
export const COMMAND_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING', description: 'Verbatim transcript of what was said' },
    addShopping: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: { type: 'STRING' }, qty: { type: 'INTEGER' }, category: { type: 'STRING', enum: CAT_IDS } },
        required: ['name', 'qty'],
      },
    },
    checkShopping: { type: 'ARRAY', items: { type: 'STRING' } },
    addTodos: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { text: { type: 'STRING' }, members: NAMES, due: DATE },
        required: ['text'],
      },
    },
    checkTodos: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { text: { type: 'STRING' }, members: NAMES }, required: ['text'] },
    },
    askWeather: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { date: DATE, place: { type: 'STRING' } }, required: ['date'] },
    },
    askEvents: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { from: DATE, to: DATE, members: NAMES }, required: ['from', 'to'] },
    },
    askShopping: { type: 'BOOLEAN' },
    askTodos: { type: 'ARRAY', items: { type: 'OBJECT', properties: { members: NAMES } } },
    askTimetable: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { date: DATE, members: NAMES }, required: ['date'] },
    },
    show: {
      type: 'OBJECT',
      properties: {
        module: { type: 'STRING', enum: [...MODULE_IDS, 'none'] },
        members: NAMES,
        view: { type: 'STRING', enum: VIEW_IDS },
        date: DATE,
      },
    },
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
const quoted = (xs: string[], none: string) => (xs.length ? xs.map((x) => `"${x}"`).join(', ') : none);

function germanPrompt(ctx: VoiceContext): string {
  const weekday = ctx.now.toLocaleDateString('de-DE', { weekday: 'long' });
  return [
    'Du bist die Sprachsteuerung einer Familien-App (Kalender, Einkaufsliste, To-dos, Wetter, Stundenplan, Fotos, Spiele).',
    'Du bekommst eine kurze deutsche Sprachaufnahme (oder Text) und füllst daraus die Antwort-Struktur.',
    '',
    `Heute ist ${weekday}, der ${ymd(ctx.now)}, ${pad(ctx.now.getHours())}:${pad(ctx.now.getMinutes())} Uhr.`,
    `Familienmitglieder: ${list(ctx.members, 'keine')}.`,
    `Wetter-Orte (der erste ist Zuhause): ${list(ctx.places, 'keine')}.`,
    `Artikel im Vorrat der Einkaufsliste: ${list(ctx.pantry, 'keine')}.`,
    `Offene To-dos: ${quoted(ctx.todos ?? [], 'keine')}.`,
    '',
    'Es gibt drei Arten von Bitten – halte sie streng auseinander:',
    '1. ÄNDERN (Einkaufsliste, To-dos)',
    '2. FRAGEN ("was steht …", "welche …", "wie wird …", "lies … vor", "was hat …"): Antwort wird vorgelesen, nichts geöffnet.',
    '3. ZEIGEN ("zeig …", "öffne …", "geh in …", "wechsle zu …"): nur die Anzeige wechseln, nichts vorlesen.',
    'Nur wenn ausdrücklich beides verlangt wird ("zeig mir die Einkaufsliste und lies sie vor"), FRAGEN und ZEIGEN füllen.',
    '',
    'Namen (members): nur Namen aus der Familie, so wie sie oben stehen.',
    `"alle", "wir", "uns", "die ganze Familie" → ["${EVERYONE}"]. "ich", "mich", "mir", "mein" sind KEINE Namen.`,
    'Wurde bei addTodos, askTodos oder askTimetable niemand genannt, members leer lassen – die App fragt dann nach.',
    '',
    'Regeln:',
    '- transcript: wörtlich, was gesagt wurde. Bei Stille oder Rauschen leer lassen und sonst nichts füllen.',
    '- addShopping: Dinge auf die Einkaufsliste setzen. Passt ein Artikel aus dem Vorrat, nimm genau dessen Schreibweise',
    '  (auch bei Singular/Plural oder Umgangssprache, z. B. "ne Milch" → "Milch", "Apfel" → "Äpfel").',
    '  qty ist die Anzahl (ohne Angabe 1). Nur für neue Artikel category setzen.',
    '- checkShopping: gekaufte Dinge abhaken ("Milch ist gekauft", "hab die Eier") – Namen wie im Vorrat.',
    '- addTodos: neue Aufgaben und Erinnerungen ("erinnere Jan …", "auf die To-do-Liste"). text kurz und als Aufgabe formuliert.',
    '  due nur bei genanntem Tag.',
    '- checkTodos: erledigte Aufgaben ("Müll rausbringen ist erledigt") – text möglichst genau wie bei den offenen To-dos.',
    '- askWeather: Fragen zum Wetter, ein Eintrag pro Tag. place nur, wenn ein Ort genannt wird.',
    '- askEvents: Fragen zu Terminen ("was steht morgen an?"). Zeiträume als from/to, z. B. "diese Woche" = heute bis Sonntag.',
    '  members nur, wenn nach bestimmten Personen gefragt wird, sonst leer (= ganze Familie).',
    '- askShopping: true bei Fragen nach dem Inhalt der Einkaufsliste ("was steht auf der Einkaufsliste?", "was müssen wir kaufen?").',
    '- askTodos: Fragen nach offenen Aufgaben ("welche Aufgaben hat Lena?").',
    '- askTimetable: Fragen nach Schulstunden ("was hat Jan morgen?", "wann hat Lena heute Schluss?"). date ohne Angabe = heute.',
    '- show: nur bei ZEIGEN, sonst module "none". module ist der Bereich, members der Personenfilter',
    '  ("zeig mir den Stundenplan von Jan" → module "timetable", members ["Jan"]).',
    '  Kalender: view day (Tag), days (mehrere Tage), week (Woche), month (Monat), year (Jahr), agenda (Liste);',
    '  date = ein Tag im gewünschten Zeitraum ("geh zum nächsten Monat" → view "month", date im nächsten Monat).',
    '  Ohne genannte Ansicht oder Datum view/date weglassen.',
    '- Relative Angaben wie "morgen", "übermorgen", "nächsten Dienstag" in Daten (YYYY-MM-DD) umrechnen.',
    '- reply: nur wenn die Bitte nicht zu den Bereichen passt oder unklar ist – ein kurzer, freundlicher Satz.',
    '- Termine anlegen und Dinge löschen geht nicht: dann reply mit einem Hinweis.',
  ].join('\n');
}

function englishPrompt(ctx: VoiceContext): string {
  const weekday = ctx.now.toLocaleDateString('en-GB', { weekday: 'long' });
  return [
    'You are the voice control of a family app (calendar, shopping list, to-dos, weather, timetable, photos, games).',
    'You get a short voice recording (or text), usually in English, and fill in the answer structure from it.',
    'Write all texts you produce (to-do texts, new item names, reply) in English.',
    '',
    `Today is ${weekday}, ${ymd(ctx.now)}, ${pad(ctx.now.getHours())}:${pad(ctx.now.getMinutes())}.`,
    `Family members: ${list(ctx.members, 'none')}.`,
    `Weather places (the first one is home): ${list(ctx.places, 'none')}.`,
    `Items in the shopping list pantry: ${list(ctx.pantry, 'none')}.`,
    `Open to-dos: ${quoted(ctx.todos ?? [], 'none')}.`,
    '',
    'There are three kinds of request – keep them strictly apart:',
    '1. CHANGE (shopping list, to-dos)',
    '2. ASK ("what\'s on …", "which …", "how will …", "read … out", "what does … have"): the answer is read aloud, nothing is opened.',
    '3. SHOW ("show …", "open …", "go to …", "switch to …"): only change the screen, read nothing aloud.',
    'Fill both ASK and SHOW only if both are asked for explicitly ("show me the shopping list and read it out").',
    '',
    'Names (members): only names from the family, spelled as above.',
    `"everyone", "all of us", "we", "us", "the whole family" → ["${EVERYONE}"]. "I", "me", "my" are NOT names.`,
    'If nobody is named for addTodos, askTodos or askTimetable, leave members empty – the app will ask.',
    '',
    'Rules:',
    '- transcript: verbatim what was said. On silence or noise leave it empty and fill in nothing else.',
    '- addShopping: things to put on the shopping list. If an item from the pantry fits, use exactly its spelling',
    '  (also for singular/plural or casual speech, e.g. "a milk" → "Milk", "an apple" → "Apples").',
    '  qty is the number (1 if none is said). Set category only for new items.',
    '- checkShopping: things that were bought ("got the milk", "eggs are bought") – names as in the pantry.',
    '- addTodos: new tasks and reminders ("remind Jan …", "put … on the to-do list"). text short and phrased as a task.',
    '  due only if a day is mentioned.',
    '- checkTodos: tasks that are done ("taking out the rubbish is done") – text as close as possible to the open to-dos.',
    '- askWeather: questions about the weather, one entry per day. place only if a place is mentioned.',
    '- askEvents: questions about events ("what\'s on tomorrow?"). Periods as from/to, e.g. "this week" = today to Sunday.',
    '  members only if the question is about certain people, otherwise empty (= whole family).',
    '- askShopping: true for questions about what is on the shopping list ("what\'s on the shopping list?", "what do we need?").',
    '- askTodos: questions about open tasks ("which tasks does Lena have?").',
    '- askTimetable: questions about school lessons ("what does Jan have tomorrow?", "when does Lena finish today?"). No date = today.',
    '- show: only for SHOW, otherwise module "none". module is the section, members the person filter',
    '  ("show me Jan\'s timetable" → module "timetable", members ["Jan"]).',
    '  Calendar: view day, days (several days), week, month, year, agenda (list);',
    '  date = a day inside the wanted period ("go to next month" → view "month", date in next month).',
    '  Leave out view/date if none is mentioned.',
    '- Convert relative dates like "tomorrow", "the day after tomorrow", "next Tuesday" into dates (YYYY-MM-DD).',
    '- reply: only if the request does not fit the sections or is unclear – one short, friendly sentence.',
    '- Creating events and deleting things is not possible: then reply with a hint.',
  ].join('\n');
}

/* ------------------------------------------------------------------ validation */

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const isYmd = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00`).getTime());
const objs = (v: unknown) => (Array.isArray(v) ? v.filter(isRecord) : []);
const ymdOr = (v: unknown) => (isYmd(str(v)) ? str(v) : undefined);

function parseShow(raw: unknown): ShowRequest | undefined {
  if (!isRecord(raw)) return undefined;
  const module = str(raw.module) as ModuleId;
  if (!MODULE_IDS.includes(module)) return undefined;
  const view = str(raw.view) as ViewMode;
  const calendar = module === 'calendar';
  return {
    module,
    members: strs(raw.members),
    view: calendar && VIEW_IDS.includes(view) ? view : undefined,
    date: calendar ? ymdOr(raw.date) : undefined,
  };
}

/** Turns whatever the model returned into a valid command (drops what does not fit). */
export function parseCommand(raw: unknown): Command {
  const r = isRecord(raw) ? raw : {};
  const addShopping = objs(r.addShopping)
    .map((s): ShopRequest => {
      const qty = typeof s.qty === 'number' && Number.isFinite(s.qty) ? Math.round(s.qty) : 1;
      const cat = str(s.category) as CategoryId;
      return { name: str(s.name), qty: Math.min(Math.max(qty, 1), 99), category: CAT_IDS.includes(cat) ? cat : undefined };
    })
    .filter((s) => s.name);
  const addTodos = objs(r.addTodos)
    .map((t): TodoRequest => ({ text: str(t.text), members: strs(t.members), due: ymdOr(t.due) }))
    .filter((t) => t.text);
  const checkTodos = objs(r.checkTodos)
    .map((t): CheckTodoRequest => ({ text: str(t.text), members: strs(t.members) }))
    .filter((t) => t.text);
  const askWeather = objs(r.askWeather)
    .map((w): WeatherRequest => ({ date: str(w.date), place: str(w.place) || undefined }))
    .filter((w) => isYmd(w.date));
  const askEvents = objs(r.askEvents)
    .map((e): EventsRequest => {
      const from = str(e.from);
      const to = isYmd(str(e.to)) ? str(e.to) : from;
      return to < from ? { from: to, to: from, members: strs(e.members) } : { from, to, members: strs(e.members) };
    })
    .filter((e) => isYmd(e.from));
  const askTimetable = objs(r.askTimetable)
    .map((q): TimetableQuestion => ({ date: str(q.date), members: strs(q.members) }))
    .filter((q) => isYmd(q.date));
  return {
    transcript: str(r.transcript),
    addShopping,
    checkShopping: strs(r.checkShopping),
    addTodos,
    checkTodos,
    askWeather,
    askEvents,
    askShopping: r.askShopping === true,
    askTodos: objs(r.askTodos).map((q): TodosQuestion => ({ members: strs(q.members) })),
    askTimetable,
    show: parseShow(r.show),
    reply: str(r.reply) || undefined,
  };
}

/** true if the command asks for nothing at all */
export const isEmpty = (c: Command) =>
  !c.addShopping.length &&
  !c.checkShopping.length &&
  !c.addTodos.length &&
  !c.checkTodos.length &&
  !c.askWeather.length &&
  !c.askEvents.length &&
  !c.askShopping &&
  !c.askTodos.length &&
  !c.askTimetable.length &&
  !c.show &&
  !c.reply;

/** true if it only changes the screen – nothing is said then */
export const isQuiet = (c: Command) => !!c.show && isEmpty({ ...c, show: undefined });
