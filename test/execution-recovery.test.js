import test from 'node:test';
import assert from 'node:assert/strict';
import { recordExecution, executionContext } from '../src/execution-recovery.js';

test('filesystem failures survive serialization and reach retry context', () => {
  const task = {};
  const policy = { sandbox: 'workspace-write', approval: 'on-request' };
  recordExecution(
    task,
    {
      type: 'command_execution',
      command: 'node --test',
      exit_code: 1,
      aggregated_output: "Error: EPERM: operation not permitted, lstat 'C:\\Users\\Admin'",
    },
    policy,
    'project',
  );
  const restored = JSON.parse(JSON.stringify(task));
  assert.equal(restored.executionAttempts[0].kind, 'filesystem-access');
  assert.deepEqual(restored.executionAttempts[0].policy, policy);
  assert.match(executionContext(restored, policy), /EPERM/);
  assert.match(executionContext(restored, policy), /command-specific escalation/);
});

test('PowerShell policy errors are distinguished and successful retry is retained', () => {
  const task = {};
  recordExecution(
    task,
    {
      type: 'command_execution',
      command: 'npm test',
      exit_code: 1,
      aggregated_output: 'npm.ps1 cannot be loaded. PSSecurityException: execution policy',
    },
    {},
    'project',
  );
  recordExecution(
    task,
    {
      type: 'command_execution',
      command: 'npm.cmd test',
      exit_code: 0,
      aggregated_output: 'passed',
    },
    {},
    'project',
  );
  assert.equal(task.executionAttempts[0].kind, 'powershell-policy');
  assert.equal(task.executionAttempts[1].exitCode, 0);
  assert.equal(task.executionAttempts[1].accessFailure, '');
});

test('command history is bounded and common secrets are redacted', () => {
  const task = {};
  for (let i = 0; i < 25; i++)
    recordExecution(
      task,
      {
        type: 'command_execution',
        command: `node script --token=private${i}`,
        exit_code: 1,
        aggregated_output: 'EACCES token=private-output',
      },
      {},
      'project',
    );
  assert.equal(task.executionAttempts.length, 20);
  assert.doesNotMatch(JSON.stringify(task), /private/);
  assert.match(task.executionAttempts[0].command, /REDACTED/);
});

test('automatic review retries Node startup and npm failures without a clarification pause', () => {
  const context = executionContext(null, {
    sandbox: 'workspace-write',
    approval: 'on-request',
    reviewer: 'auto_review',
  });
  assert.match(context, /sandbox_permissions.*require_escalated/);
  assert.match(context, /Node startup.*lstat/i);
  assert.match(context, /Do not ask.*chat/i);
  assert.match(context, /npm cache/i);
});

test('read-only execution never promises unavailable escalation', () => {
  const context = executionContext(null, { sandbox: 'read-only', approval: 'never', reviewer: null });
  assert.match(context, /Escalation is unavailable/);
  assert.doesNotMatch(context, /retry the failed command with that approval/);
});
