import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutInput, navigateInput, promptEnterAction } from '../src/input.js';
import { cellWidth } from '../src/markdown.js';
import { screen } from '../src/ui.js';

test('arrow navigation edits wrapped input before reaching prompt history', () => {
  const text = 'a'.repeat(200);
  const move = (cursor, name, ctrl = false) => navigateInput(text, cursor, { name, ctrl }, 'chief', 60);
  assert.deepEqual(move(100, 'up'), { cursor: 48 });
  assert.deepEqual(move(100, 'down'), { cursor: 152 });
  assert.deepEqual(move(0, 'up'), { history: -1 });
  assert.deepEqual(move(200, 'down'), { history: 1 });
  assert.deepEqual(move(100, 'home'), { cursor: 52 });
  assert.deepEqual(move(100, 'end'), { cursor: 103 });
  assert.deepEqual(move(100, 'home', true), { cursor: 0 });
  assert.deepEqual(move(100, 'end', true), { cursor: 200 });
  assert.deepEqual(move(52, 'left'), { cursor: 51 });
  assert.deepEqual(move(51, 'right'), { cursor: 52 });
  assert.deepEqual(navigateInput('hello', 5, { name: 'up' }, 'chief', 60), { history: -1 });
});

test('explicit line breaks render separate rows and preserve cursor navigation', () => {
  const text = 'first\n\nlast';
  const layout = layoutInput(text, 11, 'chief', 60);
  assert.deepEqual(layout.lines, ['chief> first', '       ', '       last']);
  assert.equal(layout.cursorRow, 2);
  assert.equal(layout.cursorColumn, 11);
  assert.deepEqual(navigateInput(text, 3, { name: 'end' }, 'chief', 60), { cursor: 5 });
  assert.deepEqual(navigateInput(text, 9, { name: 'home' }, 'chief', 60), { cursor: 7 });
  assert.deepEqual(navigateInput(text, 5, { name: 'down' }, 'chief', 60), { cursor: 6 });
  assert.deepEqual(navigateInput(text, 6, { name: 'down' }, 'chief', 60), { cursor: 7 });
  assert.deepEqual(navigateInput(text, 7, { name: 'up' }, 'chief', 60), { cursor: 6 });
  assert.deepEqual(layoutInput('first\n', 6, 'chief', 60).lines, ['chief> first', '       ']);
});

test('Shift+Enter inserts a line break while Enter submits', () => {
  assert.equal(promptEnterAction('\r', { name: 'return' }), 'submit');
  assert.equal(promptEnterAction('\r', { name: 'return', shift: true }), 'newline');
  assert.equal(promptEnterAction('\x1b[13;2u', { sequence: '\x1b[13;2u' }), 'newline');
  assert.equal(promptEnterAction('\x1b[27;2;13~', {}), 'newline');
  assert.equal(promptEnterAction('x', { name: 'x' }), null);
});

test('long prompts wrap and the input viewport follows the cursor instead of truncating to one line', () => {
  const text = '/discuss ' + 'Build a local todo website. '.repeat(20);
  const end = layoutInput(text, Array.from(text).length, 'chief', 60, 4);
  assert.equal(end.lines.length, 4);
  assert.ok(end.hiddenBefore > 0);
  assert.ok(end.lines.every(line => cellWidth(line) < 60));
  assert.ok(end.cursorRow >= 0 && end.cursorRow < 4);
  const start = layoutInput(text, 0, 'chief', 60, 4);
  assert.equal(start.hiddenBefore, 0);
  assert.match(start.lines[1], /chief> \/discuss/);
  assert.equal(start.cursorColumn, 7);
});

test('collapsed input counts hidden characters and keeps the editable cursor visible', () => {
  const text = 'a'.repeat(1000);
  for (const cursor of [0, 500, 1000]) {
    const layout = layoutInput(text, cursor, 'chief', 60, 4);
    assert.equal(layout.lines.length, 4);
    assert.match(layout.lines[0], /\[\d[\d,]* characters hidden\]/);
    const visible = layout.lines
      .slice(1)
      .join('')
      .replace(/chief> | /g, '');
    const hidden = Number(layout.lines[0].match(/\[([\d,]+)/)[1].replaceAll(',', ''));
    assert.equal(hidden + visible.length, text.length);
    assert.ok(layout.cursorRow >= 1 && layout.cursorRow < 4);
    assert.ok(layout.lines.every(line => cellWidth(line) < 60));
  }
  assert.deepEqual(layoutInput('hello', 5, 'chief', 60, 4).lines, ['chief> hello']);
});
test('input wrapping keeps unicode graphemes together and leaves room for the caret at exact boundaries', () => {
  const text = '界🙂e\u0301'.repeat(30);
  const layout = layoutInput(text, Array.from(text).length, 'developer', 40, 5);
  assert.ok(layout.lines.every(line => cellWidth(line) < 40));
  assert.ok(layout.cursorColumn < 40);
  const exact = layoutInput('x'.repeat(12), 12, 'chief', 20, 5);
  assert.equal(exact.cursorRow, 1);
  assert.equal(exact.cursorColumn, 7);
});
test('moving vertically never puts the caret inside a combining grapheme', () => {
  const text = 'e\u0301'.repeat(12);
  const layout = layoutInput(text, 24, 'chief', 20, 5);
  const fromEnd = layoutInput(text, 22, 'chief', 20, 5);
  assert.equal(fromEnd.down, 24);
  const fromMiddle = layoutInput(text, 8, 'chief', 20, 5);
  assert.equal(fromMiddle.down, 24);
  assert.equal(layout.up % 2, 0);
  const mixed = 'x'.repeat(10) + 'e\u0301🙂' + 'x'.repeat(10);
  assert.equal(layoutInput(mixed, Array.from(mixed).length - 1, 'chief', 20, 5).up, 10);
});
test('wrapped composer fits without pushing the footer out of the screen', () => {
  const member = { name: 'chief', role: 'Lead', status: 'ready', messages: [] };
  const crew = { member: () => member, state: { members: [member] }, folder: '.', activity: [] };
  const render = input => screen(crew, 'chief', input, '', 70, 30);
  const long = render('/discuss ' + 'todo website '.repeat(40));
  assert.equal(long.split('\n').length, 30);
  assert.equal(long.split('\n').at(-1), '');
  assert.match(long.split('\n').at(-2), /Tip:/);
  assert.equal(long.split('\n').length, render('').split('\n').length);
  assert.match(long, /Input .*Up\/Down/);
  assert.ok(long.split('\n').every(line => cellWidth(line) <= 69));
});

test('activity and crew views do not read the hidden direct transcript', () => {
  const member = {
    name: 'chief',
    role: 'Lead',
    status: 'ready',
    get messages() {
      throw new Error('Hidden transcript was rendered');
    },
  };
  const crew = { member: () => member, state: { members: [member] }, folder: '.', activity: [] };
  assert.match(screen(crew, 'chief', '', '', 80, 30, 0, null, { view: 'activity' }), /No team activity/);
  assert.match(screen(crew, 'chief', '', '', 80, 30, 0, null, { view: 'group' }), /Start a crew discussion/);
});
