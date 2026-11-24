import type { CSSProperties } from 'react';
import { dayKey, fmt, hourLabel } from '../../lib/dates';
import { activeAlerts, deg, describe, fmtTime, nowcast, useHomeWeather, type Day, type Hour, type WeatherData } from '../../lib/weather';
import { skyOf, weatherKey } from '../../lib/weatherIcons';
import { WxIcon } from '../../weather/WxIcon';
import { Empty, useDash, type WidgetProps } from './shared';
import { useMinute } from '../../lib/clock';
import { t } from '../../i18n';

/*
 * The weather on the dashboard, in the look of the weather section's "now" card: a sky that matches the
 * weather. What it shows grows with the tile:
 *   s   the sky: icon, temperature, today's range
 *   m   + the next two hours (nowcast) beside it and the next hours below (if the tile is high enough)
 *   l   the sky on top, then the next hours as a small curve and the coming days
 *   xl  the sky as a column on the left, hours and days beside it
 * Within a size the tile's real height decides how much fits (container queries in dashboard.css).
 */

export function WeatherWidget({ size }: WidgetProps) {
  const { openModule } = useDash();
  const now = useMinute();
  const { place, data, error } = useHomeWeather();
  if (!place)
    return (
      <Empty action={t('dashboard.setPlace')} onAction={() => openModule('weather')}>
        {t('dashboard.noWeatherPlace')}
      </Empty>
    );
  if (!data) return <Empty>{error ?? t('dashboard.weatherLoading')}</Empty>;

  const todayKey = dayKey(now);
  const today = data.days.find((d) => d.date === todayKey) ?? data.days[0];
  const hourKey = `${todayKey}T${String(now.getHours()).padStart(2, '0')}`;
  const hours = data.hours.filter((h) => h.time.slice(0, 13) >= hourKey).slice(0, size === 'm' ? 6 : 8);
  const days = data.days.filter((d) => d.date > todayKey).slice(0, 6);
  const sky = (
    <Sky data={data} now={now} today={today} place={size === 's' ? undefined : place.name} withNowcast={size !== 's'} rich={size !== 's'} />
  );

  if (size === 's' || size === 'm')
    return (
      <div className={`dw-wx ${size} sky-${skyOf(weatherKey(data.current.code, data.current.isDay))}`}>
        {sky}
        {size === 'm' && <HourStrip hours={hours} light />}
      </div>
    );
  return (
    <div className={`dw-wx ${size}`}>
      {sky}
      <div className="dw-wx-more">
        <HourStrip hours={hours} />
        <DayList days={days} />
      </div>
    </div>
  );
}

/** the sky card: the weather right now; with `withNowcast` the next two hours beside or below it */
function Sky({
  data,
  now,
  today,
  place,
  withNowcast,
  rich,
}: {
  data: WeatherData;
  now: Date;
  today: Day | undefined;
  place?: string;
  withNowcast: boolean;
  rich: boolean;
}) {
  const cur = data.current;
  const alerts = activeAlerts(data, now);
  return (
    <section className={`dw-sky sky-${skyOf(weatherKey(cur.code, cur.isDay))}`}>
      <div className="dw-sky-top">
        {place && <span className="dw-sky-place">{place}</span>}
        {alerts.length > 0 && (
          <span className="dw-sky-alert" title={alerts.map((a) => a.event).join(', ')}>
            ⚠️ <span className="dw-sky-alert-text">{alerts[0].event}</span>
            {alerts.length > 1 && <span className="dw-sky-alert-text"> +{alerts.length - 1}</span>}
          </span>
        )}
      </div>
      <div className="dw-sky-main">
        <WxIcon code={cur.code} isDay={cur.isDay} className="dw-sky-icon" />
        <div className="dw-sky-read">
          <div className="dw-sky-temp">{deg(cur.temp)}</div>
          <div className="dw-sky-text">{describe(cur.code, cur.isDay).text}</div>
          {today && (
            <div className="dw-sky-sub">
              <span>
                ↑ {deg(today.max)} ↓ {deg(today.min)}
              </span>
              {rich && <span className="dw-sky-feels">{t('weather.feels', { temp: deg(cur.feels) })}</span>}
            </div>
          )}
        </div>
      </div>
      {withNowcast && <Nowcast data={data} now={now} />}
    </section>
  );
}

