import { useCallback, useEffect, useState } from 'react';
import { getApps, isDefaultLauncher, launchApp, onAppsChanged, openAndroidSettings, type InstalledApp } from '../native/launcher';
import './apps.css';
import { t, locale } from '../i18n';

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
      .catch(() => setError(t('apps.loadFailed')));
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

  const q = query.trim().toLocaleLowerCase(locale());
  const shown = (apps ?? []).filter((a) => !q || a.label.toLocaleLowerCase(locale()).includes(q));

  return (
    <div className="view apps-view">
      {!isHome && (
        <div className="apps-banner">
          <span>{t('apps.notHome')}</span>
          <button className="btn primary" onClick={() => openAndroidSettings('home')}>
            {t('apps.setHome')}
          </button>
        </div>
      )}
      <div className="apps-bar">
        <input
          type="search"
          value={query}
          placeholder={t('apps.search')}
          onChange={(e) => setQuery(e.target.value)}
          enterKeyHint="search"
        />
        <button className="btn" onClick={() => openAndroidSettings()}>
          {t('apps.systemSettings')}
        </button>
      </div>
      {error && <p className="empty">{error}</p>}
      {!error && apps === null && <div className="module-loading" aria-busy="true" />}
      {!error && apps !== null && shown.length === 0 && <p className="empty">{t('apps.none')}</p>}
      <div className="apps-grid">
        {shown.map((app) => (
          <button
            key={`${app.packageName}/${app.activity}`}
            className="app-tile"
            onClick={() => launchApp(app).catch(() => setError(t('apps.startFailed', { name: app.label })))}
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
