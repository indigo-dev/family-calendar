/** Records of the demo family (people, to-dos, places, photos) carry ids with this prefix. */
export const DEMO_PREFIX = 'demo-';
export const demoId = (): string => DEMO_PREFIX + uid();
export const isDemoId = (id: string): boolean => id.startsWith(DEMO_PREFIX);

/**
 * A random unique id (UUID v4). `crypto.randomUUID()` only exists in secure contexts (https, localhost) –
 * the dev server opened over the home network is plain http, so fall back to `getRandomValues()`.
 */
export function uid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
