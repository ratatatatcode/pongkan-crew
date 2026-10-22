import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from '../src/crew.js';
import { execute } from '../src/commands.js';
import { workflowReport, criteriaLines, searchHistory, activitySummary } from '../src/workspace-insights.js';
import { usageLines, reportedUsage } from '../src/usage.js';
import { commandChoices, selectCommand, commandPickerKey } from '../src/command-picker.js';
import { completions } from '../src/controls.js';
import { validateState } from '../src/state.js';
import { activityRows } from '../src/activity.js';

function setup(t, runner = async () => {}) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-tools-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const crew = new Crew(folder, { runner });
  crew.queue.pause();
  return { crew, selected: 'chief', view: 'chat', notice: '', panel: null };
}

test('report separates finished assignments from unmet acceptance and gives recovery guidance', () => {
  const flow = {
    id: 'abc',
    status: 'failed',
    text: 'Add filters',
    outcome: 'needs_work',
    reviewTaskId: 'review',
    criteria: [{ requirement: 'Filters work', status: 'fail', evidence: 'Missing handler' }],
    error: 'Review stalled',
  };
  const state = {
    tasks: [{ id: 'work', workflowId: 'abc', status: 'completed', member: 'developer' }],
    workflows: [flow],
  };
  const report = workflowReport(state, flow).join('\n');
  assert.match(report, /1\/1/);
  assert.match(report, /needs_work/);
  assert.match(report, /Missing handler/);
  assert.match(report, /\/recovery abc/);
  assert.match(criteriaLines(flow).join('\n'), /review/);
  assert.match(criteriaLines({ id: 'old' }).join('\n'), /No.*criteria/i);
  assert.match(activitySummary({ state, queue: { paused: true } }).join('\n'), /paused/i);
});

test('history search is literal, bounded and covers saved chats, results and decisions', () => {
  const crew = {
    state: {
      members: [{ name: 'chief', messages: [{ role: 'user', text: 'Need [filters]' }] }],
      conversations: [
        { id: 'chat', title: 'Archived', archived: true, messages: [{ role: 'assistant', text: 'Use [filters]' }] },
      ],
      discussions: [],
      workflows: [],
      tasks: [{ id: 'job', result: 'Implemented [filters]' }],
    },
    memory: { list: () => [{ id: 'decision', text: '[filters] are local' }] },
  };
  const results = searchHistory(crew, '[FILTERS]', 3);
  assert.equal(results.matches.length, 3);
  assert.equal(results.truncated, true);
  assert.match(results.matches.join('\n'), /chief|chat|job/);
  assert.deepEqual(searchHistory(crew, 'absent').matches, []);
  assert.throws(() => searchHistory(crew, ' '), /search/i);
});

test('templates persist, preserve multiline instructions and run through the existing workflow path', t => {
  const app = setup(t);
  execute(app, '/template save fix Inspect the reported issue.\nGoal: {{goal}}');
  assert.equal(new Crew(app.crew.folder).state.templates[0].text, 'Inspect the reported issue.\nGoal: {{goal}}');
  execute(app, '/template run fix Repair navigation');
  assert.match(app.crew.state.workflows.at(-1).text, /Goal: Repair navigation/);
  const count = app.crew.state.templates.length;
  assert.throws(() => execute(app, '/template save fix overwrite'), /exists/);
  assert.throws(() => execute(app, '/template save ../bad text'), /name/i);
  assert.throws(() => execute(app, '/template run missing goal'), /Unknown/);
  assert.equal(app.crew.state.templates.length, count);
  execute(app, '/template delete fix');
  assert.equal(new Crew(app.crew.folder).state.templates.length, 0);
});

test('usage records reported tokens once per turn and accumulates across repeated task execution', async t => {
  const app = setup(t, async (_args, _prompt, emit) => {
    emit({ type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 20, output_tokens: 30 } });
    emit({ type: 'item.completed', item: { type: 'agent_message', text: 'Done' } });
  });
  const task = app.crew.queue.enqueue('researcher', 'Inspect source', { hold: true });
  await app.crew.send('researcher', task.text, { taskId: task.id });
  await app.crew.send('researcher', task.text, { taskId: task.id });
  assert.equal(task.usage.input_tokens, 200);
  assert.equal(task.usage.reportedTurns, 2);
  const restored = new Crew(app.crew.folder);
  assert.equal(restored.state.usage.output_tokens, 60);
  assert.match(usageLines(restored.state).join('\n'), /200/);
  assert.match(usageLines({ tasks: [] }).join('\n'), /unavailable/i);
});

