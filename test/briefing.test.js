import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from '../src/crew.js';
import { execute } from '../src/commands.js';
import { briefingLines } from '../src/briefing.js';
import { validateState } from '../src/state.js';
import { completions } from '../src/controls.js';
import { commandChoices } from '../src/command-picker.js';
import { runWorker } from '../src/scheduler.js';

function setup(t) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-briefing-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const crew = new Crew(folder, { runner: async () => assert.fail('Briefings must not call a model') });
  crew.queue.pause();
  return { crew, selected: 'chief', view: 'group' };
}

const morning = () => new Date(2026, 9, 22, 10, 0).getTime();

test('large project briefings and watch scan task history a bounded number of times', t => {
  const { crew } = setup(t);
  crew.state.workflows = Array.from({ length: 250 }, (_, i) => ({
    id: i.toString(16).padStart(8, '0'),
    status: 'failed',
    text: `Workflow ${i}`,
    createdAt: morning(),
  }));
  let reads = 0;
  crew.state.tasks = Array.from({ length: 1250 }, (_, i) => ({
    id: (i + 1000).toString(16).padStart(8, '0'),
    member: 'developer',
    status: 'completed',
    text: `Task ${i}`,
    createdAt: morning() - 1000,
    finishedAt: morning(),
    get workflowId() {
      reads++;
      return i < 250 ? crew.state.workflows[i].id : undefined;
    },
  }));
  const report = briefingLines(crew, morning()).join('\n');
  assert.match(report, /Needs your attention \(250\)/);
  assert.match(report, /Finished in the last 24 hours \(1000\)/);
  assert.ok(reads < crew.state.tasks.length * 12, `Briefing read task ownership ${reads} times`);
  crew.watch.enable('23:59');
  reads = 0;
  const notices = crew.watch.tick(morning());
  assert.equal(notices.length, 100);
  assert.ok(reads < crew.state.tasks.length * 12, `Watch read task ownership ${reads} times`);
});

test('briefing surfaces questions, recovery, verification and schedules without changing state', t => {
  const { crew } = setup(t);
  const waiting = crew.queue.enqueue('chief', 'Choose layout', { hold: true });
  waiting.status = 'waiting';
  waiting.question = 'Which layout?';
  const failed = crew.workflows.start('Repair navigation');
  failed.status = 'failed';
  failed.error = 'Required check failed';
  const unverified = crew.workflows.start('Old work');
  unverified.status = 'completed';
  unverified.finishedAt = morning();
  const verified = crew.workflows.start('Verified work');
  verified.status = 'completed';
  verified.outcome = 'met';
  verified.reviewTaskId = crew.state.tasks.find(task => task.workflowId === verified.id).id;
  verified.finishedAt = morning();
  crew.scheduler.add(60, 'researcher', 'Inspect project health');
  const before = JSON.stringify(crew.state);
  const report = briefingLines(crew, morning()).join('\n');
  assert.match(report, /Pongkan Crew/);
  assert.match(report, /Which layout\?/);
  assert.match(report, new RegExp(`/answer ${waiting.id}`));
  assert.match(report, new RegExp(`/recovery ${failed.id}`));
  assert.match(report, /Required check failed/);
  assert.match(report, /Old work.*unverified/);
  assert.match(report, /Verified work.*accepted/);
  assert.match(report, /Inspect project health/);
  assert.equal(JSON.stringify(crew.state), before);
});

test('watch is opt-in, sends one daily briefing and keeps its inbox across restart', t => {
  const app = setup(t);
  assert.deepEqual(app.crew.watch.tick(morning()), []);
  execute(app, '/watch on 09:30');
  const notices = app.crew.watch.tick(morning());
  assert.equal(notices.length, 1);
  assert.match(notices[0].text, /Pongkan Crew briefing/);
  assert.deepEqual(app.crew.watch.tick(morning() + 1000), []);
  const restored = new Crew(app.crew.folder);
  assert.equal(restored.state.watch.enabled, true);
  assert.equal(restored.state.watch.time, '09:30');
  assert.deepEqual(restored.watch.tick(morning() + 2000), []);
  assert.equal(restored.state.watch.inbox.length, 1);
  assert.equal(restored.watch.tick(morning() + 86400000).length, 1);
});

test('watch deduplicates alerts, detects changed questions, and never resumes work', t => {
  const app = setup(t);
  execute(app, '/watch on 23:59');
  const task = app.crew.queue.enqueue('chief', 'Choose layout', { hold: true });
  task.status = 'waiting';
  task.question = 'Which layout?';
  const flow = app.crew.workflows.start('Paused work');
  flow.status = 'paused';
  let alerts = app.crew.watch.tick(morning());
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].detail, /Which layout/);
  assert.deepEqual(app.crew.watch.tick(morning() + 1000), []);
  task.question = 'Which color?';
  alerts = app.crew.watch.tick(morning() + 2000);
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].detail, /Which color/);
  app.crew.save();
  assert.deepEqual(new Crew(app.crew.folder).watch.tick(morning() + 3000), []);
  assert.equal(flow.status, 'paused');
  assert.equal(task.status, 'waiting');
  assert.equal(app.crew.queue.paused, true);
  execute(app, '/watch clear');
  assert.deepEqual(app.crew.state.watch.inbox, []);
  assert.deepEqual(app.crew.watch.tick(morning() + 4000), []);
  execute(app, '/watch off');
  task.question = 'Another question?';
  assert.deepEqual(app.crew.watch.tick(morning() + 5000), []);
});

