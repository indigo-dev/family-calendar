// Collects every emoji the app shows as a symbol (shopping catalogue, departments, emoji picker).
import { readFileSync } from 'node:fs';

const SOURCES = ['src/lib/shopping.ts'];

/** emoji -> file key: code points without FE0F, lower-case hex, joined by '-' */
export function emojiKey(e) {
  return [...e]
    .map((c) => c.codePointAt(0))
    .filter((cp) => cp !== 0xfe0f)
    .map((cp) => cp.toString(16))
    .join('-');
}

export function usedEmoji(root = '.') {
  const set = new Set();
  for (const f of SOURCES) {
    const src = readFileSync(`${root}/${f}`, 'utf8');
    for (const m of src.matchAll(/'([^'\n]*)'/g)) {
      if (/\p{Extended_Pictographic}/u.test(m[1])) set.add(m[1]);
    }
  }
  return [...set];
}

if (import.meta.url.endsWith(process.argv[1]?.split(/[\\/]/).pop() ?? '')) {
  const list = usedEmoji();
  console.log(list.length, list.map((e) => `${e} ${emojiKey(e)}`).join('\n'));
}
