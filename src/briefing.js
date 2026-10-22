import { createHash } from 'node:crypto';
import { nextAction, taskNextAction } from './workspace-insights.js';

export const BRIEFING_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DAY = 86400000;
const short = value =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .slice(0, 240);
const acceptance = flow =>
  flow.outcome === 'met' ? (flow.reviewTaskId ? 'accepted' : 'unverified') : flow.outcome || 'unverified';
const localDate = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fingerprint = signal => createHash('sha256').update(JSON.stringify(signal)).digest('hex');

function projectIndex(state) {
  const tasksByWorkflow = new Map();
  for (const task of state.tasks) {
    const id = task.workflowId;
    if (!id) continue;
    if (!tasksByWorkflow.has(id)) tasksByWorkflow.set(id, []);
    tasksByWorkflow.get(id).push(task);
  }
  return {
    tasksByWorkflow,
    workflowsById: new Map(state.workflows.map(flow => [flow.id, flow])),
    answeredInputs: new Set(
      state.inputs.filter(input => input.status === 'dispatched').map(input => input.clarificationId),
    ),
  };
}

// Workflow steps are represented by their workflow, except questions that need a direct answer.
function signals(crew, limit = 200, index = projectIndex(crew.state)) {
  const state = crew.state;
  const entries = [];
  for (const flow of state.workflows) {
    if (!['completed', 'failed', 'interrupted'].includes(flow.status)) continue;
    const tasks = index.tasksByWorkflow.get(flow.id) || [];
    entries.push({
      key: `workflow:${flow.id}`,
      at: flow.finishedAt || flow.createdAt || 0,
      completed: flow.status === 'completed',
      text: `Workflow ${flow.id}: ${flow.status}`,
      detail: `${short(flow.requestGoal || flow.text)} (${acceptance(flow)})\n${short(flow.error)}\n${
        flow.status === 'completed' ? `/workflow criteria ${flow.id}` : nextAction(crew, flow, tasks)
      }`,
    });
  }
  for (const task of state.tasks) {
    if (task.status !== 'waiting' && (task.workflowId || task.discussionId)) continue;
    if (!['waiting', 'failed', 'interrupted', 'completed'].includes(task.status)) continue;
    const flow = index.workflowsById.get(task.workflowId);
    if (flow && ['paused', 'cancelled', 'completed'].includes(flow.status)) continue;
    entries.push({
      key: `task:${task.id}`,
      at: task.finishedAt || task.createdAt || 0,
      completed: task.status === 'completed',
      text: `${task.member} (${task.id}): ${task.status === 'waiting' ? 'needs your answer' : task.status}`,
      detail: `${short(task.question || task.error || task.text)}\n${
        task.status === 'waiting' ? `/answer ${task.id} TEXT` : `/queue show ${task.id}`
      }`,
    });
  }
  for (const input of state.inputs) {
    if (!['blocked', 'interrupted'].includes(input.status) || input.answeredAt) continue;
    // Once an answered clarification has dispatched a follow-up, it no longer needs attention.
    if (index.answeredInputs.has(input.id)) continue;
    entries.push({
      key: `input:${input.id}`,
      at: input.createdAt || 0,
      completed: false,
      text: `Message ${input.id}: ${input.question ? 'needs clarification' : input.status}`,
      detail: `${short(input.question || input.error || input.text)}\n${
        input.question ? '/questions list' : 'Inspect the saved conversation before resending.'
      }`,
    });
  }
  // Separate windows keep finished history from hiding questions or reappearing as questions resolve.
  entries.sort((a, b) => a.at - b.at);
  return [
    ...entries.filter(signal => signal.completed).slice(-limit / 2),
    ...entries.filter(signal => !signal.completed).slice(-limit / 2),
  ];
}

function section(title, entries, render = entry => entry) {
  return [
    '',
    `${title} (${entries.length})`,
    ...(entries.length ? entries.slice(-10).map(render) : ['None.']),
    ...(entries.length > 10 ? [`Showing latest 10 of ${entries.length}; inspect /queue list and /workflow list.`] : []),
  ];
}

