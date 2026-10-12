import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from '../src/crew.js';
import { execute } from '../src/commands.js';
import { screen } from '../src/ui.js';
import { sourceChanged } from '../src/source-version.js';
import { validateState } from '../src/state.js';
import { installDirectSubmit } from './helpers/direct-submit.js';

function setup(t, reply, { direct = false } = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-semantic-'));
  const prompts = [];
  const crew = new Crew(folder, {
    runner: async (args, prompt, event) => {
      prompts.push({ args, prompt });
      const response = typeof reply === 'function' ? await reply(prompt) : reply;
      event({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(response) } });
    },
  });
  crew.queue.pause();
  if (direct) installDirectSubmit(crew);
  else crew.inputs.submit = crew.inputs.submitInterpreted.bind(crew.inputs);
  crew.queue.drain = () => {};
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  return { crew, prompts, view: 'group', selected: 'developer' };
}
const decision = (action, more = {}) => ({
  action,
  target: null,
  taskId: null,
  workflowId: null,
  goal: '',
  question: '',
  requiresWrite: false,
  teamDiscussion: false,
  ...more,
});

test('direct addressed edits bypass classification, planning, and read-only discussion', async t => {
  const app = setup(t, null, { direct: true });
  await execute(app, '@developer Replace hide/show with Hide summary / Show summary.');
  assert.equal(app.prompts.length, 0);
  assert.equal(app.crew.state.workflows.length, 0);
  assert.equal(app.crew.state.tasks.length, 1);
  const task = app.crew.state.tasks[0];
  assert.equal(task.member, 'developer');
  assert.equal(task.readOnly, false);
  assert.match(task.text, /Replace hide\/show/);
  const context = app.crew.discussions.context(task);
  assert.doesNotMatch(context, /Discuss only|not permission to execute/);
  assert.match(context, /Carry out authorized work/);
  validateState(JSON.parse(readFileSync(app.crew.file, 'utf8')));
});

test('plain Crew Chat goes directly to Chief and private chat to its selected member', async t => {
  const app = setup(t, null, { direct: true });
  await execute(app, 'Okay, proceed.');
  assert.equal(app.crew.state.tasks[0].member, 'chief');
  app.view = 'chat';
  await execute(app, 'Commit and push.');
  assert.equal(app.crew.state.tasks[1].member, 'developer');
  assert.equal(app.prompts.length, 0);
});

test('direct shared follow-ups keep ordering and reviewer access remains read-only', async t => {
  const app = setup(t, null, { direct: true });
  await execute(app, '@developer Change the label.');
  await execute(app, '@developer Okay, proceed.');
  await execute(app, '@reviewer Check the label.');
  const [first, second, third] = app.crew.state.tasks;
  assert.equal(second.dependsOn, first.id);
  assert.equal(third.dependsOn, second.id);
  assert.equal(third.readOnly, true);
  assert.equal(app.crew.discussions.current.messages.filter(message => message.role === 'user').length, 3);
  const shown = screen(app.crew, 'developer', '', '', 140, 100, 0, null, { view: 'group' });
  assert.match(shown, /Okay, proceed/);
  assert.match(shown, /queued/i);
});

test('a failed direct turn does not cancel the next saved user message', async t => {
  const app = setup(t, null, { direct: true });
  await execute(app, '@developer First request.');
  await execute(app, '@developer Follow-up request.');
  const [first, second] = app.crew.state.tasks;
  first.status = 'failed';
  first.error = 'Temporary worker failure';
  app.crew.discussions.finish(first);
  assert.equal(second.status, 'queued');
  assert.equal(app.crew.discussions.current.status, 'working');
});

test('a direct Developer turn reaches the worker sandbox in exactly one model call', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-direct-'));
  const calls = [];
  const crew = new Crew(folder, {
    runner: async (args, prompt, event) => {
      calls.push({ args, prompt });
      assert.equal(args[args.indexOf('-s') + 1], 'workspace-write');
      assert.doesNotMatch(prompt, /PONGKAN_ROUTE|Discuss only/);
      writeFileSync(join(folder, 'label.txt'), 'Show summary');
      event({ type: 'item.completed', item: { type: 'agent_message', text: 'Changed the label.' } });
    },
  });
  installDirectSubmit(crew);
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const task = await execute({ crew, view: 'group', selected: 'developer' }, '@developer Update label.txt.');
  await crew.queue.settled(task.id);
  assert.equal(task.status, 'completed', task.error);
  assert.equal(calls.length, 1);
  assert.equal(readFileSync(join(folder, 'label.txt'), 'utf8'), 'Show summary');
  assert.equal(crew.state.workflows.length, 0);
});

