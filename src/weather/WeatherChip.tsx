import { activeAlerts, deg, describe, useHomeWeather } from '../lib/weather';
import { WxIcon } from './WxIcon';
import { useMinute } from '../lib/clock';
import './weather.css';
import { t } from '../i18n';

/** Current weather of the home place for the calendar header; tap opens the weather module. */
export function WeatherChip({ onClick }: { onClick: () => void }) {
  const { place, data } = useHomeWeather();
  const now = useMinute();
  if (!place || !data) return null;
  const w = describe(data.current.code, data.current.isDay);
  const warn = activeAlerts(data, now).length > 0;
  return (
    <button className="wx-chip" onClick={onClick} title={`${place.name}: ${warn ? t('weather.withWarning', { text: w.text }) : w.text}`}>
      <WxIcon code={data.current.code} isDay={data.current.isDay} className="wx-chip-i" title="" />
      <span className="wx-chip-t">{deg(data.current.temp)}</span>
      {warn && (
        <span className="wx-chip-warn" aria-label={t('weather.warning')}>
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
      <WxIcon code={data.current.code} isDay={data.current.isDay} className="pf-weather-i" title="" />
      <span>{deg(data.current.temp)}</span>
      <small>
        {w.text}
        {today ? ` · ${deg(today.max)} / ${deg(today.min)}` : ''}
      </small>
    </div>
  );
}
