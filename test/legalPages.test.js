import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

test('Google OAuth consent screen logo exists as a valid 120x120 square PNG under 1MB', () => {
  const logoPath = path.join(ROOT, 'public/oauth-logo-120x120.png');
  assert.ok(fs.existsSync(logoPath), 'public/oauth-logo-120x120.png must exist');
  const buf = fs.readFileSync(logoPath);
  assert.ok(buf.length > 0 && buf.length < 1024 * 1024, 'OAuth logo must be < 1MB');
  // PNG magic header + IHDR width/height at bytes 16..24
  assert.deepStrictEqual(
    buf.subarray(0, 8),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    'Must be a valid PNG file'
  );
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  assert.strictEqual(width, 120, 'OAuth logo width must be 120px');
  assert.strictEqual(height, 120, 'OAuth logo height must be 120px');
});

test('Privacy Policy page exists at public/privacy/index.html with accurate disclosures', () => {
  const html = readText('public/privacy/index.html');
  assert.match(html, /<h1>\s*Privacy Policy\s*<\/h1>/);
  assert.match(html, /cubing\.cc/);
  assert.match(html, /https:\/\/www\.googleapis\.com\/auth\/drive\.appdata/);
  assert.match(html, /speedcube-trainer-sync\.json/);
  assert.match(html, /Google API Services User Data Policy/);
  assert.match(html, /Limited Use/);
  assert.match(html, /do <strong>not<\/strong> sell/i);
  assert.match(html, /do not sell, rent, lease, or trade any user data/i);
  assert.match(html, /third-party analytics scripts, or cross-site tracking cookies/i);
  assert.match(html, /href="\/terms"/);
  assert.match(html, /href="\/"/);
});

test('Terms of Service page exists at public/terms/index.html with free-use and as-is terms', () => {
  const html = readText('public/terms/index.html');
  assert.match(html, /<h1>\s*Terms of Service\s*<\/h1>/);
  assert.match(html, /cubing\.cc/);
  assert.match(html, /free, non-commercial/i);
  assert.match(html, /"as is"/i);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/"/);
});

test('index.html links Privacy Policy and Terms of Service in homepage footer and Cloud Sync modal', () => {
  const indexHtml = readText('index.html');

  const footerMatch = indexHtml.match(/<footer class="app-legal-footer"[\s\S]*?<\/footer>/);
  assert.ok(footerMatch, 'index.html must include .app-legal-footer');
  assert.match(footerMatch[0], /href="\/privacy"/);
  assert.match(footerMatch[0], /href="\/terms"/);

  const cloudSyncStart = indexHtml.indexOf('id="cloudSyncModal"');
  const cloudSyncEnd = indexHtml.indexOf('<!-- Google Drive', cloudSyncStart + 1);
  assert.ok(cloudSyncStart !== -1, 'index.html must include #cloudSyncModal');
  const cloudSyncSlice = indexHtml.slice(cloudSyncStart, cloudSyncEnd > cloudSyncStart ? cloudSyncEnd : cloudSyncStart + 4500);
  assert.match(cloudSyncSlice, /href="\/privacy"/);
  assert.match(cloudSyncSlice, /href="\/terms"/);
});

test('vite.config.js excludes /privacy and /terms from PWA navigateFallback', () => {
  const viteConfig = readText('vite.config.js');
  assert.match(viteConfig, /navigateFallbackDenylist\s*:\s*\[[^\]]*\\\/privacy[^\]]*\\\/terms/);
});
