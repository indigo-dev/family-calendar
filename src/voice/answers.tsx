import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { proxyOf, useEvents } from '../lib/events';
import { addDays, fmt, fmtTime, startOfDay } from '../lib/dates';
import { describe, useWeather, useWeatherSettings } from '../lib/weather';
import { BUILTIN, norm, useShopping } from '../lib/shopping';
import { useTodos } from '../lib/todos';
import { schoolHours, subjectMap } from '../lib/school';
import { EVERYONE, type EventsRequest, type TimetableQuestion, type TodosQuestion, type WeatherRequest } from './command';
import { findMembers, joinAnd, numberWord, whoOf } from './apply';
import { t } from '../i18n';

/* Answers to questions: they load their data like the modules do and speak once it is there. */

const fromYmd = (s: string) => new Date(`${s}T00:00`);

/** "heute", "morgen", "Freitag, 27. November" */
export function dayLabel(date: Date, now = new Date()): string {
  const diff = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (diff === 0) return t('voice.today');
  if (diff === 1) return t('voice.tomorrow');
  if (diff === 2) return t('voice.dayAfter');
  if (diff === -1) return t('voice.yesterday');
  return fmt(date, { weekday: 'long', day: 'numeric', month: 'long' });
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** speaks a text once (also under StrictMode's double effects) */
function useSpeakOnce(text: string | null, speak: (t: string) => void) {
  const said = useRef(false);
  useEffect(() => {
    if (text && !said.current) {
      said.current = true;
      speak(text);
    }
  }, [text, speak]);
}

export function WeatherAnswer({ req, speak }: { req: WeatherRequest; speak: (t: string) => void }) {
  const { places } = useWeatherSettings();
  const place =
    (req.place && places.find((p) => norm(p.name).includes(norm(req.place!)) || norm(req.place!).includes(norm(p.name)))) || places[0];
  const { data, loading, error } = useWeather(place);
  const date = fromYmd(req.date);
  const day = data?.days.find((d) => d.date === req.date);
  const where = place && places.length > 1 ? t('voice.in', { place: place.name }) : '';

  let text: string | null = null;
  if (!place) text = t('voice.noPlace');
  else if (day) {
    const now = new Date();
    const today = req.date === data!.days[0]?.date;
    const current = today && data!.current ? t('voice.currently', { temp: Math.round(data!.current.temp) }) : '';
    const rain = day.rainProb >= 30 ? t('voice.rainRisk', { n: day.rainProb }) : '';
    text = t('voice.weatherLine', {
      day: cap(dayLabel(date, now)),
      where,
      text: describe(day.code).text,
      min: Math.round(day.min),
      max: Math.round(day.max),
      current,
      rain,
    });
  } else if (data) text = t('voice.noForecast', { day: dayLabel(date) });
  else if (error && !loading) text = error;
  useSpeakOnce(text, speak);

  return (
    <div className="voice-answer">
      <span className="voice-line-icon" aria-hidden>
        {day ? describe(day.code).icon : '⛅'}
      </span>
      <span>{text ?? t('voice.weatherLoading')}</span>
    </div>
  );
}

export function EventsAnswer({ req, speak }: { req: EventsRequest; speak: (t: string) => void }) {
  const { members, calendars, settings } = useStore();
  const range = useMemo(() => ({ start: fromYmd(req.from), end: addDays(fromYmd(req.to), 1) }), [req.from, req.to]);
  const { events, lastUpdated } = useEvents(range, members, calendars, proxyOf(settings), 0);
  const who = findMembers(members, req.members);
  const list = events.filter(
    (e) => e.end > range.start && e.start < range.end && (!who.length || e.memberIds.some((id) => who.some((m) => m.id === id))),
  );
  const oneDay = req.from === req.to;
  const span = oneDay ? dayLabel(range.start) : t('voice.spanTo', { from: dayLabel(range.start), to: dayLabel(fromYmd(req.to)) });
  const forWho = who.length ? t('voice.forWhom', { names: joinAnd(who.map((m) => m.name)) }) : '';
  const names = (ids: string[]) => members.filter((m) => ids.includes(m.id)).map((m) => m.name);

  const when = (e: (typeof list)[number]) =>
    `${oneDay ? '' : `${fmt(e.start, { weekday: 'short' })} `}${e.allDay ? t('common.allDay') : t('voice.clock', { time: fmtTime(e.start) })}`;

  let text: string | null = null;
  if (lastUpdated) {
    if (!list.length) text = t('voice.noEvents', { span: cap(span), who: forWho });
    else {
      const first = list.slice(0, 5).map((e) => `${when(e)} ${e.title}`);
      const more = list.length > 5 ? t('voice.andMore', { n: list.length - 5 }) : '';
      text = t('voice.eventsLine', { span: cap(span), who: forWho, list: first.join(', '), more });
    }
  }
  useSpeakOnce(text, speak);

  return (
    <div className="voice-answer events">
      <div className="voice-answer-head">
        <span className="voice-line-icon" aria-hidden>
          📅
        </span>
        <span>
          {cap(span)}
          {forWho}
          {!lastUpdated ? t('voice.loading') : !list.length ? t('voice.noEventsShort') : ''}
        </span>
      </div>
      {list.length > 0 && (
        <ul className="voice-events">
          {list.slice(0, 8).map((e) => (
            <li key={e.key}>
              <span className="voice-event-time">{when(e)}</span>
              <span className="voice-event-title">{e.title}</span>
              <span className="voice-event-who">{names(e.memberIds).join(', ')}</span>
            </li>
          ))}
          {list.length > 8 && <li className="muted">{t('voice.moreItems', { n: list.length - 8 })}</li>}
        </ul>
      )}
    </div>
  );
}

/** at most this many entries are read aloud, the rest is counted */
const SPOKEN = 8;
const spokenList = (xs: string[]) =>
  // "und 1 weitere" would be silly: cut only if at least two are left over
  joinAnd(xs.length > SPOKEN + 1 ? [...xs.slice(0, SPOKEN), t('voice.nMore', { n: xs.length - SPOKEN })] : xs);

/** "heute", "morgen", "am Freitag, 27. November" */
function onDay(date: Date): string {
  const diff = Math.round((startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
  return diff >= -1 && diff <= 2 ? dayLabel(date) : t('voice.onDay', { day: dayLabel(date) });
}

/** "Was steht auf der Einkaufsliste?" */
export function ShoppingAnswer({ speak }: { speak: (t: string) => void }) {
  const shop = useShopping();
  const items = new Map([...BUILTIN, ...shop.custom].map((i) => [i.id, i]));
  const rows = [...shop.list]
    .sort((a, b) => a.addedAt - b.addedAt)
    .flatMap((e) => {
      const item = items.get(e.itemId);
      return item ? [{ item, qty: e.qty }] : [];
    });
  // the list as it was when asked; ticking things off meanwhile must not start speaking again
  const [text] = useState(() =>
    rows.length
      ? t('voice.shoppingLine', {
          n: rows.length,
          list: spokenList(rows.map((r) => (r.qty > 1 ? `${numberWord(r.qty)} ${r.item.name}` : r.item.name))),
        })
      : t('voice.shoppingEmpty'),
  );
  useSpeakOnce(text, speak);

  return (
    <div className="voice-answer events">
      <div className="voice-answer-head">
        <span className="voice-line-icon" aria-hidden>
          🛒
        </span>
        <span>{rows.length ? t('voice.shoppingHead', { n: rows.length }) : t('voice.shoppingEmpty')}</span>
      </div>
      {rows.length > 0 && (
        <ul className="voice-events">
          {rows.slice(0, 12).map(({ item, qty }) => (
            <li key={item.id}>
              <span className="voice-event-time">{item.emoji}</span>
              <span className="voice-event-title">{item.name}</span>
              <span className="voice-event-who">{qty > 1 ? `× ${qty}` : ''}</span>
            </li>
          ))}
          {rows.length > 12 && <li className="muted">{t('voice.moreItems', { n: rows.length - 12 })}</li>}
        </ul>
      )}
    </div>
  );
}

/** "Welche Aufgaben hat Jan?" */
export function TodosAnswer({ req, speak }: { req: TodosQuestion; speak: (t: string) => void }) {
  const { members } = useStore();
  const { todos } = useTodos();
  const who = whoOf(members, req.members);
  const ids = new Set(who.map((m) => m.id));
  const forWho = who.length === members.length ? t('voice.family') : joinAnd(who.map((m) => m.name));
  const open = todos
    .filter((x) => !x.done && x.memberIds.some((id) => ids.has(id)))
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt - b.createdAt);
  const names = (memberIds: string[]) =>
    memberIds.length === members.length ? t('voice.everyone') : joinAnd(members.filter((m) => memberIds.includes(m.id)).map((m) => m.name));
  const due = (d?: string) => (d ? fmt(fromYmd(d), { weekday: 'short', day: 'numeric', month: 'numeric' }) : '');

  // as it was when asked; checking one off meanwhile must not start speaking again
  const [text] = useState(() =>
    open.length
      ? t('voice.todosLine', { n: open.length, who: forWho, list: spokenList(open.map((x) => x.text)) })
      : t('voice.noTodos', { who: forWho }),
  );
  useSpeakOnce(text, speak);

  return (
    <div className="voice-answer events">
      <div className="voice-answer-head">
        <span className="voice-line-icon" aria-hidden>
          📌
        </span>
        <span>{open.length ? t('voice.todosHead', { n: open.length, who: forWho }) : t('voice.noTodos', { who: forWho })}</span>
      </div>
      {open.length > 0 && (
        <ul className="voice-events">
          {open.slice(0, 10).map((x) => (
            <li key={x.id}>
              <span className="voice-event-time">{due(x.due)}</span>
              <span className="voice-event-title">{x.text}</span>
              <span className="voice-event-who">{who.length > 1 ? names(x.memberIds) : ''}</span>
            </li>
          ))}
          {open.length > 10 && <li className="muted">{t('voice.moreItems', { n: open.length - 10 })}</li>}
        </ul>
      )}
    </div>
  );
}

/** "Was hat Jan morgen?" – the lessons of one school day per child */
export function TimetableAnswer({ req, speak }: { req: TimetableQuestion; speak: (t: string) => void }) {
  const { members, school, paint, settings } = useStore();
  const who = whoOf(members, req.members);
  const date = fromYmd(req.date);
  const day = (date.getDay() + 6) % 7; // 0 = Monday
  const when = onDay(date);
  const subjects = subjectMap(school, paint);

  const rows = who.map((m) => {
    const tt = m.timetable;
    if (!tt) return { m, text: t('voice.noTimetable', { name: m.name }) };
    const hours = day < 5 ? schoolHours(tt, day) : null;
    if (!hours) return { m, text: t('voice.noLessons', { name: m.name, when }) };
    const cells = (tt.cells[day] ?? []).filter((c): c is string => !!c);
    // a double lesson is read once
    const names = cells.map((id) => subjects.get(id)?.name ?? id).filter((n, i, xs) => n !== xs[i - 1]);
    return {
      m,
      text: t('voice.lessonsLine', { name: m.name, when, n: cells.length, start: hours.start, end: hours.end, list: joinAnd(names) }),
    };
  });
  // asked for the whole family: only the school children
  const shown = req.members.includes(EVERYONE) ? rows.filter((r) => r.m.timetable) : rows;
  const lines = !settings.schoolEnabled ? [t('voice.schoolOff')] : shown.length ? shown.map((r) => r.text) : [t('voice.noSchoolKids')];
  const [text] = useState(() => lines.join(' '));
  useSpeakOnce(text, speak);

  return (
    <div className="voice-answer events">
      <div className="voice-answer-head">
        <span className="voice-line-icon" aria-hidden>
          🎒
        </span>
        <span>{cap(when)}</span>
      </div>
      <ul className="voice-events">
        {lines.map((l, i) => (
          <li key={i} className="voice-text-row">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
