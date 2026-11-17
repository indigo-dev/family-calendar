import { useEffect, useRef } from 'react';
import type { CalEvent } from '../types';
import { useStore } from '../store';
import { addDays, dayKey, fmt, fmtTime, isSameDay, overlaps, startOfDay, startOfWeek } from '../lib/dates';
import { useSize } from '../lib/hooks';
import { AvatarStack } from '../components/Avatar';
import { markClass, membersOf, stripe, tint, type ViewProps } from './common';
import { AllDayChip } from './AllDayChip';

interface Placed {
  e: CalEvent;
  top: number; // minutes from window start
  bottom: number;
  col: number;
  cols: number;
}

const MIN_DURATION = 25;

function layoutDay(events: CalEvent[], winStart: Date, winEnd: Date): Placed[] {
  const total = (winEnd.getTime() - winStart.getTime()) / 60000;
  const items = events
    .map((e) => {
      let top = (e.start.getTime() - winStart.getTime()) / 60000;
      let bottom = (e.end.getTime() - winStart.getTime()) / 60000;
      top = Math.max(0, Math.min(top, total - MIN_DURATION));
      bottom = Math.min(total, Math.max(bottom, top + MIN_DURATION));
      return { e, top, bottom, col: 0, cols: 1 };
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);

  let cluster: Placed[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const p of cluster) p.cols = colEnds.length;
    cluster = [];
    colEnds = [];
  };
  for (const p of items) {
    if (p.top >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= p.top);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(p.bottom);
    } else colEnds[col] = p.bottom;
    p.col = col;
    cluster.push(p);
    clusterEnd = Math.max(clusterEnd, p.bottom);
  }
  flush();
  return items;
}

export function TimeGridView({ date, now, events, onEvent, onOpen, marks, days }: ViewProps & { days: 1 | 7 }) {
  const { settings, memberById } = useStore();
  const first = days === 1 ? startOfDay(date) : startOfWeek(date, settings.weekStartsOn);
  const dayList = Array.from({ length: days }, (_, i) => addDays(first, i));
  const h0 = settings.dayStartHour;
  const h1 = Math.max(settings.dayEndHour, h0 + 1);
  const hours = h1 - h0;

  const [bodyRef, size] = useSize<HTMLDivElement>();
  const hourHeight = Math.max(40, Math.floor(size.height / hours) || 52);
  const pxPerMin = hourHeight / 60;
  const scrollRef = bodyRef;
  const didScroll = useRef(false);

  // When the grid is taller than the screen, scroll to the current hour once.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || didScroll.current || size.height === 0) return;
    didScroll.current = true;
    const target = (now.getHours() - h0 - 1) * hourHeight;
    if (target > 0) el.scrollTop = target;
  }, [size.height, hourHeight, h0, now, scrollRef]);

  const allDay = events.filter((e) => e.allDay);
  const timed = events.filter((e) => !e.allDay);
  const hasAllDay = dayList.some((d) => allDay.some((e) => overlaps(e.start, e.end, d, addDays(d, 1))));

  return (
    <div className={`timegrid days-${days}`}>
      <div className="tg-head">
        <div className="tg-gutter" />
        {dayList.map((d) => {
          const today = isSameDay(d, now);
          const mk = marks.get(dayKey(d));
          const label = [...(mk?.publicNames ?? []), ...(mk?.schoolNames ?? [])].join(' · ');
          return (
            <button
              key={d.toISOString()}
              className={`tg-dayhead ${today ? 'today' : ''} ${markClass(mk)}`}
              onClick={() => days > 1 && onOpen('day', d)}
            >
              <span className="tg-wd">{fmt(d, { weekday: days === 1 ? 'long' : 'short' })}</span>
              <span className="tg-dn">{d.getDate()}</span>
              {label && <span className="tg-hol" title={label}>{label}</span>}
            </button>
          );
        })}
      </div>

      {hasAllDay && (
        <div className="tg-allday">
          <div className="tg-gutter small muted">ganztägig</div>
          {dayList.map((d) => {
            const list = allDay.filter((e) => overlaps(e.start, e.end, d, addDays(d, 1)));
            return (
              <div key={d.toISOString()} className="tg-allday-cell">
                {list.slice(0, 3).map((e) => {
                  const ms = membersOf(e, memberById);
                  return (
                    <AllDayChip key={e.key} e={e} members={ms} onClick={() => onEvent(e)} />
                  );
                })}
                {list.length > 3 && (
                  <button className="more" onClick={() => onOpen('day', d)}>
                    +{list.length - 3} weitere
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="tg-body" ref={bodyRef}>
        <div className="tg-inner" style={{ height: hours * hourHeight }}>
          <div className="tg-gutter tg-hours">
            {Array.from({ length: hours }, (_, i) => (
              <div key={i} className="tg-hour-label" style={{ top: i * hourHeight }}>
                {i === 0 ? '' : `${String(h0 + i).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>
          {dayList.map((d) => {
            const winStart = new Date(d);
            winStart.setHours(h0, 0, 0, 0);
            const winEnd = new Date(d);
            winEnd.setHours(h1, 0, 0, 0);
            const dayEvents = timed.filter((e) => overlaps(e.start, e.end, startOfDay(d), addDays(startOfDay(d), 1)));
            const placed = layoutDay(dayEvents, winStart, winEnd);
            const isToday = isSameDay(d, now);
            const nowMin = (now.getTime() - winStart.getTime()) / 60000;
            return (
              <div key={d.toISOString()} className={`tg-col ${isToday ? 'today' : ''} ${markClass(marks.get(dayKey(d)))}`}>
                {Array.from({ length: hours }, (_, i) => (
                  <div key={i} className="tg-line" style={{ top: i * hourHeight }} />
                ))}
                {placed.map(({ e, top, bottom, col, cols }) => {
                  const ms = membersOf(e, memberById);
                  const height = (bottom - top) * pxPerMin - 2;
                  const compact = height < 40;
                  return (
                    <button
                      key={e.key}
                      className={`tg-event ${compact ? 'compact' : ''}`}
                      style={{
                        top: top * pxPerMin + 1,
                        height,
                        left: `calc(${(col / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                        background: tint(ms[0]?.color ?? '#888'),
                      }}
                      onClick={() => onEvent(e)}
                    >
                      <span className="ev-stripe" style={{ background: stripe(ms) }} />
                      <span className="ev-body">
                        <span className="ev-title">{e.title}</span>
                        {!compact && (
                          <span className="ev-time">
                            {fmtTime(e.start)} – {fmtTime(e.end)}
                            {e.location ? ` · ${e.location}` : ''}
                          </span>
                        )}
                      </span>
                      {!compact && days === 1 && <AvatarStack members={ms} size={24} />}
                      {!compact && days > 1 && ms.length > 1 && <AvatarStack members={ms} size={18} />}
                    </button>
                  );
                })}
                {isToday && nowMin >= 0 && nowMin <= hours * 60 && (
                  <div className="tg-now" style={{ top: nowMin * pxPerMin }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
