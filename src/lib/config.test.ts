import { describe, expect, it } from 'vitest';
import { clampDays, DEFAULT_SETTINGS, initials, parseConfig } from './config';

const base = {
  schemaVersion: 3,
  members: [{ id: 'm1', name: 'Papa', color: '#3b82f6', avatar: { type: 'initials' } }],
  calendars: [],
  settings: {},
};

describe('parseConfig', () => {
  it('rejects unknown input', () => {
    expect(() => parseConfig(null)).toThrow();
    expect(() => parseConfig({ ...base, schemaVersion: 99 })).toThrow('Unbekannte Konfigurationsversion.');
    expect(() => parseConfig({ ...base, members: 'x' })).toThrow('Familienmitglieder fehlen.');
  });

  it('fills missing settings with defaults and drops values of the wrong type', () => {
    const cfg = parseConfig({ ...base, settings: { refreshMinutes: '5', dayStartHour: 7, style: 'nope', multiDays: 99 } });
    expect(cfg.settings.refreshMinutes).toBe(DEFAULT_SETTINGS.refreshMinutes);
    expect(cfg.settings.dayStartHour).toBe(7);
    expect(cfg.settings.style).toBe(DEFAULT_SETTINGS.style);
    expect(cfg.settings.multiDays).toBe(6);
  });

  it('keeps known styles and falls back to the default for unknown ones', () => {
    const style = (s: string) => parseConfig({ ...base, settings: { style: s } }).settings.style;
    expect(style('aurora')).toBe('aurora');
    expect(style('sonoma')).toBe(DEFAULT_SETTINGS.style);
  });

  it('accepts backups without a language and keeps a valid one', () => {
    expect(parseConfig(base).settings.language).toBe('auto');
    expect(parseConfig({ ...base, settings: { language: 'en' } }).settings.language).toBe('en');
    expect(parseConfig({ ...base, settings: { language: 'es' } }).settings.language).toBe('auto');
  });

  it('drops calendar assignments to people that do not exist', () => {
    const cfg = parseConfig({
      ...base,
      calendars: [{ id: 'c1', name: 'Arbeit', url: 'https://x/y.ics', memberIds: ['m1', 'gone'] }],
    });
    expect(cfg.calendars[0].memberIds).toEqual(['m1']);
    expect(cfg.calendars[0].enabled).toBe(true);
  });

  it('migrates version 1 demo members', () => {
    const cfg = parseConfig({ ...base, schemaVersion: 1, members: [{ id: 'd', name: 'Demo', source: 'demo' }] });
    expect(cfg.schemaVersion).toBe(3);
    expect(cfg.members[0].demo).toBe(true);
  });
});

describe('helpers', () => {
  it('clampDays keeps the multi-day view between 2 and 6', () => {
    expect(clampDays(1)).toBe(2);
    expect(clampDays(4.4)).toBe(4);
    expect(clampDays(Number.NaN)).toBe(3);
  });

  it('initials', () => {
    expect(initials('Lena')).toBe('LE');
    expect(initials('Anna Maria Schmidt')).toBe('AS');
    expect(initials('  ')).toBe('?');
  });
});
