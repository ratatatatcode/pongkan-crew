import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from '../src/crew.js';
import { codexExecutionPolicy } from '../src/codex-permissions.js';
import { recordExecution, executionContext } from '../src/execution-recovery.js';
import { validateState } from '../src/state.js';
import { steer } from '../src/steering.js';

const reply = (event, value) =>
  event({
    type: 'item.completed',
    item: { type: 'agent_message', text: typeof value === 'string' ? value : JSON.stringify(value) },
  });
function setup(t, respond) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-ai-recovery-'));
  const calls = [];
  let crew;
  crew = new Crew(folder, {
    runner: async (args, prompt, event, signal) => {
      calls.push({ args, prompt });
      await respond({ args, prompt, event, signal, crew });
    },
  });
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  return { crew, calls };
}

test('failure recording preserves arbitrary evidence without assigning an error keyword category', () => {
  for (const output of [
    'EPERM lstat',
    'npm.ps1 PSSecurityException',
    'dubious ownership safe.directory',
    'Zorbital frobnicator returned 47',
  ]) {
    const task = {};
    recordExecution(
      task,
      { type: 'command_execution', command: 'probe', exit_code: 47, aggregated_output: output },
      {},
      'project',
    );
    assert.equal(task.executionAttempts[0].output, output);
    assert.equal(task.executionAttempts[0].kind, undefined);
  }
  const context = executionContext({}, { sandbox: 'workspace-write', approval: 'on-request' });
  assert.doesNotMatch(context, /EPERM|npm\.cmd|safe\.directory|Python311|Users\\Admin/);
  assert.match(context, /evidence|hypothes/i);
});

for (const mode of ['ask', 'approve', 'full', 'read-only']) {
  test(`direct tasks recover through AI while preserving permission mode ${mode}`, async t => {
    let turns = 0;
    const { crew, calls } = setup(t, ({ prompt, event }) => {
      if (prompt.includes('PONGKAN_TASK_RECOVERY')) {
        assert.match(prompt, /zorbital calibration failed/);
        return reply(event, {
          action: 'retry',
          instruction: 'Test a different calibration strategy and verify the requested output.',
          boundary: null,
        });
      }
      turns++;
      if (turns === 1) {
        event({
          type: 'item.completed',
          item: {
            type: 'command_execution',
            command: 'calibrate',
            exit_code: 47,
            aggregated_output: 'zorbital calibration failed',
          },
        });
        return reply(event, 'PONGKAN_BLOCKED: zorbital calibration failed');
      }
      assert.match(prompt, /different calibration strategy/);
      reply(event, 'Output produced and checked.');
    });
    crew.member('developer').codexPermissions = mode;
    const task = crew.queue.enqueue('developer', 'Produce the requested output.');
    await crew.queue.settled(task.id);
    assert.equal(task.status, 'completed');
    assert.equal(turns, 2);
    const work = calls.filter(call => !call.prompt.includes('PONGKAN_TASK_RECOVERY'));
    const assessment = calls.find(call => call.prompt.includes('PONGKAN_TASK_RECOVERY'));
    assert.ok(assessment.args.includes('read-only'));
    assert.deepEqual(work[0].args, work[1].args);
    assert.deepEqual(
      codexExecutionPolicy(crew.member('developer')),
      codexExecutionPolicy({ ...crew.member('developer'), codexPermissions: mode }),
    );
    assert.doesNotMatch(
      crew
        .member('developer')
        .messages.map(message => message.text)
        .join('\n'),
      /PONGKAN_TASK_RECOVERY/,
    );
    assert.doesNotThrow(() => validateState(structuredClone(crew.state)));
  });
}

test('direct shared turns receive reasoning guidance and recover without another user message', async t => {
  let turns = 0;
  const { crew } = setup(t, ({ prompt, event }) => {
    if (prompt.includes('PONGKAN_TASK_RECOVERY'))
      return reply(event, {
        action: 'retry',
        instruction: 'Investigate an alternative from the latest evidence.',
        boundary: null,
      });
    assert.match(prompt, /Current execution policy/);
    reply(event, ++turns === 1 ? 'PONGKAN_BLOCKED: Unknown prerequisite failed' : 'Verified the completed result.');
  });
  const discussion = crew.discussions.start('Create the result.', 'developer', { direct: true });
  const task = crew.queue.get(discussion.taskIds.at(-1));
  await crew.queue.settled(task.id);
  assert.equal(task.status, 'completed');
  assert.equal(discussion.status, 'completed');
  assert.equal(turns, 2);
});

