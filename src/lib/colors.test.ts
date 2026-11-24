import { describe, expect, it } from 'vitest';
import { colorScheme, painter, PALETTE, paletteColors, stylePalette } from './colors';

describe('stylePalette', () => {
  it('gives every style its own colours', () => {
    expect(stylePalette('wally')).toBe('wally');
    expect(stylePalette('minimal')).toBe('muted');
    expect(stylePalette('classic')).toBe('vivid');
    for (const p of ['vivid', 'muted', 'wally'] as const) expect(paletteColors(p)).toHaveLength(PALETTE.length);
  });
});

describe('painter', () => {
  it('leaves colours unchanged in the vivid palette', () => {
    const paint = painter(colorScheme('vivid'));
    expect(paint('#3b82f6')).toBe('#3b82f6');
    expect(paint('#123456')).toBe('#123456');
  });

  it('keeps the slot of base palette colours', () => {
    const paint = painter(colorScheme('wally'));
    PALETTE.forEach((c, i) => expect(paint(c)).toBe(paletteColors('wally')[i]));
  });

  it('keeps other colours (subjects) apart instead of snapping them to twelve slots', () => {
    const paint = painter(colorScheme('wally'));
    expect(paint('#1e90ff')).toBe('#1e90ff');
    // German, Spanish and History used to become the same orange/red
    for (const p of ['vivid', 'muted', 'wally'] as const) {
      const pt = painter(colorScheme(p));
      const out = ['#ef4444', '#f97316', '#b45309', '#92400e', '#a16207', '#c084fc', '#a855f7'].map((c) => pt(c));
      expect(new Set(out).size).toBe(out.length);
    }
  });

  it('greys out colours in the muted palette', () => {
    const paint = painter(colorScheme('muted'));
    expect(paint('#ff0000')).not.toBe('#ff0000');
    expect(paint(undefined)).toBeUndefined();
  });

  it('caches schemes and painters', () => {
    expect(colorScheme('wally')).toBe(colorScheme('wally'));
    expect(painter(colorScheme('muted'))).toBe(painter(colorScheme('muted')));
  });
});
