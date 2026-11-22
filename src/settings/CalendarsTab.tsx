import { useState } from 'react';
import type { CalendarSource } from '../types';
import { useStore } from '../store';
import { LINK_HELP, newCalendar } from '../lib/config';
import { normalizeIcsUrl, testCalendarLink } from '../lib/events';
import { Avatar } from '../components/Avatar';

type TestState = { busy: true } | { busy: false; ok: true; text: string } | { busy: false; ok: false; text: string };

export function CalendarsTab() {
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
          <p className="help">
            Ohne Weiterleitung kann die App die Kalender-Links nicht laden (Google und Microsoft blockieren direkte Zugriffe aus dem
            Browser).
          </p>
        )}
      </div>

      <p className="help">
        Tippe bei einem Kalender auf die Personen, denen er gehört – ein gemeinsamer Familienkalender kann mehreren Personen gehören.
        Kalender ohne Person werden nicht angezeigt.
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

function hostOf(url: string): string {
  try {
    return new URL(normalizeIcsUrl(url)).hostname;
  } catch {
    return 'ungültiger Link';
  }
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

  const host = hostOf(cal.url);

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