for (const prefix of ['', '@developer ']) {
  test(`stale clarification routing is reinterpreted once for ${prefix || 'plain input'}`, async t => {
    let calls = 0;
    const app = setup(t, () =>
      ++calls === 1
        ? decision('answer')
        : decision('execute', { goal: 'Use Show summary / Hide summary.', requiresWrite: true }),
    );
    await execute(app, `${prefix}replace hide/show with hide summary and show summary at kanban overview`);
    assert.equal(app.crew.state.inputs[0].status, 'dispatched');
    assert.equal(app.crew.state.workflows.length, 1);
    assert.equal(calls, 2);
    assert.match(app.prompts[1].prompt, /routingError/);
  });
}

test('repeated invalid clarification decisions stop after one retry without dispatch', async t => {
  const app = setup(t, decision('answer'));
  await execute(app, 'Replace the toggle labels.');
  assert.equal(app.prompts.length, 2);
  assert.equal(app.crew.state.inputs[0].status, 'blocked');
  assert.equal(app.crew.state.tasks.length, 0);
});

test('unfamiliar phrasing uses one schema-constrained decision and a writable workflow', async t => {
  const app = setup(
    t,
    decision('execute', { goal: 'Label the toggle Show summary / Hide summary.', requiresWrite: true }),
  );
  await execute(app, 'Those two labels could be clearer. Summary is what they control; take care of that.');
  assert.equal(app.prompts.length, 1);
  assert.match(app.prompts[0].prompt, /PONGKAN_ROUTE/);
  assert.ok(app.prompts[0].args.includes('--output-schema'));
  assert.equal(app.prompts[0].args[app.prompts[0].args.indexOf('-s') + 1], 'read-only');
  assert.equal(app.crew.state.workflows.length, 1);
  assert.equal(app.crew.state.workflows[0].requiresWrite, true);
  assert.equal(app.crew.state.tasks.filter(task => task.discussionId).length, 0);
  assert.equal(app.crew.state.inputs[0].status, 'dispatched');
});

test('commit and push routes to writable execution despite the classifier sandbox', async t => {
  const app = setup(t, decision('execute', { target: 'developer', goal: 'Commit and push.', requiresWrite: true }));
  await execute(app, '@developer Commit and push.');
  assert.equal(app.crew.state.inputs[0].status, 'dispatched');
  assert.equal(app.crew.state.workflows[0].requiresWrite, true);
  assert.match(app.prompts[0].prompt, /Your read-only sandbox applies ONLY to this classification call/);
  assert.match(app.prompts[0].prompt, /Never claim the project is read-only/);
  assert.match(app.prompts[0].prompt, /repository mutations/i);
});

test('Crew Chat shows the original message once without internal dispatch instructions', async t => {
  const app = setup(
    t,
    decision('execute', { goal: 'Replace the toggle labels with Show summary and Hide summary.', requiresWrite: true }),
  );
  const text = 'I said replace and you didnt do anything why is that';
  await execute(app, text);
  const shown = screen(app.crew, 'developer', '', '', 140, 100, 0, null, { view: 'group' });
  assert.equal(shown.split(text).length - 1, 1);
  assert.doesNotMatch(shown, /Resolved intent|User request addressed|must remain within|Request [a-f0-9]{8}/);
  assert.match(shown, /Preparing the plan/i);
});

test('classification failures stay visible and never fall back to nine discussion turns', async t => {
  const app = setup(t, { action: 'invented' });
  await execute(app, 'Take care of the wording.');
  assert.equal(app.crew.state.workflows.length, 0);
  assert.equal(app.crew.state.tasks.length, 0);
  assert.equal(app.crew.state.inputs[0].status, 'blocked');
  assert.match(screen(app.crew, 'developer', '', '', 140, 35, 0, null, { view: 'group' }), /Take care of the wording/);
});

