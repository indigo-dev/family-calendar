import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Member } from '../types';
import { useStore } from '../store';
import { addDays, fmt, startOfDay } from '../lib/dates';
import { dayKey, newTodo, useTodos, type Todo } from '../lib/todos';
import { Avatar, AvatarStack } from '../components/Avatar';

type Tab = 'open' | 'done';

/** stable small tilt per note so the board looks hand-pinned */
function tilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 7) - 3) * 0.8;
}

const paper = (c: string) => `color-mix(in srgb, ${c} 30%, #fffdf3)`;

function noteBackground(members: Member[]): string {
  if (members.length === 0) return '#f3f1ea';
  if (members.length === 1) return paper(members[0].color);
  const stops = members.map((m, i) => `${paper(m.color)} ${Math.round((i / (members.length - 1)) * 100)}%`);
  return `linear-gradient(135deg, ${stops.join(', ')})`;
}

function dueInfo(due: string | undefined, today: Date): { label: string; tone: 'late' | 'today' | 'soon' | '' } | null {
  if (!due) return null;
  const [y, m, d] = due.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { label: diff === -1 ? 'seit gestern' : `seit ${fmt(date, { day: 'numeric', month: 'numeric' })}`, tone: 'late' };
  if (diff === 0) return { label: 'heute', tone: 'today' };
  if (diff === 1) return { label: 'morgen', tone: 'soon' };
  if (diff < 7) return { label: fmt(date, { weekday: 'long' }), tone: '' };
  return { label: fmt(date, { weekday: 'short', day: 'numeric', month: 'numeric' }), tone: '' };
}

export function TodoBoard({ now }: { now: Date }) {
  const { members, memberById, selectedIds } = useStore();
  const { todos, upsert, remove, toggleDone, clearDone } = useTodos();
  const [tab, setTab] = useState<Tab>('open');
  const [editing, setEditing] = useState<Todo | null>(null);
  const today = startOfDay(now);

  const visible = useMemo(() => {
    const mine = todos.filter((t) => selectedIds.size === 0 || t.memberIds.some((id) => selectedIds.has(id)));
    const open = mine
      .filter((t) => !t.done)
      .sort((a, b) => {
        if (a.due && b.due) return a.due.localeCompare(b.due) || b.createdAt - a.createdAt;
        if (a.due) return -1;
        if (b.due) return 1;
        return b.createdAt - a.createdAt;
      });
    const done = mine.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
    return { open, done };
  }, [todos, selectedIds]);

  const list = tab === 'open' ? visible.open : visible.done;
  const startNew = () => {
    const pre = selectedIds.size > 0 ? [...selectedIds] : members.length === 1 ? [members[0].id] : [];
    setEditing(newTodo(pre));
  };

  return (
    <>
      <div className="board-toolbar">
        <div className="segmented small" role="tablist">
          <button role="tab" aria-selected={tab === 'open'} className={tab === 'open' ? 'active' : ''} onClick={() => setTab('open')}>
            Offen · {visible.open.length}
          </button>
          <button role="tab" aria-selected={tab === 'done'} className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')}>
            Erledigt · {visible.done.length}
          </button>
        </div>
        <span className="board-spacer" />
        {tab === 'done' && visible.done.length > 0 && (
          <button className="btn danger" onClick={() => confirm('Alle erledigten Zettel abnehmen?') && clearDone()}>
            Alle abnehmen
          </button>
        )}
        <button className="btn primary" onClick={startNew} disabled={members.length === 0}>
          + Neuer Zettel
        </button>
      </div>
      <main className="view board">
        {members.length === 0 ? (
          <div className="board-empty">Lege zuerst in den Einstellungen die Familie an.</div>
        ) : list.length === 0 ? (
          <div className="board-empty">
            {tab === 'open' ? (
              <button className="note note-blank" onClick={startNew}>
                <span>Alles erledigt!</span>
                <span className="small">Antippen für einen neuen Zettel</span>
              </button>
            ) : (
              'Noch nichts erledigt.'
            )}
          </div>
        ) : (
          <div className="board-grid">
            {list.map((t) => (
              <Note
                key={t.id}
                todo={t}
                members={t.memberIds.map((id) => memberById.get(id)).filter((m): m is Member => !!m)}
                today={today}
                onOpen={() => setEditing(t)}
                onToggle={() => toggleDone(t.id)}
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

function Note({ todo, members, today, onOpen, onToggle }: {
  todo: Todo;
  members: Member[];
  today: Date;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const due = todo.done ? null : dueInfo(todo.due, today);
  // long text or long German compound words -> smaller writing
  const longestWord = Math.max(0, ...todo.text.split(/\s+/).map((w) => w.length));
  const len = Math.max(todo.text.length, longestWord > 15 ? 91 : longestWord > 11 ? 46 : 0);
  const style: CSSProperties = {
    background: noteBackground(members),
    ['--tilt' as string]: `${tilt(todo.id)}deg`,
    ['--pin' as string]: members[0]?.color ?? '#9aa0a6',
  };
  return (
    <div className={`note ${todo.done ? 'done' : ''} ${due?.tone === 'late' ? 'late' : ''}`} style={style}>
      <span className="note-pin" aria-hidden />
      <button className="note-body" onClick={onOpen} aria-label={`Bearbeiten: ${todo.text}`}>
        <span className={`note-text ${len > 90 ? 'xs' : len > 45 ? 'sm' : ''}`}>{todo.text}</span>
      </button>
      <div className="note-foot">
        <AvatarStack members={members} size={26} />
        {due && <span className={`note-due ${due.tone}`}>{due.label}</span>}
        <button
          className={`note-check ${todo.done ? 'on' : ''}`}
          onClick={onToggle}
          aria-label={todo.done ? 'Wieder offen' : 'Erledigt'}
          aria-pressed={todo.done}
        >
          ✓
        </button>
      </div>
      {todo.done && <span className="note-stamp">erledigt</span>}
    </div>
  );
}

type DueChoice = 'none' | 'today' | 'tomorrow' | 'date';

function TodoEditor({ todo, isNew, today, onSave, onDelete, onClose }: {
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
        <div className="todo-editor-paper" style={{ background: noteBackground(preview) }}>
          <textarea
            ref={ref}
            value={text}
            maxLength={200}
            rows={4}
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
                  style={{ borderColor: on ? m.color : undefined, background: on ? `color-mix(in srgb, ${m.color} 22%, var(--surface))` : undefined }}
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
              Abnehmen
            </button>
          )}
          <span className="board-spacer" />
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn primary" onClick={save} disabled={!valid}>
            {isNew ? 'Anpinnen' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
