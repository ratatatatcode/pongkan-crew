import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from '../src/crew.js';
import { answerShortcut } from '../src/answer-shortcut.js';
import { screen } from '../src/ui.js';

function setup(t) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-question-panel-'));
  const crew = new Crew(folder);
  crew.queue.pause();
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const task = crew.queue.enqueue('developer', 'Build artifact');
  task.status = 'waiting';
  task.question = 'Which layout?';
  return { crew, task, selected: 'developer', view: 'chat' };
}

test('Shift+Right question section shows the live answer draft while typing', t => {
  const app = setup(t);
  const command = answerShortcut(app, 'Use a list');
  const visible = screen(app.crew, app.selected, command + ' with icons', '', 120, 50, 0, app.panel);
  assert.match(visible, /Which layout/);
  assert.match(visible, /Your response/);
  assert.match(visible, /Use a list with icons/);
});

test('answered task shows question and response immediately, even while the queue is paused', t => {
  const app = setup(t);
  app.crew.queue.answer(app.task.id, 'Use a list');
  const visible = screen(app.crew, app.selected, '', '', 120, 65);
  assert.match(visible, /Question.*Answered/);
  assert.match(visible, /Which layout/);
  assert.match(visible, /Your response/);
  assert.match(visible, /Use a list/);
});

test('crew workflow answers remain visible after restart', t => {
  const app = setup(t);
  const discussion = app.crew.discussions.newConversation();
  const flow = app.crew.workflows.start('Build artifact', { sourceDiscussionId: discussion.id });
  const task = app.crew.state.tasks.find(task => task.workflowId === flow.id);
  task.status = 'waiting';
  task.question = 'Which export?';
  app.crew.queue.answer(task.id, 'MP4');
  const restored = new Crew(app.crew.folder);
  const visible = screen(restored, 'chief', '', '', 120, 80, 0, null, { view: 'group' });
  assert.match(visible, /Question.*Answered/);
  assert.match(visible, /Which export/);
  assert.match(visible, /Your response/);
  assert.match(visible, /MP4/);
});

test('answers after an in-session recovery show the response instead of internal continuation instructions', async t => {
  const app = setup(t);
  app.task.status = 'completed';
  let turns = 0;
  app.crew.runner = async (_args, _prompt, event) => {
    const text =
      ++turns === 1
        ? 'PONGKAN_BLOCKED: Investigate the failed tool.'
        : turns === 2
          ? 'PONGKAN_QUESTION: Which format?'
          : 'Exported MP4.';
    event({ type: 'item.completed', item: { type: 'agent_message', text } });
  };
  const task = app.crew.queue.enqueue('developer', 'Export artifact');
  app.crew.queue.resume();
  while (task.status !== 'waiting') await new Promise(resolve => setTimeout(resolve, 5));
  app.crew.queue.answer(task.id, 'MP4');
  await app.crew.queue.settled(task.id);
  const visible = screen(app.crew, app.selected, '', '', 140, 100);
  assert.match(visible, /Your response/);
  assert.match(visible, /MP4/);
  assert.doesNotMatch(visible, /Automatic recovery guidance|User clarification answers for this assignment/);
});
