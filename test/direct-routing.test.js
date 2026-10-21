import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from '../src/crew.js';
import { execute } from '../src/commands.js';

function setup(t) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-direct-routing-'));
  const crew = new Crew(folder);
  crew.queue.pause();
  crew.queue.drain = () => {};
  crew.inputs.resolve = () => {
    throw new Error('Ordinary messages must not invoke classification');
  };
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  return { crew, view: 'chat', selected: 'developer' };
}

test('greetings, questions, ambiguity and action requests go directly to the selected teammate', async t => {
  const app = setup(t);
  for (const text of [
    'Good evening!',
    'How does routing work?',
    'You choose.',
    'Implement the agreed layout.',
    'Continue',
  ]) {
    await execute(app, text);
    const task = app.crew.state.tasks.at(-1);
    assert.ok(task, `No direct task for ${text}`);
    assert.equal(task.member, 'developer');
    assert.equal(task.text, text);
    assert.equal(task.readOnly, false);
  }
  assert.equal(app.crew.state.workflows.length, 0);
});

test('explicit recipients retain read-only permissions and shared context', async t => {
  const app = setup(t);
  await execute(app, '@reviewer Good evening!');
  const task = app.crew.state.tasks.at(-1);
  assert.ok(task);
  assert.equal(task.member, 'reviewer');
  assert.equal(task.readOnly, true);
  assert.ok(task.discussionId);
  assert.equal(app.crew.state.workflows.length, 0);
});

test('explicit task command still creates a workflow with independent review', async t => {
  const app = setup(t);
  await execute(app, '/task Implement the agreed layout');
  assert.equal(app.crew.state.workflows.length, 1);
  assert.equal(app.crew.state.tasks[0].kind, 'plan');
  assert.equal(app.crew.state.tasks[0].readOnly, true);
});

for (const view of ['group', 'activity']) {
  test(`${view} execution requests start a workflow from the saved proposal`, async t => {
    const app = setup(t);
    app.view = view;
    const discussion = app.crew.discussions.newConversation();
    discussion.messages.push({
      role: 'assistant',
      speaker: app.crew.leadName,
      text: 'Create three vertical clips with subtitles.',
    });
    app.crew.inputs.resolve = (input, context) => {
      assert.match(context.messages.at(-1).text, /three vertical clips/);
      assert.equal(input.text, 'Assign it to whom can access and do the final edit.');
      return {
        action: 'execute',
        target: 'developer',
        taskId: null,
        workflowId: null,
        goal: 'Create the proposed clips with a writable editor.',
        question: '',
        requiresWrite: true,
        teamDiscussion: false,
      };
    };
    await execute(app, 'Assign it to whom can access and do the final edit.');
    const flow = app.crew.state.workflows[0];
    assert.ok(flow, 'The request must start work rather than another lead reply');
    assert.equal(flow.sourceDiscussionId, discussion.id);
    assert.equal(flow.requiresWrite, true);
    assert.match(flow.text, /three vertical clips/);
    assert.equal(app.crew.state.tasks[0].kind, 'plan');
    assert.equal(app.crew.state.inputs[0].status, 'dispatched');
  });
}

test('crew-task requires saved discussion and carries its context into a workflow', async t => {
  const app = setup(t);
  assert.throws(() => execute(app, '/crew-task'), /No Crew Chat discussion/);
  const discussion = app.crew.discussions.newConversation();
  discussion.messages.push({ role: 'user', speaker: 'you', text: 'Preserve keyboard navigation.' });
  await execute(app, '/crew-task');
  const flow = app.crew.state.workflows[0];
  assert.ok(flow);
  assert.equal(flow.sourceDiscussionId, discussion.id);
  assert.match(flow.text, /Preserve keyboard navigation/);
  assert.equal(app.view, 'group');
  assert.equal(app.crew.state.tasks[0].kind, 'plan');
  assert.equal(app.crew.state.tasks[0].readOnly, true);
});

test('discuss schedules two read-only rounds and a lead summary without a workflow', async t => {
  const app = setup(t);
  await execute(app, '/discuss Plan keyboard navigation');
  const tasks = app.crew.state.tasks;
  assert.equal(tasks.length, app.crew.state.members.length * 2 + 1);
  assert.ok(tasks.every(task => task.readOnly && task.discussionId));
  assert.equal(tasks.at(-1).member, app.crew.leadName);
  assert.equal(tasks.at(-1).discussionSummary, true);
  assert.equal(app.crew.state.workflows.length, 0);
});

test('direct delivery resumes its scope while unrelated paused assignments stay paused', async t => {
  const app = setup(t);
  const unrelated = app.crew.queue.enqueue('reviewer', 'Review an unrelated change');
  const flow = app.crew.workflows.start('Unrelated workflow');
  await execute(app, 'Hello');
  const direct = app.crew.state.tasks.at(-1);
  assert.equal(direct.member, 'developer');
  assert.equal(direct.dispatchPaused, undefined);
  assert.equal(unrelated.dispatchPaused, true);
  assert.ok(app.crew.state.tasks.filter(task => task.workflowId === flow.id).every(task => task.dispatchPaused));
  assert.equal(app.crew.state.workflows.length, 1);
});
