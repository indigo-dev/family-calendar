const HOURS = ['zwölf', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf'];

/** German time in words, rounded down to five minutes; `dots` = the minutes beyond that (0–4). */
export function wordTime(d: Date): { phrase: string; dots: number } {
  const m = d.getMinutes();
  const h = d.getHours() % 12;
  const next = (h + 1) % 12;
  const H = (x: number) => HOURS[x];
  const phrases = [
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
  ];
  return { phrase: phrases[Math.floor(m / 5)], dots: m % 5 };
}
