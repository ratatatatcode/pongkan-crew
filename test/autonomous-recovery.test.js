import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from './helpers/legacy-crew.js';
import { validateState } from '../src/state.js';
import { MAX_RECOVERY_ATTEMPTS } from '../src/recovery-policy.js';

function setup(t, respond) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-autonomous-'));
  let crew;
  const calls = [];
  crew = new Crew(folder, {
    runner: async (args, prompt, event) => {
      const task = crew.state.tasks.find(task => task.status === 'running');
      calls.push({ task: { ...task }, prompt, args });
      const text = await respond({ task, prompt, event, crew, calls });
      event({
        type: 'item.completed',
        item: { type: 'agent_message', text: typeof text === 'string' ? text : JSON.stringify(text) },
      });
    },
  });
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  return { crew, calls };
}

const plan = { steps: [{ member: 'developer', task: 'Produce the requested deliverables' }], reviewer: 'reviewer' };
const repair = {
  action: 'repair',
  member: 'developer',
  instruction: 'Test the current hypothesis, repair the prerequisite, and verify it.',
};

test('unfamiliar failures and failed repairs recover automatically and preserve completed work', async t => {
  let work = 0;
  let repairs = 0;
  const { crew, calls } = setup(t, ({ task, event, prompt }) => {
    if (task.kind === 'plan') return plan;
    if (task.recoveryFor) {
      if (repairs) assert.match(prompt, /unfamiliar decoder condition 47/);
      return repair;
    }
    if (task.repairFor) {
      repairs++;
      event({
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: `probe-${repairs}`,
          exit_code: repairs < 4 ? 1 : 0,
          aggregated_output: `new finding ${repairs}`,
        },
      });
      if (repairs < 4) return 'PONGKAN_BLOCKED: unfamiliar decoder condition 47';
      return 'Prerequisite verified.';
    }
    if (task.kind === 'work' && ++work === 1) return 'PONGKAN_BLOCKED: unfamiliar decoder condition 47';
    return 'Verified deliverables.';
  });
  const flow = crew.workflows.start('Create deliverables');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.equal(repairs, 4, 'new evidence permits recovery beyond the old two-attempt limit');
  assert.equal(work, 2, 'resume the original assignment only after its prerequisite succeeds');
  assert.equal(calls.filter(call => call.task.kind === 'plan').length, 1);
  assert.ok(calls.filter(call => call.task.repairFor).every(call => call.args.includes('--approve-for-me')));
  assert.doesNotThrow(() => validateState(structuredClone(crew.state)));
});

test('execution errors enter recovery even without a PONGKAN_BLOCKED response', async t => {
  let work = 0;
  const { crew } = setup(t, ({ task }) => {
    if (task.kind === 'plan') return plan;
    if (task.recoveryFor) return repair;
    if (task.repairFor) return 'Dependency repaired and checked.';
    if (task.kind === 'work' && ++work === 1) throw new Error('Unexpected transport failure');
    return 'Verified.';
  });
  const flow = crew.workflows.start('Complete the outcome');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.equal(work, 2);
});

test('planning and recovery can repair malformed coordinator output automatically', async t => {
  let plans = 0;
  let diagnoses = 0;
  let work = 0;
  const { crew } = setup(t, ({ task }) => {
    if (task.kind === 'plan') return ++plans === 1 ? 'not a valid plan' : plan;
    if (task.recoveryFor) return ++diagnoses === 1 ? 'not a valid diagnosis' : repair;
    if (task.repairFor) return 'Prerequisite verified.';
    if (task.kind === 'work' && ++work === 1) return 'PONGKAN_BLOCKED: Unfamiliar prerequisite';
    return 'Verified.';
  });
  const flow = crew.workflows.start('Complete the outcome');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.equal(plans, 2);
  assert.equal(diagnoses, 2);
  assert.doesNotThrow(() => validateState(structuredClone(crew.state)));
});

test('a premature stop becomes an investigation rather than an instruction to the user', async t => {
  let work = 0;
  const { crew, calls } = setup(t, ({ task }) => {
    if (task.kind === 'plan') return plan;
    if (task.recoveryFor)
      return { action: 'stop', member: 'developer', instruction: 'Required tool not found; user must set it up.' };
    if (task.repairFor)
      return 'Investigated the environment, set up the local dependency and verified the actual operation.';
    if (task.kind === 'work' && ++work === 1) return 'PONGKAN_BLOCKED: Required tool not found';
    return 'Verified.';
  });
  const flow = crew.workflows.start('Create everything');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  const investigation = calls.find(call => call.task.repairFor);
  assert.match(investigation.prompt, /hypothesis|hypotheses/i);
  assert.match(investigation.prompt, /project.local/i);
});

test('a documented external boundary stops without retrying a denied action', async t => {
  const { crew, calls } = setup(t, ({ task }) => {
    if (task.kind === 'plan') return plan;
    if (task.recoveryFor)
      return {
        action: 'stop',
        member: 'developer',
        instruction: 'Publishing needs account access.',
        boundary: {
          kind: 'credentials',
          evidence: 'The account tool reports authentication required; no authenticated connection is available.',
          userAction: 'Connect the publishing account.',
        },
      };
    return 'PONGKAN_BLOCKED: Publishing account authentication is unavailable';
  });
  const flow = crew.workflows.start('Create and publish the result');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'failed');
  assert.match(flow.error, /Connect the publishing account/);
  assert.equal(calls.filter(call => call.task.repairFor).length, 0);
});

