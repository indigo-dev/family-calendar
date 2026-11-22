import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Gives every build its own service worker cache: `__BUILD_ID__` in dist/sw.js becomes a hash of the
 * built file names (they contain content hashes). A changed sw.js also makes the browser install the
 * new worker, which then deletes the caches of older builds.
 */
function serviceWorkerVersion(): Plugin {
  let outDir = 'dist';
  let buildId = '';
  return {
    name: 'service-worker-version',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    generateBundle(_options, bundle) {
      buildId = createHash('sha256').update(Object.keys(bundle).sort().join('\n')).digest('hex').slice(0, 12);
    },
    closeBundle() {
      const file = join(outDir, 'sw.js');
      const src = readFileSync(file, 'utf8');
      if (!src.includes('__BUILD_ID__')) throw new Error('sw.js: Platzhalter __BUILD_ID__ fehlt');
      writeFileSync(file, src.replaceAll('__BUILD_ID__', buildId));
    },
  };
}

// base './' -> relative asset paths, so the build runs under any sub-path
// (e.g. https://<user>.github.io/Family_Calendar/) without extra config.
export default defineConfig({
  base: './',
  plugins: [react(), serviceWorkerVersion()],
});
