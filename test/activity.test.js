import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCodexEvent } from '../src/activity.js';
import { screen, clean } from '../src/ui.js';
import { cellWidth } from '../src/markdown.js';

test('shortened activity text reports how many characters are hidden', () => {
  const event = output =>
    describeCodexEvent({
      type: 'item.completed',
      item: { type: 'command_execution', command: 'x'.repeat(507), aggregated_output: output, exit_code: 0 },
    });
  assert.equal(event('a'.repeat(3550)).detail, 'a'.repeat(1200) + '\n[2,350 more characters]');
  assert.match(event('').text, /\[7 more characters\]$/);
  assert.equal(event('a'.repeat(1200)).detail, 'a'.repeat(1200));
  assert.equal(event('short output').detail, 'short output');
});

test('Codex events report real command lifecycle, bounded output, searches and file changes', () => {
  const start = describeCodexEvent({
    type: 'item.started',
    item: { type: 'command_execution', command: 'npm run build' },
  });
  assert.match(start.text, /Running command: npm run build/);
  const done = describeCodexEvent({
    type: 'item.completed',
    item: {
      type: 'command_execution',
      command: 'npm run build',
      exit_code: 1,
      aggregated_output: 'Build failed\n' + 'details '.repeat(500),
    },
  });
  assert.equal(done.kind, 'error');
  assert.match(done.text, /exit 1/);
  assert.ok(done.detail.length < 1300);
  assert.match(
    describeCodexEvent({
      type: 'item.completed',
      item: { type: 'file_change', changes: [{ path: 'app/page.tsx', kind: 'update' }] },
    }).detail,
    /app\/page.tsx/,
  );
  assert.match(
    describeCodexEvent({ type: 'item.started', item: { type: 'web_search', query: 'shadcn docs' } }).text,
    /shadcn docs/,
  );
  assert.equal(
    describeCodexEvent({ type: 'item.completed', item: { type: 'reasoning', text: 'PRIVATE_REASONING' } }),
    null,
  );
});
test('activity shows live action and elapsed time with colored event types and results', () => {
  const member = {
    name: 'developer',
    role: 'Implement',
    status: 'working',
    messages: [],
    progress: { startedAt: Date.now() - 12000, phase: 'command', action: 'npm run build' },
  };
  const crew = {
    state: { members: [member] },
    member: () => member,
    folder: '.',
    activity: [],
    activityEvents: [
      { at: Date.now(), text: 'developer: Command finished (exit 0)', kind: 'command', detail: 'Build succeeded' },
    ],
  };
  for (const columns of [60, 120]) {
    const output = screen(crew, 'developer', '', '', columns, 35, 0, null, { view: 'activity', color: true });
    assert.match(clean(output), /LIVE NOW/);
    assert.match(clean(output), /developer.*\d+s/);
    assert.match(clean(output), /npm run build/);
    assert.match(clean(output), /COMMAND/);
    assert.match(clean(output), /Build succeeded/);
    assert.match(output, /\x1b\[38;5;180m[^\n]*COMMAND/);
    assert.ok(output.split('\n').every(line => cellWidth(line) <= columns - 1));
  }
});
