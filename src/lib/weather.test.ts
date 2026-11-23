import { describe, expect, it } from 'vitest';
import {
  activeAlerts,
  airAt,
  aqiLevel,
  beaufort,
  describe as describeCode,
  localIso,
  nowcast,
  pressureTrend,
  pollenLevel,
  protectionWindow,
  uvLevel,
  type Alert,
  type AirHour,
  type Hour,
  type Quarter,
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

describe('weather cockpit values', () => {
  it('aqiLevel uses the bands of the European index', () => {
    expect([5, 20, 21, 55, 79, 100, 140].map((v) => aqiLevel(v).level)).toEqual([1, 1, 2, 3, 4, 5, 6]);
    expect(aqiLevel(10).label).toBe('gut');
  });

  it('beaufort maps km/h to the scale', () => {
    expect([0, 5, 16, 40, 120].map((v) => beaufort(v).bft)).toEqual([0, 1, 3, 6, 12]);
    expect(beaufort(16).label).toBe('schwache Brise');
  });

  it('pressureTrend compares with three hours earlier', () => {
    const h = (i: number, pressure: number) => ({ time: `2026-11-23T${String(i).padStart(2, '0')}:00`, pressure }) as Hour;
    const hours = [h(0, 1010), h(1, 1010.5), h(2, 1011), h(3, 1012), h(4, 1011), h(5, 1009.8)];
    expect(pressureTrend(hours, '2026-11-23T03:00')).toBe('rising');
    expect(pressureTrend(hours, '2026-11-23T05:00')).toBe('falling');
    expect(pressureTrend(hours, '2026-11-23T04:00')).toBe('steady');
    expect(pressureTrend(hours, '2026-11-23T01:00')).toBeNull();
  });

  it('nowcast tells when precipitation starts, stops or stays away', () => {
    const now = new Date(2026, 10, 23, 15, 7);
    const q = (rain: number[]) =>
      rain.map((r, i) => {
        const d = new Date(2026, 10, 23, 15, i * 15);
        return { time: localIso(d), rain: r, snow: 0 } as Quarter;
      });
    expect(nowcast(q([0, 0, 0, 0, 0, 0, 0, 0]), now)?.kind).toBe('dry');
    expect(nowcast(q([0, 0, 0.3, 0.5, 0, 0, 0, 0]), now)).toMatchObject({ kind: 'starts', at: '2026-11-23T15:30', total: 0.8 });
    expect(nowcast(q([0.2, 0.1, 0, 0, 0, 0, 0, 0]), now)).toMatchObject({ kind: 'stops', at: '2026-11-23T15:30' });
    expect(nowcast(q([0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]), now)?.kind).toBe('continues');
    expect(nowcast(null, now)).toBeNull();
  });

  it('airAt only answers for hours the air quality forecast covers', () => {
    const air = [{ time: '2026-11-23T15:00', aqi: 18 }] as AirHour[];
    expect(airAt(air, '2026-11-23T15:00')?.aqi).toBe(18);
    expect(airAt(air, '2026-11-27T12:00')).toBeNull();
    expect(airAt(null, '2026-11-23T15:00')).toBeNull();
  });
});
