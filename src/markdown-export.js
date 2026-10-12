import { join } from 'node:path';
import { writeMarkdown } from './markdown-write.js';
export { markdownDirectory } from './markdown-write.js';
const label = name => String(name).replace(/^./, first => first.toUpperCase());
const section = (name, text) => (text === undefined || text === '' ? '' : `\n## ${name}\n\n${text}\n`);
function snapshot(kind, record) {
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
function render(kind, record, marker) {
  let text = `${marker}\n# ${label(kind)} ${record.id}\n\nStatus: ${record.status}\n`;
  for (const key of ['member', 'kind', 'workflowId', 'discussionId'])
    if (record[key]) text += `${label(key)}: ${key === 'member' ? label(record[key]) : record[key]}\n`;
  for (const key of ['createdAt', 'startedAt', 'finishedAt'])
    if (Number.isFinite(record[key])) text += `${label(key)}: ${new Date(record[key]).toISOString()}\n`;
  if (kind === 'discussion') {
    const messages = (record.messages || [])
      .map((message, index) => ({ message, order: message.discussionMessageIndex ?? index }))
      .sort((a, b) => a.order - b.order);
    for (const { message } of messages) {
      let metadata = '';
      if (message.role === 'user' && message.submission) {
        metadata += `Submitted with: ${message.submission === 'shift-left' ? 'Shift+Left (queue and resume dispatch)' : 'Enter (preserve queue pause)'}\n`;
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
export class MarkdownExporter {
  constructor(crew) {
    this.crew = crew;
    this.records = new Map();
    for (const [kind, records] of [
      ['task', crew.state.tasks],
      ['discussion', crew.state.discussions],
    ]) {
      for (const record of records) this.records.set(`${kind}-${record.id}`, JSON.stringify(snapshot(kind, record)));
    }
  }
  save(state) {
    for (const [kind, records] of [
      ['task', state.tasks],
      ['discussion', state.discussions],
    ]) {
      for (const source of records) {
        const record = snapshot(kind, source),
          key = `${kind}-${record.id}`,
          serialized = JSON.stringify(record);
        if (this.records.get(key) === serialized) continue;
        this.records.set(key, serialized);
        if (!state.markdownEnabled) continue;
        let path = join(this.crew.folder, 'docs', 'pongkan-docs', `${key}.md`);
        try {
          if (!/^[a-f0-9]{8}$/.test(record.id)) throw new Error('Invalid Markdown record ID');
          const marker = `<!-- pongkan-crew export ${key} -->`;
          writeMarkdown(this.crew.folder, key, render(kind, record, marker));
        } catch (error) {
          this.crew.notify(`Markdown save failed: ${path}: ${error.message}`);
        }
      }
    }
  }
}
