import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  symlinkSync,
  rmSync,
  renameSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { MarkdownExporter } from '../src/markdown-export.js';
import { execute } from '../src/commands.js';
import { Crew } from '../src/crew.js';
import { validateState } from '../src/state.js';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { execFileSync } from 'node:child_process';

function fixture(t) {
  const folder = mkdtempSync(join(resolve('test'), 'markdown-artifacts-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const state = validateState({
    version: 1,
    members: [{ name: 'chief', role: 'Coordinate', writable: false, threadId: null, messages: [] }],
  });
  const notices = [];
  const crew = {
    folder,
    state,
    notify: text => notices.push(text),
    save() {
      exporter.save(state);
    },
    setMarkdown: Crew.prototype.setMarkdown,
  };
  const exporter = new MarkdownExporter(crew);
  return {
    folder,
    state,
    crew,
    notices,
    exporter,
    app: { crew },
    path: id => join(folder, 'docs', 'pongkan-docs', `task-${id}.md`),
  };
}

test('toggle defaults off, creates directories, updates snapshots and stops subsequent writes', t => {
  const f = fixture(t);
  assert.equal(f.state.markdownEnabled, false);
  f.state.tasks.push({
    id: '12345678',
    member: 'chief',
    text: 'Original requirement',
    status: 'queued',
    kind: 'message',
    createdAt: 1,
  });
  f.crew.save();
  execute(f.app, '/markdown on');
  assert.ok(existsSync(join(f.folder, 'docs', 'pongkan-docs')));
  assert.equal(existsSync(f.path('12345678')), false);
  Object.assign(f.state.tasks[0], { result: '# First response', status: 'waiting', question: 'Which option?' });
  f.crew.save();
  assert.match(readFileSync(f.path('12345678'), 'utf8'), /Original requirement[\s\S]*First response/);
  Object.assign(f.state.tasks[0], {
    result: '# Continued response',
    status: 'completed',
    answers: [{ question: 'Which option?', answer: 'Orange' }],
  });
  f.crew.save();
  const content = readFileSync(f.path('12345678'), 'utf8');
  assert.match(content, /Continued response/);
  assert.match(content, /Orange/);
  assert.doesNotMatch(content, /First response/);
  execute(f.app, '/markdown off');
  f.state.tasks[0].result = 'Late response';
  f.crew.save();
  assert.equal(readFileSync(f.path('12345678'), 'utf8'), content);
  assert.equal(validateState(JSON.parse(JSON.stringify(f.state))).markdownEnabled, false);
  assert.throws(() => execute(f.app, '/markdown bogus'), /Use \/markdown/);
});

test('discussion saves incremental ordered messages and reports conflicts without losing results', t => {
  const f = fixture(t);
  execute(f.app, '/markdown on');
  f.state.discussions.push({
    id: 'abcdef12',
    status: 'working',
    createdAt: 1,
    taskIds: [],
    messages: [{ role: 'user', speaker: 'you', text: 'Discuss this' }],
  });
  f.crew.save();
  f.state.discussions[0].messages.push({ role: 'assistant', speaker: 'chief', text: '**Agreed**' });
  f.crew.save();
  assert.match(
    readFileSync(join(f.folder, 'docs', 'pongkan-docs', 'discussion-abcdef12.md'), 'utf8'),
    /Discuss this[\s\S]*Chief[\s\S]*\*\*Agreed\*\*/,
  );
  writeFileSync(f.path('12345678'), 'Human document');
  f.state.tasks.push({ id: '12345678', text: 'Task', member: 'chief', status: 'failed', result: 'Retained response' });
  f.crew.save();
  assert.equal(readFileSync(f.path('12345678'), 'utf8'), 'Human document');
  assert.match(f.notices.at(-1), /Markdown save failed/);
  assert.equal(f.state.tasks[0].result, 'Retained response');
});

test('discussion exports distinguish submission shortcuts and waiting prompts from active prompts', t => {
  const f = fixture(t);
  execute(f.app, '/markdown on');
  const discussion = {
    id: 'abcdef12',
    status: 'working',
    createdAt: 1,
    taskIds: [],
    messages: [
      { role: 'user', speaker: 'you', text: 'First prompt', submission: 'enter', submittedAt: 1, startedAt: 2 },
      { role: 'user', speaker: 'you', text: 'Next prompt', submission: 'shift-left', submittedAt: 3, queued: true },
      { role: 'assistant', speaker: 'chief', text: 'First answer', discussionMessageIndex: 0 },
    ],
  };
  f.state.discussions.push(discussion);
  f.crew.save();
  const file = join(f.folder, 'docs', 'pongkan-docs', 'discussion-abcdef12.md');
  let content = readFileSync(file, 'utf8');
  assert.match(content, /Submitted with: Enter/);
  assert.match(content, /Submitted with: Shift\+Left/);
  assert.match(content, /Waiting for earlier prompts to finish/);
  assert.ok(content.indexOf('First answer') < content.indexOf('Next prompt'));
  delete discussion.messages[1].queued;
  discussion.messages[1].startedAt = 4;
  f.crew.save();
  content = readFileSync(file, 'utf8');
  assert.doesNotMatch(content, /Waiting for earlier prompts to finish/);
  assert.match(content, /Started: 1970-01-01T00:00:00.004Z/);
});

