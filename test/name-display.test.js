import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTeammateNames } from '../src/name-display.js';
import { renderMarkdown } from '../src/markdown.js';

const names = ['chief', 'researcher', 'developer', 'reviewer', 'frontend-dev'];

test('teammate mentions use display capitalization in plans and prose', () => {
  const text = 'researcher: Ask developer, then reviewer. @frontend-dev reports to chief.';
  assert.equal(
    formatTeammateNames(text, names),
    'Researcher: Ask Developer, then Reviewer. @Frontend-dev reports to Chief.',
  );
  assert.equal(formatTeammateNames('developers and chief-helper', names), 'developers and chief-helper');
});

test('name display preserves code, commands, URLs and file names', () => {
  const literals =
    '`reviewer`\n```js\nconst developer = 1;\n```\n/chat reviewer\nsrc/developer.js developer.js https://example.com/reviewer';
  assert.equal(formatTeammateNames(literals, names), literals);
});

test('rendered response mentions capitalize without changing the stored response', () => {
  const text = 'Ask researcher to hand off to developer and reviewer.';
  const rows = renderMarkdown(text, 80, { names });
  assert.equal(rows.map(row => row.text).join('\n'), 'Ask Researcher to hand off to Developer and Reviewer.');
  assert.equal(text, 'Ask researcher to hand off to developer and reviewer.');
});
