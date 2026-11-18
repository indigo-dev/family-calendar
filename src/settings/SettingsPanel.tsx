import { useEffect, useRef, useState } from 'react';
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
  PALETTE,
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

export type SettingsTab = 'family' | 'calendars' | 'school' | 'holidays' | 'display' | 'backup';
type Tab = SettingsTab;

export function SettingsPanel({ onClose, initialTab }: { onClose: () => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'family');
  return (
    <div className="modal-backdrop">
      <div className="modal settings" role="dialog" aria-modal="true">
        <div className="settings-head">
          <h2>Einstellungen</h2>
          <div className="segmented small">
            {(
              [
                ['family', 'Familie'],
                ['calendars', 'Kalender'],
                ['school', 'Schule'],
                ['holidays', 'Ferien'],
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
          {tab === 'family' && <FamilyTab onGoCalendars={() => setTab('calendars')} />}
          {tab === 'calendars' && <CalendarsTab />}
          {tab === 'school' && <SchoolTab />}
          {tab === 'holidays' && <HolidaysTab />}
          {tab === 'display' && <DisplayTab />}
          {tab === 'backup' && <BackupTab />}
        </div>
      </div>
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
  const { patchMember, removeMember, moveMember, calendars } = useStore();
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
    <div className="form narrow">
      <p className="help">
        Feiertage und Schulferien gelten für die ganze Familie. Sie erscheinen nicht als Person, sondern als Markierung im Kalender:
        Feiertage farbig am Datum, Ferien als leicht eingefärbte Tage.
      </p>
      <label className="field">
        <span>Bundesland</span>
        <select value={h.region} onChange={(e) => set({ region: e.target.value })}>
          <option value="">– keine Ferien/Feiertage anzeigen –</option>
          {REGIONS.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={h.showPublic} disabled={!h.region} onChange={(e) => set({ showPublic: e.target.checked })} />
        <span>Gesetzliche Feiertage anzeigen</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={h.showSchool} disabled={!h.region} onChange={(e) => set({ showSchool: e.target.checked })} />
        <span>Schulferien anzeigen</span>
      </label>

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
      <div className="field-row">
        <label className="field">
          <span>Stil</span>
          <select value={settings.style} onChange={(e) => updateSettings({ style: e.target.value as Settings['style'] })}>
            {UI_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Hell / Dunkel</span>
          <select value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as Settings['theme'] })}>
            <option value="auto">Automatisch (System)</option>
            <option value="light">Hell</option>
            <option value="dark">Dunkel</option>
          </select>
        </label>
      </div>
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
