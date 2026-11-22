import { useEffect, useRef, useState } from 'react';
import { dayKey, fmt } from '../lib/dates';
import {
  LocateError,
  POLLEN_LABELS,
  POLLEN_TYPES,
  SEVERITY_LABEL,
  activeAlerts,
  addPlace,
  deg,
  describe,
  fmtTime,
  locate,
  makeHome,
  pollenLevel,
  protectionWindow,
  refresh,
  removePlace,
  renamePlace,
  searchPlaces,
  setActivePlace,
  useWeather,
  useWeatherSettings,
  uvLevel,
  type Day,
  type Hour,
  type Place,
  type SearchHit,
  type WeatherData,
} from '../lib/weather';
import { skyOf, weatherKey } from '../lib/weatherIcons';
import { WxIcon } from './WxIcon';
import './weather.css';

const clock = (ms: number) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/** Weather of the chosen place. Places are tabs on top; managing them opens a sheet. */
export function WeatherModule({ now }: { now: Date }) {
  const { places, activeId } = useWeatherSettings();
  const place = places.find((p) => p.id === activeId) ?? places[0];
  const { data, loading, error } = useWeather(place);
  const [sheet, setSheet] = useState(false);

  if (!place) {
    return (
      <div className="wx">
        <section className="view wx-onboard">
          <div className="wx-onboard-box">
            <WxIcon icon="partly-cloudy-day" className="wx-onboard-icon" />
            <h2>Für welchen Ort soll das Wetter angezeigt werden?</h2>
            <p className="muted">
              Der Standort wird nur einmal abgefragt und auf etwa einen Kilometer gerundet gespeichert. Du kannst den Ort auch suchen.
            </p>
            <AddPlace first />
          </div>
        </section>
      </div>
    );
  }

  const alerts = data ? activeAlerts(data, now) : [];

  return (
    <div className="wx">
      <div className="wx-top">
        <div className="wx-pills" role="tablist" aria-label="Orte">
          {places.map((p, i) => (
            <PlacePill key={p.id} place={p} home={i === 0} active={p.id === place.id} />
          ))}
          <button className="wx-pill wx-pill-add" onClick={() => setSheet(true)} aria-label="Orte hinzufügen und verwalten">
            <span aria-hidden>＋</span>
            <span className="wx-pill-add-t">Orte</span>
          </button>
        </div>
        <div className="wx-stamp">
          <span>
            {data ? `Stand ${clock(data.fetchedAt)}` : ''}
            {error && data ? ' · offline' : ''}
            {data?.alerts && alerts.length === 0 && <span className="wx-stamp-ok"> · keine Warnungen</span>}
          </span>
          <button
            className={`icon-btn wx-refresh ${loading ? 'spin' : ''}`}
            onClick={() => refresh(place, true)}
            disabled={loading}
            aria-label="Aktualisieren"
          >
            ⟳
          </button>
        </div>
      </div>

      <div className="wx-scroll">
        {data ? (
          <Forecast key={place.id} data={data} now={now} />
        ) : (
          <div className="wx-empty">{error ?? (loading ? 'Wetter wird geladen …' : '')}</div>
        )}
        <p className="wx-credit">
          Wetter:{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>{' '}
          (CC BY 4.0) · Warnungen: Deutscher Wetterdienst über{' '}
          <a href="https://brightsky.dev/" target="_blank" rel="noreferrer">
            Bright Sky
          </a>{' '}
          · Pollen: CAMS
        </p>
      </div>

      {sheet && <PlacesSheet onClose={() => setSheet(false)} />}
    </div>
  );
}

function PlacePill({ place, home, active }: { place: Place; home: boolean; active: boolean }) {
  const { data } = useWeather(place);
  return (
    <button role="tab" aria-selected={active} className={`wx-pill ${active ? 'on' : ''}`} onClick={() => setActivePlace(place.id)}>
      {home && <span aria-label="Zuhause">🏠</span>}
      <span className="wx-pill-name">{place.name}</span>
      {data && (
        <span className="wx-pill-now">
          <WxIcon code={data.current.code} isDay={data.current.isDay} />
          {deg(data.current.temp)}
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ forecast */

const ALERTS_SHOWN = 2;
const SEVERITY_ORDER = ['minor', 'moderate', 'severe', 'extreme'];
const DIRS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
const compass = (deg: number) => DIRS[Math.round(deg / 45) % 8];
const mm = (v: number) => `${v.toFixed(1).replace('.', ',')} mm`;

const dayLabel = (date: string, today: string, long = false) => {
  if (date === today) return 'Heute';
  const d = new Date(`${date}T12:00`);
  const tomorrow = new Date(`${today}T12:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dayKey(tomorrow) === date) return 'Morgen';
  return fmt(d, long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric' });
};

function Forecast({ data, now }: { data: WeatherData; now: Date }) {
  const today = dayKey(now);
  const days = data.days.filter((d) => d.date >= today).slice(0, 7);
  const [dayIdx, setDayIdx] = useState(0);
  const [hourSel, setHourSel] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const hoursRef = useRef<HTMLDivElement>(null);
  const day = days[dayIdx] ?? days[0];

  // today: from now on for 24 hours; other days: the whole day
  const hourKey = `${today}T${String(now.getHours()).padStart(2, '0')}`;
  const hours =
    dayIdx === 0
      ? (() => {
          const start = Math.max(
            0,
            data.hours.findIndex((h) => h.time.startsWith(hourKey)),
          );
          return data.hours.slice(start, start + 24);
        })()
      : data.hours.filter((h) => h.time.startsWith(day.date));
  const selected = hours.find((h) => h.time === hourSel) ?? hours[0];

  // another day: start the strip in the morning
  useEffect(() => {
    const el = hoursRef.current;
    if (!el) return;
    const i =
      dayIdx === 0
        ? 0
        : Math.max(
            0,
            hours.findIndex((h) => h.time.endsWith('T07:00')),
          );
    const tile = el.children[i] as HTMLElement | undefined;
    el.scrollTo({ left: tile ? tile.offsetLeft - el.offsetLeft : 0, behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayIdx]);

  const pickDay = (i: number, scroll = false) => {
    setDayIdx(i);
    setHourSel(i === 0 ? null : `${days[i].date}T12:00`);
    if (scroll) hoursRef.current?.closest('.wx-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const alerts = activeAlerts(data, now).sort(
    (a, b) => SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity) || a.onset.localeCompare(b.onset),
  );
  const cur = data.current;
  const curText = describe(cur.code, cur.isDay).text;
  const todayData = days[0];

  return (
    <>
      {alerts.length > 0 && (
        <div className="wx-alerts">
          {(showAll ? alerts : alerts.slice(0, ALERTS_SHOWN)).map((a) => (
            <details key={a.id} className={`wx-alert sev-${a.severity}`}>
              <summary>
                <span className="wx-alert-icon" aria-hidden>
                  ⚠
                </span>
                <span>
                  <b>{a.headline}</b>
                  <small>
                    {SEVERITY_LABEL[a.severity]} · {alertTime(a.onset, a.expires)}
                  </small>
                </span>
              </summary>
              <p>{a.description}</p>
              {a.instruction && <p className="muted">{a.instruction}</p>}
            </details>
          ))}
          {alerts.length > ALERTS_SHOWN && (
            <button className="wx-more-alerts" onClick={() => setShowAll((s) => !s)}>
              {showAll
                ? 'Weniger anzeigen'
                : `+ ${alerts.length - ALERTS_SHOWN} weitere Warnung${alerts.length - ALERTS_SHOWN > 1 ? 'en' : ''}`}
            </button>
          )}
        </div>
      )}

      <section className={`wx-hero sky-${skyOf(weatherKey(cur.code, cur.isDay))}`}>
        <WxIcon code={cur.code} isDay={cur.isDay} className="wx-hero-icon" />
        <div className="wx-hero-main">
          <div className="wx-hero-temp">{deg(cur.temp)}</div>
          <div className="wx-hero-text">{curText}</div>
          {todayData && (
            <div className="wx-hero-sub">
              ↑ {deg(todayData.max)} ↓ {deg(todayData.min)} · gefühlt {deg(cur.feels)}
            </div>
          )}
        </div>
        {todayData && (
          <dl className="wx-hero-facts">
            <Fact k="Regen heute" v={todayData.rainProb > 0 ? `${todayData.rainProb} % · ${mm(todayData.rainSum)}` : 'kein Regen'} />
            <Fact k="Wind" v={`${compass(cur.windDir)} ${Math.round(cur.wind)} km/h`} />
            <Fact k="Luftfeuchte" v={`${Math.round(cur.humidity)} %`} />
          </dl>
        )}
      </section>

      <section className="wx-section">
        <div className="wx-sec-head">
          <h3 className="wx-h">Stunden</h3>
          <div className="wx-daytabs" role="tablist" aria-label="Tag">
            {days.map((d, i) => (
              <button key={d.date} role="tab" aria-selected={i === dayIdx} className={i === dayIdx ? 'on' : ''} onClick={() => pickDay(i)}>
                {dayLabel(d.date, today)}
              </button>
            ))}
          </div>
        </div>
        <div className="wx-hours" ref={hoursRef}>
          {hours.map((h, i) => (
            <button
              key={h.time}
              className={`wx-hour ${h.time === selected?.time ? 'on' : ''}`}
              aria-pressed={h.time === selected?.time}
              onClick={() => setHourSel(h.time)}
            >
              <span className="wx-hour-t">{dayIdx === 0 && i === 0 ? 'Jetzt' : `${Number(h.time.slice(11, 13))} Uhr`}</span>
              <WxIcon code={h.code} isDay={h.isDay} className="wx-hour-i" />
              <span className="wx-hour-temp">{deg(h.temp)}</span>
              <span className="wx-hour-rain">{h.rainProb >= 20 ? `${h.rainProb} %` : ''}</span>
            </button>
          ))}
        </div>
        {selected && (
          <HourDetail
            hour={selected}
            label={`${dayLabel(selected.time.slice(0, 10), today)}, ${Number(selected.time.slice(11, 13))}:00 Uhr`}
          />
        )}
      </section>

      <section className="wx-cards">
        <UvCard data={data} day={day} today={today} label={dayLabel(day.date, today)} />
        <SunCard day={day} now={now} today={today} />
        <PollenCard data={data} today={today} active={day.date} />
      </section>

      <section className="wx-section">
        <h3 className="wx-h">7 Tage</h3>
        <WeekList days={days} today={today} active={dayIdx} onPick={(i) => pickDay(i, true)} />
      </section>
    </>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function HourDetail({ hour, label }: { hour: Hour; label: string }) {
  const text = describe(hour.code, hour.isDay).text;
  const uv = uvLevel(hour.uv);
  return (
    <div className="wx-detail">
      <div className="wx-detail-main">
        <WxIcon code={hour.code} isDay={hour.isDay} className="wx-detail-icon" />
        <div>
          <div className="wx-detail-when">{label}</div>
          <div className="wx-detail-what">
            {text} · {deg(hour.temp)}
          </div>
        </div>
      </div>
      <dl className="wx-facts">
        <Fact k="Gefühlt" v={deg(hour.feels)} />
        <Fact k="Regen" v={`${hour.rainProb} % · ${mm(hour.rain)}`} />
        <div>
          <dt>Wind</dt>
          <dd>
            <span className="wx-arrow" style={{ transform: `rotate(${hour.windDir + 180}deg)` }} aria-hidden>
              ↑
            </span>{' '}
            {compass(hour.windDir)} {Math.round(hour.wind)} km/h
          </dd>
        </div>
        <Fact k="Böen" v={`${Math.round(hour.gusts)} km/h`} />
        <Fact k="Luftfeuchte" v={`${Math.round(hour.humidity)} %`} />
        <Fact k="UV-Index" v={`${Math.round(hour.uv)} · ${uv.label}`} />
        <Fact k="Bewölkung" v={`${Math.round(hour.cloud)} %`} />
      </dl>
    </div>
  );
}

function alertTime(onset: string, expires: string | null) {
  const f = (s: string) => new Date(s).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return expires ? `${f(onset)} bis ${f(expires)}` : `ab ${f(onset)}`;
}

function WeekList({ days, today, active, onPick }: { days: Day[]; today: string; active: number; onPick: (i: number) => void }) {
  const lo = Math.min(...days.map((d) => d.min));
  const hi = Math.max(...days.map((d) => d.max));
  const span = Math.max(1, hi - lo);
  return (
    <div className="wx-week">
      {days.map((d, i) => (
        <button key={d.date} className={`wx-day ${i === active ? 'on' : ''}`} onClick={() => onPick(i)}>
          <span className="wx-day-name">{dayLabel(d.date, today)}</span>
          <WxIcon code={d.code} className="wx-day-i" />
          <span className={`wx-day-rain ${d.rainProb >= 30 ? 'on' : ''}`}>{d.rainProb >= 10 ? `${d.rainProb} %` : ''}</span>
          <span className="wx-day-min">{deg(d.min)}</span>
          <span className="wx-range">
            <span style={{ left: `${((d.min - lo) / span) * 100}%`, right: `${((hi - d.max) / span) * 100}%` }} />
          </span>
          <span className="wx-day-max">{deg(d.max)}</span>
        </button>
      ))}
    </div>
  );
}

function UvCard({ data, day, today, label }: { data: WeatherData; day: Day; today: string; label: string }) {
  const lvl = uvLevel(day.uvMax);
  const protect = protectionWindow(data.hours, day.date);
  // position of the day's maximum on the 0–11+ scale
  const pos = Math.min(100, (day.uvMax / 11) * 100);
  return (
    <div className="wx-card">
      <span className="wx-h">UV-Index {day.date === today ? 'heute' : label}</span>
      <div className="wx-card-big">
        {Math.round(day.uvMax)} <span className={`wx-lvl lvl-${lvl.level}`}>{lvl.label}</span>
      </div>
      <div className="wx-uvbar" aria-hidden>
        <span style={{ left: `${pos}%` }} />
      </div>
      <p className="wx-card-text">
        {protect
          ? lvl.level >= 3
            ? `Sonnenschutz wichtig von ${protect}.`
            : `Sonnenschutz sinnvoll von ${protect}.`
          : 'Kein Sonnenschutz nötig.'}
      </p>
    </div>
  );
}

function SunCard({ day, now, today }: { day: Day; now: Date; today: string }) {
  const rise = new Date(day.sunrise).getTime();
  const set = new Date(day.sunset).getTime();
  const len = Math.max(0, set - rise);
  const isToday = day.date === today;
  const t = isToday ? Math.min(1, Math.max(0, (now.getTime() - rise) / (len || 1))) : 0;
  const hm = (ms: number) => `${Math.floor(ms / 3_600_000)} Std. ${Math.round((ms % 3_600_000) / 60_000)} Min.`;
  // point on the quadratic curve (14,80) (110,-20) (206,80)
  const x = (1 - t) ** 2 * 14 + 2 * (1 - t) * t * 110 + t ** 2 * 206;
  const y = (1 - t) ** 2 * 80 + 2 * (1 - t) * t * -20 + t ** 2 * 80;
  const up = isToday && now.getTime() > rise && now.getTime() < set;
  return (
    <div className="wx-card">
      <span className="wx-h">Sonne</span>
      <svg
        className="wx-sun"
        viewBox="0 0 220 96"
        role="img"
        aria-label={`Sonnenaufgang ${fmtTime(day.sunrise)}, Sonnenuntergang ${fmtTime(day.sunset)}`}
      >
        <path d="M14 80 Q110 -20 206 80" fill="none" className="wx-sun-track" strokeWidth="3" strokeDasharray="4 6" />
        {isToday && t > 0 && (
          <path
            d="M14 80 Q110 -20 206 80"
            fill="none"
            className="wx-sun-done"
            strokeWidth="3"
            pathLength={100}
            strokeDasharray={`${t * 100} 200`}
          />
        )}
        <line x1="4" y1="80" x2="216" y2="80" className="wx-sun-track" strokeWidth="2" />
        {up && <circle cx={x} cy={y} r="9" className="wx-sun-dot" />}
        <text x="14" y="95" className="wx-sun-label">
          {fmtTime(day.sunrise)}
        </text>
        <text x="206" y="95" textAnchor="end" className="wx-sun-label">
          {fmtTime(day.sunset)}
        </text>
      </svg>
      <p className="wx-card-text">{up ? `Noch ${hm(set - now.getTime())} hell` : `Tageslänge ${hm(len)}`}</p>
    </div>
  );
}

function PollenCard({ data, today, active }: { data: WeatherData; today: string; active: string }) {
  const days = (data.pollen ?? []).filter((d) => d.date >= today).slice(0, 4);
  const day = days.find((d) => d.date === active) ?? days[0];
  const flying = day ? POLLEN_TYPES.map((t) => ({ ...t, level: pollenLevel(t.id, day.values[t.id]) })).filter((t) => t.level > 0) : [];
  return (
    <div className="wx-card">
      <span className="wx-h">Pollen{day && day.date !== today ? ` · ${dayLabel(day.date, today)}` : ''}</span>
      {!data.pollen ? (
        <p className="wx-card-text">Pollendaten sind gerade nicht verfügbar.</p>
      ) : flying.length === 0 ? (
        <>
          <div className="wx-card-big">–</div>
          <p className="wx-card-text">Kein nennenswerter Pollenflug.</p>
        </>
      ) : (
        <div className="wx-pollen">
          {flying.map((t) => (
            <div key={t.id}>
              <span>{t.label}</span>
              <span className={`wx-lvl pl-${t.level}`}>{POLLEN_LABELS[t.level]}</span>
            </div>
          ))}
        </div>
      )}
      <p className="wx-card-hint">Modellwerte (CAMS, ca. 10 km), bis 4 Tage voraus</p>
    </div>
  );
}

/* ------------------------------------------------------------------ places */

function PlacesSheet({ onClose }: { onClose: () => void }) {
  const { places, activeId } = useWeatherSettings();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="wx-sheet-backdrop" onClick={onClose}>
      <div className="wx-sheet" role="dialog" aria-label="Orte" onClick={(e) => e.stopPropagation()}>
        <div className="wx-sheet-head">
          <h2>Orte</h2>
          <button className="btn primary" onClick={onClose}>
            Fertig
          </button>
        </div>
        <ul className="wx-places">
          {places.map((p, i) => (
            <PlaceRow key={p.id} place={p} home={i === 0} active={p.id === (activeId ?? places[0]?.id)} />
          ))}
        </ul>
        <p className="wx-hint">
          Der erste Ort ist „Zuhause“: Sein Wetter erscheint in der Übersicht, im Kalender und im Bildschirmschoner.
        </p>
        <h3 className="wx-h">Ort hinzufügen</h3>
        <AddPlace onAdded={onClose} />
      </div>
    </div>
  );
}

function PlaceRow({ place, home, active }: { place: Place; home: boolean; active: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(place.name);
  const [confirmDel, setConfirmDel] = useState(false);
  const save = () => {
    const n = name.trim();
    if (n) renamePlace(place.id, n);
    setEditing(false);
  };
  return (
    <li className={active ? 'on' : ''}>
      <div className="wx-place-line">
        {editing ? (
          <input
            className="wx-input"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            onBlur={save}
            aria-label="Name des Orts"
          />
        ) : (
          <button className="wx-place-name" onClick={() => setActivePlace(place.id)}>
            {home && <span aria-label="Zuhause">🏠 </span>}
            {place.name}
            {place.region && <small>{place.region}</small>}
          </button>
        )}
      </div>
      <div className="wx-place-tools">
        {!home && (
          <button className="btn" onClick={() => makeHome(place.id)}>
            Als Zuhause
          </button>
        )}
        <button className="btn" onClick={() => (editing ? save() : setEditing(true))}>
          {editing ? 'Speichern' : 'Umbenennen'}
        </button>
        <button
          className={`btn danger ${confirmDel ? 'primary' : ''}`}
          onClick={() => (confirmDel ? removePlace(place.id) : setConfirmDel(true))}
          onBlur={() => setConfirmDel(false)}
        >
          {confirmDel ? 'Wirklich entfernen?' : 'Entfernen'}
        </button>
      </div>
    </li>
  );
}

function AddPlace({ first = false, onAdded }: { first?: boolean; onAdded?: () => void }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; help?: string[] } | null>(null);

  // search while typing (debounced)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((h) => setHits(h))
        .catch((e) => e.name !== 'AbortError' && setHits([]));
    }, 300);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const useLocation = async () => {
    setBusy(true);
    setError(null);
    try {
      const pos = await locate();
      addPlace({ name: first ? 'Zuhause' : 'Mein Standort', ...pos });
      onAdded?.();
    } catch (e) {
      setError({ message: (e as Error).message, help: e instanceof LocateError ? e.help : undefined });
    } finally {
      setBusy(false);
    }
  };

  const pick = (h: SearchHit) => {
    addPlace(h);
    setQuery('');
    setHits(null);
    onAdded?.();
  };

  return (
    <div className="wx-add">
      <button className={`btn ${first ? 'primary' : ''} wx-locate`} onClick={useLocation} disabled={busy}>
        📍 {busy ? 'Standort wird ermittelt …' : 'Meinen Standort verwenden'}
      </button>
      {error && (
        <div className="wx-error">
          <b>{error.message}</b>
          {error.help && (
            <ol>
              {error.help.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ol>
          )}
        </div>
      )}
      <input
        className="wx-input"
        type="search"
        placeholder="Ort suchen, z. B. Garmisch"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        enterKeyHint="search"
        autoComplete="off"
        aria-label="Ort suchen"
      />
      {hits && query.trim().length >= 2 && (
        <ul className="wx-hits">
          {hits.length === 0 && (
            <li className="muted wx-nohit">
              {/^\d+$/.test(query.trim()) ? 'Bitte den Ortsnamen statt der Postleitzahl eingeben.' : 'Kein Ort gefunden.'}
            </li>
          )}
          {hits.map((h) => (
            <li key={`${h.lat},${h.lon}`}>
              <button onClick={() => pick(h)}>
                {h.name}
                {h.region && <small>{h.region}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
