import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { useStore } from '../store';
import { addDays, dayKey, startOfDay } from '../lib/dates';
import { useEvents } from '../lib/events';
import { useHolidayMarks } from '../lib/holidays';
import { useSize } from '../lib/hooks';
import { useTodos } from '../lib/todos';
import { useShopping } from '../lib/shopping';
import {
  addWidget,
  moveWidget,
  removeWidget,
  resetLayout,
  resizeWidget,
  SIZES,
  useLayout,
  widgetDef,
  WIDGETS,
  type WidgetInstance,
} from '../lib/dashboard';
import type { ModuleId } from '../components/ModuleNav';
import type { SettingsTab } from '../settings/SettingsPanel';
import { DashCtx, WIDGET_COMPONENTS, type DashData } from './widgets';
import './dashboard.css';

const GAP = 12;
const LONG_PRESS_MS = 550;

interface Props {
  now: Date;
  reloadKey: number;
  editing: boolean;
  onEditing: (on: boolean) => void;
  openModule: (id: ModuleId) => void;
  startFrame: (startId?: string) => void;
  openSettings: (tab?: SettingsTab) => void;
}

/** columns by available width: iPad landscape 6, portrait 4, phone 2 */
function columnsFor(width: number) {
  return width >= 960 ? 6 : width >= 560 ? 4 : 2;
}

