import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppConfig, Member, Settings } from './types';
import { loadConfig, saveConfig } from './lib/config';

const HIDDEN_KEY = 'fc.hiddenMembers';

interface Store {
  config: AppConfig;
  members: Member[];
  settings: Settings;
  memberById: Map<string, Member>;
  updateSettings: (patch: Partial<Settings>) => void;
  upsertMember: (m: Member) => void;
  patchMember: (id: string, patch: Partial<Member>) => void;
  removeMember: (id: string) => void;
  moveMember: (id: string, dir: -1 | 1) => void;
  replaceConfig: (cfg: AppConfig) => void;
  /** person filter */
  hidden: Set<string>;
  toggleMember: (id: string) => void;
  showOnly: (id: string) => void;
  showAll: () => void;
}

const Ctx = createContext<Store | null>(null);

function loadHidden(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function StoreProvider({ initial, children }: { initial?: AppConfig; children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(() => initial ?? loadConfig());
  const [hidden, setHidden] = useState<Set<string>>(loadHidden);

  useEffect(() => saveConfig(config), [config]);
  useEffect(() => {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
  }, [hidden]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setConfig((c) => ({ ...c, settings: { ...c.settings, ...patch } }));
  }, []);

  const upsertMember = useCallback((m: Member) => {
    setConfig((c) => {
      const idx = c.members.findIndex((x) => x.id === m.id);
      const members = [...c.members];
      if (idx >= 0) members[idx] = m;
      else members.push(m);
      return { ...c, members };
    });
  }, []);

  const patchMember = useCallback((id: string, patch: Partial<Member>) => {
    setConfig((c) => ({ ...c, members: c.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  }, []);

  const removeMember = useCallback((id: string) => {
    setConfig((c) => ({ ...c, members: c.members.filter((m) => m.id !== id) }));
  }, []);

  const moveMember = useCallback((id: string, dir: -1 | 1) => {
    setConfig((c) => {
      const i = c.members.findIndex((m) => m.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= c.members.length) return c;
      const members = [...c.members];
      [members[i], members[j]] = [members[j], members[i]];
      return { ...c, members };
    });
  }, []);

  const replaceConfig = useCallback((cfg: AppConfig) => {
    setConfig(cfg);
    setHidden(new Set());
  }, []);

  const toggleMember = useCallback((id: string) => {
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const showOnly = useCallback(
    (id: string) => setHidden(new Set(config.members.filter((m) => m.id !== id).map((m) => m.id))),
    [config.members],
  );
  const showAll = useCallback(() => setHidden(new Set()), []);

  const value = useMemo<Store>(
    () => ({
      config,
      members: config.members,
      settings: config.settings,
      memberById: new Map(config.members.map((m) => [m.id, m])),
      updateSettings,
      upsertMember,
      patchMember,
      removeMember,
      moveMember,
      replaceConfig,
      hidden,
      toggleMember,
      showOnly,
      showAll,
    }),
    [config, hidden, updateSettings, upsertMember, patchMember, removeMember, moveMember, replaceConfig, toggleMember, showOnly, showAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider fehlt');
  return s;
}
