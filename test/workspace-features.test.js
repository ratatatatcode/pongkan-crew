import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, toNamespacedPath } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Crew } from './helpers/crew-fixture.js';
import { execute } from '../src/commands.js';
import { screen } from '../src/ui.js';
import { validateState } from '../src/state.js';
import { runWorker } from '../src/scheduler.js';

function setup(
  t,
  runner = async (args, prompt, event) => {
    event({
      type: 'item.completed',
      item: {
        type: 'agent_message',
        text: prompt.includes('PONGKAN_PLAN')
          ? JSON.stringify({ steps: [{ member: 'developer', task: 'Build navigation' }], reviewer: 'reviewer' })
          : 'Verified keyboard navigation.',
      },
    });
  },
) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-workspace-'));
  const crew = new Crew(t, folder, { runner });
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  return { crew, selected: 'developer', view: 'group', scroll: 0 };
}

test('Crew Chat displays replies and Activity displays workflow handoffs without copying records', async t => {
  const { crew } = setup(t);
  const flow = crew.workflows.start('Improve navigation');
  await crew.workflows.settled(flow.id);
  const before = JSON.stringify(crew.state);
  const shown = screen(crew, 'developer', '', '', 140, 80, 0, null, { view: 'group' });
  assert.doesNotMatch(shown, /Proposed plan|Verified keyboard navigation/);
  assert.doesNotMatch(shown, new RegExp(flow.id));
  const activity = screen(crew, 'developer', '', '', 140, 100, 0, null, { view: 'activity' });
  assert.match(activity, /Chief → Developer/);
  assert.match(activity, /Developer → Reviewer/);
  assert.match(activity, new RegExp(flow.id));
  assert.equal(JSON.stringify(crew.state), before);
});

test('crew-task shows planning, assignments and completed handoffs in its source Crew Chat', async t => {
  const app = setup(t);
  app.crew.queue.pause();
  execute(app, '/discuss Build navigation');
  app.crew.discussions.stop();
  execute(app, '/crew-task proceed with what you discussed');
  const flow = app.crew.state.workflows.at(-1);
  const pending = screen(app.crew, app.selected, '', '', 140, 100, 0, null, { view: 'group' });
  assert.match(pending, /proceed with what you discussed/);
  assert.match(pending, /Chief.*Waiting for a turn/);
  app.crew.queue.resume();
  await app.crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  const output = screen(app.crew, app.selected, '', '', 140, 100, 0, null, { view: 'group' });
  assert.match(output, /Developer: Build navigation/);
  assert.match(output, /Verified keyboard navigation/);
  assert.doesNotMatch(output, /Chief ? Developer|Developer ? Reviewer|Reviewer ? Reviewer/);
  execute(app, '/conversation new group Another topic');
  assert.doesNotMatch(
    screen(app.crew, app.selected, '', '', 140, 100, 0, null, { view: 'group' }),
    /Verified keyboard navigation/,
  );
});

test('named direct chats isolate context, persist, reopen, and preserve running destinations', async t => {
  const prompts = [];
  const app = setup(t, async (args, prompt, event) => {
    prompts.push(prompt);
    event({ type: 'item.completed', item: { type: 'agent_message', text: 'Reply to ' + prompt.split('\n').at(-1) } });
  });
  execute(app, '/conversation new developer Login');
  const login = app.crew.state.activeConversations.developer;
  const first = app.crew.queue.enqueue('developer', 'Private login details');
  await app.crew.queue.settled(first.id);
  execute(app, '/conversation new developer Dashboard');
  const dashboard = app.crew.state.activeConversations.developer;
  const next = app.crew.queue.enqueue('developer', 'Dashboard only');
  await app.crew.queue.settled(next.id);
  assert.doesNotMatch(prompts[1], /Private login details/);
  execute(app, `/conversation open ${login}`);
  assert.match(screen(app.crew, 'developer', '', '', 120, 40), /Private login details/);
  assert.doesNotMatch(screen(app.crew, 'developer', '', '', 120, 40), /Dashboard only/);
  assert.equal(new Crew(t, app.crew.folder).state.activeConversations.developer, login);
  execute(app, `/conversation archive ${dashboard}`);
  assert.throws(() => execute(app, `/conversation open ${dashboard}`), /archived/);
  execute(app, `/conversation restore ${dashboard}`);
  execute(app, `/conversation open ${dashboard}`);
  assert.match(screen(app.crew, 'developer', '', '', 120, 40), /Dashboard only/);
});

