import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from './helpers/crew-fixture.js';
import { execute, queuePrompt } from '../src/commands.js';
import { screen } from '../src/ui.js';

function setup(t) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-natural-'));
  const crew = new Crew(t, folder);
  crew.queue.pause();
  crew.queue.drain = () => {};
  const sessions = [crew];
  t.after(async () => {
    for (const session of sessions) await session.close();
    rmSync(folder, { recursive: true, force: true });
  });
  return {
    sessions,
    crew,
    selected: 'developer',
    view: 'group',
    send() {
      assert.fail('unexpected personal send');
    },
  };
}

for (const text of [
  'Okay, proceed with fixing all those issues. Test. Optimize.',
  'Can you build a staff access page?',
  'Go ahead with what we agreed.',
  'Please implement it now.',
  'Do it.',
  'Replace show and hide word with better wording like show summary/summaries and so on.',
  'I said replace and you didnt do anything why is that',
]) {
  test(`plain request executes: ${text}`, t => {
    const app = setup(t);
    execute(app, text);
    assert.equal(app.crew.state.workflows.length, 1);
    const flow = app.crew.state.workflows[0];
    assert.ok(flow.sourceDiscussionId);
    assert.match(flow.text, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(app.crew.queue.paused, false);
  });
}

for (const text of ['What did you guys update?', 'Status', 'Are you done?', 'Okay, what have you finished?']) {
  test(`status gets one lead reply: ${text}`, t => {
    const app = setup(t);
    execute(app, text);
    const tasks = app.crew.discussions.current.taskIds.map(id => app.crew.queue.get(id));
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].member, app.crew.leadName);
    assert.equal(tasks[0].readOnly, true);
  });
}

test('discussion replies must distinguish old reports from the latest request', t => {
  const app = setup(t);
  const discussion = app.crew.discussions.start('What did you update?', 'chief');
  const context = app.crew.discussions.context(app.crew.queue.get(discussion.taskIds[0]));
  assert.match(context, /Do not claim.*latest request.*historical/i);
  assert.match(context, /inspect.*current source/i);
});

for (const text of [
  'How would you implement access control?',
  'Can you explain how to fix this?',
  'What do you think about badges?',
  "Don't implement anything yet; discuss the options.",
]) {
  test(`plain question stays a discussion: ${text}`, t => {
    const app = setup(t);
    execute(app, text);
    assert.equal(app.crew.state.workflows.length, 0);
    assert.equal(app.crew.discussions.current.messages.at(-1).text, text);
    assert.equal(app.crew.queue.paused, false);
  });
}

test('go ahead during discussion waits for its final findings without another command', t => {
  const app = setup(t);
  const discussion = app.crew.discussions.start('Discuss staff access', 'developer');
  execute(app, 'Okay, implement the plan once you finish discussing.');
  assert.equal(app.crew.state.workflows.length, 0);
  const last = app.crew.queue.get(discussion.taskIds.at(-1));
  last.status = 'completed';
  last.result = 'Use section access badges.';
  app.crew.discussions.finish(last);
  assert.equal(app.crew.state.workflows.length, 1);
  assert.match(app.crew.state.workflows[0].text, /Use section access badges/);
});

test('execution request is visible immediately while earlier discussion replies finish', t => {
  const app = setup(t);
  const discussion = app.crew.discussions.start('What did you guys update?');
  const current = app.crew.queue.get(discussion.taskIds[0]);
  current.status = 'running';
  discussion.messages.push({ role: 'assistant', speaker: 'chief', text: 'The overview toggle is still proposed.' });
  const request = 'Okay, proceed hide show control for the summary at Kanban at your proposal.';
  app.scroll = 20;
  execute(app, request);
  assert.equal(discussion.pendingExecution, request);
  assert.equal(app.crew.state.workflows.length, 0);
  assert.equal(app.scroll, 0);
  const shown = screen(app.crew, 'developer', '', '', 140, 35, app.scroll, null, { view: app.view });
  assert.match(shown, /proceed hide show control/);
  assert.match(shown, /queued|after.*discussion/i);
  const restored = new Crew(t, app.crew.folder);
  app.sessions.push(restored);
  const afterRestart = screen(restored, 'developer', '', '', 140, 35, 0, null, { view: 'group' });
  assert.match(afterRestart, /proceed hide show control/);
});

function plannedFlow(app) {
  const discussion = app.crew.discussions.newConversation();
  const flow = app.crew.workflows.start('Build staff access', { sourceDiscussionId: discussion.id });
  const plan = app.crew.state.tasks.find(task => task.workflowId === flow.id);
  plan.status = 'completed';
  plan.result = JSON.stringify({ steps: [{ member: 'developer', task: 'Build badges' }], reviewer: 'reviewer' });
  app.crew.workflows.onFinish(plan);
  return flow;
}

