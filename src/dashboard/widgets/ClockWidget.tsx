import { dayKey, fmt, isoWeek } from '../../lib/dates';

import { deg, describe, useHomeWeather } from '../../lib/weather';
import { hhmm, useDash, type WidgetProps } from './shared';
import { useMinute } from '../../lib/clock';
import { t } from '../../i18n';

export function ClockWidget({ size }: WidgetProps) {
  const { marks } = useDash();
  const now = useMinute();
  const { data } = useHomeWeather();
  const m = marks.get(dayKey(now));
  const special = m?.publicNames[0] ?? m?.schoolNames[0];
  const cur = data && describe(data.current.code, data.current.isDay);
  return (
    <div className={`dw-clock ${size}`}>
      <div className="dw-clock-time">{hhmm(now)}</div>
      <div className="dw-clock-day">{fmt(now, { weekday: 'long' })}</div>
      <div className="dw-clock-date">
        {fmt(now, size === 's' ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'long', year: 'numeric' })}
        {size !== 's' && <span className="dw-clock-kw"> · {t('dashboard.week', { n: isoWeek(now) })}</span>}
      </div>
      {size !== 's' && (special || cur) && (
        <div className="dw-clock-extra">
          {cur && data && (
            <span>
              {cur.icon} {deg(data.current.temp)}
            </span>
          )}
          {special && <span className="dw-clock-special">🎉 {special}</span>}
        </div>
      )}
    </div>
  );
}
