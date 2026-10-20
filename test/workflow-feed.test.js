import test from 'node:test';
import assert from 'node:assert/strict';
import { workflowFeed } from '../src/workflow-feed.js';

test('Crew Chat separates progress from the next turn and formats recovery decisions', () => {
  const crew = {
    state: {
      workflows: [{ id: 'flow', lead: 'chief' }],
      tasks: [
        { id: 'work', workflowId: 'flow', member: 'chief', kind: 'summary', status: 'running' },
        {
          id: 'recovery',
          workflowId: 'flow',
          member: 'chief',
          kind: 'coordination',
          status: 'failed',
          recoveryFor: 'work',
          schema: {},
          result: JSON.stringify({ action: 'retry', member: 'developer', instruction: 'Run npm.cmd test.' }),
        },
      ],
    },
  };
  const rows = workflowFeed(crew, 80, null, { conversation: true });
  const progress = rows.findIndex(row => row.text.includes('Preparing the final summary'));
  assert.equal(rows[progress + 1].text, '');
  assert.equal(rows[progress + 2].text, '');
  const text = rows.map(row => row.text).join('\n');
  assert.doesNotMatch(text, /"action"|"instruction"/);
  assert.match(text, /Run npm.cmd test/);
});

test('Crew Chat separates a wrapped task error from the next user turn', () => {
  const crew = {
    state: {
      workflows: [{ id: 'flow', lead: 'backend-dev', text: 'Fix isolation' }],
      tasks: [
        {
          id: 'work',
          workflowId: 'flow',
          member: 'backend-dev',
          kind: 'work',
          status: 'failed',
          error:
            'Required Database-dev confirmation remains unavailable. Route the existing contract for acceptance before implementation.',
        },
      ],
    },
  };
  const rows = workflowFeed(crew, 60, null, { conversation: true });
  assert.ok(rows.filter(row => row.tone === 'system').length > 1);
  assert.equal(rows.at(-1).text, '');
  assert.equal(rows.at(-2).text, '');
});

test('Activity renders readable plans and separates assignments from Markdown results', () => {
  const crew = {
    folder: '',
    state: {
      workflows: [{ id: 'flow', lead: 'chief', text: 'Build the page' }],
      tasks: [
        {
          id: 'plan',
          workflowId: 'flow',
          member: 'chief',
          kind: 'plan',
          status: 'completed',
          result: JSON.stringify({ steps: [{ member: 'developer', task: 'Build the page' }], reviewer: 'reviewer' }),
        },
        {
          id: 'work',
          workflowId: 'flow',
          member: 'developer',
          kind: 'work',
          status: 'completed',
          text: '**Assignment:** Build the page',
          result: '1. Verify the page with keyboard navigation and confirm all controls work.',
        },
      ],
    },
  };
  const output = workflowFeed(crew, 72)
    .map(row => row.text)
    .join('\n');
  assert.match(output, /Reviewer: Reviewer/);
  assert.match(output, /Assignment:\n/);
  assert.match(output, /\n\nResult\n/);
  assert.doesNotMatch(output, /\*\*/);
  assert.match(output, /  1\. Verify[^\n]*\n     /);
});