export function briefingLines(crew, now = Date.now()) {
  const { state } = crew;
  const index = projectIndex(state);
  const attention = signals(crew, Infinity, index).filter(signal => !signal.completed);
  const active = state.workflows.filter(
    flow => !['completed', 'failed', 'interrupted', 'cancelled'].includes(flow.status),
  );
  const recent = state.workflows.filter(
    flow => flow.status === 'completed' && flow.finishedAt >= now - DAY && flow.finishedAt <= now,
  );
  const standalone = state.tasks.filter(
    task =>
      !task.workflowId &&
      !task.discussionId &&
      task.status === 'completed' &&
      task.finishedAt >= now - DAY &&
      task.finishedAt <= now,
  );
  return [
    'Pongkan Crew project briefing',
    `As of ${new Date(now).toLocaleString()} (machine local time)`,
    `Dispatch: ${crew.queue.paused ? 'paused' : 'running'} | ${state.tasks.filter(task => task.status === 'running').length} running | ${state.tasks.filter(task => task.status === 'queued').length} queued`,
    'Based on saved Crew state; project files and connected services have not been checked.',
    ...section('Needs your attention', attention, signal => `${signal.text}\n${signal.detail}`),
    ...section(
      'Ongoing workflows',
      active,
      flow =>
        `${flow.id}: ${short(flow.requestGoal || flow.text)} (${flow.status})\n${nextAction(
          crew,
          flow,
          index.tasksByWorkflow.get(flow.id) || [],
        )}`,
    ),
    ...section('Finished in the last 24 hours', [...recent, ...standalone], record =>
      index.workflowsById.get(record.id) === record
        ? `${record.id}: ${short(record.requestGoal || record.text)} (${acceptance(record)})\n/workflow criteria ${record.id}`
        : `${record.id}: ${short(record.text)} (assignment completed)\n${taskNextAction(crew, record)}`,
    ),
    ...section(
      'Enabled recurring checks',
      state.schedules.filter(job => job.enabled),
      job =>
        `${job.id}: ${short(job.text)} | ${job.member} | ${job.readOnly ? 'read-only' : 'member access'} | next ${new Date(job.nextRun).toLocaleString()}`,
    ),
    '',
    'Use /schedule add MINUTES NAME GOAL for recurring read-only project inspections.',
    'The app or --worker must be running. Work on this machine stops while it is off.',
  ];
}

export class CrewWatch {
  constructor(crew) {
    this.crew = crew;
  }
  update(change) {
    const previous = structuredClone(this.crew.state.watch);
    try {
      change(this.crew.state.watch);
      this.crew.save();
    } catch (error) {
      this.crew.state.watch = previous;
      throw error;
    }
  }
  enable(time) {
    if (time !== undefined && !BRIEFING_TIME.test(time))
      throw new Error('Use /watch on [HH:MM] in 24-hour machine local time.');
    this.update(watch => {
      if (!watch.enabled)
        watch.seen = signals(this.crew)
          .filter(signal => signal.completed)
          .map(fingerprint);
      watch.enabled = true;
      if (time) watch.time = time;
    });
  }
  disable() {
    this.update(watch => {
      watch.enabled = false;
    });
  }
  clear() {
    this.update(watch => {
      watch.inbox = [];
    });
  }
  tick(now = Date.now()) {
    const watch = this.crew.state.watch;
    if (!watch.enabled || this.crew.queue.closing) return [];
    const current = signals(this.crew);
    const seen = current.map(fingerprint);
    const known = new Set(watch.seen);
    const notices = current
      .filter((_, index) => !known.has(seen[index]))
      .map(signal => ({ at: now, text: signal.text, detail: signal.detail }));
    const date = new Date(now);
    const today = localDate(date);
    const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const daily = (!watch.lastBriefingDate || watch.lastBriefingDate < today) && time >= watch.time;
    if (daily)
      notices.push({
        at: now,
        text: 'Pongkan Crew briefing is ready.',
        detail: briefingLines(this.crew, now).join('\n'),
      });
    if (!notices.length && watch.seen.length === seen.length && seen.every((key, i) => watch.seen[i] === key))
      return [];
    this.update(saved => {
      saved.seen = seen;
      if (daily) saved.lastBriefingDate = today;
      saved.inbox = [...saved.inbox, ...notices].slice(-50);
    });
    for (const notice of notices) {
      this.crew.emit('watch', notice);
      this.crew.notify(notice.text, { kind: 'status', detail: notice.detail });
    }
    return notices;
  }
  lines(inbox = false) {
    const watch = this.crew.state.watch;
    return [
      `Pongkan Crew watch: ${watch.enabled ? 'ON' : 'OFF'}`,
      `Daily briefing: ${watch.time} (machine local time)`,
      'Local alerts use saved state and make no model calls. They never resume stopped work.',
      'Keep the app or --worker running. /briefing shows the current project briefing.',
      `Saved notifications: ${watch.inbox.length} (latest 50). /watch inbox | /watch clear`,
      ...(inbox
        ? watch.inbox.length
          ? watch.inbox
              .slice()
              .reverse()
              .flatMap(notice => ['', `${new Date(notice.at).toLocaleString()} | ${notice.text}`, notice.detail])
          : ['', 'No saved notifications.']
        : []),
    ];
  }
}
