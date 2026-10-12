import { clean } from './markdown.js';
const bounded = (value, limit = 1200) => {
  const text = clean(value || '');
  return text.length > limit
    ? text.slice(0, limit) + `\n[${(text.length - limit).toLocaleString('en-US')} more characters]`
    : text;
};

export function describeCodexEvent(event) {
  const item = event.item;
  if (!item || !['item.started', 'item.completed'].includes(event.type)) return null;
  const completed = event.type === 'item.completed';
  if (item.type === 'command_execution') {
    const failed =
      completed && ((typeof item.exit_code === 'number' && item.exit_code !== 0) || item.status === 'failed');
    return {
      kind: failed ? 'error' : 'command',
      text: `${completed ? `Command ${failed ? 'failed' : 'finished'}${item.exit_code == null ? '' : ` (exit ${item.exit_code})`}` : 'Running command'}: ${bounded(item.command, 500)}`,
      detail: completed ? bounded(item.aggregated_output) : '',
    };
  }
  if (item.type === 'file_change')
    return {
      kind: item.status === 'failed' ? 'error' : 'edit',
      text: completed ? 'File changes reported' : 'Updating files',
      detail: bounded(
        (item.changes || [])
          .map(change => `${typeof change.kind === 'string' ? change.kind : 'change'}: ${change.path}`)
          .join('\n'),
      ),
    };
  if (item.type === 'web_search') {
    const query = item.query || item.action?.query || item.action?.queries?.join('; ') || 'Web search';
    return { kind: 'search', text: `${completed ? 'Search finished' : 'Searching'}: ${bounded(query, 500)}` };
  }
  if (item.type === 'mcp_tool_call')
    return {
      kind: item.error || item.status === 'failed' ? 'error' : 'tool',
      text: `${completed ? 'Tool finished' : 'Using tool'}: ${bounded([item.server, item.tool].filter(Boolean).join(' / '), 500)}`,
      detail: item.error ? bounded(typeof item.error === 'string' ? item.error : item.error.message) : '',
    };
  // Assistant text belongs in Chat; reasoning contents are never exposed in Activity.
  return null;
}

export function activityStyle(event) {
  const kind =
    event.kind ||
    (/\b(failed|error)\b/i.test(event.text)
      ? 'error'
      : /\b(cancelled|paused|interrupted)\b/i.test(event.text)
        ? 'warning'
        : /\b(completed|finished)\b/i.test(event.text)
          ? 'success'
          : /\bqueued\b/i.test(event.text)
            ? 'queue'
            : 'status');
  const styles = {
    command: ['COMMAND', 'code'],
    edit: ['FILES', 'assistant'],
    search: ['SEARCH', 'link'],
    tool: ['TOOL', 'selected'],
    error: ['ERROR', 'error'],
    warning: ['WAIT', 'system'],
    success: ['DONE', 'assistant'],
    queue: ['QUEUE', 'muted'],
    status: ['STATUS', 'heading'],
  };
  const [label, tone] = styles[kind] || styles.status;
  return { label, tone };
}
