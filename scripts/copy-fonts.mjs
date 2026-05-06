/**
 * Copies the needed @fontsource woff2 files from node_modules into styles/fonts/.
 * Run automatically on `npm install` via the postinstall script in package.json.
 *
 * Foundry VTT serves the system directory but not node_modules, so font files must
 * live inside the system for the browser to load them via @font-face.
 */

import { cpSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const nm = join(root, 'node_modules', '@fontsource');
const dest = join(root, 'styles', 'fonts');

const copies = [
  { pkg: 'lora',                 dir: 'lora',                files: ['lora-latin-400-normal.woff2', 'lora-latin-500-normal.woff2', 'lora-latin-400-italic.woff2'] },
  { pkg: 'crimson-text',         dir: 'crimson-text',         files: ['crimson-text-latin-400-normal.woff2', 'crimson-text-latin-600-normal.woff2', 'crimson-text-latin-400-italic.woff2'] },
  { pkg: 'cormorant-garamond',   dir: 'cormorant-garamond',   files: ['cormorant-garamond-latin-400-normal.woff2', 'cormorant-garamond-latin-500-normal.woff2', 'cormorant-garamond-latin-400-italic.woff2'] },
  { pkg: 'eb-garamond',          dir: 'eb-garamond',          files: ['eb-garamond-latin-400-normal.woff2', 'eb-garamond-latin-400-italic.woff2'] },
  { pkg: 'dm-serif-display',     dir: 'dm-serif-display',     files: ['dm-serif-display-latin-400-normal.woff2'] },
  { pkg: 'cinzel',               dir: 'cinzel',               files: ['cinzel-latin-400-normal.woff2', 'cinzel-latin-600-normal.woff2'] },
];

let copied = 0;
for (const { pkg, dir, files } of copies) {
  const destDir = join(dest, dir);
  mkdirSync(destDir, { recursive: true });
  for (const file of files) {
    cpSync(join(nm, pkg, 'files', file), join(destDir, file));
    copied++;
  }
}

console.log(`copy-fonts: ${copied} woff2 files → styles/fonts/`);
