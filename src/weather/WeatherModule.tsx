import { useState } from 'react';

import { activeAlerts, deg, refresh, setActivePlace, useWeather, useWeatherSettings, type Place } from '../lib/weather';
import { WxIcon } from './WxIcon';
import './weather.css';
import { Forecast } from './Forecast';
import { AddPlace, PlacesSheet } from './Places';

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
