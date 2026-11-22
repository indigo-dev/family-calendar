import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store';
import { proxyOf, useEvents } from '../lib/events';
import { addDays, fmt, fmtTime, startOfDay } from '../lib/dates';
import { describe, useWeather, useWeatherSettings } from '../lib/weather';
import { norm } from '../lib/shopping';
import type { EventsRequest, WeatherRequest } from './command';
import { findMembers, joinAnd } from './apply';

/* Answers to questions: they load their data like the modules do and speak once it is there. */

const fromYmd = (s: string) => new Date(`${s}T00:00`);

/** "heute", "morgen", "Freitag, 27. November" */
export function dayLabel(date: Date, now = new Date()): string {
  const diff = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (diff === 0) return 'heute';
  if (diff === 1) return 'morgen';
  if (diff === 2) return 'übermorgen';
  if (diff === -1) return 'gestern';
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
  const where = place && places.length > 1 ? ` in ${place.name}` : '';

  let text: string | null = null;
  if (!place) text = 'Es ist noch kein Wetter-Ort eingerichtet.';
  else if (day) {
    const now = new Date();
    const today = req.date === data!.days[0]?.date;
    const cur = today && data!.current ? `, gerade ${Math.round(data!.current.temp)} Grad` : '';
    const rain = day.rainProb >= 30 ? `, Regenrisiko ${day.rainProb} Prozent` : '';
    text = `${cap(dayLabel(date, now))}${where}: ${describe(day.code).text}, ${Math.round(day.min)} bis ${Math.round(day.max)} Grad${cur}${rain}.`;
  } else if (data) text = `Für ${dayLabel(date)} gibt es noch keine Vorhersage.`;
  else if (error && !loading) text = error;
  useSpeakOnce(text, speak);

  return (
    <div className="voice-answer">
      <span className="voice-line-icon" aria-hidden>
        {day ? describe(day.code).icon : '⛅'}
      </span>
      <span>{text ?? 'Wetter wird geladen …'}</span>
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
  const span = oneDay ? dayLabel(range.start) : `${dayLabel(range.start)} bis ${dayLabel(fromYmd(req.to))}`;
  const forWho = who.length ? ` für ${joinAnd(who.map((m) => m.name))}` : '';
  const names = (ids: string[]) => members.filter((m) => ids.includes(m.id)).map((m) => m.name);

  const when = (e: (typeof list)[number]) =>
    `${oneDay ? '' : `${fmt(e.start, { weekday: 'short' })} `}${e.allDay ? 'ganztägig' : `${fmtTime(e.start)} Uhr`}`;

  let text: string | null = null;
  if (lastUpdated) {
    if (!list.length) text = `${cap(span)}${forWho} stehen keine Termine an.`;
    else {
      const first = list.slice(0, 5).map((e) => `${when(e)} ${e.title}`);
      const more = list.length > 5 ? ` und ${list.length - 5} weitere` : '';
      text = `${cap(span)}${forWho}: ${first.join(', ')}${more}.`;
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
          {!lastUpdated ? ' – wird geladen …' : !list.length ? ': keine Termine' : ''}
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
          {list.length > 8 && <li className="muted">… und {list.length - 8} weitere</li>}
        </ul>
      )}
    </div>
  );
}
