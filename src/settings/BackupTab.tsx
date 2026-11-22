import { useRef, useState } from 'react';
import { useStore } from '../store';
import { exportConfig, readConfigFile } from '../lib/config';
import { storage } from '../lib/persisted';

export function BackupTab() {
  const { config, replaceConfig } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const cfg = await readConfigFile(f);
      if (
        !confirm(
          `Konfiguration mit ${cfg.members.length} Person(en) und ${cfg.calendars.length} Kalender(n) importieren? Die aktuelle Konfiguration wird ersetzt.`,
        )
      )
        return;
      replaceConfig(cfg);
      setMsg({ ok: true, text: 'Import erfolgreich.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="form narrow">
      <p>
        Die Konfiguration (Personen, Kalenderkonten, Zuordnungen, Einstellungen) wird nur auf diesem Gerät gespeichert. Mit Export/Import
        kannst du sie sichern oder z.&nbsp;B. vom Computer auf das iPad übertragen.
      </p>
      <p className="warn">
        Die Datei enthält die geheimen Abo-Links deiner Kalender. Wer sie hat, kann die Termine lesen – bitte nicht weitergeben.
      </p>
      <div className="row-actions">
        <button className="btn primary" onClick={() => exportConfig(config)}>
          Exportieren (.json)
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Importieren …
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
      </div>
      {msg && <p className={msg.ok ? 'success' : 'error'}>{msg.text}</p>}
      <hr />
      <button
        className="btn danger"
        onClick={() => {
          if (confirm('Alle Einstellungen, Personen, Kalender und zwischengespeicherten Termine auf diesem Gerät löschen?')) {
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
        Alles zurücksetzen
      </button>
    </div>
  );
}
