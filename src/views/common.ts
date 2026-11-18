import type { CalEvent, DayMarks, Member, ViewMode } from '../types';

export interface ViewProps {
  date: Date;
  now: Date;
  events: CalEvent[];
  onEvent: (e: CalEvent) => void;
  onOpen: (view: ViewMode, date: Date) => void;
  /** public / school holidays per dayKey */
  marks: Map<string, DayMarks>;
}

export function markClass(m: DayMarks | undefined): string {
  if (!m) return '';
  return `${m.publicNames.length ? 'holiday' : ''} ${m.schoolNames.length ? 'school' : ''}`;
}

export function membersOf(e: CalEvent, byId: Map<string, Member>): Member[] {
  return e.memberIds.map((id) => byId.get(id)).filter((m): m is Member => !!m);
}

/** Tinted background for an event block based on its first member colour. */
export function tint(color: string, pct = 22): string {
  return `color-mix(in srgb, ${color} ${pct}%, var(--tint-base, var(--surface)))`;
}

export function stripe(members: Member[]): string {
  if (members.length <= 1) return members[0]?.color ?? '#888';
  const step = 100 / members.length;
  return `linear-gradient(180deg, ${members.map((m, i) => `${m.color} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}
