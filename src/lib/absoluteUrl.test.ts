import { describe, expect, it } from 'vitest';
import { absoluteUrl } from './absoluteUrl';

describe('absoluteUrl', () => {
  it('resolves against the page (also below a sub path), not against a stylesheet in /assets/', () => {
    expect(absoluteUrl('symbols/tabler/1f34e.svg', 'https://example.github.io/homewally/')).toBe(
      'https://example.github.io/homewally/symbols/tabler/1f34e.svg',
    );
    expect(absoluteUrl('weather-icons/mc-mono/rain.svg', 'https://localhost/')).toBe('https://localhost/weather-icons/mc-mono/rain.svg');
  });
});
