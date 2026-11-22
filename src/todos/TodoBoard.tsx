import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import type { Member } from '../types';
import { useStore } from '../store';
import { addDays, fmt, startOfDay } from '../lib/dates';
import { dayKey, newTodo, useTodos, type Todo } from '../lib/todos';
import { Avatar, AvatarStack } from '../components/Avatar';
import './todos.css';

type Tab = 'open' | 'done';

/** note size at scale 1 */
const NOTE_W = 208;
const NOTE_H = 168;
const GAP = 14;
const PAD = 14;
const MIN_SIZE = 0.6;
const MAX_SIZE = 2.2;
const clampSize = (s: number) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, s));

const tint = (c: string, pct = 16) => `color-mix(in srgb, ${c} ${pct}%, var(--surface))`;

function noteStyle(members: Member[]): CSSProperties {
  const colors = members.map((m) => m.color);
  if (colors.length === 0) colors.push('var(--muted)');
  return {
    background: colors.length === 1 ? tint(colors[0]) : `linear-gradient(135deg, ${colors.map((c) => tint(c)).join(', ')})`,
    ['--note-c' as string]: colors[0],
    ['--note-strip' as string]: colors.length === 1 ? colors[0] : `linear-gradient(90deg, ${colors.join(', ')})`,
  };
}

function dueInfo(due: string | undefined, today: Date): { label: string; tone: 'late' | 'today' | 'soon' | '' } | null {
  if (!due) return null;
  const [y, m, d] = due.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { label: diff === -1 ? 'seit gestern' : `seit ${fmt(date, { day: 'numeric', month: 'numeric' })}`, tone: 'late' };
  if (diff === 0) return { label: 'Heute', tone: 'today' };
  if (diff === 1) return { label: 'Morgen', tone: 'soon' };
  if (diff < 7) return { label: fmt(date, { weekday: 'long' }), tone: '' };
  return { label: fmt(date, { weekday: 'short', day: 'numeric', month: 'numeric' }), tone: '' };
}

