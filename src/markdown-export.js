import { join } from 'node:path';
import { writeMarkdown } from './markdown-write.js';
import { TERMINAL } from './tasks.js';
export { markdownDirectory } from './markdown-write.js';
const label = name => String(name).replace(/^./, first => first.toUpperCase());
const markdownSection = (name, text, depth) =>
  text === undefined || text === '' ? '' : `\n${'#'.repeat(depth)} ${name}\n\n${text}\n`;
function snapshot(kind, record) {
  if (kind === 'workflow')
    return {
      id: record.id,
      status: record.status,
      createdAt: record.createdAt,
      finishedAt: record.finishedAt,
      text: record.text,
      error: record.error,
      result: record.result,
      outcome: record.outcome,
      criteria: record.criteria,
      requests: record.requests,
      tasks: record.tasks.map(task => snapshot('task', task)),
    };
  if (kind === 'discussion')
    return { id: record.id, status: record.status, createdAt: record.createdAt, messages: record.messages };
  return Object.fromEntries(
    [
      'id',
      'member',
      'kind',
      'status',
      'createdAt',
      'startedAt',
      'finishedAt',
      'text',
      'result',
      'question',
      'answers',
      'error',
      'workflowId',
      'discussionId',
    ]
      .map(key => [key, record[key]])
      .concat([['files', record.diff?.files]]),
  );
}
function render(kind, record, marker, depth = 1) {
  const section = (name, text) => markdownSection(name, text, depth + 1);
  let text = `${marker}\n${'#'.repeat(depth)} ${label(kind)} ${record.id}\n\nStatus: ${record.status}\n`;
  for (const key of ['member', 'kind', 'workflowId', 'discussionId'])
    if (record[key]) text += `${label(key)}: ${key === 'member' ? label(record[key]) : record[key]}\n`;
  for (const key of ['createdAt', 'startedAt', 'finishedAt'])
    if (Number.isFinite(record[key])) text += `${label(key)}: ${new Date(record[key]).toISOString()}\n`;
  if (kind === 'workflow') {
    text += section('Goal', record.text) + section('Error', record.error);
    for (const request of record.requests || [])
      text += section(
        'Original user request',
        `${request.text}\n\nSubmitted: ${new Date(request.createdAt).toISOString()} (${request.submission === 'shift-left' ? 'Shift+Left' : request.submission === 'enter' ? 'Enter' : 'not recorded'})`,
      );
    text += section('Requested outcome', record.outcome?.replace('_', ' '));
    if (record.criteria?.length)
      text += section(
        'Outcome evidence',
        record.criteria
          .map(criterion => `- ${criterion.requirement}: ${criterion.status}. ${criterion.evidence}`)
          .join('\n'),
      );
    for (const task of record.tasks) text += '\n---\n' + render('task', task, '', depth + 1);
    text += section('Final summary', record.result);
  } else if (kind === 'discussion') {
    const messages = (record.messages || [])
      .map((message, index) => ({ message, order: message.discussionMessageIndex ?? index }))
      .sort((a, b) => a.order - b.order);
    for (const { message } of messages) {
      let metadata = '';
      if (message.role === 'user' && message.submission) {
        metadata += `Submitted with: ${message.submission === 'shift-left' ? 'Shift+Left' : 'Enter'}\n`;
        if (Number.isFinite(message.submittedAt))
          metadata += `Submitted: ${new Date(message.submittedAt).toISOString()}\n`;
        if (Number.isFinite(message.startedAt)) metadata += `Started: ${new Date(message.startedAt).toISOString()}\n`;
        else metadata += `State: ${message.queued ? 'Waiting for earlier prompts to finish' : 'Not started'}\n`;
      }
      text += section(
        `${label(message.speaker)} (${message.role})`,
        metadata ? `${metadata}\n${message.text}` : message.text,
      );
    }
  } else {
    text +=
      section('Assignment', record.text) + section('Response', record.result) + section('Question', record.question);
    for (const answer of record.answers || [])
      text += section('Clarification question', answer.question) + section('Clarification answer', answer.answer);
    text +=
      section('Error', record.error) + section('Changed files', record.files?.map(file => `- ${file}`).join('\n'));
  }
  return text;
}

function* exportsFor(state) {
  const workflowTasks = new Map(),
    discussionTasks = new Map();
  for (const task of state.tasks) {
    const group = task.workflowId ? workflowTasks : task.discussionId ? discussionTasks : null;
    if (group) {
      const id = task.workflowId || task.discussionId;
      if (!group.has(id)) group.set(id, []);
      group.get(id).push(task);
    } else if (TERMINAL.has(task.status)) yield { kind: 'task', record: snapshot('task', task), obsolete: [] };
  }
  for (const [kind, sources, groups] of [
    ['workflow', state.workflows || [], workflowTasks],
    ['discussion', state.discussions, discussionTasks],
  ]) {
    for (const source of sources) {
      const tasks = groups.get(source.id) || [];
      if (!TERMINAL.has(source.status) || tasks.some(task => !TERMINAL.has(task.status))) continue;
      const requests = (state.inputs || [])
        .filter(input => input.workflowId === source.id)
        .map(input => ({ text: input.text, createdAt: input.createdAt, submission: input.submission }));
      yield {
        kind,
        record: snapshot(kind, { ...source, tasks, requests }),
        obsolete: tasks.map(task => `task-${task.id}`),
      };
    }
  }
}
export class MarkdownExporter {
  constructor(crew) {
    this.crew = crew;
    this.records = new Map();
    for (const { kind, record } of exportsFor(crew.state))
      this.records.set(`${kind}-${record.id}`, JSON.stringify(record));
  }
  save(state, { consolidate = false } = {}) {
    let written = 0,
      failed = 0;
    for (const { kind, record, obsolete } of exportsFor(state)) {
      const key = `${kind}-${record.id}`,
        serialized = JSON.stringify(record);
      if (this.records.get(key) === serialized) continue;
      this.records.set(key, serialized);
      if (!state.markdownEnabled) continue;
      let path = join(this.crew.folder, 'docs', 'pongkan-docs', `${key}.md`);
      try {
        if (!/^[a-f0-9]{8}$/.test(record.id)) throw new Error('Invalid Markdown record ID');
        const marker = `<!-- pongkan-crew export ${key} -->`;
        writeMarkdown(this.crew.folder, key, render(kind, record, marker), consolidate ? obsolete : []);
        written++;
      } catch (error) {
        failed++;
        this.crew.notify(`Markdown save failed: ${path}: ${error.message}`);
      }
    }
    return { written, failed };
  }
  refresh(state) {
    if (!state.markdownEnabled) throw new Error('Enable /markdown on before refreshing exports.');
    this.records.clear();
    return this.save(state, { consolidate: true });
  }
}
