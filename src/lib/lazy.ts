import { lazy, type ComponentType } from 'react';

/**
 * `React.lazy` for a named export, plus `preload()` to fetch the code ahead of time
 * (so a module also opens offline and without a loading pause).
 */
export function lazyNamed<K extends string, P extends object>(load: () => Promise<{ [k in K]: ComponentType<P> }>, name: K) {
  return Object.assign(
    lazy(() => load().then((m) => ({ default: m[name] }))),
    { preload: () => load().then(() => undefined) },
  );
}

/**
 * Fetches the given modules once the app has settled after starting. The service worker caches the
 * files, so every module opens later even without network – important for the wall display.
 */
export function preloadWhenIdle(modules: { preload: () => Promise<void> }[], delayMs = 2000): () => void {
  const t = window.setTimeout(() => {
    for (const m of modules) m.preload().catch(() => {}); // offline: tried again on first use
  }, delayMs);
  return () => window.clearTimeout(t);
}
