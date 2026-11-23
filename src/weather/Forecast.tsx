import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { dateFormat, dayKey, fmt, hourLabel } from '../lib/dates';
import { locale, t } from '../i18n';
import { Modal } from '../components/Modal';
import {
  POLLEN_TYPES,
  SEVERITY_LABEL,
  activeAlerts,
  airAt,
  aqiLevel,
  beaufort,
  deg,
  describe,
  fmtTime,
  nowcast,
  pollenLabel,
  pollenLevel,
  pressureTrend,
  protectionWindow,
  uvLevel,
  type Alert,
  type Day,
  type Hour,
  type WeatherData,
} from '../lib/weather';
import { skyOf, weatherKey } from '../lib/weatherIcons';
import { WxIcon } from './WxIcon';

/*
 * The weather module as a cockpit: everything important on one landscape screen.
 *   now      – the sky right now, the next two hours of precipitation (15-minute nowcast), warnings
 *   timeline – hour by hour: temperature curve, precipitation bars, wind; tap an hour to select it
 *   tiles    – wind, precipitation, air, sun, UV, air quality & pollen for the selected hour / day
 *   week     – seven days as columns; tap a day to select it
 */

const SEVERITY_ORDER = ['minor', 'moderate', 'severe', 'extreme'];
const compass = (d: number) => t('weather.dirs').split(',')[Math.round(d / 45) % 8];
const num = (v: number, digits = 1) => v.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
const mm = (v: number) => `${num(v)} mm`;
const hours1 = (seconds: number) => num(seconds / 3600);

