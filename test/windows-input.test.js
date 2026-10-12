import test from 'node:test';
import assert from 'node:assert/strict';
import { enableWindowsMouse, connectWindowsInput, startWindowsInput } from '../src/windows-input.js';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { terminalInput } from '../src/scroll.js';

test('Windows reader inherits the terminal input handle instead of opening NUL', () => {
  startWindowsInput((command, args, options) => {
    assert.equal(command, 'powershell.exe');
    assert.deepEqual(options.stdio, ['inherit', 'pipe', 'pipe']);
    assert.equal(options.windowsHide, true);
  });
});

test(
  'native Windows console reader forwards wheel reports and keyboard text',
  { skip: process.platform !== 'win32' },
  () => {
    const output = execFileSync(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-File',
        fileURLToPath(new URL('../src/windows-input.ps1', import.meta.url)),
        '-SelfTest',
      ],
      { windowsHide: true, encoding: 'utf8', timeout: 15000 },
    );
    assert.equal(output[0], '\0');
    let text = '';
    const wheel = [];
    terminalInput(
      chunk => {
        text += chunk;
      },
      delta => wheel.push(delta),
    )(output.slice(1));
    assert.deepEqual(wheel, [3, -3]);
    assert.equal(text, '\t\x1bOQ\x1b[A\x7f\x1b[5~\x1b[6~\x1b[H\x1b[F\x1b[B\x1b[1;2C\x1b[1;2Q\x1b[Z\x1b[13;2uhello\r');
  },
);

test('Windows mouse setup enables VT input and restores original mode once', () => {
  const calls = [];
  const restore = enableWindowsMouse('win32', mode => {
    calls.push(mode);
    return 503;
  });
  assert.deepEqual(calls, [null]);
  restore();
  restore();
  assert.deepEqual(calls, [null, 503]);
});

test('other platforms do not change Windows console settings', () => {
  enableWindowsMouse('linux', () => {
    throw new Error('unexpected Windows call');
  })();
});

test('Windows input forwards native wheel and keys after readiness without a competing stdin reader', () => {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  let killed = 0,
    ready = 0,
    fallback = 0,
    text = '';
  child.kill = () => {
    killed++;
  };
  const stop = connectWindowsInput(
    chunk => {
      text += chunk;
    },
    () => {
      fallback++;
    },
    () => {
      ready++;
    },
    () => {},
    () => child,
  );
  child.stdout.write('\0\x1b[<65;12;8M\x1b[6~');
  assert.equal(ready, 1);
  assert.equal(fallback, 0);
  assert.equal(text, '\x1b[<65;12;8M\x1b[6~');
  stop();
  stop();
  child.emit('exit', 0);
  assert.equal(killed, 1);
  assert.equal(fallback, 0);
});

test('failed Windows reader falls back once and reports the loss of native mouse input', () => {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => {};
  let fallback = 0,
    errors = 0;
  const stop = connectWindowsInput(
    () => {},
    () => {
      fallback++;
    },
    () => {},
    () => {
      errors++;
    },
    () => child,
  );
  child.emit('error', new Error('cannot launch'));
  child.emit('exit', 1);
  assert.equal(fallback, 1);
  assert.equal(errors, 1);
  stop();
});
