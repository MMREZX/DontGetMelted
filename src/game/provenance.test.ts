import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, sep } from 'node:path';
import test from 'node:test';

test('every shipped field asset declares its origin, terms, and asset-level verification', () => {
  const assets = JSON.parse(readFileSync('public/assets/PROVENANCE.json', 'utf8'));
  assert.equal(assets.schemaVersion, 1);
  const entries = new Map<string, Record<string, unknown>>();
  const ids = new Set<string>();
  for (const record of assets.assets) {
    assert.ok(record.filePath.startsWith('public/assets/') || record.filePath.startsWith('src/'));
    assert.ok(!record.filePath.includes('..'));
    if (!record.filePath.endsWith('.ts')) assert.ok(!entries.has(record.filePath), `Duplicate asset ${record.filePath}`);
    assert.ok(!ids.has(record.assetId), `Duplicate asset ID ${record.assetId}`);
    ids.add(record.assetId);
    assert.ok(['procedural-code', 'original-human', 'ai-generated', 'cc0-third-party'].includes(record.originType));
    assert.ok(['Original-Project-Owned', 'CC0-1.0', 'MIT'].includes(record.license));
    assert.ok(record.assetId && record.toolOrAuthor && record.promptHashOrSourceUrl);
    assert.equal(record.commercialRightsVerified, true, record.filePath);
    assert.equal(record.wcagChecked, true, record.filePath);
    assert.ok(statSync(record.filePath).isFile(), record.filePath);
    entries.set(record.filePath, record);
  }
  for (const file of readdirSync('public/assets', { recursive: true, encoding: 'utf8' })) {
    const path = file.split(sep).join('/');
    if (path.startsWith('aistudio/') || !['.png', '.webp', '.jpg', '.svg', '.ogg', '.wav', '.m4a'].includes(extname(path))) continue;
    assert.ok(entries.has(`public/assets/${path}`), `Missing provenance for ${path}`);
  }
  assert.ok(entries.has('src/assets/unmelted-county-cover.jpg'));
  assert.ok(statSync('public/assets/env/ground_washes_atlas.webp').size <= 120_000);
});
