import { useState } from 'react';
import { useStore } from '../../store';
import { addDays, dayKey, fmt } from '../../lib/dates';
import type { Todo } from '../../lib/todos';
import { gradient, Head, stop, useDash, useUndo, type WidgetProps } from './shared';
import { useToday } from '../../lib/clock';
import { t } from '../../i18n';

function sortTodos(list: Todo[]): Todo[] {
  return [...list].sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt - b.createdAt);
}

function dueLabel(due: string | undefined, now: Date): { text: string; cls: string } | null {
  if (!due) return null;
  const today = dayKey(now);
  if (due < today) return { text: t('dashboard.overdue'), cls: 'late' };
  if (due === today) return { text: t('dashboard.today'), cls: 'today' };
  if (due === dayKey(addDays(now, 1))) return { text: t('dashboard.tomorrow'), cls: '' };
  return { text: fmt(new Date(due + 'T12:00'), { day: 'numeric', month: 'numeric' }), cls: '' };
}

export function TodosWidget({ size }: WidgetProps) {
  const { todos } = useDash();
  const now = useToday();
  const { memberById } = useStore();
  const [setUndo, undoNode] = useUndo();
  const [leaving, setLeaving] = useState<string[]>([]);
  const open = sortTodos(todos.todos.filter((x) => !x.done && x.text.trim()));
  const dueToday = open.filter((x) => x.due && x.due <= dayKey(now)).length;

  const check = (todo: Todo) => {
    setLeaving((l) => [...l, todo.id]);
    setTimeout(() => {
      todos.toggleDone(todo.id);
      setLeaving((l) => l.filter((x) => x !== todo.id));
      setUndo({ label: t('dashboard.todoDone', { text: todo.text }), fn: () => todos.toggleDone(todo.id) });
    }, 350);
  };

  if (size === 's') {
    return (
      <div className="dw-count">
        <Head icon="📌" title={t('dashboard.widgets.todos.title')} />
        <div className="dw-count-num">{open.length}</div>
        <div className="dw-count-label">{t('dashboard.openTasks', { n: open.length })}</div>
        {dueToday > 0 && <div className="dw-count-hint">{t('dashboard.dueCount', { n: dueToday })}</div>}
        {undoNode}
      </div>
    );
  }

  return (
    <div className={`dw-todos ${size}`}>
      <Head icon="📌" title={t('dashboard.widgets.todos.title')} meta={open.length || undefined} />
      <div className={`dw-body dw-scroll ${size === 'm' ? 'two-col' : ''}`}>
        {open.length === 0 && <div className="dw-none">{t('dashboard.allDone')}</div>}
        {open.map((todo) => {
          const ms = todo.memberIds.map((id) => memberById.get(id)!).filter(Boolean);
          const due = dueLabel(todo.due, now);
          return (
            <div key={todo.id} className={`dw-todo ${leaving.includes(todo.id) ? 'leaving' : ''}`}>
              <button
                className="dw-check"
                style={{ borderColor: ms[0]?.color }}
                aria-label={t('dashboard.check', { name: todo.text })}
                onClick={(e) => {
                  stop(e);
                  check(todo);
                }}
              >
                <span className="dw-check-mark">✓</span>
              </button>
              <span className="dw-todo-text">{todo.text}</span>
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
