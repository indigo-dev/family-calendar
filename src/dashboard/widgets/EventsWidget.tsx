import type { CalEvent, Member } from '../../types';
import { useStore } from '../../store';
import { addDays, fmt, startOfDay } from '../../lib/dates';
import { AvatarStack } from '../../components/Avatar';
import { gradient, Head, hhmm, useDash, type WidgetProps } from './shared';
import { useMinute } from '../../lib/clock';

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

export function EventsWidget({ size }: WidgetProps) {
  const { events } = useDash();
  const now = useMinute();
  const { memberById } = useStore();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const todays = events.filter((e) => e.end > now && e.start < tomorrow);
  const tomorrows = events.filter((e) => e.start < addDays(tomorrow, 1) && e.end > tomorrow);

  const group = (label: string, list: CalEvent[], none: string) => (
    <div className="dw-group">
      <div className="dw-group-label">{label}</div>
      {list.length === 0 ? (
        <div className="dw-none">{none}</div>
      ) : (
        list.map((e) => <EventRow key={e.key} e={e} now={now} byId={memberById} />)
      )}
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