test('directory failure leaves mode off and invalid state values are rejected', t => {
  const f = fixture(t);
  writeFileSync(join(f.folder, 'docs'), 'occupied');
  assert.throws(() => execute(f.app, '/markdown on'));
  assert.equal(f.state.markdownEnabled, false);
  f.state.markdownEnabled = 'on';
  assert.throws(() => validateState(f.state), /Invalid crew state/);
});

test('restart preserves enabled mode and exports interrupted work and distinct retries', t => {
  const f = fixture(t);
  execute(f.app, '/markdown on');
  f.state.tasks.push({
    id: '12345678',
    member: 'chief',
    kind: 'message',
    text: 'Work',
    createdAt: 1,
    status: 'running',
    result: 'Partial response',
  });
  f.crew.save();
  const restored = validateState(JSON.parse(JSON.stringify(f.state)));
  const exporter = new MarkdownExporter({ ...f.crew, state: restored });
  exporter.save(restored);
  restored.tasks[0].status = 'interrupted';
  exporter.save(restored);
  assert.match(readFileSync(f.path('12345678'), 'utf8'), /interrupted[\s\S]*Partial response/);
  restored.tasks.push({ ...restored.tasks[0], id: '87654321', status: 'completed', result: 'Retry response' });
  exporter.save(restored);
  assert.match(readFileSync(f.path('87654321'), 'utf8'), /Retry response/);
  assert.match(readFileSync(f.path('12345678'), 'utf8'), /Partial response/);
});

test('junction redirection is rejected without writing into the target', t => {
  const f = fixture(t);
  const target = join(f.folder, 'unrelated');
  mkdirSync(target);
  symlinkSync(target, join(f.folder, 'docs'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => execute(f.app, '/markdown on'), /Unsafe Markdown directory/);
  assert.equal(existsSync(join(target, 'pongkan-docs')), false);
});

test('existing directories and repeated enable/save operations preserve unrelated files without duplicate exports', t => {
  const f = fixture(t);
  const directory = join(f.folder, 'docs', 'pongkan-docs');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'notes.md'), 'Keep these notes');
  execute(f.app, '/markdown on');
  execute(f.app, '/markdown on');
  f.state.tasks.push({
    id: '12345678',
    member: 'chief',
    text: 'New task',
    status: 'completed',
    result: 'One response',
  });
  f.crew.save();
  const before = statSync(f.path('12345678')).mtimeMs;
  f.crew.save();
  execute(f.app, '/markdown on');
  assert.equal(statSync(f.path('12345678')).mtimeMs, before);
  assert.deepEqual(readdirSync(directory).sort(), ['notes.md', 'task-12345678.md']);
  assert.equal(readFileSync(join(directory, 'notes.md'), 'utf8'), 'Keep these notes');
  execute(f.app, '/markdown');
  assert.match(f.app.notice, /Markdown saving ON/);
  for (const command of ['/markdown on off', '/markdown off extra', '/markdown status', '/markdown ON']) {
    assert.throws(() => execute(f.app, command), /Use \/markdown/);
    assert.equal(f.state.markdownEnabled, true);
  }
});

test('enabled and disabled settings round-trip through a disk snapshot and do not leak across projects', t => {
  const f = fixture(t);
  const file = join(f.folder, 'persistence.json');
  for (const enabled of [true, false]) {
    execute(f.app, enabled ? '/markdown on' : '/markdown off');
    writeFileSync(file, JSON.stringify(f.state));
    const restored = validateState(JSON.parse(readFileSync(file, 'utf8')));
    assert.equal(restored.markdownEnabled, enabled);
    assert.equal(fixture(t).state.markdownEnabled, false);
  }
});

