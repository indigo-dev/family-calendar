import { useMemo } from 'react';
import { useStore } from '../store';
import { addDays, dayKey, fmt, isSameDay, startOfDay, startOfWeek, weekdayNames } from '../lib/dates';
import { markClass, type ViewProps } from './common';

export function YearView({ date, now, events, onOpen, marks }: ViewProps) {
  const { settings, memberById } = useStore();
  const year = date.getFullYear();

  // dayKey -> ordered member ids with events that day
  const busy = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const e of events) {
      let d = startOfDay(e.start);
      // guard: long events are capped to 62 days
      for (let i = 0; d < e.end && i < 62; i++, d = addDays(d, 1)) {
        const k = dayKey(d);
        const arr = map.get(k) ?? [];
        for (const id of e.memberIds) if (!arr.includes(id)) arr.push(id);
        map.set(k, arr);
      }
    }
    return map;
  }, [events]);

  const names = weekdayNames(settings.weekStartsOn, 'narrow');

  return (
    <div className="year">
      {Array.from({ length: 12 }, (_, m) => {
        const first = new Date(year, m, 1);
        const gridStart = startOfWeek(first, settings.weekStartsOn);
        const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
        const isCurrent = now.getFullYear() === year && now.getMonth() === m;
        return (
          <div key={m} className={`year-month ${isCurrent ? 'current' : ''}`}>
            <button className="year-title" onClick={() => onOpen('month', first)}>
              {fmt(first, { month: 'long' })}
            </button>
            <div className="year-grid">
              {names.map((n, i) => (
                <div key={'h' + i} className="year-wd">
                  {n}
                </div>
              ))}
              {days.map((d) => {
                if (d.getMonth() !== m) return <div key={d.toISOString()} />;
                const ids = busy.get(dayKey(d)) ?? [];
                return (
                  <button
                    key={d.toISOString()}
                    className={`year-day ${isSameDay(d, now) ? 'today' : ''} ${markClass(marks.get(dayKey(d)))}`}
                    title={[...(marks.get(dayKey(d))?.publicNames ?? []), ...(marks.get(dayKey(d))?.schoolNames ?? [])].join(', ') || undefined}
                    onClick={() => onOpen('day', d)}
                  >
                    <span>{d.getDate()}</span>
                    <span className="year-dots">
                      {ids.slice(0, 4).map((id) => (
                        <span key={id} className="dot" style={{ background: memberById.get(id)?.color }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