test('ambiguous approval asks one question without dispatching the crew', async t => {
  const app = setup(t, decision('clarify', { question: 'Apply the wording change or run the browser check?' }));
  await execute(app, 'That one, please.');
  assert.equal(app.crew.state.tasks.length, 0);
  assert.match(app.notice, /wording change or run/);
});

test('routing context is bounded and includes latest proposal, access, and pending work', async t => {
  const app = setup(t, decision('status'));
  const chat = app.crew.discussions.newConversation();
  for (let n = 0; n < 100; n++) chat.messages.push({ role: 'assistant', speaker: 'chief', text: 'old '.repeat(1000) });
  chat.messages.push({ role: 'assistant', speaker: 'chief', text: 'Latest proposal: Show summary and Hide summary.' });
  await execute(app, 'Where are we?');
  assert.ok(app.prompts[0].prompt.length < 18000);
  assert.match(app.prompts[0].prompt, /Latest proposal/);
  assert.match(app.prompts[0].prompt, /developer/);
  assert.equal(app.crew.discussions.current.taskIds.length, 1);
});

test('input text is saved and visible before the model responds', async t => {
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  t.after(() => release());
  const app = setup(t, async () => {
    await gate;
    return decision('status');
  });
  const pending = execute(app, 'Tell me where the wording change stands.');
  const saved = JSON.parse(readFileSync(app.crew.file, 'utf8'));
  assert.equal(saved.inputs[0].text, 'Tell me where the wording change stands.');
  assert.match(screen(app.crew, 'developer', '', '', 140, 35, 0, null, { view: 'group' }), /wording change stands/);
  release();
  await pending;
});

test('an edit plan cannot hand implementation only to a read-only reviewer', t => {
  const app = setup(t, decision('status'));
  const flow = app.crew.workflows.start('Change the labels', { requiresWrite: true });
  const plan = app.crew.state.tasks.find(task => task.workflowId === flow.id);
  plan.status = 'completed';
  plan.result = JSON.stringify({ steps: [{ member: 'reviewer', task: 'Change the labels' }], reviewer: 'reviewer' });
  assert.throws(() => app.crew.workflows.onFinish(plan), /writable implementer/);
  assert.equal(app.crew.state.tasks.length, 1);
});

test('verification does not mark a requested edit met without independent inspection evidence', t => {
  const app = setup(t, decision('status'));
  const flow = app.crew.workflows.start('Use Show summary and Hide summary', { requiresWrite: true });
  const plan = app.crew.state.tasks.find(task => task.workflowId === flow.id);
  plan.status = 'completed';
  plan.result = JSON.stringify({ steps: [{ member: 'developer', task: 'Change the labels' }], reviewer: 'reviewer' });
  app.crew.workflows.onFinish(plan);
  const review = app.crew.state.tasks.find(task => task.workflowId === flow.id && task.kind === 'review');
  assert.ok(review.schema);
  review.status = 'completed';
  review.result = JSON.stringify({
    outcome: 'met',
    criteria: [{ requirement: 'Exact wording', status: 'pass', evidence: 'Developer said it was done' }],
    summary: 'Looks done.',
  });
  app.crew.workflows.onFinish(review);
  assert.equal(flow.outcome, 'unverified');
  assert.match(review.result, /independent inspection/);
});

test('a delayed decision cannot steer another conversation after switching tabs', async t => {
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  t.after(() => release());
  const app = setup(t, async () => {
    await gate;
    return decision('execute', { requiresWrite: true, goal: 'Change the first conversation labels' });
  });
  const first = app.crew.conversations.create('group', 'First');
  const pending = execute(app, 'Take care of those labels.');
  const second = app.crew.conversations.create('group', 'Second');
  release();
  await pending;
  assert.equal(app.crew.state.workflows[0].sourceConversationId, first.id);
  assert.equal(app.crew.state.activeGroupConversation, second.id);
});

test('two execution requests during a discussion are preserved instead of overwritten', async t => {
  const app = setup(t, decision('execute', { requiresWrite: true }));
  const chat = app.crew.discussions.start('Discuss the proposed UI', 'chief');
  await execute(app, 'The summary labels need clearer wording.');
  await execute(app, 'The same control also needs keyboard focus styling.');
  assert.match(chat.pendingExecution, /clearer wording/);
  assert.match(chat.pendingExecution, /keyboard focus/);
});

