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
