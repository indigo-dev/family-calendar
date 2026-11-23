import { useRef, useState } from 'react';
import { useStore } from '../store';
import { exportConfig, readConfigFile } from '../lib/config';
import { storage } from '../lib/persisted';
import { t } from '../i18n';

export function BackupTab() {
  const { config, replaceConfig } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const cfg = await readConfigFile(f);
      const calendars = t('settings.backup.calendars', { n: cfg.calendars.length });
      if (!confirm(t('settings.backup.confirmImport', { n: cfg.members.length, calendars }))) return;
      replaceConfig(cfg);
      setMsg({ ok: true, text: t('settings.backup.imported') });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="form narrow">
      <p>{t('settings.backup.intro')}</p>
      <p className="warn">{t('settings.backup.warn')}</p>
      <div className="row-actions">
        <button className="btn primary" onClick={() => exportConfig(config)}>
          {t('settings.backup.export')}
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          {t('settings.backup.import')}
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
      </div>
      {msg && <p className={msg.ok ? 'success' : 'error'}>{msg.text}</p>}
      <hr />
      <button
        className="btn danger"
        onClick={() => {
          if (confirm(t('settings.backup.confirmReset'))) {
            // msal.* / login.*: leftovers of the former Microsoft sign-in on older installs
            storage
              .keys()
              .filter(
                (k) =>
                  k.startsWith('fc.') || k.startsWith('msal.') || k.includes('login.windows.net') || k.includes('login.microsoftonline'),
              )
              .forEach(storage.remove);
            window.location.reload();
          }
        }}
      >
        {t('settings.backup.resetAll')}
      </button>
    </div>
  );
}
