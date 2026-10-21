import { createHash } from 'node:crypto';

// A cost ceiling is separate from the limit on attempts that learn nothing.
export const MAX_RECOVERY_ATTEMPTS = 12;
export const MAX_RECOVERY_STALLS = 2;
export const RECOVERY_BOUNDARIES = ['approval_denied', 'credentials', 'user_decision', 'unavailable_access'];

export const RECOVERY_BOUNDARY_SCHEMA = {
  anyOf: [
    { type: 'null' },
    {
      type: 'object',
      additionalProperties: false,
      required: ['kind', 'evidence', 'userAction'],
      properties: {
        kind: { type: 'string', enum: RECOVERY_BOUNDARIES },
        evidence: { type: 'string' },
        userAction: { type: 'string' },
      },
    },
  ],
};

export const investigationInstruction =
  'Own the requested outcome. Investigate the actual environment and current artifacts before declaring a prerequisite unavailable. ' +
  'Form falsifiable hypotheses, run a small discriminating test, record the result, and choose a changed approach from the evidence. ' +
  'Discover capabilities through the available tools and official documentation rather than assuming a particular runtime, installation path, service, or operating system. ' +
  'A missing command or dependency is a repair candidate, not automatically a user task. An existing authorized writer may set up necessary project-local dependencies and test them on a small input, using the configured approval tool for network or external access. ' +
  'Do not install globally, use paid services, change permissions, bypass a denied approval, or expand scope without authorization. ' +
  'Preserve completed artifacts, report reproducible evidence and the success check, and return to the original assignment after the prerequisite is verified. ' +
  'Before retrying an operation with external effects, inspect whether the earlier attempt already succeeded; do not blindly repeat irreversible actions. ' +
  'A prepared artifact, an installation, or a plan alone does not establish that the required operation works. ' +
  'If unresolved, report findings using PONGKAN_BLOCKED so the application can coordinate the next investigation automatically; do not tell the user to run /recovery.';

export function recoveryEvidence(task) {
  const observations = [
    ...(task.executionAttempts || []).map(({ command, cwd, policy, exitCode, status, output, accessFailure }) => ({
      command,
      cwd,
      policy,
      exitCode,
      status,
      output,
      accessFailure,
    })),
    ...(task.toolAttempts || []),
  ];
  return [
    ...new Set([
      ...observations.map(observation => createHash('sha256').update(JSON.stringify(observation)).digest('hex')),
      ...(task.changeEvidence || []),
    ]),
  ];
}

export function recordRecoveryChange(task, diff) {
  if (!diff?.files?.length) return;
  const signature = createHash('sha256').update(diff.text).digest('hex');
  task.changeEvidence = [...new Set([...(task.changeEvidence || []), signature])].slice(-10);
}

export function recoveryBoundary(decision) {
  const boundary = decision.boundary;
  return boundary &&
    RECOVERY_BOUNDARIES.includes(boundary.kind) &&
    typeof boundary.evidence === 'string' &&
    boundary.evidence.trim() &&
    boundary.evidence.length <= 4000 &&
    typeof boundary.userAction === 'string' &&
    boundary.userAction.trim() &&
    boundary.userAction.length <= 2000
    ? boundary
    : null;
}
