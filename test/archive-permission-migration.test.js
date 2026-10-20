import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from '../src/crew.js';
import { validateState } from '../src/state.js';

test('older archived teammates acquire permission defaults and the saved project reopens', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-archive-permissions-'));
  const crew = new Crew(folder);
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const members = structuredClone(crew.state.members);
  for (const member of members) delete member.codexPermissions;
  crew.state.archives.push({ id: 'abc12345', kind: 'new', reason: 'Fresh conversations', members });
  const legacy = structuredClone(crew.state);
  const expectedMessages = JSON.stringify(legacy.archives[0].members.map(member => member.messages));
  assert.doesNotThrow(() => validateState(legacy));
  assert.ok(legacy.archives[0].members.every(member => member.codexPermissions === 'approve'));
  assert.equal(JSON.stringify(legacy.archives[0].members.map(member => member.messages)), expectedMessages);
  writeFileSync(crew.file, JSON.stringify(crew.state));
  const restored = new Crew(folder);
  try {
    assert.equal(restored.state.archives.length, 1);
  } finally {
    await restored.close();
  }
});

test('archive migration preserves explicit modes and rejects invalid ones', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-archive-modes-'));
  const crew = new Crew(folder);
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const members = structuredClone(crew.state.members);
  members[0].codexPermissions = 'read-only';
  crew.state.archives.push({ id: 'abc12345', kind: 'new', reason: 'Snapshot', members });
  validateState(crew.state);
  assert.equal(members[0].codexPermissions, 'read-only');
  const invalid = structuredClone(crew.state);
  invalid.archives[0].members[0].codexPermissions = 'unknown';
  assert.throws(() => validateState(invalid), /Invalid crew state/);
});
