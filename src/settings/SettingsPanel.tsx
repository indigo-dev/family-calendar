import { useEffect, useState } from 'react';
import { SchoolTab } from './SchoolTab';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Modal } from '../components/Modal';
import { FamilyTab } from './FamilyTab';
import { CalendarsTab } from './CalendarsTab';
import { HolidaysTab } from './HolidaysTab';
import { DesignTab } from './DesignTab';
import { ViewTab } from './ViewTab';
import { DeviceTab } from './DeviceTab';
import { VoiceTab } from './VoiceTab';
import { BackupTab } from './BackupTab';
import { t } from '../i18n';

export type SettingsTab = 'family' | 'calendars' | 'holidays' | 'school' | 'design' | 'view' | 'device' | 'voice' | 'backup';
type Tab = SettingsTab;

/** order: set up the family and its data first, then the look, the device and the backup */
const TABS: { id: Tab; icon: string }[] = [
  { id: 'family', icon: '👨‍👩‍👧' },
  { id: 'calendars', icon: '📅' },
  { id: 'holidays', icon: '🏖️' },
  { id: 'school', icon: '🎒' },
  { id: 'design', icon: '🎨' },
  { id: 'view', icon: '🗓️' },
  { id: 'device', icon: '📱' },
  { id: 'voice', icon: '🎙️' },
  { id: 'backup', icon: '💾' },
];

export function SettingsPanel({ onClose, initialTab }: { onClose: () => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'family');
  const info = { label: t(`settings.tabs.${tab}`), note: t(`settings.notes.${tab}`) };
  // on phones the categories scroll sideways – keep the active one visible
  useEffect(() => {
    document.querySelector('.settings-nav-item.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [tab]);
  return (
    <Modal onClose={onClose} label={t('settings.title')} dismissible={false}>
      <div className="modal settings">
        <nav className="settings-nav" aria-label={t('app.sections')}>
          <h2>{t('settings.title')}</h2>
          {TABS.map((x) => (
            <button
              key={x.id}
              className={`settings-nav-item ${tab === x.id ? 'active' : ''}`}
              onClick={() => setTab(x.id)}
              aria-current={tab === x.id}
            >
              <span className="settings-nav-icon" aria-hidden>
                {x.icon}
              </span>
              <span className="settings-nav-label">{t(`settings.tabs.${x.id}`)}</span>
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
              {t('common.done')}
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
              {tab === 'voice' && <VoiceTab />}
              {tab === 'backup' && <BackupTab />}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </Modal>
  );
}
