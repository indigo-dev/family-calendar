import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CalEvent, DayMarks, Member, Timetable } from '../../types';
import type { WidgetSize } from '../../lib/dashboard';
import type { ModuleId } from '../../components/ModuleNav';
import type { SettingsTab } from '../../settings/SettingsPanel';
import { fmtTime } from '../../lib/dates';
import { useTodos } from '../../lib/todos';
import { useShopping } from '../../lib/shopping';
import { schoolHours } from '../../lib/school';
import { t } from '../../i18n';

/* What all dashboard widgets share: the data of the dashboard, the head line, empty states, undo. */

export interface DashData {
  /** today and tomorrow, all family members */
  events: CalEvent[];
  todos: ReturnType<typeof useTodos>;
  shopping: ReturnType<typeof useShopping>;
  /** holiday marks for the next weeks */
  marks: Map<string, DayMarks>;
  openModule: (id: ModuleId) => void;
  startFrame: (startId?: string) => void;
  openSettings: (tab?: SettingsTab) => void;
}

export const DashCtx = createContext<DashData | null>(null);
export const useDash = () => useContext(DashCtx)!;

export interface WidgetProps {
  size: WidgetSize;
}

/** Stops the tap from reaching the widget (which would open the module). */
export const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function Head({ icon, title, meta }: { icon: string; title: string; meta?: ReactNode }) {
  return (
    <div className="dw-head">
      <span className="dw-head-icon" aria-hidden>
        {icon}
      </span>
      <span className="dw-head-title">{title}</span>
      {meta != null && <span className="dw-head-meta">{meta}</span>}
    </div>
  );
}

export function Empty({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <div className="dw-empty">
      <span>{children}</span>
      {action && (
        <button
          className="dw-link"
          onClick={(e) => {
            stop(e);
            onAction?.();
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

/** Small "Rückgängig" pill after checking something off in a widget. */
export function useUndo() {
  const [undo, setUndo] = useState<{ label: string; fn: () => void } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(t);
  }, [undo]);
  const node = undo && (
    <button
      className="dw-undo"
      onClick={(e) => {
        stop(e);
        undo.fn();
        setUndo(null);
      }}
    >
      <span className="dw-undo-text">{undo.label}</span> {t('dashboard.undo')}
    </button>
  );
  return [setUndo, node] as const;
}

export const gradient = (members: Member[]) =>
  members.length <= 1 ? (members[0]?.color ?? 'var(--muted)') : `linear-gradient(135deg, ${members.map((m) => m.color).join(', ')})`;

export const hhmm = (d: Date) => fmtTime(d);

export const lastEnd = (t: Timetable, idx: number): string | null => schoolHours(t, idx)?.end ?? null;
