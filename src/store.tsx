import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppConfig, Member, Settings } from './types';
import { loadConfig, saveConfig } from './lib/config';

const SELECTED_KEY = 'fc.selectedMembers';

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
  /** person filter: empty = all members, otherwise only these members */
  selectedIds: Set<string>;
  /** tap: show only this member (tapping the only selected member again goes back to all) */
  selectOnly: (id: string) => void;
  /** long press: add/remove this member to/from the selection */
  toggleSelected: (id: string) => void;
  showAll: () => void;
}

const Ctx = createContext<Store | null>(null);

function loadSelected(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SELECTED_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function StoreProvider({ initial, children }: { initial?: AppConfig; children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(() => initial ?? loadConfig());
  const [selected, setSelected] = useState<string[]>(loadSelected);

  useEffect(() => saveConfig(config), [config]);
  // only existing members count; everyone selected is the same as "Alle"
  const selectedIds = useMemo(() => {
    const ids = new Set(selected.filter((id) => config.members.some((m) => m.id === id)));
    return ids.size === config.members.length ? new Set<string>() : ids;
  }, [selected, config.members]);
  useEffect(() => {
    localStorage.setItem(SELECTED_KEY, JSON.stringify([...selectedIds]));
  }, [selectedIds]);

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
    setSelected([]);
  }, []);

  const selectOnly = useCallback((id: string) => setSelected((cur) => (cur.length === 1 && cur[0] === id ? [] : [id])), []);
  const toggleSelected = useCallback(
    (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])),
    [],
  );
  const showAll = useCallback(() => setSelected([]), []);

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
      selectedIds,
      selectOnly,
      toggleSelected,
      showAll,
    }),
    [config, selectedIds, updateSettings, upsertMember, patchMember, removeMember, moveMember, replaceConfig, selectOnly, toggleSelected, showAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider fehlt');
  return s;
}
