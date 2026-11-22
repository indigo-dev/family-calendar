import { describe, expect, it } from 'vitest';
import {
  activeAlerts,
  describe as describeCode,
  pollenLevel,
  protectionWindow,
  uvLevel,
  type Alert,
  type Hour,
  type WeatherData,
} from './weather';

describe('weather helpers', () => {
  it('describe gives a night symbol for clear skies at night', () => {
    expect(describeCode(0, true)).toEqual({ text: 'Klar', icon: '☀️' });
    expect(describeCode(0, false).icon).toBe('🌙');
    expect(describeCode(1234).text).toBe('–');
  });

  it('uvLevel follows the WHO steps', () => {
    expect([0, 2.9, 3, 5.9, 6, 8, 11].map((v) => uvLevel(v).label)).toEqual([
      'keine',
      'niedrig',
      'mittel',
      'mittel',
      'hoch',
      'sehr hoch',
      'extrem',
    ]);
  });

  it('pollenLevel uses the thresholds per pollen type', () => {
    expect([0, 1, 10, 50].map((v) => pollenLevel('grass', v))).toEqual([0, 1, 2, 3]);
    expect(pollenLevel('ragweed', 6)).toBe(2);
  });

  it('protectionWindow spans the hours with UV ≥ 3 of that day', () => {
    const hour = (time: string, uv: number) => ({ time, uv }) as Hour;
    const hours = [hour('2026-06-21T10:00', 2), hour('2026-06-21T11:00', 3), hour('2026-06-21T15:00', 4), hour('2026-06-22T12:00', 7)];
    expect(protectionWindow(hours, '2026-06-21')).toBe('11–16 Uhr');
    expect(protectionWindow(hours, '2026-06-23')).toBeNull();
  });

  it('activeAlerts drops expired warnings', () => {
    const alert = (id: number, expires: string | null) => ({ id, expires }) as Alert;
    const data = { alerts: [alert(1, '2026-11-22T10:00:00+01:00'), alert(2, '2026-11-22T20:00:00+01:00'), alert(3, null)] } as WeatherData;
    expect(activeAlerts(data, new Date('2026-11-22T12:00:00+01:00')).map((a) => a.id)).toEqual([2, 3]);
    expect(activeAlerts(null, new Date())).toEqual([]);
  });
});