for (const submit of [execute, queuePrompt]) {
  test(`directed wording correction queues for the writer (${submit.name})`, t => {
    const app = setup(t);
    const flow = plannedFlow(app);
    const writer = app.crew.state.tasks.find(task => task.workflowId === flow.id && task.kind === 'revision');
    writer.status = 'running';
    const request = 'Replace Show and Hide word with better wording like Show Summary/Summaries and so on.';
    submit(app, `@developer ${request}`);
    assert.equal(writer.steering?.at(-1).text, request);
    assert.equal(app.crew.discussions.current.messages.length, 0);
    const visible = screen(app.crew, 'developer', '', '', 140, 40, 0, null, { view: 'group' });
    assert.match(visible, /queued correction/i);
    assert.match(visible, /Show Summary\/Summaries/);
  });
}

test('directed questions stay read-only and invalid mentions do not resume work', t => {
  const app = setup(t);
  plannedFlow(app);
  execute(app, '@Developer What wording do you suggest?');
  const discussion = app.crew.discussions.current;
  assert.equal(discussion.taskIds.length, 1);
  assert.equal(app.crew.queue.get(discussion.taskIds[0]).readOnly, true);
  assert.equal(app.crew.queue.get(discussion.taskIds[0]).member, 'developer');
  app.crew.queue.pause();
  assert.throws(() => queuePrompt(app, '@missing Replace the label'), /unknown/i);
  assert.equal(app.crew.queue.paused, true);
});

test('directed edit after the writer finished queues execution instead of read-only chat', t => {
  const app = setup(t);
  const flow = plannedFlow(app);
  for (const task of app.crew.state.tasks.filter(task => task.workflowId === flow.id && task.member === 'developer'))
    task.status = 'completed';
  execute(app, '@developer Replace the toggle labels with Show summary and Hide summary.');
  assert.equal(app.crew.state.workflows.length, 2);
  assert.match(app.crew.state.workflows.at(-1).text, /addressed to developer/);
  assert.equal(app.crew.discussions.current.taskIds.length, 0);
});

test('directed edit during discussion waits for final findings and survives restart', t => {
  const app = setup(t);
  const discussion = app.crew.discussions.start('Discuss the toggle wording');
  queuePrompt(app, '@developer Replace the toggle labels with Show summary and Hide summary.');
  assert.match(discussion.pendingExecution, /addressed to developer/);
  assert.equal(app.crew.state.workflows.length, 0);
  const restored = new Crew(t, app.crew.folder);
  app.sessions.push(restored);
  assert.match(restored.discussions.current.pendingExecution, /Show summary and Hide summary/);
});

test('directed clarification answer unblocks the addressed writer instead of steering it', t => {
  const app = setup(t);
  const flow = plannedFlow(app);
  const writer = app.crew.state.tasks.find(task => task.workflowId === flow.id && task.kind === 'work');
  writer.status = 'waiting';
  writer.question = 'Which labels should I use?';
  execute(app, '@developer Use Show summary and Hide summary.');
  assert.equal(writer.status, 'queued');
  assert.equal(writer.answers.at(-1).answer, 'Use Show summary and Hide summary.');
  assert.equal(writer.steering, undefined);
});

test('new Crew Chat message stays visible below a previous workflow', t => {
  const app = setup(t);
  const flow = plannedFlow(app);
  flow.createdAt = 1000;
  flow.status = 'completed';
  for (const task of app.crew.state.tasks.filter(task => task.workflowId === flow.id)) {
    task.status = 'completed';
    task.createdAt = 1000;
    task.result = 'Previous workflow output.\n'.repeat(50);
  }
  const request =
    'Okay. Thanks everyone. Now what I want is last for the Kanban page, add hide and show of overview section.';
  execute(app, request);
  const visible = screen(app.crew, 'developer', '', '', 140, 35, 0, null, { view: 'group' });
  assert.match(visible, /Now what I want/);
  const history = screen(app.crew, 'developer', '', '', 140, 800, 0, null, { view: 'group' });
  assert.ok(history.indexOf('Previous workflow output') < history.indexOf('Now what I want'));
  const discussion = app.crew.discussions.current;
  const reply = app.crew.queue.get(discussion.taskIds[0]);
  reply.status = 'completed';
  reply.result = 'I will inspect the Kanban overview controls.';
  app.crew.discussions.finish(reply);
  const updated = screen(app.crew, 'developer', '', '', 140, 35, 0, null, { view: 'group' });
  assert.match(updated, /Now what I want/);
  assert.match(updated, /inspect the Kanban overview/);
});

