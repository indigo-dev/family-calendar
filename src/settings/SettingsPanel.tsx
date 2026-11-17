import { useEffect, useRef, useState } from 'react';
import type { Member, Settings, ViewMode } from '../types';
import { useStore } from '../store';
import {
  demoMembers,
  EMOJIS,
  exportConfig,
  imageFileToAvatar,
  newMember,
  PALETTE,
  readConfigFile,
} from '../lib/config';
import { forgetAccount, getToken, hasAccount, isAuthConfigured, loginMember, redirectUri } from '../lib/auth';
import { listCalendars, type GraphCalendar } from '../lib/graph';
import { Avatar } from '../components/Avatar';

type Tab = 'family' | 'outlook' | 'display' | 'backup';

export function SettingsPanel({ onClose, initialMemberId }: { onClose: () => void; initialMemberId?: string | null }) {
  const [tab, setTab] = useState<Tab>('family');
  return (
    <div className="modal-backdrop">
      <div className="modal settings" role="dialog" aria-modal="true">
        <div className="settings-head">
          <h2>Einstellungen</h2>
          <div className="segmented small">
            {(
              [
                ['family', 'Familie'],
                ['outlook', 'Outlook'],
                ['display', 'Anzeige'],
                ['backup', 'Sicherung'],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          <button className="btn primary" onClick={onClose}>
            Fertig
          </button>
        </div>
        <div className="settings-body">
          {tab === 'family' && <FamilyTab initialMemberId={initialMemberId} onGoOutlook={() => setTab('outlook')} />}
          {tab === 'outlook' && <OutlookTab />}
          {tab === 'display' && <DisplayTab />}
          {tab === 'backup' && <BackupTab />}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Familie */

function FamilyTab({ initialMemberId, onGoOutlook }: { initialMemberId?: string | null; onGoOutlook: () => void }) {
  const { members, upsertMember, replaceConfig, config } = useStore();
  const [selected, setSelected] = useState<string | null>(initialMemberId ?? members[0]?.id ?? null);
  const current = members.find((m) => m.id === selected) ?? null;

  const add = () => {
    const m = newMember(members);
    upsertMember(m);
    setSelected(m.id);
  };

  return (
    <div className="family">
      <aside className="member-list">
        {members.map((m) => (
          <button key={m.id} className={`member-row ${m.id === selected ? 'active' : ''}`} onClick={() => setSelected(m.id)}>
            <Avatar member={m} size={36} ring={false} />
            <span>
              {m.name}
              <small className="muted">
                {m.source === 'demo' ? 'Demo' : m.account ? m.account.username : 'nicht verbunden'}
              </small>
            </span>
          </button>
        ))}
        <button className="btn" onClick={add}>
          + Person hinzufügen
        </button>
        {members.length === 0 && (
          <button
            className="btn ghost"
            onClick={() => {
              const demo = demoMembers();
              replaceConfig({ ...config, members: demo });
              setSelected(demo[0].id);
            }}
          >
            Demo-Familie laden
          </button>
        )}
      </aside>
      <section className="member-edit">
        {current ? (
          <MemberEditor key={current.id} member={current} onGoOutlook={onGoOutlook} onDeleted={() => setSelected(null)} />
        ) : (
          <p className="muted">Lege ein Familienmitglied an oder wähle eines aus.</p>
        )}
      </section>
    </div>
  );
}

function MemberEditor({ member, onGoOutlook, onDeleted }: { member: Member; onGoOutlook: () => void; onDeleted: () => void }) {
  const { patchMember, removeMember, moveMember, settings } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Member>) => patchMember(member.id, patch);

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    try {
      const dataUrl = await imageFileToAvatar(f);
      set({ avatar: { type: 'image', dataUrl } });
    } catch (e) {
      setError(String(e));
    }
  };

  const connect = async (hint?: string) => {
    setError(null);
    setBusy(true);
    try {
      const acc = await loginMember(member.id, settings.loginMode, hint);
      if (acc) set({ account: acc });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (member.account) await forgetAccount(member.account);
    set({ account: undefined, calendars: [] });
  };

  const signedInHere = !!member.account && isAuthConfigured() && hasAccount(member.account.homeAccountId);

  return (
    <div className="form">
      <div className="member-preview">
        <Avatar member={member} size={72} />
        <div className="row-actions">
          <button className="icon-btn" onClick={() => moveMember(member.id, -1)} aria-label="Nach oben">
            ↑
          </button>
          <button className="icon-btn" onClick={() => moveMember(member.id, 1)} aria-label="Nach unten">
            ↓
          </button>
          <button
            className="btn danger"
            onClick={() => {
              if (confirm(`${member.name} wirklich entfernen?`)) {
                if (member.account) forgetAccount(member.account);
                removeMember(member.id);
                onDeleted();
              }
            }}
          >
            Entfernen
          </button>
        </div>
      </div>

      <label className="field">
        <span>Name</span>
        <input value={member.name} onChange={(e) => set({ name: e.target.value })} />
      </label>

      <div className="field">
        <span>Farbe</span>
        <div className="swatches">
          {PALETTE.map((c) => (
            <button
              key={c}
              className={`swatch ${member.color === c ? 'on' : ''}`}
              style={{ background: c }}
              onClick={() => set({ color: c })}
              aria-label={c}
            />
          ))}
          <label className="swatch custom" style={{ background: PALETTE.includes(member.color) ? undefined : member.color }}>
            <input type="color" value={member.color} onChange={(e) => set({ color: e.target.value })} />
            +
          </label>
        </div>
      </div>

      <div className="field">
        <span>Avatar</span>
        <div className="segmented small">
          <button className={member.avatar.type === 'initials' ? 'active' : ''} onClick={() => set({ avatar: { type: 'initials' } })}>
            Initialen
          </button>
          <button
            className={member.avatar.type === 'emoji' ? 'active' : ''}
            onClick={() => set({ avatar: { type: 'emoji', value: member.avatar.type === 'emoji' ? member.avatar.value : EMOJIS[0] } })}
          >
            Emoji
          </button>
          <button className={member.avatar.type === 'image' ? 'active' : ''} onClick={() => fileRef.current?.click()}>
            Foto
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
        {member.avatar.type === 'emoji' && (
          <div className="emoji-grid">
            {EMOJIS.map((em) => (
              <button
                key={em}
                className={member.avatar.type === 'emoji' && member.avatar.value === em ? 'on' : ''}
                onClick={() => set({ avatar: { type: 'emoji', value: em } })}
              >
                {em}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <span>Kalenderquelle</span>
        <div className="segmented small">
          <button className={member.source === 'outlook' ? 'active' : ''} onClick={() => set({ source: 'outlook' })}>
            Outlook
          </button>
          <button className={member.source === 'demo' ? 'active' : ''} onClick={() => set({ source: 'demo' })}>
            Demo-Daten
          </button>
        </div>
      </div>

      {member.source === 'outlook' && (
        <div className="field">
          <span>Microsoft-Konto</span>
          {!settings.clientId ? (
            <p className="hint">
              Zuerst die Client-ID der App-Registrierung eintragen.{' '}
              <button className="link" onClick={onGoOutlook}>
                Zu den Outlook-Einstellungen
              </button>
            </p>
          ) : member.account ? (
            <div className="account-box">
              <div>
                <strong>{member.account.name ?? member.account.username}</strong>
                <div className="muted small">{member.account.username}</div>
                {!signedInHere && <div className="warn small">Auf diesem Gerät nicht (mehr) angemeldet.</div>}
              </div>
              <div className="row-actions">
                {!signedInHere && (
                  <button className="btn primary" disabled={busy} onClick={() => connect(member.account?.username)}>
                    Erneut anmelden
                  </button>
                )}
                <button className="btn" onClick={disconnect}>
                  Trennen
                </button>
              </div>
            </div>
          ) : (
            <button className="btn primary" disabled={busy} onClick={() => connect()}>
              Mit Outlook verbinden
            </button>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {member.source === 'outlook' && member.account && signedInHere && <CalendarPicker member={member} />}
      {member.source === 'outlook' && member.account && !signedInHere && member.calendars.length > 0 && (
        <p className="muted small">Gewählte Kalender: {member.calendars.map((c) => c.name).join(', ')}</p>
      )}
    </div>
  );
}

function CalendarPicker({ member }: { member: Member }) {
  const { patchMember } = useStore();
  const [cals, setCals] = useState<GraphCalendar[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await getToken(member.account!);
        const list = await listCalendars(token);
        if (!alive) return;
        setCals(list);
        // first time: preselect the default calendar
        if (member.calendars.length === 0) {
          const def = list.find((c) => c.isDefaultCalendar) ?? list[0];
          if (def) patchMember(member.id, { calendars: [{ id: def.id, name: def.name }] });
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.account?.homeAccountId]);

  const toggle = (c: GraphCalendar) => {
    const on = member.calendars.some((x) => x.id === c.id);
    patchMember(member.id, {
      calendars: on ? member.calendars.filter((x) => x.id !== c.id) : [...member.calendars, { id: c.id, name: c.name }],
    });
  };

  return (
    <div className="field">
      <span>Angezeigte Kalender</span>
      {error && <p className="error">{error}</p>}
      {!cals && !error && <p className="muted">Kalender werden geladen …</p>}
      {cals && (
        <div className="checklist">
          {cals.map((c) => (
            <label key={c.id} className="check">
              <input type="checkbox" checked={member.calendars.some((x) => x.id === c.id)} onChange={() => toggle(c)} />
              <span>
                {c.name}
                {c.owner?.address && c.owner.address !== member.account?.username && (
                  <small className="muted"> · geteilt von {c.owner.name ?? c.owner.address}</small>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Outlook */

function OutlookTab() {
  const { settings, updateSettings } = useStore();
  const [clientId, setClientId] = useState(settings.clientId);
  const [authority, setAuthority] = useState(settings.authority);
  const dirty = clientId.trim() !== settings.clientId || authority !== settings.authority;
  const uri = redirectUri();

  return (
    <div className="form narrow">
      <p>
        Für die Outlook-Anbindung braucht die App eine (kostenlose) App-Registrierung in Microsoft Entra ID. Die Schritte stehen
        in der README. Es wird nur <strong>Lesezugriff</strong> (Calendars.Read) angefragt; Tokens bleiben auf diesem Gerät.
      </p>
      <label className="field">
        <span>Anwendungs-ID (Client-ID)</span>
        <input
          value={clientId}
          placeholder="00000000-0000-0000-0000-000000000000"
          onChange={(e) => setClientId(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <label className="field">
        <span>Kontotyp</span>
        <select value={authority} onChange={(e) => setAuthority(e.target.value as Settings['authority'])}>
          <option value="common">Privat (outlook.com/live.com) und Arbeit/Schule</option>
          <option value="consumers">Nur private Microsoft-Konten</option>
          <option value="organizations">Nur Arbeits-/Schulkonten</option>
        </select>
      </label>
      <label className="field">
        <span>Anmeldeart</span>
        <select value={settings.loginMode} onChange={(e) => updateSettings({ loginMode: e.target.value as Settings['loginMode'] })}>
          <option value="redirect">Weiterleitung (empfohlen für iPad / Homescreen-App)</option>
          <option value="popup">Popup-Fenster</option>
        </select>
      </label>
      <div className="field">
        <span>Redirect-URI (in Azure als „Single-page application“ eintragen)</span>
        <div className="copy-row">
          <code>{uri}</code>
          <button className="btn" onClick={() => navigator.clipboard?.writeText(uri)}>
            Kopieren
          </button>
        </div>
      </div>
      <button
        className="btn primary"
        disabled={!dirty}
        onClick={() => {
          updateSettings({ clientId: clientId.trim(), authority });
          // MSAL is initialised once at start-up – reload to apply.
          setTimeout(() => window.location.reload(), 100);
        }}
      >
        Speichern & neu laden
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- Anzeige */

function DisplayTab() {
  const { settings, updateSettings } = useStore();
  const hours = Array.from({ length: 25 }, (_, i) => i);
  const views: [ViewMode, string][] = [
    ['day', 'Tag'],
    ['week', 'Woche'],
    ['month', 'Monat'],
    ['year', 'Jahr'],
    ['agenda', 'Agenda'],
  ];
  return (
    <div className="form narrow">
      <label className="field">
        <span>Startansicht</span>
        <select value={settings.defaultView} onChange={(e) => updateSettings({ defaultView: e.target.value as ViewMode })}>
          {views.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Woche beginnt am</span>
        <select value={settings.weekStartsOn} onChange={(e) => updateSettings({ weekStartsOn: Number(e.target.value) as 0 | 1 })}>
          <option value={1}>Montag</option>
          <option value={0}>Sonntag</option>
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span>Tag beginnt um</span>
          <select value={settings.dayStartHour} onChange={(e) => updateSettings({ dayStartHour: Number(e.target.value) })}>
            {hours.slice(0, 23).map((h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tag endet um</span>
          <select value={settings.dayEndHour} onChange={(e) => updateSettings({ dayEndHour: Number(e.target.value) })}>
            {hours.slice(settings.dayStartHour + 1).map((h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Design</span>
        <select value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as Settings['theme'] })}>
          <option value="auto">Automatisch (System)</option>
          <option value="light">Hell</option>
          <option value="dark">Dunkel</option>
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span>Aktualisieren alle (Min.)</span>
          <input
            type="number"
            min={1}
            max={120}
            value={settings.refreshMinutes}
            onChange={(e) => updateSettings({ refreshMinutes: Math.max(1, Number(e.target.value) || 5) })}
          />
        </label>
        <label className="field">
          <span>Zurück zu „Heute“ nach (Min., 0 = aus)</span>
          <input
            type="number"
            min={0}
            max={120}
            value={settings.idleResetMinutes}
            onChange={(e) => updateSettings({ idleResetMinutes: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={settings.keepAwake} onChange={(e) => updateSettings({ keepAwake: e.target.checked })} />
        <span>Bildschirm wach halten</span>
      </label>
    </div>
  );
}

/* ---------------------------------------------------------------- Sicherung */

function BackupTab() {
  const { config, replaceConfig } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const cfg = await readConfigFile(f);
      if (!confirm(`Konfiguration mit ${cfg.members.length} Person(en) importieren? Die aktuelle Konfiguration wird ersetzt.`)) return;
      const clientChanged = cfg.settings.clientId !== config.settings.clientId;
      replaceConfig(cfg);
      setMsg({ ok: true, text: 'Import erfolgreich.' + (clientChanged ? ' Die App wird neu geladen.' : '') });
      if (clientChanged) setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="form narrow">
      <p>
        Die Konfiguration (Personen, Farben, Avatare, gewählte Kalender, Einstellungen) wird nur auf diesem Gerät gespeichert. Mit
        Export/Import kannst du sie sichern oder auf ein anderes Gerät übertragen. Anmeldungen (Tokens) werden <em>nicht</em>{' '}
        exportiert – nach einem Import auf einem neuen Gerät meldet sich jede Person einmal neu an.
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
          if (confirm('Alle Einstellungen, Personen und zwischengespeicherten Termine auf diesem Gerät löschen?')) {
            Object.keys(localStorage)
              .filter((k) => k.startsWith('fc.') || k.startsWith('msal.') || k.includes('login.windows.net') || k.includes('login.microsoftonline'))
              .forEach((k) => localStorage.removeItem(k));
            window.location.reload();
          }
        }}
      >
        Alles zurücksetzen
      </button>
    </div>
  );
}
