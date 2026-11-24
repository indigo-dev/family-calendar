import { fakeStorage } from './fakeStorage';

// Every test file starts with an empty in-memory localStorage – the same on every Node version
// (newer Node versions have an experimental built-in one that warns when it is touched).
Object.defineProperty(globalThis, 'localStorage', { value: fakeStorage(), configurable: true, writable: true });

// The tests expect German texts: the device language is fixed, so a build machine in another language
// (GitHub's runners speak English) gives the same results. Tests of other languages pass their own.
if (typeof navigator !== 'undefined') {
  for (const [key, value] of [
    ['language', 'de-DE'],
    ['languages', ['de-DE']],
  ] as const) {
    Object.defineProperty(navigator, key, { value, configurable: true });
  }
}
