import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { useStore } from '../store';
import { addDays, dayKey, startOfDay } from '../lib/dates';
import { proxyOf, useEvents } from '../lib/events';
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
  type WidgetSize,
} from '../lib/dashboard';
import type { ModuleId } from '../components/ModuleNav';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Modal } from '../components/Modal';
import type { SettingsTab } from '../settings/SettingsPanel';
import { DashCtx, WIDGET_COMPONENTS, type DashData } from './widgets';
import './dashboard.css';
import { useToday } from '../lib/clock';
import { t } from '../i18n';

const GAP = 12;
const LONG_PRESS_MS = 550;

interface Props {
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

export function Dashboard({ reloadKey, editing, onEditing, openModule, startFrame, openSettings }: Props) {
  const { members, calendars, settings } = useStore();
  const layout = useLayout();
  const [gridRef, size] = useSize<HTMLDivElement>();
  const [gallery, setGallery] = useState(false);

  /* ---------------- shared data for all widgets */
  const todayKey = dayKey(useToday());
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
  const { events: raw } = useEvents(range, members, calendars, proxyOf(settings), nonce);
  const events = useMemo(() => {
    const ids = new Set(members.map((m) => m.id));
    return raw.map((e) => ({ ...e, memberIds: e.memberIds.filter((id) => ids.has(id)) })).filter((e) => e.memberIds.length > 0);
  }, [raw, members]);

  const todos = useTodos();
  const shopping = useShopping();
  const data = useMemo<DashData>(
    () => ({ events, todos, shopping, marks, openModule, startFrame, openSettings }),
    [events, todos, shopping, marks, openModule, startFrame, openSettings],
  );

  /* ---------------- grid geometry */
  const cols = columnsFor(size.width);
  const cellW = (size.width - GAP * (cols - 1)) / cols;
  const targetRows = cols === 6 ? 3 : cols === 4 ? 5 : 0;
  const rowH = Math.round(targetRows ? Math.max(118, (size.height - GAP * (targetRows - 1)) / targetRows) : Math.max(130, cellW * 0.95));

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
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; offX: number; offY: number; w: number; h: number } | null>(null);
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

  /* ---------------- size menu */
  const [sizeMenu, setSizeMenu] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [wasEditing, setWasEditing] = useState(editing);
  if (wasEditing !== editing) {
    setWasEditing(editing);
    if (!editing) setSizeMenu(null);
  }
  const menuWidget = sizeMenu && layout.find((w) => w.id === sizeMenu.id);

