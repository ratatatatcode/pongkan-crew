import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from '../src/crew.js';
import { validateState } from '../src/state.js';
import { execute } from '../src/commands.js';

function setup(t, recovery, alwaysBlocked = false) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-workflow-recovery-'));
  const calls = [];
  let workTurns = 0;
  const crew = new Crew(folder, {
    runner: async (args, prompt, event) => {
      calls.push({ args, prompt });
      let text = 'Checked';
      if (prompt.includes('PONGKAN_PLAN'))
        text = JSON.stringify({ steps: [{ member: 'developer', task: 'Fix isolation' }], reviewer: 'reviewer' });
      else if (prompt.includes('PONGKAN_RECOVERY')) text = JSON.stringify(recovery);
      else if (prompt.includes('PONGKAN_REPAIR')) text = 'Contract accepted after review';
      else if (prompt.startsWith('You are developer')) {
        workTurns++;
        text =
          alwaysBlocked || workTurns === 1 ? 'PONGKAN_BLOCKED: Reviewer confirmation is missing' : 'Isolation fixed';
      }
      event({ type: 'item.completed', item: { type: 'agent_message', text } });
    },
  });
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  return { crew, calls };
}

test('workflow requests teammate confirmation and retries the same blocked assignment', async t => {
  const { crew, calls } = setup(t, {
    action: 'handoff',
    member: 'reviewer',
    instruction: 'Review the isolation contract and state acceptance or changes.',
  });
  const flow = crew.workflows.start('Fix isolation');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  const work = crew.state.tasks.find(task => task.kind === 'work');
  assert.equal(work.continuations, 1);
  const repair = calls.find(call => call.prompt.includes('PONGKAN_REPAIR'));
  assert.ok(repair);
  assert.ok(repair.args.includes('read-only'));
  const retry = calls.filter(call => call.prompt.startsWith('You are developer')).at(-1);
  assert.match(retry.prompt, /Contract accepted after review/);
  assert.doesNotThrow(() => validateState(structuredClone(crew.state)));
});

test('automatic recovery stops after two attempts instead of looping', async t => {
  const { crew, calls } = setup(
    t,
    { action: 'retry', member: 'developer', instruction: 'Use npm.cmd to run the existing test.' },
    true,
  );
  const flow = crew.workflows.start('Fix isolation');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'failed');
  assert.equal(calls.filter(call => call.prompt.includes('PONGKAN_RECOVERY')).length, 2);
});

test('automatic retries preserve a read-only worker permission mode', async t => {
  const { crew, calls } = setup(
    t,
    { action: 'retry', member: 'developer', instruction: 'Check actual access and report the prerequisite.' },
    true,
  );
  crew.member('developer').codexPermissions = 'read-only';
  const flow = crew.workflows.start('Inspect isolation');
  await crew.workflows.settled(flow.id);
  const turns = calls.filter(call => call.prompt.startsWith('You are developer'));
  assert.equal(turns.length, 3);
  assert.ok(turns.every(call => call.args.includes('read-only') && !call.args.includes('--approve-for-me')));
  assert.equal(crew.member('developer').codexPermissions, 'read-only');
});

test('coordinator blocker can dispatch a different writer before retrying the coordinator', async t => {
  const { crew, calls } = setup(t, {
    action: 'retry',
    member: 'developer',
    instruction: 'Create the regression test and run npm.cmd test.',
  });
  const runner = crew.runner;
  let summaries = 0;
  crew.runner = async (args, prompt, event, ...rest) => {
    if (prompt.includes('PONGKAN_SUMMARY') && ++summaries === 1) {
      event({
        type: 'item.completed',
        item: { type: 'agent_message', text: 'PONGKAN_BLOCKED: Developer must add the regression test.' },
      });
      return;
    }
    return runner(args, prompt, event, ...rest);
  };
  const flow = crew.workflows.start('Fix isolation and add regression coverage');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  const repair = calls.find(
    call => call.prompt.includes('PONGKAN_REPAIR') && call.prompt.startsWith('You are developer'),
  );
  assert.ok(repair?.args.includes('--approve-for-me'));
  assert.doesNotThrow(() => validateState(structuredClone(crew.state)));
});

