import { structuredOutput } from './structured-output.js';
export const VERIFICATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['outcome', 'criteria', 'summary', 'limitations'],
  properties: {
    outcome: { type: 'string', enum: ['met', 'needs_work', 'unverified'] },
    criteria: {
      type: 'array',
      minItems: 1,
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['requirement', 'status', 'evidence'],
        properties: {
          requirement: { type: 'string' },
          status: { type: 'string', enum: ['pass', 'fail', 'unverified'] },
          evidence: { type: 'string' },
        },
      },
    },
    summary: { type: 'string' },
    limitations: { type: 'array', maxItems: 12, items: { type: 'string', minLength: 1, maxLength: 4000 } },
  },
};

export function verificationResult(task) {
  const report = structuredOutput(task.result, ['outcome', 'criteria', 'summary']);
  if (
    !['met', 'needs_work', 'unverified'].includes(report.outcome) ||
    typeof report.summary !== 'string' ||
    !Array.isArray(report.criteria) ||
    (report.limitations !== undefined &&
      (!Array.isArray(report.limitations) ||
        report.limitations.length > 12 ||
        report.limitations.some(value => typeof value !== 'string' || !value.trim() || value.length > 4000))) ||
    report.criteria.length < 1 ||
    report.criteria.length > 12 ||
    report.criteria.some(
      criterion =>
        !criterion ||
        !['pass', 'fail', 'unverified'].includes(criterion.status) ||
        typeof criterion.requirement !== 'string' ||
        !criterion.requirement.trim() ||
        typeof criterion.evidence !== 'string' ||
        !criterion.evidence.trim(),
    )
  )
    throw new Error('Invalid outcome verification report.');
  let outcome = report.criteria.some(criterion => criterion.status === 'fail')
    ? 'needs_work'
    : report.criteria.some(criterion => criterion.status === 'unverified')
      ? 'unverified'
      : report.outcome;
  const inspected = (task.inspections || []).some(inspection => inspection.success);
  if (outcome === 'met' && !inspected) outcome = 'unverified';
  return {
    outcome,
    criteria: report.criteria,
    limitations: report.limitations || [],
    text: [
      `Requested outcome: ${outcome.replace('_', ' ')}`,
      report.summary,
      ...report.criteria.map(criterion => `- ${criterion.requirement}: ${criterion.status}. ${criterion.evidence}`),
      ...(report.limitations?.length
        ? [`Review limitations:\n${report.limitations.map(value => `- ${value}`).join('\n')}`]
        : []),
      ...(!inspected
        ? ['No independent inspection evidence was recorded; teammate reports alone do not verify completion.']
        : []),
    ].join('\n\n'),
  };
}
