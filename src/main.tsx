import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './store';
import { ErrorBoundary } from './components/ErrorBoundary';
import { configStore } from './lib/config';
import { isNative } from './native/launcher';
import './styles.css';
// self-hosted fonts for the Flow and Aurora styles (only downloaded when a style uses them)
import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
import '@fontsource-variable/sora/wght.css';
import '@fontsource-variable/manrope/wght.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
// n8n, Stately and Braun
import '@fontsource-variable/open-sans/wght.css';
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/inter-tight/wght.css';
import './themes.css';

// set the style before the first paint (App.tsx keeps it in sync afterwards)
document.documentElement.setAttribute('data-style', configStore.get().settings.style);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary label="Die App">
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// the Android app has all files on the device already: no service worker (it would only cache twice)
if (import.meta.env.PROD && !isNative && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
