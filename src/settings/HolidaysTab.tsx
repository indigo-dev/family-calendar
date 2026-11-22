import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { REGIONS } from '../lib/config';
import { loadHolidays, type Holiday } from '../lib/holidays';
import { fmt } from '../lib/dates';
import { FragmentRow, Group, Row, Switch } from './controls';

export function HolidaysTab() {
  const { settings, updateSettings } = useStore();
  const h = settings.holidays;
  const set = (patch: Partial<typeof h>) => updateSettings({ holidays: { ...h, ...patch } });
  const [loaded, setLoaded] = useState<{ region: string; list?: Holiday[]; error?: string }>({ region: '' });
  const preview: { list?: Holiday[]; error?: string } = h.region && loaded.region === h.region ? loaded : {};

  useEffect(() => {
    if (!h.region) return;
    const region = h.region;
    let alive = true;
    const y = new Date().getFullYear();
    loadHolidays(region, [y, y + 1])
      .then((list) => alive && setLoaded({ region, list }))
      .catch((e) => alive && setLoaded({ region, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [h.region]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (type: Holiday['type'], n: number) => (preview.list ?? []).filter((x) => x.type === type && x.end >= today).slice(0, n);
  const day = (s: string) => fmt(new Date(s + 'T12:00:00'), { day: '2-digit', month: '2-digit', year: '2-digit' });
  const span = (x: Holiday) => (x.start === x.end ? day(x.start) : `${day(x.start)} – ${day(x.end)}`);

  return (
    <div className="form">
      <Group note="Feiertage und Schulferien gelten für die ganze Familie: Feiertage erscheinen farbig am Datum, Ferien als leicht eingefärbte Tage.">
        <div className="set-card">
          <Row label="Bundesland">
            <select value={h.region} onChange={(e) => set({ region: e.target.value })}>
              <option value="">– keine –</option>
              {REGIONS.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </Row>
          {h.region && (
            <>
              <Row label="Gesetzliche Feiertage anzeigen">
                <Switch checked={h.showPublic} onChange={(showPublic) => set({ showPublic })} label="Gesetzliche Feiertage anzeigen" />
              </Row>
              <Row label="Schulferien anzeigen">
                <Switch checked={h.showSchool} onChange={(showSchool) => set({ showSchool })} label="Schulferien anzeigen" />
              </Row>
            </>
          )}
        </div>
      </Group>

      {h.region && (
        <div className="field">
          <span>Vorschau</span>
          {preview.error && <p className="error">Daten konnten nicht geladen werden: {preview.error}</p>}
          {!preview.list && !preview.error && <p className="muted">Lade …</p>}
          {preview.list && (
            <div className="field-row">
              <dl className="hol-preview">
                {upcoming('public', 5).map((x) => (
                  <FragmentRow key={x.id} dt={span(x)} dd={x.name} />
                ))}
              </dl>
              <dl className="hol-preview">
                {upcoming('school', 5).map((x) => (
                  <FragmentRow key={x.id} dt={span(x)} dd={x.name} />
                ))}
              </dl>
            </div>
          )}
        </div>
      )}
      <p className="help">
        Daten:{' '}
        <a href="https://www.openholidaysapi.org" target="_blank" rel="noreferrer">
          OpenHolidays API
        </a>{' '}
        (Lizenz ODbL). Sie werden pro Jahr geladen und auf diesem Gerät gespeichert.
      </p>
    </div>
  );
}
