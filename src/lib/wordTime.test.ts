import { describe, expect, it } from 'vitest';
import { wordTime } from './wordTime';

const at = (h: number, m: number) => wordTime(new Date(2026, 10, 22, h, m), 'de');
const en = (h: number, m: number) => wordTime(new Date(2026, 10, 22, h, m), 'en');

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
  it('follows the active language by default', () => {
    expect(wordTime(new Date(2026, 10, 22, 15, 15)).phrase).toBe('Viertel nach drei');
  });
});

describe('wordTime in English', () => {
  it('says full hours with "o’clock"', () => {
    expect(en(15, 0)).toEqual({ phrase: 'three o’clock', dots: 0 });
    expect(en(13, 3)).toEqual({ phrase: 'one o’clock', dots: 3 });
    expect(en(0, 0).phrase).toBe('twelve o’clock');
  });
  it('counts "past" the current hour up to half past', () => {
    expect(en(15, 5).phrase).toBe('five past three');
    expect(en(15, 15).phrase).toBe('quarter past three');
    expect(en(15, 25).phrase).toBe('twenty-five past three');
    expect(en(15, 34)).toEqual({ phrase: 'half past three', dots: 4 });
  });
  it('counts "to" the next hour after half past', () => {
    expect(en(15, 35).phrase).toBe('twenty-five to four');
    expect(en(15, 45).phrase).toBe('quarter to four');
    expect(en(11, 50).phrase).toBe('ten to twelve');
    expect(en(12, 55).phrase).toBe('five to one');
  });
});