  /* ---------------- smooth layout changes (FLIP): widgets glide from their old place and size */
  const boxes = useRef(new Map<string, { x: number; y: number; w: number; h: number; size: WidgetSize }>());
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prev = boxes.current;
    const next = new Map<string, { x: number; y: number; w: number; h: number; size: WidgetSize }>();
    grid.querySelectorAll<HTMLElement>(':scope > [data-wid]').forEach((el) => {
      const id = el.dataset.wid!;
      const box = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, size: el.dataset.size as WidgetSize };
      next.set(id, box);
      if (reduce || !el.animate) return;
      const old = prev.get(id);
      if (!old) {
        if (prev.size > 0)
          el.animate(
            [
              { opacity: 0, scale: '0.9' },
              { opacity: 1, scale: '1' },
            ],
            { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' },
          );
        return;
      }
      const dx = old.x + old.w / 2 - (box.x + box.w / 2);
      const dy = old.y + old.h / 2 - (box.y + box.h / 2);
      const sx = old.w / box.w;
      const sy = old.h / box.h;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.005 && Math.abs(sy - 1) < 0.005) return;
      // `translate`/`scale` are separate from `transform`, so the wiggle keeps running
      el.animate(
        [
          { translate: `${dx}px ${dy}px`, scale: `${sx} ${sy}` },
          { translate: '0 0', scale: '1 1' },
        ],
        {
          duration: 380,
          easing: 'cubic-bezier(.2,.8,.2,1)',
        },
      );
      // new size: let the content fade in instead of showing it stretched
      if (old.size !== box.size) {
        el.querySelector('.dw-inner')?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], { duration: 380 });
      }
    });
    boxes.current = next;
  }, [layout, cols, rowH, size.width, gridRef]);

  const dragged = drag && layout.find((w) => w.id === drag.id);

  return (
    <DashCtx.Provider value={data}>
      {editing && (
        <div className="dash-toolbar">
          <span className="dash-hint muted">{t('dashboard.hint')}</span>
          <span className="board-spacer" />
          <button className="btn ghost" onClick={() => confirm(t('dashboard.confirmReset')) && resetLayout()}>
            {t('common.reset')}
          </button>
          <button className="btn" onClick={() => setGallery(true)}>
            {t('dashboard.addWidget')}
          </button>
          <button className="btn primary" onClick={() => onEditing(false)}>
            {t('common.done')}
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
            const span = Math.min(s.w, cols);
            // wiggle angle so the corners move ~1.2px whatever the widget's size
            const halfDiag = Math.hypot(span * cellW + (span - 1) * GAP, s.h * rowH + (s.h - 1) * GAP) / 2;
            const wig = Math.min(0.9, Math.max(0.12, (1.2 / halfDiag) * (180 / Math.PI)));
            return (
              <section
                key={w.id}
                data-wid={w.id}
                data-size={w.size}
                className={`dw dw-${w.type} size-${w.size} ${drag?.id === w.id ? 'placeholder' : ''} ${sizeMenu?.id === w.id ? 'menu-open' : ''}`}
                style={{ gridColumn: `span ${span}`, gridRow: `span ${s.h}`, '--i': i, '--wig': `${wig.toFixed(3)}deg` } as CSSProperties}
                onPointerDown={onPointerDown(w)}
                onPointerUp={endPress}
                onClick={onClick(w)}
                onContextMenu={(e) => e.preventDefault()}
              >
                <div className="dw-inner">
                  <ErrorBoundary label={widgetDef(w.type).title} compact>
                    <Comp size={w.size} />
                  </ErrorBoundary>
                </div>
                {editing && (
                  <>
                    <button
                      className="dw-edit-btn dw-remove"
                      aria-label={t('dashboard.removeWidget', { title: widgetDef(w.type).title })}
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
                        aria-label={t('dashboard.resize', { size: SIZES[w.size].label, w: s.w, h: s.h })}
                        aria-haspopup="menu"
                        aria-expanded={sizeMenu?.id === w.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setSizeMenu((m) => (m?.id === w.id ? null : { id: w.id, rect }));
                        }}
                      >
                        <SizeGlyph size={w.size} />
                        {s.w}×{s.h}
                      </button>
                    )}
                  </>
                )}
              </section>
            );
          })}
        {size.width > 0 && layout.length === 0 && (
          <div className="dash-empty">
            <p>{t('dashboard.empty')}</p>
            <button
              className="btn primary"
              onClick={() => {
                onEditing(true);
                setGallery(true);
              }}
            >
              {t('dashboard.addWidgetLong')}
            </button>
          </div>
        )}
      </main>
      {drag && dragged && (
        <div
          className={`dw dw-${dragged.type} size-${dragged.size} dw-ghost`}
          style={{ left: drag.x - drag.offX, top: drag.y - drag.offY, width: drag.w, height: drag.h }}
        >
          <div className="dw-inner">
            {(() => {
              const Comp = WIDGET_COMPONENTS[dragged.type];
              return <Comp size={dragged.size} />;
            })()}
          </div>
        </div>
      )}
      {gallery && <Gallery onClose={() => setGallery(false)} />}
      {sizeMenu && menuWidget && (
        <SizeMenu
          widget={menuWidget}
          anchor={sizeMenu.rect}
          onPick={(s) => {
            resizeWidget(menuWidget.id, s);
            setSizeMenu(null);
          }}
          onClose={() => setSizeMenu(null)}
        />
      )}
    </DashCtx.Provider>
  );
}

/** footprint of a widget size, drawn in a 3×2 grid */
function SizeGlyph({ size }: { size: WidgetSize }) {
  const { w, h } = SIZES[size];
  return (
    <span className="size-glyph" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <i key={i} className={i % 3 < w && Math.floor(i / 3) < h ? 'on' : ''} />
      ))}
    </span>
  );
}

const MENU_W = 250;

/** pick one of the sizes the widget offers – shown next to the size button, outside the wiggling grid */
function SizeMenu({
  widget,
  anchor,
  onPick,
  onClose,
}: {
  widget: WidgetInstance;
  anchor: DOMRect;
  onPick: (s: WidgetSize) => void;
  onClose: () => void;
}) {
  const def = widgetDef(widget.type);
  const height = 44 + def.sizes.length * 54;
  const below = anchor.bottom + 8 + height < window.innerHeight;
  const top = below ? anchor.bottom + 8 : Math.max(8, anchor.top - 8 - height);
  const left = Math.min(window.innerWidth - MENU_W - 8, Math.max(8, anchor.right - MENU_W));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="size-menu-backdrop" onPointerDown={onClose} />
      <div
        className="size-menu"
        role="menu"
        aria-label={t('dashboard.sizeOf', { title: def.title })}
        style={{ top, left, '--origin': below ? 'top right' : 'bottom right' } as CSSProperties}
      >
        <div className="size-menu-title">{t('dashboard.sizeTitle', { title: def.title })}</div>
        {def.sizes.map((s) => (
          <button
            key={s}
            role="menuitemradio"
            aria-checked={widget.size === s}
            className={`size-opt ${widget.size === s ? 'on' : ''}`}
            onClick={() => onPick(s)}
          >
            <span className="size-opt-glyph">
              <SizeGlyph size={s} />
            </span>
            <span className="size-opt-label">{SIZES[s].label}</span>
            <span className="size-opt-dim">
              {SIZES[s].w} × {SIZES[s].h}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function Gallery({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} layerClass="dash-gallery-backdrop" label={t('dashboard.gallery')}>
      <div className="dash-gallery">
        <div className="dash-gallery-head">
          <h2>{t('dashboard.gallery')}</h2>
          <button className="btn" onClick={onClose}>
            {t('common.close')}
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
                    <SizeGlyph size={s} />
                    <span>
                      {SIZES[s].w}×{SIZES[s].h}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
