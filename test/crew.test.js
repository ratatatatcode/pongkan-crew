import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew, buildArgs, runCodex } from '../src/crew.js';
import { screen } from '../src/ui.js';

test('folder state restores independent conversations and resets interrupted work', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-'));
  try {
    const crew = new Crew(folder);
    crew.member('chief').messages.push({ role: 'user', text: 'Plan this' });
    crew.member('chief').threadId = 'session-1';
    crew.member('chief').status = 'working';
    crew.save();
    const restored = new Crew(folder);
    assert.equal(restored.member('chief').threadId, 'session-1');
    assert.equal(restored.member('chief').status, 'ready');
    assert.equal(restored.member('developer').messages.length, 0);
    assert.match(readFileSync(join(folder, '.pongkan-crew/state.json'), 'utf8'), /Plan this/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('Codex arguments preserve folder, sandbox and explicit session identity', () => {
  const args = buildArgs('C:/project with spaces', { name: 'developer', threadId: 'abc' });
  assert.equal(args[args.indexOf('-C') + 1], 'C:/project with spaces');
  assert.equal(args[args.indexOf('-s') + 1], 'workspace-write');
  assert.deepEqual(args.slice(-3), ['resume', 'abc', '-']);
  assert.equal(buildArgs('/project', { name: 'reviewer' }).includes('read-only'), true);
});

test('crew routes sandbox escalation to automatic review without widening role access', () => {
  const writerArgs = buildArgs('/project', { name: 'developer', writable: true });
  assert.ok(writerArgs.includes('approval_policy="on-request"'));
  assert.ok(writerArgs.includes('approvals_reviewer="auto_review"'));
  assert.equal(writerArgs[writerArgs.indexOf('-s') + 1], 'workspace-write');

  const readerArgs = buildArgs('/project', { name: 'reviewer', writable: false });
  assert.ok(readerArgs.includes('approval_policy="never"'));
  assert.ok(!readerArgs.some(arg => arg.includes('approvals_reviewer=')));
  assert.equal(readerArgs[readerArgs.indexOf('-s') + 1], 'read-only');
  assert.ok(![...writerArgs, ...readerArgs].some(arg => arg.includes('dangerously-bypass')));
});

test('Codex permission modes map to sandbox and approval settings while role access wins', () => {
  const ask = buildArgs('/project', { name: 'developer', writable: true }, null, 'ask');
  assert.equal(ask[ask.indexOf('-s') + 1], 'workspace-write');
  assert.ok(ask.includes('approval_policy="on-request"'));
  assert.ok(ask.includes('approvals_reviewer="user"'));

  const approve = buildArgs('/project', { name: 'developer', writable: true }, null, 'approve');
  assert.equal(approve[approve.indexOf('-s') + 1], 'workspace-write');
  assert.ok(approve.includes('approvals_reviewer="auto_review"'));

  const full = buildArgs('/project', { name: 'developer', writable: true }, null, 'full');
  assert.equal(full[full.indexOf('-s') + 1], 'danger-full-access');
  assert.ok(full.includes('approval_policy="never"'));

  const readOnly = buildArgs('/project', { name: 'developer', writable: true }, null, 'read-only');
  assert.equal(readOnly[readOnly.indexOf('-s') + 1], 'read-only');
  assert.ok(readOnly.includes('approval_policy="never"'));

  const readOnlyRole = buildArgs('/project', { name: 'reviewer', writable: false }, null, 'full');
  assert.equal(readOnlyRole[readOnlyRole.indexOf('-s') + 1], 'read-only');
  assert.ok(readOnlyRole.includes('approval_policy="never"'));
  assert.ok(!readOnlyRole.some(arg => arg.includes('approvals_reviewer=')));
});

test('completed messages and thread IDs persist; failed turns expose errors', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-'));
  try {
    const runner = async (args, prompt, event) => {
      event({ type: 'thread.started', thread_id: 'thread-test' });
      event({ type: 'item.completed', item: { type: 'agent_message', text: 'Done' } });
    };
    const crew = new Crew(folder, { runner });
    await crew.send('developer', 'Build it');
    assert.equal(new Crew(folder).member('developer').messages.at(-1).text, 'Done');
    assert.equal(crew.member('developer').threadId, 'thread-test');
    crew.runner = async () => {
      throw new Error('Sign in first');
    };
    await crew.send('reviewer', 'Review');
    assert.equal(crew.member('reviewer').status, 'error');
    assert.match(crew.member('reviewer').messages.at(-1).text, /Sign in first/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('shared workspace permits only one active writer and rejects busy teammates', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-'));
  let finish;
  try {
    const crew = new Crew(folder, {
      runner: () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    });
    crew.add('builder', 'Build features', true);
    const running = crew.send('developer', 'Build');
    await assert.rejects(crew.send('builder', 'Also build'), /writer/);
    await assert.rejects(crew.send('developer', 'Again'), /already working/);
    finish();
    await running;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('Codex subprocess streams JSON events and reports nonzero exits', async () => {
  process.env.PONGKAN_CODEX_BIN = process.execPath;
  try {
    const events = [];
    await runCodex(
      [
        '-e',
        `process.stdin.resume(); process.stdin.on('end', () => console.log(JSON.stringify({type:'thread.started',thread_id:'real-process'})))`,
      ],
      'hello',
      e => events.push(e),
    );
    assert.equal(events[0].thread_id, 'real-process');
    await assert.rejects(
      runCodex(['-e', `console.error('auth required');process.exit(1)`], '', () => {}),
      /auth required/,
    );
  } finally {
    delete process.env.PONGKAN_CODEX_BIN;
  }
});

test('Codex subprocess starts in the selected project instead of the launcher folder', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-cwd-'));
  process.env.PONGKAN_CODEX_BIN = process.execPath;
  try {
    const events = [];
    await runCodex(
      ['-e', `console.log(JSON.stringify({cwd:process.cwd()}))`],
      '',
      event => events.push(event),
      undefined,
      { cwd: folder },
    );
    assert.equal(events[0].cwd, folder);
    const crew = new Crew(folder, {
      runner: async (...args) => {
        assert.equal(args[4].cwd, crew.folder);
      },
    });
    assert.equal((await crew.send('developer', 'Check project')).status, 'completed');
  } finally {
    delete process.env.PONGKAN_CODEX_BIN;
    rmSync(folder, { recursive: true, force: true });
  }
});

test('terminal rendering removes control sequences from agent output', () => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-'));
  try {
    const crew = new Crew(folder);
    crew.member('chief').messages.push({ role: 'assistant', text: '\x1b[2JHello\x1b]0;title\x07' });
    assert.equal(screen(crew, 'chief', '', '').includes('\x1b'), false);
    assert.match(screen(crew, 'chief', '', '', 45, 20), /Hello/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('cancelling a teammate waits for its subprocess to exit', async () => {
  process.env.PONGKAN_CODEX_BIN = process.execPath;
  const controller = new AbortController();
  try {
    const running = runCodex(
      ['-e', `console.log('{"type":"ready"}');setInterval(()=>{},1000)`],
      '',
      () => controller.abort(),
      controller.signal,
    );
    await assert.rejects(running, /stopped/);
  } finally {
    delete process.env.PONGKAN_CODEX_BIN;
  }
});
