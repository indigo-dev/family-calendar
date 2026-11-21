import { useCallback, useEffect, useState } from 'react';
import { uid } from './config';

const KEY = 'fc.todos';

export interface Todo {
  id: string;
  text: string;
  /** at least one family member */
  memberIds: string[];
  /** optional due day as YYYY-MM-DD */
  due?: string;
  done: boolean;
  /** epoch ms */
  createdAt: number;
  doneAt?: number;
  /** position on the board in px (per device, like everything in localStorage); unset = auto place */
  x?: number;
  y?: number;
  /** note scale, 1 = normal */
  size?: number;
  /** stacking order, higher = on top */
  z?: number;
}

function load(): Todo[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(v)) return [];
    return v.filter(
      (t): t is Todo => t && typeof t.id === 'string' && typeof t.text === 'string' && Array.isArray(t.memberIds),
    );
  } catch {
    return [];
  }
}

export function newTodo(memberIds: string[]): Todo {
  return { id: uid(), text: '', memberIds, done: false, createdAt: Date.now() };
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(todos));
    } catch {
      /* storage full or blocked – keep working in memory */
    }
  }, [todos]);

  // another tab / window changed the list
  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === KEY && setTodos(load());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const upsert = useCallback((t: Todo) => {
    setTodos((cur) => (cur.some((x) => x.id === t.id) ? cur.map((x) => (x.id === t.id ? t : x)) : [...cur, t]));
  }, []);
  const remove = useCallback((id: string) => setTodos((cur) => cur.filter((x) => x.id !== id)), []);
  const toggleDone = useCallback((id: string) => {
    setTodos((cur) => cur.map((x) => (x.id === id ? { ...x, done: !x.done, doneAt: x.done ? undefined : Date.now() } : x)));
  }, []);
  const patchMany = useCallback((patches: Record<string, Partial<Todo>>) => {
    setTodos((cur) => cur.map((x) => (patches[x.id] ? { ...x, ...patches[x.id] } : x)));
  }, []);
  const clearDone = useCallback(() => setTodos((cur) => cur.filter((x) => !x.done)), []);

  return { todos, upsert, remove, toggleDone, clearDone, patchMany };
}

/** YYYY-MM-DD of a local date */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
