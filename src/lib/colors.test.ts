import { afterEach, describe, expect, it } from 'vitest';
import { corePalette, paint, PALETTE, setColorScheme } from './colors';

afterEach(() => setColorScheme('vivid', '#4f6d9a'));

describe('paint', () => {
  it('leaves colours unchanged in the vivid palette', () => {
    setColorScheme('vivid', '#4f6d9a');
    expect(paint('#123456')).toBe('#123456');
    expect(paint(undefined)).toBeUndefined();
  });

  it('keeps the slot of base palette colours when switching palettes', () => {
    setColorScheme('core', '#4f6d9a');
    const core = corePalette('#4f6d9a');
    PALETTE.forEach((c, i) => expect(paint(c)).toBe(core[i]));
  });

  it('maps other colours into the current palette', () => {
    setColorScheme('core', '#4f6d9a');
    expect(corePalette('#4f6d9a')).toContain(paint('#0000ff'));
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
    expect(corePalette('nope')).toEqual(corePalette('#4f6d9a'));
  });
});
