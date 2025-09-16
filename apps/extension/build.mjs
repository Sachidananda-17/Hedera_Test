import { build } from 'esbuild';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outdir = resolve(__dirname);

await build({
  entryPoints: [resolve(__dirname, 'walletconnect-setup.js')],
  bundle: true,
  minify: true,
  sourcemap: false,
  platform: 'browser',
  target: ['chrome110'],
  outfile: resolve(outdir, 'walletconnect.global.js'),
  format: 'iife',
  globalName: 'WalletConnectGlobal'
});

console.log('WalletConnect global bundle built.');


