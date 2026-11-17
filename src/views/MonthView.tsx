import { useStore } from '../store';
import { addDays, dayKey, fmtTime, isSameDay, isoWeek, overlaps, startOfMonth, startOfWeek, weekdayNames } from '../lib/dates';
import { useSize } from '../lib/hooks';
import type { CalEvent } from '../types';
import { membersOf, type ViewProps } from './common';
import { AllDayChip } from './AllDayChip';

const CHIP_H = 22;

export function MonthView({ date, now, events, onEvent, onOpen }: ViewProps) {
  const { settings, memberById } = useStore();
  const first = startOfWeek(startOfMonth(date), settings.weekStartsOn);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const weeks = Math.ceil((monthEnd.getTime() - first.getTime()) / (7 * 86400000));
  const [gridRef, size] = useSize<HTMLDivElement>();
  const cellH = size.height / weeks;
  const maxChips = Math.max(1, Math.floor((cellH - 34) / CHIP_H));

  const byDay = new Map<string, CalEvent[]>();
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(first, i);
    byDay.set(
      dayKey(d),
      events
        .filter((e) => overlaps(e.start, e.end, d, addDays(d, 1)))
        .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime()),
    );
  }

  return (
    <div className="month">
      <div className="month-head">
        <div className="month-wk" />
        {weekdayNames(settings.weekStartsOn).map((n) => (
          <div key={n}>{n}</div>
        ))}
      </div>
      <div className="month-grid" ref={gridRef} style={{ gridTemplateRows: `repeat(${weeks}, 1fr)` }}>
        {Array.from({ length: weeks }, (_, w) => {
          const weekStart = addDays(first, w * 7);
          return (
            <div className="month-row" key={w}>
              <button className="month-wk" onClick={() => onOpen('week', weekStart)}>
                {isoWeek(weekStart)}
              </button>
              {Array.from({ length: 7 }, (_, i) => {
                const d = addDays(weekStart, i);
                const list = byDay.get(dayKey(d)) ?? [];
                const shown = list.length > maxChips ? list.slice(0, maxChips - 1) : list;
                const other = d.getMonth() !== date.getMonth();
                return (
                  <div key={i} className={`month-cell ${other ? 'other' : ''} ${isSameDay(d, now) ? 'today' : ''}`}>
                    <button className="month-dn" onClick={() => onOpen('day', d)}>
                      {d.getDate()}
                    </button>
                    <div className="month-events">
                      {shown.map((e) => {
                        const ms = membersOf(e, memberById);
                        return e.allDay ? (
                          <AllDayChip key={e.key} e={e} members={ms} onClick={() => onEvent(e)} />
                        ) : (
                          <button key={e.key} className="chip-event" onClick={() => onEvent(e)}>
                            <span className="dots">
                              {ms.map((m) => (
                                <span key={m.id} className="dot" style={{ background: m.color }} />
                              ))}
                            </span>
                            <span className="t">{fmtTime(e.start)}</span>
                            <span className="n">{e.title}</span>
                          </button>
                        );
                      })}
                      {list.length > shown.length && (
                        <button className="more" onClick={() => onOpen('day', d)}>
                          +{list.length - shown.length} weitere
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