test('named shared chats isolate discussion history when reopening older topics', async t => {
  const app = setup(t);
  app.crew.queue.pause();
  app.crew.queue.drain = () => {};
  execute(app, '/conversation new group Login plan');
  const login = app.crew.state.activeGroupConversation;
  execute(app, 'Discuss login');
  app.crew.discussions.stop();
  execute(app, '/conversation new group Dashboard plan');
  execute(app, 'Discuss dashboard');
  app.crew.discussions.stop();
  execute(app, `/conversation open ${login}`);
  assert.equal(app.crew.discussions.current.messages[0].text, 'Discuss login');
  execute(app, 'Continue login');
  assert.deepEqual(
    app.crew.discussions.current.messages.map(m => m.text),
    ['Discuss login', 'Continue login'],
  );
});

test('project memory persists, is bounded, and reaches tasks without changing access', async t => {
  let promptSeen, argsSeen;
  const app = setup(t, async (args, prompt) => {
    argsSeen = args;
    promptSeen = prompt;
  });
  execute(app, '/memory add Preserve keyboard navigation.');
  const entry = app.crew.memory.list()[0];
  assert.equal(new Crew(t, app.crew.folder).memory.list()[0].text, 'Preserve keyboard navigation.');
  await app.crew.send('researcher', 'Inspect navigation');
  assert.match(promptSeen, /Preserve keyboard navigation/);
  assert.ok(argsSeen.includes('read-only'));
  assert.throws(() => execute(app, '/memory add ' + 'x'.repeat(2001)), /2000/);
  execute(app, `/memory remove ${entry.id}`);
  assert.deepEqual(app.crew.memory.list(), []);
});

test('isolated workflows execute concurrently in separate Git worktrees and retain review paths', async t => {
  const holds = [];
  const app = setup(t, async (args, prompt, event, signal, options) => {
    if (prompt.includes('PONGKAN_PLAN')) {
      event({
        type: 'item.completed',
        item: {
          type: 'agent_message',
          text: JSON.stringify({ steps: [{ member: 'developer', task: 'Build' }], reviewer: 'reviewer' }),
        },
      });
    } else if (prompt.startsWith('You are developer')) {
      await new Promise(resolve => {
        holds.push({ resolve, folder: options.cwd });
      });
      writeFileSync(join(options.cwd, 'feature.txt'), prompt.includes('First feature') ? 'first' : 'second');
      event({ type: 'item.completed', item: { type: 'agent_message', text: 'Built in isolation' } });
    } else event({ type: 'item.completed', item: { type: 'agent_message', text: 'Reviewed' } });
  });
  const git = args => execFileSync('git', args, { cwd: app.crew.folder, windowsHide: true });
  git(['init']);
  git(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'Initial']);
  const first = await app.crew.workflows.startIsolated('First feature');
  const second = await app.crew.workflows.startIsolated('Second feature');
  for (let count = 0; holds.length < 2 && count < 100; count++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(holds.length, 2);
  assert.notEqual(holds[0].folder, holds[1].folder);
  assert.equal(app.crew.activeWrites.size, 2);
  holds.forEach(h => h.resolve());
  await Promise.all([app.crew.workflows.settled(first.id), app.crew.workflows.settled(second.id)]);
  assert.equal(first.status, 'completed');
  assert.equal(second.status, 'completed');
  assert.ok(first.workspace.startsWith(join(app.crew.folder, '.pongkan-crew')));
  assert.match(first.branch, /^pongkan\//);
  assert.equal(existsSync(join(app.crew.folder, 'feature.txt')), false);
  for (const flow of [first, second])
    assert.deepEqual(app.crew.state.tasks.find(t => t.workflowId === flow.id && t.kind === 'work').diff.files, [
      'feature.txt',
    ]);
  execFileSync('git', ['-C', first.workspace, 'add', 'feature.txt'], { windowsHide: true });
  execFileSync(
    'git',
    ['-C', first.workspace, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'Feature'],
    { windowsHide: true },
  );
  assert.match(await app.crew.worktrees.diff(first.id), /\+first/);
});

test('steering a running task schedules a continuation and records actual delivery', async t => {
  const prompts = [];
  let release;
  const app = setup(t, async (args, prompt, event) => {
    prompts.push(prompt);
    if (prompts.length === 1)
      await new Promise(resolve => {
        release = resolve;
      });
    event({ type: 'item.completed', item: { type: 'agent_message', text: `Pass ${prompts.length}` } });
  });
  const task = app.crew.queue.enqueue('developer', 'Build navigation');
  execute(app, `/steer ${task.id} Keep the original colors.`);
  assert.match(app.notice, /boundary/);
  assert.equal(prompts.length, 1);
  release();
  await app.crew.queue.settled(task.id);
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /Keep the original colors/);
  assert.match(task.result, /Pass 1/);
  assert.match(task.result, /Pass 2/);
  assert.ok(task.steering[0].appliedAt);
  assert.throws(() => execute(app, `/steer ${task.id} Too late`), /finished/);
});

