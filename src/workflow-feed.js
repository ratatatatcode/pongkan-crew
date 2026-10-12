import { wrapText, renderMarkdown } from './markdown.js';
import { displayMessages } from './conversations.js';
const label = name => name.charAt(0).toUpperCase() + name.slice(1);

// Derived from durable task records: rendering never creates another event log.
export function workflowFeed(
  crew,
  width,
  conversationId,
  { before = Infinity, since = -Infinity, conversation = false } = {},
) {
  const flows = new Map((crew.state.workflows || []).map(f => [f.id, f]));
  const allTasks = new Map((crew.state.tasks || []).map(t => [t.id, t]));
  const tasks = (crew.state.tasks || []).filter(t => {
    const flow = flows.get(t.workflowId);
    const createdAt = t.createdAt ?? flow?.createdAt ?? 0;
    return (
      flow &&
      (!conversationId || flow.sourceConversationId === conversationId) &&
      createdAt < before &&
      createdAt >= since
    );
  });
  const rows = [];
  for (const task of conversation ? tasks : tasks.slice(-40)) {
    const flow = flows.get(task.workflowId);
    if (conversation) {
      if (task.kind === 'plan') {
        const goal = flow.text.split(
          '\n\nPrior Crew Chat (historical findings; use the latest user request to determine authorized work):\n',
        )[0];
        rows.push({ text: 'You', tone: 'user' }, ...renderMarkdown(goal, width, { folder: crew.folder }), {
          text: '',
          tone: 'body',
        });
      }
      if (task.result) {
        const message = displayMessages(
          { name: task.member, messages: [{ role: 'assistant', text: task.result, taskId: task.id }] },
          [task],
          [flow],
        )[0];
        rows.push(
          { text: label(task.member), tone: 'assistant' },
          ...renderMarkdown(message.text, width, { folder: crew.folder }),
          { text: '', tone: 'body' },
        );
      }
      if (task.status === 'running' || task.status === 'queued' || task.status === 'waiting') {
        const action =
          task.status === 'waiting'
            ? `Waiting for your answer: ${task.question || 'Use /questions list'}`
            : task.status === 'queued'
              ? 'Waiting for a turn'
              : task.kind === 'plan'
                ? 'Preparing the plan'
                : task.kind === 'review'
                  ? 'Reviewing the work'
                  : task.kind === 'summary'
                    ? 'Preparing the final summary'
                    : 'Working on the assignment';
        rows.push(...wrapText(`${label(task.member)} · ${action}`, width).map(text => ({ text, tone: 'muted' })));
      }
      if (task.error)
        rows.push(...wrapText(`${label(task.member)}: ${task.error}`, width).map(text => ({ text, tone: 'system' })));
      continue;
    }
    const prior = task.dependsOn && allTasks.get(task.dependsOn);
    const from = task.kind === 'plan' ? 'You' : label(prior?.member || flow.lead);
    rows.push(
      { text: `${from} → ${label(task.member)} · ${task.kind} · ${task.status}`, tone: 'heading' },
      { text: `Workflow ${flow.id} · task ${task.id} · /queue show ${task.id}`, tone: 'muted' },
      { text: '', tone: 'body' },
    );
    const assignment = task.kind === 'plan' ? flow.text : task.text;
    rows.push(...renderMarkdown(assignment.slice(0, 300), width, { folder: crew.folder }));
    if (task.result) {
      rows.push(
        { text: '', tone: 'body' },
        { text: 'Result', tone: 'heading' },
        ...renderMarkdown(task.kind === 'plan' ? task.result : task.result.slice(0, 800), width, {
          folder: crew.folder,
        }),
      );
    }
    if (task.error || task.question)
      rows.push(...wrapText(task.error || task.question, width).map(text => ({ text, tone: 'system' })));
    if (task.steering?.length)
      rows.push({
        text: `Corrections: ${task.steering.filter(s => s.appliedAt).length}/${task.steering.length} delivered`,
        tone: 'muted',
      });
    rows.push({ text: '', tone: 'body' });
  }
  return rows.length && !conversation
    ? [{ text: 'WORKFLOW HANDOFFS · latest 40 tasks · full results: /queue show ID', tone: 'heading' }, ...rows]
    : rows;
}