test('cross-conversation assignment IDs from the router are rejected', async t => {
  const app = setup(t, decision('answer', { taskId: 'deadbeef' }));
  await execute(app, 'Use summary.');
  assert.equal(app.crew.state.inputs[0].status, 'blocked');
  assert.equal(app.crew.state.tasks.length, 0);
});

test('runtime source changes are detected without restarting or changing saved work', t => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-source-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  writeFileSync(join(folder, 'app.js'), 'old');
  const changed = sourceChanged(folder);
  assert.equal(changed(), false);
  writeFileSync(join(folder, 'app.js'), 'new');
  assert.equal(changed(), true);
});

test('an implementation is verified against actual current source before reporting met', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-verified-'));
  const file = join(folder, 'toggle.txt');
  let crew;
  crew = new Crew(folder, {
    runner: async (args, prompt, event) => {
      let response;
      if (prompt.startsWith('PONGKAN_ROUTE'))
        response = decision('execute', {
          goal: 'Use Show summary and Hide summary for the toggle labels.',
          requiresWrite: true,
        });
      else if (prompt.includes('PONGKAN_PLAN'))
        response = { steps: [{ member: 'developer', task: 'Change toggle.txt labels' }], reviewer: 'reviewer' };
      else if (prompt.includes('PONGKAN_VERIFY')) {
        assert.equal(readFileSync(file, 'utf8'), 'Show summary\nHide summary');
        event({
          type: 'item.completed',
          item: { type: 'command_execution', command: 'read toggle.txt', exit_code: 0 },
        });
        response = {
          outcome: 'met',
          criteria: [
            {
              requirement: 'Both summary labels',
              status: 'pass',
              evidence: 'Read toggle.txt: Show summary and Hide summary.',
            },
          ],
          summary: 'Requested labels verified in current source.',
        };
      } else if (prompt.includes('Assignment from')) {
        writeFileSync(file, 'Show summary\nHide summary');
        response = 'Changed both toggle labels.';
      } else response = 'Checked the requested labels.';
      event({
        type: 'item.completed',
        item: { type: 'agent_message', text: typeof response === 'string' ? response : JSON.stringify(response) },
      });
    },
  });
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  crew.inputs.submit = crew.inputs.submitInterpreted.bind(crew.inputs);
  await execute(
    { crew, view: 'group', selected: 'developer' },
    'Those labels should name the summary. Take care of it.',
  );
  const flow = crew.state.workflows[0];
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.equal(flow.outcome, 'met');
  assert.match(flow.result, /Requested outcome: met/);
});

test('a failed requirement stays needs_work after all turns finish', t => {
  const app = setup(t, decision('status'));
  const flow = app.crew.workflows.start('Change both labels', { requiresWrite: true });
  const plan = app.crew.state.tasks.find(task => task.workflowId === flow.id);
  plan.status = 'completed';
  plan.result = JSON.stringify({ steps: [{ member: 'developer', task: 'Change labels' }], reviewer: 'reviewer' });
  app.crew.workflows.onFinish(plan);
  const review = app.crew.state.tasks.find(task => task.kind === 'review');
  review.status = 'completed';
  review.result = JSON.stringify({
    outcome: 'met',
    criteria: [{ requirement: 'Hide summary label', status: 'fail', evidence: 'Still says Hide.' }],
    summary: 'One label is missing.',
  });
  app.crew.workflows.onFinish(review);
  const summary = app.crew.state.tasks.find(task => task.kind === 'summary');
  summary.status = 'completed';
  summary.result = 'Finished.';
  app.crew.workflows.onFinish(summary);
  assert.equal(flow.outcome, 'needs_work');
  assert.match(flow.result, /^Requested outcome: needs_work/);
});

test('missing writable access blocks execution and preserves the request', async t => {
  const app = setup(t, decision('execute', { requiresWrite: true }));
  for (const member of app.crew.state.members) member.writable = false;
  await execute(app, 'Take care of the labels.');
  assert.equal(app.crew.state.inputs[0].status, 'blocked');
  assert.equal(app.crew.state.tasks.length, 0);
});

