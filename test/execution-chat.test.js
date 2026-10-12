import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from '../src/crew.js';
import { execute } from '../src/commands.js';
import { screen } from '../src/ui.js';

test('crew execution exchanges real replies and applies reviewer feedback before final review', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-execution-chat-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const calls = [];
  let crew;
  crew = new Crew(folder, {
    runner: async (args, prompt, event) => {
      const task = crew.state.tasks.find(task => task.status === 'running');
      calls.push({ task: { ...task }, prompt, args });
      let text = 'Initial discussion.';
      if (task.kind === 'plan')
        text = JSON.stringify({ steps: [{ member: 'developer', task: 'Build navigation' }], reviewer: 'reviewer' });
      else if (task.exchange === 'kickoff') text = 'Developer, preserve keyboard focus.';
      else if (task.kind === 'work') {
        assert.match(prompt, /Developer, preserve keyboard focus/);
        assert.match(prompt, /Reply directly to chief about their briefing as you implement/);
        text = 'Chief, keyboard focus is preserved. Navigation implemented.';
      } else if (task.exchange === 'feedback') {
        assert.match(prompt, /Navigation implemented/);
        text = 'Developer, the Escape key needs handling.';
      } else if (task.kind === 'revision') {
        assert.match(prompt, /Developer, the Escape key needs handling/);
        text = 'Reviewer, Escape handling is fixed and tested.';
      } else if (task.kind === 'review') {
        assert.match(prompt, /Reviewer, Escape handling is fixed and tested/);
        assert.equal(prompt.split('Developer, the Escape key needs handling.').length - 1, 1);
        text = 'Final review complete.';
      } else if (task.kind === 'summary') text = 'Completed with review feedback addressed.';
      event({ type: 'item.completed', item: { type: 'agent_message', text } });
    },
  });
  const discussion = crew.discussions.start('Plan navigation', 'developer');
  await crew.queue.settled(discussion.taskIds.at(-1));
  execute({ crew, view: 'group', selected: 'developer' }, '/crew-task');
  const flow = crew.state.workflows.at(-1);
  await crew.workflows.settled(flow.id);
  assert.equal(flow.status, 'completed');
  const execution = calls.filter(call => call.task.workflowId === flow.id);
  assert.deepEqual(
    execution.map(call => call.task.kind),
    ['plan', 'coordination', 'work', 'coordination', 'revision', 'review', 'summary'],
  );
  assert.ok(execution.filter(call => call.task.kind === 'coordination').every(call => call.args.includes('read-only')));
  const visible = screen(crew, 'developer', '', '', 120, 250, 0, null, { view: 'group' });
  assert.match(visible, /Developer, preserve keyboard focus/);
  assert.match(visible, /Developer, the Escape key needs handling/);
  assert.match(visible, /Reviewer, Escape handling is fixed and tested/);
  const restored = new Crew(folder);
  assert.equal(
    restored.state.tasks.filter(task => task.workflowId === flow.id && task.kind === 'coordination').length,
    2,
  );
  await crew.close();
});

test('cancelling during an execution conversation prevents implementation and later replies', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-execution-stop-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  let started;
  const ready = new Promise(resolve => (started = resolve));
  const calls = [];
  let crew;
  crew = new Crew(folder, {
    runner: async (args, prompt, event, signal) => {
      const task = crew.state.tasks.find(task => task.status === 'running');
      calls.push(task.kind);
      if (task.kind === 'coordination') {
        started();
        await new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('Stopped')), { once: true });
        });
      } else {
        event({
          type: 'item.completed',
          item: {
            type: 'agent_message',
            text:
              task.kind === 'plan'
                ? JSON.stringify({ steps: [{ member: 'developer', task: 'Build navigation' }], reviewer: 'reviewer' })
                : 'Discussed navigation.',
          },
        });
      }
    },
  });
  const discussion = crew.discussions.start('Plan navigation', 'developer');
  await crew.queue.settled(discussion.taskIds.at(-1));
  execute({ crew, view: 'group', selected: 'developer' }, '/crew-task');
  const flow = crew.state.workflows.at(-1);
  await ready;
  assert.equal(flow.status, 'collaborating');
  execute({ crew, view: 'group', selected: 'developer' }, '/stop');
  assert.equal(flow.status, 'cancelled');
  await crew.queue.settled(flow.currentTask);
  assert.deepEqual(calls, ['message', 'plan', 'coordination']);
  assert.ok(
    crew.state.tasks
      .filter(task => task.workflowId === flow.id && task.kind !== 'plan')
      .every(task => task.status === 'cancelled'),
  );
  await crew.close();
});

test('Crew Chat stop follows discussion history and leaves unrelated workflows queued', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-execution-scope-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const crew = new Crew(folder);
  crew.queue.pause();
  const first = crew.discussions.start('Plan navigation', 'developer');
  crew.discussions.stop();
  const linked = crew.workflows.start('Implement navigation', { sourceDiscussionId: first.id });
  const unrelated = crew.workflows.start('A separate private goal');
  crew.discussions.start('What is the status?', 'developer');
  execute({ crew, view: 'group', selected: 'developer' }, '/stop');
  assert.equal(linked.status, 'cancelled');
  assert.equal(unrelated.status, 'planning');
  assert.ok(crew.state.tasks.filter(task => task.workflowId === unrelated.id).every(task => task.status === 'queued'));
  await crew.close();
});
