export type ViewMode = 'day' | 'week' | 'month' | 'year' | 'agenda';

export type Avatar =
  | { type: 'initials' }
  | { type: 'emoji'; value: string }
  | { type: 'image'; dataUrl: string };

export interface LinkedAccount {
  /** MSAL homeAccountId – only valid on the device where the login happened */
  homeAccountId: string;
  username: string;
  name?: string;
}

export interface CalendarRef {
  id: string;
  name: string;
}

export interface Member {
  id: string;
  name: string;
  color: string;
  avatar: Avatar;
  /** 'outlook' = real Microsoft account, 'demo' = generated sample events */
  source: 'outlook' | 'demo';
  account?: LinkedAccount;
  calendars: CalendarRef[];
}

export interface Settings {
  clientId: string;
  authority: 'common' | 'consumers' | 'organizations';
  loginMode: 'redirect' | 'popup';
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
  schemaVersion: 1;
  settings: Settings;
  members: Member[];
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
