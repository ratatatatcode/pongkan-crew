import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { emitKeypressEvents } from 'node:readline';
import { terminalInput } from '../src/scroll.js';
import { promptEnterAction, layoutInput } from '../src/input.js';

test('wheel reports scroll separately while arrow keys reach prompt navigation', () => {
  const keyboard = new PassThrough();
  keyboard.setEncoding('utf8');
  emitKeypressEvents(keyboard);
  const keys = [],
    scrolls = [];
  keyboard.on('keypress', (text, key) => keys.push(key.name));
  terminalInput(
    text => keyboard.write(text),
    amount => scrolls.push(amount),
  )('\x1b[A\x1b[<64;12;8M\x1b[Bx');
  assert.deepEqual(keys, ['up', 'down', 'x']);
  assert.deepEqual(scrolls, [3]);
  keyboard.destroy();
});

test('Shift+Enter survives terminal decoding and inserts at the cursor without submitting', () => {
  const keyboard = new PassThrough();
  keyboard.setEncoding('utf8');
  emitKeypressEvents(keyboard);
  const input = Array.from('firstlast');
  let cursor = 5;
  const sent = [];
  keyboard.on('keypress', (text, key) => {
    const action = promptEnterAction(text, key);
    if (action === 'newline') input.splice(cursor++, 0, '\n');
    else if (action === 'submit') sent.push(input.join(''));
  });
  const consume = terminalInput(
    text => keyboard.write(text),
    () => {},
  );
  consume('\x1b[13;');
  consume('2u');
  assert.equal(input.join(''), 'first\nlast');
  assert.deepEqual(sent, []);
  assert.equal(layoutInput(input.join(''), cursor, 'chief', 60).cursorRow, 1);
  consume('\x1b[27;2;13~');
  assert.equal(input.join(''), 'first\n\nlast');
  consume('\r');
  assert.deepEqual(sent, ['first\n\nlast']);
  keyboard.destroy();
});
