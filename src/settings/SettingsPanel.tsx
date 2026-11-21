import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CalendarSource, Member, Settings, ViewMode } from '../types';
import { useStore } from '../store';
import {
  demoMembers,
  EMOJIS,
  exportConfig,
  imageFileToAvatar,
  LINK_HELP,
  newCalendar,
  newMember,
  readConfigFile,
  REGIONS,
  UI_STYLES,
} from '../lib/config';
import { normalizeIcsUrl, testCalendarLink } from '../lib/events';
import { loadHolidays, type Holiday } from '../lib/holidays';
import { fmt } from '../lib/dates';
import { Avatar } from '../components/Avatar';
import { newTimetable, SCHOOL_TYPES } from '../lib/school';
import { SchoolTab } from './SchoolTab';
import { Sym } from '../components/Sym';
import { SYMBOL_SETS, type SymbolSet } from '../lib/symbols';
import { CORE_SUGGESTIONS, PALETTE, PALETTES, paletteColors } from '../lib/colors';

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
            <button key={t.id} className={`settings-nav-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)} aria-current={tab === t.id}>
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
            {tab === 'family' && <FamilyTab onGoCalendars={() => setTab('calendars')} />}
            {tab === 'calendars' && <CalendarsTab />}
            {tab === 'holidays' && <HolidaysTab />}
            {tab === 'school' && <SchoolTab />}
            {tab === 'design' && <DesignTab />}
            {tab === 'view' && <ViewTab />}
            {tab === 'device' && <DeviceTab />}
            {tab === 'backup' && <BackupTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- building blocks */

function Group({ title, note, children }: { title?: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="set-group">
      {title && <h4 className="set-group-title">{title}</h4>}
      {children}
      {note && <p className="set-note">{note}</p>}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="set-row">
      <div className="set-row-label">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="set-row-ctrl">{children}</div>
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="switch-track" aria-hidden />
    </label>
  );
}

function Stepper({ value, min, max, unit, onChange }: { value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="weniger">
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
      />
      <span className="stepper-unit">{unit}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="mehr">
        +
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- Familie */

function FamilyTab({ onGoCalendars }: { onGoCalendars: () => void }) {
  const { members, calendars, upsertMember, replaceConfig, config } = useStore();
  const [selected, setSelected] = useState<string | null>(members[0]?.id ?? null);
  const current = members.find((m) => m.id === selected) ?? null;

  const add = () => {
    const m = newMember(members);
    upsertMember(m);
    setSelected(m.id);
  };

  const subtitle = (m: Member) => {
    const n = calendars.filter((c) => c.memberIds.includes(m.id)).length;
    const parts = [n === 0 ? 'keine Kalender' : n === 1 ? '1 Kalender' : `${n} Kalender`];
    if (m.demo) parts.push('Demo');
    return parts.join(' · ');
  };

  return (
    <div className="family">
      <aside className="member-list">
        {members.map((m) => (
          <button key={m.id} className={`member-row ${m.id === selected ? 'active' : ''}`} onClick={() => setSelected(m.id)}>
            <Avatar member={m} size={36} ring={false} />
            <span>
              {m.name}
              <small className="muted">{subtitle(m)}</small>
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
          <MemberEditor key={current.id} member={current} onGoCalendars={onGoCalendars} onDeleted={() => setSelected(null)} />
        ) : (
          <p className="muted">Lege ein Familienmitglied an oder wähle eines aus.</p>
        )}
      </section>
    </div>
  );
}

function MemberEditor({ member, onGoCalendars, onDeleted }: { member: Member; onGoCalendars: () => void; onDeleted: () => void }) {
  const { patchMember, removeMember, moveMember, calendars, config, settings } = useStore();
  // `member` is drawn in the chosen palette; the swatches edit the stored colour
  const rawColor = config.members.find((m) => m.id === member.id)?.color ?? member.color;
  const shown = paletteColors();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Member>) => patchMember(member.id, patch);
  const mine = calendars.filter((c) => c.memberIds.includes(member.id));

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    try {
      const dataUrl = await imageFileToAvatar(f);
      set({ avatar: { type: 'image', dataUrl } });
    } catch (e) {
      setError(String(e));
    }
  };

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
              if (confirm(`${member.name} wirklich entfernen?\n\nDie Kalender bleiben erhalten und können neu zugeordnet werden.`)) {
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
          {PALETTE.map((c, i) => (
            <button
              key={c}
              className={`swatch ${rawColor === c ? 'on' : ''}`}
              style={{ background: shown[i] }}
              onClick={() => set({ color: c })}
              aria-label={`Farbe ${i + 1}`}
            />
          ))}
          <label
            className={`swatch custom ${PALETTE.includes(rawColor) ? '' : 'on'}`}
            style={{ background: PALETTE.includes(rawColor) ? undefined : member.color }}
            title="Eigene Farbe"
          >
            <input type="color" value={rawColor} onChange={(e) => set({ color: e.target.value })} />+
          </label>
        </div>
        {settings.palette !== 'vivid' && !PALETTE.includes(rawColor) && (
          <p className="hint muted">Eigene Farben werden an die gewählte Farbpalette angepasst (Einstellungen → Design).</p>
        )}
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
        {error && <p className="error">{error}</p>}
      </div>

      <div className="field">
        <span>Kalender</span>
        {mine.length === 0 ? (
          <p className="hint muted">Dieser Person ist noch kein Kalender zugeordnet.</p>
        ) : (
          <div className="chip-list">
            {mine.map((c) => (
              <span key={c.id} className="chip static">
                {c.name}
              </span>
            ))}
          </div>
        )}
        <div>
          <button className="btn" onClick={onGoCalendars}>
            Kalender zuordnen …
          </button>
        </div>
      </div>

      <div className="field">
        <span>Schule</span>
        <label className="check">
          <input
            type="checkbox"
            checked={!!member.timetable}
            onChange={(e) => {
              if (e.target.checked) set({ timetable: newTimetable('grundschule') });
              else if (confirm(`Stundenplan von ${member.name} löschen?`)) set({ timetable: undefined });
            }}
          />
          <span>Hat Stundenplan</span>
        </label>
        {member.timetable && (
          <div className="segmented small">
            {(Object.keys(SCHOOL_TYPES) as (keyof typeof SCHOOL_TYPES)[]).map((t) => (
              <button
                key={t}
                className={member.timetable?.schoolType === t ? 'active' : ''}
                onClick={() => set({ timetable: { ...member.timetable!, schoolType: t } })}
              >
                {SCHOOL_TYPES[t]}
              </button>
            ))}
          </div>
        )}
        {member.timetable && (
          <p className="hint muted">Fächer trägst du im Stundenplan über „Bearbeiten“ ein, Klingelzeiten unter „Schule“.</p>
        )}
      </div>

      <label className="check">
        <input type="checkbox" checked={!!member.demo} onChange={(e) => set({ demo: e.target.checked || undefined })} />
        <span>Beispieltermine anzeigen (Demo)</span>
      </label>
    </div>
  );
}

/* ---------------------------------------------------------------- Kalender */

type TestState = { busy: true } | { busy: false; ok: true; text: string } | { busy: false; ok: false; text: string };

function CalendarsTab() {
  const { calendars, settings, updateSettings } = useStore();
  const [proxy, setProxy] = useState(settings.proxyUrl);
  const [proxyTest, setProxyTest] = useState<TestState | null>(null);

  const saveProxy = async () => {
    const url = proxy.trim().replace(/\/+$/, '');
    setProxy(url);
    updateSettings({ proxyUrl: url });
    if (!url) return setProxyTest(null);
    setProxyTest({ busy: true });
    try {
      const res = await fetch(url + '/', { cache: 'no-store' });
      const text = await res.text();
      setProxyTest(
        res.ok && text.includes('Familienkalender')
          ? { busy: false, ok: true, text: 'Weiterleitung erreichbar.' }
          : { busy: false, ok: false, text: `Unerwartete Antwort (${res.status}). Ist das die Worker-Adresse?` },
      );
    } catch {
      setProxyTest({ busy: false, ok: false, text: 'Nicht erreichbar. Adresse prüfen (https://…workers.dev).' });
    }
  };

  return (
    <div className="form">
      <div className="field">
        <span>Weiterleitung (Cloudflare Worker)</span>
        <div className="copy-row">
          <input
            style={{ flex: 1, minHeight: 44, border: '1px solid var(--line-strong)', borderRadius: 10, padding: '0 12px' }}
            value={proxy}
            placeholder="https://familienkalender-ics.NAME.workers.dev"
            onChange={(e) => setProxy(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="btn primary" onClick={saveProxy} disabled={proxyTest?.busy}>
            Speichern & testen
          </button>
        </div>
        {proxyTest && !proxyTest.busy && <p className={proxyTest.ok ? 'success' : 'error'}>{proxyTest.text}</p>}
        {!settings.proxyUrl && (
          <p className="help">Ohne Weiterleitung kann die App die Kalender-Links nicht laden (Google und Microsoft blockieren direkte Zugriffe aus dem Browser).</p>
        )}
      </div>

      <p className="help">
        Tippe bei einem Kalender auf die Personen, denen er gehört – ein gemeinsamer Familienkalender kann mehreren Personen
        gehören. Kalender ohne Person werden nicht angezeigt.
      </p>

      <div className="cal-account">
        <div className="cal-account-head">
          <strong>Abonnierte Kalender</strong>
        </div>
        {calendars.map((c) => (
          <CalendarRow key={c.id} cal={c} />
        ))}
        {calendars.length === 0 && <p className="muted cal-empty">Noch keine Kalender. Füge unten den ersten hinzu.</p>}
        <AddCalendar />
      </div>
    </div>
  );
}

function AddCalendar() {
  const { calendars, upsertCalendar, members, settings } = useStore();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState<TestState | null>(null);
  const [showHelp, setShowHelp] = useState(() => calendars.length === 0);

  const add = async (force = false) => {
    const link = url.trim();
    if (!/^(https?|webcals?):\/\//i.test(link)) {
      setAdding({ busy: false, ok: false, text: 'Bitte den vollständigen Link einfügen (beginnt mit https:// oder webcal://).' });
      return;
    }
    let calName = name.trim();
    if (!force) {
      setAdding({ busy: true });
      try {
        const res = await testCalendarLink(settings.proxyUrl, link);
        calName ||= res.name ?? '';
      } catch (e) {
        setAdding({ busy: false, ok: false, text: e instanceof Error ? e.message : String(e) });
        return;
      }
    }
    // preselect nobody, but if exactly one person exists, assign it
    upsertCalendar(newCalendar(calName || 'Kalender', link, members.length === 1 ? [members[0].id] : []));
    setName('');
    setUrl('');
    setAdding(null);
    setShowHelp(false);
  };

  return (
    <div className="add-box">
      <div className="row-actions" style={{ justifyContent: 'space-between' }}>
        <strong>Kalender hinzufügen</strong>
        <button className="link" onClick={() => setShowHelp((v) => !v)}>
          {showHelp ? 'Hilfe ausblenden' : 'Wo finde ich den Link?'}
        </button>
      </div>
      {showHelp && (
        <dl className="help link-help">
          {Object.values(LINK_HELP).map((h) => (
            <div key={h.label}>
              <dt>
                {h.icon} {h.label}
              </dt>
              <dd>{h.help}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="field-row">
        <label className="field">
          <span>Name (optional)</span>
          <input value={name} placeholder="z. B. Papa Arbeit" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Abo-Link (ICS)</span>
          <input
            value={url}
            placeholder="https://…/basic.ics"
            onChange={(e) => setUrl(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
      </div>
      <div className="row-actions">
        <button className="btn primary" disabled={!url.trim() || adding?.busy} onClick={() => add()}>
          {adding?.busy ? 'Prüfe …' : 'Prüfen & hinzufügen'}
        </button>
        {adding && !adding.busy && !adding.ok && (
          <>
            <span className="error">{adding.text}</span>
            {/^(https?|webcals?):\/\//i.test(url.trim()) && (
              <button className="btn" onClick={() => add(true)}>
                Trotzdem hinzufügen
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CalendarRow({ cal }: { cal: CalendarSource }) {
  const { members, patchCalendar, removeCalendar, toggleCalendarMember, settings } = useStore();
  const [test, setTest] = useState<TestState | null>(null);

  const run = async () => {
    setTest({ busy: true });
    try {
      const res = await testCalendarLink(settings.proxyUrl, cal.url);
      setTest({ busy: false, ok: true, text: `OK · ${res.upcoming} Termine in den nächsten 60 Tagen` });
    } catch (e) {
      setTest({ busy: false, ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  let host = '';
  try {
    host = new URL(normalizeIcsUrl(cal.url)).hostname;
  } catch {
    host = 'ungültiger Link';
  }

  return (
    <div className={`cal-row ${cal.enabled ? '' : 'disabled'}`}>
      <input
        type="checkbox"
        checked={cal.enabled}
        onChange={(e) => patchCalendar(cal.id, { enabled: e.target.checked })}
        aria-label="Kalender anzeigen"
        style={{ width: 22, height: 22, accentColor: 'var(--accent)' }}
      />
      <div className="cal-name">
        <input value={cal.name} onChange={(e) => patchCalendar(cal.id, { name: e.target.value })} aria-label="Kalendername" />
        <span className="cal-url" title={host}>
          {host}
        </span>
        <span className="row-actions">
          {cal.memberIds.length === 0 && <span className="badge warn">keiner Person zugeordnet</span>}
          {test?.busy && <span className="badge">prüfe …</span>}
          {test && !test.busy && <span className={`badge ${test.ok ? 'ok' : 'err'}`}>{test.text}</span>}
        </span>
      </div>
      <div className="assign" aria-label="Personen">
        {members.map((m) => {
          const on = cal.memberIds.includes(m.id);
          return (
            <button
              key={m.id}
              className={`assign-btn ${on ? 'on' : ''}`}
              aria-pressed={on}
              title={`${m.name} ${on ? 'entfernen' : 'zuordnen'}`}
              onClick={() => toggleCalendarMember(cal.id, m.id)}
            >
              <Avatar member={m} size={34} ring={on} />
            </button>
          );
        })}
        {members.length === 0 && <span className="muted small">Erst Personen anlegen</span>}
      </div>
      <div className="row-actions">
        <button className="btn" onClick={run} disabled={test?.busy}>
          Testen
        </button>
        <button className="btn danger" onClick={() => confirm(`Kalender „${cal.name}“ entfernen?`) && removeCalendar(cal.id)}>
          ✕
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Ferien & Feiertage */

function HolidaysTab() {
  const { settings, updateSettings } = useStore();
  const h = settings.holidays;
  const set = (patch: Partial<typeof h>) => updateSettings({ holidays: { ...h, ...patch } });
  const [preview, setPreview] = useState<{ list?: Holiday[]; error?: string }>({});

  useEffect(() => {
    if (!h.region) return setPreview({});
    let alive = true;
    const y = new Date().getFullYear();
    setPreview({});
    loadHolidays(h.region, [y, y + 1])
      .then((list) => alive && setPreview({ list }))
      .catch((e) => alive && setPreview({ error: e instanceof Error ? e.message : String(e) }));
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

function FragmentRow({ dt, dd }: { dt: string; dd: string }) {
  return (
    <>
      <dt>{dt}</dt>
      <dd>{dd}</dd>
    </>
  );
}

/* ---------------------------------------------------------------- Design */

const STYLE_NOTES: Record<Settings['style'], string> = {
  classic: 'Schlicht und klar',
  sonoma: 'Wie der Mac-Kalender',
  liquid: 'Glas wie iOS 26',
  flow: 'Technisch, Punktraster',
  aurora: 'Farbverläufe, Leuchten',
  n8n: 'Knoten auf Punktraster',
  stately: 'Zustände und Übergänge',
  braun: 'Weniger, aber besser',
};

function DesignTab() {
  const { settings, updateSettings } = useStore();
  return (
    <div className="form">
      <Group title="Stil">
        <div className="pick-grid" role="radiogroup" aria-label="Stil">
          {UI_STYLES.map((s) => (
            <button
              key={s.id}
              role="radio"
              aria-checked={settings.style === s.id}
              className={`pick-card ${settings.style === s.id ? 'on' : ''}`}
              onClick={() => updateSettings({ style: s.id })}
            >
              <span className={`style-thumb st-${s.id}`} aria-hidden>
                <i className="st-bar" />
                <i className="st-a" />
                <i className="st-b" />
                <i className="st-c" />
              </span>
              <span className="pick-label">{s.label}</span>
              <span className="pick-note">{STYLE_NOTES[s.id]}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group title="Hell / Dunkel">
        <div className="pick-grid three" role="radiogroup" aria-label="Hell / Dunkel">
          {(
            [
              ['auto', 'Automatisch', 'folgt dem Gerät'],
              ['light', 'Hell', 'immer hell'],
              ['dark', 'Dunkel', 'immer dunkel'],
            ] as [Settings['theme'], string, string][]
          ).map(([id, label, note]) => (
            <button
              key={id}
              role="radio"
              aria-checked={settings.theme === id}
              className={`pick-card ${settings.theme === id ? 'on' : ''}`}
              onClick={() => updateSettings({ theme: id })}
            >
              <span className={`mode-thumb mode-${id}`} aria-hidden>
                <i />
                <i />
              </span>
              <span className="pick-label">{label}</span>
              <span className="pick-note">{note}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group
        title="Farben"
        note="Gilt für Personen, Schulfächer und Abteilungen der Einkaufsliste. Die gewählten Farben bleiben gespeichert – es ändert sich nur die Darstellung."
      >
        <div className="pick-grid three" role="radiogroup" aria-label="Farbpalette">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              role="radio"
              aria-checked={settings.palette === p.id}
              className={`pick-card ${settings.palette === p.id ? 'on' : ''}`}
              onClick={() => updateSettings({ palette: p.id })}
            >
              <span className="palette-thumb" aria-hidden>
                {paletteColors(p.id, settings.coreColor)
                  .slice(0, 6)
                  .map((c, i) => (
                    <i key={i} style={{ background: c }} />
                  ))}
              </span>
              <span className="pick-label">{p.label}</span>
              <span className="pick-note">{p.note}</span>
            </button>
          ))}
        </div>
        {settings.palette === 'core' && (
          <div className="set-card">
            <Row label="Kernfarbe" hint="Daraus entstehen alle anderen Farben">
              <div className="swatches">
                {CORE_SUGGESTIONS.map((c) => (
                  <button
                    key={c}
                    className={`swatch ${settings.coreColor.toLowerCase() === c ? 'on' : ''}`}
                    style={{ background: c }}
                    onClick={() => updateSettings({ coreColor: c })}
                    aria-label={c}
                  />
                ))}
                <label
                  className={`swatch custom ${CORE_SUGGESTIONS.includes(settings.coreColor.toLowerCase()) ? '' : 'on'}`}
                  style={{ background: CORE_SUGGESTIONS.includes(settings.coreColor.toLowerCase()) ? undefined : settings.coreColor }}
                  title="Eigene Farbe"
                >
                  <input type="color" value={settings.coreColor} onChange={(e) => updateSettings({ coreColor: e.target.value })} />+
                </label>
              </div>
            </Row>
            <div className="core-strip" aria-label="Erzeugte Farben">
              {paletteColors('core', settings.coreColor).map((c, i) => (
                <i key={i} style={{ background: c }} />
              ))}
            </div>
          </div>
        )}
      </Group>

      <Group title="Symbole (Einkaufsliste)">
        <SymbolPicker value={settings.symbols} onChange={(symbols) => updateSettings({ symbols })} />
      </Group>
    </div>
  );
}

/* ---------------------------------------------------------------- Kalenderansicht */

function ViewTab() {
  const { settings, updateSettings } = useStore();
  const hours = Array.from({ length: 25 }, (_, i) => i);
  const views: [ViewMode, string][] = [
    ['day', 'Tag'],
    ['days', `${settings.multiDays} Tage`],
    ['week', 'Woche'],
    ['month', 'Monat'],
    ['year', 'Jahr'],
    ['agenda', 'Agenda'],
  ];
  return (
    <div className="form">
      <Group>
        <div className="set-card">
          <Row label="Startansicht" hint="So öffnet sich der Kalender">
            <select value={settings.defaultView} onChange={(e) => updateSettings({ defaultView: e.target.value as ViewMode })}>
              {views.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Woche beginnt am">
            <div className="segmented">
              {(
                [
                  [1, 'Montag'],
                  [0, 'Sonntag'],
                ] as [0 | 1, string][]
              ).map(([v, l]) => (
                <button key={v} className={settings.weekStartsOn === v ? 'active' : ''} onClick={() => updateSettings({ weekStartsOn: v })}>
                  {l}
                </button>
              ))}
            </div>
          </Row>
        </div>
      </Group>
      <Group title="Sichtbare Tageszeit" note="Im Tages- und Wochenraster sichtbarer Bereich.">
        <div className="set-card">
          <Row label="Tag beginnt um">
            <select value={settings.dayStartHour} onChange={(e) => updateSettings({ dayStartHour: Number(e.target.value) })}>
              {hours.slice(0, 23).map((h) => (
                <option key={h} value={h}>
                  {h}:00 Uhr
                </option>
              ))}
            </select>
          </Row>
          <Row label="Tag endet um">
            <select value={settings.dayEndHour} onChange={(e) => updateSettings({ dayEndHour: Number(e.target.value) })}>
              {hours.slice(settings.dayStartHour + 1).map((h) => (
                <option key={h} value={h}>
                  {h}:00 Uhr
                </option>
              ))}
            </select>
          </Row>
        </div>
      </Group>
    </div>
  );
}

/* ---------------------------------------------------------------- Gerät */

function DeviceTab() {
  const { settings, updateSettings } = useStore();
  return (
    <div className="form">
      <Group>
        <div className="set-card">
          <Row label="Termine aktualisieren" hint="Wie oft die Kalender neu geladen werden">
            <Stepper value={settings.refreshMinutes} min={1} max={120} unit="Min." onChange={(v) => updateSettings({ refreshMinutes: v })} />
          </Row>
          <Row label="Zurück zur Übersicht" hint="Nach so vielen Minuten ohne Bedienung · 0 = nie">
            <Stepper value={settings.idleResetMinutes} min={0} max={120} unit="Min." onChange={(v) => updateSettings({ idleResetMinutes: v })} />
          </Row>
          <Row label="Bildschirm wach halten" hint="Das Tablet geht nicht in den Ruhezustand">
            <Switch checked={settings.keepAwake} onChange={(keepAwake) => updateSettings({ keepAwake })} label="Bildschirm wach halten" />
          </Row>
        </div>
      </Group>
    </div>
  );
}

/** sample symbols with their department colour (one-colour styles are tinted with it) */
const SYMBOL_PREVIEW: [string, string][] = [
  ['🍎', '#4caf50'],
  ['🥕', '#4caf50'],
  ['🧀', '#e3b72c'],
  ['☕', '#a0673c'],
  ['🧴', '#b06ad1'],
];

function SymbolPicker({ value, onChange }: { value: SymbolSet; onChange: (v: SymbolSet) => void }) {
  const groups = [...new Set(SYMBOL_SETS.map((s) => s.group))];
  return (
    <div className="field">
      {groups.map((g) => (
        <div key={g} className="sym-picker-group">
          <div className="muted small">{g}</div>
          <div className="sym-picker" role="radiogroup" aria-label={`Symbole: ${g}`}>
            {SYMBOL_SETS.filter((s) => s.group === g).map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={value === s.id}
                className={`sym-card ${value === s.id ? 'on' : ''}`}
                onClick={() => onChange(s.id)}
                title={s.note}
              >
                <span className="sym-card-row">
                  {SYMBOL_PREVIEW.map(([e, color]) => (
                    <span key={e} style={{ ['--sym-tint' as string]: color }}>
                      <Sym emoji={e} set={s.id} />
                    </span>
                  ))}
                </span>
                <span className="sym-card-label">{s.label}</span>
                {s.note && <span className="sym-card-note">{s.note}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
      <span className="sym-credits">
        Fluent Emoji © Microsoft (MIT) · Noto Emoji © Google (Apache 2.0) · Twemoji © Twitter, Inc. u. a. (CC BY 4.0) · OpenMoji
        (CC BY-SA 4.0) · Tabler, Phosphor (MIT) · Lucide (ISC)
      </span>
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
        Die Konfiguration (Personen, Kalenderkonten, Zuordnungen, Einstellungen) wird nur auf diesem Gerät gespeichert. Mit
        Export/Import kannst du sie sichern oder z.&nbsp;B. vom Computer auf das iPad übertragen.
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
