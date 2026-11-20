// Patch script for smartcube-web-bluetooth:
// 1. MoYu32 driver bug on double turns / multi-move bursts
// 2. GAN Gen3 & Gen4 direction string bug on double turns (" '".charAt(direction) returning empty string for 2)
// 3. GAN Gen3 & Gen4 move buffer stall resilience (prevents forced disconnect on lost packets)
// 4. GAN Gen3 & Gen4 16-bit vs 8-bit serial mismatch in requestMoveHistory, checkIfMoveMissed, and injectMissedMoveToBuffer
// 5. GAN Gen3 & Gen4 injectMissedMoveToBuffer: maskbufferHead.serial & 0xFF when matching history moves
// 6. GAN Gen3 & Gen4 evictMoveBuffer: only evict when diff <= 1 (or buffer overflow > 4) instead of dropping gaps immediately
// 7. MoYu32 MAC verification & candidate probing: accept valid HARDWARE/BATTERY/FACELETS events for MAC verification and probe all candidate prefixes (00, 01, 02, 03)

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
  path.join(rootDir, 'node_modules/smartcube-web-bluetooth/src/gan-cube-protocol.ts'),
  path.join(rootDir, 'node_modules/smartcube-web-bluetooth/src/smartcube/connect.ts'),
  path.join(rootDir, 'node_modules/smartcube-web-bluetooth/src/smartcube/attachment/mac-candidates.ts'),
  path.join(rootDir, 'node_modules/smartcube-web-bluetooth/src/smartcube/attachment/mac-probe-moyu32.ts'),
  path.join(rootDir, 'node_modules/.vite/deps/smartcube-web-bluetooth.js')
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

  // 3. GAN Gen3/Gen4 move buffer stall resilience (discard duplicates/stale moves, wait for history up to 12 moves, never drop gaps prematurely)
  const ganStallPatternOld = /if\s*\(diff\s*>\s*1\)\s*\{\s*if\s*\(conn\)\s*(?:await\s+this\.requestMoveHistory\(conn,\s*bufferHead\.serial,\s*diff\);|\{\s*await\s+this\.requestMoveHistory\(conn,\s*bufferHead\.serial,\s*diff\);\s*\})\s*break;\s*\}\s*else\s*\{/g;
  const ganStallPatternBroken = /if\s*\(diff\s*>\s*1\)\s*\{\s*if\s*\(conn\s*&&\s*this\.moveBuffer\.length\s*<=\s*4\)\s*\{\s*await\s+this\.requestMoveHistory\(conn,\s*bufferHead\.serial,\s*diff\);\s*break;\s*\}\s*\}\s*\{/g;
  const ganStallPatternV2 = /if\s*\(diff\s*>\s*1\s*&&\s*this\.moveBuffer\.length\s*<=\s*4\)\s*\{\s*if\s*\(conn\)\s*\{\s*await\s+this\.requestMoveHistory\(conn,\s*bufferHead\.serial,\s*diff\);\s*\}\s*break;\s*\}\s*else\s*\{/g;
  const ganStallFixed = `if (diff === 0 || diff > 200) {
                this.moveBuffer.shift();
                continue;
            }
            if (diff > 1 && this.moveBuffer.length <= 12) {
                if (conn) {
                    await this.requestMoveHistory(conn, bufferHead.serial, diff);
                }
                break;
            } else {`;
  if (ganStallPatternOld.test(content)) {
    content = content.replace(ganStallPatternOld, ganStallFixed);
    modified = true;
    console.log(`[patch-smartcube] Patched GAN buffer stall resilience in ${path.relative(rootDir, file)}`);
    totalPatches++;
  } else if (ganStallPatternBroken.test(content)) {
    content = content.replace(ganStallPatternBroken, ganStallFixed);
    modified = true;
    console.log(`[patch-smartcube] Fixed GAN buffer eviction else-branch in ${path.relative(rootDir, file)}`);
    totalPatches++;
  } else if (ganStallPatternV2.test(content)) {
    content = content.replace(ganStallPatternV2, ganStallFixed);
    modified = true;
    console.log(`[patch-smartcube] Upgraded GAN buffer eviction (dup filter + 12-move window) in ${path.relative(rootDir, file)}`);
    totalPatches++;
  }

  // 3b. GAN Gen4 0x01 multi-chunk guard: prevent trailing garbage bytes at off >= 72 from corrupting this.serial or pushing phantom moves (allowing direction 0, 1, 2 for CW, CCW, Double)
  const ganGen4ChunkPattern = /let\s+cubeTimestamp\s*=\s*msg\.getBitWord\(off\s*\+\s*16,\s*32,\s*true\);\s*let\s+serial\s*=\s*msg\.getBitWord\(off\s*\+\s*48,\s*16,\s*true\);\s*this\.serial\s*=\s*serial;\s*let\s+direction\s*=\s*msg\.getBitWord\(off\s*\+\s*64,\s*2\);\s*let\s+face\s*=\s*\[2,\s*32,\s*8,\s*1,\s*16,\s*4\]\.indexOf\(msg\.getBitWord\(off\s*\+\s*66,\s*6\)\);\s*let\s+move\s*=\s*"URFDLB"\.charAt\(face\)\s*\+\s*" '2?"\.charAt\(direction\);\s*if\s*\(face\s*<\s*0\)\s*\{\s*break;\s*\}/g;
  const ganGen4ChunkReplacement = `let cubeTimestamp = msg.getBitWord(off + 16, 32, true);
                    let serial = msg.getBitWord(off + 48, 16, true);
                    let direction = msg.getBitWord(off + 64, 2);
                    let face = [2, 32, 8, 1, 16, 4].indexOf(msg.getBitWord(off + 66, 6));
                    if (face < 0 || direction > 2 || (off > 0 && (msg.getBitWord(off + 8, 8) !== 7 || serial !== ((this.serial + 1) & 0xFFFF)))) {
                        break;
                    }
                    this.serial = serial;
                    let move = "URFDLB".charAt(face) + " '2".charAt(direction);`;
  const ganGen4ChunkFixDirPattern = /if\s*\(face\s*<\s*0\s*\|\|\s*direction\s*>\s*1\s*\|\|\s*\(off\s*>\s*0\s*&&\s*\(msg\.getBitWord\(off\s*\+\s*8,\s*8\)\s*!==\s*7\s*\|\|\s*serial\s*!==\s*\(\(this\.serial\s*\+\s*1\)\s*&\s*0xFFFF\)\)\)\)/g;
  const ganGen4ChunkFixDirReplacement = 'if (face < 0 || direction > 2 || (off > 0 && (msg.getBitWord(off + 8, 8) !== 7 || serial !== ((this.serial + 1) & 0xFFFF))))';
  if (ganGen4ChunkPattern.test(content)) {
    content = content.replace(ganGen4ChunkPattern, ganGen4ChunkReplacement);
    modified = true;
    console.log(`[patch-smartcube] Patched GAN Gen4 0x01 trailing chunk validation in ${path.relative(rootDir, file)}`);
    totalPatches++;
  } else if (ganGen4ChunkFixDirPattern.test(content)) {
    content = content.replace(ganGen4ChunkFixDirPattern, ganGen4ChunkFixDirReplacement);
    modified = true;
    console.log(`[patch-smartcube] Upgraded GAN Gen4 0x01 chunk validation to allow direction 2 in ${path.relative(rootDir, file)}`);
    totalPatches++;
  }

  // 4. GAN Gen3/Gen4 8-bit serial clamping in requestMoveHistory (fixes phantom 'D' moves when 16-bit serial >= 256)
  const ganHistSerialPattern = /if\s*\(serial\s*%\s*2\s*==\s*0\)\s*\n?\s*serial\s*=\s*\(?serial\s*-\s*1\)?\s*&\s*(?:0xFF|255);/g;
  const ganHistSerialReplacement = 'serial = serial & 0xFF;\n        if (serial % 2 == 0)\n            serial = (serial - 1) & 0xFF;';
  if (ganHistSerialPattern.test(content) && !content.includes('serial = serial & 0xFF;')) {
    content = content.replace(ganHistSerialPattern, ganHistSerialReplacement);
    modified = true;
    console.log(`[patch-smartcube] Patched GAN requestMoveHistory 8-bit serial mask in ${path.relative(rootDir, file)}`);
    totalPatches++;
  }

  // 5. GAN Gen3/Gen4 checkIfMoveMissed 8-bit boundary check (0, 256, 512...)
  const ganMissedBoundaryPattern = /if\s*\(diff\s*>\s*0\)\s*\{\s*\n?\s*if\s*\(this\.serial\s*!=\s*0\)\s*\{/g;
  const ganMissedBoundaryReplacement = 'if (diff > 0) {\n                if ((this.serial & 0xFF) != 0) {';
  if (ganMissedBoundaryPattern.test(content)) {
    content = content.replace(ganMissedBoundaryPattern, ganMissedBoundaryReplacement);
    modified = true;
    console.log(`[patch-smartcube] Patched GAN checkIfMoveMissed 8-bit boundary check in ${path.relative(rootDir, file)}`);
    totalPatches++;
  }

  // 6. GAN Gen3/Gen4 injectMissedMoveToBuffer 8-bit serial duplicate & head-1 comparison
  const ganInjectDupPattern = /e\.type\s*==\s*"MOVE"\s*&&\s*e\.serial\s*==\s*move\.serial/g;
  const ganInjectDupReplacement = 'e.type == "MOVE" && (e.serial & 0xFF) == (move.serial & 0xFF)';
  if (ganInjectDupPattern.test(content)) {
    content = content.replace(ganInjectDupPattern, ganInjectDupReplacement);
    modified = true;
    console.log(`[patch-smartcube] Patched GAN injectMissedMoveToBuffer 8-bit serial comparison in ${path.relative(rootDir, file)}`);
    totalPatches++;
  }

  const ganInjectHeadPattern = /if\s*\(\(?\s*move\.serial\s*&\s*(?:0xFF|255)\s*\)?\s*==\s*\(\(?\s*bufferHead\.serial\s*-\s*1\s*\)?\s*&\s*(?:0xFF|255)\)\)|if\s*\(move\.serial\s*==\s*\(\(?\s*bufferHead\.serial\s*-\s*1\s*\)?\s*&\s*(?:0xFF|255)\)\)/g;
  const ganInjectHeadReplacement = 'if ((move.serial & 0xFF) == ((bufferHead.serial - 1) & 0xFF))';
  if (ganInjectHeadPattern.test(content) && !content.includes('if ((move.serial & 0xFF) == ((bufferHead.serial - 1) & 0xFF))')) {
    content = content.replace(ganInjectHeadPattern, ganInjectHeadReplacement);
    modified = true;
    console.log(`[patch-smartcube] Patched GAN injectMissedMoveToBuffer head-1 8-bit mask in ${path.relative(rootDir, file)}`);
    totalPatches++;
  }

  // 7. MoYu32 / SmartCube MAC verification: accept valid HARDWARE or BATTERY or FACELETS event as proof of valid decryption
  const macProofPattern = /function\s+isMacCacheProofEvent\s*\(\s*e(?:\s*:\s*SmartCubeEvent)?\s*\)(?:\s*:\s*boolean)?\s*\{\s*if\s*\(\s*e\.type\s*!==\s*['"]FACELETS['"]\s*\)\s*\{\s*return\s+false;\s*\}\s*return\s+e\.facelets\.length\s*===\s*24\s*\?\s*parse2x2Facelets\(e\.facelets\)\s*!==\s*null\s*:\s*e\.facelets\.length\s*===\s*54\s*&&\s*new\s+CubieCube\(\)\.fromFacelet\(e\.facelets\)\s*!==\s*-1;\s*\}/;
  const macProofReplacement = `function isMacCacheProofEvent(e) {
    if (e.type === 'HARDWARE') {
        return Boolean(e.hardwareName && /^[\\x20-\\x7E]{2,}$/.test(e.hardwareName));
    }
    if (e.type === 'BATTERY') {
        return typeof e.batteryLevel === 'number' && e.batteryLevel >= 0 && e.batteryLevel <= 100;
    }
    if (e.type === 'MOVE') {
        return Boolean(e.move);
    }
    if (e.type !== 'FACELETS') {
        return false;
    }
    return e.facelets.length === 24
        ? parse2x2Facelets(e.facelets) !== null
        : e.facelets.length === 54 && (new CubieCube().fromFacelet(e.facelets) !== -1 || /^[URFDLB]{54}$/.test(e.facelets));
}`;
  if (macProofPattern.test(content)) {
    content = content.replace(macProofPattern, macProofReplacement);
    modified = true;
    console.log(`[patch-smartcube] Patched isMacCacheProofEvent in ${path.relative(rootDir, file)}`);
    totalPatches++;
  }

  // 8. Also request both FACELETS and HARDWARE during requestFreshStateForMacVerify so MoYu32 always responds
  const reqFreshPattern = /function\s+requestFreshStateForMacVerify\s*\(\s*conn(?:\s*:\s*SmartCubeConnection)?\s*\)(?:\s*:\s*void)?\s*\{\s*const\s+c\s*=\s*conn\.capabilities;\s*const\s+p(?:\s*:\s*Promise<void>)?\s*=\s*c\.facelets\s*\?\s*conn\.sendCommand\(\{\s*type:\s*['"]REQUEST_FACELETS['"]\s*\}\)\s*:\s*c\.hardware\s*\?\s*conn\.sendCommand\(\{\s*type:\s*['"]REQUEST_HARDWARE['"]\s*\}\)\s*:\s*c\.battery\s*\?\s*conn\.sendCommand\(\{\s*type:\s*['"]REQUEST_BATTERY['"]\s*\}\)\s*:\s*Promise\.resolve\(\);\s*p\.catch\(\(\)\s*=>\s*\{\s*\}\);\s*\}/;
  const reqFreshReplacement = `function requestFreshStateForMacVerify(conn) {
    const c = conn.capabilities;
    if (c.facelets) conn.sendCommand({ type: 'REQUEST_FACELETS' }).catch(() => {});
    if (c.hardware) conn.sendCommand({ type: 'REQUEST_HARDWARE' }).catch(() => {});
    if (c.battery) conn.sendCommand({ type: 'REQUEST_BATTERY' }).catch(() => {});
}`;
  if (reqFreshPattern.test(content)) {
    content = content.replace(reqFreshPattern, reqFreshReplacement);
    modified = true;
    console.log(`[patch-smartcube] Patched requestFreshStateForMacVerify in ${path.relative(rootDir, file)}`);
    totalPatches++;
  }

  // 9. MoYu32 probeMoyu32Mac: accept >= 1 valid decrypted packet (instead of requiring >= 3 within 2000ms)
  const moyuProbeGoodPattern = /if\s*\(\s*good\s*>=\s*3\s*\)\s*\{\s*stopped\s*=\s*true;\s*break;\s*\}/g;
  const moyuProbeGoodReplacement = 'if (good >= 1) {\n            stopped = true;\n            break;\n        }';
  if (moyuProbeGoodPattern.test(content)) {
    content = content.replace(moyuProbeGoodPattern, moyuProbeGoodReplacement);
    content = content.replace(/return\s+good\s*>=\s*3;/g, 'return good >= 1;');
    modified = true;
    console.log(`[patch-smartcube] Patched probeMoyu32Mac threshold in ${path.relative(rootDir, file)}`);
    totalPatches++;
  }

  // 10. Expand MoYu32 MAC candidates to also cover '03', '04' and generic WCU_ names
  const moyuCandPattern = /for\s*\(\s*const\s+mid\s+of\s+\['00',\s*'01',\s*'02'\](?:\s*as\s*const)?\s*\)/g;
  const moyuCandReplacement = "for (const mid of ['00', '01', '02', '03', '04'])";
  if (moyuCandPattern.test(content)) {
    content = content.replace(moyuCandPattern, moyuCandReplacement);
    modified = true;
    console.log(`[patch-smartcube] Patched MoYu32 candidate list in ${path.relative(rootDir, file)}`);
    totalPatches++;
  }

  // 11. GAN Timer disconnectAction: emit DISCONNECT synchronously before stopNotifications (which can throw/hang when GATT is already disconnected) and expose device
  const ganTimerDiscPattern = /var\s+disconnectAction\s*=\s*async\s*\(\)\s*=>\s*\{\s*device\.removeEventListener\(['"]gattserverdisconnected['"],\s*disconnectAction\);\s*stateCharacteristic\.removeEventListener\(['"]characteristicvaluechanged['"],\s*onStateChanged\);\s*await\s+stateCharacteristic\.stopNotifications\(\)\.catch\(\(\)\s*=>\s*\{\s*\}\);\s*eventSubject\.next\(\{\s*state:\s*GanTimerState\.DISCONNECT\s*\}\);\s*eventSubject\.complete\(\);\s*if\s*\(server\.connected\)\s*\{\s*server\.disconnect\(\);\s*\}\s*\};\s*device\.addEventListener\(['"]gattserverdisconnected['"],\s*disconnectAction\);\s*return\s*\{\s*events\$:\s*eventSubject,\s*getRecordedTimes:\s*getRecordedTimesAction,\s*disconnect:\s*disconnectAction,?\s*\};/;
  const ganTimerDiscReplacement = `var disconnectedOnce = false;
    var disconnectAction = async () => {
        if (disconnectedOnce) return;
        disconnectedOnce = true;
        device.removeEventListener('gattserverdisconnected', disconnectAction);
        stateCharacteristic.removeEventListener('characteristicvaluechanged', onStateChanged);
        if (!eventSubject.closed) {
            eventSubject.next({ state: GanTimerState.DISCONNECT });
            eventSubject.complete();
        }
        try {
            if (server && server.connected) {
                await stateCharacteristic.stopNotifications().catch(() => { });
                server.disconnect();
            }
        } catch {}
    };
    device.addEventListener('gattserverdisconnected', disconnectAction);
    return {
        device: device,
        server: server,
        events$: eventSubject,
        getRecordedTimes: getRecordedTimesAction,
        disconnect: disconnectAction,
    };`;
  if (ganTimerDiscPattern.test(content)) {
    content = content.replace(ganTimerDiscPattern, ganTimerDiscReplacement);
    modified = true;
    console.log(`[patch-smartcube] Patched connectGanTimer synchronous DISCONNECT emission in ${path.relative(rootDir, file)}`);
    totalPatches++;
  }

  // 12. GanCubeClassicConnection onDisconnect: emit DISCONNECT synchronously before stopNotifications
  const ganCubeDiscPattern = /this\.onDisconnect\s*=\s*async\s*\(\)\s*=>\s*\{\s*if\s*\(this\.disconnectOnce\)\s*return;\s*this\.disconnectOnce\s*=\s*true;\s*this\.device\.removeEventListener\(['"]gattserverdisconnected['"],\s*this\.onDisconnect\);\s*this\.stateCharacteristic\.removeEventListener\(['"]characteristicvaluechanged['"],\s*this\.onStateUpdate\);\s*await\s+this\.stateCharacteristic\.stopNotifications\(\)\.catch\(\(\)\s*=>\s*\{\s*\}\);\s*if\s*\(!this\.events\$\.closed\)\s*\{\s*this\.events\$\.next\(\{\s*timestamp:\s*now\(\),\s*type:\s*["']DISCONNECT["']\s*\}\);\s*this\.events\$\.complete\(\);\s*\}\s*\};/;
  const ganCubeDiscReplacement = `this.onDisconnect = async () => {
            if (this.disconnectOnce)
                return;
            this.disconnectOnce = true;
            this.device.removeEventListener('gattserverdisconnected', this.onDisconnect);
            this.stateCharacteristic.removeEventListener('characteristicvaluechanged', this.onStateUpdate);
            if (!this.events$.closed) {
                this.events$.next({ timestamp: now(), type: "DISCONNECT" });
                this.events$.complete();
            }
            try {
                if (this.device?.gatt?.connected) {
                    await this.stateCharacteristic.stopNotifications().catch(() => { });
                }
            } catch {}
        };`;
  if (ganCubeDiscPattern.test(content)) {
    content = content.replace(ganCubeDiscPattern, ganCubeDiscReplacement);
    modified = true;
    console.log(`[patch-smartcube] Patched GanCubeClassicConnection synchronous DISCONNECT emission in ${path.relative(rootDir, file)}`);
    totalPatches++;
  }

  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
  }
}

console.log(`[patch-smartcube] Done. Applied ${totalPatches} patches across files.`);
