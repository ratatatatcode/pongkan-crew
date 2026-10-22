import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { Crew } from './helpers/legacy-crew.js';
import { validatePlan } from '../src/workflows.js';
import { screen } from '../src/ui.js';

function setup(t, runner) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-tasks-'));
  const crew = new Crew(folder, { runner });
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  return crew;
}
const reply = (event, text) => event({ type: 'item.completed', item: { type: 'agent_message', text } });

test('workflow chat displays the goal and readable plan instead of internal prompts', async t => {
  let finishPlan;
  const crew = setup(t, async (args, prompt, event) => {
    event({ type: 'thread.started', thread_id: 'display-test-session' });
    if (prompt.includes('PONGKAN_PLAN')) {
      await new Promise(resolve => {
        finishPlan = resolve;
      });
      reply(
        event,
        JSON.stringify({ steps: [{ member: 'developer', task: 'Implement feature' }], reviewer: 'reviewer' }),
      );
    } else reply(event, prompt.includes('PONGKAN_SUMMARY') ? 'Completed feature and review.' : 'Verified work.');
  });
  const flow = crew.workflows.start('Build the feature');
  const render = () => screen(crew, 'chief', '', '', 140, 100);
  try {
    assert.match(render(), /Build the feature/);
    assert.doesNotMatch(render(), /PONGKAN_PLAN|Roster:|Return ONLY JSON|Responsibilities:/);
  } finally {
    finishPlan();
  }
  await crew.workflows.settled(flow.id);
  assert.match(render(), /Developer: Implement feature/);
  assert.match(render(), /Completed feature and review/);
  assert.doesNotMatch(render(), /PONGKAN_SUMMARY|Previous teammate results|"steps"|Roster:/);
  assert.doesNotMatch(screen(crew, 'developer', '', '', 140, 100), /Previous teammate results/);
  assert.match(screen(crew, 'reviewer', '', '', 140, 100), /Verified work/);
  assert.match(crew.state.tasks.find(task => task.kind === 'plan').text, /Return ONLY JSON/);
  assert.match(crew.state.tasks.find(task => task.kind === 'plan').result, /"steps"/);
  // Existing saved transcripts lack task IDs: they must also render cleanly.
  for (const member of crew.state.members) for (const message of member.messages) delete message.taskId;
  crew.save();
  const restored = new Crew(crew.folder);
  assert.doesNotMatch(screen(restored, 'chief', '', '', 140, 100), /PONGKAN_PLAN|PONGKAN_SUMMARY|"steps"|Roster:/);
  assert.match(screen(restored, 'chief', '', '', 140, 100), /Developer: Implement feature/);
  restored.member('chief').messages.push({ role: 'user', text: 'Explain PONGKAN_PLAN and Return ONLY JSON to me.' });
  assert.match(screen(restored, 'chief', '', '', 140, 100), /Explain PONGKAN_PLAN and Return ONLY JSON to me/);
});

test('queue runs one writer, respects reordering and keeps per-task results', async t => {
  const started = [],
    finishes = [];
  const crew = setup(t, async (args, prompt, event) => {
    started.push(prompt);
    await new Promise(resolve => finishes.push(resolve));
    reply(event, 'Finished');
  });
  crew.add('builder', 'Build', true);
  const first = crew.queue.enqueue('developer', 'first');
  const second = crew.queue.enqueue('builder', 'second');
  const third = crew.queue.enqueue('developer', 'third');
  assert.equal(first.status, 'running');
  assert.equal(second.status, 'queued');
  crew.queue.move(third.id, 1);
  finishes.shift()();
  await crew.queue.settled(first.id);
  assert.match(started[1], /third/);
  finishes.shift()();
  await crew.queue.settled(third.id);
  finishes.shift()();
  await crew.queue.settled(second.id);
  assert.equal(second.result, 'Finished');
});
test('pause, cancel and restore never silently rerun interrupted tasks', async t => {
  const crew = setup(t, async () => {});
  crew.queue.pause();
  const task = crew.queue.enqueue('developer', 'later');
  assert.equal(task.status, 'queued');
  crew.queue.cancel(task.id);
  assert.equal(task.status, 'cancelled');
  const pending = crew.queue.enqueue('developer', 'recover');
  pending.status = 'running';
  crew.save();
  const restored = new Crew(crew.folder);
  assert.equal(restored.state.tasks.find(t => t.id === pending.id).status, 'interrupted');
  assert.equal(restored.queue.paused, true);
});
test('queue cancellation stops execution and leaves a cancelled result', async t => {
  const crew = setup(
    t,
    (args, prompt, event, signal) =>
      new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
  );
  const task = crew.queue.enqueue('developer', 'cancel me');
  crew.queue.cancel(task.id);
  await crew.queue.settled(task.id);
  assert.equal(task.status, 'cancelled');
});
test('Chief executes validated steps, hands off results, reviews and summarizes', async t => {
  const calls = [];
  const crew = setup(t, async (args, prompt, event) => {
    calls.push(prompt);
    if (prompt.includes('PONGKAN_PLAN'))
      reply(
        event,
        JSON.stringify({
          steps: [
            { member: 'researcher', task: 'Find conventions' },
            { member: 'developer', task: 'Implement feature' },
          ],
          reviewer: 'reviewer',
        }),
      );
    else reply(event, prompt.includes('PONGKAN_SUMMARY') ? 'Combined result' : 'Step result');
  });
  const workflow = crew.workflows.start('Build the feature');
  await crew.workflows.settled(workflow.id);
  assert.equal(workflow.status, 'completed');
  assert.equal(calls.length, 5);
  assert.match(calls[2], /Step result/);
  assert.match(calls[3], /Review/);
  assert.equal(crew.state.tasks.filter(t => t.workflowId === workflow.id).length, 5);
});
test('invalid AI plans cannot dispatch workers', async t => {
  let calls = 0;
  const crew = setup(t, async (args, prompt, event) => {
    calls++;
    reply(event, '{"steps":[{"member":"unknown","task":"edit"}],"reviewer":"reviewer"}');
  });
  const workflow = crew.workflows.start('Build');
  await crew.workflows.settled(workflow.id);
  assert.equal(workflow.status, 'failed');
  assert.equal(calls, 3);
  assert.equal(crew.state.tasks.filter(task => task.kind !== 'plan').length, 0);
  assert.throws(() => validatePlan({ steps: [], reviewer: 'developer' }, crew.state.members), /plan/i);
});
test('progress records commands, changed files and task failures', async t => {
  const crew = setup(t, async (args, prompt, event) => {
    event({ type: 'item.started', item: { type: 'command_execution', command: 'node --test' } });
    event({ type: 'item.completed', item: { type: 'file_change', changes: [{ path: 'src/app.js', kind: 'update' }] } });
    throw new Error('Network unavailable');
  });
  const task = crew.queue.enqueue('developer', 'Build');
  await crew.queue.settled(task.id);
  assert.equal(task.status, 'failed');
  assert.match(task.error, /Network unavailable/);
  assert.deepEqual(crew.member('developer').progress.files, ['src/app.js']);
  assert.match(crew.activity.join('\n'), /node --test/);
});

