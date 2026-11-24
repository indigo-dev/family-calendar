import { useState } from 'react';
import { Group, Row, Switch } from './controls';
import { DEFAULT_MODEL, updateVoiceSettings, useVoiceSettings } from '../voice/settings';
import { listModels, VoiceError, type ModelInfo } from '../voice/gemini';
import { t } from '../i18n';

type Test = { busy: true } | { busy: false; ok: boolean; text: string };

const inputStyle = { flex: 1, minHeight: 44, border: '1px solid var(--line-strong)', borderRadius: 10, padding: '0 12px' };

export function VoiceTab() {
  const voice = useVoiceSettings();
  const [key, setKey] = useState(voice.apiKey);
  const [test, setTest] = useState<Test | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);

  const save = async () => {
    const apiKey = key.trim();
    setKey(apiKey);
    updateVoiceSettings({ apiKey });
    if (!apiKey) return setTest(null);
    setTest({ busy: true });
    try {
      const list = await listModels(apiKey);
      setModels(list);
      const known = list.some((m) => m.id === voice.model);
      // the chosen model is gone, but the recommended one is there: switch silently
      const switched = !known && list.some((m) => m.id === DEFAULT_MODEL);
      if (switched) updateVoiceSettings({ model: DEFAULT_MODEL });
      setTest({
        busy: false,
        ok: true,
        text: switched
          ? t('settings.voice.connectedSwitched', { model: DEFAULT_MODEL })
          : known
            ? t('settings.voice.connected')
            : t('settings.voice.unknownModel', { model: voice.model }),
      });
    } catch (e) {
      setTest({ busy: false, ok: false, text: e instanceof VoiceError ? e.message : t('settings.voice.testFailed') });
    }
  };

  const options = models.length ? models : [{ id: voice.model, label: voice.model }];

  return (
    <div className="form">
      <div className="field">
        <span>{t('settings.voice.apiKey')}</span>
        <div className="copy-row">
          <input
            style={inputStyle}
            type="password"
            value={key}
            placeholder="AIza…"
            aria-label={t('settings.voice.apiKey')}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="btn primary" onClick={save} disabled={test?.busy}>
            {test?.busy ? t('common.checking') : t('settings.calendars.saveTest')}
          </button>
        </div>
        {test && !test.busy && <p className={test.ok ? 'success' : 'error'}>{test.text}</p>}
        <p className="help">
          {t('settings.voice.keyHelp1')} <strong>Google AI Studio</strong> {t('settings.voice.keyHelp2')}
        </p>
      </div>

      <Group note={t('settings.voice.privacy')}>
        <div className="set-card">
          <Row
            label={t('settings.voice.model')}
            hint={models.length ? t('settings.voice.modelsOfKey') : t('settings.voice.modelsAfterTest')}
          >
            <select value={voice.model} onChange={(e) => updateVoiceSettings({ model: e.target.value })}>
              {!options.some((m) => m.id === voice.model) && <option value={voice.model}>{voice.model}</option>}
              {options.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Row>
          {voice.model !== DEFAULT_MODEL && (
            <Row label={t('settings.voice.defaultModel')} hint={DEFAULT_MODEL}>
              <button className="btn" onClick={() => updateVoiceSettings({ model: DEFAULT_MODEL })}>
                {t('common.reset')}
              </button>
            </Row>
          )}
          <Row label={t('settings.voice.speak')} hint={t('settings.voice.speakHint')}>
            <Switch checked={voice.speak} onChange={(speak) => updateVoiceSettings({ speak })} label={t('settings.voice.speak')} />
          </Row>
        </div>
      </Group>

      <Group title={t('settings.voice.examples')} note={t('settings.voice.examplesNote')}>
        <ul className="help" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>{t('settings.voice.example1')}</li>
          <li>{t('settings.voice.example2')}</li>
          <li>{t('settings.voice.example3')}</li>
          <li>{t('settings.voice.example4')}</li>
          <li>{t('settings.voice.example5')}</li>
          <li>{t('settings.voice.example6')}</li>
        </ul>
      </Group>
    </div>
  );
}
