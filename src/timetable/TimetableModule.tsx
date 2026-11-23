import { useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactElement } from 'react';
import type { DayMarks, Member, Subject, Timetable } from '../types';
import { useStore } from '../store';
import { addDays, dayKey, fmt, startOfDay, startOfWeek, fmtHHMM } from '../lib/dates';
import { useHolidayMarks } from '../lib/holidays';
import { minutes, newSubject, SCHOOL_DAYS, SCHOOL_TYPES, SUBJECT_COLORS, subjectMap, subjectsFor, schoolDayName } from '../lib/school';
import { Avatar } from '../components/Avatar';
import { MemberChip } from '../components/Header';
import { useMinute } from '../lib/clock';
import { t } from '../i18n';

/** Breaks of at least this many minutes get their own row. */
const BREAK_MIN = 10;

interface DayInfo {
  date: Date;
  today: boolean;
  /** holiday / school holiday name, the timetable does not apply */
  off?: string;
}

/** The school week to show: this week, from Saturday on the next one. */
function schoolWeek(now: Date, marks: Map<string, DayMarks>): DayInfo[] {
  const today = startOfDay(now);
  let monday = startOfWeek(today, 1);
  if (today.getDay() === 0 || today.getDay() === 6) monday = addDays(monday, 7);
  return SCHOOL_DAYS.map((_, i) => {
    const date = addDays(monday, i);
    const m = marks.get(dayKey(date));
    const off = m?.publicNames[0] ?? m?.schoolNames[0];
    return { date, today: date.getTime() === today.getTime(), off };
  });
}

