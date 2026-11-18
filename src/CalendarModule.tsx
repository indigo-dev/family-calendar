import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CalEvent, ViewMode } from './types';
import { useStore } from './store';
import { rangeFor, startOfDay, stepDate, titleFor } from './lib/dates';
import { useEvents } from './lib/events';
import { useHolidayMarks } from './lib/holidays';
import { useSwipe } from './lib/hooks';
import { Header, MemberFilter } from './components/Header';
import { EventDetail } from './components/EventDetail';
import { TimeGridView } from './views/TimeGridView';
import { MonthView } from './views/MonthView';
import { YearView } from './views/YearView';
import { AgendaView } from './views/AgendaView';

interface Props {
  now: Date;
  /** changes when the settings panel closes -> reload calendars */
  reloadKey: number;
  settingsOpen: boolean;
  onSettings: () => void;
}

export function CalendarModule({ now, reloadKey, settingsOpen, onSettings }: Props) {
  const { settings, members, calendars, selectedIds, memberById } = useStore();
  const [view, setView] = useState<ViewMode>(settings.defaultView);
  const [date, setDate] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [nonce, setNonce] = useState(0);
  const [banner, setBanner] = useState<string | undefined>();
  const lastInteraction = useRef(Date.now());

  const firstReload = useRef(true);
  useEffect(() => {
    if (firstReload.current) firstReload.current = false;
    else setNonce((n) => n + 1);
  }, [reloadKey]);

  const range = useMemo(() => rangeFor(view, date, settings.weekStartsOn), [view, date, settings.weekStartsOn]);
  const { events, loading, status, lastUpdated } = useEvents(range, members, calendars, settings.proxyUrl, nonce);
  const { marks } = useHolidayMarks(range, settings.holidays);

  // calendar problems shown at the person: memberId -> message
  const memberIssues = useMemo(() => {
    const out: Record<string, string> = {};
    for (const c of calendars) {
      const st = status[c.id];
      if (!st || st.state === 'ok') continue;
      for (const id of c.memberIds) out[id] = (out[id] ? out[id] + '\n' : '') + `${c.name}: ${st.message}`;
    }
    return out;
  }, [calendars, status]);

  // periodic refresh + refresh when the app comes back to the foreground
  useEffect(() => {
    const t = setInterval(() => setNonce((n) => n + 1), settings.refreshMinutes * 60_000);
    const onVis = () => document.visibilityState === 'visible' && setNonce((n) => n + 1);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [settings.refreshMinutes]);

  // after inactivity jump back to the default view / today (wall display mode)
  useEffect(() => {
    const mark = () => (lastInteraction.current = Date.now());
    window.addEventListener('pointerdown', mark, { passive: true });
    window.addEventListener('keydown', mark);
    return () => {
      window.removeEventListener('pointerdown', mark);
      window.removeEventListener('keydown', mark);
    };
  }, []);
  useEffect(() => {
    if (!settings.idleResetMinutes || settingsOpen) return;
    if (Date.now() - lastInteraction.current < settings.idleResetMinutes * 60_000) return;
    setSelected(null);
    setView(settings.defaultView);
    setDate(startOfDay(new Date()));
  }, [now, settings.idleResetMinutes, settings.defaultView, settingsOpen]);

  // date rollover at midnight: keep "today" current if the user is looking at today
  const prevDay = useRef(startOfDay(now).getTime());
  useEffect(() => {
    const today = startOfDay(now).getTime();
    if (today !== prevDay.current) {
      setDate((d) => (d.getTime() === prevDay.current ? new Date(today) : d));
      prevDay.current = today;
      setNonce((n) => n + 1);
    }
  }, [now]);

  const step = useCallback((dir: 1 | -1) => setDate((d) => stepDate(view, d, dir)), [view]);
  const swipe = useSwipe(step);

  const open = useCallback((v: ViewMode, d: Date) => {
    setView(v);
    setDate(startOfDay(d));
  }, []);

  const visible = useMemo(
    () =>
      events
        .map((e) => ({ ...e, memberIds: e.memberIds.filter((id) => memberById.has(id)) }))
        .filter((e) => (selectedIds.size > 0 ? e.memberIds.some((id) => selectedIds.has(id)) : e.memberIds.length > 0)),
    [events, selectedIds, memberById],
  );

  const viewProps = { date, now, events: visible, onEvent: setSelected, onOpen: open, marks };

  return (
    <>
      <Header
        title={titleFor(view, date, settings.weekStartsOn)}
        view={view}
        now={now}
        loading={loading}
        onView={setView}
        onStep={step}
        onToday={() => setDate(startOfDay(new Date()))}
        onRefresh={() => setNonce((n) => n + 1)}
        onSettings={onSettings}
      />
      <MemberFilter issues={memberIssues} onIssue={setBanner} />
      {banner && (
        <div className="banner error" onClick={() => setBanner(undefined)}>
          {banner} <span className="muted">(antippen zum Schließen)</span>
        </div>
      )}
      <main className="view" {...swipe}>
        {view === 'day' && <TimeGridView {...viewProps} days={1} />}
        {view === 'week' && <TimeGridView {...viewProps} days={7} />}
        {view === 'month' && <MonthView {...viewProps} />}
        {view === 'year' && <YearView {...viewProps} />}
        {view === 'agenda' && <AgendaView {...viewProps} />}
      </main>
      {lastUpdated && (
        <div className="statusline muted">Stand {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
      )}
      {selected && <EventDetail event={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
