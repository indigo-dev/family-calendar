import type { CSSProperties } from 'react';
import type { DayMarks, Member } from '../../types';
import { useStore } from '../../store';
import { addDays, dayKey, fmt, startOfDay, fmtHHMM } from '../../lib/dates';
import { minutes, subjectMap } from '../../lib/school';
import { Avatar } from '../../components/Avatar';
import { Empty, Head, lastEnd, useDash, type WidgetProps } from './shared';
import { useMinute } from '../../lib/clock';
import { t } from '../../i18n';

interface SchoolDay {
  date: Date;
  /** 0 = Mo … 4 = Fr */
  idx: number;
  label: string;
  isToday: boolean;
}

/** Today if school is still running, otherwise the next school day (skips weekends and holidays). */
function nextSchoolDay(now: Date, marks: Map<string, DayMarks>, kids: Member[]): { day: SchoolDay | null; offToday?: string } {
  const today = startOfDay(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const tm = marks.get(dayKey(today));
  const offToday = tm?.publicNames[0] ?? tm?.schoolNames[0];
  for (let i = 0; i < 21; i++) {
    const date = addDays(today, i);
    const wd = date.getDay();
    if (wd === 0 || wd === 6) continue;
    const m = marks.get(dayKey(date));
    if (m && (m.publicNames.length || m.schoolNames.length)) continue;
    const idx = wd - 1;
    if (i === 0) {
      const ends = kids.map((k) => lastEnd(k.timetable!, idx)).filter((x): x is string => !!x);
      if (!ends.length || nowMin >= Math.max(...ends.map(minutes))) continue;
    }
    const label =
      i === 0 ? t('common.today') : i === 1 ? t('common.tomorrow') : fmt(date, { weekday: 'long', day: 'numeric', month: 'numeric' });
    return { day: { date, idx, label, isToday: i === 0 }, offToday };
  }
  return { day: null, offToday };
}

export function TimetableWidget({ size }: WidgetProps) {
  const { marks, openSettings } = useDash();
  const now = useMinute();
  const { members, school, paint } = useStore();
  const kids = members.filter((m) => m.timetable);
  const subjects = subjectMap(school, paint);
  if (kids.length === 0)
    return (
      <Empty action={t('dashboard.setUp')} onAction={() => openSettings('family')}>
        {t('dashboard.noTimetable')}
      </Empty>
    );
  const { day, offToday } = nextSchoolDay(now, marks, kids);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return (
    <div className={`dw-tt ${size}`}>
      <Head
        icon="🎒"
        title={size === 's' ? (day?.label ?? t('dashboard.school')) : t('dashboard.timetableDay', { day: day?.label ?? '–' })}
      />
      {offToday && size !== 's' && <div className="dw-note">🏖️ {t('dashboard.offToday', { name: offToday })}</div>}
      {!day ? (
        <Empty>{t('dashboard.noSchool')}</Empty>
      ) : (
        <div className={`dw-body dw-tt-kids ${size === 'l' || size === 'xl' ? 'cols' : ''}`}>
          {kids.map((k) => {
            const tt = k.timetable!;
            const row = tt.cells[day.idx] ?? [];
            const end = lastEnd(tt, day.idx);
            const lessons = row
              .map((id, p) => ({ p, subject: id ? subjects.get(id) : undefined, period: tt.periods[p] }))
              .slice(0, Math.max(0, ...row.map((id, p) => (id ? p + 1 : 0))));
            const isCurrent = (p: number) =>
              day.isToday && !!tt.periods[p] && minutes(tt.periods[p].start) <= nowMin && nowMin < minutes(tt.periods[p].end);
            return (
              <div key={k.id} className="dw-tt-kid">
                <div className="dw-tt-who">
                  <Avatar member={k} size={22} ring={false} />
                  <span className="dw-tt-name">{k.name}</span>
                  <span className="dw-tt-end">{end ? t('dashboard.until', { time: fmtHHMM(end) }) : t('dashboard.free')}</span>
                </div>
                {size !== 's' &&
                  (size === 'l' || size === 'xl' ? (
                    <div className="dw-tt-list">
                      {lessons.map(({ p, subject, period }) => (
                        <div key={p} className={`dw-tt-lesson ${isCurrent(p) ? 'now' : ''} ${subject ? '' : 'free'}`}>
                          <span className="dw-tt-p">{p + 1}</span>
                          <span className="dw-tt-sub" style={{ '--sub': subject?.color ?? 'transparent' } as CSSProperties}>
                            {subject?.name ?? t('dashboard.free')}
                          </span>
                          <span className="dw-tt-time">{period && fmtHHMM(period.start)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="dw-tt-chips">
                      {lessons.map(({ p, subject }) => (
                        <span
                          key={p}
                          className={`dw-tt-chip ${isCurrent(p) ? 'now' : ''} ${subject ? '' : 'free'}`}
                          style={{ '--sub': subject?.color ?? 'transparent' } as CSSProperties}
                          title={subject?.name}
                        >
                          {subject?.short ?? '·'}
                        </span>
                      ))}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
