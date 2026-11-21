import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { CalEvent, DayMarks, Member, Timetable } from '../types';
import type { WidgetSize, WidgetType } from '../lib/dashboard';
import type { ModuleId } from '../components/ModuleNav';
import type { SettingsTab } from '../settings/SettingsPanel';
import { useStore } from '../store';
import { addDays, dayKey, fmt, isoWeek, startOfDay } from '../lib/dates';
import { useTodos, type Todo } from '../lib/todos';
import { BUILTIN, CATEGORIES, useShopping, type ListEntry, type ShopItem } from '../lib/shopping';
import { minutes, subjectMap } from '../lib/school';
import { loadHolidays, type Holiday } from '../lib/holidays';
import {
  activeAlerts,
  deg,
  describe,
  pollenLevel,
  POLLEN_LABELS,
  POLLEN_TYPES,
  protectionWindow,
  SEVERITY_LABEL,
  useHomeWeather,
  uvLevel,
} from '../lib/weather';
import { thumbUrl, useFrameSettings, usePhotos, type Photo } from '../lib/frame';
import { Avatar, AvatarStack } from '../components/Avatar';
import { paint } from '../lib/colors';

/* ------------------------------------------------------------------ shared data */

export interface DashData {
  now: Date;
  /** today and tomorrow, all family members */
  events: CalEvent[];
  todos: ReturnType<typeof useTodos>;
  shopping: ReturnType<typeof useShopping>;
  /** holiday marks for the next weeks */
  marks: Map<string, DayMarks>;
  openModule: (id: ModuleId) => void;
  startFrame: (startId?: string) => void;
  openSettings: (tab?: SettingsTab) => void;
}

export const DashCtx = createContext<DashData | null>(null);
const useDash = () => useContext(DashCtx)!;

interface WidgetProps {
  size: WidgetSize;
}

/** Stops the tap from reaching the widget (which would open the module). */
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

function Head({ icon, title, meta }: { icon: string; title: string; meta?: ReactNode }) {
  return (
    <div className="dw-head">
      <span className="dw-head-icon" aria-hidden>
        {icon}
      </span>
      <span className="dw-head-title">{title}</span>
      {meta != null && <span className="dw-head-meta">{meta}</span>}
    </div>
  );
}

