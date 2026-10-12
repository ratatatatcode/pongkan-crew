import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Crew } from '../src/crew.js';
import { execute } from '../src/commands.js';
import { screen } from '../src/ui.js';
import { completions } from '../src/controls.js';
import { validateState } from '../src/state.js';

function setup(t) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-share-'));
  const prompts = [];
  const crew = new Crew(folder, {
    runner: async (args, prompt, event) => {
      prompts.push({ args, prompt });
      event({
        type: 'item.completed',
        item: {
          type: 'agent_message',
          text: prompt.includes('PONGKAN_PLAN')
            ? JSON.stringify({
                steps: [{ member: 'developer', task: 'Implement shared navigation' }],
                reviewer: 'reviewer',
              })
            : 'Shared review findings.',
        },
      });
    },
  });
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  crew
    .member('developer')
    .messages.push(
      { role: 'user', text: 'Older private subject' },
      { role: 'assistant', text: 'Older private answer' },
      { role: 'user', text: 'How should navigation work?' },
      { role: 'assistant', text: 'Use keyboard accessible orange links.' },
    );
  crew.member('chief').messages.push({ role: 'assistant', text: 'Unrelated chief secret' });
  const sent = [];
  return { crew, prompts, sent, selected: 'developer', view: 'chat', send: (name, text) => sent.push({ name, text }) };
}

test('explicit share creates a persistent read-only duo with only the selected latest exchange', async t => {
  const app = setup(t);
  const before = JSON.stringify(app.crew.member('developer').messages);
  execute(app, '/share reviewer Review keyboard support');
  const discussion = app.crew.discussions.current;
  assert.equal(app.view, 'group');
  assert.deepEqual(discussion.participants, ['developer', 'reviewer']);
  await app.crew.queue.settled(discussion.taskIds.at(-1));
  assert.ok(discussion.taskIds.every(id => app.crew.queue.get(id).readOnly));
  assert.deepEqual(
    [...new Set(discussion.taskIds.map(id => app.crew.queue.get(id).member))],
    ['developer', 'reviewer'],
  );
  for (const { prompt } of app.prompts) {
    assert.match(prompt, /How should navigation work\?/);
    assert.match(prompt, /keyboard accessible orange links/);
    assert.doesNotMatch(prompt, /Older private|Unrelated chief secret/);
  }
  assert.equal(JSON.stringify(app.crew.member('developer').messages), before);
  const output = screen(app.crew, app.selected, '', '', 140, 100, 0, null, { view: 'group' });
  assert.match(output, /Review keyboard support/);
  assert.match(output, /Shared review findings/);
  const restored = new Crew(app.crew.folder);
  assert.deepEqual(restored.discussions.current.participants, ['developer', 'reviewer']);
  await restored.close();
  execute(app, 'Check focus too');
  const followup = app.crew.discussions.current;
  await app.crew.queue.settled(followup.taskIds.at(-1));
  assert.deepEqual([...new Set(followup.taskIds.map(id => app.crew.queue.get(id).member))], ['developer', 'reviewer']);
});

test('only explicit sharing phrases route private context and named chats control the source', async t => {
  const app = setup(t);
  execute(app, 'Reviewer might help with this');
  assert.equal(app.sent.length, 1);
  assert.equal(app.crew.state.discussions.length, 0);
  execute(app, '/conversation new developer Current design');
  app.crew
    .chatMember('developer')
    .messages.push({ role: 'user', text: 'Named question' }, { role: 'assistant', text: 'Named findings' });
  execute(app, 'share this with Reviewer for review');
  const discussion = app.crew.discussions.current;
  await app.crew.queue.settled(discussion.taskIds.at(-1));
  assert.match(app.crew.discussions.history(), /Named findings/);
  assert.doesNotMatch(app.crew.discussions.history(), /orange links/);
  assert.deepEqual(completions('/share rev', ['developer', 'reviewer']), ['/share reviewer']);
});

test('invalid shares leave state unchanged', async t => {
  const app = setup(t);
  for (const command of ['/share missing', '/share developer']) {
    const before = JSON.stringify(app.crew.state);
    assert.throws(() => execute(app, command));
    assert.equal(JSON.stringify(app.crew.state), before);
  }
  app.crew.member('developer').messages.push({ role: 'user', text: 'Unanswered question' });
  const before = JSON.stringify(app.crew.state);
  assert.throws(() => execute(app, '/share reviewer'), /finish|answer/i);
  assert.equal(JSON.stringify(app.crew.state), before);
});

test('shared chat continues with remaining participants after a teammate is removed', async t => {
  const app = setup(t);
  execute(app, '/share reviewer');
  await app.crew.queue.settled(app.crew.discussions.current.taskIds.at(-1));
  execute(app, '/crew remove developer');
  execute(app, 'Review the remaining keyboard issues');
  const discussion = app.crew.discussions.current;
  await app.crew.queue.settled(discussion.taskIds.at(-1));
  assert.equal(discussion.status, 'completed');
  assert.ok(discussion.taskIds.every(id => app.crew.queue.get(id).member === 'reviewer'));
});

test('shared participants validate and follow teammate renames', async t => {
  const app = setup(t);
  execute(app, '/share reviewer');
  await app.crew.queue.settled(app.crew.discussions.current.taskIds.at(-1));
  const invalid = structuredClone(app.crew.state);
  invalid.discussions.at(-1).participants = 'everyone';
  assert.throws(() => validateState(invalid), /Invalid crew state/);
  execute(app, '/crew rename developer builder');
  assert.deepEqual(app.crew.discussions.current.participants, ['builder', 'reviewer']);
  execute(app, 'Check the same design');
  const discussion = app.crew.discussions.current;
  await app.crew.queue.settled(discussion.taskIds.at(-1));
  assert.deepEqual([...new Set(discussion.taskIds.map(id => app.crew.queue.get(id).member))], ['builder', 'reviewer']);
});

test('isolated execution receives explicitly shared findings in fresh individual conversations', async t => {
  const app = setup(t);
  const git = (...args) => execFileSync('git', ['-C', app.crew.folder, ...args], { windowsHide: true, stdio: 'pipe' });
  git('init');
  writeFileSync(join(app.crew.folder, 'README.md'), 'Fixture\n');
  git('add', 'README.md');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'initial');
  execute(app, '/share reviewer Review navigation');
  await app.crew.queue.settled(app.crew.discussions.current.taskIds.at(-1));
  await execute(app, '/crew-task --isolated Implement this');
  const flow = app.crew.state.workflows.at(-1);
  await app.crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  const plan = app.prompts.find(({ prompt }) => prompt.includes('PONGKAN_PLAN'));
  assert.match(plan.prompt, /keyboard accessible orange links/);
  assert.doesNotMatch(plan.prompt, /Unrelated chief secret|Older private/);
  assert.ok(flow.workspace);
  assert.ok(flow.conversations.developer);
  assert.ok(flow.conversations.chief);
  assert.equal(plan.args.includes('resume'), false);
});
