import { build } from 'esbuild';
await build({ entryPoints: ['src/plugin.mjs'], bundle: true, platform: 'node', target: 'node24', format: 'esm', outfile: 'com.viso.deck.sdPlugin/bin/plugin.mjs', banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" } });
