import { useStore } from '../store';
import { addDays, AGENDA_DAYS, fmt, fmtTime, isSameDay, overlaps, startOfDay } from '../lib/dates';
import { AvatarStack } from '../components/Avatar';
import { membersOf, stripe, type ViewProps } from './common';

export function AgendaView({ date, now, events, onEvent, onOpen }: ViewProps) {
  const { memberById } = useStore();
  const start = startOfDay(date);
  const days = Array.from({ length: AGENDA_DAYS }, (_, i) => addDays(start, i));
  const groups = days
    .map((d) => ({ d, list: events.filter((e) => overlaps(e.start, e.end, d, addDays(d, 1))) }))
    .filter((g) => g.list.length > 0 || isSameDay(g.d, now));

  return (
    <div className="agenda">
      {groups.length === 0 && <p className="empty">Keine Termine in diesem Zeitraum.</p>}
      {groups.map(({ d, list }) => {
        const today = isSameDay(d, now);
        const tomorrow = isSameDay(d, addDays(startOfDay(now), 1));
        return (
          <section key={d.toISOString()} className={`agenda-day ${today ? 'today' : ''}`}>
            <button className="agenda-date" onClick={() => onOpen('day', d)}>
              <span className="agenda-dn">{d.getDate()}</span>
              <span className="agenda-wd">
                {today ? 'Heute' : tomorrow ? 'Morgen' : fmt(d, { weekday: 'long' })}
                <small>{fmt(d, { month: 'long', year: 'numeric' })}</small>
              </span>
            </button>
            <div className="agenda-list">
              {list.length === 0 && <p className="muted">Keine Termine</p>}
              {list.map((e) => {
                const ms = membersOf(e, memberById);
                const past = !e.allDay && e.end < now;
                return (
                  <button key={e.key} className={`agenda-item ${past ? 'past' : ''}`} onClick={() => onEvent(e)}>
                    <span className="agenda-time">
                      {e.allDay ? 'ganztägig' : (
                        <>
                          {fmtTime(e.start)}
                          <small>{fmtTime(e.end)}</small>
                        </>
                      )}
                    </span>
                    <span className="ev-stripe" style={{ background: stripe(ms) }} />
                    <span className="agenda-text">
                      <span className="ev-title">{e.title}</span>
                      {e.location && <span className="muted small">📍 {e.location}</span>}
                    </span>
                    <AvatarStack members={ms} size={30} />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
