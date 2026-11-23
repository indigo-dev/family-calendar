import type { Member } from '../types';
import type { Todo } from '../lib/todos';
import { AvatarStack } from '../components/Avatar';

import { dueInfo, noteStyle } from './layout';
import { t } from '../i18n';

export function Note({
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
          aria-label={todo.done ? t('todos.reopen') : t('todos.markDone')}
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
