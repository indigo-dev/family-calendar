import type { ReactNode } from 'react';
import { useTapOrLongPress } from '../lib/hooks';
import type { Member, ViewMode } from '../types';
import { fmt, fmtTime } from '../lib/dates';
import { useMinute } from '../lib/clock';
import { useStore } from '../store';
import { Avatar } from './Avatar';
import { GlyphIcon } from './Icon';
import { WeatherChip } from '../weather/WeatherChip';
import { t } from '../i18n';

const VIEWS: ViewMode[] = ['day', 'days', 'week', 'month', 'year', 'agenda'];

interface Props {
  title: string;
  view: ViewMode;
  loading: boolean;
  /** day count of the 'days' view */
  multiDays: number;
  onMultiDays: (n: number) => void;
  onView: (v: ViewMode) => void;
  onStep: (dir: 1 | -1) => void;
  onToday: () => void;
  onRefresh: () => void;
  onSettings: () => void;
  onWeather: () => void;
}

export function Header({ title, view, loading, multiDays, onMultiDays, onView, onStep, onToday, onRefresh, onSettings, onWeather }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="nav">
          <button className="icon-btn" onClick={() => onStep(-1)} aria-label={t('common.back')}>
            <GlyphIcon glyph="‹" name="back" />
          </button>
          <button className="btn" onClick={onToday}>
            {t('common.today')}
          </button>
          <button className="icon-btn" onClick={() => onStep(1)} aria-label={t('common.forward')}>
            <GlyphIcon glyph="›" name="forward" />
          </button>
        </div>
        <Title text={title} />
      </div>
      <div className="segmented" role="tablist">
        {VIEWS.map((v) =>
          v === 'days' && view === 'days' ? (
            // active N-days tab: − / + change the number of days
            <span key={v} role="tab" aria-selected className="active seg-days">
              <button
                className="seg-step"
                onClick={() => onMultiDays(multiDays - 1)}
                disabled={multiDays <= 2}
                aria-label={t('calendar.fewerDays')}
              >
                −
              </button>
              <span>{t('calendar.nDays', { n: multiDays })}</span>
              <button
                className="seg-step"
                onClick={() => onMultiDays(multiDays + 1)}
                disabled={multiDays >= 6}
                aria-label={t('calendar.moreDays')}
              >
                +
              </button>
            </span>
          ) : (
            <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'active' : ''} onClick={() => onView(v)}>
              {v === 'days' ? t('calendar.nDays', { n: multiDays }) : t(`calendar.views.${v}`)}
            </button>
          ),
        )}
      </div>
      <div className="topbar-right">
        <WeatherChip onClick={onWeather} />
        <Clock />
        <button className={`icon-btn ${loading ? 'spin' : ''}`} onClick={onRefresh} aria-label={t('common.refresh')}>
          <GlyphIcon glyph="⟳" name="refresh" />
        </button>
        <button className="icon-btn" onClick={onSettings} aria-label={t('common.settings')}>
          <GlyphIcon glyph="⚙" name="settings" />
        </button>
      </div>
    </header>
  );
}

/** "November 2026" -> month bold, year as its own span (some styles set it lighter). */
function Title({ text }: { text: string }) {
  const m = /^(.*\S)\s+(\d{4})$/.exec(text);
  return (
    <h1 className="title">
      {m ? (
        <>
          {m[1]} <span className="title-year">{m[2]}</span>
        </>
      ) : (
        text
      )}
    </h1>
  );
}

/** Time and date; the only part of the header that changes every minute. */
function Clock() {
  const now = useMinute();
  return (
    <div className="clock">
      <span className="clock-time">{fmtTime(now)}</span>
      <span className="clock-date">{fmt(now, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
    </div>
  );
}

/** Simple header for modules without date navigation (to-dos, ...). */
export function ModuleHeader({
  title,
  onSettings,
  actions,
  clock = true,
}: {
  title: ReactNode;
  onSettings: () => void;
  actions?: ReactNode;
  clock?: boolean;
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="title">{title}</h1>
      </div>
      <div className="topbar-right">
        {clock && <Clock />}
        {actions}
        <button className="icon-btn" onClick={onSettings} aria-label={t('common.settings')}>
          <GlyphIcon glyph="⚙" name="settings" />
        </button>
      </div>
    </header>
  );
}

/** Tap = only this person, long press = add/remove this person to/from the selection. */
/** Person chip of the filter bars: tap = only this person, long press = add / remove. */
export function MemberChip({
  member,
  active,
  dimmed,
  disabled,
  onTap,
  onLongPress,
}: {
  member: Member;
  active: boolean;
  dimmed: boolean;
  disabled?: boolean;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const press = useTapOrLongPress(onTap, onLongPress);
  return (
    <button
      className={`chip ${active ? 'on' : ''} ${dimmed ? 'off' : ''}`}
      style={{
        borderColor: dimmed ? undefined : member.color,
        background: active ? `color-mix(in srgb, ${member.color} 22%, var(--surface))` : undefined,
      }}
      aria-pressed={active}
      disabled={disabled}
      {...press}
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
    <nav className="filterbar" aria-label={t('calendar.memberFilter')}>
      <button className={`chip all ${all ? 'on' : ''}`} aria-pressed={all} onClick={showAll}>
        {t('common.all')}
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
              <button className="warn-badge error" title={issue} onClick={() => onIssue(t('calendar.notLoaded', { name: m.name, issue }))}>
                !
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
