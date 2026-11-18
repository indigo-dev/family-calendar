import { useEffect, useState } from 'react';
import { dayKey, fmt } from '../lib/dates';
import {
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
  type Place,
  type SearchHit,
  type WeatherData,
} from '../lib/weather';
import './weather.css';

/** Weather of the chosen place + the list of saved places. */
export function WeatherModule({ now }: { now: Date }) {
  const { places, activeId } = useWeatherSettings();
  const place = places.find((p) => p.id === activeId) ?? places[0];
  const { data, loading, error } = useWeather(place);

  if (!place) {
    return (
      <div className="wx wx-single">
        <section className="view wx-onboard">
          <div className="wx-onboard-box">
            <div className="wx-onboard-icon" aria-hidden>
              ⛅
            </div>
            <h2>Für welchen Ort soll das Wetter angezeigt werden?</h2>
            <p className="muted">
              Der Standort wird nur einmal abgefragt und auf etwa einen Kilometer gerundet gespeichert. Alternativ kannst du den Ort suchen.
            </p>
            <AddPlace first />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="wx">
      <section className="view wx-main">
        <div className="wx-scroll">
          {data ? (
            <Forecast data={data} now={now} />
          ) : (
            <div className="wx-empty">{error ?? (loading ? 'Wetter wird geladen …' : '')}</div>
          )}
        </div>
      </section>

      <aside className="view wx-side">
        <div className="wx-status">
          <div>
            <b>{place.name}</b>
            <span className="muted">
              {data ? `Stand ${new Date(data.fetchedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : ''}
              {error && data ? ' · offline' : ''}
            </span>
          </div>
          <button className={`btn ${loading ? 'wx-spin' : ''}`} onClick={() => refresh(place, true)} disabled={loading} aria-label="Aktualisieren">
            ⟳
          </button>
        </div>

        <div className="fr-field">
          <span>Orte</span>
          <ul className="wx-places">
            {places.map((p, i) => (
              <PlaceRow key={p.id} place={p} home={i === 0} active={p.id === place.id} />
            ))}
          </ul>
          <p className="fr-hint">Der erste Ort ist „Zuhause“: Sein Wetter erscheint im Kalender und im Bildschirmschoner.</p>
        </div>

        <div className="fr-field">
          <span>Ort hinzufügen</span>
          <AddPlace />
        </div>

        <p className="wx-credit">
          Wetterdaten: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0) · Warnungen: Deutscher
          Wetterdienst über <a href="https://brightsky.dev/" target="_blank" rel="noreferrer">Bright Sky</a> · Pollen: CAMS
        </p>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ forecast */

const ALERTS_SHOWN = 2;
const SEVERITY_ORDER = ['minor', 'moderate', 'severe', 'extreme'];

function Forecast({ data, now }: { data: WeatherData; now: Date }) {
  const today = dayKey(now);
  const days = data.days.filter((d) => d.date >= today).slice(0, 7);
  const todayData = days[0];
  const cur = data.current;
  const c = describe(cur.code, cur.isDay);
  const [showAll, setShowAll] = useState(false);
  // most severe first, then the earliest
  const alerts = activeAlerts(data, now).sort(
    (a, b) => SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity) || a.onset.localeCompare(b.onset),
  );

  // the next 24 hours from the current hour on
  const hourKey = `${today}T${String(now.getHours()).padStart(2, '0')}`;
  const start = Math.max(0, data.hours.findIndex((h) => h.time.startsWith(hourKey)));
  const hours = data.hours.slice(start, start + 25);

  return (
    <>
      {(showAll ? alerts : alerts.slice(0, ALERTS_SHOWN)).map((a) => (
        <details key={a.id} className={`wx-alert sev-${a.severity}`}>
          <summary>
            <span className="wx-alert-icon" aria-hidden>
              ⚠️
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
          {showAll ? 'Weniger Warnungen anzeigen' : `+ ${alerts.length - ALERTS_SHOWN} weitere Warnung${alerts.length - ALERTS_SHOWN > 1 ? 'en' : ''}`}
        </button>
      )}
      {data.alerts && alerts.length === 0 &&<div className="wx-noalert">✓ Keine amtlichen Wetterwarnungen</div>}

      <div className="wx-hero">
        <div className="wx-hero-icon" aria-hidden>
          {c.icon}
        </div>
        <div className="wx-hero-main">
          <div className="wx-hero-temp">{deg(cur.temp)}</div>
          <div className="wx-hero-text">{c.text}</div>
        </div>
        <dl className="wx-facts">
          <Fact k="Gefühlt" v={deg(cur.feels)} />
          {todayData && <Fact k="Heute" v={`${deg(todayData.max)} / ${deg(todayData.min)}`} />}
          <Fact k="Wind" v={`${Math.round(cur.wind)} km/h`} />
          <Fact k="Luftfeuchte" v={`${Math.round(cur.humidity)} %`} />
          {todayData && <Fact k="Regen" v={`${todayData.rainProb} % · ${todayData.rainSum.toFixed(1).replace('.', ',')} mm`} />}
          {todayData && <Fact k="Sonne" v={`${fmtTime(todayData.sunrise)} – ${fmtTime(todayData.sunset)}`} />}
        </dl>
      </div>

      <h3 className="wx-h">Nächste 24 Stunden</h3>
      <div className="wx-hours">
        {hours.map((h, i) => {
          const d = describe(h.code, h.isDay);
          return (
            <div key={h.time} className="wx-hour">
              <span className="wx-hour-t">{i === 0 ? 'Jetzt' : `${h.time.slice(11, 13)} Uhr`}</span>
              <span className="wx-hour-i" title={d.text}>
                {d.icon}
              </span>
              <b>{deg(h.temp)}</b>
              <span className={`wx-hour-rain ${h.rainProb >= 30 ? 'on' : ''}`}>
                <span className="wx-rainbar" style={{ height: `${h.rainProb}%` }} />
                {h.rainProb >= 10 ? `${h.rainProb} %` : ''}
              </span>
            </div>
          );
        })}
      </div>

      <div className="wx-cards">
        <UvCard data={data} days={days} today={today} />
        <PollenCard data={data} today={today} />
      </div>

      <h3 className="wx-h">7 Tage</h3>
      <WeekList days={days} today={today} />
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

function alertTime(onset: string, expires: string | null) {
  const f = (s: string) => new Date(s).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return expires ? `${f(onset)} bis ${f(expires)}` : `ab ${f(onset)}`;
}

const weekday = (date: string, today: string) => {
  if (date === today) return 'Heute';
  const d = new Date(`${date}T12:00`);
  return fmt(d, { weekday: 'short', day: 'numeric', month: 'numeric' });
};

function WeekList({ days, today }: { days: Day[]; today: string }) {
  const lo = Math.min(...days.map((d) => d.min));
  const hi = Math.max(...days.map((d) => d.max));
  const span = Math.max(1, hi - lo);
  return (
    <ul className="wx-week">
      {days.map((d) => {
        const w = describe(d.code);
        const uv = uvLevel(d.uvMax);
        return (
          <li key={d.date}>
            <span className="wx-week-d">{weekday(d.date, today)}</span>
            <span className="wx-week-i" title={w.text}>
              {w.icon}
            </span>
            <span className={`wx-week-r ${d.rainProb >= 30 ? 'on' : ''}`}>{d.rainProb >= 10 ? `💧 ${d.rainProb} %` : ''}</span>
            <span className="wx-week-min">{deg(d.min)}</span>
            <span className="wx-range">
              <span style={{ left: `${((d.min - lo) / span) * 100}%`, right: `${((hi - d.max) / span) * 100}%` }} />
            </span>
            <span className="wx-week-max">{deg(d.max)}</span>
            <span className={`wx-uv-chip lvl-${uv.level}`} title={`UV-Index ${uv.label}`}>
              UV {Math.round(d.uvMax)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function UvCard({ data, days, today }: { data: WeatherData; days: Day[]; today: string }) {
  const max = days[0]?.uvMax ?? 0;
  const lvl = uvLevel(max);
  const window = protectionWindow(data.hours, today);
  const hours = data.hours.filter((h) => h.time.startsWith(today)).filter((h) => {
    const hh = Number(h.time.slice(11, 13));
    return hh >= 6 && hh <= 20;
  });
  return (
    <div className="wx-card">
      <div className="wx-card-head">
        <span>UV-Index heute</span>
        <span className={`wx-uv-chip lvl-${lvl.level}`}>
          {Math.round(max)} · {lvl.label}
        </span>
      </div>
      <div className="wx-uv-bars" aria-hidden>
        {hours.map((h) => (
          <span key={h.time} className={`lvl-${uvLevel(h.uv).level}`} style={{ height: `${Math.min(100, (h.uv / 10) * 100)}%` }} />
        ))}
      </div>
      <div className="wx-uv-axis" aria-hidden>
        <span>6</span>
        <span>12</span>
        <span>18 Uhr</span>
      </div>
      <p className="wx-card-text">
        {window
          ? lvl.level >= 3
            ? `Sonnenschutz wichtig von ${window}: Creme, Hut, mittags in den Schatten.`
            : `Sonnenschutz sinnvoll von ${window}.`
          : 'Heute ist kein Sonnenschutz nötig.'}
      </p>
    </div>
  );
}

function PollenCard({ data, today }: { data: WeatherData; today: string }) {
  if (!data.pollen) {
    return (
      <div className="wx-card">
        <div className="wx-card-head">
          <span>Pollenflug</span>
        </div>
        <p className="wx-card-text">Pollendaten sind gerade nicht verfügbar.</p>
      </div>
    );
  }
  const days = data.pollen.filter((d) => d.date >= today).slice(0, 4);
  // only species that fly at all in the coming days
  const active = POLLEN_TYPES.filter((t) => days.some((d) => pollenLevel(t.id, d.values[t.id]) > 0));
  return (
    <div className="wx-card">
      <div className="wx-card-head">
        <span>Pollenflug</span>
      </div>
      {active.length === 0 ? (
        <p className="wx-card-text">🌱 Derzeit kein nennenswerter Pollenflug.</p>
      ) : (
        <table className="wx-pollen">
          <thead>
            <tr>
              <th />
              {days.map((d) => (
                <th key={d.date}>{weekday(d.date, today).split(',')[0]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {active.map((t) => (
              <tr key={t.id}>
                <th>{t.label}</th>
                {days.map((d) => {
                  const l = pollenLevel(t.id, d.values[t.id]);
                  return (
                    <td key={d.date}>
                      <span className={`wx-pl pl-${l}`} title={POLLEN_LABELS[l]}>
                        {POLLEN_LABELS[l]}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="wx-card-hint">Modellwerte (CAMS, ca. 10 km), keine amtliche Pollenflug-Vorhersage.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ places */

function PlaceRow({ place, home, active }: { place: Place; home: boolean; active: boolean }) {
  const { data } = useWeather(place);
  const w = data ? describe(data.current.code, data.current.isDay) : null;
  return (
    <li className={active ? 'on' : ''}>
      <button className="wx-place-hit" onClick={() => setActivePlace(place.id)}>
        <span className="wx-place-name">
          {home && <span title="Zuhause">🏠 </span>}
          {place.name}
          {place.region && <small>{place.region}</small>}
        </span>
        {data && w && (
          <span className="wx-place-now">
            {w.icon} {deg(data.current.temp)}
          </span>
        )}
      </button>
      {active && (
        <span className="wx-place-tools">
          {!home && (
            <button className="btn" onClick={() => makeHome(place.id)}>
              Als Zuhause
            </button>
          )}
          <button
            className="btn"
            onClick={() => {
              const name = prompt('Name des Orts', place.name)?.trim();
              if (name) renamePlace(place.id, name);
            }}
          >
            Umbenennen
          </button>
          <button
            className="btn danger"
            onClick={() => confirm(`„${place.name}“ entfernen?`) && removePlace(place.id)}
          >
            Entfernen
          </button>
        </span>
      )}
    </li>
  );
}

function AddPlace({ first = false }: { first?: boolean }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // search while typing (debounced)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits(null);
      return;
    }
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pick = (h: SearchHit) => {
    addPlace(h);
    setQuery('');
    setHits(null);
  };

  return (
    <div className="wx-add">
      <button className={`btn ${first ? 'primary' : ''} wx-locate`} onClick={useLocation} disabled={busy}>
        📍 {busy ? 'Standort wird ermittelt …' : 'Meinen Standort verwenden'}
      </button>
      {error && <p className="wx-error">{error}</p>}
      <input
        className="wx-search"
        type="search"
        placeholder="Ort suchen, z. B. Garmisch"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        enterKeyHint="search"
        autoComplete="off"
      />
      {hits && (
        <ul className="wx-hits">
          {hits.length === 0 && (
            <li className="muted wx-nohit">{/^\d+$/.test(query.trim()) ? 'Bitte den Ortsnamen statt der Postleitzahl eingeben.' : 'Kein Ort gefunden.'}</li>
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
