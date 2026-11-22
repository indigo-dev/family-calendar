import { useState } from 'react';
import { Group, Row, Switch } from './controls';
import { DEFAULT_MODEL, updateVoiceSettings, useVoiceSettings } from '../voice/settings';
import { listModels, VoiceError, type ModelInfo } from '../voice/gemini';

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
        text:
          known || switched
            ? `Verbindung klappt${switched ? ` – Modell auf „${DEFAULT_MODEL}“ umgestellt` : ''}. Der Mikrofon-Knopf ist jetzt unten rechts.`
            : `Verbindung klappt, aber das Modell „${voice.model}“ gibt es für diesen Key nicht – bitte unten eins wählen.`,
      });
    } catch (e) {
      setTest({ busy: false, ok: false, text: e instanceof VoiceError ? e.message : 'Test fehlgeschlagen.' });
    }
  };

  const options = models.length ? models : [{ id: voice.model, label: voice.model }];

  return (
    <div className="form">
      <div className="field">
        <span>Gemini-API-Key</span>
        <div className="copy-row">
          <input
            style={inputStyle}
            type="password"
            value={key}
            placeholder="AIza…"
            aria-label="Gemini-API-Key"
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="btn primary" onClick={save} disabled={test?.busy}>
            {test?.busy ? 'Prüfe …' : 'Speichern & testen'}
          </button>
        </div>
        {test && !test.busy && <p className={test.ok ? 'success' : 'error'}>{test.text}</p>}
        <p className="help">
          Den Key gibt es kostenlos im <strong>Google AI Studio</strong> (aistudio.google.com → „Get API key“). Ein Google-AI-Pro-Abo
          enthält keinen API-Zugang. Im kostenlosen Tarif darf Google die Anfragen zur Verbesserung seiner Modelle verwenden; mit
          hinterlegter Zahlungsart nicht – ein Befehl kostet dann Bruchteile eines Cents.
        </p>
      </div>

      <Group
        note={
          <>
            Der Key bleibt nur auf diesem Gerät und kommt nicht in die Sicherungsdatei. Beim Sprechen geht die Aufnahme zusammen mit
            Familiennamen, Wetter-Orten und Vorratsliste an Google.
          </>
        }
      >
        <div className="set-card">
          <Row label="Modell" hint={models.length ? 'Modelle dieses Keys' : 'Nach dem Test stehen alle Modelle zur Wahl'}>
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
            <Row label="Standardmodell" hint={DEFAULT_MODEL}>
              <button className="btn" onClick={() => updateVoiceSettings({ model: DEFAULT_MODEL })}>
                Zurücksetzen
              </button>
            </Row>
          )}
          <Row label="Antworten vorlesen" hint="Ergebnis und Antworten werden gesprochen">
            <Switch checked={voice.speak} onChange={(speak) => updateVoiceSettings({ speak })} label="Antworten vorlesen" />
          </Row>
        </div>
      </Group>

      <Group title="Was geht">
        <ul className="help" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>„Pack drei Äpfel und eine Milch auf die Einkaufsliste“</li>
          <li>„Erinnere Anna morgen an die Turnsachen“</li>
          <li>„Wie wird das Wetter morgen?“</li>
          <li>„Was steht diese Woche an?“</li>
          <li>„Zeig mir den Stundenplan“</li>
        </ul>
      </Group>
    </div>
  );
}
