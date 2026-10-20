// Optional live check: uses your Codex account for fresh and resumed tool turns.
import assert from 'node:assert/strict';
import { buildArgs, runCodex } from '../src/crew.js';
import { executionContext } from '../src/execution-recovery.js';
import { codexExecutionPolicy } from '../src/codex-permissions.js';

const member = { name: 'permission-check', writable: true, codexPermissions: 'approve' };
for (const turn of ['fresh', 'resumed']) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  const commands = [];
  try {
    await runCodex(
      buildArgs(process.cwd(), member),
      'This is a runtime permissions check. Do not edit project files or spawn agents. ' +
        "Run node -e \"console.log(process.version); console.log(require('node:fs').realpathSync('.'))\" " +
        'and run npm --version (npm.cmd on Windows). Use separate commands. ' +
        'If sandbox access fails, request command-specific escalation through the tool and retry. ' +
        'Do not ask the user in chat. Report the actual results.\n' +
        executionContext(null, codexExecutionPolicy(member)),
      event => {
        if (event.type === 'thread.started') member.threadId = event.thread_id;
        if (event.type === 'item.completed' && event.item?.type === 'command_execution') commands.push(event.item);
        if (event.type === 'turn.failed' || event.type === 'error')
          throw new Error(event.error?.message || event.message || 'Codex failed');
      },
      controller.signal,
      { cwd: process.cwd() },
    );
    for (const tool of ['node', 'npm']) {
      assert.ok(
        commands.some(
          item => new RegExp(`\\b${tool}(?:\\.cmd|\\.exe)?\\b`, 'i').test(item.command) && item.exit_code === 0,
        ),
        `${turn}: no successful ${tool} command; ${JSON.stringify(commands)}`,
      );
    }
    assert.ok(member.threadId, 'Missing session identity');
    console.log(`${turn}: Node and npm passed (${commands.length} command attempts)`);
  } finally {
    clearTimeout(timeout);
  }
}
