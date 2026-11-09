import test from 'node:test';
import assert from 'node:assert';
import { SmartCubeManager, getSolvedPatterns, formatMacAddress, checkFaceletsSolved } from '../src/smartCube.js';

test('getSolvedPatterns generates all 24 orientations for 3x3 and 2x2', async () => {
  const p3 = await getSolvedPatterns('333');
  assert.ok(p3, '3x3 info should exist');
  assert.strictEqual(p3.patterns.length, 24, '3x3 should have exactly 24 rotational orientations');

  const p2 = await getSolvedPatterns('222');
  assert.ok(p2, '2x2 info should exist');
  assert.strictEqual(p2.patterns.length, 24, '2x2 should have exactly 24 rotational orientations');
});

test('SmartCubeManager initial state and status', () => {
  const sc = new SmartCubeManager();
  const st = sc.getStatus();
  assert.strictEqual(st.status, 'disconnected');
  assert.strictEqual(st.connected, false);
  assert.strictEqual(st.deviceName, '');
});

test('SmartCubeManager tracks scramble and detects solved state', async () => {
  const sc = new SmartCubeManager();
  // Set simple scramble: R U R' U'
  await sc.setScramble("R U R' U'", "333");
  assert.strictEqual(sc.isCurrentPatternSolved(), false, 'Scrambled state should not be solved');

  // Apply inverse moves to solve the cube: U R U' R'
  const res1 = sc.handleMove("U", 100);
  assert.strictEqual(res1.isSolved, false);

  const res2 = sc.handleMove("R", 200);
  assert.strictEqual(res2.isSolved, false);

  const res3 = sc.handleMove("U'", 300);
  assert.strictEqual(res3.isSolved, false);

  const res4 = sc.handleMove("R'", 400);
  assert.strictEqual(res4.isSolved, true, 'Cube should be solved after completing inverse moves');
  assert.strictEqual(sc.isCurrentPatternSolved(), true);
});

test('SmartCubeManager recognizes solved state across whole cube rotations (y, x2, z)', async () => {
  const sc = new SmartCubeManager();
  await sc.setScramble("R", "333");
  assert.strictEqual(sc.isCurrentPatternSolved(), false);

  // Undo R
  sc.handleMove("R'", 100);
  assert.strictEqual(sc.isCurrentPatternSolved(), true);

  // Now rotate the whole cube (y)
  sc.handleMove("y", 200);
  assert.strictEqual(sc.isCurrentPatternSolved(), true, 'Cube in y rotation is still solved');

  // Rotate x2
  sc.handleMove("x2", 300);
  assert.strictEqual(sc.isCurrentPatternSolved(), true, 'Cube in x2 rotation is still solved');
});

test('SmartCubeManager event listeners for move and statuschange', async () => {
  const sc = new SmartCubeManager();
  let moveEventCount = 0;
  let lastMove = null;

  sc.addEventListener("move", (e) => {
    moveEventCount++;
    lastMove = e.detail.move;
  });

  sc.handleMove("F", 50);
  sc.handleMove("R", 100);

  assert.strictEqual(moveEventCount, 2);
  assert.strictEqual(lastMove, "R");
  assert.strictEqual(sc.getStatus().recentMoves.length, 2);
});

test('SmartCubeManager handles multi-vendor connection events (MoYu V10 AI & GAN i Carry 4)', async () => {
  const sc = new SmartCubeManager();
  
  // Simulate connection object from smartcube-web-bluetooth for MoYu WeiLong V10 AI
  const mockEvents = [];
  const subscribers = [];
  const mockConn = {
    deviceName: "WCU_MY32_A6A7",
    protocol: { id: "moyu-my32", name: "MoYu MY32" },
    capabilities: { battery: true, facelets: true, gyroscope: true, hardware: true, reset: false },
    events$: {
      subscribe(cb) {
        subscribers.push(cb);
        return { unsubscribe: () => { const i = subscribers.indexOf(cb); if (i >= 0) subscribers.splice(i, 1); } };
      }
    },
    sendCommand: async (cmd) => {
      mockEvents.push(cmd);
    },
    disconnect: async () => {}
  };

  sc.smartCubeConn = mockConn;
  sc.deviceName = mockConn.deviceName;
  sc.status = "connected";

  // Wire up subscriber
  sc.connSubscription = mockConn.events$.subscribe((event) => {
    if (event.type === "MOVE") {
      sc.handleMove(event.move, event.timestamp || 1000);
    } else if (event.type === "BATTERY") {
      sc.battery = event.batteryLevel;
      sc._emitStatusChange();
    } else if (event.type === "GYRO") {
      sc.dispatchEvent(new CustomEvent("orientation", { detail: { quaternion: event.quaternion } }));
    } else if (event.type === "DISCONNECT") {
      sc._onDisconnect();
    }
  });

  assert.strictEqual(sc.getStatus().connected, true);
  assert.strictEqual(sc.getStatus().deviceName, "WCU_MY32_A6A7");

  // Dispatch MoYu turns
  subscribers.forEach(cb => cb({ type: "MOVE", move: "R", timestamp: 1200 }));
  subscribers.forEach(cb => cb({ type: "MOVE", move: "U", timestamp: 1500 }));
  assert.strictEqual(sc.getStatus().recentMoves.length, 2);
  assert.strictEqual(sc.getStatus().recentMoves[1].move, "U");

  // Dispatch Battery update
  subscribers.forEach(cb => cb({ type: "BATTERY", batteryLevel: 92 }));
  assert.strictEqual(sc.getStatus().battery, 92);

  // Dispatch Gyro orientation
  let receivedQuat = null;
  sc.addEventListener("orientation", (e) => {
    receivedQuat = e.detail.quaternion;
  });
  subscribers.forEach(cb => cb({ type: "GYRO", quaternion: { x: 0, y: 1, z: 0, w: 0 } }));
  assert.deepStrictEqual(receivedQuat, { x: 0, y: 1, z: 0, w: 0 });

  // Disconnect
  sc.disconnect();
  assert.strictEqual(sc.getStatus().connected, false);
  assert.strictEqual(subscribers.length, 0);
});

