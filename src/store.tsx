import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppConfig, CalendarSource, Member, SchoolConfig, Settings } from './types';
import { loadConfig, saveConfig } from './lib/config';
import { paint, setColorScheme } from './lib/colors';

const SELECTED_KEY = 'fc.selectedMembers';

interface Store {
  config: AppConfig;
  members: Member[];
  calendars: CalendarSource[];
  settings: Settings;
  memberById: Map<string, Member>;
  updateSettings: (patch: Partial<Settings>) => void;
  upsertMember: (m: Member) => void;
  patchMember: (id: string, patch: Partial<Member>) => void;
  /** removes the person; calendars stay, only the assignment is dropped */
  removeMember: (id: string) => void;
  moveMember: (id: string, dir: -1 | 1) => void;
  upsertCalendar: (c: CalendarSource) => void;
  patchCalendar: (id: string, patch: Partial<CalendarSource>) => void;
  removeCalendar: (id: string) => void;
  toggleCalendarMember: (calendarId: string, memberId: string) => void;
  replaceConfig: (cfg: AppConfig) => void;
  /** change a member based on its current state (safe for many quick updates in a row) */
  updateMember: (id: string, fn: (m: Member) => Partial<Member>) => void;
  /** family-wide subject colours and own subjects */
  school: SchoolConfig;
  updateSchool: (patch: Partial<SchoolConfig>) => void;
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
    setConfig((c) => ({
      ...c,
      members: c.members.filter((m) => m.id !== id),
      calendars: c.calendars.map((cal) => ({ ...cal, memberIds: cal.memberIds.filter((x) => x !== id) })),
    }));
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

  const upsertCalendar = useCallback((cal: CalendarSource) => {
    setConfig((c) => {
      const exists = c.calendars.some((x) => x.id === cal.id);
      return { ...c, calendars: exists ? c.calendars.map((x) => (x.id === cal.id ? cal : x)) : [...c.calendars, cal] };
    });
  }, []);

  const patchCalendar = useCallback((id: string, patch: Partial<CalendarSource>) => {
    setConfig((c) => ({ ...c, calendars: c.calendars.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  }, []);

  const removeCalendar = useCallback((id: string) => {
    setConfig((c) => ({ ...c, calendars: c.calendars.filter((x) => x.id !== id) }));
  }, []);

  const toggleCalendarMember = useCallback((calendarId: string, memberId: string) => {
    setConfig((c) => ({
      ...c,
      calendars: c.calendars.map((x) =>
        x.id !== calendarId
          ? x
          : {
              ...x,
              memberIds: x.memberIds.includes(memberId) ? x.memberIds.filter((id) => id !== memberId) : [...x.memberIds, memberId],
            },
      ),
    }));
  }, []);

  const updateMember = useCallback((id: string, fn: (m: Member) => Partial<Member>) => {
    setConfig((c) => ({ ...c, members: c.members.map((m) => (m.id === id ? { ...m, ...fn(m) } : m)) }));
  }, []);

  const updateSchool = useCallback((patch: Partial<SchoolConfig>) => {
    setConfig((c) => ({ ...c, school: { ...c.school, ...patch } }));
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

  // people are handed out in the chosen palette; the settings edit the stored colours via `config`
  const members = useMemo(() => {
    setColorScheme(config.settings.palette, config.settings.coreColor);
    return config.members.map((m) => ({ ...m, color: paint(m.color) }));
  }, [config.members, config.settings.palette, config.settings.coreColor]);

  const value = useMemo<Store>(
    () => ({
      config,
      members,
      calendars: config.calendars,
      settings: config.settings,
      memberById: new Map(members.map((m) => [m.id, m])),
      updateSettings,
      upsertMember,
      patchMember,
      removeMember,
      moveMember,
      upsertCalendar,
      patchCalendar,
      removeCalendar,
      toggleCalendarMember,
      replaceConfig,
      school: config.school,
      updateMember,
      updateSchool,
      selectedIds,
      selectOnly,
      toggleSelected,
      showAll,
    }),
    [
      config,
      members,
      selectedIds,
      updateSettings,
      upsertMember,
      patchMember,
      removeMember,
      moveMember,
      upsertCalendar,
      patchCalendar,
      removeCalendar,
      toggleCalendarMember,
      replaceConfig,
      updateMember,
      updateSchool,
      selectOnly,
      toggleSelected,
      showAll,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider fehlt');
  return s;
}
