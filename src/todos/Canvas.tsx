import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Member } from '../types';
import type { Todo } from '../lib/todos';

import { autoPlace, clampSize, NOTE_H, NOTE_W, PAD, type Gesture, type Live } from './layout';
import { Note } from './Note';
import { t as tr } from '../i18n';

export function Canvas({
  all,
  visible,
  membersOf,
  today,
  onOpen,
  onToggle,
  onNew,
  patchMany,
}: {
  all: Todo[];
  visible: Todo[];
  membersOf: (t: Todo) => Member[];
  today: Date;
  onOpen: (t: Todo) => void;
  onToggle: (t: Todo) => void;
  onNew: () => void;
  patchMany: (p: Record<string, Partial<Todo>>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [live, setLive] = useState<Live | null>(null);
  const liveRef = useRef<Live | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const allRef = useRef(all);
  useLayoutEffect(() => {
    allRef.current = all;
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // new notes (and "Aufräumen") get a free spot
  useEffect(() => {
    if (width <= 0 || !all.some((t) => t.x == null || t.y == null)) return;
    patchMany(autoPlace(all, width));
  }, [all, width, patchMany]);

  const setLiveBoth = (l: Live | null) => {
    liveRef.current = l;
    setLive(l);
  };
  const posOf = (t: Todo): Live => ({ id: t.id, x: t.x ?? 0, y: t.y ?? 0, size: t.size ?? 1, z: t.z ?? 0 });
  const topZ = () => Math.max(0, ...allRef.current.map((t) => t.z ?? 0)) + 1;

  // native listeners: no page scroll / Safari page zoom while a note is held; ctrl+wheel (trackpad pinch) resizes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const block = (e: Event) => {
      if (gesture.current) e.preventDefault();
    };
    const noZoom = (e: Event) => e.preventDefault();
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      const id = (e.target as HTMLElement).closest<HTMLElement>('[data-note]')?.dataset.note;
      const t = id && allRef.current.find((x) => x.id === id);
      e.preventDefault();
      if (!t) return;
      patchMany({ [t.id]: { size: clampSize((t.size ?? 1) * Math.exp(-e.deltaY / 120)) } });
    };
    el.addEventListener('touchmove', block, { passive: false });
    el.addEventListener('gesturestart', noZoom);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('touchmove', block);
      el.removeEventListener('gesturestart', noZoom);
      el.removeEventListener('wheel', wheel);
    };
  }, [patchMany]);

  // capture fails for pointers the browser no longer knows (e.g. already lifted) – the gesture still works
  const capture = (pointerId: number) => {
    try {
      ref.current?.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  };

  const beginPinch = (g: Gesture) => {
    const [a, b] = [...g.pointers.values()];
    const cur = liveRef.current ?? g.start;
    const rect = ref.current!.getBoundingClientRect();
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    g.mode = 'pinch';
    g.start = { ...cur, z: liveRef.current ? cur.z : topZ() };
    g.origin = mid;
    g.startDist = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
    g.anchor = {
      x: mid.x - rect.left + ref.current!.scrollLeft - cur.x,
      y: mid.y - rect.top + ref.current!.scrollTop - cur.y,
    };
    setLiveBoth({ ...g.start });
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (g) {
      // second finger anywhere on the board -> pinch the held note
      if (g.pointers.size === 1 && g.mode !== 'resize' && e.pointerType === 'touch') {
        g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        capture(e.pointerId);
        beginPinch(g);
      }
      return;
    }
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    const id = target.closest<HTMLElement>('[data-note]')?.dataset.note;
    const t = id && allRef.current.find((x) => x.id === id);
    if (!t) return;
    e.preventDefault();
    capture(e.pointerId);
    gesture.current = {
      id: t.id,
      mode: target.closest('.note-resize') ? 'resize' : 'press',
      pointers: new Map([[e.pointerId, { x: e.clientX, y: e.clientY }]]),
      origin: { x: e.clientX, y: e.clientY },
      start: { ...posOf(t), z: target.closest('.note-resize') ? topZ() : (t.z ?? 0) },
    };
  };

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || !g.pointers.has(e.pointerId)) return;
    const p = { x: e.clientX, y: e.clientY };
    g.pointers.set(e.pointerId, p);
    const dx = p.x - g.origin.x;
    const dy = p.y - g.origin.y;
    const s = g.start;
    if (g.mode === 'press') {
      if (Math.hypot(dx, dy) < 6) return;
      g.mode = 'drag';
      g.start = { ...s, z: topZ() };
    }
    if (g.mode === 'drag') {
      setLiveBoth({ ...g.start, x: Math.max(0, g.start.x + dx), y: Math.max(0, g.start.y + dy) });
    } else if (g.mode === 'resize') {
      const k = ((NOTE_W * s.size + dx) / (NOTE_W * s.size) + (NOTE_H * s.size + dy) / (NOTE_H * s.size)) / 2;
      setLiveBoth({ ...s, size: clampSize(s.size * k) });
    } else if (g.mode === 'pinch' && g.pointers.size >= 2) {
      const [a, b] = [...g.pointers.values()];
      const size = clampSize((s.size * Math.hypot(a.x - b.x, a.y - b.y)) / g.startDist!);
      const k = size / s.size;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      setLiveBoth({
        ...s,
        size,
        x: Math.max(0, s.x + (mid.x - g.origin.x) + g.anchor!.x * (1 - k)),
        y: Math.max(0, s.y + (mid.y - g.origin.y) + g.anchor!.y * (1 - k)),
      });
    }
  };

  const end = (e: RPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!g || !g.pointers.has(e.pointerId)) return;
    g.pointers.delete(e.pointerId);
    if (g.pointers.size > 0) {
      // one finger left after a pinch: keep dragging with it
      if (g.mode === 'pinch') {
        g.mode = 'drag';
        g.start = liveRef.current ?? g.start;
        g.origin = [...g.pointers.values()][0];
      }
      return;
    }
    gesture.current = null;
    const l = liveRef.current;
    if (g.mode === 'press') {
      if (!cancelled) {
        const t = allRef.current.find((x) => x.id === g.id);
        if (t) onOpen(t);
      }
    } else if (l) {
      patchMany({ [l.id]: { x: Math.round(l.x), y: Math.round(l.y), size: Math.round(l.size * 100) / 100, z: l.z } });
    }
    setLiveBoth(null);
  };

  // plane grows with the notes so the board scrolls when notes are dragged further out
  let planeW = 0;
  let planeH = 0;
  for (const t of visible) {
    const p = live?.id === t.id ? live : posOf(t);
    planeW = Math.max(planeW, p.x + NOTE_W * p.size);
    planeH = Math.max(planeH, p.y + NOTE_H * p.size + PAD);
  }

  return (
    <div
      ref={ref}
      className={`todo-canvas ${live ? 'gesturing' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => end(e, false)}
      onPointerCancel={(e) => end(e, true)}
    >
      <div className="todo-plane" style={{ width: planeW, height: planeH }}>
        {visible.map((t) => {
          if (t.x == null || t.y == null) return null; // placed on the next render
          const p = live?.id === t.id ? live : posOf(t);
          return (
            <div
              key={t.id}
              data-note={t.id}
              className={`note-slot ${live?.id === t.id ? 'lifted' : ''}`}
              style={{ left: p.x, top: p.y, zIndex: live?.id === t.id ? 100000 : p.z }}
              role="button"
              tabIndex={0}
              aria-label={tr('todos.editNote', { text: t.text })}
              onKeyDown={(e) => e.key === 'Enter' && onOpen(t)}
            >
              <Note todo={t} members={membersOf(t)} today={today} size={p.size} onToggle={() => onToggle(t)} resizable />
            </div>
          );
        })}
      </div>
      {visible.length === 0 && (
        <div className="todo-empty">
          <div className="todo-empty-card">
            <strong>{tr('todos.allDone')}</strong>
            <span className="muted">{tr('todos.noneOpen')}</span>
            <button className="btn primary" onClick={onNew}>
              {tr('todos.newNote')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
