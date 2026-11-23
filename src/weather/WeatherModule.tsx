import { useState } from 'react';
import { softly } from '../lib/transition';

import { activeAlerts, deg, refresh, setActivePlace, useWeather, useWeatherSettings, type Place } from '../lib/weather';
import { WxIcon } from './WxIcon';
import './weather.css';
import { Forecast } from './Forecast';
import { AddPlace, PlacesSheet } from './Places';
import { useMinute } from '../lib/clock';
import { t } from '../i18n';
import { fmtTime } from '../lib/dates';

const clock = (ms: number) => fmtTime(new Date(ms));

/** Weather of the chosen place. Places are tabs on top; managing them opens a sheet. */
export function WeatherModule() {
  const now = useMinute();
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
            <h2>{t('weather.whichPlace')}</h2>
            <p className="muted">{t('weather.locationNote')}</p>
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
        <div className="wx-pills" role="tablist" aria-label={t('weather.places')}>
          {places.map((p, i) => (
            <PlacePill key={p.id} place={p} home={i === 0} active={p.id === place.id} />
          ))}
          <button className="wx-pill wx-pill-add" onClick={() => setSheet(true)} aria-label={t('weather.managePlaces')}>
            <span aria-hidden>＋</span>
            <span className="wx-pill-add-t">{t('weather.places')}</span>
          </button>
        </div>
        <div className="wx-stamp">
          <span>
            {data ? t('weather.updated', { time: clock(data.fetchedAt) }) : ''}
            {error && data ? t('weather.offlineShort') : ''}
            {data?.alerts && alerts.length === 0 && <span className="wx-stamp-ok">{t('weather.noAlerts')}</span>}
          </span>
          <button
            className={`icon-btn wx-refresh ${loading ? 'spin' : ''}`}
            onClick={() => refresh(place, true)}
            disabled={loading}
            aria-label={t('common.refresh')}
          >
            ⟳
          </button>
        </div>
      </div>{' '}
      <div className="wx-scroll" data-vt-section>
        {data ? (
          <Forecast key={place.id} data={data} now={now} />
        ) : (
          <div className="wx-empty">{error ?? (loading ? t('dashboard.weatherLoading') : '')}</div>
        )}
        <p className="wx-credit">
          {t('weather.credit1')}{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>{' '}
          {t('weather.credit2')}{' '}
          <a href="https://brightsky.dev/" target="_blank" rel="noreferrer">
            Bright Sky
          </a>{' '}
          {t('weather.credit3')}
        </p>
      </div>
      {sheet && <PlacesSheet onClose={() => setSheet(false)} />}
    </div>
  );
}

function PlacePill({ place, home, active }: { place: Place; home: boolean; active: boolean }) {
  const { data } = useWeather(place);
  return (
    <button
      role="tab"
      aria-selected={active}
      className={`wx-pill ${active ? 'on' : ''}`}
      onClick={() => !active && softly(() => setActivePlace(place.id))}
    >
      {home && <span aria-label={t('weather.home')}>🏠</span>}
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
