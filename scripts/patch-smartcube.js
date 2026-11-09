// Patch script for smartcube-web-bluetooth:
// 1. MoYu32 driver bug on double turns / multi-move bursts
// 2. GAN Gen3 & Gen4 direction string bug on double turns (" '".charAt(direction) returning empty string for 2)
// 3. GAN Gen3 & Gen4 move buffer stall resilience (prevents forced disconnect on lost packets)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const filesToPatch = [
  path.join(rootDir, 'node_modules/smartcube-web-bluetooth/dist/esm/index.mjs'),
  path.join(rootDir, 'node_modules/smartcube-web-bluetooth/dist/cjs/index.cjs'),
  path.join(rootDir, 'node_modules/smartcube-web-bluetooth/src/smartcube/protocols/moyu32.ts'),
  path.join(rootDir, 'node_modules/smartcube-web-bluetooth/src/gan-cube-protocol.ts')
];

let totalPatches = 0;

for (const file of filesToPatch) {
  if (!fs.existsSync(file)) continue;

  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // 1. MoYu32 multi-turn condition
  const moyuPattern = /\(this\.cubeSize\s*===\s*3\s*\|\|\s*i\s*<\s*Math\.min\(rawDelta,\s*history\.codes\.length\)\)\s*&&\s*m\s*>=\s*faces\.length\s*\*\s*2/;
  const moyuReplacement = 'i < Math.min(rawDelta, history.codes.length) && m >= faces.length * 2';
  if (moyuPattern.test(content)) {
    content = content.replace(moyuPattern, moyuReplacement);
    modified = true;
    console.log(`[patch-smartcube] Patched MoYu32 multi-turn in ${path.relative(rootDir, file)}`);
    totalPatches++;
  }

  // 2. GAN Gen3/Gen4 direction string fix: " '".charAt(direction) -> " '2".charAt(direction)
  // Index 0 -> ' ' (CW), Index 1 -> "'" (CCW), Index 2 -> '2' (Double turn)
  const ganDirPattern = /"URFDLB"\.charAt\(face\)\s*\+\s*" '"\.charAt\(direction\)/g;
  const ganDirReplacement = '"URFDLB".charAt(face) + " \'2".charAt(direction)';
  if (ganDirPattern.test(content)) {
    content = content.replace(ganDirPattern, ganDirReplacement);
    modified = true;
    console.log(`[patch-smartcube] Patched GAN direction decoding in ${path.relative(rootDir, file)}`);
    totalPatches++;
  }

  // 3. GAN Gen3/Gen4 move buffer stall resilience (don't stall until > 16 and disconnect)
  const ganStallPattern = /if\s*\(diff\s*>\s*1\)\s*\{\s*if\s*\(conn\)\s*(?:await\s+this\.requestMoveHistory\(conn,\s*bufferHead\.serial,\s*diff\);|\{\s*await\s+this\.requestMoveHistory\(conn,\s*bufferHead\.serial,\s*diff\);\s*\})\s*break;\s*\}\s*else\s*\{/g;
  const ganStallReplacement = 'if (diff > 1) {\n                if (conn && this.moveBuffer.length <= 4) {\n                    await this.requestMoveHistory(conn, bufferHead.serial, diff);\n                    break;\n                }\n            }\n            {';
  if (ganStallPattern.test(content)) {
    content = content.replace(ganStallPattern, ganStallReplacement);
    modified = true;
    console.log(`[patch-smartcube] Patched GAN buffer stall resilience in ${path.relative(rootDir, file)}`);
    totalPatches++;
  }

  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
  }
}

console.log(`[patch-smartcube] Done. Applied ${totalPatches} patches across files.`);
