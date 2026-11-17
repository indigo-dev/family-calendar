import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './store';
import { loadConfig, saveConfig } from './lib/config';
import { initAuth, takeAfterLoginMember } from './lib/auth';
import './styles.css';

async function boot() {
  const config = loadConfig();

  // MSAL must process a returning login redirect before the UI renders.
  const auth = await initAuth(config.settings);
  if (auth.linked) {
    const { memberId, account } = auth.linked;
    config.members = config.members.map((m) => (m.id === memberId ? { ...m, account, source: 'outlook' as const } : m));
    saveConfig(config);
  }
  const openMemberId = takeAfterLoginMember();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <StoreProvider initial={config}>
        <App authError={auth.error} openMemberId={openMemberId} />
      </StoreProvider>
    </StrictMode>,
  );

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