test('later directory failure retains results and mode, and a changed record retries after repair', t => {
  const f = fixture(t);
  execute(f.app, '/markdown on');
  renameSync(join(f.folder, 'docs'), join(f.folder, 'saved-docs'));
  writeFileSync(join(f.folder, 'docs'), 'Blocked directory');
  f.state.tasks.push({ id: '12345678', text: 'Work', status: 'completed', result: 'Retain this response' });
  assert.doesNotThrow(() => f.crew.save());
  assert.equal(f.state.markdownEnabled, true);
  assert.equal(f.state.tasks[0].result, 'Retain this response');
  assert.match(f.notices.at(-1), /Markdown save failed:.*task-12345678.md/);
  renameSync(join(f.folder, 'docs'), join(f.folder, 'directory-blocker.txt'));
  renameSync(join(f.folder, 'saved-docs'), join(f.folder, 'docs'));
  f.crew.save();
  assert.equal(existsSync(f.path('12345678')), false);
  f.state.tasks[0].result += '\nContinued';
  f.crew.save();
  assert.match(readFileSync(f.path('12345678'), 'utf8'), /Retain this response[\s\S]*Continued/);
});

test('exports preserve full responses while excluding sessions and raw diffs', t => {
  const f = fixture(t);
  execute(f.app, '/markdown on');
  const response = '# Full response\n' + 'Details '.repeat(10000) + '\nFinal detail';
  f.state.tasks.push({
    id: '12345678',
    member: 'developer',
    text: 'Work',
    status: 'cancelled',
    result: response,
    threadId: 'PRIVATE_SESSION',
    diff: { files: ['src/example.js'], text: 'RAW_DIFF_CONTENT' },
  });
  f.crew.save();
  const content = readFileSync(f.path('12345678'), 'utf8');
  assert.ok(content.includes(response));
  assert.match(content, /Status: cancelled/);
  assert.match(content, /src\/example.js/);
  assert.doesNotMatch(content, /PRIVATE_SESSION|RAW_DIFF_CONTENT/);
});

test('a directory swapped at the write boundary receives no redirected temporary file', t => {
  const f = fixture(t);
  execute(f.app, '/markdown on');
  if (process.platform === 'win32') {
    const output = execFileSync(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', resolve('test/windows-markdown-race.ps1')],
      {
        input: JSON.stringify({ folder: f.folder, node: process.execPath }),
        encoding: 'utf8',
        windowsHide: true,
        env: { ...process.env, TEMP: f.folder, TMP: f.folder },
      },
    );
    assert.equal(JSON.parse(output).blocked, 3);
    assert.match(readFileSync(f.path('12345678'), 'utf8'), /Protected response/);
    assert.deepEqual(readdirSync(join(f.folder, 'docs', 'pongkan-docs')), ['task-12345678.md']);
    return;
  }
  const directory = join(f.folder, 'docs', 'pongkan-docs');
  const target = join(f.folder, 'unrelated');
  mkdirSync(target);
  const original = fs.writeFileSync;
  let swapped = false;
  t.mock.method(fs, 'writeFileSync', (path, ...args) => {
    if (!swapped && String(path).includes('.pongkan-export-')) {
      swapped = true;
      renameSync(directory, join(f.folder, 'original-documents'));
      symlinkSync(target, directory, process.platform === 'win32' ? 'junction' : 'dir');
    }
    return original(path, ...args);
  });
  syncBuiltinESMExports();
  try {
    f.state.tasks.push({ id: '12345678', text: 'Work', status: 'completed', result: 'Response' });
    f.crew.save();
    assert.deepEqual(readdirSync(target), []);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});

test('a full Crew restart persists the toggle and exports recovered task changes', async t => {
  const folder = mkdtempSync(join(resolve('test'), 'markdown-restart-'));
  const path = id => join(folder, 'docs', 'pongkan-docs', `task-${id}.md`);
  const crews = [];
  t.after(async () => {
    for (const instance of crews) await instance.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const runner = async (args, prompt, event) => {
    event({ type: 'item.completed', item: { type: 'agent_message', text: '# Saved assignment result' } });
  };
  const crew = new Crew(folder, { runner });
  crews.push(crew);
  execute({ crew }, '/markdown on');
  const task = crew.queue.enqueue('researcher', 'Inspect the requirement');
  await crew.queue.settled(task.id);
  assert.match(readFileSync(path(task.id), 'utf8'), /Saved assignment result/);
  await crew.close();
  const restored = new Crew(folder, { runner });
  crews.push(restored);
  assert.equal(restored.state.markdownEnabled, true);
  assert.equal(restored.state.tasks.find(record => record.id === task.id).result, '# Saved assignment result');
  execute({ crew: restored }, '/markdown off');
  await restored.close();
  const disabled = new Crew(folder, { runner });
  crews.push(disabled);
  assert.equal(disabled.state.markdownEnabled, false);
  const next = disabled.queue.enqueue('researcher', 'Inspect again');
  await disabled.queue.settled(next.id);
  assert.equal(existsSync(path(next.id)), false);
  await disabled.close();
});
