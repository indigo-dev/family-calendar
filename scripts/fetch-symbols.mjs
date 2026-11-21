// Downloads the symbol sets for every emoji the app uses into public/symbols/<set>/<key>.<ext>
// and writes src/lib/symbol-manifest.json (which keys each set has).
// The files are committed, so the app never loads symbols from the internet.
//
//   node scripts/fetch-symbols.mjs           -> fetch what is missing
//   node scripts/fetch-symbols.mjs --force   -> fetch everything again
//
// Run it again after adding new emoji to src/lib/shopping.ts (and map them in scripts/line-icons.json).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { emojiKey, usedEmoji } from './used-emoji.mjs';

// pinned sources
const FLUENT = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/1ffb34c752ecf5d402f04cfb4b392c77f57c54bc';
const FLUENT_TREE = 'https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/1ffb34c752ecf5d402f04cfb4b392c77f57c54bc?recursive=1';
const NOTO = 'https://raw.githubusercontent.com/googlefonts/noto-emoji/99701e07d3d1fe1bdbcdb14964547f0fd592966f';
const TWEMOJI = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@v17.0.3/assets/svg';
const OPENMOJI = 'https://cdn.jsdelivr.net/npm/openmoji@17.0.0';
const TABLER = 'https://cdn.jsdelivr.net/npm/@tabler/icons@3.52.0/icons/outline';
const PHOSPHOR = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets';
const LUCIDE = 'https://cdn.jsdelivr.net/npm/lucide-static@1.77.0/icons';
const EMOJIBASE = 'https://cdn.jsdelivr.net/npm/emojibase-data@18.0.0/en/data.json';

const force = process.argv.includes('--force');
const lineIcons = JSON.parse(readFileSync('scripts/line-icons.json', 'utf8'));
const line = (i) => (e) => lineIcons[e]?.[i] ?? null;

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

// ---- Fluent: files are named after the emoji's English name, found through the repo tree
let fluentIndex;
async function fluentPath(emoji, style) {
  if (!fluentIndex) {
    const [tree, base] = await Promise.all([get(FLUENT_TREE).then((r) => r.json()), get(EMOJIBASE).then((r) => r.json())]);
    const label = new Map(base.map((b) => [emojiKey(b.emoji), b.label]));
    const files = tree.tree.map((t) => t.path).filter((p) => p.startsWith('assets/'));
    fluentIndex = { label, files };
  }
  const name = fluentIndex.label.get(emojiKey(emoji));
  if (!name) return null;
  const dir = `assets/${name.toLowerCase()}/`;
  const ext = style === '3D' ? '.png' : '.svg';
  const candidates = fluentIndex.files.filter(
    (p) => p.toLowerCase().startsWith(dir) && p.includes(`/${style}/`) && p.endsWith(ext),
  );
  // emoji with skin tones have one folder per tone: take "Default"
  return candidates.find((p) => p.includes('/Default/')) ?? candidates[0] ?? null;
}
const fluent = (style) => async (e) => {
  const p = await fluentPath(e, style);
  return p ? `${FLUENT}/${p.split('/').map(encodeURIComponent).join('/')}` : null;
};

export const SETS = [
  { id: 'fluent-3d', ext: 'png', url: fluent('3D') },
  { id: 'fluent-color', ext: 'svg', url: fluent('Color') },
  { id: 'fluent-flat', ext: 'svg', url: fluent('Flat') },
  { id: 'fluent-mono', ext: 'svg', url: fluent('High Contrast') },
  { id: 'noto', ext: 'svg', url: (e) => `${NOTO}/2D/svg/emoji_u${emojiKey(e).replace(/-/g, '_')}.svg` },
  { id: 'noto-3d', ext: 'png', url: (e) => `${NOTO}/3D/png/128/emoji_u${emojiKey(e).replace(/-/g, '_')}.png` },
  { id: 'twemoji', ext: 'svg', url: (e) => `${TWEMOJI}/${emojiKey(e)}.svg` },
  { id: 'openmoji', ext: 'svg', url: (e) => `${OPENMOJI}/color/svg/${emojiKey(e).toUpperCase()}.svg` },
  { id: 'openmoji-line', ext: 'svg', url: (e) => `${OPENMOJI}/black/svg/${emojiKey(e).toUpperCase()}.svg` },
  { id: 'tabler', ext: 'svg', url: (e) => line(0)(e) && `${TABLER}/${line(0)(e)}.svg` },
  { id: 'phosphor', ext: 'svg', url: (e) => line(1)(e) && `${PHOSPHOR}/regular/${line(1)(e)}.svg` },
  { id: 'phosphor-duotone', ext: 'svg', url: (e) => line(1)(e) && `${PHOSPHOR}/duotone/${line(1)(e)}-duotone.svg` },
  { id: 'lucide', ext: 'svg', url: (e) => line(2)(e) && `${LUCIDE}/${line(2)(e)}.svg` },
];

async function pool(tasks, n) {
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < tasks.length) await tasks[i++]();
    }),
  );
}

const emoji = usedEmoji();
const manifest = {};
const missing = [];
let fetched = 0;

for (const set of SETS) {
  const dir = `public/symbols/${set.id}`;
  mkdirSync(dir, { recursive: true });
  manifest[set.id] = [];
  await pool(
    emoji.map((e) => async () => {
      const key = emojiKey(e);
      const file = `${dir}/${key}.${set.ext}`;
      if (!force && existsSync(file)) return void manifest[set.id].push(key);
      try {
        const url = await set.url(e);
        if (!url) throw new Error('no source');
        let body = Buffer.from(await (await get(url)).arrayBuffer());
        // line icons draw with currentColor; the app colours them via CSS mask, so only the shape matters
        if (set.ext === 'svg' && /<script|on\w+=/i.test(body.toString('utf8'))) throw new Error('unexpected script in svg');
        writeFileSync(file, body);
        manifest[set.id].push(key);
        fetched++;
      } catch (err) {
        missing.push(`${set.id} ${e} ${err.message}`);
      }
    }),
    8,
  );
  manifest[set.id].sort();
}

writeFileSync('src/lib/symbol-manifest.json', JSON.stringify(manifest, null, 0).replace(/\],/g, '],\n') + '\n');
console.log(`${emoji.length} emoji, ${fetched} files fetched`);
for (const s of SETS) console.log(`  ${s.id.padEnd(17)} ${manifest[s.id].length}/${emoji.length}`);
if (missing.length) console.log(`missing:\n  ${missing.join('\n  ')}`);
