import test from 'node:test';
import assert from 'node:assert/strict';
import { recordExecution, recordToolExecution, executionContext } from '../src/execution-recovery.js';
import { recoveryEvidence, recordRecoveryChange } from '../src/recovery-policy.js';

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
  assert.equal(restored.executionAttempts[0].kind, undefined);
  assert.deepEqual(restored.executionAttempts[0].policy, policy);
  assert.match(executionContext(restored, policy), /EPERM/);
  assert.match(executionContext(restored, policy), /command-specific escalation/);
});

test('raw command failures and successful retries are retained without classifying the error', () => {
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
  assert.match(task.executionAttempts[0].output, /PSSecurityException/);
  assert.equal(task.executionAttempts[1].exitCode, 0);
  assert.equal(task.executionAttempts[1].output, 'passed');
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

test('automatic review receives evidence-based permission guidance without prescribed error recipes', () => {
  const context = executionContext(null, {
    sandbox: 'workspace-write',
    approval: 'on-request',
    reviewer: 'auto_review',
  });
  assert.match(context, /sandbox_permissions.*require_escalated/);
  assert.match(context, /actual operation|complete diagnostic output/i);
  assert.match(context, /Do not ask.*chat/i);
  assert.match(context, /caches/i);
});

test('read-only execution never promises unavailable escalation', () => {
  const context = executionContext(null, { sandbox: 'read-only', approval: 'never', reviewer: null });
  assert.match(context, /Escalation is unavailable/);
  assert.doesNotMatch(context, /retry the failed command with that approval/);
});

test('unknown command failures retain bounded output as evidence, including after serialization', () => {
  const task = {};
  recordExecution(
    task,
    {
      type: 'command_execution',
      command: 'unknown-operation',
      exit_code: 7,
      aggregated_output: 'Unanticipated failure: secret=private-value',
    },
    {},
    'project',
  );
  const restored = JSON.parse(JSON.stringify(task));
  assert.match(restored.executionAttempts[0].output, /Unanticipated failure/);
  assert.doesNotMatch(JSON.stringify(restored), /private-value/);
  assert.equal(recoveryEvidence(restored).length, 1);
});

test('tool observations count as evidence while repeated observations and empty diffs do not', () => {
  const task = {};
  const item = {
    type: 'mcp_tool_call',
    server: 'service',
    tool: 'probe',
    status: 'completed',
    result: { structuredContent: { available: false } },
  };
  recordToolExecution(task, item);
  const initial = recoveryEvidence(task);
  recordToolExecution(task, item);
  recordRecoveryChange(task, { files: [], text: 'No changes.' });
  assert.deepEqual(recoveryEvidence(task), initial);
  recordToolExecution(task, { ...item, result: { structuredContent: { available: true } } });
  assert.equal(recoveryEvidence(task).length, 2);
  recordRecoveryChange(task, { files: ['deliverable.txt'], text: '+verified output' });
  assert.equal(recoveryEvidence(task).length, 3);
});
