import { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { dayKey, startOfDay } from '../../lib/dates';
import { loadHolidays, type Holiday } from '../../lib/holidays';
import { Empty, useDash, type WidgetProps } from './shared';
import { useToday } from '../../lib/clock';

const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);

export function HolidaysWidget({ size }: WidgetProps) {
  const { openSettings } = useDash();
  const now = useToday();
  const { settings } = useStore();
  const region = settings.holidays.region;
  const year = now.getFullYear();
  const [list, setList] = useState<Holiday[] | null>(null);
  useEffect(() => {
    if (!region) return;
    let alive = true;
    loadHolidays(region, [year, year + 1])
      .then((l) => alive && setList(l))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [region, year]);

  if (!region)
    return (
      <Empty action="Bundesland wählen" onAction={() => openSettings('holidays')}>
        Ferien-Countdown
      </Empty>
    );
  if (!list) return <Empty>Lädt …</Empty>;

  const today = dayKey(now);
  const school = list.filter((h) => h.type === 'school');
  const current = school.find((h) => h.start <= today && h.end >= today);
  const next = school.find((h) => h.start > today);
  const pub = list.filter((h) => h.type === 'public' && h.start >= today && !h.name.includes('(regional)'));

  return (
    <div className={`dw-countdown ${size}`}>
      <div className="dw-cd-main">
        {current ? (
          <>
            <div className="dw-cd-kicker">🏖️ {current.name}</div>
            <div className="dw-cd-num">{daysBetween(now, parseDay(current.end)) + 1}</div>
            <div className="dw-cd-label">Ferientage übrig</div>
          </>
        ) : next ? (
          <>
            <div className="dw-cd-kicker">Noch</div>
            <div className="dw-cd-num">{daysBetween(now, parseDay(next.start))}</div>
            <div className="dw-cd-label">Tage bis {next.name.replace(/ \d{4}$/, '')}</div>
          </>
        ) : (
          <div className="dw-cd-label">Keine Ferien eingetragen</div>
        )}
      </div>
      {size === 'm' && (
        <div className="dw-cd-side">
          <div className="dw-group-label">Feiertage</div>
          {pub.slice(0, 3).map((h) => {
            const d = daysBetween(now, parseDay(h.start));
            return (
              <div key={h.id} className="dw-cd-row">
                <span className="dw-cd-name">{h.name}</span>
                <span className="dw-cd-when">{d === 0 ? 'heute' : d === 1 ? 'morgen' : `in ${d} T.`}</span>
              </div>
            );
          })}
          {current && next && (
            <div className="dw-cd-row muted">
              <span className="dw-cd-name">{next.name}</span>
              <span className="dw-cd-when">in {daysBetween(now, parseDay(next.start))} T.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