test('continue resumes failed step and preserves completed work and task IDs', t => {
  const app = setup(t);
  const flow = plannedFlow(app);
  const tasks = app.crew.state.tasks.filter(task => task.workflowId === flow.id);
  const kickoff = tasks.find(task => task.exchange === 'kickoff');
  kickoff.status = 'completed';
  kickoff.result = 'Preserve focus.';
  const work = tasks.find(task => task.kind === 'work');
  work.status = 'failed';
  work.result = 'Started badges.';
  work.error = 'Selected model is at capacity.';
  app.crew.workflows.fail(flow.id, work.error);
  execute(app, 'You suddenly stopped. Proceed with what you are doing.');
  assert.equal(app.crew.state.workflows.length, 1);
  assert.equal(kickoff.status, 'completed');
  assert.equal(work.status, 'queued');
  assert.equal(work.result, 'Started badges.');
  assert.equal(work.error, undefined);
  assert.ok(tasks.filter(task => task !== kickoff && task.kind !== 'plan').every(task => task.status === 'queued'));
  assert.equal(app.crew.queue.paused, false);
});

test('active corrections reach the writer while questions stay read-only', t => {
  const app = setup(t);
  const flow = plannedFlow(app);
  execute(app, 'Use shared queues and preserve the existing owner permissions.');
  const writer = app.crew.state.tasks.find(task => task.workflowId === flow.id && task.kind === 'work');
  assert.equal(writer.steering.at(-1).text, 'Use shared queues and preserve the existing owner permissions.');
  assert.equal(app.crew.state.workflows.length, 1);
  execute(app, 'What have you finished so far?');
  assert.equal(writer.steering.length, 1);
  assert.equal(app.crew.discussions.current.messages.at(-1).text, 'What have you finished so far?');
});

test('plain answer unblocks the waiting task in this conversation', t => {
  const app = setup(t);
  const flow = plannedFlow(app);
  const work = app.crew.state.tasks.find(task => task.workflowId === flow.id && task.kind === 'work');
  work.status = 'waiting';
  work.question = 'Shared or individual queues?';
  execute(app, 'Use shared queues.');
  assert.equal(work.status, 'queued');
  assert.equal(work.answers.at(-1).answer, 'Use shared queues.');
});

for (const status of ['reviewing', 'failed']) {
  test(`new implementation after writer steps finish starts a new workflow (${status})`, t => {
    const app = setup(t);
    const flow = plannedFlow(app);
    flow.status = status;
    for (const task of app.crew.state.tasks.filter(task => task.workflowId === flow.id)) {
      task.status = task.member === 'reviewer' ? (status === 'failed' ? 'failed' : 'waiting') : 'completed';
      if (task.status === 'waiting') task.question = 'Confirm migrations were applied.';
    }
    const request = 'Okay, proceed hide show control for the summary at Kanban at your proposal.';
    execute(app, request);
    assert.equal(app.crew.state.workflows.length, 2);
    assert.match(app.crew.state.workflows.at(-1).text, /hide show control/);
    assert.equal(flow.steering, undefined);
    assert.ok(app.crew.state.tasks.filter(task => task.workflowId === flow.id).every(task => !task.answers));
  });
}

test('continue does not resume another group or repeat a completed workflow', t => {
  const app = setup(t);
  app.crew.conversations.create('group', 'First');
  const flow = plannedFlow(app);
  app.crew.workflows.fail(flow.id, 'capacity');
  app.crew.conversations.create('group', 'Second');
  execute(app, 'Continue.');
  assert.equal(flow.status, 'failed');
  assert.equal(app.crew.state.workflows.length, 1);
  assert.match(app.notice, /nothing|no unfinished/i);
});

test('plain Enter does not wake paused work from unrelated conversations', t => {
  const app = setup(t);
  const other = app.crew.queue.enqueue('researcher', 'An unrelated private assignment');
  execute(app, 'Build the access page');
  assert.equal(other.dispatchPaused, true);
  const current = app.crew.state.tasks.find(task => task.workflowId === app.crew.state.workflows.at(-1).id);
  assert.notEqual(current.dispatchPaused, true);
  app.crew.queue.resume();
  assert.notEqual(other.dispatchPaused, true);
});

