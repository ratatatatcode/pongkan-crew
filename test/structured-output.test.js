import test from 'node:test';
import assert from 'node:assert/strict';
import { verificationResult } from '../src/verification.js';

const report = {
  outcome: 'met',
  criteria: [
    { requirement: 'Exact labels', status: 'pass', evidence: 'Read current source; strings include {summary}.' },
  ],
  summary: 'Both labels verified.',
};
test('verification accepts commentary followed by a complete report', () => {
  const result = verificationResult({
    result: `I'll inspect the source.\n${JSON.stringify(report)}`,
    inspections: [{ success: true }],
  });
  assert.equal(result.outcome, 'met');
  assert.match(result.text, /Both labels verified/);
});
test('verification uses the final report rather than an earlier draft', () => {
  const result = verificationResult({
    result: `${JSON.stringify(report)}\nFinal:\n${JSON.stringify({ ...report, outcome: 'unverified' })}`,
    inspections: [{ success: true }],
  });
  assert.equal(result.outcome, 'unverified');
});
test('invalid or incomplete verification remains a failure', () => {
  for (const result of ['I checked it.', '{"outcome":"met"}', JSON.stringify({ ...report, criteria: [] })])
    assert.throws(() => verificationResult({ result }), /report|structured/i);
});
