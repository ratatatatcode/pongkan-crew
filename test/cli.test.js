import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
test('CLI entry point starts and displays help', () => {
  const output = execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8', timeout: 10000 });
  assert.match(output, /Usage: node src\/cli.js/);
});
test('CLI preview initializes and renders without calling Codex', t => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-cli-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const output = execFileSync(process.execPath, [cli, '--folder', folder, '--preview'], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.match(output, /Preview/);
  assert.match(output, /CHIEF/i);
});

test('offline syntax check verifies repository JavaScript files', () => {
  const script = fileURLToPath(new URL('../scripts/check-syntax.js', import.meta.url));
  // This launches Node for every source, test and script file; Windows startup can be slow.
  const output = execFileSync(process.execPath, [script], { encoding: 'utf8', timeout: 60000 });
  assert.match(output, /Syntax check passed: \d+ JavaScript files verified/);
});
