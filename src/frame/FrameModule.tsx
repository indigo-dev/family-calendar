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
  CLOCK_FACES,
  CLOCK_LAYOUTS,
  isAnalog,
  type ClockFace,
  type FrameFit,
  type Motif,
} from '../lib/frame';
import { Clock } from './Clocks';
import './frame.css';
import { t } from '../i18n';

type Tab = 'mine' | 'motifs';

const FITS: FrameFit[] = ['cover', 'contain', 'mat'];

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
  const clockOnly = cfg.clockFace !== 'none' && (count === 0 || cfg.clockLayout === 'solo');

  const onFiles = async (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (fileRef.current) fileRef.current.value = '';
    if (!files.length) return;
    setImporting({ done: 0, total: files.length });
    const ok = await addFiles(files, (done) => setImporting({ done, total: files.length }));
    setImporting(null);
    if (ok < files.length) alert(t('frame.unreadable', { n: files.length - ok }));
  };

  const removeOne = (id: string) => {
    if (confirm(t('frame.confirmDelete'))) removePhotos([id]);
  };

  return (
    <div className="fr">
      <section className="view">
        <div className="fr-head">
          <div className="segmented small" role="tablist">
            <button className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>
              {t('frame.mine')}
            </button>
            <button className={tab === 'motifs' ? 'active' : ''} onClick={() => (setTab('motifs'), setEditing(false))}>
              {t('frame.discover')}
            </button>
          </div>
          {tab === 'mine' && !!photos?.length && (
            <>
              <span className="fr-head-info">{t('frame.inShow', { n: count, total: photos.length })}</span>
              {!editing && (
                <button
                  className="btn"
                  onClick={() => patchFrameSettings({ selected: count === photos.length ? [] : photos.map((p) => p.id) })}
                >
                  {count === photos.length ? t('frame.none') : t('frame.all')}
                </button>
              )}
              <button className={`btn ${editing ? 'primary' : ''}`} onClick={() => setEditing((e) => !e)}>
                {editing ? t('common.done') : t('common.edit')}
              </button>
            </>
          )}
        </div>

        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />

        <div className="fr-scroll">
          {tab === 'mine' ? (
            photos === null ? null : photos.length === 0 && !importing ? (
              <div className="fr-empty">
                <h3>{t('frame.noPhotos')}</h3>
                <p>{t('frame.noPhotosHint')}</p>
                <button className="btn primary" onClick={() => fileRef.current?.click()}>
                  {t('frame.addPhotos')}
                </button>
                <button className="btn" onClick={() => setTab('motifs')}>
                  {t('frame.discover')}
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
                        <span>{t('frame.addPhotos')}</span>
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
                        aria-label={editing ? t('frame.deletePhoto') : on ? t('frame.removeFromShow') : t('frame.addToShow')}
                      >
                        <img src={thumbUrl(p)} alt="" loading="lazy" draggable={false} />
                        <span className="fr-check" aria-hidden>
                          {editing ? '✕' : on ? '✓' : ''}
                        </span>
                        {p.credit && <span className="fr-tile-cap">{p.credit}</span>}
                      </button>
                      {!editing && (
                        <button className="fr-play" onClick={() => onStart(p.id)} aria-label={t('frame.startHere')}>
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
        <button className="btn primary fr-start" disabled={count === 0 && !clockOnly} onClick={() => onStart()}>
          {clockOnly ? t('frame.showClock') : count === 1 ? t('frame.showPhoto') : t('frame.startShow')}
        </button>
        {count === 0 && <p className="fr-start-hint">{clockOnly ? t('frame.clockOnlyHint') : t('frame.selectHint')}</p>}

        <div className="fr-field">
          <span>{t('frame.interval')}</span>
          <div className="fr-chips">
            {INTERVALS.map((i) => (
              <button
                key={i.sec}
                className={cfg.intervalSec === i.sec ? 'on' : ''}
                onClick={() => patchFrameSettings({ intervalSec: i.sec })}
              >
                {i.label}
              </button>
            ))}
          </div>
        </div>

        <div className="fr-field">
          <span>{t('frame.order')}</span>
          <div className="segmented small">
            <button className={cfg.order === 'seq' ? 'active' : ''} onClick={() => patchFrameSettings({ order: 'seq' })}>
              {t('frame.seq')}
            </button>
            <button className={cfg.order === 'shuffle' ? 'active' : ''} onClick={() => patchFrameSettings({ order: 'shuffle' })}>
              {t('frame.shuffle')}
            </button>
          </div>
        </div>

        <div className="fr-field">
          <span>{t('frame.fit')}</span>
          <div className="fr-fits" role="radiogroup" aria-label={t('frame.fit')}>
            {FITS.map((f) => (
              <button
                key={f}
                role="radio"
                aria-checked={cfg.fit === f}
                className={`fr-fit ${cfg.fit === f ? 'on' : ''}`}
                onClick={() => patchFrameSettings({ fit: f })}
              >
                {/* miniature screen with a portrait photo, drawn the way this option shows it */}
                <span className={`fr-fit-thumb fit-${f}`} aria-hidden>
                  <i />
                </span>
                <span>{t(`frame.fits.${f}`)}</span>
              </button>
            ))}
          </div>
          <label className="fr-toggle">
            {t('frame.zoom')}
            <input
              type="checkbox"
              checked={cfg.motion}
              disabled={cfg.fit === 'mat'}
              onChange={(e) => patchFrameSettings({ motion: e.target.checked })}
            />
          </label>
        </div>

        <ClockSettings />

        <div className="fr-field">
          <span>{t('frame.screensaver')}</span>
          <div className="fr-chips">
            {SCREENSAVER.map((m) => (
              <button key={m} className={cfg.screensaverMin === m ? 'on' : ''} onClick={() => patchFrameSettings({ screensaverMin: m })}>
                {m === 0 ? t('frame.off') : t('frame.minutes', { n: m })}
              </button>
            ))}
          </div>
          <p className="fr-hint">{cfg.screensaverMin ? t('frame.screensaverOn', { n: cfg.screensaverMin }) : t('frame.screensaverOff')}</p>
        </div>
      </aside>
    </div>
  );
}

/** 10:09 – the classic watch pose, so the previews show both hands nicely */
const PREVIEW_TIME = new Date(2026, 0, 1, 10, 9);

/** Clock face, its place and what is shown next to it – each choice with a small preview. */
function ClockSettings() {
  const cfg = useFrameSettings();
  const on = cfg.clockFace !== 'none';
  const faceCard = (id: ClockFace, label: string) => (
    <button
      key={id}
      role="radio"
      aria-checked={cfg.clockFace === id}
      className={`fr-ck ${cfg.clockFace === id ? 'on' : ''}`}
      onClick={() => patchFrameSettings({ clockFace: id })}
    >
      <span className="fr-ck-thumb" aria-hidden>
        {id === 'none' ? <span className="fr-ck-none">—</span> : <Clock face={id} now={PREVIEW_TIME} seconds={cfg.seconds} still />}
      </span>
      <span>{label}</span>
    </button>
  );
  return (
    <div className="fr-field">
      <span>{t('frame.clock')}</span>
      <div className="fr-cks" role="radiogroup" aria-label={t('frame.clock')}>
        {faceCard('none', t('frame.noClock'))}
        {CLOCK_FACES.filter((f) => f.kind === 'digital').map((f) => faceCard(f.id, f.label))}
      </div>
      <div className="fr-cks" role="radiogroup" aria-label={t('frame.analog')}>
        {CLOCK_FACES.filter((f) => f.kind === 'analog').map((f) => faceCard(f.id, f.label))}
      </div>

      {on && (
        <>
          <div className="fr-fits" role="radiogroup" aria-label={t('frame.clockPlace')}>
            {CLOCK_LAYOUTS.map((l) => (
              <button
                key={l.id}
                role="radio"
                aria-checked={cfg.clockLayout === l.id}
                className={`fr-fit ${cfg.clockLayout === l.id ? 'on' : ''}`}
                onClick={() => patchFrameSettings({ clockLayout: l.id })}
              >
                <span className={`fr-fit-thumb fr-lay-${l.id}`} aria-hidden>
                  {l.id !== 'solo' && <i />}
                  <b />
                </span>
                <span>{l.label}</span>
              </button>
            ))}
          </div>
          <label className="fr-toggle">
            {t('frame.date')}
            <input type="checkbox" checked={cfg.date} onChange={(e) => patchFrameSettings({ date: e.target.checked })} />
          </label>
          <label className="fr-toggle">
            {t('frame.weather')}
            <input type="checkbox" checked={cfg.weather} onChange={(e) => patchFrameSettings({ weather: e.target.checked })} />
          </label>
          <label className="fr-toggle">
            {t('frame.events')}
            <input type="checkbox" checked={cfg.events} onChange={(e) => patchFrameSettings({ events: e.target.checked })} />
          </label>
          {isAnalog(cfg.clockFace) && (
            <label className="fr-toggle">
              {t('frame.seconds')}
              <input type="checkbox" checked={cfg.seconds} onChange={(e) => patchFrameSettings({ seconds: e.target.checked })} />
            </label>
          )}
        </>
      )}
    </div>
  );
}

/** Free photos from picsum.photos (Unsplash licence). A tap downloads the motif into the album. */
function MotifBrowser() {
  const photos = usePhotos();
  const [pages] = useState(shuffledPages);
  const [motifs, setMotifs] = useState<Motif[]>([]);
  const [page, setPage] = useState(0);
  // page 0 starts loading right away; the buttons set the flags for the next page / retry
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (page >= pages.length) return;
    let cancelled = false;
    fetchMotifs(pages[page])
      .then((list) => !cancelled && setMotifs((m) => [...m, ...list]))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [pages, page, retry]);

  const inAlbum = new Map((photos ?? []).filter((p) => p.motifId).map((p) => [p.motifId!, p.id]));

  const pick = async (m: Motif) => {
    const existing = inAlbum.get(m.id);
    if (existing) {
      if (confirm(t('frame.confirmRemoveMotif'))) removePhotos([existing]);
      return;
    }
    setBusy((b) => new Set(b).add(m.id));
    try {
      await addMotif(m);
    } catch {
      alert(t('frame.motifFailed'));
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
      <p className="fr-note">{t('frame.motifNote')}</p>
      <div className="fr-grid">
        {motifs.map((m) => {
          const has = inAlbum.has(m.id);
          return (
            <div key={m.id} className={`fr-tile ${has ? 'on' : ''}`}>
              <button
                className="fr-tile-hit"
                onClick={() => pick(m)}
                disabled={busy.has(m.id)}
                aria-label={t('frame.motifBy', { author: m.author })}
              >
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
          <p>{t('frame.motifsFailed')}</p>
          <button
            className="btn"
            onClick={() => {
              setLoading(true);
              setError(false);
              setRetry((r) => r + 1);
            }}
          >
            {t('common.retry')}
          </button>
        </div>
      )}
      {!error && page < pages.length - 1 && (
        <div className="fr-more">
          <button
            className="btn"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setPage((p) => p + 1);
            }}
          >
            {loading ? t('dashboard.loading') : t('frame.moreMotifs')}
          </button>
        </div>
      )}
    </>
  );
}