test('commands validate IDs and expose report, criteria, search and usage without model calls', t => {
  const app = setup(t, async () => assert.fail('read commands must stay local'));
  const flow = app.crew.workflows.start('Add search');
  for (const command of [
    `/workflow report ${flow.id}`,
    `/workflow criteria ${flow.id}`,
    `/usage ${flow.id}`,
    '/search search',
  ]) {
    execute(app, command);
    assert.ok(app.panel.lines.length);
  }
  assert.throws(() => execute(app, '/usage unknown'), /Unknown/);
  assert.throws(() => execute(app, '/workflow report'), /Use/);
  assert.throws(() => execute(app, '/search'), /search/i);
});

test('command picker searches descriptions and fills a command without executing it', () => {
  const choices = commandChoices('reported token');
  assert.ok(choices.some(choice => choice.command === '/usage'));
  const app = { panel: { kind: 'command-picker', pickerIndex: 0, choices } };
  assert.equal(selectCommand(app), '/usage ');
  assert.equal(app.panel, null);
  assert.ok(commandChoices('memory').some(entry => entry.command === '/memory add'));
});

test('picker filters interactively and argument completion includes saved workflows and templates', t => {
  const app = setup(t);
  execute(app, '/commands');
  for (const str of 'reported tokens') commandPickerKey(app, str, {});
  assert.ok(app.panel.choices.some(entry => entry.command === '/usage'));
  commandPickerKey(app, '', { name: 'down' });
  const selected = app.panel.choices[app.panel.pickerIndex].command;
  assert.equal(commandPickerKey(app, '', { name: 'return' }).input, selected + ' ');
  assert.equal(app.panel, null);
  assert.deepEqual(completions('/workflow report a', [], [], { workflows: ['abcd1234', 'bcde2345'] }), [
    '/workflow report abcd1234',
  ]);
  assert.deepEqual(completions('/template run f', [], [], { templates: ['fix'] }), ['/template run fix']);
  execute(app, '/commands NO-MATCH-EXISTS');
  assert.equal(commandPickerKey(app, '', { name: 'return' }).input, null);
  assert.ok(app.panel);
});

test('invalid saved templates and usage are rejected; legacy state is migrated', t => {
  const app = setup(t);
  const original = structuredClone(app.crew.state);
  for (const templates of [
    [{ name: '../bad', text: 'x' }],
    [{ name: 'ok', text: '' }],
    [
      { name: 'ok', text: 'a' },
      { name: 'ok', text: 'b' },
    ],
  ]) {
    assert.throws(() => validateState({ ...original, templates }), /Invalid crew state/);
  }
  assert.throws(() => validateState({ ...original, usage: { turns: -1 } }), /Invalid crew state/);
  delete original.templates;
  validateState(original);
  assert.deepEqual(original.templates, []);
  assert.equal(reportedUsage({ input_tokens: 2, cached_input_tokens: 3, output_tokens: 1 }), null);
});

test('routing usage is counted in project totals and failed unreported turns remain explicit', async t => {
  const app = setup(t, async (_args, _prompt, emit) => {
    emit({ type: 'turn.completed', usage: { input_tokens: 17, cached_input_tokens: 0, output_tokens: 4 } });
    emit({ type: 'item.completed', item: { type: 'agent_message', text: '{}' } });
  });
  await assert.rejects(app.crew.inputs.resolve({ id: 'abcd1234', text: 'hello' }, {}));
  assert.equal(app.crew.state.usage.input_tokens, 17);
  assert.equal(app.crew.state.usage.turns, 1);
  app.crew.runner = async () => {
    throw new Error('Connection failed');
  };
  const result = await app.crew.send('researcher', 'Inspect');
  assert.equal(result.status, 'failed');
  assert.equal(app.crew.state.usage.turns, 2);
  assert.equal(app.crew.state.usage.reportedTurns, 1);
  assert.equal(new Crew(app.crew.folder).state.usage.input_tokens, 17);
});

