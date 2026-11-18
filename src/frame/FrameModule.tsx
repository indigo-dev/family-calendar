import { useEffect, useRef, useState } from 'react';
import {
  INTERVALS,
  SCREENSAVER,
  addFiles,
  addMotif,
  fetchMotifs,
  motifThumb,
  patchFrameSettings,
  removePhotos,
  shuffledPages,
  thumbUrl,
  toggleSelected,
  useFrameSettings,
  usePhotos,
  type FrameFit,
  type Motif,
} from '../lib/frame';
import './frame.css';

type Tab = 'mine' | 'motifs';

const FITS: { id: FrameFit; label: string }[] = [
  { id: 'cover', label: 'Füllen' },
  { id: 'contain', label: 'Ganzes Foto' },
  { id: 'mat', label: 'Passepartout' },
];

/** Album + settings; the slideshow itself is the full-screen `PhotoFrame` opened by the shell. */
export function FrameModule({ onStart }: { onStart: (startId?: string) => void }) {
  const photos = usePhotos();
  const cfg = useFrameSettings();
  const [tab, setTab] = useState<Tab>('mine');
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = new Set(cfg.selected);
  const count = photos?.filter((p) => selected.has(p.id)).length ?? 0;

  const onFiles = async (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (fileRef.current) fileRef.current.value = '';
    if (!files.length) return;
    setImporting({ done: 0, total: files.length });
    const ok = await addFiles(files, (done) => setImporting({ done, total: files.length }));
    setImporting(null);
    if (ok < files.length) alert(`${files.length - ok} Datei(en) konnten nicht gelesen werden.`);
  };

  const removeOne = (id: string) => {
    if (confirm('Dieses Foto aus dem Fotorahmen löschen?')) removePhotos([id]);
  };

  return (
    <div className="fr">
      <section className="view">
        <div className="fr-head">
          <div className="segmented small" role="tablist">
            <button className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>
              Meine Fotos
            </button>
            <button className={tab === 'motifs' ? 'active' : ''} onClick={() => (setTab('motifs'), setEditing(false))}>
              Motive entdecken
            </button>
          </div>
          {tab === 'mine' && !!photos?.length && (
            <>
              <span className="fr-head-info">
                {count} von {photos.length} in der Diashow
              </span>
              {!editing && (
                <button
                  className="btn"
                  onClick={() => patchFrameSettings({ selected: count === photos.length ? [] : photos.map((p) => p.id) })}
                >
                  {count === photos.length ? 'Keine' : 'Alle'}
                </button>
              )}
              <button className={`btn ${editing ? 'primary' : ''}`} onClick={() => setEditing((e) => !e)}>
                {editing ? 'Fertig' : 'Bearbeiten'}
              </button>
            </>
          )}
        </div>

        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />

        <div className="fr-scroll">
          {tab === 'mine' ? (
            photos === null ? null : photos.length === 0 && !importing ? (
              <div className="fr-empty">
                <h3>Noch keine Fotos</h3>
                <p>Wähle Fotos von diesem Gerät oder suche dir schöne Motive aus dem Internet aus.</p>
                <button className="btn primary" onClick={() => fileRef.current?.click()}>
                  Fotos hinzufügen
                </button>
                <button className="btn" onClick={() => setTab('motifs')}>
                  Motive entdecken
                </button>
              </div>
            ) : (
              <div className="fr-grid">
                {!editing && (
                  <button className="fr-add" onClick={() => fileRef.current?.click()} disabled={!!importing}>
                    {importing ? (
                      <span>
                        {importing.done} / {importing.total} …
                      </span>
                    ) : (
                      <>
                        <b>+</b>
                        <span>Fotos hinzufügen</span>
                      </>
                    )}
                  </button>
                )}
                {photos.map((p) => {
                  const on = selected.has(p.id);
                  return (
                    <div key={p.id} className={`fr-tile ${editing ? 'del' : on ? 'on' : 'off'}`}>
                      <button
                        className="fr-tile-hit"
                        onClick={() => (editing ? removeOne(p.id) : toggleSelected(p.id))}
                        aria-label={editing ? 'Foto löschen' : on ? 'Aus der Diashow nehmen' : 'In die Diashow aufnehmen'}
                      >
                        <img src={thumbUrl(p)} alt="" loading="lazy" draggable={false} />
                        <span className="fr-check" aria-hidden>
                          {editing ? '✕' : on ? '✓' : ''}
                        </span>
                        {p.credit && <span className="fr-tile-cap">{p.credit}</span>}
                      </button>
                      {!editing && (
                        <button className="fr-play" onClick={() => onStart(p.id)} aria-label="Ab diesem Foto starten">
                          ▶
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <MotifBrowser />
          )}
        </div>
      </section>

      <aside className="view fr-side">
        <button className="btn primary fr-start" disabled={count === 0} onClick={() => onStart()}>
          ▶ {count === 1 ? 'Foto zeigen' : 'Diashow starten'}
        </button>
        {count === 0 && <p className="fr-start-hint">Tippe Fotos an, um sie für die Diashow auszuwählen.</p>}

        <div className="fr-field">
          <span>Bildwechsel alle</span>
          <div className="fr-chips">
            {INTERVALS.map((i) => (
              <button key={i.sec} className={cfg.intervalSec === i.sec ? 'on' : ''} onClick={() => patchFrameSettings({ intervalSec: i.sec })}>
                {i.label}
              </button>
            ))}
          </div>
        </div>

        <div className="fr-field">
          <span>Reihenfolge</span>
          <div className="segmented small">
            <button className={cfg.order === 'seq' ? 'active' : ''} onClick={() => patchFrameSettings({ order: 'seq' })}>
              Der Reihe nach
            </button>
            <button className={cfg.order === 'shuffle' ? 'active' : ''} onClick={() => patchFrameSettings({ order: 'shuffle' })}>
              Zufällig
            </button>
          </div>
        </div>

        <div className="fr-field">
          <span>Darstellung</span>
          <div className="segmented small">
            {FITS.map((f) => (
              <button key={f.id} className={cfg.fit === f.id ? 'active' : ''} onClick={() => patchFrameSettings({ fit: f.id })}>
                {f.label}
              </button>
            ))}
          </div>
          <label className="fr-toggle">
            Uhrzeit und Datum einblenden
            <input type="checkbox" checked={cfg.clock} onChange={(e) => patchFrameSettings({ clock: e.target.checked })} />
          </label>
          <label className="fr-toggle">
            Langsamer Zoom
            <input
              type="checkbox"
              checked={cfg.motion}
              disabled={cfg.fit === 'mat'}
              onChange={(e) => patchFrameSettings({ motion: e.target.checked })}
            />
          </label>
        </div>

        <div className="fr-field">
          <span>Bildschirmschoner</span>
          <div className="fr-chips">
            {SCREENSAVER.map((m) => (
              <button key={m} className={cfg.screensaverMin === m ? 'on' : ''} onClick={() => patchFrameSettings({ screensaverMin: m })}>
                {m === 0 ? 'Aus' : `${m} min`}
              </button>
            ))}
          </div>
          <p className="fr-hint">
            {cfg.screensaverMin
              ? `Startet den Fotorahmen, wenn ${cfg.screensaverMin} Minuten lang niemand den Bildschirm berührt hat. Antippen beendet ihn.`
              : 'Startet den Fotorahmen automatisch, wenn eine Weile niemand den Bildschirm berührt.'}
          </p>
        </div>
      </aside>
    </div>
  );
}

/** Free photos from picsum.photos (Unsplash licence). A tap downloads the motif into the album. */
function MotifBrowser() {
  const photos = usePhotos();
  const pages = useRef(shuffledPages());
  const [motifs, setMotifs] = useState<Motif[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (page >= pages.current.length) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchMotifs(pages.current[page])
      .then((list) => !cancelled && setMotifs((m) => [...m, ...list]))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, retry]);

  const inAlbum = new Map((photos ?? []).filter((p) => p.motifId).map((p) => [p.motifId!, p.id]));

  const pick = async (m: Motif) => {
    const existing = inAlbum.get(m.id);
    if (existing) {
      if (confirm('Dieses Motiv wieder aus dem Album entfernen?')) removePhotos([existing]);
      return;
    }
    setBusy((b) => new Set(b).add(m.id));
    try {
      await addMotif(m);
    } catch {
      alert('Das Motiv konnte nicht geladen werden. Bitte die Internetverbindung prüfen.');
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(m.id);
        return n;
      });
    }
  };

  return (
    <>
      <p className="fr-note">
        Freie Fotos von Unsplash (über picsum.photos). Antippen lädt das Motiv ins Album – danach funktioniert es auch offline.
      </p>
      <div className="fr-grid">
        {motifs.map((m) => {
          const has = inAlbum.has(m.id);
          return (
            <div key={m.id} className={`fr-tile ${has ? 'on' : ''}`}>
              <button className="fr-tile-hit" onClick={() => pick(m)} disabled={busy.has(m.id)} aria-label={`Motiv von ${m.author}`}>
                <img src={motifThumb(m)} alt="" loading="lazy" draggable={false} />
                <span className="fr-check" aria-hidden>
                  {has ? '✓' : '+'}
                </span>
                <span className="fr-tile-cap">{m.author}</span>
                {busy.has(m.id) && (
                  <span className="fr-busy">
                    <span className="fr-spinner" />
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
      {error && (
        <div className="fr-empty">
          <p>Motive konnten nicht geladen werden. Ist das Gerät online?</p>
          <button className="btn" onClick={() => setRetry((r) => r + 1)}>
            Erneut versuchen
          </button>
        </div>
      )}
      {!error && page < pages.current.length - 1 && (
        <div className="fr-more">
          <button className="btn" disabled={loading} onClick={() => setPage((p) => p + 1)}>
            {loading ? 'Lädt …' : 'Mehr Motive'}
          </button>
        </div>
      )}
    </>
  );
}