test('a documented external boundary ends direct recovery without repeating the failed operation', async t => {
  let turns = 0;
  const { crew } = setup(t, ({ prompt, event }) => {
    if (prompt.includes('PONGKAN_TASK_RECOVERY'))
      return reply(event, {
        action: 'stop',
        instruction: 'The required account is not connected.',
        boundary: {
          kind: 'credentials',
          evidence: 'The service reports authentication required.',
          userAction: 'Connect the account.',
        },
      });
    turns++;
    reply(event, 'PONGKAN_BLOCKED: The service reports authentication required.');
  });
  const task = crew.queue.enqueue('developer', 'Complete the authorized service task.');
  await crew.queue.settled(task.id);
  assert.equal(task.status, 'failed');
  assert.equal(turns, 1);
  assert.match(task.error, /Connect the account/);
});

test('failed direct execution enters AI recovery without a special error string', async t => {
  let turns = 0;
  const { crew } = setup(t, ({ prompt, event }) => {
    if (prompt.includes('PONGKAN_TASK_RECOVERY'))
      return reply(event, {
        action: 'retry',
        instruction: 'Inspect current artifacts and continue the unfinished operation.',
        boundary: null,
      });
    if (++turns === 1) throw new Error('Unfamiliar engine interruption');
    reply(event, 'Verified completed output.');
  });
  const task = crew.queue.enqueue('developer', 'Produce the output.');
  await crew.queue.settled(task.id);
  assert.equal(task.status, 'completed');
  assert.equal(turns, 2);
});

test('cancelling during an AI recovery assessment stops the active turn and prevents continuation', async t => {
  let ready;
  const started = new Promise(resolve => {
    ready = resolve;
  });
  const { crew, calls } = setup(t, async ({ prompt, event, signal }) => {
    if (!prompt.includes('PONGKAN_TASK_RECOVERY')) return reply(event, 'PONGKAN_BLOCKED: Unknown operation failed');
    ready();
    await new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('Stopped')), { once: true });
    });
  });
  const task = crew.queue.enqueue('developer', 'Create the output.');
  await started;
  assert.equal(task.status, 'running');
  crew.queue.cancel(task.id);
  await crew.queue.settled(task.id);
  await crew.close();
  assert.equal(task.status, 'cancelled');
  assert.equal(calls.length, 2);
});

test('direct recovery stops stalled loops and validates its saved recovery records', async t => {
  const { crew } = setup(t, ({ prompt, event }) => {
    if (prompt.includes('PONGKAN_TASK_RECOVERY'))
      return reply(event, {
        action: 'retry',
        instruction: 'Test another hypothesis and verify the output.',
        boundary: null,
      });
    reply(event, 'PONGKAN_BLOCKED: Same unresolved condition');
  });
  const task = crew.queue.enqueue('developer', 'Create the output.');
  await crew.queue.settled(task.id);
  assert.equal(task.status, 'failed');
  assert.match(task.error, /without new evidence/);
  assert.equal(task.recoveryRounds.length, 2);
  assert.doesNotThrow(() => validateState(structuredClone(crew.state)));
  for (const patch of [{ recoveryGuidance: 123 }, { recoveryRounds: [{}] }]) {
    const state = structuredClone(crew.state);
    Object.assign(
      state.tasks.find(record => record.id === task.id),
      patch,
    );
    assert.throws(() => validateState(state), /Invalid crew state/);
  }
});

test('a correction arriving during recovery is applied before a stale stop decision', async t => {
  let ready, release;
  const started = new Promise(resolve => {
    ready = resolve;
  });
  const gate = new Promise(resolve => {
    release = resolve;
  });
  t.after(() => release());
  let turns = 0;
  const { crew } = setup(t, async ({ prompt, event }) => {
    if (prompt.includes('PONGKAN_TASK_RECOVERY')) {
      ready();
      await gate;
      return reply(event, {
        action: 'stop',
        instruction: 'The remote account is unavailable.',
        boundary: { kind: 'credentials', evidence: 'No authenticated connection.', userAction: 'Connect an account.' },
      });
    }
    if (++turns === 1) return reply(event, 'PONGKAN_BLOCKED: Remote operation unavailable');
    assert.match(prompt, /Use the existing local alternative/);
    reply(event, 'Verified local output.');
  });
  const task = crew.queue.enqueue('developer', 'Produce the output.');
  await started;
  steer(crew, task.id, 'Use the existing local alternative.');
  release();
  await crew.queue.settled(task.id);
  assert.equal(task.status, 'completed');
  assert.equal(turns, 2);
  assert.ok(task.steering[0].appliedAt);
});
