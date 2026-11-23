import type { ViewMode } from '../types';
import { useStore } from '../store';
import { Group, Row } from './controls';
import { fmtHour } from '../lib/dates';
import { t } from '../i18n';

export function ViewTab() {
  const { settings, updateSettings } = useStore();
  const hours = Array.from({ length: 25 }, (_, i) => i);
  const views: [ViewMode, string][] = [
    ['day', t('calendar.views.day')],
    ['days', t('calendar.nDays', { n: settings.multiDays })],
    ['week', t('calendar.views.week')],
    ['month', t('calendar.views.month')],
    ['year', t('calendar.views.year')],
    ['agenda', t('calendar.views.agenda')],
  ];
  return (
    <div className="form">
      <Group>
        <div className="set-card">
          <Row label={t('settings.view.startView')} hint={t('settings.view.startViewHint')}>
            <select value={settings.defaultView} onChange={(e) => updateSettings({ defaultView: e.target.value as ViewMode })}>
              {views.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Row>
          <Row label={t('settings.view.weekStarts')}>
            <div className="segmented">
              {(
                [
                  [1, t('settings.view.monday')],
                  [0, t('settings.view.sunday')],
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
      <Group title={t('settings.view.visibleTime')} note={t('settings.view.visibleTimeNote')}>
        <div className="set-card">
          <Row label={t('settings.view.dayStarts')}>
            <select value={settings.dayStartHour} onChange={(e) => updateSettings({ dayStartHour: Number(e.target.value) })}>
              {hours.slice(0, 23).map((h) => (
                <option key={h} value={h}>
                  {fmtHour(h)}
                </option>
              ))}
            </select>
          </Row>
          <Row label={t('settings.view.dayEnds')}>
            <select value={settings.dayEndHour} onChange={(e) => updateSettings({ dayEndHour: Number(e.target.value) })}>
              {hours.slice(settings.dayStartHour + 1).map((h) => (
                <option key={h} value={h}>
                  {fmtHour(h)}
                </option>
              ))}
            </select>
          </Row>
        </div>
      </Group>
    </div>
  );
}
