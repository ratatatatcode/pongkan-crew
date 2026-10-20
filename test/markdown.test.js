import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, wrapText, cellWidth } from '../src/markdown.js';

const content = rows => rows.map(row => row.text).join('\n');
test('workflow JSON displays numbered assignments and reviewer instead of serialized data', () => {
  const plan = {
    steps: [
      { member: 'developer', task: 'Build the app.' },
      { member: 'reviewer', task: 'Check the app.' },
    ],
    reviewer: 'reviewer',
  };
  const output = content(renderMarkdown(JSON.stringify(plan), 60, { names: ['developer', 'reviewer'] }));
  assert.match(output, /1\. Developer/);
  assert.match(output, /Build the app\./);
  assert.match(output, /Reviewer: Reviewer/);
  assert.doesNotMatch(output, /"steps"|"member"/);
});

test('handoff labels are separate headings even without blank lines', () => {
  const rows = renderMarkdown(
    '**Completed work:** Built app.\n**Files:** [README](<C:/project/README.md>)\n**Verification:** Passed.',
    60,
    { folder: 'C:/project' },
  );
  assert.ok(rows.some(row => row.tone === 'heading' && row.text === 'Files:'));
  assert.match(content(rows), /README \[1\]/);
});
test('responses render headings, emphasis and links without raw Markdown syntax', () => {
  const output = content(
    renderMarkdown('# Codex workspace\n\n**Codex** is a [terminal tool](https://example.com/tools).', 65),
  );
  assert.match(output, /Codex workspace/);
  assert.match(output, /Codex is a terminal tool \[1\]/);
  assert.match(output, /\[1\] https:\/\/example.com\/tools/);
  assert.doesNotMatch(output, /\*\*|\]\(https|^# /m);
});
test('Markdown tables become readable entries without pipe separators or broken words', () => {
  const rows = renderMarkdown(
    '| Tool | Similarity |\n| --- | --- |\n| [Codex](https://example.com/codex) | A terminal interface for managing several coding agents. |\n| Pongkan Crew | Organizes teammate conversations and task queues. |',
    54,
  );
  const output = content(rows);
  assert.match(output, /Codex \[1\]/);
  assert.match(output, /Similarity: A terminal interface/);
  assert.match(output, /Pongkan Crew/);
  assert.doesNotMatch(output, /\|/);
  assert.ok(rows.every(row => cellWidth(row.text) <= 54));
});
test('word wrapping and hanging list indentation keep prose readable', () => {
  assert.deepEqual(wrapText('A terminal interface for teams', 20), ['A terminal interface', 'for teams']);
  const output = content(renderMarkdown('- A terminal interface for managing several teammates', 26));
  assert.match(output, /^  • A terminal interface\n    for managing several/m);
});
test('code blocks preserve indentation and literal Markdown characters', () => {
  const rows = renderMarkdown('```js\n  const value = "**keep**";\n```', 60);
  assert.match(content(rows), /  const value = "\*\*keep\*\*";/);
  assert.equal(rows.find(row => row.text.includes('const')).tone, 'code');
});
test('rendered lines respect terminal cell widths for wide and combining characters', () => {
  const rows = renderMarkdown('Hello 🍊 crew — 你好世界 e\u0301. '.repeat(5), 22);
  assert.equal(cellWidth('🍊'), 2);
  assert.equal(cellWidth('e\u0301'), 1);
  assert.ok(rows.every(row => cellWidth(row.text) <= 22));
});
test('local project links use relative references and terminal controls are removed', () => {
  const output = content(
    renderMarkdown('[README](<C:/project/README.md>)\x1b]0;unsafe\x07', 60, { folder: 'C:/project' }),
  );
  assert.match(output, /\[1\] README.md/);
  assert.doesNotMatch(output, /\x1b|\x07/);
});
