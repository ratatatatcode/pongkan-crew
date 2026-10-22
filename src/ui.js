import { wrapText, fitText, renderMarkdown } from './markdown.js';
import { layoutInput } from './input.js';
import { activityRows } from './activity.js';
import { activitySummary } from './workspace-insights.js';
import { displayMessages, readableReply } from './conversations.js';
import { roleRows, isRoleHeading } from './role-display.js';
import { workflowFeed } from './workflow-feed.js';
import { inputStatus } from './input-router.js';
import { routingQuestions } from './answer-shortcut.js';
export { clean } from './markdown.js';
const wrap = wrapText;
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);
const nameLabel = name => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
const renderedMessages = new WeakMap();
const CLI_TIPS = [
  '/help QUERY searches the command guide.',
  '/new starts a fresh chat and keeps the old conversation saved.',
  '/new-all starts fresh conversations for the whole crew.',
  '/personality lists chat styles; tone never changes a teammate’s role.',
  'Type your request normally; the teammate AI interprets it. /crew-task starts coordinated work.',
  'F2 switches between Chat, Crew Chat, and Activity.',
  'Shift+Enter inserts a new line; Enter sends the complete prompt.',
  'Up/Down browses prompt history and restores your current draft.',
  '/queue list shows queued work and its status.',
  'Shift+Right fills an answer for a waiting question.',
  '/changes shows files changed by crew tasks.',
  '/workflow show ID displays progress and model-turn usage.',
  '/workflow budget ID TURNS sets a lead workflow model-call limit.',
  '/briefing summarizes saved progress, questions, and recent results without a model call.',
  '/watch on 09:00 enables local alerts and a daily briefing at machine local time.',
  '/watch inbox reads saved alerts and briefings, including after a restart.',
  '/watch status shows settings; keep the app or --worker running for alerts.',
  '/watch clear clears saved notifications without repeating unchanged alerts.',
  '/watch off stops alerts; use /schedule pause ID to pause a recurring inspection.',
  '/schedule add 60 researcher GOAL creates a recurring read-only inspection using Codex.',
  '/workflow criteria ID checks acceptance; a completed assignment alone is not verified delivery.',
  '/commands QUERY searches descriptions and fills the prompt with a command.',
  '/search TEXT finds saved conversations, results, and project decisions locally.',
  'Linux Markdown exports are owner-only; Windows exports use folder ACLs.',
  'Use /stop to cancel the selected task or Crew Chat discussion.',
  'Use /personality NAME STYLE to set a teammate’s chat tone.',
];
export function cliTip(now = Date.now()) {
  return `Tip: ${CLI_TIPS[Math.floor(now / 30000) % CLI_TIPS.length]}`;
}
function messageBody(message, width, folder, speaker, names) {
  let text = message.role === 'assistant' ? readableReply(message.text) : message.text;
  const namesKey = JSON.stringify(names);
  if (message.role === 'assistant' && speaker) {
    const trimmed = text.trimStart();
    if (trimmed.slice(0, speaker.length + 1).toLowerCase() === `${speaker.toLowerCase()}:`) {
      text = trimmed.slice(speaker.length + 1).trimStart();
    }
  }
  const cached = renderedMessages.get(message);
  if (
    cached &&
    cached.text === text &&
    cached.role === message.role &&
    cached.width === width &&
    cached.folder === folder &&
    cached.namesKey === namesKey
  )
    return cached.rows;
  const rows =
    message.role === 'assistant' || message.role === 'user'
      ? renderMarkdown(text, width, { folder, names })
      : wrap(text, width).map(text => ({ text, tone: 'body' }));
  renderedMessages.set(message, { text, role: message.role, width, folder, namesKey, rows });
  return rows;
}
export function activityLabel(member, now = Date.now()) {
  if (member.status !== 'working') return member.status;
  const labels = {
    connecting: 'Connecting',
    thinking: 'Thinking',
    command: 'Running command',
    editing: 'Updating files',
    searching: 'Searching',
    tool: 'Using tool',
    responding: 'Preparing response',
  };
  const spinner = ['|', '/', '-', '\\'][Math.floor(now / 1000) % 4];
  return `${spinner} ${labels[member.progress?.phase] || 'Thinking'}...`;
}
export function screen(
  crew,
  selected,
  input,
  notice,
  columns = 100,
  rows = 30,
  scroll = 0,
  panel = null,
  { color = false, view = 'chat', activityScroll = 0, inputCursor = Array.from(input).length, composer = null } = {},
) {
  if (crew.codeChanged) notice = `Crew code changed on disk. Restart to load the update. ${notice || ''}`;
  const width = Math.max(30, columns - 1);
  composer ||= layoutInput(
    input,
    inputCursor,
    view === 'activity' ? 'activity' : view === 'group' ? 'crew' : selected,
    width,
    Math.max(1, Math.min(5, Math.floor(rows / 5))),
  );
  const height = Math.max(1, rows - 12 - (composer.lines.length - 1));
  const sidebar = width >= 70 ? 23 : 0;
  const contentWidth = width - sidebar - (sidebar ? 3 : 0);
  const readingWidth = Math.max(12, Math.min(92, contentWidth - 4));
  const member = crew.chatMember ? crew.chatMember(selected) : crew.member(selected);
  const activeChat = crew.state.conversations?.find(c => c.id === crew.state.activeConversations?.[selected]);
  const waiting = crew.state.tasks?.filter(task => task.status === 'waiting') || [];
  const questionCount = waiting.length + routingQuestions({ crew, selected, view }).length;
  if (questionCount) notice = `${questionCount} question(s) waiting — Shift+Right: answer | Enter or Shift+Left: send`;
  const row = (text, tone = 'body') => ({ text, tone });
  const clarificationRows = request => [
    row(request.answeredAt ? 'Question · Answered' : 'Question · Needs clarification', 'heading'),
    row(''),
    ...renderMarkdown(request.question, readingWidth, {
      folder: crew.folder,
      names: crew.state.members.map(member => member.name),
    }),
    ...(request.answeredAt
      ? [
          row(''),
          row('Your response', 'user'),
          ...renderMarkdown(request.answer || '', readingWidth, { folder: crew.folder }),
        ]
      : []),
    ...(!request.answeredAt ? [row(''), row('Shift+Right: answer | Enter or Shift+Left: send', 'selected')] : []),
  ];
  const messages = view === 'chat' && !panel ? displayMessages(member, crew.state.tasks, crew.state.workflows) : [];
  const answerRows = answer => [
    row('Question · Answered', 'heading'),
    ...renderMarkdown(answer.question, readingWidth, { folder: crew.folder }),
    row(''),
    row('Your response', 'user'),
    ...renderMarkdown(answer.answer, readingWidth, { folder: crew.folder }),
    row(''),
    row(''),
  ];
  const conversation = messages.flatMap(m => {
    if (m.clarification) return answerRows(m.clarification);
    const label = m.role === 'user' ? 'You' : m.role === 'assistant' ? nameLabel(selected) : 'System';
    const body = messageBody(
      m,
      readingWidth,
      crew.folder,
      selected,
      crew.state.members.map(member => member.name),
    );
    return [row(label, m.role), ...body, row(''), row('')];
  });
  if (view === 'chat' && !panel)
    for (const task of crew.state.tasks || []) {
      if (
        task.member !== selected ||
        task.discussionId ||
        (task.conversationId || null) !== (crew.state.activeConversations?.[selected] || null)
      )
        continue;
      const flow = crew.state.workflows?.find(flow => flow.id === task.workflowId);
      if (flow?.sourceDiscussionId || flow?.sourceConversationId) continue;
      for (const answer of task.answers || [])
        if (!messages.some(message => message.clarification === answer)) conversation.push(...answerRows(answer));
    }
  if (!conversation.length)
    conversation.push(
      row(`Say hello to ${selected}.`, 'heading'),
      row(''),
      row(''),
      ...roleRows(member.role, readingWidth),
      row(''),
      row(''),
      row('Press ? for commands.', 'muted'),
    );
  if (member.status === 'working')
    conversation.push(
      ...wrap(
        member.progress?.channel === 'group'
          ? 'This teammate is working in Crew Chat. F2 to switch tabs.'
          : `${activityLabel(member)}  /stop to cancel`,
        readingWidth,
      ).map(text => row(text, 'muted')),
    );
  for (const task of waiting.filter(
    task =>
      task.member === selected &&
      (task.conversationId || null) === (crew.state.activeConversations?.[selected] || null),
  ))
    conversation.push(
      row('WAITING FOR YOUR ANSWER', 'heading'),
      ...wrap(task.question, readingWidth).map(text => row(text)),
      row('Shift+Right to answer (press again for next question)', 'selected'),
    );
  let content = conversation;
  if (view === 'group') {
    const discussion = crew.discussions ? crew.discussions.current : crew.state.discussions?.at(-1);
    const tasks = crew.state.tasks?.filter(t => t.discussionId === discussion?.id) || [];
    const active = tasks.find(t => t.status === 'running');
    const pending = tasks.find(t => t.status === 'queued');
    const paused = discussion?.status === 'working' && !active && crew.queue?.paused;
    const discussionStatus = paused
      ? 'paused'
      : discussion?.status === 'working' && !active
        ? 'waiting'
        : discussion?.status;
    const timeline = [];
    let promptTime = discussion?.createdAt || 0;
    // Keep replies with their prompt, then place workflow output between turns.
    // Appending every workflow last hides new discussion messages behind old work.
    for (const { message: m } of (discussion?.messages || [])
      .map((message, index) => ({ message, order: message.discussionMessageIndex ?? index }))
      .filter(({ message }) => !message.queued || tasks.some(task => task.kind === 'direct'))
      .sort((a, b) => a.order - b.order)) {
      if (m.role === 'user') promptTime = m.submittedAt ?? discussion.createdAt ?? 0;
      timeline.push({
        at: promptTime,
        rows: [
          row(`${nameLabel(m.speaker)}${m.queued ? ' · queued' : ''}`, m.role),
          ...messageBody(
            m,
            readingWidth,
            crew.folder,
            m.speaker,
            crew.state.members.map(member => member.name),
          ),
          row(''),
          row(''),
        ],
      });
    }
    for (const task of crew.state.tasks || []) {
      const flow = crew.state.workflows?.find(flow => flow.id === task.workflowId);
      if (!flow) continue;
      if (!flow.sourceDiscussionId && !flow.sourceConversationId) continue;
      if (!discussion && !crew.state.activeGroupConversation) continue;
      const rows = workflowFeed(crew, readingWidth, crew.state.activeGroupConversation, {
        conversation: true,
        discussionId: discussion?.id,
        priorDiscussionIds: discussion?.priorDiscussionIds,
        workflowId: flow.id,
        taskId: task.id,
      });
      if (rows.length)
        timeline.push({ at: task.finishedAt || task.startedAt || task.createdAt || flow.createdAt || 0, rows });
    }
    const inputs = (crew.state.inputs || []).filter(
      input => input.view === 'group' && input.conversationId === (crew.state.activeGroupConversation || null),
    );
    for (const input of inputs.filter(input => !input.discussionId))
      timeline.push({
        at: input.createdAt,
        rows: [
          row('You', 'user'),
          ...renderMarkdown(input.text, readingWidth, {
            folder: crew.folder,
            names: crew.state.members.map(member => member.name),
          }),
          row(''),
          ...(input.question
            ? clarificationRows(input)
            : wrap(capitalize(inputStatus(crew, input, { concise: true })), readingWidth).map(text =>
                row(text, 'muted'),
              )),
          row(''),
          row(''),
        ],
      });
    content =
      discussion || timeline.length
        ? [
            row(`CREW CHAT · ${discussionStatus || 'workflow'}`, 'heading'),
            ...(discussion?.participants
              ? wrap(`Participants: ${discussion.participants.map(nameLabel).join(', ')}`, readingWidth).map(text =>
                  row(text, 'muted'),
                )
              : []),
            row(''),
            ...timeline.sort((a, b) => a.at - b.at).flatMap(entry => entry.rows),
          ]
        : [
            row('Start a crew discussion with /discuss TOPIC.', 'heading'),
            row(''),
            row('MEET YOUR CREW', 'heading'),
            ...wrap(
              '/discuss Everyone in the current crew, introduce yourself, your role, skills, file access, and one example task. Do not modify files.',
              readingWidth,
            ).map(text => row(text)),
            row(''),
            row('Or ask one teammate with @developer MESSAGE.', 'muted'),
          ];
    if (discussion?.status === 'working') {
      const queuedPrompts = discussion.messages.filter(message => message.queued).length;
      if (queuedPrompts)
        content.push(row(`${queuedPrompts} prompt(s) queued; waiting for all current turns to finish.`, 'muted'));
      const progress = active
        ? `${nameLabel(active.member)} · ${activityLabel(crew.member(active.member))}`
        : paused
          ? 'Queue paused · /queue resume to start'
          : `Waiting for ${pending?.member || 'the next speaker'}`;
      content.push(
        ...wrap(progress, readingWidth).map(text => row(text, 'muted')),
        row('Replies appear here when each turn finishes. /stop to end.', 'muted'),
      );
    } else if (discussion) {
      const failed = tasks.find(t => t.error);
      if (failed)
        content.push(
          ...wrap(`${failed.member}: ${failed.error}`, readingWidth).map(text => row(text, 'system')),
          row(''),
          row(''),
        );
      if (discussion.status === 'interrupted')
        content.push(row('App restarted. Start again with /discuss TOPIC.', 'muted'));
    }
    if (discussion?.pendingExecution)
      content.push(
        row(''),
        row('You · queued execution', 'user'),
        ...renderMarkdown(discussion.pendingExecution, readingWidth, {
          folder: crew.folder,
          names: crew.state.members.map(member => member.name),
        }),
        row('Your execution request will start after this discussion finishes.', 'muted'),
      );
    for (const task of crew.state.tasks || []) {
      const flow = (crew.discussions?.associatedWorkflows() || []).find(flow => flow.id === task.workflowId);
      if (!flow) continue;
      for (const correction of (task.steering || []).filter(entry => !entry.appliedAt))
        content.push(
          row(''),
          row(`You · queued correction for ${nameLabel(task.member)}`, 'user'),
          ...renderMarkdown(correction.text, readingWidth, {
            folder: crew.folder,
            names: crew.state.members.map(member => member.name),
          }),
          row('Waiting for the next task boundary; the current turn continues.', 'muted'),
        );
    }
  }
  if (view === 'group' || view === 'chat') {
    const latest = (crew.state.inputs || []).findLast(
      input =>
        input.view === view &&
        input.conversationId ===
          (view === 'group'
            ? crew.state.activeGroupConversation || null
            : crew.state.activeConversations[selected] || null) &&
        (view === 'group' || input.selected === selected),
    );
    if (latest && !(view === 'group' && latest.question))
      content.push(
        row(''),
        ...wrap(`Status · ${capitalize(inputStatus(crew, latest, { concise: true }))}`, readingWidth).map(text =>
          row(text, 'muted'),
        ),
      );
    if (latest && view === 'chat' && ['queued', 'routing', 'blocked', 'interrupted'].includes(latest.status))
      content.push(
        ...renderMarkdown(latest.text, readingWidth, {
          folder: crew.folder,
          names: crew.state.members.map(member => member.name),
        }),
      );
    if (latest?.question && view === 'chat') content.push(row(''), ...clarificationRows(latest));
  }
  if (view === 'activity') {
    const events = crew.activityEvents?.length ? crew.activityEvents : crew.activity.map(text => ({ text }));
    const names = crew.state.members.map(member => member.name);
    content = events.flatMap(event => activityRows(event, readingWidth, contentWidth - 6, crew.folder, names));
    content = [...workflowFeed(crew, readingWidth), ...content];
    if (!content.length)
      content = [
        row('No team activity yet.', 'heading'),
        row(''),
        row('Tasks, commands, searches and handoffs will appear here.', 'muted'),
      ];
  }
  const offset = view === 'activity' ? activityScroll : scroll;
  const activeMembers = crew.liveMembers ? crew.liveMembers() : crew.state.members.filter(m => m.status === 'working');
  const liveRows =
    view === 'activity' && !panel
      ? [
          ...activitySummary(crew).flatMap(text => wrap(text, readingWidth).map(text => row(text, 'muted'))),
          ...(activeMembers.length ? [row('LIVE NOW', 'heading')] : []),
          ...activeMembers
            .slice(0, Math.max(1, Math.min(3, Math.floor((height - 3) / 2))))
            .flatMap(m => [
              row(
                `${m.name} · ${activityLabel(m)} · ${Math.max(0, Math.floor((Date.now() - (m.progress?.startedAt || Date.now())) / 1000))}s`,
                'selected',
              ),
              row(m.progress?.action || 'Waiting for Codex events', 'muted'),
            ]),
        ].slice(0, Math.max(1, height - 4))
      : [];
  const logHeight = Math.max(1, height - liveRows.length - (liveRows.length ? 1 : 0));
  const end = content.length - Math.max(0, Math.min(offset, Math.max(0, content.length - logHeight)));
  let visible = content.slice(Math.max(0, end - logHeight), end);
  if (liveRows.length)
    visible = [
      ...visible,
      ...Array.from({ length: Math.max(0, logHeight - visible.length) }, () => row('')),
      row(''),
      ...liveRows,
    ];
  let panelPosition = '';
  if (panel) {
    const draft = panel.kind === 'answer' ? input.match(/^\/answer\s+(\S+)(?:\s([\s\S]*))?$/) : null;
    const lines =
      panel.kind === 'answer'
        ? [
            row('Question', 'heading'),
            ...renderMarkdown(panel.question, Math.min(92, contentWidth - 4), { folder: crew.folder }),
            row(''),
            row('Your response', 'user'),
            ...renderMarkdown(
              draft?.[1] === panel.questionId ? draft[2] || '(Type your response below)' : '(Type your response below)',
              Math.min(92, contentWidth - 4),
              { folder: crew.folder },
            ),
            row(''),
            row('Enter or Shift+Left: send | Shift+Right: next question | Esc: close', 'muted'),
          ]
        : panel.getRows
          ? panel.getRows(Math.min(92, contentWidth - 4))
          : (panel.getLines ? panel.getLines() : panel.lines).flatMap(line =>
              wrap(line, Math.min(92, contentWidth - 4), /DIFF/.test(panel.title)).map(text =>
                row(text, !/DIFF/.test(panel.title) && isRoleHeading(text) ? 'heading' : 'body'),
              ),
            );
    panel.maxOffset = Math.max(0, lines.length - height);
    panel.offset = panel.followLatest ? panel.maxOffset : Math.min(Math.max(0, panel.offset || 0), panel.maxOffset);
    visible = lines.slice(panel.offset, panel.offset + height);
    panelPosition = ` (${panel.offset + 1}-${Math.min(panel.offset + height, lines.length)}/${lines.length})`;
  }
  const capacity = Math.max(1, Math.floor((height - 11) / 3));
  const selectedIndex = crew.state.members.findIndex(m => m.name === selected);
  const firstMember = Math.min(
    Math.max(0, selectedIndex - capacity + 1),
    Math.max(0, crew.state.members.length - capacity),
  );
  const shown = crew.state.members
    .slice(firstMember, firstMember + capacity)
    .map(m => (crew.chatMember ? crew.chatMember(m.name) : m));
  const left = [
    `CREW ${firstMember + 1}-${firstMember + shown.length}/${crew.state.members.length}`,
    '',
    ...shown.flatMap(m => [
      `${view === 'chat' && m.name === selected ? '>' : ' '} ${nameLabel(m.name)}`,
      `  ${m.status === 'working' ? activityLabel(m) : m.status + (m.writable ? ' / write' : '')}`,
      '',
    ]),
    view === 'group' ? '> Crew Chat' : '  Crew Chat (Tab)',
    '',
    'VIEWS',
    view === 'chat' ? '> Chat' : '  Chat',
    view === 'group' ? '> Crew Chat' : '  Crew Chat: /group',
    view === 'activity' ? '> Activity' : '  Activity',
    '',
    '  F2: switch view',
  ];
  const fit = fitText;
  const tones = {
    title: '1;38;5;214',
    user: '1;36',
    assistant: '1;32',
    system: '1;33',
    heading: '1;37',
    body: '37',
    muted: '2;37',
    code: '38;5;180',
    link: '36',
    selected: '1;36',
    error: '1;31',
  };
  const paint = (text, tone) => (color ? `\x1b[${tones[tone] || tones.body}m${text}\x1b[0m` : text);
  const elapsed = member.progress
    ? Math.floor(((member.progress.finishedAt || Date.now()) - member.progress.startedAt) / 1000)
    : null;
  const status =
    member.status === 'working' ? activityLabel(member) : member.status === 'ready' ? 'Ready' : 'Needs attention';
  const tabs = ['chat', 'group', 'activity']
    .map(tab => {
      const title = tab === 'group' ? 'CREW CHAT' : tab.toUpperCase();
      return view === tab ? `[ ${title} ]` : title;
    })
    .join('    ');
  const output = [
    paint(fit(`  PONGKAN CREW   ${tabs}   F2 Switch   ? Help`, width), 'title'),
    paint(fit(`  Folder: ${crew.folder}`, width), 'muted'),
    paint('─'.repeat(width), 'muted'),
    paint(
      fit(
        panel
          ? `  ${panel.title}${panelPosition} | PgUp/PgDn: scroll | Esc: close`
          : view === 'activity'
            ? `  TEAM ACTIVITY  ·  ${activityScroll ? 'History / PgDn: newer' : 'Live / following latest'}  ·  PgUp/PgDn Scroll  ·  /chat Return`
            : view === 'group'
              ? `  CREW CHAT · ${crew.state.conversations?.find(c => c.id === crew.state.activeGroupConversation)?.title || 'Crew conversation'} · /crew-task Execute · /activity Tasks`
              : `  ${nameLabel(selected)}  ·  ${status}  ·  Model: ${member.model || 'Codex default'}${elapsed === null ? '' : `  ·  ${member.status === 'working' ? '' : 'last run '}${elapsed}s`}${activeChat ? ` · ${activeChat.title} (${activeChat.id})` : ''}${scroll ? '  ·  History / PgDn: newer' : ''}`,
        width,
      ),
      'heading',
    ),
  ];
  for (let i = 0; i < height; i++) {
    const message = visible[i] || row('');
    const body = paint(fit('  ' + message.text, contentWidth), message.tone);
    output.push(
      sidebar
        ? `${paint(fit(left[i] || '', sidebar), (left[i] || '').startsWith('>') ? 'selected' : 'muted')}${paint(' │ ', 'muted')}${body}`
        : body,
    );
  }
  output.push(
    paint('─'.repeat(width), 'muted'),
    '',
    ...composer.lines.map(line => paint(fit(line, width), 'user')),
    '',
    '',
    paint(
      fit(
        notice ||
          (composer.totalRows > 1
            ? `Input ${composer.hiddenBefore + 1}-${composer.hiddenBefore + composer.lines.length}/${composer.totalRows} · Up/Down Move · Shift+Left Queue · Enter Send`
            : view === 'group'
              ? 'F2 Next tab     |     Shift+Left Queue     |     @NAME Reply     |     Ctrl+K Stop'
              : view === 'activity'
                ? 'F2 Next tab  ·  Shift+F2 Previous  ·  ? Help  ·  Ctrl+C Quit'
                : '? Help  ·  F2 Next tab  ·  Shift+Left Queue  ·  Enter Send  ·  Ctrl+K Stop'),
        width,
      ),
      'muted',
    ),
    paint(fit(cliTip(), width), 'muted'),
    '',
  );
  return output.join('\n');
}