test('watch suppresses old completions and notifies new results without claiming acceptance', t => {
  const app = setup(t);
  const task = app.crew.queue.enqueue('researcher', 'Old result', { hold: true });
  task.status = 'completed';
  execute(app, '/watch on 23:59');
  assert.deepEqual(app.crew.watch.tick(morning()), []);
  const flow = app.crew.workflows.start('New work');
  flow.status = 'completed';
  flow.finishedAt = morning();
  const alerts = app.crew.watch.tick(morning());
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].detail, /unverified/);
  assert.match(alerts[0].detail, new RegExp(`/workflow criteria ${flow.id}`));
});

test('briefing and watch commands are discoverable, local, and validate arguments before mutation', t => {
  const app = setup(t);
  execute(app, '/briefing');
  assert.equal(app.panel.title, 'PONGKAN CREW BRIEFING');
  execute(app, '/watch inbox');
  assert.match(app.panel.lines.join('\n'), /No saved/);
  const before = JSON.stringify(app.crew.state);
  for (const command of ['/briefing extra', '/watch on 25:00', '/watch on 9:00', '/watch off extra', '/watch wat'])
    assert.throws(() => execute(app, command), /Use/);
  assert.equal(JSON.stringify(app.crew.state), before);
  assert.ok(completions('/br', []).includes('/briefing'));
  assert.ok(commandChoices('briefing').some(entry => entry.command === '/briefing'));
  assert.ok(commandChoices('watch').some(entry => entry.command === '/watch on'));
});

test('legacy state migrates watch settings and corrupt watch settings are rejected', t => {
  const { crew } = setup(t);
  const original = structuredClone(crew.state);
  delete original.watch;
  validateState(original);
  assert.equal(original.watch.enabled, false);
  for (const watch of [
    null,
    { ...original.watch, time: '25:00' },
    { ...original.watch, enabled: 'yes' },
    { ...original.watch, seen: ['bad'] },
    { ...original.watch, inbox: [{ at: -1, text: 'x', detail: 'x' }] },
  ])
    assert.throws(() => validateState({ ...original, watch }), /Invalid crew state/);
});

test('worker ticks watch and retains local briefings without queued assignments', async t => {
  const app = setup(t);
  execute(app, '/watch on 00:00');
  app.crew.queue.resume();
  await runWorker(app.crew, { once: true });
  assert.equal(app.crew.state.watch.inbox.length, 1);
  assert.equal(app.crew.state.tasks.length, 0);
});

test('one-shot worker reports a scheduled inspection result before exiting and preserves read-only access', async t => {
  const app = setup(t);
  let calls = 0;
  app.crew.runner = async (args, _prompt, emit) => {
    calls++;
    assert.ok(args.includes('read-only'));
    emit({ type: 'item.completed', item: { type: 'agent_message', text: 'No actionable issues found.' } });
  };
  execute(app, '/watch on 23:59');
  const job = app.crew.scheduler.add(60, 'developer', 'Inspect without editing');
  job.nextRun = 0;
  app.crew.queue.resume();
  await runWorker(app.crew, { once: true });
  assert.equal(calls, 1);
  const notices = app.crew.state.watch.inbox;
  assert.ok(notices.some(notice => notice.text.includes(job.lastTaskId) && notice.text.includes('completed')));
  assert.deepEqual(new Crew(app.crew.folder).state.watch.inbox, notices);
});

test('watch retains only 50 notifications and rolls back a failed save before publishing alerts', t => {
  const app = setup(t);
  execute(app, '/watch on 23:59');
  const task = app.crew.queue.enqueue('chief', 'Choose layout', { hold: true });
  task.status = 'waiting';
  for (let i = 0; i < 55; i++) {
    task.question = `Question ${i}?`;
    app.crew.watch.tick(morning() + i * 1000);
  }
  assert.equal(app.crew.state.watch.inbox.length, 50);
  assert.match(app.crew.state.watch.inbox[0].detail, /Question 5\?/);
  const before = structuredClone(app.crew.state.watch);
  const save = app.crew.save;
  task.question = 'Unsaved question?';
  app.crew.save = () => {
    throw new Error('Disk full');
  };
  let published = false;
  app.crew.on('watch', () => {
    published = true;
  });
  assert.throws(() => app.crew.watch.tick(morning() + 60000), /Disk full/);
  assert.deepEqual(app.crew.state.watch, before);
  assert.equal(published, false);
  app.crew.save = save;
  assert.equal(app.crew.watch.tick(morning() + 61000).length, 1);
});

test('completed history cannot hide an outstanding question from briefings or watch', t => {
  const app = setup(t);
  const waiting = app.crew.queue.enqueue('chief', 'Choose layout', { hold: true });
  waiting.status = 'waiting';
  waiting.question = 'Which layout?';
  app.crew.state.tasks.push(
    ...Array.from({ length: 220 }, (_, i) => ({
      ...waiting,
      id: i.toString(16).padStart(8, '0'),
      status: 'completed',
      question: undefined,
      createdAt: morning() - 1000,
      finishedAt: morning() - 500,
    })),
  );
  assert.match(briefingLines(app.crew, morning()).join('\n'), /Which layout/);
  execute(app, '/watch on 23:59');
  const notices = app.crew.watch.tick(morning());
  assert.equal(notices.length, 1);
  assert.match(notices[0].detail, /Which layout/);
  waiting.status = 'completed';
  waiting.finishedAt = morning() + 1000;
  const finished = app.crew.watch.tick(morning() + 1000);
  assert.equal(finished.length, 1);
  assert.match(finished[0].text, new RegExp(waiting.id));
});
