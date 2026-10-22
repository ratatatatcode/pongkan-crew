import { wrapText, renderMarkdown } from './markdown.js';
import { displayMessages } from './conversations.js';
import { structuredOutput } from './structured-output.js';
const label = name => name.charAt(0).toUpperCase() + name.slice(1);
const renderedTasks = new WeakMap();

function taskMarkdown(task, slot, text, width, crew) {
  const folder = crew.folder;
  const names = (crew.state.members || []).map(member => member.name);
  const namesKey = JSON.stringify(names);
  let cache = renderedTasks.get(task);
  if (!cache) {
    cache = new Map();
    renderedTasks.set(task, cache);
  }
  const previous = cache.get(slot);
  if (
    previous?.text === text &&
    previous.width === width &&
    previous.folder === folder &&
    previous.namesKey === namesKey
  )
    return previous.rows;
  const rows = renderMarkdown(text, width, { folder, names });
  cache.set(slot, { text, width, folder, namesKey, rows });
  return rows;
}

// Derived from durable task records: rendering never creates another event log.
export function workflowFeed(
  crew,
  width,
  conversationId,
  {
    before = Infinity,
    since = -Infinity,
    conversation = false,
    discussionId = null,
    priorDiscussionIds = [],
    workflowId = null,
    taskId = null,
  } = {},
) {
  const discussionIds = new Set([discussionId, ...priorDiscussionIds]);
  const flows = new Map((crew.state.workflows || []).map(f => [f.id, f]));
  const allTasks = conversation ? null : new Map((crew.state.tasks || []).map(t => [t.id, t]));
  const tasks = (crew.state.tasks || []).filter(t => {
    const flow = flows.get(t.workflowId);
    const createdAt = t.createdAt ?? flow?.createdAt ?? 0;
    return (
      flow &&
      (!taskId || t.id === taskId) &&
      (!workflowId || flow.id === workflowId) &&
      (conversationId
        ? flow.sourceConversationId === conversationId
        : discussionId
          ? discussionIds.has(flow.sourceDiscussionId)
          : true) &&
      createdAt < before &&
      createdAt >= since
    );
  });
  const rows = [];
  for (const task of conversation ? tasks : tasks.slice(-40)) {
    const flow = flows.get(task.workflowId);
    if (conversation) {
      // Future assignments belong in Activity, not the conversation.
      if (task.kind !== 'plan' && task.status === 'queued' && !task.startedAt && !task.result) continue;
      const hasOriginalRequest = (crew.state.inputs || []).some(
        input => input.workflowId === flow.id && input.decision?.action === 'execute',
      );
      if (task.kind === 'plan' && !hasOriginalRequest) {
        const goal = flow.text
          .split(
            '\n\nPrior Crew Chat (historical findings; use the latest user request to determine authorized work):\n',
          )[0]
          .split('\n\nResolved intent (must remain within the original request):')[0];
        rows.push({ text: 'You', tone: 'user' }, ...taskMarkdown(task, 'goal', goal, width, crew), {
          text: '',
          tone: 'body',
        });
      }
      const progress =
        task.status === 'running'
          ? (crew.chatMember?.(task.member, task.conversationId) || crew.member?.(task.member))?.progress
          : null;
      let result =
        task.status === 'running' && progress?.taskId === task.id ? progress.response || task.result : task.result;
      if (task.leadDecision && task.status === 'running') result = '';
      else if (task.leadDecision && !task.decision && result)
        result = 'Lead decision could not be read. Details are available in Activity.';
      if (task.recoveryFor && result) {
        try {
          const decision = structuredOutput(result, ['action', 'member', 'instruction']);
          result = `Recovery ${decision.action} · ${decision.member}\n${decision.instruction}`;
        } catch {
          if (task.status === 'running' || result.trimStart().startsWith('{'))
            result = task.status === 'running' ? '' : 'Recovery decision unavailable. Inspect the task error.';
        }
      }
      for (const correction of (task.steering || []).filter(entry => entry.appliedAt))
        rows.push(
          { text: `You · correction delivered to ${label(task.member)}`, tone: 'user' },
          ...taskMarkdown(task, `correction-${correction.id}`, correction.text, width, crew),
          { text: '', tone: 'body' },
        );
      for (const answer of task.answers || [])
        rows.push(
          { text: 'Question · Answered', tone: 'heading' },
          ...taskMarkdown(task, `question-${answer.question}`, answer.question, width, crew),
          { text: '', tone: 'body' },
          { text: 'Your response', tone: 'user' },
          ...taskMarkdown(task, `answer-${answer.question}`, answer.answer, width, crew),
          { text: '', tone: 'body' },
        );
      const rawVerification = task.kind === 'review' && task.schema && !task.verificationFormatted;
      if (result && !rawVerification) {
        const message = displayMessages(
          { name: task.member, messages: [{ role: 'assistant', text: result, taskId: task.id }] },
          [task],
          [],
        )[0];
        rows.push(
          { text: label(task.member), tone: 'assistant' },
          ...taskMarkdown(task, 'result', message.text, width, crew),
          { text: '', tone: 'body' },
        );
      }
      if (rawVerification && result && task.status !== 'running')
        rows.push({
          text: 'Verification report could not be read. Details are available in Activity.',
          tone: 'system',
        });
      if (task.status === 'running' || task.status === 'queued' || task.status === 'waiting') {
        const action =
          task.status === 'waiting'
            ? `Waiting for your answer: ${task.question || 'Use /questions list'}`
            : task.status === 'queued'
              ? 'Waiting for a turn'
              : task.kind === 'coordination'
                ? 'Discussing the assignment with teammates'
                : task.kind === 'revision'
                  ? 'Addressing teammate feedback'
                  : task.kind === 'plan'
                    ? 'Preparing the plan'
                    : task.kind === 'review'
                      ? 'Reviewing the work'
                      : task.kind === 'summary'
                        ? 'Preparing the final summary'
                        : 'Working on the assignment';
        rows.push(...wrapText(`${label(task.member)} · ${action}`, width).map(text => ({ text, tone: 'muted' })));
      }
      let error = task.error?.trim();
      if (error && result && !rawVerification) {
        if (result.includes(error)) error = '';
        else if (error.startsWith(result.trim())) error = error.slice(result.trim().length).trim();
      }
      if (error)
        rows.push(
          ...wrapText(`${label(task.member)}: ${error}`, width).map(text => ({ text, tone: 'system' })),
          { text: '', tone: 'body' },
          { text: '', tone: 'body' },
        );
      while (rows.length && rows.at(-1).text === '') rows.pop();
      if (rows.length) rows.push({ text: '', tone: 'body' }, { text: '', tone: 'body' });
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
    rows.push(...taskMarkdown(task, 'activity-assignment', assignment.slice(0, 300), width, crew));
    if (task.result) {
      rows.push(
        { text: '', tone: 'body' },
        { text: 'Result', tone: 'heading' },
        ...taskMarkdown(
          task,
          'activity-result',
          task.kind === 'plan' ? task.result : task.result.slice(0, 800),
          width,
          crew,
        ),
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
