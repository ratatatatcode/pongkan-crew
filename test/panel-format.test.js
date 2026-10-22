import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from './helpers/legacy-crew.js';
import { execute } from '../src/commands.js';
import { screen } from '../src/ui.js';
import { cellWidth } from '../src/markdown.js';

test('task and workflow detail panels render Markdown history and results at narrow widths', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-panel-format-'));
  const crew = new Crew(folder);
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  crew.queue.pause();
  const app = { crew, selected: 'researcher', view: 'group' };
  const body =
    'chief: **The owner controls access**.\n\n- **Receiving**\n- **Cleaning**\n\n[Documentation](https://example.com/docs)\n\n```js\nconst access = true;\n```';
  const task = crew.queue.enqueue('researcher', body);
  task.result = body;
  const flow = crew.workflows.start(body);
  flow.result = body;
  flow.text = '**Fix database isolation**\n\nPrior Crew Chat (historical findings):\n' + body.repeat(100);
  flow.requestGoal = flow.text;
  execute(app, '/workflow list');
  const list = screen(crew, app.selected, '', '', 120, 40, 0, app.panel, { view: 'group' });
  assert.match(list, new RegExp(flow.id));
  assert.match(list, /Fix database isolation/);
  assert.doesNotMatch(list, /\*\*|historical findings|Receiving/);
  assert.ok(app.panel.getRows(80).length < 10);
  flow.text = body;
  for (const command of [`/queue show ${task.id}`, `/workflow show ${flow.id}`]) {
    execute(app, command);
    const before = JSON.stringify(crew.state);
    for (const width of [50, 120]) {
      const output = screen(crew, app.selected, '', '', width, 180, 0, app.panel, { view: 'group' });
      assert.match(output, /The owner controls access/);
      assert.match(output, /Receiving/);
      assert.doesNotMatch(output, /\*\*|```|\]\(https/);
      assert.ok(output.split('\n').every(line => cellWidth(line) <= width - 1));
    }
    assert.equal(JSON.stringify(crew.state), before);
  }
});
