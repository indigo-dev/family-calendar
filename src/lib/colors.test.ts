import { describe, expect, it } from 'vitest';
import { colorScheme, corePalette, painter, PALETTE } from './colors';

const CORE = '#4f6d9a';

describe('painter', () => {
  it('leaves colours unchanged in the vivid palette', () => {
    const paint = painter(colorScheme('vivid', CORE));
    expect(paint('#123456')).toBe('#123456');
    expect(paint(undefined)).toBeUndefined();
  });

  it('keeps the slot of base palette colours when switching palettes', () => {
    const paint = painter(colorScheme('core', CORE));
    const core = corePalette(CORE);
    PALETTE.forEach((c, i) => expect(paint(c)).toBe(core[i]));
  });

  it('maps other colours into the current palette', () => {
    const paint = painter(colorScheme('core', CORE));
    expect(corePalette(CORE)).toContain(paint('#0000ff'));
  });

  it('greys out colours in the muted palette', () => {
    const paint = painter(colorScheme('muted', CORE));
    expect(paint('#ff0000')).not.toBe('#ff0000');
    expect(paint('#ff0000')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('is cached per scheme, so equal settings give the same function', () => {
    expect(colorScheme('core', CORE)).toBe(colorScheme('core', CORE.toUpperCase()));
    expect(painter(colorScheme('muted', CORE))).toBe(painter(colorScheme('muted', '#000000')));
    expect(painter(colorScheme('core', CORE))).not.toBe(painter(colorScheme('core', '#c4705a')));
  });
});

describe('corePalette', () => {
  it('returns twelve distinct hex colours', () => {
    const p = corePalette('#c4705a');
    expect(p).toHaveLength(12);
    expect(new Set(p).size).toBe(12);
    p.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));
  });

  it('falls back to the default core colour for invalid input', () => {
    expect(corePalette('nope')).toEqual(corePalette(CORE));
  });
});
