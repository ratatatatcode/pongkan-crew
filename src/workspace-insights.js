const snippet = (text, at = 0) => {
  const start = Math.max(0, at - 60);
  return `${start ? '…' : ''}${text.slice(start, start + 260).replace(/\s+/g, ' ')}${text.length > start + 260 ? '…' : ''}`;
};

export function criteriaLines(flow) {
  return [
    `Acceptance: ${flow.outcome || 'unverified'}`,
    `Review task: ${flow.reviewTaskId || 'not recorded'}`,
    ...(!flow.outcome && flow.criteria?.length
      ? ['Saved criteria are from an earlier review; the current outcome needs independent verification.']
      : []),
    ...(flow.criteria?.length
      ? flow.criteria.flatMap((criterion, index) => [
          `${index + 1}. [${criterion.status}] ${criterion.requirement}`,
          `Evidence: ${criterion.evidence}`,
        ])
      : ['No saved acceptance criteria. Request independent review before treating the outcome as verified.']),
    ...(flow.limitations || []).map(text => `Limitation: ${text}`),
  ];
}

export function nextAction(crew, flow, tasks) {
  const waiting = tasks.find(task => task.status === 'waiting');
  if (waiting) return `Answer the pending question: /queue show ${waiting.id}, then /answer ${waiting.id} TEXT`;
  if (flow.status === 'completed') return `Inspect /workflow criteria ${flow.id}; start /task GOAL for follow-up work.`;
  if (flow.status === 'cancelled') return `Inspect changes; /workflow retry ${flow.id} explicitly starts over.`;
  if (flow.status === 'paused') return `/workflow resume ${flow.id}`;
  if (['failed', 'interrupted'].includes(flow.status))
    return `Inspect /workflow show ${flow.id}, then /recovery ${flow.id} to continue unfinished work.`;
  if (tasks.some(task => task.status === 'running'))
    return 'Wait for the active assignment; /steer ID TEXT queues a correction.';
  if (crew?.queue?.paused || tasks.some(task => task.dispatchPaused)) return `/workflow resume ${flow.id}`;
  return 'Waiting for the next eligible assignment to dispatch.';
}

export function workflowReport(state, flow, crew) {
  const tasks = state.tasks.filter(task => task.workflowId === flow.id);
  const done = tasks.filter(task => task.status === 'completed');
  const active = tasks.filter(task => task.status === 'running');
  return [
    `Workflow ${flow.id}: ${flow.status}`,
    `Goal: ${flow.requestGoal || flow.text}`,
    `Assignments finished: ${done.length}/${tasks.length} (execution progress; acceptance below)`,
    ...(flow.engine === 'lead' ? [`Model turns: ${flow.turns}/${flow.turnBudget}`] : []),
    `Running: ${active.map(task => `${task.member} (${task.id})`).join(', ') || 'none'}`,
    `Completed: ${done.map(task => `${task.member} (${task.id})`).join(', ') || 'none'}`,
    ...tasks
      .filter(task => ['waiting', 'failed', 'interrupted'].includes(task.status))
      .map(
        task =>
          `${task.status}: ${task.member} (${task.id}) — ${task.question || task.error || 'Inspect /queue show ' + task.id}`,
      ),
    ...(flow.error ? [`Stopped because: ${flow.error}`] : []),
    '',
    ...criteriaLines(flow),
    '',
    `Next: ${nextAction(crew, flow, tasks)}`,
  ];
}

// Scan literal strings lazily and stop at the first overflow. No index duplicates saved history.
export function searchHistory(crew, query, limit = 40) {
  const needle = query.trim().toLowerCase();
  if (!needle || needle.length > 500) throw new Error('Use /search TEXT (1–500 characters).');
  limit = Math.max(1, Math.min(100, Math.floor(limit) || 40));
  function* records() {
    const state = crew.state;
    for (const member of state.members || [])
      for (const message of member.messages || []) yield [`Chat ${member.name}`, message.displayText || message.text];
    for (const archive of state.archives || [])
      for (const member of archive.members || [])
        for (const message of member.messages || [])
          yield [`Archive ${archive.id} ${member.name}`, message.displayText || message.text];
    for (const chat of state.conversations || []) {
      yield [`Conversation ${chat.id}`, chat.title];
      for (const message of chat.messages || [])
        yield [`Conversation ${chat.id}${chat.archived ? ' (archived)' : ''}`, message.displayText || message.text];
    }
    for (const discussion of state.discussions || [])
      for (const message of discussion.messages || []) yield [`Discussion ${discussion.id}`, message.text];
    for (const flow of state.workflows || []) {
      yield [`Workflow ${flow.id}`, flow.requestGoal || flow.text];
      yield [`Workflow ${flow.id}`, flow.result];
      for (const criterion of flow.criteria || [])
        yield [`Workflow ${flow.id} criterion`, `${criterion.requirement}\n${criterion.evidence}`];
    }
    for (const task of state.tasks || []) {
      yield [`Task ${task.id}`, task.displayText || task.text];
      yield [`Task ${task.id} result`, task.result];
      yield [`Task ${task.id} error`, task.error];
    }
    for (const entry of crew.memory.list()) yield [`Memory ${entry.id}`, entry.text];
  }
  const matches = [];
  for (const [source, text] of records()) {
    if (typeof text !== 'string') continue;
    const at = text.toLowerCase().indexOf(needle);
    if (at < 0) continue;
    if (matches.length === limit) return { matches, truncated: true };
    matches.push(`${source}: ${snippet(text, at)}`);
  }
  return { matches, truncated: false };
}

export function activitySummary(crew) {
  const tasks = crew.state.tasks || [];
  const counts = { running: 0, queued: 0, waiting: 0 };
  for (const task of tasks) if (Object.hasOwn(counts, task.status)) counts[task.status]++;
  const latest = crew.state.workflows?.at(-1);
  return [
    `Dispatch: ${crew.queue?.paused ? 'paused' : 'running'} · ${counts.running} active · ${counts.queued} queued · ${counts.waiting} waiting for answers`,
    ...(latest
      ? [
          `Latest workflow ${latest.id}: ${latest.status}`,
          `Next: ${nextAction(
            crew,
            latest,
            tasks.filter(task => task.workflowId === latest.id),
          )}`,
        ]
      : []),
  ];
}

export function taskNextAction(crew, task) {
  if (task.workflowId)
    return nextAction(
      crew,
      crew.workflows.get(task.workflowId),
      crew.state.tasks.filter(other => other.workflowId === task.workflowId),
    );
  if (task.status === 'waiting') return `/answer ${task.id} TEXT`;
  if (task.discussionId && ['failed', 'interrupted', 'cancelled'].includes(task.status))
    return 'Inspect the saved discussion; use /discuss TOPIC to start a new discussion.';
  if (['failed', 'interrupted', 'cancelled'].includes(task.status))
    return `Inspect the result and changes; /queue retry ${task.id} explicitly repeats this assignment.`;
  if (task.status === 'completed') return 'Inspect the result; send a follow-up for additional work.';
  if (task.status === 'running') return 'Wait for the active turn or use /stop NAME.';
  return crew.queue.paused || task.dispatchPaused
    ? '/queue resume'
    : 'Waiting for the teammate and workspace to become available.';
}
