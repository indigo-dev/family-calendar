import { useStore } from '../store';
import { Group, Row, Stepper, Switch } from './controls';
import { LANGUAGES, resolveLanguage, t, withLanguage, type LanguageSetting } from '../i18n';
import { useMinute } from '../lib/clock';
import { fmt, fmtTime } from '../lib/dates';

/** Today's date and time as the language writes it – the preview of a language card. */
function languageSample(setting: LanguageSetting, now: Date): string {
  return withLanguage(
    resolveLanguage(setting),
    () => `${fmt(now, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(now)}`,
  );
}

export function DeviceTab() {
  const { settings, updateSettings } = useStore();
  const now = useMinute();
  const deviceName = LANGUAGES.find((l) => l.id === resolveLanguage('auto'))!.label;
  const options: { id: LanguageSetting; label: string; note: string }[] = [
    { id: 'auto', label: t('settings.device.auto'), note: t('settings.device.autoNote', { language: deviceName }) },
    ...LANGUAGES.map((l) => ({ id: l.id, label: l.label, note: '' })),
  ];
  return (
    <div className="form">
      <Group title={t('settings.device.language')}>
        <div className="pick-grid three" role="radiogroup" aria-label={t('settings.device.language')}>
          {options.map((o) => (
            <button
              key={o.id}
              role="radio"
              aria-checked={settings.language === o.id}
              className={`pick-card ${settings.language === o.id ? 'on' : ''}`}
              onClick={() => updateSettings({ language: o.id })}
            >
              <span className="lang-thumb" aria-hidden>
                {languageSample(o.id, now)}
              </span>
              <span className="pick-label">{o.label}</span>
              {o.note && <span className="pick-note">{o.note}</span>}
            </button>
          ))}
        </div>
      </Group>
      <Group>
        <div className="set-card">
          <Row label={t('settings.device.refresh')} hint={t('settings.device.refreshHint')}>
            <Stepper
              value={settings.refreshMinutes}
              min={1}
              max={120}
              unit={t('common.minutesShort')}
              onChange={(v) => updateSettings({ refreshMinutes: v })}
            />
          </Row>
          <Row label={t('settings.device.idle')} hint={t('settings.device.idleHint')}>
            <Stepper
              value={settings.idleResetMinutes}
              min={0}
              max={120}
              unit={t('common.minutesShort')}
              onChange={(v) => updateSettings({ idleResetMinutes: v })}
            />
          </Row>
          <Row label={t('settings.device.keepAwake')} hint={t('settings.device.keepAwakeHint')}>
            <Switch
              checked={settings.keepAwake}
              onChange={(keepAwake) => updateSettings({ keepAwake })}
              label={t('settings.device.keepAwake')}
            />
          </Row>
        </div>
      </Group>
    </div>
  );
}
