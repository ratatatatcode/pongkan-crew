import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { launchRestart } from '../src/restart.js';

test('Windows restart preserves launch arguments and shares the current console', async () => {
  const child = new EventEmitter();
  let command;
  let args;
  let options;
  const launched = launchRestart('C:/crew/src/cli.js', ['--folder', 'C:/project'], {
    cwd: 'C:/crew',
    platform: 'win32',
    spawnProcess: (...values) => {
      [command, args, options] = values;
      queueMicrotask(() => child.emit('spawn'));
      return child;
    },
  });

  assert.equal(await launched, child);
  assert.equal(command, process.execPath);
  assert.deepEqual(args, ['C:/crew/src/cli.js', '--folder', 'C:/project']);
  assert.equal(options.cwd, 'C:/crew');
  assert.equal(options.detached, false);
  assert.equal(options.windowsHide, false);
  assert.equal(options.stdio, 'inherit');
});

test('POSIX restart detaches from the exiting parent but inherits the terminal', async () => {
  const child = new EventEmitter();
  let options;
  const launched = launchRestart('/crew/src/cli.js', [], {
    platform: 'linux',
    spawnProcess: (_command, _args, spawnOptions) => {
      options = spawnOptions;
      queueMicrotask(() => child.emit('spawn'));
      return child;
    },
  });

  assert.equal(await launched, child);
  assert.equal(options.detached, true);
  assert.equal(options.stdio, 'inherit');
});
