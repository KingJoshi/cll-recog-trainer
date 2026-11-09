// Patch script for smartcube-web-bluetooth MoYu32 driver bug on double turns / multi-move bursts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const filesToPatch = [
  path.join(rootDir, 'node_modules/smartcube-web-bluetooth/dist/esm/index.mjs'),
  path.join(rootDir, 'node_modules/smartcube-web-bluetooth/dist/cjs/index.cjs'),
  path.join(rootDir, 'node_modules/smartcube-web-bluetooth/src/smartcube/protocols/moyu32.ts')
];

const targetPattern = /\(this\.cubeSize\s*===\s*3\s*\|\|\s*i\s*<\s*Math\.min\(rawDelta,\s*history\.codes\.length\)\)\s*&&\s*m\s*>=\s*faces\.length\s*\*\s*2/;
const replacement = 'i < Math.min(rawDelta, history.codes.length) && m >= faces.length * 2';

let patchedCount = 0;
for (const file of filesToPatch) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    if (targetPattern.test(content)) {
      const patched = content.replace(targetPattern, replacement);
      fs.writeFileSync(file, patched, 'utf8');
      console.log(`[patch-smartcube] Successfully patched ${path.relative(rootDir, file)}`);
      patchedCount++;
    } else if (content.includes(replacement)) {
      console.log(`[patch-smartcube] Already patched: ${path.relative(rootDir, file)}`);
      patchedCount++;
    } else {
      console.warn(`[patch-smartcube] Pattern not found in ${path.relative(rootDir, file)}`);
    }
  }
}

console.log(`[patch-smartcube] Done. Patched ${patchedCount} files.`);
