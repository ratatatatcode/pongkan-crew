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
    'Use existing applicable approvals; do not repeatedly ask for authorization already granted. Reason from command evidence and the current execution policy to determine whether a failure requires a changed operation, a dependency repair, or command-specific approval through the configured mechanism. Do not disable sandboxing or change global permissions. Read-only reviewers cannot grant themselves write access or escalation; identify the prerequisite so an already authorized teammate can perform it while preserving independent review.\n' +
    'For teammate dependencies, report the prerequisite and exact check needed; the application automatically coordinates investigation, repairs, and continuation.\n' +
    "Own the requested outcome, including unexpected failures. Investigate current capabilities and test alternatives; an unavailable dependency is not automatically the user's responsibility. If unresolved, end your final response with PONGKAN_BLOCKED: followed by the exact failure, tested hypotheses, results, and remaining prerequisite. This starts automatic recovery for workflows, including failed repairs; do not tell the user to run /recovery. Only request user action for a demonstrated external boundary such as denied approval, missing credentials, a necessary user decision, or access unavailable to every authorized teammate. Never use a clarification answer as permission to bypass sandbox restrictions.\n"
  );
}

export function taskSignal(text) {
  const line = text.trim().split(/\r?\n/).at(-1);
  const match = line?.match(/^PONGKAN_(QUESTION|BLOCKED):\s*(.+)$/);
  return match ? { kind: match[1], text: match[2].trim() } : null;
}
