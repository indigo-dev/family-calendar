import type { CalEvent, Member } from '../types';
import { useStore } from '../store';
import { addDays, fmt, fmtTime, isSameDay } from '../lib/dates';
import { Avatar } from './Avatar';
import { Modal } from './Modal';
import { t } from '../i18n';

export function describeWhen(e: CalEvent): string {
  if (e.allDay) {
    const last = addDays(e.end, -1);
    const d = (x: Date) => fmt(x, { weekday: 'short', day: 'numeric', month: 'long' });
    return isSameDay(e.start, last) ? `${d(e.start)} · ${t('common.allDay')}` : `${d(e.start)} – ${d(last)} · ${t('common.allDay')}`;
  }
  if (isSameDay(e.start, e.end)) {
    return `${fmt(e.start, { weekday: 'short', day: 'numeric', month: 'long' })} · ${fmtTime(e.start)} – ${fmtTime(e.end)}`;
  }
  const d = (x: Date) => `${fmt(x, { weekday: 'short', day: 'numeric', month: 'short' })} ${fmtTime(x)}`;
  return `${d(e.start)} – ${d(e.end)}`;
}

export function EventDetail({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const { memberById } = useStore();
  const members = event.memberIds.map((id) => memberById.get(id)).filter((m): m is Member => !!m);
  return (
    <Modal onClose={onClose} label={event.title}>
      <div className="modal event-detail">
        <div className="event-detail-bar" style={{ background: members[0]?.color }} />
        <h2>{event.title}</h2>
        <p className="muted">{describeWhen(event)}</p>
        {event.location && <p>📍 {event.location}</p>}
        <div className="event-detail-members">
          {members.map((m) => (
            <span key={m.id} className="chip static">
              <Avatar member={m} size={26} ring={false} />
              {m.name}
            </span>
          ))}
        </div>
        {event.notes && <p className="event-notes">{event.notes}</p>}
        {event.calendarName && <p className="muted small">{t('calendar.calendarOf', { name: event.calendarName })}</p>}
        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
