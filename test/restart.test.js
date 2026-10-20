import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchRestart } from '../src/restart.js';

function fixture(t, source) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-restart-'));
  const script = join(folder, 'replacement.mjs');
  writeFileSync(script, source);
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  let stderr = '';
  let options;
  const children = [];
  const start = (command, args, settings) => {
    options = settings;
    const child = spawn(command, args, { ...settings, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    children.push(child);
    child.stdout.resume();
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    return child;
  };
  t.after(() => {
    for (const child of children) if (child.exitCode === null) child.kill();
  });
  return {
    folder,
    script,
    start,
    children,
    get stderr() {
      return stderr;
    },
    get options() {
      return options;
    },
  };
}

test('restart keeps the supervisor alive until a ready replacement quits', async t => {
  const f = fixture(
    t,
    `
    import { writeFileSync } from 'node:fs';
    process.send({type:'pongkan-ready'});
    setTimeout(() => {
      writeFileSync(process.argv[2], JSON.stringify(process.argv.slice(3)));
      process.exit(0);
    }, 150);
  `,
  );
  const marker = join(f.folder, 'finished.json');
  let settled = false;
  const pending = launchRestart(f.script, [marker, '--folder', 'project with spaces'], {
    cwd: f.folder,
    spawnProcess: f.start,
  }).then(code => {
    settled = true;
    return code;
  });
  await new Promise(resolve => f.children[0].once('message', resolve));
  assert.equal(settled, false, 'Spawning or becoming ready must not end the supervisor');
  assert.equal(await pending, 0);
  assert.deepEqual(JSON.parse(readFileSync(marker, 'utf8')), ['--folder', 'project with spaces']);
  assert.equal(f.options.detached, false);
  assert.equal(f.options.windowsHide, false);
  assert.deepEqual(f.options.stdio, ['inherit', 'inherit', 'inherit', 'ipc']);
});

test('restart surfaces startup failure instead of treating spawn as success', async t => {
  const f = fixture(t, `console.error('Fixture startup failed'); process.exit(7);`);
  await assert.rejects(launchRestart(f.script, [], { spawnProcess: f.start }), /before becoming ready.*exit code 7/);
  assert.match(f.stderr, /Fixture startup failed/);
});

test('successive restart requests reload children under the same supervisor', async t => {
  const f = fixture(
    t,
    `
    import { existsSync, readFileSync, writeFileSync } from 'node:fs';
    const file = process.argv[2];
    const history = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    history.push({pid:process.pid, parent:process.ppid});
    writeFileSync(file, JSON.stringify(history));
    process.send({type:'pongkan-ready'}, () => {
      if (history.length < 3) process.send({type:'pongkan-restart'}, () => process.exit(0));
      else process.exit(0);
    });
  `,
  );
  const historyPath = join(f.folder, 'history.json');
  assert.equal(await launchRestart(f.script, [historyPath], { spawnProcess: f.start }), 0);
  const history = JSON.parse(readFileSync(historyPath, 'utf8'));
  assert.equal(history.length, 3);
  assert.equal(new Set(history.map(entry => entry.pid)).size, 3);
  assert.ok(history.every(entry => entry.parent === process.pid));
});
