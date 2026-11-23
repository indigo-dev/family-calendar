import type { Member } from '../types';
import { configStore, demoMembers } from './config';
import { todos, type Todo } from './todos';
import { shopping, type ListEntry } from './shopping';
import { removePlace, weatherSettings, type Place } from './weather';
import { addDemoPhotos, deletePhotoDatabase, removeDemoPhotos, usePhotos } from './frame';
import { demoId, isDemoId } from './id';
import { addDays, dayKey, startOfDay } from './dates';
import { isRecord, persisted, storage, usePersisted } from './persisted';
import { t, type Messages } from '../i18n';

/*
 * The demo family fills every module: people with timetables (config), sample events (generated in
 * demo.ts from the people's `demo` flag), notes on the to-do board, a shopping list, a weather place,
 * a holiday region and photos for the frame. Demo records carry ids with the demo prefix (list entries a
 * `demo` flag), so "remove demo data" deletes exactly them and keeps everything the family added.
 * Shared settings the demo changed (holiday region, purchase counts) are noted in `fc.demo`.
 */

type TodoText = keyof Messages['demo']['todos'];

/** [text, member indices, due in days from today (none = no date), done] */
const DEMO_TODOS: [TodoText, number[], number | null, boolean?][] = [
  ['tax', [0], 5],
  ['present', [1], 2],
  ['talk', [2], 1],
  ['room', [3], 0],
  ['holiday', [0, 1], null],
  ['trip', [0, 1, 2, 3], null],
  ['sportsKit', [2], 0, true],
  ['bike', [3, 0], null],
  ['dentist', [1], 3],
];

/** [built-in item id, quantity] */
const DEMO_LIST: [string, number][] = [
  ['milk', 2],
  ['bread', 1],
  ['bananas', 1],
  ['apples', 1],
  ['eggs', 1],
  ['tomatoes', 1],
  ['pasta', 2],
  ['coffee', 1],
  ['toiletpaper', 1],
];

/** purchase counts for the "frequent" row of the pantry */
const DEMO_BOUGHT: Record<string, number> = { milk: 6, bread: 5, bananas: 4, eggs: 3, coffee: 3, butter: 2, yogurt: 2 };

const DEMO_PLACE: Omit<Place, 'id'> = { name: 'Berlin', region: 'Berlin', lat: 52.52, lon: 13.41 };
const DEMO_REGION = 'DE-BE';

/** landscape motifs of picsum.photos (free licence), downloaded once like the motifs in the frame module */
export const DEMO_MOTIFS = ['10', '1015', '1016', '1018', '1036', '1039'];

/** what the demo changed in shared settings */
interface DemoMarks {
  /** holiday region set by the demo (only reset if it is still the same) */
  region?: string;
  /** purchase counts added by the demo */
  bought?: Record<string, number>;
}

const marks = persisted<DemoMarks>('fc.demo', (raw) => {
  if (!isRecord(raw)) return {};
  const bought: Record<string, number> = {};
  if (isRecord(raw.bought)) for (const [k, v] of Object.entries(raw.bought)) if (typeof v === 'number') bought[k] = v;
  return { region: typeof raw.region === 'string' ? raw.region : undefined, bought: Object.keys(bought).length ? bought : undefined };
});

function demoTodos(members: Member[], today: Date): Todo[] {
  const now = Date.now();
  return DEMO_TODOS.map(([text, who, due, done], i) => ({
    id: demoId(),
    text: t(`demo.todos.${text}`),
    memberIds: who.map((n) => members[n].id),
    due: due === null ? undefined : dayKey(addDays(today, due)),
    done: !!done,
    doneAt: done ? now : undefined,
    // oldest first, like notes written over the last days
    createdAt: now - (DEMO_TODOS.length - i) * 3_600_000,
  }));
}

/**
 * Loads the demo family next to the existing people and fills the other modules with sample content.
 * Settings the family already chose (holiday region, weather places) are left alone. The photos are
 * downloaded in the background – the returned promise resolves with how many were added.
 */
