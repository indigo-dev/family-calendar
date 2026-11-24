import type { CSSProperties } from 'react';
import { useStore } from '../../store';
import { addDays, dayKey, startOfDay, fmtHHMM } from '../../lib/dates';
import { minutes, subjectMap } from '../../lib/school';
import { Avatar } from '../../components/Avatar';
import { Empty, Head, hhmm, lastEnd, useDash, type WidgetProps } from './shared';
import { useMinute } from '../../lib/clock';
import { t } from '../../i18n';

export function FamilyWidget({ size }: WidgetProps) {
  const { events, todos, marks } = useDash();
  const now = useMinute();
  const { members, school, paint, settings } = useStore();
  const subjects = subjectMap(school, paint);
  const tomorrow = addDays(startOfDay(now), 1);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const m = marks.get(dayKey(now));
  const schoolFree = now.getDay() === 0 || now.getDay() === 6 || !!(m && (m.publicNames.length || m.schoolNames.length));

  if (members.length === 0) return <Empty>{t('dashboard.noMembers')}</Empty>;

  return (
    <div className={`dw-family ${size}`}>
      <Head icon="👨‍👩‍👧" title={t('dashboard.widgets.family.title')} />
      <div className={`dw-body dw-scroll ${size === 'xl' || size === 'l' ? 'cards' : ''}`}>
        {members.map((mem) => {
          const mine = events.filter((e) => e.memberIds.includes(mem.id) && e.end > now && e.start < tomorrow);
          const next = mine.find((e) => !e.allDay) ?? mine[0];
          const openTodos = todos.todos.filter((x) => !x.done && x.text.trim() && x.memberIds.includes(mem.id)).length;
          let schoolText: string | null = null;
          if (settings.schoolEnabled && mem.timetable && !schoolFree) {
            const tt = mem.timetable;
            const idx = now.getDay() - 1;
            const end = lastEnd(tt, idx);
            if (end && nowMin < minutes(end)) {
              const p = tt.periods.findIndex((per) => minutes(per.start) <= nowMin && nowMin < minutes(per.end));
              const sub = p >= 0 ? tt.cells[idx]?.[p] : null;
              const time = fmtHHMM(end);
              schoolText = sub
                ? t('dashboard.subjectUntil', { subject: subjects.get(sub)?.name ?? t('dashboard.lesson'), time })
                : t('dashboard.schoolUntil', { time });
            }
          }
          return (
            <div key={mem.id} className="dw-fam" style={{ '--who': mem.color } as CSSProperties}>
              <Avatar member={mem} size={size === 'm' ? 26 : 32} ring={false} />
              <div className="dw-fam-main">
                <div className="dw-fam-name">{mem.name}</div>
                <div className="dw-fam-lines">
                  {schoolText && <span className="dw-fam-line">🎒 {schoolText}</span>}
                  {next ? (
                    <span className="dw-fam-line">
                      📅 {next.allDay ? '' : `${next.start <= now ? t('dashboard.now') : hhmm(next.start)} `}
                      {next.title}
                      {mine.length > 1 && <span className="muted"> +{mine.length - 1}</span>}
                    </span>
                  ) : (
                    !schoolText && <span className="dw-fam-line muted">{t('dashboard.nothingToday')}</span>
                  )}
                  {openTodos > 0 && size !== 'm' && <span className="dw-fam-line">📌 {t('dashboard.openCount', { n: openTodos })}</span>}
                </div>
              </div>
              {openTodos > 0 && size === 'm' && <span className="dw-fam-badge">📌{openTodos}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
