import { Icon } from './Icon';

export type ModuleId = 'calendar' | 'timetable' | 'todos' | 'shopping';

export const MODULES: { id: ModuleId; label: string; icon: string }[] = [
  { id: 'calendar', label: 'Kalender', icon: '📅' },
  { id: 'timetable', label: 'Stundenplan', icon: '🎒' },
  { id: 'todos', label: 'To-dos', icon: '📌' },
  { id: 'shopping', label: 'Einkauf', icon: '🛒' },
];

/** App switcher: side rail on tablets, bottom bar on phones. */
export function ModuleNav({ active, onSelect }: { active: ModuleId; onSelect: (id: ModuleId) => void }) {
  return (
    <nav className="module-nav" aria-label="Bereiche">
      <span className="module-nav-label">Familie</span>
      {MODULES.map((m) => (
        <button
          key={m.id}
          className={`module-btn ${active === m.id ? 'active' : ''}`}
          aria-current={active === m.id ? 'page' : undefined}
          onClick={() => onSelect(m.id)}
        >
          <span className="module-icon ui-glyph" aria-hidden>
            {m.icon}
          </span>
          <Icon name={m.id} className="module-svg" />
          <span className="module-label">{m.label}</span>
        </button>
      ))}
    </nav>
  );
}
