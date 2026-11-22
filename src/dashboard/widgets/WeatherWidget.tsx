import { dayKey, fmt } from '../../lib/dates';

import { activeAlerts, deg, describe, SEVERITY_LABEL, useHomeWeather } from '../../lib/weather';
import { WxIcon } from '../../weather/WxIcon';
import { Empty, useDash, type WidgetProps } from './shared';
import { useMinute } from '../../lib/clock';

export function WeatherWidget({ size }: WidgetProps) {
  const { openModule } = useDash();
  const now = useMinute();
  const { place, data, error } = useHomeWeather();
  if (!place)
    return (
      <Empty action="Ort festlegen" onAction={() => openModule('weather')}>
        Kein Ort für das Wetter
      </Empty>
    );
  if (!data) return <Empty>{error ?? 'Wetter wird geladen …'}</Empty>;

  const cur = describe(data.current.code, data.current.isDay);
  const today = data.days.find((d) => d.date === dayKey(now)) ?? data.days[0];
  const hourKey = `${dayKey(now)}T${String(now.getHours()).padStart(2, '0')}`;
  const hours = data.hours.filter((h) => h.time.slice(0, 13) >= hourKey).slice(0, size === 'xl' ? 8 : 6);
  const days = data.days.filter((d) => d.date > dayKey(now)).slice(0, size === 'xl' ? 6 : 4);
  const alerts = activeAlerts(data, now);

  return (
    <div className={`dw-weather ${size}`}>
      {alerts.length > 0 && size !== 's' && (
        <div className={`dw-alert sev-${alerts[0].severity}`}>
          ⚠️ {SEVERITY_LABEL[alerts[0].severity]}: {alerts[0].event}
          {alerts.length > 1 && ` (+${alerts.length - 1})`}
        </div>
      )}
      <div className="dw-weather-now">
        <WxIcon code={data.current.code} isDay={data.current.isDay} className="dw-weather-icon" />
        <div>
          <div className="dw-weather-temp">
            {deg(data.current.temp)}
            {alerts.length > 0 && size === 's' && (
              <span className="dw-alert-dot" title={alerts[0].event}>
                ⚠️
              </span>
            )}
          </div>
          <div className="dw-weather-text">{cur.text}</div>
          {today && (
            <div className="dw-weather-range">
              ↑ {deg(today.max)} ↓ {deg(today.min)}
              {size !== 's' && today.rainProb > 0 && <span> · 💧 {today.rainProb} %</span>}
            </div>
          )}
        </div>
        {size !== 's' && <div className="dw-weather-place">{place.name}</div>}
      </div>
      {size !== 's' && (
        <div className="dw-hours">
          {hours.map((h) => (
            <div key={h.time} className="dw-hour">
              <span className="dw-hour-t">{h.time.slice(11, 13)}</span>
              <WxIcon code={h.code} isDay={h.isDay} className="dw-hour-i" />
              <span className="dw-hour-v">{deg(h.temp)}</span>
            </div>
          ))}
        </div>
      )}
      {(size === 'l' || size === 'xl') && (
        <div className="dw-days">
          {days.map((d) => {
            const date = new Date(d.date + 'T12:00');
            return (
              <div key={d.date} className="dw-day">
                <span className="dw-day-name">{fmt(date, { weekday: 'short' })}</span>
                <WxIcon code={d.code} className="dw-day-i" />
                <span className="dw-day-max">{deg(d.max)}</span>
                <span className="dw-day-min">{deg(d.min)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
