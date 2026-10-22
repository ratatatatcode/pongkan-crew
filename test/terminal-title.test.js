import test from 'node:test';
import assert from 'node:assert/strict';
import { terminalTitle, startTerminalTitle } from '../src/terminal-title.js';

function crew() {
  return {
    folder: '/projects/pongkan-crew',
    running: new Map(),
    queue: { paused: false },
    state: { tasks: [], inputs: [] },
  };
}

test('working title bounces with Crew branding and shows simultaneous questions', () => {
  const app = crew();
  app.running.set('developer', {});
  app.state.tasks.push({ status: 'waiting' });
  const frames = Array.from({ length: 6 }, (_, i) => terminalTitle(app, i * 250));
  assert.match(frames[0], /^\[=   \] Pongkan Crew \| Working \(1\).*1 waiting.*pongkan-crew$/);
  assert.match(frames[1], /^\[ =  \]/);
  assert.match(frames[3], /^\[   =\]/);
  assert.equal(frames[4].slice(0, 6), frames[2].slice(0, 6));
  assert.equal(frames[5].slice(0, 6), frames[1].slice(0, 6));
});

test('title distinguishes ready, queued, paused and unanswered questions without false loading', () => {
  const app = crew();
  assert.match(terminalTitle(app), /^\[ok\].*Ready/);
  app.state.tasks.push({ status: 'queued' });
  assert.match(terminalTitle(app), /^\[\.\.\].*Queued \(1\)/);
  app.queue.paused = true;
  assert.match(terminalTitle(app), /^\[\|\|\].*Paused/);
  app.state.inputs.push({ status: 'blocked', question: 'Choose a layout' });
  assert.match(terminalTitle(app), /^\[\?\].*Needs your answer \(1\)/);
  app.state.inputs[0].answeredAt = 1;
  assert.match(terminalTitle(app), /Paused/);
  app.running.set('developer', {});
  assert.match(terminalTitle(app), /Working/);
});

test('project names cannot inject terminal commands or new lines into the title', () => {
  const app = crew();
  app.folder = '/projects/hello\x1b]0;hijack\x07\r\n\u009cworld';
  const title = terminalTitle(app);
  assert.doesNotMatch(title, /[\x00-\x1f\x7f-\x9f]/);
  assert.ok(title.length <= 200);
  app.folder = '/projects/' + 'x'.repeat(1000);
  assert.ok(terminalTitle(app).length <= 200);
});

test('animation writes title sequences only, leaves idle output unchanged, and restores on stop', () => {
  const app = crew();
  const writes = [];
  let callback,
    cancelled = 0,
    unrefed = false,
    now = 0;
  const output = {
    isTTY: true,
    write: value => {
      writes.push(value);
      return true;
    },
  };
  const stop = startTerminalTitle(app, output, {
    env: {},
    originalTitle: 'My original title',
    now: () => now,
    schedule: (fn, delay) => {
      callback = fn;
      assert.equal(delay, 250);
      return {
        unref: () => {
          unrefed = true;
        },
      };
    },
    cancel: () => {
      cancelled++;
    },
  });
  assert.ok(unrefed);
  assert.ok(writes.join('').includes('\x1b]0;[ok] Pongkan Crew'));
  const idleWrites = writes.length;
  now = 250;
  callback();
  assert.equal(writes.length, idleWrites);
  app.running.set('developer', {});
  now = 500;
  callback();
  now = 750;
  callback();
  assert.match(writes.at(-1), /Working/);
  assert.notEqual(writes.at(-1), writes.at(-2));
  assert.doesNotMatch(writes.join(''), /\x1b\[(?:2J|H|\?25)/);
  stop();
  assert.equal(cancelled, 1);
  assert.ok(writes.slice(-2).join('').includes('\x1b]0;My original title\x07'));
  const stoppedWrites = writes.length;
  callback();
  stop();
  assert.equal(writes.length, stoppedWrites);
});

test('noninteractive and dumb terminals do not emit title escapes or start timers', () => {
  for (const [isTTY, env] of [
    [false, {}],
    [true, { TERM: 'dumb' }],
  ]) {
    const stop = startTerminalTitle(
      crew(),
      { isTTY, write: () => assert.fail('No output expected') },
      {
        env,
        schedule: () => assert.fail('No timer expected'),
      },
    );
    stop();
  }
});

test('native console title updates follow animation and restore the original title', () => {
  const titles = [];
  const app = crew();
  app.running.set('developer', {});
  const stop = startTerminalTitle(
    app,
    { isTTY: true, write: () => true },
    {
      env: {},
      originalTitle: 'Original console',
      now: () => 0,
      setTitle: title => titles.push(title),
      schedule: () => 1,
      cancel: () => {},
    },
  );
  assert.match(titles[0], /^\[=   \] Pongkan Crew.*Working/);
  stop();
  assert.equal(titles.at(-1), 'Original console');
});

test('animation respects backpressure and samples saved history at most once a second', () => {
  const app = crew();
  app.running.set('developer', {});
  let reads = 0,
    now = 0,
    callback;
  app.state.tasks.push({
    get status() {
      reads++;
      return 'queued';
    },
  });
  const writes = [];
  const output = {
    isTTY: true,
    writableNeedDrain: false,
    write: value => {
      writes.push(value);
      return true;
    },
  };
  const stop = startTerminalTitle(app, output, {
    env: {},
    now: () => now,
    schedule: fn => {
      callback = fn;
      return 1;
    },
    cancel: () => {},
  });
  const firstReads = reads;
  for (now = 250; now < 1000; now += 250) callback();
  assert.equal(reads, firstReads);
  callback();
  assert.ok(reads > firstReads);
  output.writableNeedDrain = true;
  const before = writes.length;
  now += 250;
  callback();
  assert.equal(writes.length, before);
  output.writableNeedDrain = false;
  stop();
});
