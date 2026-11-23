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

  it('maps other colours by hue into the HomeWally spectrum', () => {
    const paint = painter(colorScheme('wally'));
    expect(paletteColors('wally')).toContain(paint('#1e90ff'));
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
