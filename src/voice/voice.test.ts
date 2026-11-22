import { describe, expect, it, vi } from 'vitest';
import { buildPrompt, isEmpty, parseCommand } from './command';
import { applyCommand, findItem, findMembers, joinAnd, type ApplyDeps } from './apply';
import { encodeWav } from './recorder';
import { BUILTIN, type ListEntry, type ShopItem } from '../lib/shopping';
import type { Todo } from '../lib/todos';
import type { Member } from '../types';

const member = (id: string, name: string): Member => ({ id, name, color: '#000', avatar: { type: 'initials' } });

describe('parseCommand', () => {
  it('keeps valid parts and drops broken ones', () => {
    const cmd = parseCommand({
      transcript: ' Pack drei Äpfel drauf ',
      shopping: [{ name: 'Äpfel', qty: 3 }, { name: '', qty: 1 }, { name: 'Milch' }, { name: 'X', qty: 500, category: 'nope' }],
      todos: [
        { text: 'Altpapier', members: ['Anna', 7], due: '2026-11-27' },
        { text: 'Müll', due: 'morgen' },
      ],
      weather: [{ date: '2026-11-23' }, { date: 'tomorrow' }],
      events: [{ from: '2026-11-29', to: '2026-11-23' }],
      openModule: 'none',
    });
    expect(cmd.transcript).toBe('Pack drei Äpfel drauf');
    expect(cmd.shopping).toEqual([
      { name: 'Äpfel', qty: 3, category: undefined },
      { name: 'Milch', qty: 1, category: undefined },
      { name: 'X', qty: 99, category: undefined },
    ]);
    expect(cmd.todos).toEqual([
      { text: 'Altpapier', members: ['Anna'], due: '2026-11-27' },
      { text: 'Müll', members: [], due: undefined },
    ]);
    expect(cmd.weather).toHaveLength(1);
    expect(cmd.events[0]).toMatchObject({ from: '2026-11-23', to: '2026-11-29' });
    expect(cmd.openModule).toBeUndefined();
  });

  it('survives garbage', () => {
    const cmd = parseCommand('nonsense');
    expect(cmd.transcript).toBe('');
    expect(isEmpty(cmd)).toBe(true);
    expect(parseCommand({ openModule: 'shopping' }).openModule).toBe('shopping');
  });
});

describe('buildPrompt', () => {
  it('names today, the family and the pantry', () => {
    const p = buildPrompt({ now: new Date(2026, 10, 22, 9, 5), members: ['Anna'], places: [], pantry: ['Milch', 'Äpfel'] });
    expect(p).toContain('2026-11-22, 09:05');
    expect(p).toContain('Familienmitglieder: Anna.');
    expect(p).toContain('Wetter-Orte (der erste ist Zuhause): keine.');
    expect(p).toContain('Milch, Äpfel');
  });
});

describe('matching', () => {
  it('finds pantry items ignoring case, umlauts and singular', () => {
    expect(findItem(BUILTIN, 'Apfel')?.id).toBe('apples');
    expect(findItem(BUILTIN, 'milch')?.id).toBe('milk');
    expect(findItem(BUILTIN, 'Drachenfrucht')).toBeUndefined();
  });
  it('finds family members by first name', () => {
    const ms = [member('a', 'Anna Lenz'), member('b', 'Ben')];
    expect(findMembers(ms, ['anna', 'Ben', 'Carla']).map((m) => m.id)).toEqual(['a', 'b']);
  });
  it('joins with "und"', () => {
    expect(joinAnd(['a', 'b', 'c'])).toBe('a, b und c');
    expect(joinAnd(['a'])).toBe('a');
  });
});

