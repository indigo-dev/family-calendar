import { uid } from './id';
import { arrayOf, isRecord, persisted, usePersisted } from './persisted';

/**
 * Dashboard layout: an ordered list of widgets, each with a size step. The grid packs them densely
 * in that order. Stored per device in localStorage `fc.dashboard` (like photos and weather places).
 */

export type WidgetType = 'clock' | 'weather' | 'events' | 'timetable' | 'todos' | 'shopping' | 'photos' | 'holidays' | 'pollen' | 'family';

/** Klein 1×1, Mittel 2×1, Hoch 1×2, Groß 2×2, Breit 3×2 */
export type WidgetSize = 's' | 'm' | 't' | 'l' | 'xl';

export const SIZES: Record<WidgetSize, { w: number; h: number; label: string }> = {
  s: { w: 1, h: 1, label: 'Klein' },
  m: { w: 2, h: 1, label: 'Mittel' },
  t: { w: 1, h: 2, label: 'Hoch' },
  l: { w: 2, h: 2, label: 'Groß' },
  xl: { w: 3, h: 2, label: 'Breit' },
};

export interface WidgetDef {
  type: WidgetType;
  title: string;
  icon: string;
  description: string;
  sizes: WidgetSize[];
  /** module opened by tapping the widget */
  module?: 'calendar' | 'timetable' | 'todos' | 'shopping' | 'weather' | 'frame';
}

export const WIDGETS: WidgetDef[] = [
  { type: 'clock', title: 'Uhr & Datum', icon: '🕰️', description: 'Uhrzeit, Datum, Kalenderwoche', sizes: ['s', 'm'] },
  {
    type: 'events',
    title: 'Termine',
    icon: '📅',
    description: 'Was heute und morgen ansteht',
    sizes: ['m', 't', 'l', 'xl'],
    module: 'calendar',
  },
  {
    type: 'family',
    title: 'Familie heute',
    icon: '👨‍👩‍👧',
    description: 'Wer hat heute was: Termin, Schule, To-dos',
    sizes: ['m', 't', 'l', 'xl'],
    module: 'calendar',
  },
  {
    type: 'weather',
    title: 'Wetter',
    icon: '⛅',
    description: 'Jetzt, nächste Stunden, Vorhersage, Warnungen',
    sizes: ['s', 'm', 'l', 'xl'],
    module: 'weather',
  },
  { type: 'pollen', title: 'Pollen & UV', icon: '🌼', description: 'Pollenflug und UV-Index heute', sizes: ['s', 'm'], module: 'weather' },
  {
    type: 'timetable',
    title: 'Stundenplan',
    icon: '🎒',
    description: 'Fächer des (nächsten) Schultags und Schulschluss',
    sizes: ['s', 'm', 't', 'l', 'xl'],
    module: 'timetable',
  },
  {
    type: 'todos',
    title: 'To-dos',
    icon: '📌',
    description: 'Offene Aufgaben – direkt abhaken',
    sizes: ['s', 'm', 't', 'l'],
    module: 'todos',
  },
  {
    type: 'shopping',
    title: 'Einkaufsliste',
    icon: '🛒',
    description: 'Was fehlt – direkt abhaken',
    sizes: ['s', 'm', 't', 'l'],
    module: 'shopping',
  },
  {
    type: 'photos',
    title: 'Fotos',
    icon: '🖼️',
    description: 'Wechselnde Fotos, Antippen startet die Diashow',
    sizes: ['s', 'm', 't', 'l', 'xl'],
    module: 'frame',
  },
  {
    type: 'holidays',
    title: 'Ferien-Countdown',
    icon: '🏖️',
    description: 'Tage bis zu den nächsten Ferien und Feiertagen',
    sizes: ['s', 'm'],
  },
];

export const widgetDef = (type: WidgetType) => WIDGETS.find((w) => w.type === type)!;

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  size: WidgetSize;
}

/** Fills 6×3 on an iPad in landscape. */
const DEFAULT_LAYOUT: [WidgetType, WidgetSize][] = [
  ['clock', 'm'],
  ['weather', 'm'],
  ['holidays', 's'],
  ['pollen', 's'],
  ['events', 'l'],
  ['timetable', 't'],
  ['todos', 't'],
  ['shopping', 't'],
  ['photos', 't'],
];

const KEY = 'fc.dashboard';

function defaults(): WidgetInstance[] {
  return DEFAULT_LAYOUT.map(([type, size]) => ({ id: uid(), type, size }));
}

const isWidget = (w: unknown): w is WidgetInstance =>
  isRecord(w) &&
  typeof w.id === 'string' &&
  WIDGETS.some((d) => d.type === w.type) &&
  widgetDef(w.type as WidgetType).sizes.includes(w.size as WidgetSize);

/** nothing stored yet = the default layout */
const layout = persisted<WidgetInstance[]>(KEY, (raw) => (Array.isArray(raw) ? arrayOf(raw, isWidget) : defaults()));

export function useLayout(): WidgetInstance[] {
  return usePersisted(layout);
}

export function addWidget(type: WidgetType, size: WidgetSize) {
  layout.set((l) => [...l, { id: uid(), type, size }]);
}

export function removeWidget(id: string) {
  layout.set((l) => l.filter((w) => w.id !== id));
}

export function resizeWidget(id: string, size: WidgetSize) {
  layout.set((l) => l.map((w) => (w.id === id ? { ...w, size } : w)));
}

/** moves widget `id` to the position of `targetId` */
export function moveWidget(id: string, targetId: string) {
  layout.set((l) => {
    const from = l.findIndex((w) => w.id === id);
    const to = l.findIndex((w) => w.id === targetId);
    if (from < 0 || to < 0 || from === to) return l;
    const next = [...l];
    const [w] = next.splice(from, 1);
    next.splice(to, 0, w);
    return next;
  });
}

export function resetLayout() {
  layout.set(defaults());
}
