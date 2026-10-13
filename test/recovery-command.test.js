import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from '../src/crew.js';
import { execute, HELP } from '../src/commands.js';
import { completions } from '../src/controls.js';
import { validateState } from '../src/state.js';

function setup(t) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-recovery-command-'));
  const crew = new Crew(folder);
  crew.queue.pause();
  crew.queue.drain = () => {};
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const discussion = crew.discussions.newConversation();
  const flow = crew.workflows.start('Fix isolation and test it', { sourceDiscussionId: discussion.id });
  const plan = crew.state.tasks.find(task => task.workflowId === flow.id);
  plan.status = 'completed';
  plan.result = JSON.stringify({ steps: [{ member: 'developer', task: 'Fix isolation' }], reviewer: 'reviewer' });
  crew.workflows.onFinish(plan);
  const work = crew.state.tasks.find(task => task.workflowId === flow.id && task.kind === 'work');
  for (const task of crew.state.tasks.filter(task => task.workflowId === flow.id)) {
    if (task === work) break;
    task.status = 'completed';
    task.result ||= 'Briefed the worker.';
  }
  crew.workflows.fail(flow.id, 'Database implementation is missing');
  work.status = 'failed';
  work.error = flow.error;
  return { crew, flow, work, app: { crew, selected: 'developer', view: 'group' } };
}

test('/recovery finds the current failed workflow and gives it a fresh bounded diagnosis', t => {
  const { crew, flow, work, app } = setup(t);
  flow.recoveryAttempts = 2;
  const unrelated = crew.queue.enqueue('researcher', 'Unrelated work');
  execute(app, '/recovery');
  assert.equal(flow.status, 'collaborating');
  assert.equal(flow.recoveryAttempts, 1);
  assert.equal(work.status, 'queued');
  const diagnosis = crew.state.tasks.find(task => task.recoveryFor === work.id);
  assert.ok(diagnosis?.readOnly);
  assert.match(diagnosis.text, /Database implementation is missing/);
  assert.equal(unrelated.dispatchPaused, true);
  assert.match(app.notice, new RegExp(flow.id));
  assert.doesNotThrow(() => validateState(structuredClone(crew.state)));
  const before = JSON.stringify(crew.state);
  assert.throws(() => execute(app, '/recovery'), /already active/);
  assert.equal(JSON.stringify(crew.state), before);
});

test('/recovery bypasses obsolete recovery dependencies and preserves completed source steps', t => {
  const { crew, flow, work, app } = setup(t);
  const old = crew.queue.enqueue('chief', 'Old recovery', {
    workflowId: flow.id,
    kind: 'coordination',
    recoveryFor: work.id,
    readOnly: true,
    schema: {},
    dependsOn: work.dependsOn,
    hold: true,
  });
  old.status = 'failed';
  old.error = 'Wrong read-only handoff';
  const previous = work.dependsOn;
  work.dependsOn = old.id;
  execute(app, `/recovery ${flow.id}`);
  const fresh = crew.state.tasks.findLast(task => task.recoveryFor === work.id);
  assert.notEqual(fresh.id, old.id);
  assert.equal(fresh.dependsOn, previous);
  assert.equal(old.status, 'failed');
  assert.equal(crew.queue.get(previous).status, 'completed');
  assert.doesNotThrow(() => validateState(structuredClone(crew.state)));
});

test('/recovery rejects malformed commands and refuses completed workflows', t => {
  const { crew, flow, app } = setup(t);
  const before = JSON.stringify(crew.state);
  assert.throws(() => execute(app, '/recovery one two'), /Use \/recovery/);
  assert.equal(JSON.stringify(crew.state), before);
  flow.status = 'completed';
  assert.throws(() => execute(app, `/recovery ${flow.id}`), /complete/);
  assert.ok(HELP.some(line => line.includes('/recovery')));
  assert.ok(
    completions(
      '/rec',
      crew.state.members.map(member => member.name),
    ).includes('/recovery'),
  );
});

test('/recovery completes a fresh repair without redispatching completed steps', async t => {
  const { crew, flow, app } = setup(t);
  flow.recoveryAttempts = 2;
  const originalCompleted = crew.state.tasks
    .filter(task => task.workflowId === flow.id && task.status === 'completed')
    .map(task => task.id);
  const executed = [];
  crew.runner = async (args, prompt, event) => {
    const task = crew.state.tasks.find(task => task.status === 'running');
    executed.push(task.id);
    let text = 'Verified current files and tests.';
    if (task.recoveryFor)
      text = JSON.stringify({
        action: 'repair',
        member: 'developer',
        instruction: 'Implement the accepted contract and run npm.cmd test.',
      });
    if (task.repairFor) {
      assert.equal(task.kind, 'revision');
      assert.ok(args.includes('workspace-write'));
    }
    event({ type: 'item.completed', item: { type: 'agent_message', text } });
  };
  delete crew.queue.drain;
  execute(app, '/recovery');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.ok(crew.state.tasks.some(task => task.repairFor && task.status === 'completed'));
  assert.ok(originalCompleted.every(id => !executed.includes(id)));
  assert.doesNotThrow(() => validateState(structuredClone(crew.state)));
});

test('/recovery does not select failures from a different conversation', t => {
  const { crew, app } = setup(t);
  crew.discussions.newConversation();
  const before = JSON.stringify(crew.state);
  assert.throws(() => execute(app, '/recovery'), /No unfinished workflow/);
  assert.equal(JSON.stringify(crew.state), before);
});