test('review tasks wait for a stable workspace and block writers during review', async t => {
  const finishes = [];
  const crew = setup(t, () => new Promise(resolve => finishes.push(resolve)));
  const writer = crew.queue.enqueue('developer', 'Write');
  const review = crew.queue.enqueue('reviewer', 'Review', { readOnly: true, stableRead: true });
  assert.equal(review.status, 'queued');
  finishes.shift()();
  await crew.queue.settled(writer.id);
  assert.equal(review.status, 'running');
  const next = crew.queue.enqueue('developer', 'More writes');
  assert.equal(next.status, 'queued');
  finishes.shift()();
  await crew.queue.settled(review.id);
  finishes.shift()();
  await crew.queue.settled(next.id);
});

test('failed workflow and unavailable recovery coordinator stop after bounded retries and expose the error', async t => {
  let calls = 0;
  const crew = setup(t, async (args, prompt, event) => {
    calls++;
    if (prompt.includes('PONGKAN_PLAN'))
      reply(event, '{"steps":[{"member":"developer","task":"Implement"}],"reviewer":"reviewer"}');
    else throw new Error('Build failed');
  });
  const workflow = crew.workflows.start('Build');
  await crew.workflows.settled(workflow.id);
  assert.equal(workflow.status, 'failed');
  assert.match(workflow.error, /Build failed/);
  assert.equal(calls, 5);
  assert.ok(crew.state.tasks.filter(t => ['review', 'summary'].includes(t.kind)).every(t => t.status === 'cancelled'));
});

test('writer tasks capture real diffs and keep them with their durable result', async t => {
  let crew;
  crew = setup(t, async (args, prompt, event) => {
    writeFileSync(join(crew.folder, 'feature.txt'), 'working feature\n');
    reply(event, 'Implemented');
  });
  const task = crew.queue.enqueue('developer', 'Build feature');
  await crew.queue.settled(task.id);
  assert.match(task.diff.text, /\+working feature/);
  assert.deepEqual(task.diff.files, ['feature.txt']);
  assert.match(new Crew(crew.folder).state.tasks.find(t => t.id === task.id).diff.text, /feature.txt/);
});

test('agent activity changes from thinking to command execution and back', async t => {
  let crew;
  crew = setup(t, async (args, prompt, event) => {
    event({ type: 'turn.started' });
    assert.equal(crew.member('researcher').progress.phase, 'thinking');
    event({ type: 'item.started', item: { type: 'command_execution', command: 'read project' } });
    assert.equal(crew.member('researcher').progress.phase, 'command');
    event({ type: 'item.completed', item: { type: 'command_execution', command: 'read project' } });
    assert.equal(crew.member('researcher').progress.phase, 'thinking');
    event({ type: 'item.started', item: { type: 'agent_message' } });
    assert.equal(crew.member('researcher').progress.phase, 'responding');
    reply(event, 'Answer');
  });
  const task = crew.queue.enqueue('researcher', 'Read');
  await crew.queue.settled(task.id);
  assert.equal(task.status, 'completed');
});
