import { describe, expect, it } from 'vitest';
import { wordTime } from './wordTime';

const at = (h: number, m: number) => wordTime(new Date(2026, 10, 22, h, m));

describe('wordTime', () => {
  it('says full hours with "Uhr" and "ein Uhr"', () => {
    expect(at(15, 0)).toEqual({ phrase: 'drei Uhr', dots: 0 });
    expect(at(13, 2)).toEqual({ phrase: 'ein Uhr', dots: 2 });
    expect(at(0, 0).phrase).toBe('zwölf Uhr');
  });
  it('uses the next hour from twenty-five past on', () => {
    expect(at(15, 15).phrase).toBe('Viertel nach drei');
    expect(at(15, 25).phrase).toBe('fünf vor halb vier');
    expect(at(15, 34)).toEqual({ phrase: 'halb vier', dots: 4 });
    expect(at(11, 45).phrase).toBe('Viertel vor zwölf');
    expect(at(12, 55).phrase).toBe('fünf vor eins');
  });
});
