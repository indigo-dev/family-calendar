import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './store';
import { loadConfig } from './lib/config';
import './styles.css';
// self-hosted fonts for the Flow and Aurora styles (only downloaded when a style uses them)
import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
import '@fontsource-variable/sora/wght.css';
import '@fontsource-variable/manrope/wght.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './themes.css';

const config = loadConfig();
// set the style before the first paint (App.tsx keeps it in sync afterwards)
document.documentElement.setAttribute('data-style', config.settings.style);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider initial={config}>
      <App />
    </StoreProvider>
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
