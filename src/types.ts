export type ViewMode = 'day' | 'week' | 'month' | 'year' | 'agenda';

export type Avatar =
  | { type: 'initials' }
  | { type: 'emoji'; value: string }
  | { type: 'image'; dataUrl: string };

export interface Member {
  id: string;
  name: string;
  color: string;
  avatar: Avatar;
  /** shows generated sample events for this person */
  demo?: boolean;
}

/** Where the calendar links of an account come from – only used for labels and help texts. */
export type AccountKind = 'microsoft' | 'microsoft-work' | 'google' | 'icloud' | 'other';

/** A mail/calendar account. Groups calendars; it survives deleting a person. */
export interface Account {
  id: string;
  kind: AccountKind;
  label: string;
}

/** One (sub-)calendar of an account, subscribed via its ICS link. */
export interface CalendarSource {
  id: string;
  accountId: string;
  name: string;
  /** secret ICS subscription link (https:// or webcal://) */
  url: string;
  /** family members this calendar belongs to; empty = not shown */
  memberIds: string[];
  enabled: boolean;
}

/** German federal state code like 'DE-NW', '' = off */
export interface HolidaySettings {
  region: string;
  showPublic: boolean;
  showSchool: boolean;
}

export interface Settings {
  /** Cloudflare worker that fetches ICS links (CORS) */
  proxyUrl: string;
  holidays: HolidaySettings;
  weekStartsOn: 0 | 1;
  dayStartHour: number;
  dayEndHour: number;
  defaultView: ViewMode;
  refreshMinutes: number;
  idleResetMinutes: number;
  keepAwake: boolean;
  theme: 'auto' | 'light' | 'dark';
}

export interface AppConfig {
  schemaVersion: 2;
  settings: Settings;
  members: Member[];
  accounts: Account[];
  calendars: CalendarSource[];
}

export interface CalEvent {
  key: string;
  title: string;
  start: Date;
  /** exclusive end */
  end: Date;
  allDay: boolean;
  location?: string;
  notes?: string;
  calendarName?: string;
  memberIds: string[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

/** Public and school holidays of one day */
export interface DayMarks {
  publicNames: string[];
  schoolNames: string[];
}