test('read-only runtime failure delegates execution to an existing writer before QA resumes', t => {
  const { crew } = setup(t, {});
  crew.queue.pause();
  const flow = crew.workflows.start('Fix isolation and verify it');
  crew.queue.enqueue('developer', 'Implement isolation', { workflowId: flow.id, kind: 'work', readOnly: false });
  const qa = crew.queue.enqueue('reviewer', 'Independently verify isolation', {
    workflowId: flow.id,
    kind: 'work',
    readOnly: true,
  });
  qa.executionAttempts = [{ kind: 'filesystem-access', policy: { approval: 'never' }, accessFailure: 'EPERM lstat' }];
  assert.equal(crew.workflows.recover(qa, 'EPERM lstat; approval never'), true);
  const diagnosis = crew.state.tasks.find(task => task.recoveryFor === qa.id);
  diagnosis.status = 'completed';
  diagnosis.result = JSON.stringify({ action: 'stop', member: 'reviewer', instruction: 'Need execution access' });
  crew.workflows.onFinish(diagnosis);
  const execution = crew.queue.get(qa.dependsOn);
  assert.equal(execution.member, 'developer');
  assert.equal(execution.readOnly, false);
  assert.match(execution.text, /Do not edit source files/);
  assert.match(qa.text, /Independently inspect/);
  assert.equal(qa.readOnly, true);
  assert.equal(flow.status, 'working');
});

test('recovery cannot add a writer task to a read-only workflow', async t => {
  const { crew, calls } = setup(t, { action: 'retry', member: 'researcher', instruction: 'Create a test.' });
  crew.member('developer').codexPermissions = 'read-only';
  crew.member('researcher').writable = true;
  const flow = crew.workflows.start('Inspect isolation');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'failed');
  assert.match(flow.error, /cannot introduce source edits/);
  assert.equal(calls.filter(call => call.prompt.includes('PONGKAN_REPAIR')).length, 0);
});

for (const decision of [
  { action: 'stop', member: 'developer', instruction: 'Approval is required from the user.' },
  { action: 'handoff', member: 'unknown', instruction: 'Review contract' },
  { action: 'repair', member: 'reviewer', instruction: 'Implement the contract' },
])
  test(`unsafe or unavailable recovery stops: ${decision.member}/${decision.action}`, async t => {
    const { crew, calls } = setup(t, decision);
    const flow = crew.workflows.start('Fix isolation');
    await crew.workflows.settled(flow.id);
    assert.equal(flow.status, 'failed');
    assert.equal(calls.filter(call => call.prompt.includes('PONGKAN_REPAIR')).length, 0);
  });

test('resuming an older blocked workflow requests recovery without repeating its plan', async t => {
  const { crew, calls } = setup(t, { action: 'handoff', member: 'reviewer', instruction: 'Review the contract.' });
  const recover = crew.workflows.recover;
  crew.workflows.recover = () => false;
  const flow = crew.workflows.start('Fix isolation');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'failed');
  crew.workflows.recover = recover;
  crew.workflows.resume(flow.id);
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.equal(calls.filter(call => call.prompt.includes('PONGKAN_PLAN')).length, 1);
});

test('recovery uses the designated coordinator after a rename', async t => {
  const { crew, calls } = setup(t, { action: 'handoff', member: 'reviewer', instruction: 'Review the contract.' });
  execute({ crew, selected: 'chief' }, '/crew rename chief project-lead');
  const flow = crew.workflows.start('Fix isolation');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.ok(calls.find(call => call.prompt.includes('PONGKAN_RECOVERY')).prompt.startsWith('You are project-lead'));
});

test('recovery survives restart and remains paused until explicitly resumed', async t => {
  const { crew } = setup(t, { action: 'handoff', member: 'reviewer', instruction: 'Review the contract.' });
  const runner = crew.runner;
  crew.runner = async (...args) => {
    await runner(...args);
    if (args[1].includes('PONGKAN_RECOVERY')) crew.queue.pause();
  };
  const flow = crew.workflows.start('Fix isolation');
  for (let i = 0; i < 200 && !crew.state.tasks.some(task => task.repairFor); i++)
    await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(crew.state.tasks.some(task => task.repairFor));
  await crew.close();
  let calls = 0;
  const restored = new Crew(crew.folder, {
    runner: async (args, prompt, event) => {
      calls++;
      event({ type: 'item.completed', item: { type: 'agent_message', text: 'Prerequisite resolved; checked.' } });
    },
  });
  try {
    assert.equal(calls, 0);
    assert.equal(restored.workflows.get(flow.id).status, 'interrupted');
    restored.workflows.resume(flow.id);
    restored.queue.resumeScope(task => task.workflowId === flow.id);
    await restored.workflows.settled(flow.id);
    assert.equal(restored.workflows.get(flow.id).status, 'completed');
    assert.equal(restored.workflows.get(flow.id).recoveryAttempts, 1);
  } finally {
    await restored.close();
  }
});
