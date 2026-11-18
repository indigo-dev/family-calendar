export type ModuleId = 'calendar' | 'timetable' | 'todos';

export const MODULES: { id: ModuleId; label: string; icon: string }[] = [
  { id: 'calendar', label: 'Kalender', icon: '📅' },
  { id: 'timetable', label: 'Stundenplan', icon: '🎒' },
  { id: 'todos', label: 'To-dos', icon: '📌' },
];

/** App switcher: side rail on tablets, bottom bar on phones. */
export function ModuleNav({ active, onSelect }: { active: ModuleId; onSelect: (id: ModuleId) => void }) {
  return (
    <nav className="module-nav" aria-label="Bereiche">
      {MODULES.map((m) => (
        <button
          key={m.id}
          className={`module-btn ${active === m.id ? 'active' : ''}`}
          aria-current={active === m.id ? 'page' : undefined}
          onClick={() => onSelect(m.id)}
        >
          <span className="module-icon" aria-hidden>
            {m.icon}
          </span>
          <span className="module-label">{m.label}</span>
        </button>
      ))}
    </nav>
  );
}