test('saved input metadata is validated on reload', async t => {
  const app = setup(t, decision('status'));
  await execute(app, 'Where are we?');
  const state = structuredClone(app.crew.state);
  state.inputs[0].taskId = '../escape';
  assert.throws(() => validateState(state), /Invalid crew state/);
});

test('restart notices remain visible after another notice is set', t => {
  const app = setup(t, decision('status'));
  app.crew.codeChanged = true;
  assert.match(
    screen(app.crew, 'developer', '', 'Message saved', 140, 35, 0, null, { view: 'group' }),
    /Restart to load the update/,
  );
});

test('restart recovers a request already dispatched before its final routing save', async t => {
  const app = setup(t, decision('execute', { requiresWrite: true }));
  await execute(app, 'Take care of the summary labels.');
  const input = app.crew.state.inputs[0];
  const flowId = input.workflowId;
  input.status = 'routing';
  delete input.workflowId;
  app.crew.save();
  const restored = new Crew(app.crew.folder, { runner: async () => {} });
  assert.equal(restored.state.inputs[0].status, 'dispatched');
  assert.equal(restored.state.inputs[0].workflowId, flowId);
  assert.equal(restored.state.workflows.length, 1);
  await restored.close();
});

test('stop all prevents a delayed routing decision from starting work afterward', async t => {
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  t.after(() => release());
  const app = setup(t, async () => {
    await gate;
    return decision('execute', { requiresWrite: true });
  });
  const pending = execute(app, 'Take care of those labels.');
  execute(app, '/stop all');
  release();
  await pending;
  assert.equal(app.crew.state.workflows.length, 0);
  assert.equal(app.crew.state.inputs[0].status, 'interrupted');
});

test('a correction becomes new implementation if its writer finishes during interpretation', async t => {
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  t.after(() => release());
  let writer, flow;
  const app = setup(t, async () => {
    await gate;
    return decision('correct', { taskId: writer.id, workflowId: flow.id, target: 'developer', requiresWrite: true });
  });
  const chat = app.crew.discussions.newConversation();
  flow = app.crew.workflows.start('Build the toggle', { sourceDiscussionId: chat.id });
  const plan = app.crew.state.tasks.find(task => task.workflowId === flow.id);
  plan.status = 'completed';
  plan.result = JSON.stringify({ steps: [{ member: 'developer', task: 'Build toggle' }], reviewer: 'reviewer' });
  app.crew.workflows.onFinish(plan);
  writer = app.crew.state.tasks.find(task => task.kind === 'work');
  writer.status = 'running';
  const pending = execute(app, 'The labels should name the summary. Take care of that too.');
  writer.status = 'completed';
  flow.status = 'reviewing';
  release();
  await pending;
  assert.equal(app.crew.state.inputs[0].status, 'dispatched');
  assert.equal(app.crew.state.workflows.length, 2);
  assert.equal(app.crew.state.workflows[1].requiresWrite, true);
});

test('private edit requests also receive independent workflow review', async t => {
  const app = setup(t, decision('execute', { requiresWrite: true }));
  app.view = 'chat';
  await execute(app, 'Those summary labels need clearer wording; take care of it.');
  assert.equal(app.crew.state.workflows.length, 1);
  assert.equal(app.crew.state.workflows[0].requiresWrite, true);
  assert.equal(app.crew.state.tasks[0].kind, 'plan');
});

for (const text of [
  'Replace the login button.',
  'I want you to replace the login button.',
  'Rejig the login button so it fits the rest of the page.',
  'The login button feels out of place. Can you sort that out?',
]) {
  test('ordinary delivery leaves interpretation to the teammate AI: ' + text, async t => {
    const app = setup(t, null, { direct: true });
    await execute(app, '@developer ' + text);
    const task = app.crew.state.tasks[0];
    assert.equal(task.member, 'developer');
    assert.equal(task.text, text);
    assert.equal(task.readOnly, false);
    assert.equal(app.crew.state.tasks.length, 1);
    assert.equal(app.crew.state.workflows.length, 0);
    assert.equal(app.prompts.length, 0);
  });
}
