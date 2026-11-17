import type { ViewMode } from '../types';
import { fmt } from '../lib/dates';
import { useStore } from '../store';
import type { MemberStatus } from '../lib/events';
import { Avatar } from './Avatar';

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'day', label: 'Tag' },
  { id: 'week', label: 'Woche' },
  { id: 'month', label: 'Monat' },
  { id: 'year', label: 'Jahr' },
  { id: 'agenda', label: 'Agenda' },
];

interface Props {
  title: string;
  view: ViewMode;
  now: Date;
  loading: boolean;
  onView: (v: ViewMode) => void;
  onStep: (dir: 1 | -1) => void;
  onToday: () => void;
  onRefresh: () => void;
  onSettings: () => void;
}

export function Header({ title, view, now, loading, onView, onStep, onToday, onRefresh, onSettings }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="nav">
          <button className="icon-btn" onClick={() => onStep(-1)} aria-label="Zurück">
            ‹
          </button>
          <button className="btn" onClick={onToday}>
            Heute
          </button>
          <button className="icon-btn" onClick={() => onStep(1)} aria-label="Weiter">
            ›
          </button>
        </div>
        <h1 className="title">{title}</h1>
      </div>
      <div className="segmented" role="tablist">
        {VIEWS.map((v) => (
          <button key={v.id} role="tab" aria-selected={view === v.id} className={view === v.id ? 'active' : ''} onClick={() => onView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      <div className="topbar-right">
        <div className="clock">
          <span className="clock-time">{fmt(now, { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="clock-date">{fmt(now, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        </div>
        <button className={`icon-btn ${loading ? 'spin' : ''}`} onClick={onRefresh} aria-label="Aktualisieren">
          ⟳
        </button>
        <button className="icon-btn" onClick={onSettings} aria-label="Einstellungen">
          ⚙
        </button>
      </div>
    </header>
  );
}

export function MemberFilter({ status, onReauth }: { status: Record<string, MemberStatus>; onReauth: (memberId: string) => void }) {
  const { members, hidden, toggleMember, showAll, showOnly } = useStore();
  if (members.length === 0) return null;
  const allVisible = hidden.size === 0;
  return (
    <nav className="filterbar">
      <button className={`chip all ${allVisible ? 'on' : ''}`} onClick={showAll}>
        Alle
      </button>
      {members.map((m) => {
        const on = !hidden.has(m.id);
        const st = status[m.id];
        return (
          <span key={m.id} className="chip-wrap">
            <button
              className={`chip ${on ? 'on' : 'off'}`}
              style={on ? { borderColor: m.color, background: `color-mix(in srgb, ${m.color} 16%, var(--surface))` } : undefined}
              onClick={() => toggleMember(m.id)}
              onDoubleClick={() => showOnly(m.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                showOnly(m.id);
              }}
            >
              <Avatar member={m} size={30} ring={false} />
              {m.name}
            </button>
            {st && st.state !== 'ok' && (
              <button
                className={`warn-badge ${st.state}`}
                title={st.message}
                onClick={() => st.state === 'auth' && onReauth(m.id)}
              >
                {st.state === 'auth' ? 'Anmelden' : '!'}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
