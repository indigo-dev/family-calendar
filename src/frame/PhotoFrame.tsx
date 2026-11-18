import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNow, useSize, useSwipe, useWakeLock } from '../lib/hooks';
import { photoById, shuffle, useFrameSettings, type Photo } from '../lib/frame';
import './frame.css';

const FADE_MS = 1600;
const CONTROLS_MS = 4000;

interface Slide {
  key: number;
  url: string;
  photo: Photo;
}

export type FrameMode = 'manual' | 'screensaver';

/**
 * Full-screen photo frame. Manual: tap shows controls, swipe changes the photo.
 * Screensaver: any tap ends it.
 */
export function PhotoFrame({ ids, mode, startId, onClose }: { ids: string[]; mode: FrameMode; startId?: string; onClose: () => void }) {
  const cfg = useFrameSettings();
  const now = useNow(10_000);
  const [rootRef, size] = useSize<HTMLDivElement>();
  useWakeLock(true);

  // the playlist is fixed when the frame opens (shuffle once, then go round)
  const playlist = useMemo(() => {
    const list = cfg.order === 'shuffle' ? shuffle(ids) : [...ids];
    if (startId && list.includes(startId)) list.unshift(...list.splice(list.indexOf(startId), 1));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [index, setIndex] = useState(0);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [controls, setControls] = useState(false);
  const keyRef = useRef(0);
  const controlsTimer = useRef<number | undefined>(undefined);

  const go = useCallback((dir: 1 | -1) => setIndex((i) => (i + dir + playlist.length) % playlist.length), [playlist.length]);

  // load + decode the photo before it fades in, so there is never a half-drawn image
  useEffect(() => {
    const photo = photoById(playlist[index]);
    if (!photo) return;
    let cancelled = false;
    const url = URL.createObjectURL(photo.full);
    const img = new Image();
    img.src = url;
    img
      .decode()
      .catch(() => {})
      .then(() => {
        if (cancelled) return URL.revokeObjectURL(url);
        const key = ++keyRef.current;
        setSlides((s) => [...s.slice(-1), { key, url, photo }]);
      });
    return () => {
      cancelled = true;
    };
  }, [index, playlist]);

  // after the fade only the newest slide stays
  useEffect(() => {
    if (slides.length < 2) return;
    const t = window.setTimeout(() => {
      setSlides((s) => {
        s.slice(0, -1).forEach((x) => URL.revokeObjectURL(x.url));
        return s.slice(-1);
      });
    }, FADE_MS + 100);
    return () => window.clearTimeout(t);
  }, [slides]);

  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  useEffect(() => () => slidesRef.current.forEach((x) => URL.revokeObjectURL(x.url)), []);

  // next photo after the interval (a single photo just stays)
  const current = slides[slides.length - 1];
  useEffect(() => {
    if (!current || playlist.length < 2) return;
    const t = window.setTimeout(() => go(1), cfg.intervalSec * 1000);
    return () => window.clearTimeout(t);
  }, [current, playlist.length, cfg.intervalSec, go]);

  // full screen for the manual start (needs the tap that opened it)
  useEffect(() => {
    if (mode !== 'manual') return;
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    try {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else el.webkitRequestFullscreen?.();
    } catch {
      /* not supported (iPhone) */
    }
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [mode]);

  const showControls = () => {
    setControls(true);
    window.clearTimeout(controlsTimer.current);
    controlsTimer.current = window.setTimeout(() => setControls(false), CONTROLS_MS);
  };
  useEffect(() => () => window.clearTimeout(controlsTimer.current), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (mode === 'screensaver') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, onClose, go]);

  const swipe = useSwipe((dir) => {
    if (mode === 'manual') go(dir);
  });

  const onTap = () => {
    if (mode === 'screensaver') onClose();
    else if (controls) setControls(false);
    else showControls();
  };

  const time = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div
      ref={rootRef}
      className={`pf pf-${cfg.fit} ${cfg.clock ? 'pf-with-clock' : ''} ${controls ? 'pf-controls-on' : ''}`}
      onClick={onTap}
      {...swipe}
      role="dialog"
      aria-label="Fotorahmen"
    >
      {slides.map((s) => (
        <SlideView key={s.key} slide={s} fit={cfg.fit} motion={cfg.motion} clock={cfg.clock} durationSec={cfg.intervalSec} size={size} />
      ))}

      {cfg.clock && (
        <div className="pf-clock" aria-hidden>
          <div className="pf-time">{time}</div>
          <div className="pf-date">{date}</div>
        </div>
      )}

      {current?.photo.credit && <div className="pf-credit">Foto: {current.photo.credit} · Unsplash</div>}

      {mode === 'manual' && (
        <div className="pf-ui" onClick={(e) => e.stopPropagation()}>
          <button className="pf-btn pf-close" onClick={onClose}>
            ✕ Beenden
          </button>
          {playlist.length > 1 && (
            <>
              <button className="pf-btn pf-nav pf-prev" aria-label="Vorheriges Foto" onClick={() => (go(-1), showControls())}>
                ‹
              </button>
              <button className="pf-btn pf-nav pf-next" aria-label="Nächstes Foto" onClick={() => (go(1), showControls())}>
                ›
              </button>
              <div className="pf-count">
                {index + 1} / {playlist.length}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SlideView({ slide, fit, motion, clock, durationSec, size }: {
  slide: Slide;
  fit: 'cover' | 'contain' | 'mat';
  motion: boolean;
  clock: boolean;
  durationSec: number;
  size: { width: number; height: number };
}) {
  const { url, photo, key } = slide;

  if (fit === 'mat') {
    // a framed picture with passe-partout, sized to the photo's aspect ratio
    const short = Math.min(size.width, size.height) || 800;
    const mat = Math.round(short * 0.065);
    const border = Math.round(short * 0.016);
    const availW = size.width * 0.88 - 2 * (mat + border);
    // with the clock the picture hangs a bit higher and leaves room for it below
    const availH = size.height * (clock ? 0.76 : 0.86) - 2 * (mat + border);
    const f = Math.min(availW / photo.width, availH / photo.height);
    const w = Math.max(1, Math.round(photo.width * f));
    const h = Math.max(1, Math.round(photo.height * f));
    return (
      <div className="pf-slide">
        <div className="pf-wall" />
        <div className="pf-picture" style={{ padding: mat, borderWidth: border }}>
          <img src={url} alt="" width={w} height={h} draggable={false} />
        </div>
      </div>
    );
  }

  const style = { ['--pf-dur' as string]: `${durationSec + FADE_MS / 1000}s` } as CSSProperties;
  return (
    <div className="pf-slide" style={style}>
      {fit === 'contain' && <div className="pf-backdrop" style={{ backgroundImage: `url(${url})` }} />}
      <img className={motion ? `pf-motion pf-motion-${key % 4}` : ''} src={url} alt="" draggable={false} />
    </div>
  );
}