test('recurring schedules coalesce missed runs and never overlap their own active task', async t => {
  const app = setup(t);
  execute(app, '/schedule add 10 researcher Check navigation health');
  const schedule = app.crew.state.schedules[0];
  assert.ok(schedule);
  app.crew.queue.pause();
  assert.deepEqual(app.crew.scheduler.tick(schedule.nextRun + 600000), []);
  app.crew.queue.paused = false;
  const due = schedule.nextRun + 600000;
  const tasks = app.crew.scheduler.tick(due);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].readOnly, true);
  assert.ok(schedule.nextRun > due);
  assert.deepEqual(app.crew.scheduler.tick(due + 1), []);
  await app.crew.queue.settled(tasks[0].id);
  execute(app, `/schedule pause ${schedule.id}`);
  assert.deepEqual(app.crew.scheduler.tick(schedule.nextRun + 1), []);
  assert.equal(new Crew(t, app.crew.folder).state.schedules[0].enabled, false);
});

test('GitHub import uses argument arrays and keeps source text as quoted findings', async t => {
  const { Github } = await import('../src/github.js');
  const app = setup(t);
  app.crew.queue.pause();
  const calls = [];
  app.crew.github = new Github(app.crew.folder, async (file, args, options) => {
    calls.push({ file, args, options });
    return {
      stdout: JSON.stringify({
        title: 'Fix navigation',
        body: 'Preserve keyboard support.',
        url: 'https://github.com/example/project/issues/12',
        number: 12,
        state: 'OPEN',
      }),
    };
  });
  await execute(app, '/github task example/project 12');
  assert.match(app.crew.state.workflows[0].text, /Preserve keyboard support/);
  assert.match(app.crew.state.workflows[0].text, /untrusted/);
  assert.deepEqual(calls[0].args.slice(0, 3), ['issue', 'view', '12']);
  assert.ok(calls[0].args.includes('example/project'));
  await assert.rejects(app.crew.github.read('issue', '--bad', '12'), /OWNER\/REPO/);
  assert.equal(calls.length, 1);
});

test('switching conversations while tasks run preserves both destinations and cancellation targets', async t => {
  const holds = [];
  const app = setup(t, async (args, prompt, event, signal) => {
    await new Promise(resolve => {
      holds.push({ resolve, signal });
      signal.addEventListener('abort', resolve, { once: true });
    });
    if (!signal.aborted)
      event({ type: 'item.completed', item: { type: 'agent_message', text: 'Finished ' + prompt.split('\n').at(-1) } });
  });
  execute(app, '/conversation new researcher First');
  const firstId = app.crew.state.activeConversations.researcher;
  const first = app.crew.queue.enqueue('researcher', 'First topic');
  execute(app, '/conversation new researcher Second');
  const secondId = app.crew.state.activeConversations.researcher;
  const second = app.crew.queue.enqueue('researcher', 'Second topic');
  assert.equal(holds.length, 2);
  execute(app, '/stop');
  assert.equal(holds[0].signal.aborted, false);
  assert.equal(holds[1].signal.aborted, true);
  holds[0].resolve();
  await Promise.all([app.crew.queue.settled(first.id), app.crew.queue.settled(second.id)]);
  assert.equal(first.status, 'completed');
  assert.equal(second.status, 'cancelled');
  assert.match(app.crew.conversations.get(firstId).messages.at(-1).text, /Finished First topic/);
  assert.doesNotMatch(JSON.stringify(app.crew.conversations.get(secondId).messages), /First topic/);
});