test('workflow automatically resumes only unfinished turns after a real runner failure', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-natural-recovery-'));
  const calls = [];
  let crew,
    failed = false;
  crew = new Crew(t, folder, {
    runner: async (args, prompt, event) => {
      const task = crew.state.tasks.find(task => task.status === 'running');
      calls.push(task.id);
      if (task.kind === 'work' && !failed) {
        failed = true;
        event({ type: 'item.completed', item: { type: 'agent_message', text: 'Partial implementation, preserved.' } });
        event({ type: 'turn.failed', error: { message: 'Selected model is at capacity.' } });
        return;
      }
      if (task.kind === 'work') assert.match(prompt, /Partial implementation, preserved/);
      event({
        type: 'item.completed',
        item: {
          type: 'agent_message',
          text: task.recoveryFor
            ? JSON.stringify({
                action: 'retry',
                member: 'developer',
                instruction: 'Retry the unfinished work after the temporary model capacity failure.',
              })
            : task.kind === 'plan'
              ? JSON.stringify({ steps: [{ member: 'developer', task: 'Build badges' }], reviewer: 'reviewer' })
              : 'Verified.',
        },
      });
    },
  });
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const app = { crew, selected: 'developer', view: 'group' };
  execute(app, 'Build staff badges');
  const flow = crew.state.workflows[0];
  await crew.workflows.settled(flow.id);
  const completed = crew.state.tasks.filter(task => task.workflowId === flow.id && task.status === 'completed');
  assert.equal(flow.status, 'completed');
  assert.equal(crew.state.workflows.length, 1);
  assert.ok(
    completed.filter(task => task.kind !== 'work').every(task => calls.filter(id => id === task.id).length === 1),
  );
  assert.equal(calls.filter(id => id === crew.state.tasks.find(task => task.kind === 'work').id).length, 2);
});

test('plain messages in personal chat start dispatch without resuming another chat', t => {
  const app = setup(t);
  app.view = 'chat';
  app.send = (name, text) => app.crew.queue.enqueue(name, text);
  const other = app.crew.queue.enqueue('researcher', 'Other work');
  execute(app, 'Build the page');
  const work = app.crew.state.tasks.at(-1);
  assert.equal(work.member, 'developer');
  assert.equal(app.crew.queue.paused, false);
  assert.equal(other.dispatchPaused, true);
  execute(app, 'Use orange buttons');
  assert.equal(work.steering.at(-1).text, 'Use orange buttons');
  assert.equal(app.crew.state.tasks.length, 2);
});

test('continue after restart preserves completed workflow steps', async t => {
  const app = setup(t);
  const flow = plannedFlow(app);
  const kickoff = app.crew.state.tasks.find(task => task.exchange === 'kickoff');
  kickoff.status = 'completed';
  kickoff.result = 'Briefed.';
  app.crew.save();
  await app.crew.close();
  const restored = new Crew(t, app.crew.folder);
  restored.queue.drain = () => {};
  app.sessions.push(restored);
  execute({ crew: restored, view: 'group', selected: 'developer' }, 'Continue where you stopped.');
  assert.equal(restored.state.workflows.length, 1);
  assert.equal(restored.workflows.get(flow.id).status, 'working');
  assert.equal(restored.queue.get(kickoff.id).status, 'completed');
  assert.ok(
    restored.state.tasks
      .filter(task => task.kind !== 'plan' && task.id !== kickoff.id)
      .every(task => task.status === 'queued'),
  );
});

test('queued execution survives restart and waits for the resumed discussion', async t => {
  const app = setup(t);
  const discussion = app.crew.discussions.start('Discuss badges', 'developer');
  execute(app, 'Go ahead once you finish');
  await app.crew.close();
  const restored = new Crew(t, app.crew.folder);
  restored.queue.drain = () => {};
  app.sessions.push(restored);
  execute({ crew: restored, view: 'group', selected: 'developer' }, 'Continue');
  assert.equal(restored.state.workflows.length, 0);
  const last = restored.queue.get(discussion.taskIds.at(-1));
  last.status = 'completed';
  last.result = 'Use badges.';
  restored.discussions.finish(last);
  assert.equal(restored.state.workflows.length, 1);
  assert.match(restored.state.workflows[0].text, /Go ahead once you finish/);
  assert.equal(restored.discussions.current.pendingExecution, undefined);
});

test('a plain yes accepts the discussed plan and does not repeat completed work', t => {
  const app = setup(t);
  const discussion = app.crew.discussions.newConversation();
  discussion.messages.push({ role: 'assistant', speaker: 'chief', text: 'We can build section access badges.' });
  execute(app, 'Yes.');
  assert.equal(app.crew.state.workflows.length, 1);
  const flow = app.crew.state.workflows[0];
  flow.status = 'completed';
  execute(app, 'Okay.');
  assert.equal(app.crew.state.workflows.length, 1);
});

test('status questions and prefixed questions never become workflow corrections', t => {
  const app = setup(t);
  const flow = plannedFlow(app);
  for (const text of [
    'Status',
    'Are you done?',
    'Okay, what have you finished?',
    'Can you explain the remaining issues?',
  ]) {
    execute(app, text);
    assert.equal(flow.steering, undefined);
  }
});
