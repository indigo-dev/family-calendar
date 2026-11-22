import { describe, expect, it } from 'vitest';
import { BUILTIN, norm } from './shopping';

describe('shopping search', () => {
  it('ignores case, umlauts, ß and punctuation', () => {
    expect(norm('Äpfel')).toBe('apfel');
    expect(norm('Grieß-Brei')).toBe('griessbrei');
    expect(norm('  Müsli ')).toBe(norm('musli'));
  });

  it('finds built-in items by a sloppy query', () => {
    const q = norm('apfel');
    expect(BUILTIN.filter((i) => norm(i.name).includes(q)).map((i) => i.name)).toContain('Äpfel');
  });

  it('has unique ids in the built-in catalogue', () => {
    const ids = BUILTIN.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
