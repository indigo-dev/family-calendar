import type { ViewMode } from '../types';
import { useStore } from '../store';
import { Group, Row } from './controls';

export function ViewTab() {
  const { settings, updateSettings } = useStore();
  const hours = Array.from({ length: 25 }, (_, i) => i);
  const views: [ViewMode, string][] = [
    ['day', 'Tag'],
    ['days', `${settings.multiDays} Tage`],
    ['week', 'Woche'],
    ['month', 'Monat'],
    ['year', 'Jahr'],
    ['agenda', 'Agenda'],
  ];
  return (
    <div className="form">
      <Group>
        <div className="set-card">
          <Row label="Startansicht" hint="So öffnet sich der Kalender">
            <select value={settings.defaultView} onChange={(e) => updateSettings({ defaultView: e.target.value as ViewMode })}>
              {views.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Woche beginnt am">
            <div className="segmented">
              {(
                [
                  [1, 'Montag'],
                  [0, 'Sonntag'],
                ] as [0 | 1, string][]
              ).map(([v, l]) => (
                <button key={v} className={settings.weekStartsOn === v ? 'active' : ''} onClick={() => updateSettings({ weekStartsOn: v })}>
                  {l}
                </button>
              ))}
            </div>
          </Row>
        </div>
      </Group>
      <Group title="Sichtbare Tageszeit" note="Im Tages- und Wochenraster sichtbarer Bereich.">
        <div className="set-card">
          <Row label="Tag beginnt um">
            <select value={settings.dayStartHour} onChange={(e) => updateSettings({ dayStartHour: Number(e.target.value) })}>
              {hours.slice(0, 23).map((h) => (
                <option key={h} value={h}>
                  {h}:00 Uhr
                </option>
              ))}
            </select>
          </Row>
          <Row label="Tag endet um">
            <select value={settings.dayEndHour} onChange={(e) => updateSettings({ dayEndHour: Number(e.target.value) })}>
              {hours.slice(settings.dayStartHour + 1).map((h) => (
                <option key={h} value={h}>
                  {h}:00 Uhr
                </option>
              ))}
            </select>
          </Row>
        </div>
      </Group>
    </div>
  );
}
