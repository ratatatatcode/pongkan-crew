import test from 'node:test';
import assert from 'node:assert/strict';
import { workflowFeed } from '../src/workflow-feed.js';

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
  assert.match(output, /Reviewer: reviewer/);
  assert.match(output, /Assignment:\n/);
  assert.match(output, /\n\nResult\n/);
  assert.doesNotMatch(output, /\*\*/);
  assert.match(output, /  1\. Verify[^\n]*\n     /);
});
