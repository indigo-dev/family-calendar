import { useCallback, useEffect, useState } from 'react';
import { getApps, isDefaultLauncher, launchApp, onAppsChanged, openAndroidSettings, type InstalledApp } from '../native/launcher';
import './apps.css';

/**
 * Module "Apps" (only in the Android app): all installed apps to start, e.g. Netflix or Disney+.
 * The home button brings you back to HomeWally afterwards.
 */
export function AppsModule() {
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [isHome, setIsHome] = useState(true);

  const load = useCallback(() => {
    getApps()
      .then((list) => {
        setApps(list);
        setError('');
      })
      .catch(() => setError('Die App-Liste ließ sich nicht laden.'));
    isDefaultLauncher()
      .then(setIsHome)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const off = onAppsChanged(load);
    // back from the Android settings (home app chosen?): check again
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  const q = query.trim().toLocaleLowerCase('de');
  const shown = (apps ?? []).filter((a) => !q || a.label.toLocaleLowerCase('de').includes(q));

  return (
    <div className="view apps-view">
      {!isHome && (
        <div className="apps-banner">
          <span>HomeWally ist noch nicht die Startbildschirm-App. Dann führt die Home-Taste immer hierher.</span>
          <button className="btn primary" onClick={() => openAndroidSettings('home')}>
            Festlegen
          </button>
        </div>
      )}
      <div className="apps-bar">
        <input type="search" value={query} placeholder="App suchen…" onChange={(e) => setQuery(e.target.value)} enterKeyHint="search" />
        <button className="btn" onClick={() => openAndroidSettings()}>
          Android-Einstellungen
        </button>
      </div>
      {error && <p className="empty">{error}</p>}
      {!error && apps === null && <div className="module-loading" aria-busy="true" />}
      {!error && apps !== null && shown.length === 0 && <p className="empty">Keine App gefunden.</p>}
      <div className="apps-grid">
        {shown.map((app) => (
          <button
            key={`${app.packageName}/${app.activity}`}
            className="app-tile"
            onClick={() => launchApp(app).catch(() => setError(`„${app.label}“ ließ sich nicht starten.`))}
          >
            {app.icon ? (
              <img className="app-icon" src={app.icon} alt="" draggable={false} />
            ) : (
              <span className="app-icon app-icon-letter" aria-hidden>
                {app.label.slice(0, 1)}
              </span>
            )}
            <span className="app-label">{app.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
