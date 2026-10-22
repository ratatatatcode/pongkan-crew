import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from './helpers/legacy-crew.js';
import { execute } from '../src/commands.js';

function setup(t) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-coordinators-'));
  const crew = new Crew(folder, {
    runner: async (args, prompt, event) => {
      const text = prompt.includes('PONGKAN_PLAN')
        ? JSON.stringify({ steps: [{ member: 'researcher', task: 'Inspect' }], reviewer: 'auditor' })
        : 'Verified';
      event({ type: 'item.completed', item: { type: 'agent_message', text } });
    },
  });
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  return { crew, selected: 'chief' };
}
test('default coordinator renames persist and workflows use the renamed lead and reviewer', async t => {
  const app = setup(t);
  execute(app, '/crew rename chief boss');
  execute(app, '/crew rename reviewer auditor');
  assert.equal(app.crew.leadName, 'boss');
  assert.equal(app.crew.reviewerName, 'auditor');
  assert.equal(new Crew(app.crew.folder).leadName, 'boss');
  const flow = app.crew.workflows.start('Inspect');
  await app.crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.equal(flow.plan.reviewer, 'auditor');
});
test('default coordinators cannot be removed and reviewer cannot gain writer access through either command', t => {
  const app = setup(t);
  const original = readFileSync(app.crew.file, 'utf8');
  for (const command of [
    '/crew remove chief',
    '/crew remove reviewer',
    '/crew access reviewer write',
    '/crew role reviewer --role fullstack-dev',
  ]) {
    assert.throws(() => execute(app, command), /designated|read-only/);
    assert.equal(readFileSync(app.crew.file, 'utf8'), original);
  }
});
test('invalid remove arguments preserve teammate, archives and saved state', t => {
  const app = setup(t);
  const original = readFileSync(app.crew.file, 'utf8');
  assert.throws(() => execute(app, '/crew remove researcher unexpected'), /Use \/crew remove NAME/);
  assert.equal(readFileSync(app.crew.file, 'utf8'), original);
  assert.ok(app.crew.member('researcher'));
  assert.equal(app.crew.state.archives.length, 0);
});
test('intact legacy default crews acquire explicit coordination without losing messages or widening permissions', t => {
  const app = setup(t);
  const state = structuredClone(app.crew.state);
  delete state.coordination;
  state.members.find(m => m.name === 'reviewer').writable = true;
  state.members[0].messages.push({ role: 'user', text: 'Keep this history' });
  writeFileSync(app.crew.file, JSON.stringify(state));
  const restored = new Crew(app.crew.folder);
  assert.deepEqual(restored.state.coordination, { lead: 'chief', reviewer: 'reviewer' });
  assert.equal(restored.member('reviewer').writable, false);
  assert.equal(restored.member('chief').messages[0].text, 'Keep this history');
});

test('legacy default preset archives retain coordinator protection through restore and undo', t => {
  const app = setup(t);
  const legacyMembers = structuredClone(app.crew.state.members);
  legacyMembers.find(m => m.name === 'reviewer').writable = true;
  for (const action of ['restore', 'undo']) {
    const id = action === 'restore' ? '11111111' : '22222222';
    app.crew.state.archives.push({
      id,
      at: new Date().toISOString(),
      reason: 'preset legacy',
      kind: 'preset',
      members: structuredClone(legacyMembers),
      coordination: null,
    });
    if (action === 'restore') app.crew.presets.restore(id);
    else app.crew.undo();
    assert.deepEqual(app.crew.state.coordination, { lead: 'chief', reviewer: 'reviewer' });
    assert.equal(app.crew.member('reviewer').writable, false);
    assert.equal(new Crew(app.crew.folder).member('reviewer').writable, false);
  }
});

test('customized legacy names are preserved and can be recovered using an explicit saved preset', t => {
  const app = setup(t);
  const state = structuredClone(app.crew.state);
  delete state.coordination;
  state.members.find(m => m.name === 'chief').name = 'boss';
  state.members.find(m => m.name === 'reviewer').name = 'auditor';
  state.members[0].messages.push({ role: 'user', text: 'Keep the old conversation' });
  writeFileSync(app.crew.file, JSON.stringify(state));
  const restored = new Crew(app.crew.folder);
  assert.equal(restored.state.coordination, undefined);
  assert.ok(restored.member('boss'));
  restored.presets.save('recovered-team', 'boss', 'auditor');
  restored.presets.apply('recovered-team');
  assert.equal(restored.leadName, 'boss');
  assert.equal(restored.reviewerName, 'auditor');
  assert.equal(restored.state.archives.at(-1).members[0].messages[0].text, 'Keep the old conversation');
});
