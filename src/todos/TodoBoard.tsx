import { useMemo, useState } from 'react';
import type { Member } from '../types';
import { useStore } from '../store';
import { startOfDay } from '../lib/dates';
import { newTodo, useTodos, type Todo } from '../lib/todos';
import './todos.css';
import { Canvas } from './Canvas';
import { Note } from './Note';
import { TodoEditor } from './TodoEditor';
import { useToday } from '../lib/clock';
import { t } from '../i18n';

type Tab = 'open' | 'done';

export function TodoBoard() {
  const now = useToday();
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
            {t('todos.open', { n: openVisible.length })}
          </button>
          <button role="tab" aria-selected={tab === 'done'} className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')}>
            {t('todos.done', { n: done.length })}
          </button>
        </div>
        <span className="board-spacer" />
        {tab === 'open' && openVisible.length > 1 && (
          <button
            className="btn"
            title={t('todos.tidyHint')}
            onClick={() => patchMany(Object.fromEntries(open.map((x) => [x.id, { x: undefined, y: undefined }])))}
          >
            {t('todos.tidy')}
          </button>
        )}
        {tab === 'done' && done.length > 0 && (
          <button className="btn danger" onClick={() => confirm(t('todos.confirmClear')) && clearDone()}>
            {t('todos.clear')}
          </button>
        )}
        <button className="btn primary" onClick={startNew} disabled={members.length === 0}>
          {t('todos.newNote')}
        </button>
      </div>
      <main className="view todo-view">
        {members.length === 0 ? (
          <div className="todo-empty">{t('todos.noFamily')}</div>
        ) : tab === 'open' ? (
          <Canvas
            all={open}
            visible={openVisible}
            membersOf={membersOf}
            today={today}
            onOpen={setEditing}
            onToggle={(x) => toggleDone(x.id)}
            onNew={startNew}
            patchMany={patchMany}
          />
        ) : done.length === 0 ? (
          <div className="todo-empty">{t('todos.nothingDone')}</div>
        ) : (
          <div className="todo-done-grid">
            {done.map((x) => (
              <Note
                key={x.id}
                todo={x}
                members={membersOf(x)}
                today={today}
                onToggle={() => toggleDone(x.id)}
                onOpen={() => setEditing(x)}
              />
            ))}
          </div>
        )}
      </main>
      {editing && (
        <TodoEditor
          todo={editing}
          isNew={!todos.some((x) => x.id === editing.id)}
          today={today}
          onSave={(x) => {
            upsert(x);
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
