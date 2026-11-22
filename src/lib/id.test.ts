import { afterEach, describe, expect, it, vi } from 'vitest';
import { uid } from './id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe('uid', () => {
  it('returns distinct UUIDs', () => {
    const ids = new Set(Array.from({ length: 1000 }, uid));
    expect(ids.size).toBe(1000);
    ids.forEach((id) => expect(id).toMatch(UUID));
  });

  it('works without crypto.randomUUID (plain http in the home network)', () => {
    const original = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: original.getRandomValues.bind(original) });
    expect(uid()).toMatch(UUID);
  });
});
