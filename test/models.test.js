import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew, buildArgs } from './helpers/legacy-crew.js';
import { execute } from '../src/commands.js';
import { readModelCatalog, validateModelChoice } from '../src/models.js';
import { screen } from '../src/ui.js';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

test('inherited model display resolves Codex configuration and respects explicit choices', async () => {
  const { readModelDefaults, modelLabel } = await import('../src/models.js');
  const requests = [];
  let killed = false;
  let effectiveConfig = { model: 'project-model', model_reasoning_effort: 'high' };
  const spawnProcess = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stdin = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {
      killed = true;
    };
    child.stdin.on('data', data => {
      const request = JSON.parse(data.toString());
      requests.push(request);
      if (!request.id) return;
      const result =
        request.method === 'initialize'
          ? {}
          : request.method === 'config/read'
            ? { config: effectiveConfig }
            : { data: [{ model: 'fallback-model', isDefault: true, defaultReasoningEffort: 'medium' }] };
      child.stdout.write(JSON.stringify({ id: request.id, result }) + '\n');
    });
    return child;
  };
  const defaults = await readModelDefaults('C:/project', { spawnProcess });
  assert.equal(defaults.model, 'project-model');
  assert.match(modelLabel({}, defaults), /project-model.*inherited.*high/);
  assert.match(modelLabel({ model: 'explicit-model', reasoningEffort: 'low' }, defaults), /^explicit-model.*low/);
  assert.equal(requests.find(r => r.method === 'config/read').params.cwd, 'C:/project');
  assert.equal(killed, true);
  effectiveConfig = {};
  assert.deepEqual(await readModelDefaults('C:/project', { spawnProcess }), {
    model: 'fallback-model',
    reasoningEffort: 'medium',
  });
  assert.ok(requests.some(r => r.method === 'model/list'));
});

test('model resolution times out and stops the configuration process', async () => {
  const { readModelDefaults } = await import('../src/models.js');
  let killed = false;
  const spawnProcess = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stdin = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {
      killed = true;
    };
    return child;
  };
  await assert.rejects(readModelDefaults('C:/project', { spawnProcess, timeoutMs: 10 }), /Unable to resolve/);
  assert.equal(killed, true);
});

function setup(t) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-models-'));
  const crew = new Crew(folder, { runner: async () => {} });
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  return { crew, selected: 'developer', notice: '', panel: null };
}

test('model choices persist per teammate and are passed to fresh and resumed Codex turns', t => {
  const app = setup(t);
  execute(app, '/model set developer test-model high');
  const member = app.crew.member('developer');
  assert.equal(member.model, 'test-model');
  assert.equal(member.reasoningEffort, 'high');
  assert.match(screen(app.crew, 'developer', '', '', 140, 40), /Model: test-model/);
  assert.equal(new Crew(app.crew.folder).member('developer').model, 'test-model');
  for (const threadId of [null, 'existing-session']) {
    const args = buildArgs(app.crew.folder, { ...member, threadId });
    assert.equal(args[args.indexOf('--model') + 1], 'test-model');
    assert.ok(args.includes('model_reasoning_effort="high"'));
    if (threadId) assert.ok(args.includes(threadId));
  }
  execute(app, '/status');
  assert.match(app.panel.getLines().join('\n'), /developer:.*test-model.*high/);
  execute(app, '/model reset developer');
  assert.equal(member.model, undefined);
  assert.ok(!buildArgs(app.crew.folder, member).includes('--model'));
});

test('model changes are atomic for all members and reject changes during queued or active work', t => {
  const app = setup(t);
  app.crew.queue.pause();
  const task = app.crew.queue.enqueue('reviewer', 'Review');
  assert.throws(() => execute(app, '/model set all test-model medium'), /queued/i);
  assert.ok(app.crew.state.members.every(member => !member.model));
  app.crew.queue.cancel(task.id);
  execute(app, '/model set all test-model medium');
  assert.ok(app.crew.state.members.every(member => member.model === 'test-model'));
  app.crew.running.set('developer', new AbortController());
  assert.throws(() => execute(app, '/model reset developer'), /Stop/);
  app.crew.running.delete('developer');
  assert.throws(() => execute(app, '/model set developer --bad high'), /model/i);
  assert.throws(() => execute(app, '/model set developer test-model bogus'), /effort/i);
});

