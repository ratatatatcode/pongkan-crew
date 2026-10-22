const fields = ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reportedTurns', 'turns', 'elapsedMs'];
export const emptyUsage = () => Object.fromEntries(fields.map(field => [field, 0]));
export const validUsage = usage =>
  usage &&
  !Array.isArray(usage) &&
  fields.every(field => Number.isSafeInteger(usage[field]) && usage[field] >= 0) &&
  usage.reportedTurns <= usage.turns &&
  usage.cached_input_tokens <= usage.input_tokens;

export function accumulateUsage(state, usage, task) {
  state.usage ||= emptyUsage();
  if (task) task.usage ||= emptyUsage();
  for (const field of fields) {
    state.usage[field] += usage[field];
    if (task) task.usage[field] += usage[field];
  }
}

export function reportedUsage(value) {
  if (
    !value ||
    !['input_tokens', 'cached_input_tokens', 'output_tokens'].every(
      field => Number.isSafeInteger(value[field]) && value[field] >= 0,
    ) ||
    value.cached_input_tokens > value.input_tokens
  )
    return null;
  return {
    input_tokens: value.input_tokens,
    cached_input_tokens: value.cached_input_tokens,
    output_tokens: value.output_tokens,
  };
}

export function usageLines(state, flow) {
  const tasks = flow ? state.tasks.filter(task => task.workflowId === flow.id) : [];
  const usage = flow
    ? tasks.reduce((total, task) => {
        for (const field of fields) total[field] += task.usage?.[field] || 0;
        return total;
      }, emptyUsage())
    : state.usage || emptyUsage();
  return [
    flow ? `Workflow: ${flow.id}` : 'Project usage (includes internal routing and direct chat turns)',
    ...(flow?.engine === 'lead' ? [`Workflow model turns: ${flow.turns}/${flow.turnBudget}`] : []),
    `Measured turns: ${usage.turns}; usage reported: ${usage.reportedTurns}`,
    ...(usage.reportedTurns
      ? [
          `Reported input tokens: ${usage.input_tokens.toLocaleString('en-US')}`,
          `Cached input tokens (included in input): ${usage.cached_input_tokens.toLocaleString('en-US')}`,
          `Reported output tokens: ${usage.output_tokens.toLocaleString('en-US')}`,
        ]
      : ['Token usage unavailable: no Codex usage reports have been saved for this scope.']),
    `Cumulative turn time: ${(usage.elapsedMs / 1000).toFixed(1)}s (parallel turns can overlap)`,
    'Totals cover measured turns since usage tracking was added; older and unreported usage is unavailable.',
  ];
}
