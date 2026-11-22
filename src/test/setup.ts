import { fakeStorage } from './fakeStorage';

// Every test file starts with an empty in-memory localStorage – the same on every Node version
// (newer Node versions have an experimental built-in one that warns when it is touched).
Object.defineProperty(globalThis, 'localStorage', { value: fakeStorage(), configurable: true, writable: true });
