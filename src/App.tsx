import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { useNow, useWakeLock } from './lib/hooks';
import { MemberFilter, ModuleHeader } from './components/Header';
import { MODULES, ModuleNav, type ModuleId } from './components/ModuleNav';
import { SettingsPanel, type SettingsTab } from './settings/SettingsPanel';
import { CalendarModule } from './CalendarModule';
import { TodoBoard } from './todos/TodoBoard';
import { TimetableModule } from './timetable/TimetableModule';
import { ShoppingModule } from './shopping/ShoppingModule';

const MODULE_KEY = 'fc.module';

function loadModule(): ModuleId {
  try {
    const saved = localStorage.getItem(MODULE_KEY);
    return MODULES.find((m) => m.id === saved)?.id ?? 'calendar';
  } catch {
    return 'calendar';
  }
}

export function App() {
  const { settings, members } = useStore();
  const [module, setModule] = useState<ModuleId>(loadModule);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(members.length === 0);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | undefined>();
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

  // style + resolved light/dark (the styles only need one dark selector: [data-mode='dark'])
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-style', settings.style);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'auto' && mq.matches);
      root.setAttribute('data-mode', dark ? 'dark' : 'light');
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
      if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.style, settings.theme]);

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

  const openSettings = (tab?: SettingsTab) => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  return (
    <div className="shell">
      <ModuleNav active={module} onSelect={setModule} />
      <div className="app">
        {module === 'calendar' && (
          <CalendarModule now={now} reloadKey={reloadKey} settingsOpen={settingsOpen} onSettings={() => openSettings()} />
        )}
        {module === 'timetable' && (
          <>
            <ModuleHeader title="Stundenplan" now={now} onSettings={() => openSettings('school')} />
            <TimetableModule now={now} onSettings={() => openSettings('family')} />
          </>
        )}
        {module === 'todos' && (
          <>
            <ModuleHeader title="To-dos" now={now} onSettings={() => openSettings()} />
            <MemberFilter issues={{}} onIssue={() => {}} />
            <TodoBoard now={now} />
          </>
        )}
        {module === 'shopping' && (
          <>
            <ModuleHeader title="Einkaufsliste" now={now} onSettings={() => openSettings()} />
            <ShoppingModule />
          </>
        )}
      </div>
      {settingsOpen && (
        <SettingsPanel
          initialTab={settingsTab}
          onClose={() => {
            setSettingsOpen(false);
            setReloadKey((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
