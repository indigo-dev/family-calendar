import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { getApps, type InstalledApp } from '../native/launcher';
import { t, locale } from '../i18n';
import './apps.css';

/** Chooses an installed Android app, e.g. for a dashboard app tile. */
export function AppPicker({ onPick, onClose }: { onPick: (app: InstalledApp) => void; onClose: () => void }) {
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    getApps()
      .then(setApps)
      .catch(() => setError(t('apps.loadFailed')));
  }, []);

  const q = query.trim().toLocaleLowerCase(locale());
  const shown = (apps ?? []).filter((a) => !q || a.label.toLocaleLowerCase(locale()).includes(q));

  return (
    <Modal onClose={onClose} layerClass="dash-gallery-backdrop" label={t('apps.pickTitle')}>
      <div className="dash-gallery app-picker">
        <div className="dash-gallery-head">
          <h2>{t('apps.pickTitle')}</h2>
          <button className="btn" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
        <div className="apps-bar">
          <input
            type="search"
            value={query}
            placeholder={t('apps.search')}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
          />
        </div>
        <p className="help app-picker-hint">{t('apps.pickHint')}</p>
        <div className="app-picker-list">
          {error && <p className="empty">{error}</p>}
          {!error && apps === null && <div className="module-loading" aria-busy="true" />}
          {!error && apps !== null && shown.length === 0 && <p className="empty">{t('apps.none')}</p>}
          <div className="apps-grid">
            {shown.map((app) => (
              <button key={`${app.packageName}/${app.activity}`} className="app-tile" onClick={() => onPick(app)}>
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
      </div>
    </Modal>
  );
}
