import type { Settings } from '../types';
import { t } from '../i18n';
import { oneOf, persisted, usePersisted } from '../lib/persisted';
import { useStore } from '../store';
import { UI_STYLES } from '../lib/config';
import { Sym } from '../components/Sym';
import { SYMBOL_SETS, type SymbolSet } from '../lib/symbols';
import { WEATHER_ICON_SETS, type WeatherIconSet, type WeatherKey } from '../lib/weatherIcons';
import { WxIcon } from '../weather/WxIcon';
import { Group } from './controls';
import { MODULE_TRANSITIONS } from '../lib/transition';

type DesignSection = 'style' | 'weather' | 'shopping' | 'motion';

const SECTIONS: { id: DesignSection; label: () => string }[] = [
  { id: 'style', label: () => t('settings.design.style') },
  { id: 'weather', label: () => t('settings.design.weatherIcons') },
  { id: 'shopping', label: () => t('settings.design.shoppingIcons') },
  { id: 'motion', label: () => t('settings.design.motion') },
];

/** the last opened section (per device), so the settings open where you left them */
const sectionStore = persisted<DesignSection>(
  'fc.designSection',
  (raw) =>
    oneOf(
      raw,
      SECTIONS.map((s) => s.id),
      'style',
    ),
  { syncTabs: false },
);
const setSection = (s: DesignSection) => sectionStore.set(s);

export function DesignTab() {
  const { settings, updateSettings } = useStore();
  const section = usePersisted(sectionStore);
  return (
    <div className="form">
      <div className="segmented design-sections" role="tablist" aria-label={t('settings.design.sections')}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={section === s.id}
            className={section === s.id ? 'active' : ''}
            onClick={() => setSection(s.id)}
          >
            {s.label()}
          </button>
        ))}
      </div>

      {section === 'style' && (
        <>
          <Group title={t('settings.design.style')}>
            <div className="pick-grid" role="radiogroup" aria-label={t('settings.design.style')}>
              {UI_STYLES.map((s) => (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={settings.style === s.id}
                  className={`pick-card ${settings.style === s.id ? 'on' : ''}`}
                  onClick={() => updateSettings({ style: s.id })}
                >
                  <span className={`style-thumb st-${s.id}`} aria-hidden>
                    <i className="st-bar" />
                    <i className="st-a" />
                    <i className="st-b" />
                    <i className="st-c" />
                  </span>
                  <span className="pick-label">{s.label}</span>
                  <span className="pick-note">{s.note}</span>
                </button>
              ))}
            </div>
          </Group>

          <Group title={t('settings.design.lightDark')}>
            <div className="pick-grid three" role="radiogroup" aria-label={t('settings.design.lightDark')}>
              {(
                [
                  ['auto', t('settings.design.themes.auto'), t('settings.design.themes.autoNote')],
                  ['light', t('settings.design.themes.light'), t('settings.design.themes.lightNote')],
                  ['dark', t('settings.design.themes.dark'), t('settings.design.themes.darkNote')],
                ] as [Settings['theme'], string, string][]
              ).map(([id, label, note]) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={settings.theme === id}
                  className={`pick-card ${settings.theme === id ? 'on' : ''}`}
                  onClick={() => updateSettings({ theme: id })}
                >
                  <span className={`mode-thumb mode-${id}`} aria-hidden>
                    <i />
                    <i />
                  </span>
                  <span className="pick-label">{label}</span>
                  <span className="pick-note">{note}</span>
                </button>
              ))}
            </div>
          </Group>
        </>
      )}

      {section === 'motion' && (
        <Group title={t('settings.design.motion')} note={t('settings.design.motionNote')}>
          <div className="pick-grid" role="radiogroup" aria-label={t('settings.design.motion')}>
            {MODULE_TRANSITIONS.map((tr) => (
              <button
                key={tr.id}
                role="radio"
                aria-checked={settings.moduleTransition === tr.id}
                className={`pick-card ${settings.moduleTransition === tr.id ? 'on' : ''}`}
                onClick={() => updateSettings({ moduleTransition: tr.id })}
              >
                {/* two mini pages that swap back and forth with this animation */}
                <span className={`tr-thumb tr-${tr.id}`} aria-hidden>
                  <i className="tr-rail" />
                  <span className="tr-stage">
                    <i className="tr-a" />
                    <i className="tr-b" />
                  </span>
                </span>
                <span className="pick-label">{tr.label}</span>
                <span className="pick-note">{tr.note}</span>
              </button>
            ))}
          </div>
        </Group>
      )}

      {section === 'weather' && (
        <Group title={t('settings.design.weatherIcons')} note={t('settings.design.weatherNote')}>
          <WeatherIconPicker value={settings.weatherIcons} onChange={(weatherIcons) => updateSettings({ weatherIcons })} />
        </Group>
      )}

      {section === 'shopping' && (
        <Group title={t('settings.design.shoppingTitle')}>
          <SymbolPicker value={settings.symbols} onChange={(symbols) => updateSettings({ symbols })} />
        </Group>
      )}
    </div>
  );
}