test('usage ignores duplicate completion reports and workflow totals exclude unrelated chat', async t => {
  const app = setup(t, async (_args, _prompt, emit) => {
    const event = { type: 'turn.completed', usage: { input_tokens: 7, cached_input_tokens: 1, output_tokens: 2 } };
    emit(event);
    emit(event);
  });
  const flow = app.crew.workflows.start('Inspect');
  const task = app.crew.state.tasks.find(task => task.workflowId === flow.id);
  await app.crew.send('chief', task.text, { taskId: task.id });
  await app.crew.send('researcher', 'Unrelated chat');
  assert.equal(app.crew.state.usage.input_tokens, 14);
  assert.match(usageLines(app.crew.state, flow).join('\n'), /Reported input tokens: 7\n/);
  assert.equal(task.usage.reportedTurns, 1);
});

test('template expansion is bounded and list previews stay short', t => {
  const app = setup(t);
  execute(app, '/template save repeated ' + '{{goal}} '.repeat(30));
  assert.throws(() => execute(app, '/template run repeated ' + 'x'.repeat(1000)), /exceeds/);
  execute(app, '/template list');
  assert.ok(app.panel.lines[0].length < 160);
  assert.equal(app.crew.state.workflows.length, 0);
});

test('Activity rendering reuses unchanged rows and invalidates on event or width changes', () => {
  const event = { text: 'Finished command', detail: 'Success', kind: 'command' };
  const rows = activityRows(event, 80, 76, '.', ['chief']);
  assert.equal(activityRows(event, 80, 76, '.', ['chief']), rows);
  event.detail = 'Failure';
  assert.notEqual(activityRows(event, 80, 76, '.', ['chief']), rows);
  assert.notEqual(activityRows(event, 40, 36, '.', ['chief']), rows);
});

test('worktree review detects overlapping commits and dirty work without modifying either branch', async t => {
  const app = setup(t);
  const git = (folder, ...args) =>
    execFileSync('git', ['-C', folder, '-c', 'core.hooksPath=', ...args], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: 'pipe',
    }).trim();
  const commit = (folder, message) => {
    git(folder, 'add', '.');
    git(folder, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', message);
  };
  git(app.crew.folder, 'init');
  writeFileSync(join(app.crew.folder, '.gitignore'), '.pongkan-crew/\n');
  writeFileSync(join(app.crew.folder, 'shared file.txt'), 'initial\n');
  commit(app.crew.folder, 'Initial');
  const flow = await app.crew.workflows.startIsolated('Feature');
  assert.match((await app.crew.worktrees.review(flow.id)).join('\n'), /no committed changes to merge/);
  writeFileSync(join(flow.workspace, 'shared file.txt'), 'feature\n');
  commit(flow.workspace, 'Feature');
  assert.match((await app.crew.worktrees.review(flow.id)).join('\n'), /no obvious blockers/);
  writeFileSync(join(app.crew.folder, 'shared file.txt'), 'target\n');
  commit(app.crew.folder, 'Target');
  writeFileSync(join(flow.workspace, 'untracked.txt'), 'local work');
  const before = [
    git(app.crew.folder, 'rev-parse', 'HEAD'),
    git(flow.workspace, 'rev-parse', 'HEAD'),
    git(flow.workspace, 'status', '--short'),
  ];
  await execute(app, `/worktree review ${flow.id}`);
  const report = app.panel.lines.join('\n');
  assert.match(report, /Both sides changed: shared file.txt/);
  assert.match(report, /uncommitted or untracked/);
  assert.match(report, /Commits ahead: 1; behind: 1/);
  assert.deepEqual(
    [
      git(app.crew.folder, 'rev-parse', 'HEAD'),
      git(flow.workspace, 'rev-parse', 'HEAD'),
      git(flow.workspace, 'status', '--short'),
    ],
    before,
  );
  const standalone = app.crew.workflows.start('Not isolated');
  await assert.rejects(app.crew.worktrees.review(standalone.id), /no isolated worktree/);
});
