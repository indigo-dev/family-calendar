import { useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactElement } from 'react';
import type { DayMarks, Member, Subject, Timetable } from '../types';
import { useStore } from '../store';
import { addDays, dayKey, fmt, startOfDay, startOfWeek } from '../lib/dates';
import { useHolidayMarks } from '../lib/holidays';
import { minutes, newSubject, SCHOOL_DAYS, SCHOOL_TYPES, SUBJECT_COLORS, subjectMap, subjectsFor } from '../lib/school';
import { Avatar } from '../components/Avatar';

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

export function TimetableModule({ now, onSettings }: { now: Date; onSettings: () => void }) {
  const { members, school, updateMember, updateSchool, selectedIds, settings, paint: paintColor } = useStore();
  const kids = members.filter((m) => m.timetable);
  const [choice, setChoice] = useState<string | null>(() => {
    const sel = kids.filter((k) => selectedIds.has(k.id));
    return sel.length === 1 ? sel[0].id : null;
  });
  const [editing, setEditing] = useState(false);
  const [brush, setBrush] = useState<string | null>(null);

  // null = all children (or the only one)
  const active = kids.find((k) => k.id === choice) ?? (kids.length === 1 ? kids[0] : null);
  const shown = active ? [active] : kids;

  const monday = startOfWeek(addDays(startOfDay(now), now.getDay() === 6 ? 2 : now.getDay() === 0 ? 1 : 0), 1).getTime();
  const range = useMemo(() => ({ start: new Date(monday), end: addDays(new Date(monday), 7) }), [monday]);
  const { marks } = useHolidayMarks(range, settings.holidays);
  const days = useMemo(() => schoolWeek(now, marks), [now, marks]);
  const subjects = subjectMap(school, paintColor);

  // works on the current state: a fast stroke paints several cells before the next render
  const paint = (member: Member, day: number, period: number, value: string | null) =>
    updateMember(member.id, (m) => {
      const t = m.timetable;
      if (!t || (t.cells[day][period] ?? null) === value) return {};
      const cells = t.cells.map((row, d) => (d === day ? row.map((c, p) => (p === period ? value : c)) : row));
      return { timetable: { ...t, cells } };
    });

  if (kids.length === 0) {
    return (
      <main className="view tt-view">
        <div className="tt-empty">
          <p>Noch kein Stundenplan angelegt.</p>
          <p className="muted">
            In den Einstellungen unter <strong>Familie</strong> beim Kind „Hat Stundenplan“ einschalten.
          </p>
          <button className="btn primary" onClick={onSettings}>
            Einstellungen öffnen
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="board-toolbar">
        {kids.length > 1 && (
          <nav className="filterbar" aria-label="Kinder">
            <button className={`chip all ${!active ? 'on' : ''}`} aria-pressed={!active} onClick={() => setChoice(null)} disabled={editing}>
              Alle
            </button>
            {kids.map((k) => {
              const on = active?.id === k.id;
              return (
                <button
                  key={k.id}
                  className={`chip ${on ? 'on' : ''} ${active && !on ? 'off' : ''}`}
                  style={{
                    borderColor: active && !on ? undefined : k.color,
                    background: on ? `color-mix(in srgb, ${k.color} 22%, var(--surface))` : undefined,
                  }}
                  aria-pressed={on}
                  disabled={editing}
                  onClick={() => setChoice(on ? null : k.id)}
                >
                  <Avatar member={k} size={30} ring={false} />
                  {k.name}
                </button>
              );
            })}
          </nav>
        )}
        <span className="board-spacer" />
        {active &&
          (editing ? (
            <button className="btn primary" onClick={() => setEditing(false)}>
              Fertig
            </button>
          ) : (
            <button
              className="btn"
              onClick={() => {
                setBrush(subjectsFor(active.timetable!.schoolType, school, paintColor)[0]?.id ?? null);
                setEditing(true);
              }}
            >
              ✎ Bearbeiten
            </button>
          ))}
      </div>

      <main className={`view tt-view ${shown.length > 1 ? 'multi' : ''}`}>
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
  const lastUsed = cells.reduce((max, row) => Math.max(max, row.reduce((m, c, p) => (c ? p : m), -1)), -1);
  const count = editing ? periods.length : Math.min(periods.length, Math.max(lastUsed + 1, 6));
  const empty = lastUsed < 0;

  const rows: Row[] = [];
  const rowOf: number[] = [];
  const breakBefore: boolean[] = [];
  for (let p = 0; p < count; p++) {
    const gap = p > 0 ? minutes(periods[p].start) - minutes(periods[p - 1].end) : 0;
    breakBefore[p] = gap >= BREAK_MIN;
    if (breakBefore[p]) rows.push({ kind: 'break', label: gap >= 30 ? `Mittagspause · ${gap} min` : `Pause · ${gap} min` });
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
              {q > p && <span className="tt-double">Doppelstunde</span>}
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
            <span className="tt-wd">{SCHOOL_DAYS[d]}</span>
            <span className="tt-date">{fmt(day.date, { day: 'numeric', month: 'numeric' })}</span>
            {day.off && <span className="tt-off" title={day.off}>{day.off}</span>}
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
              <small>{periods[r.p].start}</small>
              <small className="tt-time-end">{periods[r.p].end}</small>
            </div>
          ),
        )}
        {items}
      </div>
      {empty && !editing && <p className="tt-hint muted">Noch leer – tippe oben auf „Bearbeiten“, um Fächer einzutragen.</p>}
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
      <p className="tt-palette-hint muted">
        Fach wählen, dann Stunden antippen oder darüberwischen. Nochmal tippen löscht. ({schoolLabel})
      </p>
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
          ⌫ Radierer
        </button>
        <button className="tt-subject add" onClick={() => setAdding((v) => !v)}>
          + Fach
        </button>
      </div>
      {adding && (
        <div className="tt-add">
          <input value={name} placeholder="Name des Fachs" onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="swatches">
            {SUBJECT_COLORS.map((c) => (
              <button key={c} className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
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
            Hinzufügen
          </button>
        </div>
      )}
    </div>
  );
}
