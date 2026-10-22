import test from 'node:test';
import assert from 'node:assert/strict';
import { displayMessages } from '../src/conversations.js';
import { workflowFeed } from '../src/workflow-feed.js';
import { Workflows } from '../src/workflows.js';
import { Crew } from '../src/crew.js';
import { screen } from '../src/ui.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('resumed workflow output appears below the new user message in Crew Chat', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-order-'));
  const crew = new Crew(folder);
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const discussion = crew.discussions.newConversation();
  discussion.createdAt = 1;
  discussion.messages.push({ role: 'user', speaker: 'you', text: 'Continue after restart', submittedAt: 20 });
  crew.state.workflows.push({ id: 'flow', createdAt: 2, sourceDiscussionId: discussion.id, status: 'completed' });
  crew.state.tasks.push({
    id: 'reply',
    workflowId: 'flow',
    member: 'chief',
    kind: 'work',
    status: 'completed',
    createdAt: 3,
    startedAt: 21,
    finishedAt: 30,
    result: 'Fresh resumed response',
  });
  const visible = screen(crew, 'chief', '', '', 120, 80, 0, null, { view: 'group' });
  assert.ok(visible.indexOf('Continue after restart') >= 0);
  assert.ok(visible.indexOf('Fresh resumed response') > visible.indexOf('Continue after restart'));
});

test('structured teammate handoffs display readable findings without changing stored results', () => {
  const text = JSON.stringify({
    verdict: 'completed_with_limitations',
    summary: 'Ready for delivery.',
    requirements: [{ requirement: 'Export videos', status: 'pass', evidence: 'Files checked.' }],
    limitations: ['Playback sampled.'],
  });
  const member = { name: 'reviewer', messages: [{ role: 'assistant', text }] };
  const shown = displayMessages(member)[0].text;
  assert.match(shown, /Ready for delivery/);
  assert.match(shown, /Export videos: pass/);
  assert.match(shown, /Playback sampled/);
  assert.doesNotMatch(shown, /"verdict"|"requirements"/);
  assert.equal(member.messages[0].text, text);
});

test('workflow feed can place individual replies after a resume prompt', () => {
  const crew = {
    state: {
      workflows: [{ id: 'flow', createdAt: 1 }],
      tasks: [
        {
          id: 'old',
          workflowId: 'flow',
          member: 'reviewer',
          kind: 'work',
          createdAt: 2,
          finishedAt: 3,
          result: 'Old reply',
          status: 'completed',
        },
        {
          id: 'new',
          workflowId: 'flow',
          member: 'reviewer',
          kind: 'work',
          createdAt: 2,
          startedAt: 20,
          finishedAt: 30,
          result: 'Resumed reply',
          status: 'completed',
        },
      ],
    },
  };
  const rows = workflowFeed(crew, 80, null, { conversation: true, taskId: 'new' });
  assert.match(rows.map(row => row.text).join('\n'), /Resumed reply/);
  assert.doesNotMatch(rows.map(row => row.text).join('\n'), /Old reply/);
});

test('unverified review without a failed requirement does not launch implementation recovery', () => {
  const flow = { id: 'flow', requiresWrite: true, status: 'reviewing' };
  const task = {
    id: 'review',
    workflowId: 'flow',
    kind: 'review',
    text: 'Review',
    inspections: [{ success: true }],
    result: JSON.stringify({
      outcome: 'unverified',
      summary: 'Playback unavailable.',
      criteria: [{ requirement: 'Check playback', status: 'unverified', evidence: 'Cannot inspect continuously.' }],
    }),
  };
  const workflows = new Workflows({ state: { workflows: [flow], tasks: [task] }, notify() {}, save() {} });
  let recovered = false;
  workflows.recover = () => {
    recovered = true;
    return true;
  };
  flow.status = 'reviewing';
  task.status = 'completed';
  workflows.onFinish(task);
  assert.equal(recovered, false);
  assert.match(task.error, /verification.*incomplete/i);
});