/** board order for auto placement: due first, then newest */
function sortOpen(a: Todo, b: Todo): number {
  if (a.due && b.due) return a.due.localeCompare(b.due) || b.createdAt - a.createdAt;
  if (a.due) return -1;
  if (b.due) return 1;
  return b.createdAt - a.createdAt;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;

/** finds a free spot (row by row, left to right) for every note without a position */
function autoPlace(open: Todo[], width: number): Record<string, Partial<Todo>> {
  const placed: Rect[] = open
    .filter((t) => t.x != null && t.y != null)
    .map((t) => ({ x: t.x!, y: t.y!, w: NOTE_W * (t.size ?? 1), h: NOTE_H * (t.size ?? 1) }));
  const fresh = open.filter((t) => t.x == null || t.y == null).sort(sortOpen);
  // narrow boards (phones): two notes side by side
  const defaultSize = width < 560 ? Math.max(MIN_SIZE, Math.floor(((width - 2 * PAD - GAP - 4) / 2 / NOTE_W) * 100) / 100) : 1;
  const out: Record<string, Partial<Todo>> = {};
  for (const t of fresh) {
    const size = t.size ?? defaultSize;
    const w = NOTE_W * size;
    const h = NOTE_H * size;
    const stepX = (NOTE_W * defaultSize + GAP) / 2;
    const stepY = (NOTE_H * defaultSize + GAP) / 2;
    let spot: Rect | null = null;
    for (let row = 0; row < 400 && !spot; row++) {
      for (let col = 0; ; col++) {
        const x = PAD + col * stepX;
        if (col > 0 && x + w > width - PAD) break;
        const r = { x, y: PAD + row * stepY, w, h };
        if (!placed.some((p) => overlaps(p, r))) {
          spot = r;
          break;
        }
      }
    }
    if (!spot) spot = { x: PAD, y: PAD, w, h };
    placed.push(spot);
    out[t.id] = { x: Math.round(spot.x), y: Math.round(spot.y), size };
  }
  return out;
}

interface Live {
  id: string;
  x: number;
  y: number;
  size: number;
  z: number;
}

interface Gesture {
  id: string;
  mode: 'press' | 'drag' | 'pinch' | 'resize';
  pointers: Map<number, { x: number; y: number }>;
  /** pointer position when the current mode started */
  origin: { x: number; y: number };
  start: Live;
  startDist?: number;
  /** midpoint of the fingers relative to the note's top left (board px) when the pinch started */
  anchor?: { x: number; y: number };
}

export function TodoBoard({ now }: { now: Date }) {
  const { members, memberById, selectedIds } = useStore();
  const { todos, upsert, remove, toggleDone, clearDone, patchMany } = useTodos();
  const [tab, setTab] = useState<Tab>('open');
  const [editing, setEditing] = useState<Todo | null>(null);
  const today = startOfDay(now);

  const membersOf = (t: Todo) => t.memberIds.map((id) => memberById.get(id)).filter((m): m is Member => !!m);
  const visibleFor = (t: Todo) => selectedIds.size === 0 || t.memberIds.some((id) => selectedIds.has(id));

  const open = useMemo(() => todos.filter((t) => !t.done), [todos]);
  const done = useMemo(
    () => todos.filter((t) => t.done && visibleFor(t)).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todos, selectedIds],
  );
  const openVisible = open.filter(visibleFor);

  const startNew = () => {
    const pre = selectedIds.size > 0 ? [...selectedIds] : members.length === 1 ? [members[0].id] : [];
    setEditing(newTodo(pre));
  };

  return (
    <>
      <div className="board-toolbar">
        <div className="segmented small" role="tablist">
          <button role="tab" aria-selected={tab === 'open'} className={tab === 'open' ? 'active' : ''} onClick={() => setTab('open')}>
            Offen · {openVisible.length}
          </button>
          <button role="tab" aria-selected={tab === 'done'} className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')}>
            Erledigt · {done.length}
          </button>
        </div>
        <span className="board-spacer" />
        {tab === 'open' && openVisible.length > 1 && (
          <button
            className="btn"
            title="Alle Zettel wieder ordentlich nebeneinander legen"
            onClick={() => patchMany(Object.fromEntries(open.map((t) => [t.id, { x: undefined, y: undefined }])))}
          >
            Aufräumen
          </button>
        )}
        {tab === 'done' && done.length > 0 && (
          <button className="btn danger" onClick={() => confirm('Alle erledigten Zettel entfernen?') && clearDone()}>
            Alle entfernen
          </button>
        )}
        <button className="btn primary" onClick={startNew} disabled={members.length === 0}>
          + Neuer Zettel
        </button>
      </div>
      <main className="view todo-view">
        {members.length === 0 ? (
          <div className="todo-empty">Lege zuerst in den Einstellungen die Familie an.</div>
        ) : tab === 'open' ? (
          <Canvas
            all={open}
            visible={openVisible}
            membersOf={membersOf}
            today={today}
            onOpen={setEditing}
            onToggle={(t) => toggleDone(t.id)}
            onNew={startNew}
            patchMany={patchMany}
          />
        ) : done.length === 0 ? (
          <div className="todo-empty">Noch nichts erledigt.</div>
        ) : (
          <div className="todo-done-grid">
            {done.map((t) => (
              <Note
                key={t.id}
                todo={t}
                members={membersOf(t)}
                today={today}
                onToggle={() => toggleDone(t.id)}
                onOpen={() => setEditing(t)}
              />
            ))}
          </div>
        )}
      </main>
      {editing && (
        <TodoEditor
          todo={editing}
          isNew={!todos.some((t) => t.id === editing.id)}
          today={today}
          onSave={(t) => {
            upsert(t);
            setEditing(null);
          }}
          onDelete={() => {
            remove(editing.id);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

/** Free board: drag a note to move it, pinch it (or drag its corner / ctrl+scroll) to resize it. */
function Canvas({
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
              aria-label={`Bearbeiten: ${t.text}`}
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
            <strong>Alles erledigt</strong>
            <span className="muted">Keine offenen To-dos.</span>
            <button className="btn primary" onClick={onNew}>
              + Neuer Zettel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Note({
  todo,
  members,
  today,
  size = 1,
  onToggle,
  onOpen,
  resizable,
}: {
  todo: Todo;
  members: Member[];
  today: Date;
  size?: number;
  onToggle: () => void;
  onOpen?: () => void;
  resizable?: boolean;
}) {
  const due = todo.done ? null : dueInfo(todo.due, today);
  // long text or long German compound words -> smaller text
  const longestWord = Math.max(0, ...todo.text.split(/\s+/).map((w) => w.length));
  const len = Math.max(todo.text.length, longestWord > 15 ? 91 : longestWord > 11 ? 46 : 0);
  return (
    <div
      className={`note ${todo.done ? 'done' : ''} ${due?.tone === 'late' ? 'late' : ''}`}
      style={{ ...noteStyle(members), zoom: size }}
      onClick={onOpen}
    >
      <div className="note-head">
        <AvatarStack members={members} size={24} />
        <button
          className={`note-check ${todo.done ? 'on' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-label={todo.done ? 'Wieder offen' : 'Erledigt'}
          aria-pressed={todo.done}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 12.5l4 4 8-9" />
          </svg>
        </button>
      </div>
      <p className={`note-text ${len > 90 ? 'xs' : len > 45 ? 'sm' : ''}`}>{todo.text}</p>
      {due && <span className={`note-due ${due.tone}`}>{due.label}</span>}
      {resizable && <span className="note-resize" aria-hidden />}
    </div>
  );
}

type DueChoice = 'none' | 'today' | 'tomorrow' | 'date';

function TodoEditor({
  todo,
  isNew,
  today,
  onSave,
  onDelete,
  onClose,
}: {
  todo: Todo;
  isNew: boolean;
  today: Date;
  onSave: (t: Todo) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { members } = useStore();
  const [text, setText] = useState(todo.text);
  const [memberIds, setMemberIds] = useState(todo.memberIds);
  const [due, setDue] = useState(todo.due ?? '');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);

  const todayKey = dayKey(today);
  const tomorrowKey = dayKey(addDays(today, 1));
  const choice: DueChoice = !due ? 'none' : due === todayKey ? 'today' : due === tomorrowKey ? 'tomorrow' : 'date';
  const valid = text.trim().length > 0 && memberIds.some((id) => members.some((m) => m.id === id));
  const toggle = (id: string) => setMemberIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const save = () => valid && onSave({ ...todo, text: text.trim(), memberIds, due: due || undefined });
  const preview = members.filter((m) => memberIds.includes(m.id));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal todo-editor" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="todo-editor-paper" style={noteStyle(preview)}>
          <textarea
            ref={ref}
            value={text}
            maxLength={200}
            rows={3}
            placeholder="Was ist zu tun?"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                save();
              }
            }}
          />
        </div>
        <div className="todo-editor-section">
          <div className="muted small">Für wen?</div>
          <div className="todo-editor-members">
            {members.map((m) => {
              const on = memberIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  className={`chip ${on ? 'on' : 'off'}`}
                  style={{
                    borderColor: on ? m.color : undefined,
                    background: on ? `color-mix(in srgb, ${m.color} 22%, var(--surface))` : undefined,
                  }}
                  aria-pressed={on}
                  onClick={() => toggle(m.id)}
                >
                  <Avatar member={m} size={30} ring={false} />
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="todo-editor-section">
          <div className="muted small">Bis wann?</div>
          <div className="todo-editor-due">
            <div className="segmented small">
              {(
                [
                  ['none', 'Offen'],
                  ['today', 'Heute'],
                  ['tomorrow', 'Morgen'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  className={choice === id ? 'active' : ''}
                  onClick={() => setDue(id === 'none' ? '' : id === 'today' ? todayKey : tomorrowKey)}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="date"
              className={`todo-date ${choice === 'date' ? 'active' : ''}`}
              value={due}
              onChange={(e) => setDue(e.target.value)}
              aria-label="Datum"
            />
          </div>
        </div>
        <div className="modal-actions todo-editor-actions">
          {!isNew && (
            <button className="btn danger" onClick={onDelete}>
              Löschen
            </button>
          )}
          <span className="board-spacer" />
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn primary" onClick={save} disabled={!valid}>
            {isNew ? 'Hinzufügen' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
