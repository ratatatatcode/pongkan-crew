// Optional live smoke check. Uses the signed-in Codex account; never dispatches work.
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Crew } from '../src/crew.js';

const root = realpathSync(tmpdir());
const folder = mkdtempSync(join(root, 'pongkan-live-routing-'));
const crew = new Crew(folder);
try {
  const chat = crew.discussions.newConversation();
  chat.messages.push({
    role: 'assistant',
    speaker: 'chief',
    text: 'I propose changing the toggle labels to Show summary when collapsed and Hide summary when expanded. Shall I implement that?',
  });
  for (const text of [
    'Those labels should name what the button controls. Take care of that in the UI.',
    "Sounds right. Let's get it into the UI.",
  ]) {
    const input = { id: '1234abcd', text, target: null, view: 'group', selected: 'developer', conversationId: null };
    const context = crew.inputs.contextFor(input);
    const result = await crew.inputs.resolve(input, context);
    crew.inputs.validate(result, input, context);
    assert.equal(result.action, 'execute');
    assert.equal(result.requiresWrite, true);
    assert.match(result.goal, /summary/i);
    console.log(`PASS: ${JSON.stringify(text)} -> execute, writable implementation`);
  }
  crew.discussions.newConversation();
  for (const text of ['Hey, everyone! Good evening.', "Evening! Hope you're all doing well."]) {
    const input = { id: '1234abcd', text, target: null, view: 'group', selected: 'developer', conversationId: null };
    const context = crew.inputs.contextFor(input);
    const result = await crew.inputs.resolve(input, context);
    crew.inputs.validate(result, input, context);
    assert.equal(result.action, 'discuss');
    assert.equal(result.teamDiscussion, false);
    assert.ok(result.target === null || result.target === crew.leadName);
    console.log(`PASS: ${JSON.stringify(text)} -> one lead reply`);
  }
  for (const text of [
    'Each teammate, introduce yourself briefly in turn.',
    'Have Developer and Reviewer each give their perspective on keyboard navigation. Discuss only.',
  ]) {
    const input = { id: '1234abcd', text, target: null, view: 'group', selected: 'developer', conversationId: null };
    const context = crew.inputs.contextFor(input);
    const result = await crew.inputs.resolve(input, context);
    crew.inputs.validate(result, input, context);
    assert.equal(result.action, 'discuss');
    assert.equal(result.teamDiscussion, true);
    console.log(`PASS: ${JSON.stringify(text)} -> explicitly requested team perspectives`);
  }
  const input = {
    id: '1234abcd',
    text: 'Tell me whether everyone finished the build.',
    target: null,
    view: 'group',
    selected: 'developer',
    conversationId: null,
  };
  const context = crew.inputs.contextFor(input);
  const result = await crew.inputs.resolve(input, context);
  crew.inputs.validate(result, input, context);
  assert.equal(result.action, 'status');
  assert.equal(result.teamDiscussion, false);
  console.log('PASS: asking about the crew -> one status report');
  assert.equal(crew.state.tasks.length, 0);
  console.log('Live routing passed; no project work dispatched.');
} finally {
  await crew.close();
  assert.equal(dirname(folder), root);
  rmSync(folder, { recursive: true, force: true });
}
