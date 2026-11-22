import type { Settings } from '../types';
import { oneOf, persisted, usePersisted } from '../lib/persisted';
import { useStore } from '../store';
import { UI_STYLES } from '../lib/config';
import { Sym } from '../components/Sym';
import { SYMBOL_SETS, type SymbolSet } from '../lib/symbols';
import { WEATHER_ICON_SETS, type WeatherIconSet, type WeatherKey } from '../lib/weatherIcons';
import { WxIcon } from '../weather/WxIcon';
import { CORE_SUGGESTIONS, PALETTES, paletteColors } from '../lib/colors';
import { Group, Row } from './controls';
import { MODULE_TRANSITIONS } from '../lib/transition';

const STYLE_NOTES: Record<Settings['style'], string> = {
  classic: 'Schlicht und klar',
  soft: 'Weiß, feine Linien, ruhig',
  clear: 'Schwebendes Glas, Kapseln',
  flow: 'Technisch, Punktraster',
  aurora: 'Farbverläufe, Leuchten',
  nodes: 'Knoten auf Punktraster',
  states: 'Zustände und Übergänge',
  minimal: 'Reduziert, warme Grautöne',
};

type DesignSection = 'style' | 'colors' | 'weather' | 'shopping' | 'motion';

const SECTIONS: { id: DesignSection; label: string }[] = [
  { id: 'style', label: 'Stil' },
  { id: 'colors', label: 'Farben' },
  { id: 'weather', label: 'Wetter-Symbole' },
  { id: 'shopping', label: 'Einkaufs-Symbole' },
  { id: 'motion', label: 'Übergänge' },
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
      <div className="segmented design-sections" role="tablist" aria-label="Design-Bereiche">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={section === s.id}
            className={section === s.id ? 'active' : ''}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'style' && (
        <>
          <Group title="Stil">
            <div className="pick-grid" role="radiogroup" aria-label="Stil">
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
                  <span className="pick-note">{STYLE_NOTES[s.id]}</span>
                </button>
              ))}
            </div>
          </Group>

          <Group title="Hell / Dunkel">
            <div className="pick-grid three" role="radiogroup" aria-label="Hell / Dunkel">
              {(
                [
                  ['auto', 'Automatisch', 'folgt dem Gerät'],
                  ['light', 'Hell', 'immer hell'],
                  ['dark', 'Dunkel', 'immer dunkel'],
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

      {section === 'colors' && (
        <Group
          title="Farben"
          note="Gilt für Personen, Schulfächer und Abteilungen der Einkaufsliste. Die gewählten Farben bleiben gespeichert – es ändert sich nur die Darstellung."
        >
          <div className="pick-grid three" role="radiogroup" aria-label="Farbpalette">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                role="radio"
                aria-checked={settings.palette === p.id}
                className={`pick-card ${settings.palette === p.id ? 'on' : ''}`}
                onClick={() => updateSettings({ palette: p.id })}
              >
                <span className="palette-thumb" aria-hidden>
                  {paletteColors(p.id, settings.coreColor)
                    .slice(0, 6)
                    .map((c, i) => (
                      <i key={i} style={{ background: c }} />
                    ))}
                </span>
                <span className="pick-label">{p.label}</span>
                <span className="pick-note">{p.note}</span>
              </button>
            ))}
          </div>
          {settings.palette === 'core' && (
            <div className="set-card">
              <Row label="Kernfarbe" hint="Daraus entstehen alle anderen Farben">
                <div className="swatches">
                  {CORE_SUGGESTIONS.map((c) => (
                    <button
                      key={c}
                      className={`swatch ${settings.coreColor.toLowerCase() === c ? 'on' : ''}`}
                      style={{ background: c }}
                      onClick={() => updateSettings({ coreColor: c })}
                      aria-label={c}
                    />
                  ))}
                  <label
                    className={`swatch custom ${CORE_SUGGESTIONS.includes(settings.coreColor.toLowerCase()) ? '' : 'on'}`}
                    style={{ background: CORE_SUGGESTIONS.includes(settings.coreColor.toLowerCase()) ? undefined : settings.coreColor }}
                    title="Eigene Farbe"
                  >
                    <input type="color" value={settings.coreColor} onChange={(e) => updateSettings({ coreColor: e.target.value })} />+
                  </label>
                </div>
              </Row>
              <div className="core-strip" aria-label="Erzeugte Farben">
                {paletteColors('core', settings.coreColor).map((c, i) => (
                  <i key={i} style={{ background: c }} />
                ))}
              </div>
            </div>
          )}
        </Group>
      )}

      {section === 'motion' && (
        <Group title="Übergänge" note="Wie die Bereiche beim Wechseln ineinander übergehen.">
          <div className="pick-grid" role="radiogroup" aria-label="Übergänge">
            {MODULE_TRANSITIONS.map((t) => (
              <button
                key={t.id}
                role="radio"
                aria-checked={settings.moduleTransition === t.id}
                className={`pick-card ${settings.moduleTransition === t.id ? 'on' : ''}`}
                onClick={() => updateSettings({ moduleTransition: t.id })}
              >
                {/* two mini pages that swap back and forth with this animation */}
                <span className={`tr-thumb tr-${t.id}`} aria-hidden>
                  <i className="tr-rail" />
                  <span className="tr-stage">
                    <i className="tr-a" />
                    <i className="tr-b" />
                  </span>
                </span>
                <span className="pick-label">{t.label}</span>
                <span className="pick-note">{t.note}</span>
              </button>
            ))}
          </div>
        </Group>
      )}

      {section === 'weather' && (
        <Group
          title="Wetter-Symbole"
          note="Für das Wetter-Modul, die Übersicht, den Kalender und den Bildschirmschoner. Die Meteocons bewegen sich leicht."
        >
          <WeatherIconPicker value={settings.weatherIcons} onChange={(weatherIcons) => updateSettings({ weatherIcons })} />
        </Group>
      )}

      {section === 'shopping' && (
        <Group title="Symbole der Einkaufsliste">
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
      <div className="wx-picker" role="radiogroup" aria-label="Wetter-Symbole">
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
          <div className="muted small">{g}</div>
          <div className="sym-picker" role="radiogroup" aria-label={`Symbole: ${g}`}>
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
        Fluent Emoji © Microsoft (MIT) · Noto Emoji © Google (Apache 2.0) · Twemoji © Twitter, Inc. u. a. (CC BY 4.0) · OpenMoji (CC BY-SA
        4.0) · Tabler, Phosphor (MIT) · Lucide (ISC)
      </span>
    </div>
  );
}
