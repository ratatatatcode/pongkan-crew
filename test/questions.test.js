import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from './helpers/legacy-crew.js';
import { execute } from '../src/commands.js';
import { screen } from '../src/ui.js';
import { validateState } from '../src/state.js';

const reply = (event, text) => event({ type: 'item.completed', item: { type: 'agent_message', text } });
async function until(check) {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await new Promise(r => setTimeout(r, 5));
  }
  throw new Error('Timed out');
}
function setup(t, runner) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-questions-'));
  const crew = new Crew(folder, { runner });
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  return crew;
}
test('question holds dependent work and answer resumes the same task', async t => {
  let calls = 0;
  const crew = setup(t, async (args, prompt, event) => {
    calls++;
    if (calls === 1) reply(event, 'PONGKAN_QUESTION: Which layout?');
    else {
      assert.match(prompt, /Use a list/);
      reply(event, 'Done');
    }
  });
  const task = crew.queue.enqueue('developer', 'Build');
  const next = crew.queue.enqueue('reviewer', 'Review', { dependsOn: task.id });
  await until(() => task.status === 'waiting');
  assert.equal(calls, 1);
  assert.equal(next.status, 'queued');
  assert.equal(task.question, 'Which layout?');
  assert.match(screen(crew, 'developer', '', '', 120, 40), /WAITING FOR YOUR ANSWER/);
  crew.queue.cancel(next.id);
  crew.queue.answer(task.id, 'Use a list');
  await crew.queue.settled(task.id);
  assert.equal(task.status, 'completed');
  assert.equal(calls, 2);
});
test('workflow continues through review and summary after clarification', async t => {
  let developerTurns = 0;
  const crew = setup(t, async (args, prompt, event) => {
    if (prompt.includes('PONGKAN_PLAN'))
      reply(event, JSON.stringify({ steps: [{ member: 'developer', task: 'Build' }], reviewer: 'reviewer' }));
    else if (prompt.startsWith('You are developer'))
      reply(event, ++developerTurns === 1 ? 'PONGKAN_QUESTION: Which layout?' : 'Implemented list');
    else reply(event, 'Verified');
  });
  const flow = crew.workflows.start('Build');
  await until(() => crew.state.tasks.some(task => task.status === 'waiting'));
  const task = crew.state.tasks.find(task => task.status === 'waiting');
  assert.equal(flow.status, 'working');
  execute({ crew }, `/answer ${task.id} List`);
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.equal(developerTurns, 2);
});
test('direct waiting task survives restart, respects pause, and can be cancelled', async t => {
  const crew = setup(t, async (args, prompt, event) => reply(event, 'PONGKAN_QUESTION: Layout?'));
  const task = crew.queue.enqueue('developer', 'Build');
  await until(() => task.status === 'waiting');
  await crew.close();
  const restored = new Crew(crew.folder, { runner: async (args, prompt, event) => reply(event, 'Done') });
  // Close the restored instance before setup's hook removes its workspace.

  assert.equal(restored.queue.get(task.id).question, 'Layout?');
  restored.queue.pause();
  restored.queue.answer(task.id, 'List');
  assert.equal(restored.queue.get(task.id).status, 'queued');
  restored.queue.cancel(task.id);
  assert.equal(restored.queue.get(task.id).status, 'cancelled');
  const state = structuredClone(restored.state);
  state.questionsEnabled = 'yes';
  assert.throws(() => validateState(state), /Invalid crew state/);
  await restored.close();
});
test('questions off is saved and forbids waiting on optional choices', async t => {
  const crew = setup(t, async (args, prompt, event) => {
    assert.match(prompt, /Questions are OFF/);
    assert.match(prompt, /command-specific escalation/);
    reply(event, 'PONGKAN_QUESTION: Color?');
  });
  execute({ crew }, '/questions off');
  assert.equal(new Crew(crew.folder).state.questionsEnabled, false);
  const task = crew.queue.enqueue('developer', 'Build');
  await crew.queue.settled(task.id);
  assert.equal(task.status, 'failed');
});
test('explicit blocker fails workflow and cancels dependent assignments', async t => {
  const crew = setup(t, async (args, prompt, event) => {
    if (prompt.includes('PONGKAN_PLAN'))
      reply(event, JSON.stringify({ steps: [{ member: 'developer', task: 'Build' }], reviewer: 'reviewer' }));
    else reply(event, 'PONGKAN_BLOCKED: Approval denied for npm');
  });
  const flow = crew.workflows.start('Build');
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'failed');
  assert.match(flow.error, /Approval denied/);
  assert.ok(crew.state.tasks.some(task => task.kind === 'review' && task.status === 'cancelled'));
});
