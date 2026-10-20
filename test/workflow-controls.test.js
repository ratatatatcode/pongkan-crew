import test from 'node:test';
import assert from 'node:assert/strict';
import { Workflows } from '../src/workflows.js';

function fixture() {
  const flow = { id: '1234abcd', text: 'Build a feature', status: 'working', createdAt: Date.now() };
  const running = { id: 'aaaa1111', workflowId: flow.id, member: 'developer', status: 'running', kind: 'work' };
  const queued = { id: 'bbbb2222', workflowId: flow.id, member: 'reviewer', status: 'queued', kind: 'review' };
  const completed = { id: 'cccc3333', workflowId: flow.id, member: 'developer', status: 'completed', kind: 'work' };
  const stopped = [];
  let drained = 0;
  const verified = [];
  const crew = {
    state: { workflows: [flow], tasks: [completed, running, queued] },
    save() {},
    notify() {},
    stop: (...args) => stopped.push(args),
    member: name => ({ name }),
    worktrees: { verify: flow => verified.push(flow.id) },
    queue: { drain: () => drained++ },
  };
  return { crew, flow, running, queued, completed, stopped, verified, drained: () => drained };
}

test('workflow pause stops its running turn and resume preserves completed steps', () => {
  const f = fixture();
  const workflows = new Workflows(f.crew);
  f.flow.status = 'working';
  f.queued.status = 'queued';
  workflows.pause(f.flow.id);
  assert.equal(f.flow.status, 'paused');
  assert.equal(f.running.pauseRequested, true);
  assert.deepEqual(f.stopped, [['developer', undefined]]);
  f.running.status = 'interrupted';
  workflows.resume(f.flow.id);
  assert.equal(f.running.status, 'queued');
  assert.equal(f.queued.status, 'queued');
  assert.equal(f.completed.status, 'completed');
  assert.equal(f.flow.status, 'working');
  assert.equal(f.drained(), 1);
});

test('paused workflows remain paused during startup recovery', () => {
  const f = fixture();
  f.flow.status = 'paused';
  f.running.status = 'interrupted';
  const workflows = new Workflows(f.crew);
  assert.equal(workflows.get(f.flow.id).status, 'paused');
});

test('resuming a paused isolated workflow verifies its worktree before requeueing', () => {
  const f = fixture();
  f.flow.status = 'paused';
  f.flow.workspace = 'isolated';
  f.running.status = 'interrupted';
  const workflows = new Workflows(f.crew);

  workflows.resume(f.flow.id);

  assert.deepEqual(f.verified, [f.flow.id]);
  assert.equal(f.running.status, 'queued');
  assert.equal(f.drained(), 1);
});

test('a paused workflow with an invalid worktree stays paused and does not requeue', () => {
  const f = fixture();
  f.flow.status = 'paused';
  f.flow.workspace = 'isolated';
  f.running.status = 'interrupted';
  f.crew.worktrees.verify = () => {
    throw new Error('Workflow worktree is unavailable.');
  };
  const workflows = new Workflows(f.crew);

  assert.throws(() => workflows.resume(f.flow.id), /worktree is unavailable/);
  assert.equal(f.flow.status, 'paused');
  assert.equal(f.running.status, 'interrupted');
  assert.equal(f.drained(), 0);
});

test('cancelling an active workflow cancels unfinished tasks and stops running turns', () => {
  const f = fixture();
  const workflows = new Workflows(f.crew);
  f.flow.status = 'working';

  workflows.cancel(f.flow.id);

  assert.equal(f.flow.status, 'cancelled');
  assert.equal(f.running.cancelRequested, true);
  assert.deepEqual(f.stopped, [['developer', undefined]]);
  assert.equal(f.queued.status, 'cancelled');
  assert.equal(f.completed.status, 'completed');
});

test('cancelling a completed workflow preserves its result and status', () => {
  const f = fixture();
  const workflows = new Workflows(f.crew);
  f.flow.status = 'completed';
  f.flow.result = 'Done';
  f.queued.status = 'queued';

  assert.throws(() => workflows.cancel(f.flow.id), /Only an active workflow/);

  assert.equal(f.flow.status, 'completed');
  assert.equal(f.flow.result, 'Done');
  assert.equal(f.running.status, 'running');
  assert.equal(f.queued.status, 'queued');
  assert.deepEqual(f.stopped, []);
});
