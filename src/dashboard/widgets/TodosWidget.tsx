import { useState } from 'react';
import { useStore } from '../../store';
import { addDays, dayKey, fmt } from '../../lib/dates';
import type { Todo } from '../../lib/todos';
import { gradient, Head, stop, useDash, useUndo, type WidgetProps } from './shared';
import { useToday } from '../../lib/clock';

function sortTodos(list: Todo[]): Todo[] {
  return [...list].sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt - b.createdAt);
}

function dueLabel(due: string | undefined, now: Date): { text: string; cls: string } | null {
  if (!due) return null;
  const today = dayKey(now);
  if (due < today) return { text: 'überfällig', cls: 'late' };
  if (due === today) return { text: 'heute', cls: 'today' };
  if (due === dayKey(addDays(now, 1))) return { text: 'morgen', cls: '' };
  return { text: fmt(new Date(due + 'T12:00'), { day: 'numeric', month: 'numeric' }), cls: '' };
}

export function TodosWidget({ size }: WidgetProps) {
  const { todos } = useDash();
  const now = useToday();
  const { memberById } = useStore();
  const [setUndo, undoNode] = useUndo();
  const [leaving, setLeaving] = useState<string[]>([]);
  const open = sortTodos(todos.todos.filter((t) => !t.done && t.text.trim()));
  const dueToday = open.filter((t) => t.due && t.due <= dayKey(now)).length;

  const check = (t: Todo) => {
    setLeaving((l) => [...l, t.id]);
    setTimeout(() => {
      todos.toggleDone(t.id);
      setLeaving((l) => l.filter((x) => x !== t.id));
      setUndo({ label: `„${t.text}“ erledigt`, fn: () => todos.toggleDone(t.id) });
    }, 350);
  };

  if (size === 's') {
    return (
      <div className="dw-count">
        <Head icon="📌" title="To-dos" />
        <div className="dw-count-num">{open.length}</div>
        <div className="dw-count-label">{open.length === 1 ? 'offene Aufgabe' : 'offene Aufgaben'}</div>
        {dueToday > 0 && <div className="dw-count-hint">{dueToday} fällig</div>}
        {undoNode}
      </div>
    );
  }

  return (
    <div className={`dw-todos ${size}`}>
      <Head icon="📌" title="To-dos" meta={open.length || undefined} />
      <div className={`dw-body dw-scroll ${size === 'm' ? 'two-col' : ''}`}>
        {open.length === 0 && <div className="dw-none">Alles erledigt 🎉</div>}
        {open.map((t) => {
          const ms = t.memberIds.map((id) => memberById.get(id)!).filter(Boolean);
          const due = dueLabel(t.due, now);
          return (
            <div key={t.id} className={`dw-todo ${leaving.includes(t.id) ? 'leaving' : ''}`}>
              <button
                className="dw-check"
                style={{ borderColor: ms[0]?.color }}
                aria-label={`${t.text} abhaken`}
                onClick={(e) => {
                  stop(e);
                  check(t);
                }}
              >
                <span className="dw-check-mark">✓</span>
              </button>
              <span className="dw-todo-text">{t.text}</span>
              {due && <span className={`dw-due ${due.cls}`}>{due.text}</span>}
              <span className="dw-todo-dot" style={{ background: gradient(ms) }} />
            </div>
          );
        })}
      </div>
      {undoNode}
    </div>
  );
}
