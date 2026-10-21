import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from '../src/crew.js';
import { execute } from '../src/commands.js';
import { validateState } from '../src/state.js';
import { screen } from '../src/ui.js';
import { cellWidth } from '../src/markdown.js';
import { completions } from '../src/controls.js';

function setup(t, runner = async () => {}) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-presets-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  return new Crew(folder, { runner });
}

test('clipper is discoverable and applies a persistent video crew with independent review', t => {
  const crew = setup(t);
  const app = { crew, selected: 'chief', panel: null };
  assert.ok(completions('/preset apply cli', []).includes('/preset apply clipper'));
  execute(app, '/preset show clipper');
  assert.match(app.panel.lines.join('\n'), /video-editor/);
  execute(app, '/preset apply clipper');
  assert.equal(app.selected, 'video-producer');
  assert.equal(crew.reviewerName, 'video-reviewer');
  for (const name of ['video-editor', 'captioner', 'copywriter']) {
    assert.equal(crew.member(name).writable, true);
  }
  assert.equal(crew.member('footage-analyst').writable, false);
  assert.equal(crew.member('video-reviewer').writable, false);
  validateState(crew.state);
  const restored = new Crew(crew.folder);
  assert.equal(restored.state.activePreset, 'clipper');
  assert.equal(restored.leadName, 'video-producer');
  crew.undo();
  assert.equal(crew.leadName, 'chief');
});
test('presets preview, apply, persist and undo without losing the old conversations', t => {
  const crew = setup(t);
  crew.member('researcher').messages.push({ role: 'user', text: 'Saved question' });
  const app = { crew, selected: 'researcher', panel: null };
  execute(app, '/preset show web');
  assert.match(app.panel.lines.join('\n'), /frontend-dev/);
  assert.equal(crew.state.members[0].name, 'chief');
  execute(app, '/preset apply web');
  assert.equal(app.selected, 'project-lead');
  assert.equal(crew.member('frontend-dev').writable, true);
  assert.equal(crew.member('qa-reviewer').writable, false);
  assert.equal(new Crew(crew.folder).leadName, 'project-lead');
  crew.undo();
  assert.equal(crew.member('researcher').messages[0].text, 'Saved question');
  assert.equal(crew.leadName, 'chief');
});
test('preset changes reject queued work and custom presets preserve instructions with fresh sessions', t => {
  const crew = setup(t);
  crew.queue.pause();
  const task = crew.queue.enqueue('developer', 'Waiting work');
  assert.throws(() => crew.presets.apply('mobile'), /queued/);
  crew.queue.cancel(task.id);
  crew.member('developer').threadId = 'old-thread';
  crew.presets.save('my-team', 'chief', 'reviewer');
  crew.presets.apply('social');
  crew.presets.apply('my-team');
  assert.equal(crew.member('developer').threadId, null);
  assert.equal(crew.member('developer').writable, true);
  assert.throws(() => crew.presets.save('web', 'chief', 'reviewer'), /built-in/);
});
test('preset workflows use their lead and reviewer and group chat ends with the lead', async t => {
  const speakers = [];
  const crew = setup(t, async (args, prompt, event) => {
    speakers.push(prompt.match(/^You are ([^,]+)/)[1]);
    const text = prompt.includes('PONGKAN_PLAN')
      ? JSON.stringify({ steps: [{ member: 'frontend-dev', task: 'Inspect layout' }], reviewer: 'qa-reviewer' })
      : 'Done';
    event({ type: 'item.completed', item: { type: 'agent_message', text } });
  });
  crew.presets.apply('web');
  const app = { crew, selected: 'frontend-dev' };
  execute(app, '/task Inspect layout');
  const flow = crew.state.workflows.at(-1);
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.deepEqual(speakers, ['project-lead', 'frontend-dev', 'qa-reviewer', 'project-lead']);
  const discussion = crew.discussions.start('Discuss layout');
  await crew.queue.settled(discussion.taskIds.at(-1));
  assert.equal(discussion.messages.at(-1).speaker, 'project-lead');
});
test('all presets have valid coordination; archived crews and coordinator renames survive restart', t => {
  const crew = setup(t);
  for (const name of ['web', 'mobile', 'social', 'content', 'default']) {
    crew.presets.apply(name);
    validateState(crew.state);
    assert.equal(crew.member(crew.reviewerName).writable, false);
  }
  crew.presets.apply('web');
  const app = { crew, selected: 'project-lead' };
  execute(app, '/crew rename project-lead lead');
  assert.equal(new Crew(crew.folder).leadName, 'lead');
  assert.throws(() => execute(app, '/crew remove lead'), /designated/);
  assert.throws(() => execute(app, '/crew access qa-reviewer write'), /read-only/);
  crew.member('frontend-dev').messages.push({ role: 'assistant', text: 'Keep this result' });
  crew.presets.apply('social');
  const archive = crew.state.archives.at(-1);
  crew.presets.restore(archive.id);
  assert.equal(crew.leadName, 'lead');
  assert.equal(crew.member('frontend-dev').messages[0].text, 'Keep this result');
  const invalid = structuredClone(crew.state);
  invalid.coordination.reviewer = 'frontend-dev';
  assert.throws(() => validateState(invalid), /Invalid crew state/);
});
test('preset list separates teams and permissions with colored headings and readable wrapping', t => {
  const crew = setup(t);
  const app = { crew, selected: 'chief', panel: null };
  execute(app, '/preset list');
  for (const columns of [55, 100, 140]) {
    app.panel.offset = 0;
    const plain = screen(crew, 'chief', '', '', columns, 90, 0, app.panel);
    assert.match(plain, /WEB.*Fullstack web/);
    assert.match(plain, /Can edit:/);
    assert.match(plain, /Read-only:/);
    assert.ok(plain.split('\n').every(line => cellWidth(line) <= columns - 1));
    const colored = screen(crew, 'chief', '', '', columns, 90, 0, app.panel, { color: true });
    assert.match(colored, /\x1b\[1;37m[^\n]*WEB/);
  }
});