function fakeDeps(list: ListEntry[] = [], members: Member[] = [member('a', 'Anna'), member('b', 'Ben')]) {
  const state = { list: [...list], custom: [] as ShopItem[], todos: [] as Todo[] };
  const deps: ApplyDeps = {
    items: [...BUILTIN],
    list: [...list],
    add: (id) => state.list.push({ itemId: id, qty: 1, addedAt: 0 }),
    setQty: (id, qty) => {
      state.list = qty <= 0 ? state.list.filter((e) => e.itemId !== id) : state.list.map((e) => (e.itemId === id ? { ...e, qty } : e));
    },
    createItem: (name, emoji, cat) => {
      const item = { id: `c-${name}`, name, emoji, cat, custom: true };
      state.custom.push(item);
      return item;
    },
    removeItem: vi.fn((item: ShopItem) => {
      state.custom = state.custom.filter((c) => c.id !== item.id);
      state.list = state.list.filter((e) => e.itemId !== item.id);
    }),
    members,
    upsertTodo: (t) => state.todos.push(t),
    removeTodo: (id) => (state.todos = state.todos.filter((t) => t.id !== id)),
  };
  return { deps, state };
}

describe('applyCommand', () => {
  it('adds items with quantities, creates unknown ones and undoes everything', () => {
    const { deps, state } = fakeDeps([{ itemId: 'milk', qty: 1, addedAt: 0 }]);
    const res = applyCommand(
      {
        shopping: [
          { name: 'Äpfel', qty: 3 },
          { name: 'Milch', qty: 1 },
          { name: 'grillkohle', qty: 1, category: 'household' },
        ],
        todos: [],
      },
      deps,
    );
    expect(state.list).toEqual([
      { itemId: 'milk', qty: 2, addedAt: 0 },
      { itemId: 'apples', qty: 3, addedAt: 0 },
      { itemId: 'c-Grillkohle', qty: 1, addedAt: 0 },
    ]);
    expect(state.custom[0]).toMatchObject({ name: 'Grillkohle', emoji: '🧻', cat: 'household' });
    expect(res.lines.map((l) => l.text)).toEqual(['3 × Äpfel', 'Milch (jetzt 2)', 'Grillkohle']);
    expect(res.speech[0]).toBe('drei Äpfel, Milch und Grillkohle stehen auf der Einkaufsliste.');

    res.undo!();
    expect(state.list).toEqual([{ itemId: 'milk', qty: 1, addedAt: 0 }]);
    expect(state.custom).toEqual([]);
  });

  it('adds the same item twice in one request', () => {
    const { deps, state } = fakeDeps();
    applyCommand(
      {
        shopping: [
          { name: 'Milch', qty: 1 },
          { name: 'Milch', qty: 2 },
        ],
        todos: [],
      },
      deps,
    );
    expect(state.list).toEqual([{ itemId: 'milk', qty: 3, addedAt: 0 }]);
  });

  it('creates to-dos for named members, else for everyone', () => {
    const { deps, state } = fakeDeps();
    const res = applyCommand(
      {
        shopping: [],
        todos: [
          { text: 'Turnsachen einpacken', members: ['anna'], due: '2026-11-23' },
          { text: 'Altpapier', members: [] },
        ],
      },
      deps,
    );
    expect(state.todos.map((t) => [t.text, t.memberIds, t.due])).toEqual([
      ['Turnsachen einpacken', ['a'], '2026-11-23'],
      ['Altpapier', ['a', 'b'], undefined],
    ]);
    expect(res.lines[0].text).toMatch(/^„Turnsachen einpacken“ für Anna · bis /);
    res.undo!();
    expect(state.todos).toEqual([]);
  });

  it('does not create to-dos without a family', () => {
    const { deps, state } = fakeDeps([], []);
    const res = applyCommand({ shopping: [], todos: [{ text: 'X', members: [] }] }, deps);
    expect(state.todos).toEqual([]);
    expect(res.undo).toBeUndefined();
    expect(res.lines[0].icon).toBe('⚠️');
  });
});

describe('encodeWav', () => {
  it('writes a 16-bit mono header', async () => {
    const wav = encodeWav(new Float32Array([0, 1, -1]), 16000);
    const v = new DataView(await wav.arrayBuffer());
    expect(wav.size).toBe(44 + 6);
    expect(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3))).toBe('RIFF');
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getInt16(46, true)).toBe(0x7fff);
    expect(v.getInt16(48, true)).toBe(-0x7fff);
  });
});
