import { getLanguage, type Language } from '../i18n';

type WordTime = { phrase: string; dots: number };

const HOURS_DE = ['zwölf', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf'];
const HOURS_EN = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];

/** German: "Viertel nach drei", "fünf vor halb vier", "ein Uhr" */
function german(h: number, m: number): string {
  const next = (h + 1) % 12;
  const H = (x: number) => HOURS_DE[x];
  return [
    `${h === 1 ? 'ein' : H(h)} Uhr`,
    `fünf nach ${H(h)}`,
    `zehn nach ${H(h)}`,
    `Viertel nach ${H(h)}`,
    `zwanzig nach ${H(h)}`,
    `fünf vor halb ${H(next)}`,
    `halb ${H(next)}`,
    `fünf nach halb ${H(next)}`,
    `zwanzig vor ${H(next)}`,
    `Viertel vor ${H(next)}`,
    `zehn vor ${H(next)}`,
    `fünf vor ${H(next)}`,
  ][Math.floor(m / 5)];
}

/** English: "quarter past three", "twenty-five to four", "half past three" (half past = the current hour) */
function english(h: number, m: number): string {
  const next = (h + 1) % 12;
  const H = (x: number) => HOURS_EN[x];
  return [
    `${H(h)} o’clock`,
    `five past ${H(h)}`,
    `ten past ${H(h)}`,
    `quarter past ${H(h)}`,
    `twenty past ${H(h)}`,
    `twenty-five past ${H(h)}`,
    `half past ${H(h)}`,
    `twenty-five to ${H(next)}`,
    `twenty to ${H(next)}`,
    `quarter to ${H(next)}`,
    `ten to ${H(next)}`,
    `five to ${H(next)}`,
  ][Math.floor(m / 5)];
}

/** Time in words, rounded down to five minutes; `dots` = the minutes beyond that (0–4). */
export function wordTime(d: Date, lang: Language = getLanguage()): WordTime {
  const m = d.getMinutes();
  const h = d.getHours() % 12;
  return { phrase: lang === 'de' ? german(h, m) : english(h, m), dots: m % 5 };
}