export function Dashboard({ now, reloadKey, editing, onEditing, openModule, startFrame, openSettings }: Props) {
  const { members, calendars, settings } = useStore();
  const layout = useLayout();
  const [gridRef, size] = useSize<HTMLDivElement>();
  const [gallery, setGallery] = useState(false);

  /* ---------------- shared data for all widgets */
  const todayKey = dayKey(now);
  const range = useMemo(() => {
    const start = startOfDay(new Date(todayKey + 'T12:00'));
    return { start, end: addDays(start, 2) };
  }, [todayKey]);
  const marksRange = useMemo(() => ({ start: range.start, end: addDays(range.start, 21) }), [range.start]);
  const holidaySettings = useMemo(
    () => ({ region: settings.holidays.region, showPublic: true, showSchool: true }),
    [settings.holidays.region],
  );
  const { marks } = useHolidayMarks(marksRange, holidaySettings);

  const [nonce, setNonce] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else setNonce((n) => n + 1);
  }, [reloadKey]);
  useEffect(() => {
    const t = setInterval(() => setNonce((n) => n + 1), settings.refreshMinutes * 60_000);
    const onVis = () => document.visibilityState === 'visible' && setNonce((n) => n + 1);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [settings.refreshMinutes]);
  const { events: raw } = useEvents(range, members, calendars, settings.proxyUrl, nonce);
  const events = useMemo(() => {
    const ids = new Set(members.map((m) => m.id));
    return raw.map((e) => ({ ...e, memberIds: e.memberIds.filter((id) => ids.has(id)) })).filter((e) => e.memberIds.length > 0);
  }, [raw, members]);

  const todos = useTodos();
  const shopping = useShopping();
  const data: DashData = { now, events, todos, shopping, marks, openModule, startFrame, openSettings };

  /* ---------------- grid geometry */
  const cols = columnsFor(size.width);
  const cellW = (size.width - GAP * (cols - 1)) / cols;
  const targetRows = cols === 6 ? 3 : cols === 4 ? 5 : 0;
  const rowH = Math.round(
    targetRows ? Math.max(118, (size.height - GAP * (targetRows - 1)) / targetRows) : Math.max(130, cellW * 0.95),
  );

  /* ---------------- long press, drag & drop */
  const press = useRef<{
    id: string;
    pointerId: number;
    x: number;
    y: number;
    armed: boolean;
    timer?: number;
  } | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; offX: number; offY: number; w: number; h: number } | null>(
    null,
  );
  const lastTarget = useRef<string | null>(null);

  // while armed/dragging, iOS must not scroll the page
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (press.current?.armed || drag) e.preventDefault();
    };
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, [gridRef, drag]);

  const endPress = () => {
    if (press.current?.timer) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const p = press.current;
      if (!p || e.pointerId !== p.pointerId) return;
      const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (!p.armed) {
        if (dist > 10) endPress(); // a scroll, not a long press
        return;
      }
      setDrag((d) => {
        if (d) return { ...d, x: e.clientX, y: e.clientY };
        if (dist < 6) return d;
        const el = document.querySelector<HTMLElement>(`[data-wid="${p.id}"]`);
        if (!el) return d;
        const r = el.getBoundingClientRect();
        suppressClick.current = true;
        lastTarget.current = null;
        return { id: p.id, x: e.clientX, y: e.clientY, offX: p.x - r.left, offY: p.y - r.top, w: r.width, h: r.height };
      });
      // swap with the widget under the finger
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-wid]');
      const target = hit?.dataset.wid ?? null;
      if (target === p.id) lastTarget.current = null;
      else if (target && target !== lastTarget.current) {
        lastTarget.current = target;
        moveWidget(p.id, target);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (press.current && e.pointerId !== press.current.pointerId) return;
      endPress();
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const onPointerDown = (w: WidgetInstance) => (e: RPointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.dw-edit-btn')) return;
    suppressClick.current = false;
    const p = { id: w.id, pointerId: e.pointerId, x: e.clientX, y: e.clientY, armed: editing, timer: undefined as number | undefined };
    if (!editing) {
      // interactive parts (checkboxes, items) keep their own tap
      if ((e.target as HTMLElement).closest('button')) return;
      p.timer = window.setTimeout(() => {
        p.armed = true;
        suppressClick.current = true;
        navigator.vibrate?.(10);
        onEditing(true);
      }, LONG_PRESS_MS);
    }
    press.current = p;
  };

  const onClick = (w: WidgetInstance) => () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (editing) return;
    const mod = widgetDef(w.type).module;
    if (mod) openModule(mod);
  };

  const cycleSize = (w: WidgetInstance) => {
    const sizes = widgetDef(w.type).sizes;
    resizeWidget(w.id, sizes[(sizes.indexOf(w.size) + 1) % sizes.length]);
  };

  const dragged = drag && layout.find((w) => w.id === drag.id);

  return (
    <DashCtx.Provider value={data}>
      {editing && (
        <div className="dash-toolbar">
          <span className="dash-hint muted">Ziehen zum Verschieben · ⤢ ändert die Größe</span>
          <span className="board-spacer" />
          <button className="btn ghost" onClick={() => confirm('Standard-Anordnung wiederherstellen?') && resetLayout()}>
            Zurücksetzen
          </button>
          <button className="btn" onClick={() => setGallery(true)}>
            ＋ Widget
          </button>
          <button className="btn primary" onClick={() => onEditing(false)}>
            Fertig
          </button>
        </div>
      )}
      <main
        ref={gridRef}
        className={`dash ${editing ? 'editing' : ''} ${drag ? 'dragging' : ''}`}
        style={{ '--cols': cols, '--row': `${rowH}px`, '--gap': `${GAP}px` } as CSSProperties}
      >
        {size.width > 0 &&
          layout.map((w, i) => {
            const s = SIZES[w.size];
            const Comp = WIDGET_COMPONENTS[w.type];
            return (
              <section
                key={w.id}
                data-wid={w.id}
                className={`dw dw-${w.type} size-${w.size} ${drag?.id === w.id ? 'placeholder' : ''}`}
                style={{ gridColumn: `span ${Math.min(s.w, cols)}`, gridRow: `span ${s.h}`, '--i': i } as CSSProperties}
                onPointerDown={onPointerDown(w)}
                onPointerUp={endPress}
                onClick={onClick(w)}
                onContextMenu={(e) => e.preventDefault()}
              >
                <div className="dw-inner">
                  <Comp size={w.size} />
                </div>
                {editing && (
                  <>
                    <button
                      className="dw-edit-btn dw-remove"
                      aria-label={`${widgetDef(w.type).title} entfernen`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeWidget(w.id);
                      }}
                    >
                      −
                    </button>
                    {widgetDef(w.type).sizes.length > 1 && (
                      <button
                        className="dw-edit-btn dw-resize"
                        aria-label="Größe ändern"
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleSize(w);
                        }}
                      >
                        ⤢ {SIZES[w.size].label}
                      </button>
                    )}
                  </>
                )}
              </section>
            );
          })}
        {size.width > 0 && layout.length === 0 && (
          <div className="dash-empty">
            <p>Das Dashboard ist leer.</p>
            <button
              className="btn primary"
              onClick={() => {
                onEditing(true);
                setGallery(true);
              }}
            >
              ＋ Widget hinzufügen
            </button>
          </div>
        )}
      </main>
      {drag && dragged && (
        <div
          className={`dw dw-${dragged.type} size-${dragged.size} dw-ghost`}
          style={{ left: drag.x - drag.offX, top: drag.y - drag.offY, width: drag.w, height: drag.h }}
        >
          <div className="dw-inner">{(() => {
            const Comp = WIDGET_COMPONENTS[dragged.type];
            return <Comp size={dragged.size} />;
          })()}</div>
        </div>
      )}
      {gallery && <Gallery onClose={() => setGallery(false)} />}
    </DashCtx.Provider>
  );
}

function Gallery({ onClose }: { onClose: () => void }) {
  return (
    <div className="dash-gallery-backdrop" onClick={onClose}>
      <div className="dash-gallery" role="dialog" aria-label="Widget hinzufügen" onClick={(e) => e.stopPropagation()}>
        <div className="dash-gallery-head">
          <h2>Widget hinzufügen</h2>
          <button className="btn" onClick={onClose}>
            Schließen
          </button>
        </div>
        <div className="dash-gallery-list">
          {WIDGETS.map((d) => (
            <div key={d.type} className="dash-gallery-item">
              <span className="dash-gallery-icon">{d.icon}</span>
              <div className="dash-gallery-text">
                <strong>{d.title}</strong>
                <span className="muted">{d.description}</span>
              </div>
              <div className="dash-gallery-sizes">
                {d.sizes.map((s) => (
                  <button
                    key={s}
                    className="dash-size-btn"
                    title={SIZES[s].label}
                    onClick={() => {
                      addWidget(d.type, s);
                      onClose();
                    }}
                  >
                    <span
                      className="dash-size-shape"
                      style={{ width: SIZES[s].w * 9 + (SIZES[s].w - 1) * 2, height: SIZES[s].h * 9 + (SIZES[s].h - 1) * 2 }}
                    />
                    {SIZES[s].label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
