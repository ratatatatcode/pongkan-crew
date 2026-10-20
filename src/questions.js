export function clarificationContext(answers) {
  return (
    '\n\nUser clarification answers for this assignment:\n' +
    answers.map(a => `Question: ${a.question}\nAnswer: ${a.answer}`).join('\n\n') +
    '\nContinue the existing assignment from current files; do not blindly repeat completed edits.'
  );
}

export function workPolicy(enabled) {
  return (
    '\nWORKING WITH THE USER\n' +
    (enabled !== false
      ? 'Questions are ON. Make routine implementation choices yourself. For a material missing preference or requirement, finish independent work, then end your final response with a single line PONGKAN_QUESTION: followed by the specific question. This pauses this assignment until the user answers. Do not use this for permission approvals.\n'
      : 'Questions are OFF. Decide routine product/implementation choices yourself, report assumptions, and continue within the authorized task. Do not emit PONGKAN_QUESTION or wait for optional preferences.\n') +
    'Use existing applicable approvals; do not repeatedly ask for authorization already granted. If a necessary command fails due to sandbox access (such as Node/npm EPERM), request command-specific escalation through the configured approval mechanism and retry only with a meaningful change. Do not disable sandboxing or change global permissions. Read-only reviewers may request scoped execution of verification commands that create generated artifacts, while keeping source files unchanged; report exact permission needs if unavailable.\n' +
    'On Windows, if PowerShell blocks npm.ps1, use npm.cmd with the same arguments instead; do not change execution policy. For teammate dependencies, name the teammate and exact review needed; the application may arrange a bounded recovery handoff.\n' +
    'If required input, tool access, approval, or prerequisites remain unavailable, end your final response with PONGKAN_BLOCKED: followed by the exact failure, command, and minimum action needed. Dependent work pauses while the application evaluates recovery; unresolved blockers stop the workflow. Never use a clarification answer as permission to bypass sandbox restrictions.\n'
  );
}

export function taskSignal(text) {
  const line = text.trim().split(/\r?\n/).at(-1);
  const match = line?.match(/^PONGKAN_(QUESTION|BLOCKED):\s*(.+)$/);
  return match ? { kind: match[1], text: match[2].trim() } : null;
}
