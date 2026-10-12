export const CODEX_PERMISSION_MODES = [
  {
    id: 'ask',
    label: 'Ask for approval',
    description: 'Workspace writes; ask before access outside it.',
    sandbox: 'workspace-write',
    approval: 'on-request',
  },
  {
    id: 'approve',
    label: 'Approve for me',
    description: 'Workspace writes; auto-review requests outside it.',
    sandbox: 'workspace-write',
    approval: 'on-request',
  },
  {
    id: 'full',
    label: 'Full Access',
    description: 'Allow unrestricted access without approval. Use with caution.',
    sandbox: 'danger-full-access',
    approval: 'never',
  },
  {
    id: 'read-only',
    label: 'Read Only',
    description: 'Read workspace files; block edits and escalation.',
    sandbox: 'read-only',
    approval: 'never',
  },
];

export function codexPermissionMode(id) {
  return CODEX_PERMISSION_MODES.find(mode => mode.id === id) || CODEX_PERMISSION_MODES[1];
}

export function codexExecutionPolicy(member, selectedMode = member.codexPermissions || 'approve') {
  const mode = codexPermissionMode(selectedMode);
  const writable = (member.writable ?? member.name === 'developer') && mode.id !== 'read-only';
  if (!writable) return { sandbox: 'read-only', approval: 'never', reviewer: null };
  return {
    sandbox: mode.sandbox,
    approval: mode.approval,
    reviewer: mode.id === 'approve' ? 'auto_review' : mode.id === 'ask' ? 'user' : null,
  };
}
