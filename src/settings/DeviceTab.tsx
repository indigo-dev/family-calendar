import { useStore } from '../store';
import { Group, Row, Stepper, Switch } from './controls';

export function DeviceTab() {
  const { settings, updateSettings } = useStore();
  return (
    <div className="form">
      <Group>
        <div className="set-card">
          <Row label="Termine aktualisieren" hint="Wie oft die Kalender neu geladen werden">
            <Stepper
              value={settings.refreshMinutes}
              min={1}
              max={120}
              unit="Min."
              onChange={(v) => updateSettings({ refreshMinutes: v })}
            />
          </Row>
          <Row label="Zurück zur Übersicht" hint="Nach so vielen Minuten ohne Bedienung · 0 = nie">
            <Stepper
              value={settings.idleResetMinutes}
              min={0}
              max={120}
              unit="Min."
              onChange={(v) => updateSettings({ idleResetMinutes: v })}
            />
          </Row>
          <Row label="Bildschirm wach halten" hint="Das Tablet geht nicht in den Ruhezustand">
            <Switch checked={settings.keepAwake} onChange={(keepAwake) => updateSettings({ keepAwake })} label="Bildschirm wach halten" />
          </Row>
        </div>
      </Group>
    </div>
  );
}
