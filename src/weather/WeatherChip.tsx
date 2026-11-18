import { activeAlerts, deg, describe, useHomeWeather } from '../lib/weather';
import './weather.css';

/** Current weather of the home place for the calendar header; tap opens the weather module. */
export function WeatherChip({ now, onClick }: { now: Date; onClick: () => void }) {
  const { place, data } = useHomeWeather();
  if (!place || !data) return null;
  const w = describe(data.current.code, data.current.isDay);
  const warn = activeAlerts(data, now).length > 0;
  return (
    <button className="wx-chip" onClick={onClick} title={`${place.name}: ${w.text}${warn ? ' – Wetterwarnung' : ''}`}>
      <span className="wx-chip-i" aria-hidden>
        {w.icon}
      </span>
      <span className="wx-chip-t">{deg(data.current.temp)}</span>
      {warn && (
        <span className="wx-chip-warn" aria-label="Wetterwarnung">
          ⚠️
        </span>
      )}
    </button>
  );
}

/** Weather line under the screensaver clock. */
export function FrameWeather() {
  const { place, data } = useHomeWeather();
  if (!place || !data) return null;
  const w = describe(data.current.code, data.current.isDay);
  const today = data.days.find((d) => d.date === data.current.time.slice(0, 10));
  return (
    <div className="pf-weather">
      <span className="pf-weather-i">{w.icon}</span>
      <span>{deg(data.current.temp)}</span>
      <small>
        {w.text}
        {today ? ` · ${deg(today.max)} / ${deg(today.min)}` : ''}
      </small>
    </div>
  );
}