const WEATHER_PREVIEW: WeatherKey[] = [
  'clear-day',
  'partly-cloudy-day',
  'partly-cloudy-day-rain',
  'thunderstorms-day-rain',
  'snow',
  'clear-night',
];

function WeatherIconPicker({ value, onChange }: { value: WeatherIconSet; onChange: (v: WeatherIconSet) => void }) {
  return (
    <div className="field">
      <div className="wx-picker" role="radiogroup" aria-label={t('settings.design.weatherIcons')}>
        {WEATHER_ICON_SETS.map((s) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={value === s.id}
            className={`sym-card wx-pick ${value === s.id ? 'on' : ''}`}
            onClick={() => onChange(s.id)}
          >
            <span className="wx-pick-row">
              {WEATHER_PREVIEW.map((k) => (
                <WxIcon key={k} icon={k} set={s.id} title="" />
              ))}
            </span>
            <span className="sym-card-label">{s.label}</span>
            <span className="sym-card-note">{s.note}</span>
          </button>
        ))}
      </div>
      <span className="sym-credits">
        Meteocons © Bas Milius (MIT) · Material Symbols © Google (Apache 2.0) · Fluent Emoji © Microsoft (MIT)
      </span>
    </div>
  );
}

/** sample symbols with their department colour (one-colour styles are tinted with it) */
const SYMBOL_PREVIEW: [string, string][] = [
  ['🍎', '#4caf50'],
  ['🥕', '#4caf50'],
  ['🧀', '#e3b72c'],
  ['☕', '#a0673c'],
  ['🧴', '#b06ad1'],
];

function SymbolPicker({ value, onChange }: { value: SymbolSet; onChange: (v: SymbolSet) => void }) {
  const groups = [...new Set(SYMBOL_SETS.map((s) => s.group))];
  return (
    <div className="field">
      {groups.map((g) => (
        <div key={g} className="sym-picker-group">
          <div className="muted small">{t(`symbolGroups.${g}`)}</div>
          <div className="sym-picker" role="radiogroup" aria-label={t('settings.design.symbolsOf', { group: t(`symbolGroups.${g}`) })}>
            {SYMBOL_SETS.filter((s) => s.group === g).map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={value === s.id}
                className={`sym-card ${value === s.id ? 'on' : ''}`}
                onClick={() => onChange(s.id)}
                title={s.note}
              >
                <span className="sym-card-row">
                  {SYMBOL_PREVIEW.map(([e, color]) => (
                    <span key={e} style={{ ['--sym-tint' as string]: color }}>
                      <Sym emoji={e} set={s.id} />
                    </span>
                  ))}
                </span>
                <span className="sym-card-label">{s.label}</span>
                {s.note && <span className="sym-card-note">{s.note}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
      <span className="sym-credits">
        Fluent Emoji © Microsoft (MIT) · Noto Emoji © Google (Apache 2.0) · Twemoji © Twitter, Inc. {t('settings.design.andOthers')} (CC BY
        4.0) · OpenMoji (CC BY-SA 4.0) · Tabler, Phosphor (MIT) · Lucide (ISC)
      </span>
    </div>
  );
}