export function TimetableModule({ onSettings }: { onSettings: () => void }) {
  const now = useMinute();
  const { members, school, updateMember, updateSchool, selectedIds, settings, paint: paintColor } = useStore();
  const kids = members.filter((m) => m.timetable);
  // chosen children, empty = all; starts with the children picked in the person filter
  const fromFilter = () => kids.filter((k) => selectedIds.has(k.id)).map((k) => k.id);
  const [chosen, setChosen] = useState<string[]>(fromFilter);
  // the person filter changed while the timetable is open (e.g. "zeig mir den Stundenplan von Jan"): follow it
  const filterKey = [...selectedIds].sort().join();
  const [seenFilter, setSeenFilter] = useState(filterKey);
  if (seenFilter !== filterKey) {
    setSeenFilter(filterKey);
    setChosen(fromFilter());
  }
  const [editing, setEditing] = useState(false);
  const [brush, setBrush] = useState<string | null>(null);

  // same logic as the person filter elsewhere: tap = only this child (again = all), long press = add / remove
  const chooseOnly = (id: string) => setChosen((cur) => (cur.length === 1 && cur[0] === id ? [] : [id]));
  const toggleChosen = (id: string) => setChosen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const picked = kids.filter((k) => chosen.includes(k.id));
  const shown = picked.length ? picked : kids;
  // editing needs exactly one timetable
  const active = shown.length === 1 ? shown[0] : null;
  const all = picked.length === 0;

  const monday = startOfWeek(addDays(startOfDay(now), now.getDay() === 6 ? 2 : now.getDay() === 0 ? 1 : 0), 1).getTime();
  const range = useMemo(() => ({ start: new Date(monday), end: addDays(new Date(monday), 7) }), [monday]);
  const { marks } = useHolidayMarks(range, settings.holidays);
  const days = useMemo(() => schoolWeek(now, marks), [now, marks]);
  const subjects = subjectMap(school, paintColor);

  // works on the current state: a fast stroke paints several cells before the next render
  const paint = (member: Member, day: number, period: number, value: string | null) =>
    updateMember(member.id, (m) => {
      const tt = m.timetable;
      if (!tt || (tt.cells[day][period] ?? null) === value) return {};
      const cells = tt.cells.map((row, d) => (d === day ? row.map((c, p) => (p === period ? value : c)) : row));
      return { timetable: { ...tt, cells } };
    });

  if (kids.length === 0) {
    return (
      <main className="view tt-view">
        <div className="tt-empty">
          <p>{t('timetable.none')}</p>
          <p className="muted">
            {t('timetable.howTo1')} <strong>{t('settings.tabs.family')}</strong> {t('timetable.howTo2')}
          </p>
          <button className="btn primary" onClick={onSettings}>
            {t('timetable.openSettings')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="board-toolbar">
        {kids.length > 1 && (
          <nav className="filterbar" aria-label={t('timetable.kids')}>
            <button className={`chip all ${all ? 'on' : ''}`} aria-pressed={all} onClick={() => setChosen([])} disabled={editing}>
              {t('common.all')}
            </button>
            {kids.map((k) => {
              const on = chosen.includes(k.id);
              return (
                <MemberChip
                  key={k.id}
                  member={k}
                  active={on}
                  dimmed={!all && !on}
                  disabled={editing}
                  onTap={() => chooseOnly(k.id)}
                  onLongPress={() => toggleChosen(k.id)}
                />
              );
            })}
          </nav>
        )}
        <span className="board-spacer" />
        {active &&
          (editing ? (
            <button className="btn primary" onClick={() => setEditing(false)}>
              {t('common.done')}
            </button>
          ) : (
            <button
              className="btn"
              onClick={() => {
                setBrush(subjectsFor(active.timetable!.schoolType, school, paintColor)[0]?.id ?? null);
                setEditing(true);
              }}
            >
              {t('timetable.edit')}
            </button>
          ))}
      </div>{' '}
      <main className={`view tt-view ${shown.length > 1 ? 'multi' : ''}`} data-vt-section>
        <div className="tt-sheets">
          {shown.map((k) => (
            <TimetableGrid
              key={k.id}
              member={k}
              timetable={k.timetable!}
              subjects={subjects}
              days={days}
              now={now}
              titled={shown.length > 1}
              editing={editing && active?.id === k.id}
              brush={brush}
              onPaint={(d, p, v) => paint(k, d, p, v)}
            />
          ))}
        </div>
      </main>
      {editing && active && (
        <Palette
          subjects={subjectsFor(active.timetable!.schoolType, school, paintColor)}
          schoolLabel={SCHOOL_TYPES[active.timetable!.schoolType]}
          brush={brush}
          onBrush={setBrush}
          onAdd={(s) => {
            updateSchool({ custom: [...school.custom, s] });
            setBrush(s.id);
          }}
        />
      )}
    </>
  );
}

type Row = { kind: 'period'; p: number } | { kind: 'break'; label: string };

function TimetableGrid({
  member,
  timetable,
  subjects,
  days,
  now,
  titled,
  editing,
  brush,
  onPaint,
}: {
  member: Member;
  timetable: Timetable;
  subjects: Map<string, Subject>;
  days: DayInfo[];
  now: Date;
  titled: boolean;
  editing: boolean;
  brush: string | null;
  onPaint: (day: number, period: number, value: string | null) => void;
}) {
  const { periods, cells } = timetable;
  const lastUsed = cells.reduce(
    (max, row) =>
      Math.max(
        max,
        row.reduce((m, c, p) => (c ? p : m), -1),
      ),
    -1,
  );
  const count = editing ? periods.length : Math.min(periods.length, Math.max(lastUsed + 1, 6));
  const empty = lastUsed < 0;

  const rows: Row[] = [];
  const rowOf: number[] = [];
  const breakBefore: boolean[] = [];
  for (let p = 0; p < count; p++) {
    const gap = p > 0 ? minutes(periods[p].start) - minutes(periods[p - 1].end) : 0;
    breakBefore[p] = gap >= BREAK_MIN;
    if (breakBefore[p]) rows.push({ kind: 'break', label: t(gap >= 30 ? 'timetable.lunch' : 'timetable.break', { n: gap }) });
    rows.push({ kind: 'period', p });
    rowOf[p] = rows.length + 1; // grid row (row 1 = day header)
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const current = (d: number, p: number) =>
    days[d].today && !days[d].off && nowMin >= minutes(periods[p].start) && nowMin < minutes(periods[p].end);

  // --- painting: tap or drag across cells
  const stroke = useRef<{ value: string | null; last: string } | null>(null);
  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cell]');
    if (!el || el.dataset.member !== member.id) return null;
    const [d, p] = el.dataset.cell!.split(':').map(Number);
    return { d, p, key: el.dataset.cell! };
  };
  const handlers = editing
    ? {
        onPointerDown: (e: PointerEvent) => {
          const c = cellAt(e.clientX, e.clientY);
          if (!c) return;
          (e.target as Element).releasePointerCapture?.(e.pointerId);
          // tapping a cell that already has the chosen subject clears it
          const value = cells[c.d][c.p] === brush ? null : brush;
          stroke.current = { value, last: c.key };
          onPaint(c.d, c.p, value);
        },
        onPointerMove: (e: PointerEvent) => {
          const s = stroke.current;
          if (!s) return;
          const c = cellAt(e.clientX, e.clientY);
          if (!c || c.key === s.last) return;
          s.last = c.key;
          onPaint(c.d, c.p, s.value);
        },
        onPointerUp: () => (stroke.current = null),
        onPointerCancel: () => (stroke.current = null),
        onPointerLeave: () => (stroke.current = null),
      }
    : {};

  const items: ReactElement[] = [];
  days.forEach((day, d) => {
    let p = 0;
    while (p < count) {
      const id = cells[d][p];
      let q = p;
      if (!editing && id) while (q + 1 < count && cells[d][q + 1] === id && !breakBefore[q + 1]) q++;
      const s = id ? subjects.get(id) : undefined;
      const isNow = !editing && Array.from({ length: q - p + 1 }, (_, i) => current(d, p + i)).some(Boolean);
      items.push(
        <div
          key={`${d}-${p}`}
          className={`tt-cell ${s ? 'filled' : 'free'} ${day.today ? 'today' : ''} ${day.off && !editing ? 'off' : ''} ${isNow ? 'now' : ''}`}
          style={{ gridColumn: d + 2, gridRow: `${rowOf[p]} / ${rowOf[q] + 1}`, ...(s ? ({ '--c': s.color } as CSSProperties) : {}) }}
          data-cell={`${d}:${p}`}
          data-member={member.id}
        >
          {s ? (
            <>
              <span className="tt-name">{s.name}</span>
              <span className="tt-short">{s.short}</span>
              {q > p && <span className="tt-double">{t('timetable.double')}</span>}
            </>
          ) : id ? (
            <span className="tt-short">?</span>
          ) : null}
        </div>,
      );
      p = q + 1;
    }
  });

  const template = ['auto', ...rows.map((r) => (r.kind === 'break' ? '14px' : 'minmax(40px, 1fr)'))].join(' ');

  return (
    <section className={`tt-sheet ${editing ? 'editing' : ''}`}>
      {titled && (
        <h2 className="tt-sheet-title">
          <Avatar member={member} size={26} ring={false} />
          {member.name}
        </h2>
      )}
      <div className="tt-grid" style={{ gridTemplateRows: template }} {...handlers}>
        <div className="tt-corner" style={{ gridRow: 1, gridColumn: 1 }} />
        {days.map((day, d) => (
          <div key={d} className={`tt-day ${day.today ? 'today' : ''} ${day.off ? 'off' : ''}`} style={{ gridRow: 1, gridColumn: d + 2 }}>
            <span className="tt-wd">{schoolDayName(d)}</span>
            <span className="tt-date">{fmt(day.date, { day: 'numeric', month: 'numeric' })}</span>
            {day.off && (
              <span className="tt-off" title={day.off}>
                {day.off}
              </span>
            )}
          </div>
        ))}
        {rows.map((r, i) =>
          r.kind === 'break' ? (
            <div key={`b${i}`} className="tt-break" style={{ gridRow: i + 2, gridColumn: '1 / -1' }}>
              <span>{r.label}</span>
            </div>
          ) : (
            <div key={`t${i}`} className="tt-time" style={{ gridRow: i + 2, gridColumn: 1 }}>
              <strong>{r.p + 1}.</strong>
              <small>{fmtHHMM(periods[r.p].start)}</small>
              <small className="tt-time-end">{fmtHHMM(periods[r.p].end)}</small>
            </div>
          ),
        )}
        {items}
      </div>
      {empty && !editing && <p className="tt-hint muted">{t('timetable.emptyHint')}</p>}
    </section>
  );
}

function Palette({
  subjects,
  schoolLabel,
  brush,
  onBrush,
  onAdd,
}: {
  subjects: Subject[];
  schoolLabel: string;
  brush: string | null;
  onBrush: (id: string | null) => void;
  onAdd: (s: Subject) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(SUBJECT_COLORS[0]);

  return (
    <div className="tt-palette">
      <p className="tt-palette-hint muted">{t('timetable.paletteHint', { school: schoolLabel })}</p>
      <div className="tt-palette-chips">
        {subjects.map((s) => (
          <button
            key={s.id}
            className={`tt-subject ${brush === s.id ? 'on' : ''}`}
            style={{ '--c': s.color } as CSSProperties}
            aria-pressed={brush === s.id}
            onClick={() => onBrush(s.id)}
          >
            {s.name}
          </button>
        ))}
        <button className={`tt-subject eraser ${brush === null ? 'on' : ''}`} aria-pressed={brush === null} onClick={() => onBrush(null)}>
          {t('timetable.eraser')}
        </button>
        <button className="tt-subject add" onClick={() => setAdding((v) => !v)}>
          {t('timetable.addSubject')}
        </button>
      </div>
      {adding && (
        <div className="tt-add">
          <input value={name} placeholder={t('timetable.subjectName')} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="swatches">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${color === c ? 'on' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>
          <button
            className="btn primary"
            disabled={!name.trim()}
            onClick={() => {
              onAdd(newSubject(name, color));
              setName('');
              setAdding(false);
            }}
          >
            {t('timetable.add')}
          </button>
        </div>
      )}
    </div>
  );
}
