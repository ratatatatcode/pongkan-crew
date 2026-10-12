import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workflowFeed } from '../src/workflow-feed.js';
import { displayMessages, separateDiscussionHistory } from '../src/conversations.js';

test('group feed hides future tasks and never invents self-directed messages', () => {
  const crew = {
    folder: '',
    state: {
      workflows: [{ id: 'flow', lead: 'chief', sourceDiscussionId: 'discussion', text: 'Build page' }],
      tasks: [
        {
          id: 'work',
          workflowId: 'flow',
          member: 'reviewer',
          kind: 'work',
          status: 'completed',
          text: 'Check page',
          result: 'Chief, checked page.',
        },
        {
          id: 'feedback',
          workflowId: 'flow',
          member: 'reviewer',
          kind: 'coordination',
          status: 'queued',
          dependsOn: 'work',
          displayText: 'FUTURE FEEDBACK',
        },
        {
          id: 'summary',
          workflowId: 'flow',
          member: 'chief',
          kind: 'summary',
          status: 'queued',
          dependsOn: 'feedback',
        },
      ],
    },
  };
  const shown = workflowFeed(crew, 100, null, { conversation: true, discussionId: 'discussion' })
    .map(row => row.text)
    .join('\n');
  assert.match(shown, /Chief, checked page/);
  assert.doesNotMatch(shown, /FUTURE FEEDBACK|Waiting for a turn|Summarize the completed|Reviewer ? Reviewer/);
});

test('saved group workflow messages are excluded from personal chat', () => {
  const tasks = [{ id: 'work', member: 'developer', workflowId: 'flow' }];
  const flows = [{ id: 'flow', sourceDiscussionId: 'discussion' }];
  const messages = [
    { role: 'assistant', taskId: 'work', text: 'Chief, done.' },
    { role: 'user', text: 'Private question' },
  ];
  assert.deepEqual(
    displayMessages({ name: 'developer', messages }, tasks, flows).map(m => m.text),
    ['Private question'],
  );
});

test('restart isolates old group workflow transcripts and resets the contaminated personal session once', () => {
  const state = {
    workflows: [{ id: 'flow', sourceConversationId: 'group-chat' }],
    tasks: [{ id: 'work', member: 'developer', workflowId: 'flow' }],
    members: [
      {
        name: 'developer',
        threadId: 'old-session',
        messages: [
          { role: 'assistant', taskId: 'work', text: 'Chief, done.' },
          { role: 'user', text: 'Private question' },
        ],
      },
    ],
    archives: [],
  };
  separateDiscussionHistory(state);
  assert.equal(state.members[0].threadId, null);
  assert.equal(state.members[0].messages[0].channel, 'group');
  assert.equal(state.members[0].messages[1].channel, undefined);
  state.members[0].threadId = 'new-private-session';
  separateDiscussionHistory(state);
  assert.equal(state.members[0].threadId, 'new-private-session');
  assert.equal(state.archives.length, 1);
});