export function loadDemo(today = new Date()): { members: Member[]; photos: Promise<number> } {
  const members = demoMembers();
  const setRegion = !configStore.get().settings.holidays.region;
  configStore.set((c) => ({
    ...c,
    members: [...c.members.filter((m) => !isDemoId(m.id)), ...members],
    settings: setRegion ? { ...c.settings, holidays: { ...c.settings.holidays, region: DEMO_REGION } } : c.settings,
  }));
  if (setRegion) marks.set((m) => ({ ...m, region: DEMO_REGION }));

  todos.set((cur) => [...cur.filter((x) => !isDemoId(x.id)), ...demoTodos(members, startOfDay(today))]);

  const addBought = !marks.get().bought;
  shopping.set((s) => {
    const onList = new Set(s.list.map((e) => e.itemId));
    const now = Date.now();
    const added: ListEntry[] = DEMO_LIST.filter(([id]) => !onList.has(id)).map(([itemId, qty], i) => ({
      itemId,
      qty,
      addedAt: now + i,
      demo: true,
    }));
    const bought = { ...s.bought };
    if (addBought) for (const [k, n] of Object.entries(DEMO_BOUGHT)) bought[k] = (bought[k] ?? 0) + n;
    return { ...s, list: [...s.list, ...added], bought };
  });
  if (addBought) marks.set((m) => ({ ...m, bought: { ...DEMO_BOUGHT } }));

  if (weatherSettings.get().places.length === 0) {
    const place: Place = { ...DEMO_PLACE, id: demoId() };
    weatherSettings.set({ places: [place], activeId: place.id });
  }

  return { members, photos: addDemoPhotos(DEMO_MOTIFS).catch(() => 0) };
}

/** How many demo records there are, per area (to say what "remove demo data" deletes). */
export interface DemoSummary {
  members: number;
  todos: number;
  shopping: number;
  places: number;
  photos: number;
  /** holiday region or purchase counts changed by the demo */
  settings: boolean;
}

export function demoSummary(photoIds: string[] = []): DemoSummary {
  const m = marks.get();
  return {
    members: configStore.get().members.filter((x) => isDemoId(x.id)).length,
    todos: todos.get().filter((x) => isDemoId(x.id)).length,
    shopping: shopping.get().list.filter((e) => e.demo).length,
    places: weatherSettings.get().places.filter((p) => isDemoId(p.id)).length,
    photos: photoIds.filter(isDemoId).length,
    settings: !!(m.region || m.bought),
  };
}

export const hasDemoData = (s: DemoSummary) => s.members + s.todos + s.shopping + s.places + s.photos > 0 || s.settings;

/** The demo summary, updated when any of the stores change. */
export function useDemoSummary(): DemoSummary {
  usePersisted(configStore);
  usePersisted(todos);
  usePersisted(shopping);
  usePersisted(weatherSettings);
  usePersisted(marks);
  const photos = usePhotos();
  return demoSummary(photos?.map((p) => p.id));
}

/**
 * Removes everything the demo added and keeps the family's own data: demo people (and their calendar
 * assignments), demo notes, demo list entries, the demo weather place and photos, and the holiday region
 * and purchase counts the demo set. Own people stop showing sample events.
 */
export async function removeDemo(): Promise<void> {
  const m = marks.get();
  configStore.set((c) => {
    const members = c.members.filter((x) => !isDemoId(x.id)).map((x) => (x.demo ? { ...x, demo: undefined } : x));
    const ids = new Set(members.map((x) => x.id));
    const holidays = m.region && c.settings.holidays.region === m.region ? { ...c.settings.holidays, region: '' } : c.settings.holidays;
    return {
      ...c,
      members,
      calendars: c.calendars.map((cal) => ({ ...cal, memberIds: cal.memberIds.filter((id) => ids.has(id)) })),
      settings: { ...c.settings, holidays },
    };
  });

  todos.set((cur) => cur.filter((x) => !isDemoId(x.id)));

  shopping.set((s) => {
    const bought = { ...s.bought };
    for (const [k, n] of Object.entries(m.bought ?? {})) {
      const left = (bought[k] ?? 0) - n;
      if (left > 0) bought[k] = left;
      else delete bought[k];
    }
    return { ...s, list: s.list.filter((e) => !e.demo), bought };
  });

  weatherSettings
    .get()
    .places.filter((p) => isDemoId(p.id))
    .forEach((p) => removePlace(p.id));

  marks.set({});
  await removeDemoPhotos().catch(() => {});
}

/** localStorage keys of this app (msal.* / login.*: leftovers of the former sign-in on older installs) */
const isAppKey = (k: string) =>
  k.startsWith('fc.') || k.startsWith('msal.') || k.includes('login.windows.net') || k.includes('login.microsoftonline');

/**
 * Factory reset of this device: deletes every stored value (people, calendars, settings, to-dos,
 * shopping, weather, dashboard layout, module order, voice settings, caches) and the photo database.
 * The page must be reloaded afterwards so every store starts from its defaults.
 */
export async function resetApp(): Promise<void> {
  storage.keys().filter(isAppKey).forEach(storage.remove);
  await deletePhotoDatabase().catch(() => {});
}
