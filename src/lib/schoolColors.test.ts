import { describe, expect, it } from 'vitest';
import { colorScheme, painter } from './colors';
import { DEFAULT_SCHOOL, subjectsFor } from './school';

describe('subject colours', () => {
  it('stay apart in every palette', () => {
    for (const p of ['vivid', 'muted', 'wally'] as const) {
      const paint = painter(colorScheme(p));
      for (const type of ['grundschule', 'gymnasium'] as const) {
        const subjects = subjectsFor(type, DEFAULT_SCHOOL, paint);
        const byColor = new Map<string, string[]>();
        for (const s of subjects) byColor.set(s.color, [...(byColor.get(s.color) ?? []), s.id]);
        const twins = [...byColor.values()].filter((ids) => ids.length > 1);
        expect(twins, `${p} / ${type}`).toEqual([]);
      }
    }
  });
});
