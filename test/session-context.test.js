import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from '../src/crew.js';
import { execute } from '../src/commands.js';
import { sessionContext, validSessionContext } from '../src/context.js';
import { validateState } from '../src/state.js';

function setup(t, runner) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-session-context-'));
  const crew = new Crew(folder, { runner });
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  return crew;
}

test('group discussion resumes with new teammate findings without replaying earlier replies', async t => {
  const calls = [];
  const crew = setup(t, async (args, prompt, event) => {
    calls.push({ args, prompt });
    const name = prompt.match(/^You are ([^,]+)/)[1];
    event({ type: 'thread.started', thread_id: `discussion-${name}` });
    event({ type: 'item.completed', item: { type: 'agent_message', text: `FINDING_${calls.length}` } });
  });
  const discussion = crew.discussions.start('LATEST_REQUEST: preserve keyboard access');
  await crew.queue.settled(discussion.taskIds.at(-1));
  const last = calls.at(-1);
  assert.ok(last.args.includes('resume'));
  assert.match(last.prompt, /LATEST_REQUEST: preserve keyboard access/);
  assert.match(last.prompt, new RegExp(`FINDING_${calls.length - 1}`));
  assert.doesNotMatch(last.prompt, /FINDING_1\b/);
  assert.equal(discussion.messages.filter(message => message.role === 'assistant').length, calls.length);
  validateState(crew.state);
});

test('shared advice defaults to one lead reply while explicit discussion retains the full roster', async t => {
  const crew = setup(t, async () => {});
  crew.queue.pause();
  crew.queue.drain = () => {};
  crew.inputs.resolve = () => ({
    action: 'discuss',
    target: null,
    taskId: null,
    workflowId: null,
    goal: '',
    question: '',
    requiresWrite: false,
    teamDiscussion: false,
  });
  const app = { crew, view: 'group', selected: 'developer' };
  await execute(app, 'What approach do you recommend?');
  const tasks = crew.state.tasks;
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].member, crew.leadName);
  assert.equal(tasks[0].readOnly, true);
  crew.discussions.stop();
  await execute(app, '/discuss Compare the approaches together');
  assert.equal(crew.discussions.current.taskIds.length, crew.state.members.length * 2 + 1);
});

test('session context tracks supplied records only and resends changed or fresh-session records', () => {
  const session = { threadId: 'original' };
  const first = { label: 'developer task', text: 'Initial finding' };
  const omitted = { label: 'older task', text: 'Outside the prompt budget' };
  const delivery = sessionContext(session, [first, omitted]);
  assert.equal(session.contextHashes, undefined, 'building a failed or cancelled turn must not acknowledge it');
  delivery.commit('developer task: Initial finding');
  const restored = JSON.parse(JSON.stringify(session));
  assert.deepEqual(sessionContext(restored, [first, omitted]).records, [omitted]);
  const changed = { ...first, text: 'Updated finding after continuation' };
  assert.deepEqual(sessionContext(restored, [changed]).records, [changed]);
  restored.threadId = 'replacement';
  assert.deepEqual(sessionContext(restored, [first]).records, [first]);
  restored.threadId = null;
  sessionContext(restored, [first]).commit('developer task: Initial finding');
  assert.deepEqual(sessionContext(restored, [first]).records, [first]);
});

test('multiple context sections retain independent acknowledgements with bounded validated state', () => {
  const session = { threadId: 'saved' };
  const first = { label: 'chat', text: 'A teammate reply' };
  const second = { label: 'workflow', text: 'A worker report' };
  const chat = sessionContext(session, [first]);
  const workflow = sessionContext(session, [second]);
  chat.commit('chat: A teammate reply');
  workflow.commit('workflow: A worker report');
  assert.deepEqual(sessionContext(session, [first, second]).records, []);
  for (let index = 0; index < 300; index++) {
    const record = { label: `task ${index}`, text: `Report ${index}` };
    sessionContext(session, [record]).commit(`${record.label}: ${record.text}`);
  }
  assert.equal(session.contextHashes.length, 256);
  assert.equal(validSessionContext(session), true);
  assert.equal(validSessionContext({ contextHashes: ['invalid'] }), false);
  assert.equal(validSessionContext({ contextHashes: {} }), false);
  assert.equal(validSessionContext({ contextThreadId: 42 }), false);
});

test('lead workflows send newly completed results on resume and keep independent review', async t => {
  const calls = [];
  let leadTurns = 0;
  const crew = setup(t, async (args, prompt, event) => {
    calls.push({ args, prompt });
    const name = prompt.match(/^You are ([^,]+)/)[1];
    event({ type: 'thread.started', thread_id: `workflow-${name}` });
    let reply;
    if (prompt.includes('PONGKAN_LEAD')) {
      leadTurns++;
      reply = {
        action: leadTurns === 1 ? 'delegate' : leadTurns === 2 ? 'review' : 'complete',
        member: leadTurns === 1 ? 'developer' : leadTurns === 2 ? 'reviewer' : null,
        instruction: 'Check the artifact',
        summary: 'LEAD_FINDING_' + leadTurns,
        boundary: null,
      };
    } else if (prompt.includes('PONGKAN_VERIFY')) {
      event({
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: 'inspect artifact',
          status: 'completed',
          exit_code: 0,
          aggregated_output: 'Artifact checked',
        },
      });
      reply = {
        outcome: 'met',
        summary: 'INDEPENDENT_REVIEW',
        criteria: [{ requirement: 'Deliver artifact', status: 'pass', evidence: 'Current artifact inspected' }],
      };
    } else reply = 'WORKER_FINDING';
    event({
      type: 'item.completed',
      item: { type: 'agent_message', text: typeof reply === 'string' ? reply : JSON.stringify(reply) },
    });
  });
  const flow = crew.workflows.start('Deliver artifact', { requiresWrite: true });
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.equal(flow.outcome, 'met');
  const leadCalls = calls.filter(call => call.prompt.includes('PONGKAN_LEAD'));
  assert.match(leadCalls[1].prompt, /WORKER_FINDING/);
  assert.doesNotMatch(leadCalls[2].prompt, /WORKER_FINDING/);
  assert.match(leadCalls[2].prompt, /INDEPENDENT_REVIEW/);
  assert.ok(calls.every(call => !call.prompt.startsWith('You are researcher')));
  validateState(crew.state);
});
