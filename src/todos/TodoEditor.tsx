import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { addDays } from '../lib/dates';
import { dayKey, type Todo } from '../lib/todos';
import { Avatar } from '../components/Avatar';

import { noteStyle } from './layout';
import { Modal } from '../components/Modal';
import { t } from '../i18n';

type DueChoice = 'none' | 'today' | 'tomorrow' | 'date';

export function TodoEditor({
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
    <Modal onClose={onClose} label={isNew ? t('todos.newTitle') : t('todos.editTitle')}>
      <div className="modal todo-editor">
        <div className="todo-editor-paper" style={noteStyle(preview)}>
          <textarea
            ref={ref}
            value={text}
            maxLength={200}
            rows={3}
            placeholder={t('todos.placeholder')}
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
          <div className="muted small">{t('todos.forWhom')}</div>
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
          <div className="muted small">{t('todos.byWhen')}</div>
          <div className="todo-editor-due">
            <div className="segmented small">
              {(
                [
                  ['none', t('todos.noDue')],
                  ['today', t('common.today')],
                  ['tomorrow', t('common.tomorrow')],
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
              aria-label={t('todos.date')}
            />
          </div>
        </div>
        <div className="modal-actions todo-editor-actions">
          {!isNew && (
            <button className="btn danger" onClick={onDelete}>
              {t('common.delete')}
            </button>
          )}
          <span className="board-spacer" />
          <button className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn primary" onClick={save} disabled={!valid}>
            {isNew ? t('todos.add') : t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