test('formatMacAddress standardizes various MAC formats into canonical XX:XX:XX:XX:XX:XX', () => {
  assert.strictEqual(formatMacAddress("d481ca125927"), "D4:81:CA:12:59:27");
  assert.strictEqual(formatMacAddress("d4:81:ca:12:59:27"), "D4:81:CA:12:59:27");
  assert.strictEqual(formatMacAddress("D4-81-CA-12-59-27"), "D4:81:CA:12:59:27");
  assert.strictEqual(formatMacAddress("  cf:30:16:00:a6:a7  "), "CF:30:16:00:A6:A7");
  assert.strictEqual(formatMacAddress("invalid"), null);
  assert.strictEqual(formatMacAddress(""), null);
  assert.strictEqual(formatMacAddress(null), null);
});

test('SmartCubeManager.hardReset() clears all cached connections, moves, and state', () => {
  const sc = new SmartCubeManager();
  sc.status = "connected";
  sc.deviceName = "GANic4_5927";
  sc.battery = 85;
  sc.manualMac = "D4:81:CA:12:59:27";
  sc.handleMove("R", 100);
  sc.handleMove("U", 200);

  let resetEventFired = false;
  let disconnectEventFired = false;
  sc.addEventListener("hardreset", () => { resetEventFired = true; });
  sc.addEventListener("disconnected", () => { disconnectEventFired = true; });

  const result = sc.hardReset();
  assert.strictEqual(result, true);
  assert.strictEqual(sc.status, "disconnected");
  assert.strictEqual(sc.deviceName, "");
  assert.strictEqual(sc.battery, null);
  assert.strictEqual(sc.manualMac, "");
  assert.strictEqual(sc.recentMoves.length, 0);
  assert.strictEqual(resetEventFired, true);
  assert.strictEqual(disconnectEventFired, true);
});

test('checkFaceletsSolved accurately recognizes solved state for 3x3 and 2x2', () => {
  const solved333 = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
  assert.strictEqual(checkFaceletsSolved(solved333), true);

  const scrambled333 = 'UFRUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
  assert.strictEqual(checkFaceletsSolved(scrambled333), false);

  const solved222 = 'UUUURRRRFFFFDDDDLLLLBBBB';
  assert.strictEqual(checkFaceletsSolved(solved222), true);

  const scrambled222 = 'UFRURRRRFFFFDDDDLLLLBBBB';
  assert.strictEqual(checkFaceletsSolved(scrambled222), false);

  assert.strictEqual(checkFaceletsSolved(null), false);
  assert.strictEqual(checkFaceletsSolved(''), false);
});

test('SmartCubeManager handles double flick rapid moves and detects hardware solved state', async () => {
  const sc = new SmartCubeManager();
  await sc.setScramble("U2", "333");

  let solvedFired = false;
  sc.addEventListener("solved", () => {
    solvedFired = true;
  });

  // Rapid double flick U then U (within 25ms)
  const d1 = sc.handleMove("U", 1000);
  assert.strictEqual(d1.isSolved, false);
  assert.strictEqual(sc.recentMoves.length, 1);

  const d2 = sc.handleMove("U", 1025);
  // After U2 (or U then U), U2 scramble is undone -> solved!
  assert.strictEqual(d2.isSolved, true);
  assert.strictEqual(sc.recentMoves.length, 2);
  assert.strictEqual(solvedFired, true);

  // Hardware facelets emission triggers solved event even if pattern was desynced
  let faceletsSolvedFired = false;
  sc.addEventListener("solved", () => {
    faceletsSolvedFired = true;
  });
  sc.handleFacelets('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
  assert.strictEqual(faceletsSolvedFired, true);
});