/** the next two hours, quarter by quarter (or the hourly chance outside the nowcast area) */
function Nowcast({ data, now }: { data: WeatherData; now: Date }) {
  const nc = nowcast(data.nowcast, now);
  if (!nc) {
    const next = data.hours.filter((h) => h.time >= `${dayKey(now)}T${String(now.getHours()).padStart(2, '0')}`).slice(0, 2);
    const p = Math.max(0, ...next.map((h) => h.rainProb));
    return (
      <div className="dw-nc plain">
        <span className="dw-nc-title">{t('weather.nowcast.title')}</span>
        <span className="dw-nc-text">{p >= 10 ? t('weather.nowcast.hourly', { p }) : t('weather.nowcast.dry')}</span>
      </div>
    );
  }
  const what = nc.snow ? t('weather.nowcast.snow') : t('weather.nowcast.rain');
  const text =
    nc.kind === 'dry'
      ? t('weather.nowcast.dry')
      : nc.kind === 'continues'
        ? t('weather.nowcast.continues', { what })
        : t(`weather.nowcast.${nc.kind}`, { what, time: fmtTime(nc.at!) });
  return (
    <div className="dw-nc">
      <span className="dw-nc-title">{t('weather.nowcast.title')}</span>
      <span className="dw-nc-text">{text}</span>
      <div className="dw-nc-bars" aria-hidden>
        {nc.slots.map((q) => (
          <i
            key={q.time}
            className={q.snow > 0 ? 'snow' : q.rain >= 0.1 ? 'wet' : ''}
            style={{ '--v': Math.min(1, Math.max(q.rain, q.snow)) } as CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}

/** the next hours: time, icon and temperature on a small curve */
function HourStrip({ hours, light = false }: { hours: Hour[]; light?: boolean }) {
  if (!hours.length) return null;
  const temps = hours.map((h) => h.temp);
  const lo = Math.min(...temps);
  const span = Math.max(3, Math.max(...temps) - lo);
  // 0 = top of the curve band, 100 = bottom
  const y = (v: number) => 12 + (1 - (v - lo) / span) * 76;
  const pts = hours.map((h, i) => `${i + 0.5},${y(h.temp)}`).join(' ');
  return (
    <div className={`dw-hrs ${light ? 'light' : ''}`} style={{ '--n': hours.length } as CSSProperties}>
      <svg className="dw-hrs-curve" viewBox={`0 0 ${hours.length} 100`} preserveAspectRatio="none" aria-hidden>
        <polyline points={pts} />
      </svg>
      {hours.map((h, i) => (
        <div key={h.time} className="dw-hr" style={{ '--y': `${y(h.temp)}%` } as CSSProperties}>
          <span className="dw-hr-t">{i === 0 ? t('weather.now') : hourLabel(Number(h.time.slice(11, 13)))}</span>
          <WxIcon code={h.code} isDay={h.isDay} className="dw-hr-i" />
          <span className="dw-hr-band">
            <span className="dw-hr-v">{deg(h.temp)}</span>
          </span>
          <span className="dw-hr-p">{h.rainProb >= 20 ? `${h.rainProb}%` : ''}</span>
        </div>
      ))}
    </div>
  );
}

/** the coming days with a temperature bar on a common scale (like the 7-day list) */
function DayList({ days }: { days: Day[] }) {
  if (!days.length) return null;
  const lo = Math.min(...days.map((d) => d.min));
  const hi = Math.max(...days.map((d) => d.max));
  const span = Math.max(1, hi - lo);
  const tomorrow = days[0]?.date;
  return (
    <div className="dw-days2">
      {days.map((d) => (
        <div key={d.date} className="dw-d" style={{ '--from': (d.min - lo) / span, '--to': (hi - d.max) / span } as CSSProperties}>
          <span className="dw-d-name">
            {d.date === tomorrow ? t('common.tomorrow') : fmt(new Date(`${d.date}T12:00`), { weekday: 'short' })}
          </span>
          <WxIcon code={d.code} className="dw-d-i" />
          <span className="dw-d-rain">{d.rainProb >= 20 ? `${d.rainProb}%` : ''}</span>
          <span className="dw-d-min">{deg(d.min)}</span>
          <span className="dw-d-bar" aria-hidden>
            <i />
          </span>
          <span className="dw-d-max">{deg(d.max)}</span>
        </div>
      ))}
    </div>
  );
}
