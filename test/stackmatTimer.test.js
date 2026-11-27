import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  STACKMAT_CMD_STATES,
  parseStackmatPacket,
  StackmatBitDecoder,
  StackmatTimerManager
} from '../src/stackmatTimer.js';
import { AppStore } from '../src/state/appStore.js';
import { createStackmatTimerController } from '../src/features/bluetooth/stackmatTimerController.js';

function makePacketBytes(cmd, digitsStr) {
  const digits = digitsStr.split('').map(Number);
  const sum = digits.reduce((a, b) => a + b, 0);
  const checksum = (64 + sum) & 0xFF;
  return [
    cmd.charCodeAt(0),
    ...digits.map(d => 0x30 + d),
    checksum,
    0x0A,
    0x0D
  ];
}

function encodePacketBits(byteArr) {
  const bits = [];
  for (const b of byteArr) {
    bits.push(0); // start bit
    for (let i = 0; i < 8; i++) {
      bits.push((b >> i) & 1);
    }
    bits.push(1); // stop bit
    bits.push(1); // realistic 1-bit inter-byte idle high margin
  }
  return bits;
}

function synthesizeStackmatPcm(packetSpecs, {
  sampleRate = 48000,
  inverted = false,
  amplitude = 0.8,
  acDecayTcMs = 0,
  leadIdleSamples = 600,
  gapIdleSamples = 1200
} = {}) {
  const bitLen = sampleRate / 1200;
  const levels = [];

  for (let i = 0; i < leadIdleSamples; i++) levels.push(1);
  for (const spec of packetSpecs) {
    const bytes = makePacketBytes(spec.cmd, spec.digits);
    const bits = encodePacketBits(bytes);
    const totalPacketSamples = Math.round(bits.length * bitLen);
    for (let s = 0; s < totalPacketSamples; s++) {
      const bitIdx = Math.min(bits.length - 1, Math.floor(s / bitLen));
      levels.push(bits[bitIdx]);
    }
    for (let i = 0; i < gapIdleSamples; i++) levels.push(1);
  }

  const out = new Float32Array(levels.length);
  const sign = inverted ? -1 : 1;

  // Optional 1st-order RC high-pass filter simulating MacBook / USB audio interface AC coupling.
  const rcAlpha = acDecayTcMs > 0
    ? (acDecayTcMs * 0.001) / ((acDecayTcMs * 0.001) + (1 / sampleRate))
    : 0;
  let prevRaw = levels.length ? (levels[0] ? amplitude : -amplitude) * sign : 0;
  let prevHp = 0;

  for (let i = 0; i < levels.length; i++) {
    const raw = (levels[i] ? amplitude : -amplitude) * sign;
    if (rcAlpha > 0) {
      const hp = rcAlpha * (prevHp + raw - prevRaw);
      prevRaw = raw;
      prevHp = hp;
      out[i] = hp;
    } else {
      out[i] = raw;
    }
  }
  return out;
}

test('parseStackmatPacket decodes valid G4/G5 and G3 frames and rejects bad frames', () => {
  const g5 = parseStackmatPacket(makePacketBytes('S', '012345'));
  assert.ok(g5);
  assert.equal(g5.cmd, 'S');
  assert.equal(g5.timerState, 'STOPPED');
  assert.equal(g5.timeMs, 12345);
  assert.equal(g5.generation, 'G4/G5');

  const g5Ready = parseStackmatPacket(makePacketBytes('A', '000000'));
  assert.equal(g5Ready.timerState, 'GET_SET');
  assert.equal(g5Ready.timeMs, 0);

  for (const [cmd, expected] of Object.entries(STACKMAT_CMD_STATES)) {
    const parsed = parseStackmatPacket(makePacketBytes(cmd, '005120'));
    assert.equal(parsed?.timerState, expected);
  }

  const g3 = parseStackmatPacket(makePacketBytes('S', '10489'));
  assert.ok(g3);
  assert.equal(g3.generation, 'G3');
  assert.equal(g3.timeMs, 64890);

  const badChecksum = makePacketBytes('S', '012345');
  badChecksum[7] ^= 1;
  assert.equal(parseStackmatPacket(badChecksum), null);

  const badFooter = makePacketBytes('S', '012345');
  badFooter[9] = 0x00;
  assert.equal(parseStackmatPacket(badFooter), null);

  const badCmd = makePacketBytes('X', '012345');
  assert.equal(parseStackmatPacket(badCmd), null);

  assert.equal(parseStackmatPacket([1, 2, 3]), null);
});

