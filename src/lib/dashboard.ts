import { useSyncExternalStore } from 'react';
import { uid } from './id';

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

function load(): WidgetInstance[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!Array.isArray(v)) return defaults();
    return v.filter(
      (w): w is WidgetInstance =>
        w && typeof w.id === 'string' && WIDGETS.some((d) => d.type === w.type) && widgetDef(w.type).sizes.includes(w.size),
    );
  } catch {
    return defaults();
  }
}

let layout = load();
const listeners = new Set<() => void>();

function set(next: WidgetInstance[]) {
  layout = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* blocked – keep in memory */
  }
  listeners.forEach((l) => l());
}

export function useLayout(): WidgetInstance[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => layout,
  );
}

export function addWidget(type: WidgetType, size: WidgetSize) {
  set([...layout, { id: uid(), type, size }]);
}

export function removeWidget(id: string) {
  set(layout.filter((w) => w.id !== id));
}

export function resizeWidget(id: string, size: WidgetSize) {
  set(layout.map((w) => (w.id === id ? { ...w, size } : w)));
}

/** moves widget `id` to the position of `targetId` */
export function moveWidget(id: string, targetId: string) {
  const from = layout.findIndex((w) => w.id === id);
  const to = layout.findIndex((w) => w.id === targetId);
  if (from < 0 || to < 0 || from === to) return;
  const next = [...layout];
  const [w] = next.splice(from, 1);
  next.splice(to, 0, w);
  set(next);
}

export function resetLayout() {
  set(defaults());
}