test(
  'worktree creation accepts a Windows namespace alias for the repository root',
  {
    skip: process.platform !== 'win32',
  },
  async t => {
    const { crew } = setup(t);
    const git = args => execFileSync('git', args, { cwd: crew.folder, windowsHide: true });
    git(['init']);
    git(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'Initial']);
    const originalGit = crew.worktrees.git.bind(crew.worktrees);
    crew.worktrees.git = async (args, folder) => {
      const output = await originalGit(args, folder);
      return args[0] === 'rev-parse' && args[1] === '--show-toplevel' ? toNamespacedPath(output) : output;
    };
    const worktree = await crew.worktrees.create();
    assert.ok(existsSync(join(worktree.workspace, '.git')));
    assert.equal(crew.worktrees.verify(worktree), worktree.workspace);
  },
);

test('worktree creation rejects dirty tracked files without dispatching a workflow', async t => {
  const { crew } = setup(t);
  const git = args => execFileSync('git', args, { cwd: crew.folder, windowsHide: true });
  git(['init']);
  writeFileSync(join(crew.folder, 'tracked.txt'), 'original');
  git(['add', 'tracked.txt']);
  git(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'Initial']);
  writeFileSync(join(crew.folder, 'tracked.txt'), 'changed');
  await assert.rejects(crew.workflows.startIsolated('Do work'), /Commit or stash/);
  assert.equal(crew.state.workflows.length, 0);
  assert.equal(crew.state.tasks.length, 0);
});

test('headless worker dispatches due jobs once and exits after completion', async t => {
  const app = setup(t);
  const job = app.crew.scheduler.add(1, 'researcher', 'Check health');
  job.nextRun = Date.now() - 1;
  await runWorker(app.crew, { once: true });
  assert.equal(app.crew.queue.get(job.lastTaskId).status, 'completed');
  await runWorker(app.crew, { once: true });
  assert.equal(app.crew.state.tasks.length, 1);
});

test('new state validates conversation ownership and steering types', t => {
  const app = setup(t);
  execute(app, '/conversation new developer Build');
  app.crew.queue.pause();
  const task = app.crew.queue.enqueue('developer', 'Build');
  const invalid = structuredClone(app.crew.state);
  invalid.tasks[0].member = 'researcher';
  assert.throws(() => validateState(invalid), /Invalid crew state/);
  task.steering = [{ id: '12345678', text: 42, createdAt: Date.now() }];
  assert.throws(() => validateState(structuredClone(app.crew.state)), /Invalid crew state/);
  delete task.steering;
});

test('progress bursts throttle disk writes while retaining final events and replies', async t => {
  const { crew } = setup(t, async (args, prompt, event) => {
    for (let index = 0; index < 100; index++)
      event({
        type: 'item.started',
        item: { type: 'command_execution', id: `cmd-${index}`, command: 'Inspect files' },
      });
    event({ type: 'item.completed', item: { type: 'agent_message', text: 'Checked.' } });
  });
  let saves = 0;
  const original = crew.save.bind(crew);
  crew.save = () => {
    saves++;
    original();
  };
  await crew.send('researcher', 'Inspect');
  assert.ok(saves <= 5, `Expected throttled saves, received ${saves}`);
  assert.equal(crew.member('researcher').progress.events, 101);
  assert.equal(new Crew(t, crew.folder).member('researcher').messages.at(-1).text, 'Checked.');
});

test('a waiting question stays in its original named conversation', async t => {
  let calls = 0;
  const app = setup(t, async (args, prompt, event) => {
    calls++;
    event({
      type: 'item.completed',
      item: {
        type: 'agent_message',
        text: calls === 1 ? 'PONGKAN_QUESTION: Which login provider?' : 'Dashboard complete.',
      },
    });
  });
  execute(app, '/conversation new developer Login');
  const first = app.crew.queue.enqueue('developer', 'Build login');
  for (let count = 0; first.status !== 'waiting' && count < 100; count++)
    await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(first.status, 'waiting');
  execute(app, '/conversation new developer Dashboard');
  const second = app.crew.queue.enqueue('developer', 'Build dashboard');
  await app.crew.queue.settled(second.id);
  assert.doesNotMatch(screen(app.crew, 'developer', '', '', 120, 40), /Which login provider/);
});
