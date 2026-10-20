import test from 'node:test';
import assert from 'node:assert/strict';
import { answerShortcut } from '../src/answer-shortcut.js';

const makeApp = () => ({
  selected: 'developer',
  crew: {
    state: {
      tasks: [
        { id: 'a', member: 'chief', status: 'waiting', question: 'Scope?' },
        { id: 'b', member: 'developer', status: 'waiting', question: 'Layout?' },
        { id: 'c', member: 'developer', status: 'completed' },
      ],
    },
  },
});

test('shortcut prefers selected teammate, preserves draft, and cycles waiting questions', () => {
  const app = makeApp();
  const input = answerShortcut(app, 'Use a list');
  assert.equal(input, '/answer b Use a list');
  assert.match(JSON.stringify(app.panel), /Layout\?/);
  assert.equal(answerShortcut(app, input), '/answer a Use a list');
  assert.equal(answerShortcut(app, '/answer a '), '/answer b ');
});

test('shortcut without waiting questions preserves input and reports why', () => {
  const app = makeApp();
  app.crew.state.tasks = [];
  assert.equal(answerShortcut(app, 'draft'), 'draft');
  assert.match(app.notice, /No questions/);
});

test('shortcut answers a routing clarification in the current Crew Chat and preserves the draft', () => {
  const app = makeApp();
  app.view = 'group';
  app.crew.state.activeGroupConversation = 'current';
  app.crew.state.inputs = [
    { id: 'other', view: 'group', conversationId: 'other', status: 'blocked', question: 'Unrelated?' },
    { id: 'route', view: 'group', conversationId: 'current', status: 'blocked', question: 'Which behavior?' },
  ];
  assert.equal(answerShortcut(app, 'Route automatically'), '/answer route Route automatically');
  assert.match(JSON.stringify(app.panel), /Which behavior/);
  assert.match(JSON.stringify(app.panel), /Shift\+Left/);
});
