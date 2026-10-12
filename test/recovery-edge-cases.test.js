import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from '../src/crew.js';
import { execute, queuePrompt, HELP } from '../src/commands.js';
import { completions } from '../src/controls.js';
import { screen } from '../src/ui.js';
import { installDirectSubmit } from './helpers/direct-submit.js';

function setup(t) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-recovery-edge-'));
  const crew = new Crew(folder);
  installDirectSubmit(crew);
  crew.queue.pause();
  crew.queue.drain = () => {};
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  return { crew, selected: 'developer', view: 'group' };
}

test('Activity stop cancels the current shared turn and preserves private work', t => {
  const app = setup(t);
  const privateTask = app.crew.queue.enqueue('developer', 'Private work');
  execute(app, '@chief Inspect this proposal.');
  const shared = app.crew.state.tasks.at(-1);
  app.view = 'activity';
  execute(app, '/stop');
  assert.equal(shared.status, 'cancelled');
  assert.equal(privateTask.status, 'queued');
});

test('malformed stop commands leave tasks and dispatch untouched', t => {
  const app = setup(t);
  execute(app, '@developer Rework the layout.');
  const before = JSON.stringify(app.crew.state);
  assert.throws(() => execute(app, '/stop all extra'), /Use \/stop/);
  assert.equal(JSON.stringify(app.crew.state), before);
});

for (const isolated of [false, true]) {
  test('workflow retry preserves requested outcome verification, isolated=' + isolated, async t => {
    const app = setup(t);
    const flow = app.crew.workflows.start('Change labels with historical context', {
      requiresWrite: true,
      requestGoal: 'Use Show summary',
    });
    app.crew.workflows.cancel(flow.id);
    if (isolated) {
      flow.workspace = 'synthetic-worktree';
      app.crew.workflows.startIsolated = (text, options) => app.crew.workflows.start(text, options);
    }
    const retry = await app.crew.workflows.retry(flow.id);
    assert.equal(retry.requiresWrite, true);
    assert.equal(retry.requestGoal, 'Use Show summary');
    assert.notEqual(retry.id, flow.id);
  });
}

test('explicit workflow resume preserves completed steps and keeps unrelated work paused', t => {
  const app = setup(t);
  const flow = app.crew.workflows.start('Build navigation');
  const plan = app.crew.state.tasks.find(task => task.workflowId === flow.id);
  plan.status = 'completed';
  plan.result = JSON.stringify({ steps: [{ member: 'developer', task: 'Build navigation' }], reviewer: 'reviewer' });
  app.crew.workflows.onFinish(plan);
  app.crew.workflows.cancel(flow.id);
  const other = app.crew.queue.enqueue('researcher', 'Unrelated saved work');
  execute(app, '/workflow resume ' + flow.id);
  assert.equal(plan.status, 'completed');
  assert.equal(flow.status, 'working');
  assert.equal(other.dispatchPaused, true);
  assert.equal(app.crew.queue.paused, false);
});

test('workflow-only Crew Chat renders a useful status without undefined or null', t => {
  const app = setup(t);
  const conversation = app.crew.conversations.create('group', 'Build');
  app.crew.workflows.start('Build navigation', { sourceConversationId: conversation.id });
  const output = screen(app.crew, app.selected, '', '', 120, 60, 0, null, { view: 'group' });
  assert.doesNotMatch(output, /CREW CHAT[^\n]*(?:undefined|null)/);
  assert.match(output, /Build navigation/);
});

test('a resumed reviewer cannot reuse inspection evidence from an earlier attempt', async t => {
  const app = setup(t);
  const flow = app.crew.workflows.start('Change labels', { requiresWrite: true });
  const plan = app.crew.state.tasks.find(task => task.workflowId === flow.id);
  plan.status = 'completed';
  plan.result = JSON.stringify({ steps: [{ member: 'developer', task: 'Change labels' }], reviewer: 'reviewer' });
  app.crew.workflows.onFinish(plan);
  const review = app.crew.state.tasks.find(task => task.workflowId === flow.id && task.kind === 'review');
  review.inspections = [{ kind: 'command_execution', action: 'Old source inspection', success: true }];
  review.status = 'running';
  app.crew.runner = async (_args, _prompt, event) => {
    event({
      type: 'item.completed',
      item: {
        type: 'agent_message',
        text: JSON.stringify({
          outcome: 'met',
          summary: 'Claims success without a new inspection.',
          criteria: [{ requirement: 'Labels', status: 'pass', evidence: 'Earlier findings' }],
        }),
      },
    });
  };
  await app.crew.queue.run(review);
  assert.equal(flow.outcome, 'unverified');
});

test('workflow recovery is discoverable and rejects extra arguments before changing state', t => {
  const app = setup(t);
  assert.ok(completions('/workflow res', []).includes('/workflow resume'));
  assert.ok(HELP.some(line => line.startsWith('/workflow resume')));
  const flow = app.crew.workflows.start('Build navigation');
  app.crew.workflows.cancel(flow.id);
  const before = JSON.stringify(app.crew.state);
  assert.throws(() => execute(app, '/workflow resume ' + flow.id + ' extra'), /Use \/workflow resume/);
  assert.equal(JSON.stringify(app.crew.state), before);
});

test('Activity queue shortcut delivers natural wording directly to the lead', t => {
  const app = setup(t);
  app.view = 'activity';
  const text = 'Could you untangle this for me?';
  queuePrompt(app, text);
  const task = app.crew.state.tasks.at(-1);
  assert.equal(task.member, app.crew.leadName);
  assert.equal(task.text, text);
  assert.equal(app.view, 'group');
  assert.equal(app.crew.state.workflows.length, 0);
});