test('StackmatBitDecoder decodes G5 & G3 at 48kHz, 44.1kHz, inverted polarity, and AC droop', () => {
  const samples48 = synthesizeStackmatPcm([
    { cmd: 'I', digits: '000000' },
    { cmd: 'S', digits: '008432' }
  ], { sampleRate: 48000 });
  const dec48 = new StackmatBitDecoder(48000);
  const pkts48 = dec48.processSamples(samples48);
  assert.equal(pkts48.length, 2);
  assert.equal(pkts48[0].timerState, 'IDLE');
  assert.equal(pkts48[1].timerState, 'STOPPED');
  assert.equal(pkts48[1].timeMs, 8432);

  // 44.1 kHz fractional bit period + inverted ADC + AC-coupling droop
  const samples44 = synthesizeStackmatPcm([
    { cmd: 'C', digits: '000000' },
    { cmd: 'A', digits: '000000' },
    { cmd: ' ', digits: '001250' },
    { cmd: 'S', digits: '007914' }
  ], { sampleRate: 44100, inverted: true, amplitude: 0.65, acDecayTcMs: 18 });
  const dec44 = new StackmatBitDecoder(44100);
  const pkts44 = dec44.processSamples(samples44);
  assert.deepEqual(
    pkts44.map(p => [p.timerState, p.timeMs]),
    [['HANDS_ON', 0], ['GET_SET', 0], ['RUNNING', 1250], ['STOPPED', 7914]]
  );
  const stats = dec44.getSignalStats();
  assert.equal(stats.packetsDecoded, 4);
  assert.equal(stats.generation, 'G4/G5');
  assert.ok(stats.peak > 0.1);

  // Gen 3 5-digit packet streamed across small audio chunks
  const g3Pcm = synthesizeStackmatPcm([{ cmd: 'S', digits: '01572' }], { sampleRate: 48000 });
  const decChunked = new StackmatBitDecoder(48000);
  const allChunked = [];
  for (let i = 0; i < g3Pcm.length; i += 256) {
    allChunked.push(...decChunked.processSamples(g3Pcm.subarray(i, i + 256)));
  }
  assert.equal(allChunked.length, 1);
  assert.equal(allChunked[0].generation, 'G3');
  assert.equal(allChunked[0].timeMs, 15720);
});

test('StackmatTimerManager emits solve lifecycle transitions and supports connect/disconnect', async () => {
  const manager = new StackmatTimerManager();
  const events = [];
  manager.addEventListener('timerstate', (e) => events.push(e.detail));

  const pcm = synthesizeStackmatPcm([
    { cmd: 'I', digits: '000000' },
    { cmd: 'C', digits: '000000' },
    { cmd: 'C', digits: '000000' }, // duplicate state should not double-emit
    { cmd: 'A', digits: '000000' },
    { cmd: ' ', digits: '002400' },
    { cmd: ' ', digits: '004100' },
    { cmd: 'S', digits: '006543' },
    { cmd: 'S', digits: '006543' }
  ], { sampleRate: 48000 });

  for (let i = 0; i < pcm.length; i += 512) {
    manager.processPcmSamples(pcm.subarray(i, i + 512), 1000 + i, { sampleRate: 48000 });
  }

  assert.deepEqual(
    events.map(e => [e.state, e.recordedMs]),
    [
      ['IDLE', null],
      ['HANDS_ON', null],
      ['GET_SET', null],
      ['RUNNING', null],
      ['STOPPED', 6543]
    ]
  );

  // Mock Web Audio capture lifecycle + unexpected cable unplug
  const trackListeners = {};
  let stoppedTrack = false;
  let closedCtx = false;
  const mockNav = {
    mediaDevices: {
      async enumerateDevices() {
        return [{ kind: 'audioinput', deviceId: 'usb-line', label: 'USB Audio Line-In' }];
      },
      async getUserMedia() {
        return {
          getAudioTracks() {
            return [{
              label: 'USB Audio Line-In',
              getSettings: () => ({ deviceId: 'usb-line' }),
              addEventListener: (name, fn) => { trackListeners[name] = fn; },
              stop: () => { stoppedTrack = true; }
            }];
          },
          getTracks() {
            return [{ stop: () => { stoppedTrack = true; } }];
          }
        };
      }
    }
  };
  const mockCtx = {
    sampleRate: 48000,
    state: 'running',
    destination: {},
    createMediaStreamSource: () => ({ connect() {}, disconnect() {} }),
    createScriptProcessor: () => ({ connect() {}, disconnect() {}, onaudioprocess: null }),
    createGain: () => ({ gain: { value: 1 }, connect() {}, disconnect() {} }),
    close: async () => { closedCtx = true; }
  };

  const audioMgr = new StackmatTimerManager({
    navigatorObj: mockNav,
    audioContextFactory: () => mockCtx
  });
  assert.equal(audioMgr.isAudioSupported(), true);
  const inputs = await audioMgr.listAudioInputs();
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].deviceId, 'usb-line');

  const disconnectReasons = [];
  audioMgr.addEventListener('disconnected', (e) => disconnectReasons.push(e.detail.reason));

  const status = await audioMgr.connect({ deviceId: 'usb-line' });
  assert.equal(status.connected, true);
  assert.equal(audioMgr.isConnected(), true);
  assert.match(status.deviceName, /USB Audio Line-In/);

  // Simulate cable unplugged
  trackListeners.ended?.();
  assert.equal(audioMgr.isConnected(), false);
  assert.equal(stoppedTrack, true);
  assert.equal(closedCtx, true);
  assert.deepEqual(disconnectReasons, ['unexpected']);
});

test('Stackmat G5 UI markup and controller stay hidden and inactive unless Beta Features enabled', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="stackmatBetaSection"[^>]*hidden/);
  assert.match(html, /Stackmat G5 Audio Timer/);
  assert.match(html, /id="stackmatGuideBtn"/);
  assert.match(html, /id="stackmatGuideModal"[^>]*hidden/);
  assert.match(html, /Signal locked/);
  assert.match(html, /Voice Isolation/);
  assert.match(html, /2\.5mm/);

  const store = new AppStore();
  assert.equal(store.state.betaFeatures, false);
  const ctrl = createStackmatTimerController({ appStore: store });
  assert.equal(typeof ctrl.syncBetaVisibility, 'function');
  ctrl.syncBetaVisibility();
});
