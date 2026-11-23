import { CATEGORIES, norm, type CategoryId, type ListEntry, type ShopItem } from '../lib/shopping';
import { newTodo, type Todo } from '../lib/todos';
import type { Member } from '../types';
import type { ShopRequest, TodoRequest } from './command';
import { t, locale } from '../i18n';
import { fmt } from '../lib/dates';

/* Carries out the changing parts of a command (shopping list, to-dos) and returns how to undo them. */

export interface ApplyDeps {
  /** every known item, also hidden ones */
  items: ShopItem[];
  list: ListEntry[];
  setQty: (itemId: string, qty: number) => void;
  add: (itemId: string) => void;
  createItem: (name: string, emoji: string, cat: CategoryId) => ShopItem;
  removeItem: (item: ShopItem) => void;
  members: Member[];
  upsertTodo: (t: Todo) => void;
  removeTodo: (id: string) => void;
}

export interface Line {
  icon: string;
  text: string;
}

export interface Applied {
  lines: Line[];
  /** spoken summary */
  speech: string[];
  undo?: () => void;
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase(locale()) + s.slice(1);
/** 1–10 as a word for speaking ("drei Äpfel", "three apples") */
const numberWord = (n: number) => t('voice.numbers').split(',')[n - 1] ?? String(n);

/** finds a pantry item by name: exact (ignoring case and umlauts), else the only one that starts with it */
export function findItem(items: ShopItem[], name: string): ShopItem | undefined {
  const n = norm(name);
  if (!n) return undefined;
  const exact = items.find((i) => norm(i.name) === n);
  if (exact) return exact;
  const prefix = items.filter((i) => norm(i.name).startsWith(n) || n.startsWith(norm(i.name)));
  return prefix.length === 1 ? prefix[0] : undefined;
}

/** family members by spoken name (first name is enough) */
export function findMembers(members: Member[], names: string[]): Member[] {
  const out: Member[] = [];
  for (const name of names) {
    const n = norm(name);
    const m = members.find((x) => norm(x.name) === n) ?? members.find((x) => norm(x.name).startsWith(n) || n.startsWith(norm(x.name)));
    if (m && !out.includes(m)) out.push(m);
  }
  return out;
}

export function applyCommand(cmd: { shopping: ShopRequest[]; todos: TodoRequest[] }, deps: ApplyDeps): Applied {
  const lines: Line[] = [];
  const speech: string[] = [];
  const undos: (() => void)[] = [];

  /* shopping list */
  const shopped: string[] = [];
  for (const req of cmd.shopping) {
    let item = findItem(deps.items, req.name);
    let created = false;
    if (!item) {
      const cat = req.category ?? 'other';
      const emoji = CATEGORIES.find((c) => c.id === cat)?.icon ?? '🛒';
      item = deps.createItem(capitalize(req.name), emoji, cat);
      deps.items = [...deps.items, item];
      created = true;
    }
    const prev = deps.list.find((e) => e.itemId === item.id)?.qty ?? 0;
    if (prev === 0) deps.add(item.id);
    const qty = Math.min(prev + req.qty, 99);
    deps.setQty(item.id, qty);
    deps.list =
      prev === 0
        ? [...deps.list, { itemId: item.id, qty, addedAt: Date.now() }]
        : deps.list.map((e) => (e.itemId === item.id ? { ...e, qty } : e));
    const it = item;
    undos.push(created ? () => deps.removeItem(it) : () => deps.setQty(it.id, prev));
    const label = `${req.qty > 1 ? `${req.qty} × ` : ''}${item.name}`;
    lines.push({ icon: item.emoji, text: prev ? t('voice.nowQty', { text: label, n: qty }) : label });
    shopped.push(req.qty > 1 ? `${numberWord(req.qty)} ${item.name}` : item.name);
  }
  if (shopped.length) speech.push(t('voice.onList', { items: joinAnd(shopped), n: shopped.length > 1 || cmd.shopping[0].qty > 1 ? 2 : 1 }));

  /* to-dos */
  for (const req of cmd.todos) {
    if (deps.members.length === 0) {
      lines.push({ icon: '⚠️', text: t('voice.noFamily', { text: req.text }) });
      continue;
    }
    const who = findMembers(deps.members, req.members);
    const todo: Todo = { ...newTodo((who.length ? who : deps.members).map((m) => m.id)), text: req.text, due: req.due };
    deps.upsertTodo(todo);
    undos.push(() => deps.removeTodo(todo.id));
    const due = req.due
      ? t('voice.until', { date: fmt(new Date(`${req.due}T00:00`), { weekday: 'short', day: 'numeric', month: 'numeric' }) })
      : '';
    const forWho = who.length ? t('voice.forWhom', { names: joinAnd(who.map((m) => m.name)) }) : '';
    lines.push({ icon: '📌', text: t('voice.todoLine', { text: req.text, who: forWho, due }) });
    speech.push(t('voice.todoNoted', { text: req.text }));
  }

  return {
    lines,
    speech,
    undo: undos.length ? () => undos.reverse().forEach((u) => u()) : undefined,
  };
}

export function joinAnd(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} ${t('voice.and')} ${xs[xs.length - 1]}`;
}
