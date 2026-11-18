/** Line icons for the modern styles. The classic style keeps its emoji / text glyphs (see `.ui-glyph`). */
const PATHS = {
  back: <path d="M15 5l-7 7 7 7" />,
  forward: <path d="M9 5l7 7-7 7" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />,
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  timetable: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M3 9h18M9 9v11M15 9v11" />
    </>
  ),
  todos: <path d="M4 7l2 2 3-3M4 15l2 2 3-3M12 8h8M12 16h8" />,
  shopping: (
    <>
      <path d="M3 4h2l2.4 11h11l2-8H6.2" />
      <circle cx="9.5" cy="19" r="1.4" />
      <circle cx="17" cy="19" r="1.4" />
    </>
  ),
  frame: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
      <circle cx="15.5" cy="8.5" r="1.5" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg className={`ui-icon ${className}`} viewBox="0 0 24 24" aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

/** Text glyph for the classic style plus the line icon for the others. */
export function GlyphIcon({ glyph, name }: { glyph: string; name: IconName }) {
  return (
    <>
      <span className="ui-glyph" aria-hidden>
        {glyph}
      </span>
      <Icon name={name} />
    </>
  );
}
