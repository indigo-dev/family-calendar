import { useEffect, useState } from 'react';
import { SchoolTab } from './SchoolTab';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { FamilyTab } from './FamilyTab';
import { CalendarsTab } from './CalendarsTab';
import { HolidaysTab } from './HolidaysTab';
import { DesignTab } from './DesignTab';
import { ViewTab } from './ViewTab';
import { DeviceTab } from './DeviceTab';
import { BackupTab } from './BackupTab';

export type SettingsTab = 'family' | 'calendars' | 'holidays' | 'school' | 'design' | 'view' | 'device' | 'backup';
type Tab = SettingsTab;

/** order: set up the family and its data first, then the look, the device and the backup */
const TABS: { id: Tab; icon: string; label: string; note: string }[] = [
  { id: 'family', icon: '👨‍👩‍👧', label: 'Familie', note: 'Personen, Farben und Avatare' },
  { id: 'calendars', icon: '📅', label: 'Kalender', note: 'Abo-Links und Zuordnung zu Personen' },
  { id: 'holidays', icon: '🏖️', label: 'Ferien & Feiertage', note: 'Bundesland, Feiertage, Schulferien' },
  { id: 'school', icon: '🎒', label: 'Schule', note: 'Klingelzeiten und Fächer' },
  { id: 'design', icon: '🎨', label: 'Design', note: 'Stil, Hell/Dunkel, Farben, Symbole' },
  { id: 'view', icon: '🗓️', label: 'Kalenderansicht', note: 'Startansicht, Wochenbeginn, Tageszeiten' },
  { id: 'device', icon: '📱', label: 'Gerät', note: 'Aktualisierung, Ruhezustand' },
  { id: 'backup', icon: '💾', label: 'Sicherung', note: 'Export, Import, Zurücksetzen' },
];

export function SettingsPanel({ onClose, initialTab }: { onClose: () => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'family');
  const info = TABS.find((t) => t.id === tab)!;
  // on phones the categories scroll sideways – keep the active one visible
  useEffect(() => {
    document.querySelector('.settings-nav-item.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [tab]);
  return (
    <div className="modal-backdrop">
      <div className="modal settings" role="dialog" aria-modal="true" aria-label="Einstellungen">
        <nav className="settings-nav" aria-label="Bereiche">
          <h2>Einstellungen</h2>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`settings-nav-item ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id}
            >
              <span className="settings-nav-icon" aria-hidden>
                {t.icon}
              </span>
              <span className="settings-nav-label">{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="settings-main">
          <div className="settings-head">
            <div className="settings-title">
              <h3>{info.label}</h3>
              <span className="muted">{info.note}</span>
            </div>
            <button className="btn primary" onClick={onClose}>
              Fertig
            </button>
          </div>
          <div className="settings-body" key={tab}>
            <ErrorBoundary label={info.label} resetKey={tab} retrySec={0}>
              {tab === 'family' && <FamilyTab onGoCalendars={() => setTab('calendars')} />}
              {tab === 'calendars' && <CalendarsTab />}
              {tab === 'holidays' && <HolidaysTab />}
              {tab === 'school' && <SchoolTab />}
              {tab === 'design' && <DesignTab />}
              {tab === 'view' && <ViewTab />}
              {tab === 'device' && <DeviceTab />}
              {tab === 'backup' && <BackupTab />}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
