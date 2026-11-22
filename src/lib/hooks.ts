import { useEffect, useRef, useState, type TouchEvent } from 'react';

/** Observes an element's size. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Keeps the screen on (Screen Wake Lock API, Safari ≥ 16.4). */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        if (document.visibilityState === 'visible' && !cancelled) lock = await navigator.wakeLock.request('screen');
      } catch {
        /* not allowed (e.g. low power mode) */
      }
    };
    request();
    const onVis = () => {
      if (document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
}

/** Horizontal swipe detection for touch navigation. */
export function useSwipe(onSwipe: (dir: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  // a second finger (pinch) cancels the swipe until all fingers are lifted
  const multi = useRef(false);
  return {
    onTouchStart: (e: TouchEvent) => {
      if (e.touches.length > 1) {
        multi.current = true;
        start.current = null;
        return;
      }
      multi.current = false;
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    },
    onTouchEnd: (e: TouchEvent) => {
      const s = start.current;
      if (e.touches.length === 0) start.current = null;
      if (!s || multi.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - s.t < 600) {
        onSwipe(dx < 0 ? 1 : -1);
      }
    },
  };
}

const LONG_PRESS_MS = 450;

/**
 * Tap vs. long press on one button (filter chips): returns the handlers to spread onto it.
 * A finger that moves (scrolling the chip bar) cancels the long press; the click after a long press is swallowed.
 */
export function useTapOrLongPress(onTap: () => void, onLongPress: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    start.current = null;
  };

  return {
    onPointerDown: (e: { clientX: number; clientY: number }) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        timer.current = undefined;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: { clientX: number; clientY: number }) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    onClick: () => {
      if (fired.current) {
        fired.current = false;
        return;
      }
      onTap();
    },
  };
}
