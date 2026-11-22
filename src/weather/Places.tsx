import { useEffect, useState } from 'react';

import {
  LocateError,
  addPlace,
  locate,
  makeHome,
  removePlace,
  renamePlace,
  searchPlaces,
  setActivePlace,
  useWeatherSettings,
  type Place,
  type SearchHit,
} from '../lib/weather';

export function PlacesSheet({ onClose }: { onClose: () => void }) {
  const { places, activeId } = useWeatherSettings();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="wx-sheet-backdrop" onClick={onClose}>
      <div className="wx-sheet" role="dialog" aria-label="Orte" onClick={(e) => e.stopPropagation()}>
        <div className="wx-sheet-head">
          <h2>Orte</h2>
          <button className="btn primary" onClick={onClose}>
            Fertig
          </button>
        </div>
        <ul className="wx-places">
          {places.map((p, i) => (
            <PlaceRow key={p.id} place={p} home={i === 0} active={p.id === (activeId ?? places[0]?.id)} />
          ))}
        </ul>
        <p className="wx-hint">
          Der erste Ort ist „Zuhause“: Sein Wetter erscheint in der Übersicht, im Kalender und im Bildschirmschoner.
        </p>
        <h3 className="wx-h">Ort hinzufügen</h3>
        <AddPlace onAdded={onClose} />
      </div>
    </div>
  );
}

function PlaceRow({ place, home, active }: { place: Place; home: boolean; active: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(place.name);
  const [confirmDel, setConfirmDel] = useState(false);
  const save = () => {
    const n = name.trim();
    if (n) renamePlace(place.id, n);
    setEditing(false);
  };
  return (
    <li className={active ? 'on' : ''}>
      <div className="wx-place-line">
        {editing ? (
          <input
            className="wx-input"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            onBlur={save}
            aria-label="Name des Orts"
          />
        ) : (
          <button className="wx-place-name" onClick={() => setActivePlace(place.id)}>
            {home && <span aria-label="Zuhause">🏠 </span>}
            {place.name}
            {place.region && <small>{place.region}</small>}
          </button>
        )}
      </div>
      <div className="wx-place-tools">
        {!home && (
          <button className="btn" onClick={() => makeHome(place.id)}>
            Als Zuhause
          </button>
        )}
        <button className="btn" onClick={() => (editing ? save() : setEditing(true))}>
          {editing ? 'Speichern' : 'Umbenennen'}
        </button>
        <button
          className={`btn danger ${confirmDel ? 'primary' : ''}`}
          onClick={() => (confirmDel ? removePlace(place.id) : setConfirmDel(true))}
          onBlur={() => setConfirmDel(false)}
        >
          {confirmDel ? 'Wirklich entfernen?' : 'Entfernen'}
        </button>
      </div>
    </li>
  );
}

export function AddPlace({ first = false, onAdded }: { first?: boolean; onAdded?: () => void }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; help?: string[] } | null>(null);

  // search while typing (debounced)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((h) => setHits(h))
        .catch((e) => e.name !== 'AbortError' && setHits([]));
    }, 300);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const useLocation = async () => {
    setBusy(true);
    setError(null);
    try {
      const pos = await locate();
      addPlace({ name: first ? 'Zuhause' : 'Mein Standort', ...pos });
      onAdded?.();
    } catch (e) {
      setError({ message: (e as Error).message, help: e instanceof LocateError ? e.help : undefined });
    } finally {
      setBusy(false);
    }
  };

  const pick = (h: SearchHit) => {
    addPlace(h);
    setQuery('');
    setHits(null);
    onAdded?.();
  };

  return (
    <div className="wx-add">
      <button className={`btn ${first ? 'primary' : ''} wx-locate`} onClick={useLocation} disabled={busy}>
        📍 {busy ? 'Standort wird ermittelt …' : 'Meinen Standort verwenden'}
      </button>
      {error && (
        <div className="wx-error">
          <b>{error.message}</b>
          {error.help && (
            <ol>
              {error.help.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ol>
          )}
        </div>
      )}
      <input
        className="wx-input"
        type="search"
        placeholder="Ort suchen, z. B. Garmisch"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        enterKeyHint="search"
        autoComplete="off"
        aria-label="Ort suchen"
      />
      {hits && query.trim().length >= 2 && (
        <ul className="wx-hits">
          {hits.length === 0 && (
            <li className="muted wx-nohit">
              {/^\d+$/.test(query.trim()) ? 'Bitte den Ortsnamen statt der Postleitzahl eingeben.' : 'Kein Ort gefunden.'}
            </li>
          )}
          {hits.map((h) => (
            <li key={`${h.lat},${h.lon}`}>
              <button onClick={() => pick(h)}>
                {h.name}
                {h.region && <small>{h.region}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