test('model catalog uses installed Codex cache and handles missing or invalid cache', t => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-catalog-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  assert.deepEqual(readModelCatalog(folder), []);
  writeFileSync(
    join(folder, 'models_cache.json'),
    JSON.stringify({
      models: [
        {
          slug: 'test-model',
          display_name: 'Test',
          visibility: 'list',
          supported_reasoning_levels: [{ effort: 'high' }],
        },
        { slug: 'hidden-model', visibility: 'hide' },
      ],
    }),
  );
  assert.deepEqual(readModelCatalog(folder), [{ id: 'test-model', name: 'Test', efforts: ['high'] }]);
  assert.throws(() => validateModelChoice('test-model', 'low', readModelCatalog(folder)), /supports/);
  writeFileSync(join(folder, 'models_cache.json'), '{broken');
  assert.deepEqual(readModelCatalog(folder), []);
});

test('requested model and effort are captured for the running turn', async t => {
  const app = setup(t);
  execute(app, '/model set developer test-model high');
  let release;
  app.crew.runner = async args => {
    assert.ok(args.includes('test-model'));
    await new Promise(resolve => {
      release = resolve;
    });
  };
  const task = app.crew.queue.enqueue('developer', 'Build');
  assert.equal(app.crew.member('developer').progress.model, 'test-model');
  execute(app, '/progress developer');
  assert.match(app.panel.getLines().join('\n'), /test-model/);
  release();
  await app.crew.queue.settled(task.id);
});

test('Crew Chat and workflow planning use each assigned teammate model', async t => {
  const app = setup(t);
  execute(app, '/model set all test-model high');
  const calls = [];
  app.crew.runner = async (args, prompt, event) => {
    calls.push(args);
    event({ type: 'thread.started', thread_id: 'model-test-session' });
    event({
      type: 'item.completed',
      item: {
        type: 'agent_message',
        text: prompt.includes('PONGKAN_PLAN')
          ? JSON.stringify({ steps: [{ member: 'developer', task: 'Build feature' }], reviewer: 'reviewer' })
          : 'Result',
      },
    });
  };
  const discussion = app.crew.discussions.start('Discuss models', 'developer');
  await app.crew.queue.settled(discussion.taskIds.at(-1));
  const flow = app.crew.workflows.start('Build feature');
  await app.crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  assert.ok(calls.length >= 5);
  assert.ok(calls.every(args => args.includes('test-model') && args.includes('model_reasoning_effort="high"')));
});

test('model list separates choices and provides usable all-crew and selected-member examples', async () => {
  const { modelCatalogLines } = await import('../src/models.js');
  const lines = modelCatalogLines(
    [
      { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', efforts: ['low', 'medium', 'high'] },
      { id: 'gpt-6-astra', name: 'gpt-6-astra', efforts: ['high'] },
    ],
    'frontend-dev',
  );
  const text = lines.join('\n');
  assert.match(text, /\/model set all gpt-6\.1-sol medium/);
  assert.match(text, /\/model set frontend-dev gpt-6\.1-sol medium/);
  assert.match(text, /\/model set frontend-dev gpt-6-astra high/);
  assert.match(text, /\n\ngpt-6-astra\n/);
  assert.match(text, /\/model reset all/);
  assert.ok(!text.includes('NAME|all MODEL'));
});

test('model examples omit effort when the catalog does not list supported efforts', async () => {
  const { modelCatalogLines } = await import('../src/models.js');
  const lines = modelCatalogLines([{ id: 'custom-model', name: 'custom-model', efforts: [] }], 'developer');
  assert.ok(lines.includes('  One teammate: /model set developer custom-model'));
  assert.match(modelCatalogLines([], 'developer').join('\n'), /No readable model cache/);
});
