import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { useNow, useWakeLock } from './lib/hooks';
import { MemberFilter, ModuleHeader } from './components/Header';
import { ModuleNav, type ModuleId } from './components/ModuleNav';
import { SettingsPanel } from './settings/SettingsPanel';
import { CalendarModule } from './CalendarModule';
import { TodoBoard } from './todos/TodoBoard';

const MODULE_KEY = 'fc.module';

function loadModule(): ModuleId {
  try {
    return localStorage.getItem(MODULE_KEY) === 'todos' ? 'todos' : 'calendar';
  } catch {
    return 'calendar';
  }
}

export function App() {
  const { settings, members } = useStore();
  const [module, setModule] = useState<ModuleId>(loadModule);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(members.length === 0);
  const [reloadKey, setReloadKey] = useState(0);
  const now = useNow();
  const lastInteraction = useRef(Date.now());

  useWakeLock(settings.keepAwake);

  // theme
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    try {
      localStorage.setItem(MODULE_KEY, module);
    } catch {
      /* ignore */
    }
  }, [module]);

  // after inactivity go back to the calendar (wall display mode)
  useEffect(() => {
    const mark = () => (lastInteraction.current = Date.now());
    window.addEventListener('pointerdown', mark, { passive: true });
    window.addEventListener('keydown', mark);
    return () => {
      window.removeEventListener('pointerdown', mark);
      window.removeEventListener('keydown', mark);
    };
  }, []);
  useEffect(() => {
    if (!settings.idleResetMinutes || settingsOpen) return;
    if (Date.now() - lastInteraction.current < settings.idleResetMinutes * 60_000) return;
    setModule('calendar');
  }, [now, settings.idleResetMinutes, settingsOpen]);

  const openSettings = () => setSettingsOpen(true);

  return (
    <div className="shell">
      <ModuleNav active={module} onSelect={setModule} />
      <div className="app">
        {module === 'calendar' && (
          <CalendarModule now={now} reloadKey={reloadKey} settingsOpen={settingsOpen} onSettings={openSettings} />
        )}
        {module === 'todos' && (
          <>
            <ModuleHeader title="To-dos" now={now} onSettings={openSettings} />
            <MemberFilter issues={{}} onIssue={() => {}} />
            <TodoBoard now={now} />
          </>
        )}
      </div>
      {settingsOpen && (
        <SettingsPanel
          onClose={() => {
            setSettingsOpen(false);
            setReloadKey((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
