import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeStorage } from '../test/fakeStorage';

// as in the Android app: app tiles exist
vi.mock('../native/launcher', () => ({ isNative: true }));

async function load(stored?: unknown) {
  vi.stubGlobal('localStorage', fakeStorage());
  if (stored !== undefined) localStorage.setItem('fc.dashboard', JSON.stringify(stored));
  vi.resetModules();
  return import('./dashboard');
}
const layoutOf = () => JSON.parse(localStorage.getItem('fc.dashboard')!) as { id: string; type: string; size: string; app?: unknown }[];

beforeEach(() => vi.unstubAllGlobals());

describe('app tiles in the Android app', () => {
  it('adds a 1×1 tile with the app to start', async () => {
    const d = await load([]);
    d.addAppTile({ packageName: 'com.example.tv', activity: 'com.example.tv.Main', label: 'TV' });
    expect(layoutOf()).toEqual([
      expect.objectContaining({
        type: 'app',
        size: 's',
        app: { packageName: 'com.example.tv', activity: 'com.example.tv.Main', label: 'TV' },
      }),
    ]);
  });

  it('drops app tiles without an app or in another size', async () => {
    const app = { packageName: 'p', activity: 'p.A', label: 'P' };
    const d = await load([
      { id: 'a', type: 'app', size: 's', app },
      { id: 'b', type: 'app', size: 's' },
      { id: 'c', type: 'app', size: 'm', app },
    ]);
    d.addWidget('clock', 's');
    expect(layoutOf().map((w) => w.id)).toEqual(['a', expect.any(String)]);
  });
});