test('repeated attempts without new execution evidence terminate with an honest recovery report', async t => {
  const { crew, calls } = setup(t, ({ task }) => {
    if (task.kind === 'plan') return plan;
    if (task.recoveryFor) return repair;
    return 'PONGKAN_BLOCKED: Same unresolved condition';
  });
  const flow = crew.workflows.start('Complete the outcome');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'failed');
  assert.ok(calls.length < 15, 'must not loop indefinitely');
  assert.match(flow.error, /no new evidence|without new evidence/i);
  assert.doesNotMatch(flow.error, /use \/recovery|needs user action/i);
  assert.doesNotThrow(() => validateState(structuredClone(crew.state)));
});

test('changing observations cannot exceed the total recovery safety ceiling', async t => {
  let probes = 0;
  const { crew, calls } = setup(t, ({ task, event }) => {
    if (task.kind === 'plan') return plan;
    if (task.recoveryFor) return repair;
    if (task.repairFor)
      event({
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: 'probe',
          exit_code: 1,
          aggregated_output: `Observation ${++probes}`,
        },
      });
    return 'PONGKAN_BLOCKED: Outcome is still unresolved';
  });
  const flow = crew.workflows.start('Complete the outcome');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'failed');
  assert.equal(calls.filter(call => call.task.recoveryFor).length, MAX_RECOVERY_ATTEMPTS);
  assert.match(flow.error, /safety limit/);
  assert.doesNotThrow(() => validateState(structuredClone(crew.state)));
});

test('user cancellation during a repair never starts another recovery', async t => {
  const { crew, calls } = setup(t, ({ task, crew }) => {
    if (task.kind === 'plan') return plan;
    if (task.recoveryFor) return repair;
    if (task.repairFor) crew.workflows.cancel(task.workflowId);
    return 'PONGKAN_BLOCKED: Unresolved condition';
  });
  const flow = crew.workflows.start('Complete the outcome');
  await crew.workflows.settled(flow.id);
  await crew.close();
  assert.equal(flow.status, 'cancelled');
  assert.equal(calls.filter(call => call.task.recoveryFor).length, 1);
  assert.doesNotThrow(() => validateState(structuredClone(crew.state)));
});

test('malformed persisted recovery evidence is rejected', async t => {
  const { crew } = setup(t, ({ task }) => (task.kind === 'plan' ? plan : 'Verified.'));
  const flow = crew.workflows.start('Complete the outcome');
  await crew.workflows.settled(flow.id);
  for (const patch of [
    { recoveryEvidence: ['bad hash'] },
    { changeEvidence: ['bad hash'] },
    { schemaRetries: 100 },
    { toolAttempts: [{ output: 123 }] },
  ]) {
    const state = structuredClone(crew.state);
    Object.assign(state.tasks[0], patch);
    assert.throws(() => validateState(state), /Invalid crew state/);
  }
});

test('independent verification failures trigger repair and reinspection before completion', async t => {
  let reviews = 0;
  const { crew, calls } = setup(t, ({ task, event }) => {
    if (task.kind === 'plan') return plan;
    if (task.recoveryFor) return repair;
    if (task.kind === 'review') {
      reviews++;
      event({
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: 'inspect-deliverables',
          exit_code: 0,
          aggregated_output: reviews === 1 ? 'Missing output' : 'All outputs verified',
        },
      });
      return {
        outcome: reviews === 1 ? 'needs_work' : 'met',
        summary: 'Inspected current outputs.',
        criteria: [
          {
            requirement: 'All deliverables',
            status: reviews === 1 ? 'fail' : 'pass',
            evidence: reviews === 1 ? 'One required file is missing' : 'All files exist and passed inspection',
          },
        ],
      };
    }
    return 'Created and checked.';
  });
  const flow = crew.workflows.start('Create all deliverables', { requiresWrite: true });
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.equal(flow.outcome, 'met');
  assert.equal(reviews, 2);
  assert.ok(calls.find(call => call.task.repairFor));
  assert.equal(calls.filter(call => call.task.kind === 'summary').length, 1);
});

test('unchanged failed requirements stop recovery despite fresh inspection output', async t => {
  let reviews = 0;
  const { crew } = setup(t, ({ task, event }) => {
    if (task.kind === 'plan') return plan;
    if (task.recoveryFor) return repair;
    if (task.kind === 'review') {
      event({
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: 'inspect-deliverables',
          exit_code: 0,
          aggregated_output: `Inspection ${++reviews}: final export still missing`,
        },
      });
      return {
        outcome: 'needs_work',
        summary: `Inspection ${reviews}`,
        criteria: [{ requirement: 'Finished video export', status: 'fail', evidence: `Check ${reviews}: missing` }],
      };
    }
    return 'Updated handoff notes.';
  });
  const flow = crew.workflows.start('Create the finished video', { requiresWrite: true });
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'failed');
  assert.equal(flow.recoveryAttempts, 2);
  assert.equal(reviews, 3);
  assert.match(flow.error, /Finished video export/);
  assert.match(flow.error, /without new evidence/);
  assert.doesNotThrow(() => validateState(structuredClone(crew.state)));
});