function Empty({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <div className="dw-empty">
      <span>{children}</span>
      {action && (
        <button
          className="dw-link"
          onClick={(e) => {
            stop(e);
            onAction?.();
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

/** Small "Rückgängig" pill after checking something off in a widget. */
function useUndo() {
  const [undo, setUndo] = useState<{ label: string; fn: () => void } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(t);
  }, [undo]);
  const node = undo && (
    <button
      className="dw-undo"
      onClick={(e) => {
        stop(e);
        undo.fn();
        setUndo(null);
      }}
    >
      <span className="dw-undo-text">{undo.label}</span> Rückgängig
    </button>
  );
  return [setUndo, node] as const;
}

const gradient = (members: Member[]) =>
  members.length <= 1 ? members[0]?.color ?? 'var(--muted)' : `linear-gradient(135deg, ${members.map((m) => m.color).join(', ')})`;

const hhmm = (d: Date) => fmt(d, { hour: '2-digit', minute: '2-digit' });

/* ------------------------------------------------------------------ Uhr */

function ClockWidget({ size }: WidgetProps) {
  const { now, marks } = useDash();
  const { data } = useHomeWeather();
  const m = marks.get(dayKey(now));
  const special = m?.publicNames[0] ?? m?.schoolNames[0];
  const cur = data && describe(data.current.code, data.current.isDay);
  return (
    <div className={`dw-clock ${size}`}>
      <div className="dw-clock-time">{hhmm(now)}</div>
      <div className="dw-clock-day">{fmt(now, { weekday: 'long' })}</div>
      <div className="dw-clock-date">
        {fmt(now, size === 's' ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'long', year: 'numeric' })}
        {size !== 's' && <span className="dw-clock-kw"> · KW {isoWeek(now)}</span>}
      </div>
      {size !== 's' && (special || cur) && (
        <div className="dw-clock-extra">
          {cur && data && (
            <span>
              {cur.icon} {deg(data.current.temp)}
            </span>
          )}
          {special && <span className="dw-clock-special">🎉 {special}</span>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Wetter */

function WeatherWidget({ size }: WidgetProps) {
  const { now, openModule } = useDash();
  const { place, data, error } = useHomeWeather();
  if (!place) return <Empty action="Ort festlegen" onAction={() => openModule('weather')}>Kein Ort für das Wetter</Empty>;
  if (!data) return <Empty>{error ?? 'Wetter wird geladen …'}</Empty>;

  const cur = describe(data.current.code, data.current.isDay);
  const today = data.days.find((d) => d.date === dayKey(now)) ?? data.days[0];
  const hourKey = `${dayKey(now)}T${String(now.getHours()).padStart(2, '0')}`;
  const hours = data.hours.filter((h) => h.time.slice(0, 13) >= hourKey).slice(0, size === 'xl' ? 8 : 6);
  const days = data.days.filter((d) => d.date > dayKey(now)).slice(0, size === 'xl' ? 6 : 4);
  const alerts = activeAlerts(data, now);

  return (
    <div className={`dw-weather ${size}`}>
      {alerts.length > 0 && size !== 's' && (
        <div className={`dw-alert sev-${alerts[0].severity}`}>
          ⚠️ {SEVERITY_LABEL[alerts[0].severity]}: {alerts[0].event}
          {alerts.length > 1 && ` (+${alerts.length - 1})`}
        </div>
      )}
      <div className="dw-weather-now">
        <span className="dw-weather-icon">{cur.icon}</span>
        <div>
          <div className="dw-weather-temp">
            {deg(data.current.temp)}
            {alerts.length > 0 && size === 's' && <span className="dw-alert-dot" title={alerts[0].event}>⚠️</span>}
          </div>
          <div className="dw-weather-text">{cur.text}</div>
          {today && (
            <div className="dw-weather-range">
              ↑ {deg(today.max)} ↓ {deg(today.min)}
              {size !== 's' && today.rainProb > 0 && <span> · 💧 {today.rainProb} %</span>}
            </div>
          )}
        </div>
        {size !== 's' && <div className="dw-weather-place">{place.name}</div>}
      </div>
      {size !== 's' && (
        <div className="dw-hours">
          {hours.map((h) => (
            <div key={h.time} className="dw-hour">
              <span className="dw-hour-t">{h.time.slice(11, 13)}</span>
              <span className="dw-hour-i">{describe(h.code, h.isDay).icon}</span>
              <span className="dw-hour-v">{deg(h.temp)}</span>
            </div>
          ))}
        </div>
      )}
      {(size === 'l' || size === 'xl') && (
        <div className="dw-days">
          {days.map((d) => {
            const date = new Date(d.date + 'T12:00');
            return (
              <div key={d.date} className="dw-day">
                <span className="dw-day-name">{fmt(date, { weekday: 'short' })}</span>
                <span className="dw-day-i">{describe(d.code).icon}</span>
                <span className="dw-day-max">{deg(d.max)}</span>
                <span className="dw-day-min">{deg(d.min)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Pollen & UV */

function PollenWidget({ size }: WidgetProps) {
  const { now, openModule } = useDash();
  const { place, data } = useHomeWeather();
  if (!place) return <Empty action="Ort festlegen" onAction={() => openModule('weather')}>Kein Ort</Empty>;
  if (!data) return <Empty>Lädt …</Empty>;
  const key = dayKey(now);
  const day = data.days.find((d) => d.date === key);
  const uv = uvLevel(day?.uvMax ?? 0);
  const protect = protectionWindow(data.hours, key);
  const pollen = data.pollen?.find((p) => p.date === key);
  const levels = POLLEN_TYPES.map((t) => ({ ...t, level: pollen ? pollenLevel(t.id, pollen.values[t.id] ?? 0) : 0 }));
  const top = [...levels].sort((a, b) => b.level - a.level)[0];

  return (
    <div className={`dw-pollen ${size}`}>
      <Head icon="🌼" title="Pollen & UV" />
      <div className="dw-pollen-body">
        <div className="dw-uv">
          <span className={`dw-uv-val lvl-${uv.level}`}>{Math.round(day?.uvMax ?? 0)}</span>
          <span className="dw-uv-label">
            UV {uv.label}
            {protect && size !== 's' && <small>Schutz {protect}</small>}
          </span>
        </div>
        {size === 's' ? (
          <div className="dw-pollen-top">
            {!pollen ? 'Keine Pollendaten' : top.level === 0 ? 'Kaum Pollen' : `${top.label}: ${POLLEN_LABELS[top.level]}`}
          </div>
        ) : !pollen ? (
          <div className="dw-pollen-top">Keine Pollendaten</div>
        ) : (
          <div className="dw-pollen-list">
            {levels.map((t) => (
              <div key={t.id} className="dw-pollen-row">
                <span>{t.label}</span>
                <span className="dw-bars" aria-label={POLLEN_LABELS[t.level]}>
                  {[1, 2, 3].map((n) => (
                    <i key={n} className={n <= t.level ? `on lvl-${t.level + 1}` : ''} />
                  ))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Termine */

function EventRow({ e, now, byId }: { e: CalEvent; now: Date; byId: Map<string, Member> }) {
  const ms = e.memberIds.map((id) => byId.get(id)!).filter(Boolean);
  const running = !e.allDay && e.start <= now && e.end > now;
  return (
    <div className={`dw-event ${running ? 'running' : ''}`}>
      <span className="dw-event-bar" style={{ background: gradient(ms) }} />
      <span className="dw-event-time">{e.allDay ? 'ganztägig' : running ? 'jetzt' : hhmm(e.start)}</span>
      <span className="dw-event-title">{e.title}</span>
      <AvatarStack members={ms} size={20} />
    </div>
  );
}

function EventsWidget({ size }: WidgetProps) {
  const { now, events } = useDash();
  const { memberById } = useStore();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const todays = events.filter((e) => e.end > now && e.start < tomorrow);
  const tomorrows = events.filter((e) => e.start < addDays(tomorrow, 1) && e.end > tomorrow);

  const group = (label: string, list: CalEvent[], none: string) => (
    <div className="dw-group">
      <div className="dw-group-label">{label}</div>
      {list.length === 0 ? <div className="dw-none">{none}</div> : list.map((e) => <EventRow key={e.key} e={e} now={now} byId={memberById} />)}
    </div>
  );

  return (
    <div className={`dw-events ${size}`}>
      <Head icon="📅" title="Termine" meta={fmt(now, { weekday: 'short', day: 'numeric', month: 'short' })} />
      <div className={`dw-body dw-scroll ${size === 'xl' ? 'two-col' : ''}`}>
        {group('Heute', todays, 'Nichts mehr geplant')}
        {group(`Morgen · ${fmt(tomorrow, { weekday: 'long' })}`, tomorrows, 'Noch frei')}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Stundenplan */

interface SchoolDay {
  date: Date;
  /** 0 = Mo … 4 = Fr */
  idx: number;
  label: string;
  isToday: boolean;
}

function lastEnd(t: Timetable, idx: number): string | null {
  const row = t.cells[idx] ?? [];
  for (let p = row.length - 1; p >= 0; p--) if (row[p]) return t.periods[p]?.end ?? null;
  return null;
}

/** Today if school is still running, otherwise the next school day (skips weekends and holidays). */
function nextSchoolDay(now: Date, marks: Map<string, DayMarks>, kids: Member[]): { day: SchoolDay | null; offToday?: string } {
  const today = startOfDay(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const tm = marks.get(dayKey(today));
  const offToday = tm?.publicNames[0] ?? tm?.schoolNames[0];
  for (let i = 0; i < 21; i++) {
    const date = addDays(today, i);
    const wd = date.getDay();
    if (wd === 0 || wd === 6) continue;
    const m = marks.get(dayKey(date));
    if (m && (m.publicNames.length || m.schoolNames.length)) continue;
    const idx = wd - 1;
    if (i === 0) {
      const ends = kids.map((k) => lastEnd(k.timetable!, idx)).filter((x): x is string => !!x);
      if (!ends.length || nowMin >= Math.max(...ends.map(minutes))) continue;
    }
    const label = i === 0 ? 'Heute' : i === 1 ? 'Morgen' : fmt(date, { weekday: 'long', day: 'numeric', month: 'numeric' });
    return { day: { date, idx, label, isToday: i === 0 }, offToday };
  }
  return { day: null, offToday };
}

function TimetableWidget({ size }: WidgetProps) {
  const { now, marks, openSettings } = useDash();
  const { members, school } = useStore();
  const kids = members.filter((m) => m.timetable);
  const subjects = subjectMap(school);
  if (kids.length === 0) return <Empty action="Einrichten" onAction={() => openSettings('family')}>Noch kein Stundenplan</Empty>;
  const { day, offToday } = nextSchoolDay(now, marks, kids);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return (
    <div className={`dw-tt ${size}`}>
      <Head icon="🎒" title={size === 's' ? (day?.label ?? 'Schule') : `Stundenplan · ${day?.label ?? '–'}`} />
      {offToday && size !== 's' && <div className="dw-note">🏖️ Heute: {offToday}</div>}
      {!day ? (
        <Empty>Keine Schule in Sicht</Empty>
      ) : (
        <div className={`dw-body dw-tt-kids ${size === 'l' || size === 'xl' ? 'cols' : ''}`}>
          {kids.map((k) => {
            const t = k.timetable!;
            const row = t.cells[day.idx] ?? [];
            const end = lastEnd(t, day.idx);
            const lessons = row
              .map((id, p) => ({ p, subject: id ? subjects.get(id) : undefined, period: t.periods[p] }))
              .slice(0, Math.max(0, ...row.map((id, p) => (id ? p + 1 : 0))));
            const isCurrent = (p: number) =>
              day.isToday && !!t.periods[p] && minutes(t.periods[p].start) <= nowMin && nowMin < minutes(t.periods[p].end);
            return (
              <div key={k.id} className="dw-tt-kid">
                <div className="dw-tt-who">
                  <Avatar member={k} size={22} ring={false} />
                  <span className="dw-tt-name">{k.name}</span>
                  <span className="dw-tt-end">{end ? `bis ${end}` : 'frei'}</span>
                </div>
                {size !== 's' &&
                  (size === 'l' || size === 'xl' ? (
                    <div className="dw-tt-list">
                      {lessons.map(({ p, subject, period }) => (
                        <div key={p} className={`dw-tt-lesson ${isCurrent(p) ? 'now' : ''} ${subject ? '' : 'free'}`}>
                          <span className="dw-tt-p">{p + 1}</span>
                          <span className="dw-tt-sub" style={{ '--sub': subject?.color ?? 'transparent' } as CSSProperties}>
                            {subject?.name ?? 'frei'}
                          </span>
                          <span className="dw-tt-time">{period?.start}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="dw-tt-chips">
                      {lessons.map(({ p, subject }) => (
                        <span
                          key={p}
                          className={`dw-tt-chip ${isCurrent(p) ? 'now' : ''} ${subject ? '' : 'free'}`}
                          style={{ '--sub': subject?.color ?? 'transparent' } as CSSProperties}
                          title={subject?.name}
                        >
                          {subject?.short ?? '·'}
                        </span>
                      ))}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ To-dos */

function sortTodos(list: Todo[]): Todo[] {
  return [...list].sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt - b.createdAt);
}

function dueLabel(due: string | undefined, now: Date): { text: string; cls: string } | null {
  if (!due) return null;
  const today = dayKey(now);
  if (due < today) return { text: 'überfällig', cls: 'late' };
  if (due === today) return { text: 'heute', cls: 'today' };
  if (due === dayKey(addDays(now, 1))) return { text: 'morgen', cls: '' };
  return { text: fmt(new Date(due + 'T12:00'), { day: 'numeric', month: 'numeric' }), cls: '' };
}

function TodosWidget({ size }: WidgetProps) {
  const { now, todos } = useDash();
  const { memberById } = useStore();
  const [setUndo, undoNode] = useUndo();
  const [leaving, setLeaving] = useState<string[]>([]);
  const open = sortTodos(todos.todos.filter((t) => !t.done && t.text.trim()));
  const dueToday = open.filter((t) => t.due && t.due <= dayKey(now)).length;

  const check = (t: Todo) => {
    setLeaving((l) => [...l, t.id]);
    setTimeout(() => {
      todos.toggleDone(t.id);
      setLeaving((l) => l.filter((x) => x !== t.id));
      setUndo({ label: `„${t.text}“ erledigt`, fn: () => todos.toggleDone(t.id) });
    }, 350);
  };

  if (size === 's') {
    return (
      <div className="dw-count">
        <Head icon="📌" title="To-dos" />
        <div className="dw-count-num">{open.length}</div>
        <div className="dw-count-label">{open.length === 1 ? 'offene Aufgabe' : 'offene Aufgaben'}</div>
        {dueToday > 0 && <div className="dw-count-hint">{dueToday} fällig</div>}
        {undoNode}
      </div>
    );
  }

  return (
    <div className={`dw-todos ${size}`}>
      <Head icon="📌" title="To-dos" meta={open.length || undefined} />
      <div className={`dw-body dw-scroll ${size === 'm' ? 'two-col' : ''}`}>
        {open.length === 0 && <div className="dw-none">Alles erledigt 🎉</div>}
        {open.map((t) => {
          const ms = t.memberIds.map((id) => memberById.get(id)!).filter(Boolean);
          const due = dueLabel(t.due, now);
          return (
            <div key={t.id} className={`dw-todo ${leaving.includes(t.id) ? 'leaving' : ''}`}>
              <button
                className="dw-check"
                style={{ borderColor: ms[0]?.color }}
                aria-label={`${t.text} abhaken`}
                onClick={(e) => {
                  stop(e);
                  check(t);
                }}
              >
                <span className="dw-check-mark">✓</span>
              </button>
              <span className="dw-todo-text">{t.text}</span>
              {due && <span className={`dw-due ${due.cls}`}>{due.text}</span>}
              <span className="dw-todo-dot" style={{ background: gradient(ms) }} />
            </div>
          );
        })}
      </div>
      {undoNode}
    </div>
  );
}

/* ------------------------------------------------------------------ Einkauf */

const CAT_ORDER = new Map(CATEGORIES.map((c, i) => [c.id, i]));

function ShoppingWidget({ size }: WidgetProps) {
  const { shopping } = useDash();
  const [setUndo, undoNode] = useUndo();
  const [leaving, setLeaving] = useState<string[]>([]);
  const items = useMemo(() => {
    const m = new Map<string, ShopItem>();
    for (const i of BUILTIN) m.set(i.id, i);
    for (const i of shopping.custom) m.set(i.id, i);
    return m;
  }, [shopping.custom]);
  const list = shopping.list
    .map((e) => ({ e, item: items.get(e.itemId) }))
    .filter((x): x is { e: ListEntry; item: ShopItem } => !!x.item)
    .sort((a, b) => (CAT_ORDER.get(a.item.cat) ?? 99) - (CAT_ORDER.get(b.item.cat) ?? 99));

  const check = (entry: ListEntry, item: ShopItem) => {
    setLeaving((l) => [...l, entry.itemId]);
    setTimeout(() => {
      shopping.check(entry.itemId);
      setLeaving((l) => l.filter((x) => x !== entry.itemId));
      setUndo({ label: `${item.emoji} ${item.name}`, fn: () => shopping.restore(entry) });
    }, 350);
  };

  if (size === 's') {
    return (
      <div className="dw-count">
        <Head icon="🛒" title="Einkauf" />
        <div className="dw-count-num">{list.length}</div>
        <div className="dw-count-label">{list.length === 1 ? 'Artikel' : 'Artikel'} auf der Liste</div>
        <div className="dw-count-emoji">{list.slice(0, 6).map(({ item }) => item.emoji).join('')}</div>
        {undoNode}
      </div>
    );
  }

  return (
    <div className={`dw-shop ${size}`}>
      <Head icon="🛒" title="Einkaufsliste" meta={list.length || undefined} />
      <div className={`dw-body dw-scroll ${size === 'm' || size === 'l' ? 'tiles' : ''}`}>
        {list.length === 0 && <div className="dw-none">Liste ist leer</div>}
        {list.map(({ e, item }) => {
          const color = paint(CATEGORIES.find((c) => c.id === item.cat)?.color);
          return (
            <button
              key={e.itemId}
              className={`dw-shop-item ${leaving.includes(e.itemId) ? 'leaving' : ''}`}
              style={{ '--cat': color } as CSSProperties}
              onClick={(ev) => {
                stop(ev);
                check(e, item);
              }}
              aria-label={`${item.name} abhaken`}
            >
              <span className="dw-shop-emoji">{item.emoji}</span>
              <span className="dw-shop-name">{item.name}</span>
              {e.qty > 1 && <span className="dw-shop-qty">{e.qty}×</span>}
            </button>
          );
        })}
      </div>
      {undoNode}
    </div>
  );
}

/* ------------------------------------------------------------------ Fotos */

function useFullUrl(photo: Photo | undefined, enabled: boolean): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!photo || !enabled) return setUrl(undefined);
    const u = URL.createObjectURL(photo.full);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo, enabled]);
  return url;
}

function PhotosWidget({ size }: WidgetProps) {
  const { startFrame, openModule } = useDash();
  const photos = usePhotos();
  const cfg = useFrameSettings();
  const selected = (photos ?? []).filter((p) => cfg.selected.includes(p.id));
  const pool = selected.length ? selected : (photos ?? []);
  const [i, setI] = useState(() => Math.floor(Math.random() * 1000));
  useEffect(() => {
    const t = setInterval(() => setI((n) => n + 1), 20_000);
    return () => clearInterval(t);
  }, []);
  const photo = pool.length ? pool[i % pool.length] : undefined;
  const full = useFullUrl(photo, size === 'l' || size === 'xl');

  if (photos === null) return <Empty>Lädt …</Empty>;
  if (!photo) return <Empty action="Fotos hinzufügen" onAction={() => openModule('frame')}>Noch keine Fotos</Empty>;
  return (
    <div
      className="dw-photo"
      onClick={(e) => {
        if (!selected.length) return; // no slideshow selection: the tap opens the module
        stop(e);
        startFrame(photo.id);
      }}
    >
      <img key={photo.id} src={full ?? thumbUrl(photo)} alt="" draggable={false} />
      {selected.length > 0 && <span className="dw-photo-play">▶ Diashow</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ Ferien-Countdown */

const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);

function HolidaysWidget({ size }: WidgetProps) {
  const { now, openSettings } = useDash();
  const { settings } = useStore();
  const region = settings.holidays.region;
  const year = now.getFullYear();
  const [list, setList] = useState<Holiday[] | null>(null);
  useEffect(() => {
    if (!region) return;
    let alive = true;
    loadHolidays(region, [year, year + 1])
      .then((l) => alive && setList(l))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [region, year]);

  if (!region) return <Empty action="Bundesland wählen" onAction={() => openSettings('holidays')}>Ferien-Countdown</Empty>;
  if (!list) return <Empty>Lädt …</Empty>;

  const today = dayKey(now);
  const school = list.filter((h) => h.type === 'school');
  const current = school.find((h) => h.start <= today && h.end >= today);
  const next = school.find((h) => h.start > today);
  const pub = list.filter((h) => h.type === 'public' && h.start >= today && !h.name.includes('(regional)'));

  return (
    <div className={`dw-countdown ${size}`}>
      <div className="dw-cd-main">
        {current ? (
          <>
            <div className="dw-cd-kicker">🏖️ {current.name}</div>
            <div className="dw-cd-num">{daysBetween(now, parseDay(current.end)) + 1}</div>
            <div className="dw-cd-label">Ferientage übrig</div>
          </>
        ) : next ? (
          <>
            <div className="dw-cd-kicker">Noch</div>
            <div className="dw-cd-num">{daysBetween(now, parseDay(next.start))}</div>
            <div className="dw-cd-label">Tage bis {next.name.replace(/ \d{4}$/, '')}</div>
          </>
        ) : (
          <div className="dw-cd-label">Keine Ferien eingetragen</div>
        )}
      </div>
      {size === 'm' && (
        <div className="dw-cd-side">
          <div className="dw-group-label">Feiertage</div>
          {pub.slice(0, 3).map((h) => {
            const d = daysBetween(now, parseDay(h.start));
            return (
              <div key={h.id} className="dw-cd-row">
                <span className="dw-cd-name">{h.name}</span>
                <span className="dw-cd-when">{d === 0 ? 'heute' : d === 1 ? 'morgen' : `in ${d} T.`}</span>
              </div>
            );
          })}
          {current && next && (
            <div className="dw-cd-row muted">
              <span className="dw-cd-name">{next.name}</span>
              <span className="dw-cd-when">in {daysBetween(now, parseDay(next.start))} T.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Familie heute */

function FamilyWidget({ size }: WidgetProps) {
  const { now, events, todos, marks } = useDash();
  const { members, school } = useStore();
  const subjects = subjectMap(school);
  const tomorrow = addDays(startOfDay(now), 1);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const m = marks.get(dayKey(now));
  const schoolFree = now.getDay() === 0 || now.getDay() === 6 || !!(m && (m.publicNames.length || m.schoolNames.length));

  if (members.length === 0) return <Empty>Noch keine Familienmitglieder</Empty>;

  return (
    <div className={`dw-family ${size}`}>
      <Head icon="👨‍👩‍👧" title="Familie heute" />
      <div className={`dw-body dw-scroll ${size === 'xl' || size === 'l' ? 'cards' : ''}`}>
        {members.map((mem) => {
          const mine = events.filter((e) => e.memberIds.includes(mem.id) && e.end > now && e.start < tomorrow);
          const next = mine.find((e) => !e.allDay) ?? mine[0];
          const openTodos = todos.todos.filter((t) => !t.done && t.text.trim() && t.memberIds.includes(mem.id)).length;
          let schoolText: string | null = null;
          if (mem.timetable && !schoolFree) {
            const t = mem.timetable;
            const idx = now.getDay() - 1;
            const end = lastEnd(t, idx);
            if (end && nowMin < minutes(end)) {
              const p = t.periods.findIndex((per) => minutes(per.start) <= nowMin && nowMin < minutes(per.end));
              const sub = p >= 0 ? t.cells[idx]?.[p] : null;
              schoolText = sub ? `${subjects.get(sub)?.name ?? 'Unterricht'} · bis ${end}` : `Schule bis ${end}`;
            }
          }
          return (
            <div key={mem.id} className="dw-fam" style={{ '--who': mem.color } as CSSProperties}>
              <Avatar member={mem} size={size === 'm' ? 26 : 32} ring={false} />
              <div className="dw-fam-main">
                <div className="dw-fam-name">{mem.name}</div>
                <div className="dw-fam-lines">
                  {schoolText && <span className="dw-fam-line">🎒 {schoolText}</span>}
                  {next ? (
                    <span className="dw-fam-line">
                      📅 {next.allDay ? '' : `${next.start <= now ? 'jetzt' : hhmm(next.start)} `}
                      {next.title}
                      {mine.length > 1 && <span className="muted"> +{mine.length - 1}</span>}
                    </span>
                  ) : (
                    !schoolText && <span className="dw-fam-line muted">Heute nichts mehr</span>
                  )}
                  {openTodos > 0 && size !== 'm' && <span className="dw-fam-line">📌 {openTodos} offen</span>}
                </div>
              </div>
              {openTodos > 0 && size === 'm' && <span className="dw-fam-badge">📌{openTodos}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ registry */

export const WIDGET_COMPONENTS: Record<WidgetType, (p: WidgetProps) => ReactNode> = {
  clock: ClockWidget,
  weather: WeatherWidget,
  events: EventsWidget,
  timetable: TimetableWidget,
  todos: TodosWidget,
  shopping: ShoppingWidget,
  photos: PhotosWidget,
  holidays: HolidaysWidget,
  pollen: PollenWidget,
  family: FamilyWidget,
};
