import { useRef } from 'react';
import type { Member, ViewMode } from '../types';
import { fmt } from '../lib/dates';
import { useStore } from '../store';
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

const LONG_PRESS_MS = 450;

/** Tap = only this person, long press = add/remove this person to/from the selection. */
function MemberChip({ member, active, dimmed, onTap, onLongPress }: {
  member: Member;
  active: boolean;
  dimmed: boolean;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    start.current = null;
  };

  return (
    <button
      className={`chip ${active ? 'on' : ''} ${dimmed ? 'off' : ''}`}
      style={{
        borderColor: dimmed ? undefined : member.color,
        background: active ? `color-mix(in srgb, ${member.color} 22%, var(--surface))` : undefined,
      }}
      aria-pressed={active}
      onPointerDown={(e) => {
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        timer.current = window.setTimeout(() => {
          fired.current = true;
          timer.current = undefined;
          onLongPress();
        }, LONG_PRESS_MS);
      }}
      onPointerMove={(e) => {
        // finger moves (e.g. scrolling the chip bar) -> no long press
        const s = start.current;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (fired.current) {
          fired.current = false; // click after a long press is swallowed
          return;
        }
        onTap();
      }}
    >
      <Avatar member={member} size={30} ring={false} />
      {member.name}
    </button>
  );
}

export function MemberFilter({ issues, onIssue }: { issues: Record<string, string>; onIssue: (message: string) => void }) {
  const { members, selectedIds, selectOnly, toggleSelected, showAll } = useStore();
  if (members.length === 0) return null;
  const all = selectedIds.size === 0;
  return (
    <nav className="filterbar" aria-label="Personenfilter">
      <button className={`chip all ${all ? 'on' : ''}`} aria-pressed={all} onClick={showAll}>
        Alle
      </button>
      {members.map((m) => {
        const active = selectedIds.has(m.id);
        const issue = issues[m.id];
        return (
          <span key={m.id} className="chip-wrap">
            <MemberChip
              member={m}
              active={active}
              dimmed={!all && !active}
              onTap={() => selectOnly(m.id)}
              onLongPress={() => toggleSelected(m.id)}
            />
            {issue && (
              <button className="warn-badge error" title={issue} onClick={() => onIssue(`Kalender von ${m.name} nicht geladen – ${issue}`)}>
                !
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