function dayLabel(date: string, today: string, long = false) {
  if (date === today) return t('common.today');
  const tomorrow = new Date(`${today}T12:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dayKey(tomorrow) === date) return t('common.tomorrow');
  return fmt(new Date(`${date}T12:00`), long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric' });
}

const hourOf = (iso: string) => Number(iso.slice(11, 13));

export function Forecast({ data, now }: { data: WeatherData; now: Date }) {
  const today = dayKey(now);
  const days = data.days.filter((d) => d.date >= today).slice(0, 7);
  const [dayIdx, setDayIdx] = useState(0);
  const [hourSel, setHourSel] = useState<string | null>(null);
  const day = days[dayIdx] ?? days[0];

  // today: the next 24 hours from now; another day: that whole day
  const hourKey = `${today}T${String(now.getHours()).padStart(2, '0')}`;
  const hours = useMemo(() => {
    if (dayIdx === 0) {
      const start = Math.max(
        0,
        data.hours.findIndex((h) => h.time.startsWith(hourKey)),
      );
      return data.hours.slice(start, start + 24);
    }
    return data.hours.filter((h) => h.time.startsWith(day.date));
  }, [data.hours, dayIdx, day.date, hourKey]);

  // default selection: now (today) or noon (other days)
  const fallback = dayIdx === 0 ? hours[0] : (hours.find((h) => hourOf(h.time) === 12) ?? hours[0]);
  const hour = hours.find((h) => h.time === hourSel) ?? fallback;
  const isNow = dayIdx === 0 && hour === hours[0];

  const pickDay = (i: number) => {
    setDayIdx(i);
    setHourSel(null);
  };

  if (!day || !hour) return null;
  const when = isNow
    ? t('weather.now')
    : t('weather.hourDetail', { day: dayLabel(hour.time.slice(0, 10), today), time: fmtTime(hour.time) });

  return (
    <div className="wx-board">
      <NowCard data={data} now={now} today={days[0]} />
      <Timeline hours={hours} selected={hour.time} onSelect={setHourSel} isToday={dayIdx === 0} today={today} day={day} />
      <div className="wx-tiles" aria-label={t('weather.valuesFor', { when })}>
        <WindTile hour={hour} day={day} when={isNow ? null : when} />
        <PrecipTile hour={hour} day={day} when={isNow ? null : when} />
        <AirTile hour={hour} data={data} when={isNow ? null : when} />
        <SunTile day={day} at={isNow ? now : new Date(hour.time)} />
        <UvTile hour={hour} day={day} data={data} when={isNow ? null : when} />
        <QualityTile data={data} hour={hour} day={day} today={today} when={isNow ? null : when} />
      </div>
      <Week days={days} today={today} active={dayIdx} onPick={pickDay} />
    </div>
  );
}

/* ------------------------------------------------------------------ now */

function NowCard({ data, now, today }: { data: WeatherData; now: Date; today: Day | undefined }) {
  const cur = data.current;
  const [open, setOpen] = useState<Alert | null>(null);
  const alerts = activeAlerts(data, now).sort(
    (a, b) => SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity) || a.onset.localeCompare(b.onset),
  );
  return (
    <section className={`wx-now sky-${skyOf(weatherKey(cur.code, cur.isDay))}`}>
      <div className="wx-now-main">
        <WxIcon code={cur.code} isDay={cur.isDay} className="wx-now-icon" />
        <div className="wx-now-read">
          <div className="wx-now-temp">{deg(cur.temp)}</div>
          <div className="wx-now-text">{describe(cur.code, cur.isDay).text}</div>
          {today && (
            <div className="wx-now-sub">
              <span>
                {t('weather.high')} {deg(today.max)}
              </span>
              <span>
                {t('weather.low')} {deg(today.min)}
              </span>
              <span>{t('weather.feels', { temp: deg(cur.feels) })}</span>
            </div>
          )}
        </div>
      </div>
      <NowcastStrip data={data} now={now} />
      {alerts.length > 0 && (
        <div className="wx-now-alerts">
          {alerts.map((a) => (
            <button key={a.id} className={`wx-alert-chip sev-${a.severity}`} onClick={() => setOpen(a)}>
              <span className="wx-alert-dot" aria-hidden />
              <span className="wx-alert-event">{a.event}</span>
              {a.expires && <span className="wx-alert-until">{t('weather.until', { time: alertTime(a.expires) })}</span>}
            </button>
          ))}
        </div>
      )}
      {open && (
        <Modal onClose={() => setOpen(null)} label={t('weather.alertsTitle')}>
          <div className="modal wx-alert-sheet">
            {alerts.map((a) => (
              <article key={a.id} className={`wx-alert-full sev-${a.severity} ${a.id === open.id ? 'on' : ''}`}>
                <span className="wx-alert-sev">{SEVERITY_LABEL[a.severity]}</span>
                <h3>{a.headline}</h3>
                <p className="muted small">
                  {a.expires
                    ? t('weather.alertFromTo', { from: alertTime(a.onset), to: alertTime(a.expires) })
                    : t('weather.alertFrom', { from: alertTime(a.onset) })}
                </p>
                <p>{a.description}</p>
                {a.instruction && <p className="muted">{a.instruction}</p>}
              </article>
            ))}
            <div className="wx-alert-sheet-foot">
              <button className="btn primary" onClick={() => setOpen(null)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function NowcastStrip({ data, now }: { data: WeatherData; now: Date }) {
  const nc = nowcast(data.nowcast, now);
  if (!nc) {
    // outside the nowcast area: the chance of the next two hours
    const next = data.hours.filter((h) => h.time >= `${dayKey(now)}T${String(now.getHours()).padStart(2, '0')}`).slice(0, 2);
    const p = Math.max(0, ...next.map((h) => h.rainProb));
    return <div className="wx-nc wx-nc-plain">{p >= 10 ? t('weather.nowcast.hourly', { p }) : t('weather.nowcast.dry')}</div>;
  }
  const what = nc.snow ? t('weather.nowcast.snow') : t('weather.nowcast.rain');
  const text =
    nc.kind === 'dry'
      ? t('weather.nowcast.dry')
      : nc.kind === 'continues'
        ? t('weather.nowcast.continues', { what })
        : t(`weather.nowcast.${nc.kind}`, { what, time: fmtTime(nc.at!) });
  return (
    <div className={`wx-nc ${nc.kind === 'dry' ? 'dry' : 'wet'}`}>
      <div className="wx-nc-head">
        <span className="wx-nc-title">{t('weather.nowcast.title')}</span>
        <span className="wx-nc-text">
          {text}
          {nc.total > 0 && ` · ${mm(nc.total)}`}
        </span>
      </div>
      <div className="wx-nc-bars" aria-hidden>
        {nc.slots.map((q) => (
          <i
            key={q.time}
            className={q.snow > 0 ? 'snow' : q.rain >= 0.1 ? 'wet' : ''}
            style={{ '--v': Math.min(1, Math.max(q.rain, q.snow) / 1) } as CSSProperties}
          />
        ))}
      </div>
      <div className="wx-nc-axis" aria-hidden>
        <span>{t('weather.now')}</span>
        <span>{t('weather.nowcast.inHour')}</span>
        <span>{t('weather.nowcast.inTwo')}</span>
      </div>
    </div>
  );
}

function alertTime(iso: string) {
  return dateFormat({ weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

/* ------------------------------------------------------------------ hour by hour */

/** smooth path through the points (Catmull-Rom as cubic Béziers) */
function smooth(pts: [number, number][]): string {
  if (!pts.length) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** precipitation of an hour → bar height 0…1 (2 mm/h fills the bar) */
const rainHeight = (h: Hour) => (h.rain + h.snow > 0 ? Math.min(1, 0.12 + (h.rain + h.snow) / 2) : 0);

function Timeline({
  hours,
  selected,
  onSelect,
  isToday,
  today,
  day,
}: {
  hours: Hour[];
  selected: string;
  onSelect: (time: string) => void;
  isToday: boolean;
  today: string;
  day: Day;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const temps = hours.map((h) => h.temp);
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const span = Math.max(4, hi - lo);
  // 0 = top, 100 = bottom of the curve area; leave room above for the labels
  const y = (v: number) => 22 + (1 - (v - lo) / span) * 64;
  const pts = hours.map((h, i) => [i + 0.5, y(h.temp)] as [number, number]);
  const line = smooth(pts);
  const area = pts.length ? `${line} L${pts[pts.length - 1][0]},100 L${pts[0][0]},100 Z` : '';
  // label every hour when there is room, otherwise every second (CSS hides the odd ones)
  const maxI = temps.indexOf(hi);
  const minI = temps.indexOf(lo);

  // another day: start the view in the morning
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const col = el.querySelectorAll<HTMLElement>('.wx-tl-col')[isToday ? 0 : 6];
    el.scrollTo({ left: col ? col.offsetLeft - 8 : 0, behavior: 'smooth' });
  }, [isToday, day.date]);

  return (
    <section className="wx-tl">
      <header className="wx-tl-head">
        <h3 className="wx-h">{isToday ? t('weather.hourly') : t('weather.hourlyDay', { day: dayLabel(day.date, today, true) })}</h3>
        <span className="wx-tl-hint">{t('weather.tapHint')}</span>
      </header>
      <div className="wx-tl-scroll" ref={scroller}>
        <div className="wx-tl-grid" style={{ '--n': hours.length } as CSSProperties}>
          <svg className="wx-tl-curve" viewBox={`0 0 ${hours.length} 100`} preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="wx-tl-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="wx-tl-fill-a" />
                <stop offset="1" className="wx-tl-fill-b" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#wx-tl-fill)" />
            <path d={line} className="wx-tl-line" />
          </svg>
          {hours.map((h, i) => {
            const hh = hourOf(h.time);
            const label = isToday && i === 0 ? t('weather.now') : hh === 0 ? fmt(new Date(h.time), { weekday: 'short' }) : hourLabel(hh);
            const prob = h.rainProb;
            return (
              <button
                key={h.time}
                className={`wx-tl-col ${h.time === selected ? 'on' : ''} ${h.isDay ? '' : 'night'} ${i % 2 ? 'odd' : ''} ${
                  i === maxI || i === minI ? 'ext' : ''
                }`}
                style={{ '--y': `${y(h.temp)}%`, '--r': rainHeight(h), '--p': Math.max(0.25, prob / 100) } as CSSProperties}
                aria-pressed={h.time === selected}
                aria-label={`${fmtTime(h.time)}: ${describe(h.code, h.isDay).text}, ${deg(h.temp)}`}
                onClick={() => onSelect(h.time)}
              >
                <span className="wx-tl-time">{label}</span>
                <WxIcon code={h.code} isDay={h.isDay} className="wx-tl-icon" title="" />
                <span className="wx-tl-chart">
                  <span className="wx-tl-temp">{deg(h.temp)}</span>
                  <span className="wx-tl-dot" />
                </span>
                <span className="wx-tl-rain">
                  <i className={h.snow > 0 ? 'snow' : ''} />
                </span>
                <span className="wx-tl-prob">{prob >= 10 ? `${prob}%` : ''}</span>
                <span className="wx-tl-wind" title={`${compass(h.windDir)} ${Math.round(h.wind)} km/h`}>
                  <span className="wx-tl-arrow" style={{ transform: `rotate(${h.windDir + 180}deg)` }} aria-hidden>
                    ↑
                  </span>
                  {Math.round(h.wind)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ tiles */

function Tile({ kind, title, when, children }: { kind: string; title: string; when?: string | null; children: ReactNode }) {
  return (
    <section className={`wx-tile wx-tile-${kind}`}>
      <header className="wx-tile-head">
        <TileIcon kind={kind} />
        <h3>{title}</h3>
        {when && <span className="wx-tile-when">{when}</span>}
      </header>
      {children}
    </section>
  );
}

const TILE_ICONS: Record<string, ReactNode> = {
  wind: <path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8" />,
  precip: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  air: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 12l4-4M12 6.5v1M17.5 12h-1M6.5 12h1" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="13" r="4" />
      <path d="M3 20h18M12 4v2M5 7l1.4 1.4M19 7l-1.4 1.4M3 13h2M19 13h2" />
    </>
  ),
  uv: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  quality: <path d="M12 21c-4-2-7-5.5-7-10V5l7-2.5L19 5v6c0 4.5-3 8-7 10zM8.5 12l2.5 2.5 4.5-5" />,
};

function TileIcon({ kind }: { kind: string }) {
  return (
    <svg className="wx-tile-icon" viewBox="0 0 24 24" aria-hidden>
      {TILE_ICONS[kind]}
    </svg>
  );
}

function WindTile({ hour, day, when }: { hour: Hour; day: Day; when: string | null }) {
  const b = beaufort(hour.wind);
  return (
    <Tile kind="wind" title={t('weather.wind')} when={when}>
      <div className="wx-wind">
        <svg className="wx-compass" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="44" className="wx-compass-ring" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="50" y1="9" x2="50" y2={i % 3 ? 13 : 16} transform={`rotate(${i * 30} 50 50)`} className="wx-compass-tick" />
          ))}
          {t('weather.dirs')
            .split(',')
            .filter((_, i) => i % 2 === 0)
            .map((d, i) => (
              <text key={d} x="50" y="29" transform={`rotate(${i * 90} 50 50)`} className="wx-compass-dir">
                {d}
              </text>
            ))}
          {/* the arrow points where the wind blows to */}
          <g transform={`rotate(${hour.windDir + 180} 50 50)`}>
            <path d="M50 24 L58 52 L50 47 L42 52 Z" className="wx-compass-arrow" />
            <line x1="50" y1="47" x2="50" y2="74" className="wx-compass-tail" />
          </g>
        </svg>
        <div className="wx-wind-read">
          <div className="wx-big">
            {Math.round(hour.wind)}
            <small> km/h</small>
          </div>
          <div className="wx-tile-line">
            {t('weather.windFrom', { dir: compass(hour.windDir) })} · {t('weather.gustsShort', { v: Math.round(hour.gusts) })}
          </div>
          <div className="wx-tile-line muted">
            {t('weather.bft', { n: b.bft })} · {b.label}
          </div>
        </div>
      </div>
      <p className="wx-tile-foot">{t('weather.dayMaxWind', { v: Math.round(day.windMax), g: Math.round(day.gustsMax) })}</p>
    </Tile>
  );
}

function PrecipTile({ hour, day, when }: { hour: Hour; day: Day; when: string | null }) {
  const n = Math.round(day.rainHours);
  return (
    <Tile kind="precip" title={t('weather.precipitation')} when={when}>
      <div className="wx-big">
        {num(day.rainSum)}
        <small> mm</small>
      </div>
      <div className="wx-tile-line">{t('weather.rainProb', { p: day.rainProb })}</div>
      <div className="wx-tile-line muted">
        {t('weather.rainHours', { n })}
        {day.snowSum > 0 && ` · ${t('weather.snowSum', { cm: num(day.snowSum) })}`}
      </div>
      <p className="wx-tile-foot">{t('weather.hourRain', { time: fmtTime(hour.time), p: hour.rainProb, mm: mm(hour.rain + hour.snow) })}</p>
    </Tile>
  );
}

function AirTile({ hour, data, when }: { hour: Hour; data: WeatherData; when: string | null }) {
  const trend = pressureTrend(data.hours, hour.time);
  const km = hour.visibility / 1000;
  return (
    <Tile kind="air" title={t('weather.atmosphere')} when={when}>
      <dl className="wx-stats">
        <div>
          <dt>{t('weather.humidity')}</dt>
          <dd>{Math.round(hour.humidity)} %</dd>
        </div>
        <div>
          <dt>{t('weather.dewPoint')}</dt>
          <dd>{deg(hour.dewPoint)}</dd>
        </div>
        <div>
          <dt>{t('weather.pressure')}</dt>
          <dd>
            {Math.round(hour.pressure)}
            <small> hPa</small>
            {trend && (
              <span className={`wx-trend ${trend}`} title={t(`weather.trend.${trend}`)}>
                {trend === 'rising' ? '↗' : trend === 'falling' ? '↘' : '→'}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>{t('weather.visibility')}</dt>
          <dd>
            {km >= 10 ? Math.round(km) : num(km)}
            <small> km</small>
          </dd>
        </div>
      </dl>
      <p className="wx-tile-foot">
        {km < 1 ? t('weather.fogHint') : `${t('weather.clouds')} ${Math.round(hour.cloud)} %`}
        {trend && ` · ${t('weather.pressure')} ${t(`weather.trend.${trend}`)}`}
      </p>
    </Tile>
  );
}

function SunTile({ day, at }: { day: Day; at: Date }) {
  const rise = new Date(day.sunrise).getTime();
  const set = new Date(day.sunset).getTime();
  const len = Math.max(1, set - rise);
  const p = Math.min(1, Math.max(0, (at.getTime() - rise) / len));
  const up = at.getTime() > rise && at.getTime() < set && dayKey(at) === day.date;
  // point on the quadratic curve (10,62) (80,-14) (150,62)
  const x = (1 - p) ** 2 * 10 + 2 * (1 - p) * p * 80 + p ** 2 * 150;
  const yy = (1 - p) ** 2 * 62 + 2 * (1 - p) * p * -14 + p ** 2 * 62;
  return (
    <Tile kind="sun" title={t('weather.sun')}>
      <svg
        className="wx-sun"
        viewBox="0 0 160 70"
        role="img"
        aria-label={t('weather.sunLabel', { rise: fmtTime(day.sunrise), set: fmtTime(day.sunset) })}
      >
        <path d="M10 62 Q80 -14 150 62" className="wx-sun-track" />
        {up && <path d="M10 62 Q80 -14 150 62" className="wx-sun-done" pathLength={100} strokeDasharray={`${p * 100} 200`} />}
        <line x1="2" y1="62" x2="158" y2="62" className="wx-sun-horizon" />
        {up && <circle cx={x} cy={yy} r="7" className="wx-sun-dot" />}
      </svg>
      <div className="wx-sun-times">
        <span>
          <small>{t('weather.sunrise')}</small>
          {fmtTime(day.sunrise)}
        </span>
        <span>
          <small>{t('weather.sunset')}</small>
          {fmtTime(day.sunset)}
        </span>
      </div>
      <p className="wx-tile-foot">
        {t('weather.sunshine', { h: hours1(day.sunshine) })} ·{' '}
        {t('weather.daylightShort', {
          h: Math.floor(day.daylight / 3600),
          m: String(Math.round((day.daylight % 3600) / 60)).padStart(2, '0'),
        })}
      </p>
    </Tile>
  );
}

function UvTile({ hour, day, data, when }: { hour: Hour; day: Day; data: WeatherData; when: string | null }) {
  const lvl = uvLevel(hour.uv);
  const dayLvl = uvLevel(day.uvMax);
  const protect = protectionWindow(data.hours, day.date);
  return (
    <Tile kind="uv" title={t('weather.uvIndex')} when={when}>
      <div className="wx-big">
        {Math.round(hour.uv)} <span className={`wx-lvl lvl-${lvl.level}`}>{lvl.label}</span>
      </div>
      <div className="wx-uvbar" aria-hidden>
        <span style={{ left: `${Math.min(100, (hour.uv / 11) * 100)}%` }} />
        <span className="max" style={{ left: `${Math.min(100, (day.uvMax / 11) * 100)}%` }} />
      </div>
      <div className="wx-tile-line muted">{t('weather.uvMax', { v: Math.round(day.uvMax) })}</div>
      <p className="wx-tile-foot">
        {protect
          ? dayLvl.level >= 3
            ? t('weather.protectImportant', { time: protect })
            : t('weather.protectUseful', { time: protect })
          : t('weather.noProtect')}
      </p>
    </Tile>
  );
}

function QualityTile({ data, hour, day, today, when }: { data: WeatherData; hour: Hour; day: Day; today: string; when: string | null }) {
  const air = airAt(data.air, hour.time);
  const pollenDay = data.pollen?.find((d) => d.date === day.date) ?? (day.date === today ? data.pollen?.[0] : undefined);
  const flying = pollenDay
    ? POLLEN_TYPES.map((x) => ({ ...x, level: pollenLevel(x.id, pollenDay.values[x.id]) }))
        .filter((x) => x.level > 0)
        .sort((a, b) => b.level - a.level)
    : [];
  const q = air ? aqiLevel(air.aqi) : null;
  return (
    <Tile kind="quality" title={t('weather.aqi.title')} when={air && when ? when : null}>
      {air && q ? (
        <>
          <div className="wx-big" title={t('weather.aqi.index')}>
            {Math.round(air.aqi)} <span className={`wx-lvl aqi-${q.level}`}>{q.label}</span>
          </div>
          <div className="wx-aqi-bar" aria-hidden>
            <span style={{ left: `${Math.min(100, air.aqi)}%` }} />
          </div>
          <div className="wx-tile-line muted wx-pollutants">
            <span>PM2.5 {Math.round(air.pm25)}</span>
            <span>PM10 {Math.round(air.pm10)}</span>
            <span>NO₂ {Math.round(air.no2)}</span>
            <span>O₃ {Math.round(air.o3)}</span>
          </div>
        </>
      ) : (
        <p className="wx-tile-line muted">{t('weather.aqi.unavailable')}</p>
      )}
      <div className="wx-tile-foot wx-pollen-line">
        <b>{t('weather.pollen')}:</b>{' '}
        {!data.pollen
          ? t('weather.pollenUnavailable')
          : !pollenDay
            ? '–'
            : flying.length === 0
              ? t('weather.noPollen')
              : flying.map((x) => (
                  <span key={x.id} className={`wx-pollen-tag pl-${x.level}`}>
                    {x.label} {pollenLabel(x.level)}
                  </span>
                ))}
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ seven days */

function Week({ days, today, active, onPick }: { days: Day[]; today: string; active: number; onPick: (i: number) => void }) {
  const lo = Math.min(...days.map((d) => d.min));
  const hi = Math.max(...days.map((d) => d.max));
  const span = Math.max(1, hi - lo);
  return (
    <section className="wx-week" aria-label={t('weather.weekTitle')}>
      <h3 className="wx-h wx-week-head">{t('weather.sevenDays')}</h3>
      {days.map((d, i) => (
        <button
          key={d.date}
          className={`wx-wd ${i === active ? 'on' : ''}`}
          aria-pressed={i === active}
          onClick={() => onPick(i)}
          style={{ '--from': (d.min - lo) / span, '--to': (hi - d.max) / span } as CSSProperties}
        >
          <span className="wx-wd-name">
            {dayLabel(d.date, today)}
            <small>☀ {hours1(d.sunshine)} h</small>
          </span>
          <WxIcon code={d.code} className="wx-wd-icon" title={describe(d.code).text} />
          <span className={`wx-wd-rain ${d.rainProb >= 30 ? 'on' : ''}`}>
            {d.rainProb >= 10 ? `${d.rainProb} %` : ''}
            {d.rainProb >= 10 && d.rainSum >= 0.1 && <small>{mm(d.rainSum)}</small>}
          </span>
          <span className="wx-wd-min">{deg(d.min)}</span>
          <span className="wx-wd-bar" aria-hidden>
            <i />
          </span>
          <span className="wx-wd-max">{deg(d.max)}</span>
        </button>
      ))}
    </section>
  );
}
