import { renderMarkdown, wrapText } from './markdown.js';
import { commandExamples } from './command-examples.js';
import { ROLES, roleMember } from './roles.js';
import { presetListRows } from './preset-display.js';
import { directMessages } from './conversations.js';
import { spacedRoleText } from './role-display.js';
import { nameLabel } from './name-display.js';
import { readModelCatalog, readModelDefaults, modelLabel, validateModelChoice, modelCatalogLines } from './models.js';
import { steer } from './steering.js';
import { PERSONALITIES } from './personality.js';
import { CODEX_PERMISSION_MODES } from './codex-permissions.js';
import { workflowReport, criteriaLines, searchHistory, nextAction, taskNextAction } from './workspace-insights.js';
import { usageLines } from './usage.js';
import { templateCommand } from './task-templates.js';
import { openCommandPicker } from './command-picker.js';
import { briefingLines } from './briefing.js';
export const HELP = [
  'Type normally and press Enter: the recipient AI interprets your full request.',
  'Slash commands are optional overrides. UPPERCASE = replace with a value; [VALUE] = optional.',
  'Names below use the default crew; /crew list shows your actual names.',
  'Model IDs are examples; use /model list to check your installed catalog.',
  'You can search descriptions and examples with /help QUERY.',
  '',
  'HELP — COMMANDS AND CONTROLS',
  'Mouse wheel or PgUp/PgDn: scroll help | Esc: return to previous view',
  '',
  'CREW',
  '/roles list [QUERY]           Browse reusable specialist roles',
  '/roles show ROLE              Read responsibilities, checks and handoffs',
  '/crew add NAME --role ROLE    Add a specialist with its default access',
  '/crew role NAME --role ROLE   Apply specialist instructions and access',
  '/preset list                  List built-in and saved crew presets',
  '/preset show NAME             Preview roles and permissions',
  '/preset apply NAME            Archive current crew and apply preset',
  '/preset save NAME [LEAD REVIEWER] Save current roles as a custom preset',
  '/preset create NAME [LEAD REVIEWER] Save new team; reject existing names',
  '/preset title NAME TEXT        Set saved team display title',
  '/preset improve MEMBER [GOALS] Ask Codex for read-only role suggestions',
  '/preset delete NAME            Delete custom definition; keep crew/files',
  '/preset restore ARCHIVE_ID    Restore a complete archived crew',
  '/crew list                     List teammates and permissions',
  '/crew add NAME [ROLE]          Add a read-only teammate',
  '/crew remove NAME             Archive/remove non-coordinator; exact arguments required',
  '/crew rename NAME NEWNAME     Rename teammate; keep lead/reviewer routing',
  '/crew role NAME ROLE          Change instructions for future turns',
  '/crew access NAME read|write  Set permissions; reviewer stays read-only',
  '/permissions [NAME]           Choose Codex permissions for a teammate',
  '/permissions MODE [NAME]      Set ask, approve, full, or read-only',
  '/crew info [NAME]             Show role, permissions and session',
  '',
  '/personality                  List styles and current teammate settings',
  '/personality [NAME] STYLE     Set selected teammate or NAME; use all for crew',
  '/personality reset [NAME]     Restore neutral style',
  '',
  'CHAT AND TASKS',
  '/discuss TOPIC                Two read-only crew rounds and lead summary',
  '/group                       Open shared Crew Chat',
  '/share NAME [REQUEST]        Share latest private exchange in a duo Crew Chat',
  '@NAME MESSAGE                Send directly to a teammate with their configured access',
  '/chat [NAME]                  Return to chat, optionally select teammate',
  '/next /prev                   Cycle teammates and Crew Chat',
  '/task TEXT                    Lead plans, dispatches, reviews, summarizes',
  '/crew-task [GOAL]             Execute latest Crew Chat plan; optional goal',
  '/task --isolated GOAL         Run in a separate Git worktree',
  '/crew-task --isolated [GOAL]  Execute discussion in a separate worktree',
  '/worktree list|show ID        Inspect retained isolated workflow changes',
  '/worktree review ID           Preview changes and merge readiness against current HEAD',
  '/search TEXT                  Search saved chats, task results and project decisions',
  '/usage [WORKFLOW_ID]          Show reported tokens, model turns and cumulative elapsed time',
  '/template list                List saved task instructions',
  '/template save NAME TEXT      Save instructions; optional {{goal}} placeholder',
  '/template show NAME           Read saved task instructions',
  '/template run NAME GOAL       Start a workflow using saved instructions',
  '/template delete NAME         Delete saved task instructions',
  '/steer TASK_OR_WORKFLOW_ID TEXT Queue a correction at the next task boundary',
  '/schedule add MINUTES NAME GOAL Create a recurring read-only task',
  '/schedule add MINUTES NAME --write GOAL Allow member write permissions',
  '/schedule list|pause ID|resume ID|run ID Manage recurring tasks',
  '/briefing                     Summarize saved progress and questions without a model call',
  '/watch on [HH:MM]             Enable local alerts; daily briefing uses machine local time',
  '/watch off                    Disable alerts and daily briefings; schedules keep running',
  '/watch status                 Show settings; alerts require the app or --worker running',
  '/watch inbox                  Read the latest 50 saved alerts and daily briefings',
  '/watch clear                  Clear the inbox without repeating unchanged alerts',
  '/github issue|pr OWNER/REPO NUMBER Read a GitHub issue or PR',
  '/github task OWNER/REPO NUMBER [--isolated] Implement an issue locally',
  '/conversation list           List named conversations',
  '/conversation new NAME|group TITLE Create an isolated chat',
  '/conversation open ID        Reopen a conversation',
  '/conversation archive|restore ID Keep or reopen saved history',
  '/conversation default [NAME|group] Return to legacy chat',
  '/memory show|add TEXT|remove ID Manage editable project decisions',
  '/send NAME TEXT               Send work to a specific teammate',
  "/handoff NAME [TASK]           Send selected agent's latest answer",
  "/retry                        Resend selected agent's last user message",
  '/questions [on|off|list]       Clarification mode and pending questions',
  '/answer TASK_ID TEXT          Answer and continue the same assignment',
  'Shift+Right                  Fill answer command; press again for next question',
  '/stop [NAME|all]              Cancel work (selected agent by default)',
  '',
  'TASK QUEUE AND WORKFLOWS',
  '/queue list                   Show durable tasks and IDs',
  '/queue show ID                Show task prompt, result and error',
  '/queue pause|resume           Pause dispatch / resume saved tasks',
  '/queue cancel ID              Cancel queued or running task',
  '/queue move ID POSITION       Reorder queued work (1-based)',
  '/queue retry ID               Explicitly repeat a finished task',
  '/workflow list [STATUS]       List workflows (active, paused, or all)',
  '/workflow show ID             Show plan, steps and summary',
  '/workflow report ID           Show completed work, blockers and next action',
  '/workflow criteria ID         Inspect requested requirements and review evidence',
  '/workflow cancel ID           Cancel workflow and dependent steps',
  '/workflow pause ID            Pause workflow after the active turn stops',
  '/workflow resume ID           Continue unfinished steps; keep completed work',
  '/workflow budget ID TURNS     Set the overall model-turn budget for new execution',
  '/workflow retry ID            Restart complete workflow; may repeat edits',
  '/recovery [WORKFLOW_ID]       Diagnose and repair unfinished work; renew bounded recovery',
  '',
  'CONVERSATION AND VIEWS',
  '/clear                        Clear local transcript; keep Codex session',
  '/new                          Clear transcript and start fresh session',
  '/new-all                      Fresh conversations for every teammate and Crew Chat',
  "/status                       Show the whole crew's current status",
  '/context [on|off|status]       Control local context clipping; inspect character counts',
  '/markdown [on|off]            Save finished workflows, discussions and tasks as Markdown',
  '/markdown refresh             Regenerate finished exports; consolidate old task files',
  '/model [NAME]                 Show model settings and live status',
  '/model list                   Browse locally cached Codex models',
  '/model set NAME|all MODEL [EFFORT] Choose model for future tasks',
  '/model reset [NAME|all]        Use inherited Codex model and effort',
  '/activity or /act             Open the live team activity tab',
  '/switch chat|group|activity   Select a tab; /switch cycles all three',
  '/folder                       Show active folder and state file',
  '/progress [NAME]              Live action, elapsed time, files and errors',
  '/diff [last|git|TASK_ID]       View last writer diff or repository diff',
  '/changes                      List captured changed files',
  '/doctor                       Check Codex version and login',
  '/archives                     List recoverable changes',
  '/archives restore ID [NAME]   Restore saved conversation as a teammate',
  '/undo                         Restore latest removed/cleared conversation',
  '/help or ?                    Open this help panel',
  '/help QUERY                   Search the command guide',
  '/commands [QUERY]             Search and select commands with argument hints',
  '/close                        Close a panel',
  '/restart                      Reload Crew code; preserve launch options',
  '/quit or /exit                Stop tasks and exit',
  '',
  'KEYBOARD',
  'F1 or ? on empty input        Open help immediately',
  'F2 / Shift+F2                 Next / previous tab (Chat, Crew Chat, Activity)',
  'Esc                           Close panel / return to chat / clear input',
  'Tab on /command               Complete command or teammate name',
  'Shift+Left                   Submit prompt; resume this conversation only',
  'Shift+Enter                  Insert a new line without sending',
  'Tab / Shift+Tab               Cycle teammates and Crew Chat',
  'Up / Down                     Move input lines; history beyond first/last line',
  'Mouse wheel                   Scroll responses, activity or panels',
  'PgUp / PgDn                   Scroll history or panel',
  'Left / Right                 Move input cursor across lines',
  'Home / End                   Start / end of input line',
  'Ctrl+Home / Ctrl+End          Start / end of entire prompt',
  'Backspace / Delete            Delete text at cursor',
  'Ctrl+U                        Clear input',
  'Ctrl+W                        Delete previous word',
  'Ctrl+P / Ctrl+N               Previous / next input history',
  'Ctrl+K                        Stop selected teammate',
  'Ctrl+L                        Redraw screen',
  'Ctrl+C                        Stop all work and quit',
  '',
  'NOTES',
  'One writer per workspace. Isolated worktrees can run in parallel.',
  'Stop a teammate before removing, renaming or reconfiguring it.',
  'Remove/clear/new archive local history. /undo restores the latest change.',
  'Saved work starts paused after restart. /queue resume resumes queued work.',
  'Plain messages go directly to the recipient. /workflow retry ID restarts the complete workflow.',
  'Lead workflows choose one action at a time within a configurable model-turn budget.',
  'New lead workflows require independent acceptance before delivery; legacy histories may differ.',
].flatMap(commandExamples);

function idle(crew, name) {
  const member = crew.member(name);
  if ([...crew.running.keys()].some(key => key === name || key.startsWith(`${name}:`)))
    throw new Error('Stop this teammate before changing it.');
  if (crew.state.tasks.some(task => task.member === name && ['queued', 'waiting'].includes(task.status)))
    throw new Error('Answer or cancel waiting/queued tasks for this teammate before changing it.');
  if (crew.state.workflows.some(flow => !TERMINAL.has(flow.status)))
    throw new Error('Cancel or finish active workflows before changing the crew.');
  return member;
}
export function cycle(app, direction) {
  const members = app.crew.state.members;
  const index = app.view === 'group' ? members.length : members.findIndex(m => m.name === app.selected);
  const next = (index + direction + members.length + 1) % (members.length + 1);
  app.view = next === members.length ? 'group' : 'chat';
  if (app.view === 'chat') app.selected = members[next].name;
  app.panel = null;
  app.scroll = 0;
}
export function queuePrompt(app, text) {
  const line = text.trim();
  if (!line) return;
  const result = execute(app, line, { submission: 'shift-left' });
  const finish = () => {
    app.notice = `${app.notice || 'Message queued.'} Current turns continue.`;
  };
  if (result?.then) return result.then(finish);
  finish();
}

export function execute(app, line, { submission = 'enter' } = {}) {
  const crew = app.crew;
  app.notice = '';
  app.scroll = 0;
  const panel = (title, lines, options = {}) => {
    app.panel = {
      title,
      lines: typeof lines === 'function' ? lines() : lines,
      getLines: typeof lines === 'function' ? lines : null,
      offset: 0,
      ...options,
    };
  };
  const markdownPanel = (title, lines) => {
    panel(title, lines);
    const current = app.panel;
    let cached;
    current.getRows = width => {
      const text = (current.getLines ? current.getLines() : current.lines).join('\n\n');
      if (cached?.text === text && cached.width === width) return cached.rows;
      const rows = renderMarkdown(text, width, { folder: crew.folder });
      cached = { text, width, rows };
      return rows;
    };
  };
  const load = (title, promise) => {
    panel(title, ['Loading...']);
    const current = app.panel;
    return promise
      .then(lines => {
        if (app.panel === current) {
          current.lines = lines;
          crew.emit('change');
        }
      })
      .catch(error => {
        if (app.panel === current) {
          current.lines = [error.message];
          crew.emit('change');
        }
      });
  };
  if (line === '?' || line === '/help') {
    panel('HELP', HELP);
    return;
  }
  if (!line.startsWith('/')) {
    const mention = line.match(/^@([a-z][a-z0-9-]*)(?:[,:]?\s+)([\s\S]+)$/i);
    if (mention) {
      const target = mention[1].toLowerCase();
      crew.member(target);
      return crew.inputs.submit(app, mention[2], { submission, target });
    }
    if (!mention) return crew.inputs.submit(app, line, { submission });
  }
  const [command, ...parts] = line.trim().split(/\s+/);
  const text = line.trim().slice(command.length).trim();
  const requireText = value => {
    if (!value?.trim()) throw new Error(`Missing arguments. See /help for ${command}.`);
    return value;
  };
  const chat = name => {
    app.selected = crew.member(name || app.selected).name;
    app.panel = null;
    app.view = 'chat';
  };
  if (command === '/help') {
    const matches = HELP.filter(line => line.toLowerCase().includes(text.toLowerCase()));
    panel(`HELP: ${text || 'all'}`, matches.length ? matches : ['No help matches. Try another search.']);
    return;
  }
  if (command === '/commands') openCommandPicker(app, text, HELP);
  else if (command === '/search') {
    const result = searchHistory(crew, text);
    panel(`SEARCH: ${text}`, [
      ...(result.matches.length ? result.matches : ['No saved history matches.']),
      ...(result.truncated ? ['Showing the first 40 matches. Narrow your search for more specific results.'] : []),
    ]);
  } else if (command === '/usage') {
    if (parts.length > 1) throw new Error('Use /usage [WORKFLOW_ID].');
    const flow = parts[0] ? crew.workflows.get(parts[0]) : null;
    panel('USAGE', () => usageLines(crew.state, flow));
  } else if (command === '/template') {
    const [action, name] = parts;
    if (
      !['list', 'save', 'show', 'run', 'delete'].includes(action) ||
      (action === 'list'
        ? parts.length !== 1
        : ['show', 'delete'].includes(action)
          ? parts.length !== 2
          : parts.length < 3)
    )
      throw new Error('Use /template list|show NAME|save NAME TEXT|run NAME GOAL|delete NAME.');
    const body = text.replace(/^\S+\s+\S+\s*/, '');
    const result = templateCommand(crew, action, name, body);
    if (action === 'run') return execute(app, `/task ${result}`, { submission });
    if (action === 'list' || action === 'show')
      panel('TASK TEMPLATES', result.length ? result : ['No templates. Use /template save NAME TEXT.']);
    else app.notice = `Template ${name} ${action === 'save' ? 'saved' : 'deleted'}.`;
  } else if (command === '/restart') app.restart();
  else if (command === '/quit' || command === '/exit') app.quit();
  else if (command === '/questions') {
    if (parts.length > 1 || (text && !['on', 'off', 'list'].includes(text)))
      throw new Error('Use /questions on|off|list.');
    if (text === 'on' || text === 'off') {
      crew.state.questionsEnabled = text === 'on';
      crew.save();
      app.notice = `Questions ${text.toUpperCase()} for future turns. Existing waiting tasks still need /answer or /queue cancel.`;
    } else
      panel('CREW QUESTIONS', () => [
        `Questions: ${crew.state.questionsEnabled === false ? 'OFF (AI decides routine choices)' : 'ON'}`,
        '',
        ...crew.state.tasks
          .filter(t => t.status === 'waiting')
          .flatMap(t => [`${t.id} ${t.member}: ${t.question}`, `/answer ${t.id} YOUR_REPLY`, '']),
        'Permission approvals remain separate from clarification answers.',
      ]);
  } else if (command === '/permissions') {
    const mode = CODEX_PERMISSION_MODES.find(option => option.id === parts[0]);
    if (mode) {
      if (parts.length > 2) throw new Error('Use /permissions MODE [NAME].');
      const member = crew.member(parts[1] || app.selected);
      member.codexPermissions = mode.id;
      crew.save();
      app.panel = null;
      app.notice = `Codex permissions set to ${mode.label} for ${member.name}; it applies to future turns.`;
    } else {
      if (parts.length > 1) throw new Error('Use /permissions [NAME] or /permissions MODE [NAME].');
      const member = crew.member(parts[0] || app.selected);
      const currentMode = member.codexPermissions || 'approve';
      const currentIndex = Math.max(
        0,
        CODEX_PERMISSION_MODES.findIndex(option => option.id === currentMode),
      );
      panel(`CODEX PERMISSIONS · ${member.name}`, []);
      const picker = app.panel;
      picker.kind = 'codex-permissions';
      picker.permissionIndex = currentIndex;
      picker.getRows = width => [
        { text: 'Choose the Codex permission mode for future turns.', tone: 'muted' },
        { text: '' },
        ...CODEX_PERMISSION_MODES.map((option, index) => ({
          text: `${index === picker.permissionIndex ? '›' : ' '} ${index + 1}. ${option.label}${option.id === currentMode ? '  (current)' : ''}`,
          tone: index === picker.permissionIndex ? 'selected' : 'heading',
        })),
        { text: '' },
        ...wrapText(CODEX_PERMISSION_MODES[picker.permissionIndex].description, width - 4).map(text => ({
          text,
          tone: 'body',
        })),
        ...(!member.writable
          ? [{ text: 'This teammate is read-only; that access limit overrides these modes.', tone: 'muted' }]
          : []),
        { text: '↑/↓ Select  ·  Enter Apply  ·  Esc Cancel', tone: 'muted' },
      ];
      picker.onSelect = () => {
        const selectedMode = CODEX_PERMISSION_MODES[picker.permissionIndex];
        member.codexPermissions = selectedMode.id;
        crew.save();
        app.panel = null;
        app.notice = `Codex permissions set to ${selectedMode.label} for ${member.name}; it applies to future turns.`;
      };
    }
  } else if (command === '/answer') {
    if (crew.state.inputs?.some(input => input.id === parts[0]))
      return crew.inputs.answer(app, parts[0], requireText(parts.slice(1).join(' ')), { submission });
    crew.queue.answer(parts[0], requireText(parts.slice(1).join(' ')));
    app.panel = null;
    app.notice = `Answer saved for ${parts[0]}${crew.queue.paused ? '; /queue resume to continue' : '; assignment continues'}.`;
  } else if (command === '/discuss' || command === '/group') {
    if (command === '/discuss') {
      crew.discussions.start(requireText(text), null, { submission });
      app.notice = crew.queue.paused ? 'Discussion queued; /queue resume to start.' : 'Discussion started.';
    }
    app.view = 'group';
    app.panel = null;
  } else if (command === '/switch' || command === '/activity' || command === '/act') {
    const views = ['chat', 'group', 'activity'];
    const nextView =
      views[(Math.max(0, views.indexOf(app.view || 'chat')) + (parts[0] === 'prev' ? 2 : 1)) % views.length];
    const target = command === '/switch' ? (!parts[0] || parts[0] === 'prev' ? nextView : parts[0]) : 'activity';
    if (!['chat', 'activity', 'group'].includes(target) || (command === '/switch' && parts.length > 1))
      throw new Error('Use /switch chat, /switch activity, or /switch group.');
    app.view = target;
    app.panel = null;
    app.activityScroll = 0;
  } else if (command === '/close') app.panel = null;
  else if (command === '/next' || command === '/prev') cycle(app, command === '/next' ? 1 : -1);
  else if (command === '/chat') chat(parts[0]);
  else if (command === '/roles') {
    const [action = 'list', key, ...rest] = parts;
    if (action === 'list') {
      const query = parts.slice(1).join(' ').toLowerCase();
      const matches = Object.entries(ROLES).filter(([key, r]) =>
        `${key} ${r.title} ${r.category}`.toLowerCase().includes(query),
      );
      panel(
        'ROLE CATALOG',
        matches.length
          ? [
              ...matches.map(
                ([key, r]) => `${key} — ${r.title} | ${r.category} | ${r.writable ? 'write' : 'read-only'}`,
              ),
              '',
              '/roles show ROLE to inspect. /crew add NAME --role ROLE to add.',
            ]
          : ['No roles match. Use /roles list.'],
      );
    } else if (action === 'show' && key && !rest.length) {
      const member = roleMember(key);
      const r = ROLES[key];
      panel(`ROLE ${key}`, [
        r.title,
        '',
        `Default access: ${member.writable ? 'write' : 'read-only'}`,
        '',
        '',
        spacedRoleText(member.role),
      ]);
    } else throw new Error('Use /roles list [QUERY] or /roles show ROLE.');
  } else if (command === '/personality') {
    if (!parts.length || parts[0] === 'list') {
      if (parts.length > 1) throw new Error('Use /personality or /personality list.');
      panel('CHAT PERSONALITIES', [
        ...Object.entries(PERSONALITIES).map(
          ([style, description]) => `${style}${style === 'neutral' ? ' (default)' : ''} — ${description}`,
        ),
        '',
        ...crew.state.members.map(member => `${member.name}: ${member.personality || 'neutral'}`),
        '',
        'Set one with /personality NAME STYLE. Example: /personality developer jokester.',
      ]);
    } else if (parts[0] === 'reset') {
      if (parts.length > 2) throw new Error('Use /personality reset [NAME].');
      const member = crew.member(parts[1] || app.selected);
      delete member.personality;
      crew.save();
      app.panel = null;
      app.notice = `${member.name} uses the neutral chat style.`;
    } else {
      const selectedStyle = parts.length === 1 && Object.hasOwn(PERSONALITIES, parts[0]);
      const targetName = selectedStyle ? app.selected : parts[0];
      const style = selectedStyle ? parts[0] : parts[1];
      if ((!selectedStyle && parts.length !== 2) || !Object.hasOwn(PERSONALITIES, style)) {
        throw new Error(`Use /personality [NAME|all] STYLE. Styles: ${Object.keys(PERSONALITIES).join(', ')}.`);
      }
      const members = targetName === 'all' ? crew.state.members : [crew.member(targetName)];
      for (const member of members) member.personality = style;
      crew.save();
      app.panel = null;
      app.notice = `${targetName === 'all' ? 'All teammates' : members[0].name} chat style set to ${style}. Roles, work, and permissions are unchanged.`;
    }
  } else if (command === '/preset') {
    const [action = 'list', name, lead, reviewer, ...extra] = parts;
    if (action === 'list' && !name) {
      panel('CREW PRESETS', []);
      app.panel.getRows = width => presetListRows(crew.presets.list(), crew.state.activePreset, width);
    } else if (action === 'show' && name && !lead) {
      const p = crew.presets.get(name);
      panel(`PRESET ${name}`, [
        p.title,
        '',
        `Lead: ${p.lead}`,
        `Reviewer: ${nameLabel(p.reviewer)}`,
        '',
        '',
        ...p.members.flatMap(m => [
          `${m.name} — ${m.writable ? 'write' : 'read-only'}`,
          '',
          spacedRoleText(m.role),
          '',
          '',
        ]),
        'Applying archives the current crew and starts fresh conversations. /undo restores the previous crew.',
      ]);
    } else if (action === 'apply' && name && !lead) {
      crew.presets.apply(name);
      chat(crew.leadName);
      app.notice = `Applied ${name}. Previous crew archived; /undo to restore.`;
    } else if (action === 'title' && name) {
      crew.presets.title(name, parts.slice(2).join(' '));
      app.notice = `Updated title for ${name}.`;
    } else if (action === 'delete' && name && !lead) {
      crew.presets.delete(name);
      app.notice = `Deleted saved preset ${name}. Current crew and project files are preserved.`;
    } else if (action === 'improve' && name) {
      const member = crew.member(name);
      const task = crew.queue.enqueue(
        name,
        `Suggest improved role instructions for ${name}. Include skills, responsibilities, deliverables, checks, boundaries and handoffs. Suggest a descriptive team title if useful. Return suggested text and /crew role commands for the user to review and apply manually. Do not edit files or settings. Current instructions: ${member.role}\nUser goals: ${parts.slice(2).join(' ') || 'Improve clarity and specificity.'}`,
        { readOnly: true },
      );
      chat(name);
      app.notice = `Read-only description suggestions queued as ${task.id}; review the reply before applying.`;
    } else if (['save', 'create'].includes(action) && name && !extra.length && (!lead || reviewer)) {
      if (action === 'create' && Object.hasOwn(crew.presets.list(), name))
        throw new Error('Preset already exists. Use /preset save to update a custom preset.');
      crew.presets.save(name, lead, reviewer);
      app.notice = `Saved preset ${name} for this folder.`;
    } else if (action === 'restore' && name && !lead) {
      crew.presets.restore(name);
      chat(crew.state.members.some(m => m.name === crew.leadName) ? crew.leadName : crew.state.members[0].name);
      app.notice = 'Archived crew restored.';
    } else
      throw new Error(
        'Use /preset list|show NAME|apply NAME|create NAME [LEAD REVIEWER]|save NAME [LEAD REVIEWER]|title NAME TEXT|improve MEMBER [GOALS]|delete NAME|restore ARCHIVE_ID.',
      );
  } else if (command === '/crew') {
    const [action, name, ...rest] = parts;
    if (action === 'chat') chat(name);
    else if (action === 'list')
      panel(
        'CREW',
        crew.state.members.flatMap(m => [
          `${m.name} — ${m.status} / ${m.writable ? 'write' : 'read'}`,
          '',
          spacedRoleText(m.role),
          '',
          '',
        ]),
      );
    else if (action === 'info') {
      const m = crew.member(name || app.selected);
      panel('TEAMMATE', [
        m.name,
        '',
        `Status: ${m.status}`,
        `Requested model: ${modelLabel(m)}`,
        `Access: ${m.writable ? 'workspace-write' : 'read-only'}`,
        '',
        '',
        spacedRoleText(m.role),
        '',
        '',
        `Direct session: ${m.threadId || 'Not started'}`,
        `Direct messages: ${directMessages(m).length}`,
      ]);
    } else if (action === 'add') {
      let specialist;
      if (rest[0] === '--role') {
        if (rest.length !== 2) throw new Error('Use /crew add NAME --role ROLE.');
        specialist = roleMember(rest[1], name);
      }
      crew.add(
        name || '',
        specialist?.role || rest.join(' ') || 'Assist with the project.',
        specialist?.writable || false,
      );
      crew.notify(`Added ${name}`);
      app.notice = `Added ${name} (${specialist?.writable ? 'write' : 'read-only'}).`;
    } else if (['remove', 'rename', 'role', 'access'].includes(action)) {
      if (action === 'remove' && (!name || rest.length))
        throw new Error('Use /crew remove NAME. Extra arguments are not accepted.');
      const member = idle(crew, name);
      if (action === 'remove') {
        if (crew.state.members.length === 1) throw new Error('Cannot remove the last teammate.');
        if ([crew.leadName, crew.reviewerName].includes(name))
          throw new Error('Cannot remove the designated lead or reviewer. Apply another preset first.');
        crew.archive(`remove ${name}`);
        crew.state.members = crew.state.members.filter(m => m !== member);
        delete crew.state.activeConversations[name];
        for (const job of crew.state.schedules.filter(s => s.member === name)) job.enabled = false;
        if (app.selected === name) app.selected = crew.state.members[0].name;
        app.notice = `Removed ${name}. Use /undo to restore its history.`;
      } else if (action === 'rename') {
        const next = requireText(rest[0]);
        if (rest.length !== 1 || !/^[a-z][a-z0-9-]{0,31}$/.test(next))
          throw new Error('Use one lowercase name, up to 32 letters, numbers or hyphens.');
        if (crew.state.members.some(m => m.name === next)) throw new Error('That teammate already exists.');
        member.name = next;
        for (const discussion of crew.state.discussions)
          if (discussion.participants)
            discussion.participants = discussion.participants.map(participant =>
              participant === name ? next : participant,
            );
        for (const c of crew.state.conversations) if (c.member === name) c.member = next;
        for (const t of crew.state.tasks) if (t.conversationId && t.member === name) t.member = next;
        for (const job of crew.state.schedules) if (job.member === name) job.member = next;
        for (const flow of crew.state.workflows)
          if (Object.hasOwn(flow.conversations || {}, name)) {
            flow.conversations[next] = flow.conversations[name];
            delete flow.conversations[name];
          }
        if (crew.state.activeConversations[name]) {
          crew.state.activeConversations[next] = crew.state.activeConversations[name];
          delete crew.state.activeConversations[name];
        }
        if (crew.state.coordination)
          for (const key of ['lead', 'reviewer'])
            if (crew.state.coordination[key] === name) crew.state.coordination[key] = next;
        if (app.selected === name) app.selected = next;
      } else if (action === 'role') {
        if (rest[0] === '--role') {
          if (rest.length !== 2) throw new Error('Use /crew role NAME --role ROLE.');
          const specialist = roleMember(rest[1], name);
          if (crew.reviewerName === name && specialist.writable)
            throw new Error('The designated reviewer must remain read-only.');
          member.role = specialist.role;
          member.writable = specialist.writable;
        } else member.role = requireText(rest.join(' '));
      } else {
        if (rest.length !== 1 || !['read', 'write'].includes(rest[0])) throw new Error('Access must be read or write.');
        if (crew.reviewerName === name && rest[0] === 'write')
          throw new Error('The designated reviewer must remain read-only.');
        member.writable = rest[0] === 'write';
      }
      crew.save();
      app.panel = null;
      crew.notify(`${action}: ${name}`);
      app.notice ||= `${name} updated.`;
    } else throw new Error('Use /crew list|add|remove|rename|role|access|info|chat. See /help.');
  } else if (command === '/stop') {
    if (parts.length > 1) throw new Error('Use /stop [NAME|all].');
    if (parts[0] && parts[0] !== 'all') crew.member(parts[0]);
    crew.inputs?.cancel(app, { all: parts[0] === 'all', member: parts[0] && parts[0] !== 'all' ? parts[0] : null });
    if (!parts[0] && ['group', 'activity'].includes(app.view)) {
      const workflows = crew.discussions.associatedWorkflows().filter(flow => !TERMINAL.has(flow.status));
      crew.discussions.stop();
      for (const flow of workflows) crew.workflows.cancel(flow.id);
      app.notice = workflows.length
        ? `Crew Chat stopped; ${workflows.length} workflow(s) cancelled.`
        : 'Discussion stopped.';
      return;
    }
    if (parts[0] === 'all') {
      crew.queue.pause();
      for (const task of crew.state.tasks) if (!TERMINAL.has(task.status)) crew.queue.cancel(task.id);
      for (const controller of crew.running.values()) controller.abort();
      app.notice = 'All tasks cancelled; queue paused.';
    } else {
      const name = parts[0] || app.selected;
      crew.member(name);
      const conversationId = crew.state.activeConversations[name] || null;
      const task = crew.state.tasks.find(
        t => t.member === name && (t.conversationId || null) === conversationId && t.status === 'running',
      );
      if (task) crew.queue.cancel(task.id);
      else crew.stop(name);
      app.notice = `Stop requested for ${name}.`;
    }
  } else if (command === '/task' || command === '/crew-task') {
    if (command === '/crew-task' && !crew.discussions.current?.messages.length) {
      throw new Error(
        'No Crew Chat discussion available. Use /discuss TOPIC first, or /task GOAL for a standalone task.',
      );
    }
    const isolated = parts[0] === '--isolated';
    const goalText = isolated ? text.slice('--isolated'.length).trim() : text;
    const request =
      command === '/crew-task'
        ? goalText || 'Implement the agreed plan from the latest Crew Chat discussion.'
        : requireText(goalText);
    const goal = command === '/crew-task' || app.view === 'group' ? crew.discussions.executionGoal(request) : request;
    const options = {
      sourceDiscussionId: command === '/crew-task' || app.view === 'group' ? crew.discussions.current?.id : null,
      sourceConversationId:
        command === '/crew-task' || app.view === 'group' ? crew.state.activeGroupConversation : null,
    };
    const opened = flow => {
      if (flow.workspace) crew.conversations.open(flow.conversations[crew.leadName]);
      if (command === '/crew-task' || options.sourceDiscussionId || options.sourceConversationId) {
        app.view = 'group';
        app.panel = null;
        app.scroll = 0;
      } else chat(crew.leadName);
      app.notice = `Workflow ${flow.id} created${flow.workspace ? ` in ${flow.branch}` : ''}${crew.queue.paused ? '; /queue resume to start' : ''}.`;
    };
    if (isolated) return crew.workflows.startIsolated(goal, options).then(opened);
    opened(crew.workflows.start(goal, options));
  } else if (command === '/worktree') {
    if ((!parts.length || parts[0] === 'list') && parts.length <= 1)
      panel('ISOLATED WORKFLOWS', () =>
        crew.state.workflows
          .filter(f => f.workspace)
          .flatMap(f => [
            `${f.id} ${f.status} · ${f.branch}`,
            f.workspace,
            `Chats: ${Object.entries(f.conversations || {})
              .map(([name, id]) => `${name}=${id}`)
              .join(' ')}`,
            '',
          ]),
      );
    else if (parts[0] === 'show' && parts.length === 2)
      return load(
        'WORKTREE CHANGES',
        crew.worktrees.diff(parts[1]).then(text => text.split('\n')),
      );
    else if (parts[0] === 'review' && parts.length === 2)
      return load('WORKTREE REVIEW', crew.worktrees.review(parts[1]));
    else
      throw new Error(
        'Use /worktree list|show|review WORKFLOW_ID. Worktrees are retained; commit and merge them explicitly with Git.',
      );
  } else if (command === '/send') {
    crew.member(parts[0]);
    app.send(parts[0], requireText(parts.slice(1).join(' ')));
  } else if (command === '/share') {
    if (app.view !== 'chat') throw new Error('Open the individual Chat you want to share first.');
    crew.discussions.share(app.selected, requireText(parts[0]), parts.slice(1).join(' '), { submission });
    app.view = 'group';
    app.panel = null;
    app.notice = 'Latest private exchange shared; replies appear in this Crew Chat.';
  } else if (command === '/handoff') {
    crew.member(parts[0]);
    const answer = directMessages(crew.chatMember(app.selected)).findLast(m => m.role === 'assistant');
    if (!answer) throw new Error('No answer available to hand off yet.');
    app.send(
      parts[0],
      `Handoff from ${app.selected}:\n${answer.text}\n\n${parts.slice(1).join(' ') || 'Continue from these findings according to your role.'}`,
    );
    crew.notify(`${app.selected} -> ${parts[0]}: handoff`);
  } else if (command === '/retry') {
    const conversationId = crew.state.activeConversations[app.selected] || null;
    if (
      crew.running.has(crew.runKey(app.selected, conversationId)) ||
      crew.state.tasks.some(
        t =>
          t.member === app.selected &&
          (t.conversationId || null) === conversationId &&
          ['queued', 'waiting'].includes(t.status),
      )
    )
      throw new Error('Finish or cancel work in this conversation before retrying.');
    const member = crew.chatMember(app.selected);
    const last = directMessages(member).findLast(m => m.role === 'user');
    if (!last) throw new Error('No previous user message to retry.');
    app.send(app.selected, last.text);
  } else if (command === '/github') {
    const [action, repo, number, flag, ...extra] = parts;
    if (
      extra.length ||
      (flag && (action !== 'task' || flag !== '--isolated')) ||
      !['issue', 'pr', 'task'].includes(action)
    )
      throw new Error('Use /github issue|pr|task OWNER/REPO NUMBER [--isolated for task].');
    const pending = crew.github.read(action === 'pr' ? 'pr' : 'issue', repo, number);
    if (action !== 'task')
      return load(
        'GITHUB SOURCE',
        pending.then(record => [record.url, record.state, '', record.title, '', ...record.body.split('\n')]),
      );
    app.notice = 'Reading GitHub issue…';
    return pending.then(async record => {
      const goal = crew.github.goal(record);
      const flow = flag ? await crew.workflows.startIsolated(goal) : crew.workflows.start(goal);
      if (flow.workspace) crew.conversations.open(flow.conversations[crew.leadName]);
      chat(crew.leadName);
      app.notice = `Workflow ${flow.id} created from GitHub issue. No remote changes sent.`;
    });
  } else if (command === '/briefing') {
    if (parts.length) throw new Error('Use /briefing.');
    panel('PONGKAN CREW BRIEFING', () => briefingLines(crew));
  } else if (command === '/watch') {
    const [action = 'status', time] = parts;
    if (action === 'on' && parts.length <= 2) {
      crew.watch.enable(time);
      app.notice = `Pongkan Crew watch ON; daily briefing at ${crew.state.watch.time} machine local time. Keep the app or --worker running.`;
    } else if (parts.length <= 1 && action === 'off') {
      crew.watch.disable();
      app.notice = 'Pongkan Crew watch OFF. Recurring schedules keep their own settings.';
    } else if (parts.length <= 1 && action === 'clear') {
      crew.watch.clear();
      app.notice = 'Pongkan Crew notification inbox cleared.';
    } else if (parts.length <= 1 && ['status', 'inbox'].includes(action)) {
      panel('PONGKAN CREW WATCH', () => crew.watch.lines(action === 'inbox'));
    } else throw new Error('Use /watch on [HH:MM]|off|status|inbox|clear.');
  } else if (command === '/schedule') {
    const [action = 'list', id, ...rest] = parts;
    if (action === 'list' && !id)
      panel('SCHEDULES', () => [
        'Runs require the app or --worker to be running.',
        '',
        ...crew.state.schedules.map(
          s =>
            `${s.id} ${s.enabled ? 'on' : 'paused'} · ${s.member} · every ${s.minutes}m · ${s.readOnly ? 'read-only' : 'member access'} · ${new Date(s.nextRun).toISOString()}\n${s.text}`,
        ),
      ]);
    else if (action === 'add') {
      const [member, ...goal] = rest;
      const writable = goal[0] === '--write';
      const job = crew.scheduler.add(Number(id), member, (writable ? goal.slice(1) : goal).join(' '), writable);
      app.notice = `Schedule ${job.id} saved. Keep the app or --worker running.`;
    } else if (['pause', 'resume'].includes(action) && id && !rest.length) {
      crew.scheduler.setEnabled(id, action === 'resume');
      app.notice = `Schedule ${action}d.`;
    } else if (action === 'run' && id && !rest.length) {
      crew.scheduler.get(id);
      const tasks = crew.scheduler.tick(Date.now(), id);
      app.notice = tasks.length ? `Task ${tasks[0].id} queued.` : 'Queue paused or schedule task still active.';
    } else throw new Error('Use /schedule add MINUTES NAME [--write] GOAL|list|pause ID|resume ID|run ID.');
  } else if (command === '/steer') {
    const entry = steer(crew, parts[0], parts.slice(1).join(' '));
    app.notice = `Instruction ${entry.id} saved for the next task boundary; the running turn is not interrupted.`;
  } else if (command === '/memory') {
    const [action = 'show', ...rest] = parts;
    if (action === 'show' && !rest.length)
      panel('PROJECT MEMORY', () => [
        crew.memory.file,
        '',
        ...crew.memory.list().map(e => `${e.id}: ${e.text}`),
        '',
        'Use /memory add TEXT or /memory remove ID. This guidance does not grant permissions.',
      ]);
    else if (action === 'add') app.notice = `Saved memory ${crew.memory.add(requireText(rest.join(' '))).id}.`;
    else if (action === 'remove' && rest.length === 1) {
      crew.memory.remove(rest[0]);
      app.notice = 'Memory removed.';
    } else throw new Error('Use /memory show|add TEXT|remove ID.');
  } else if (command === '/conversation') {
    const [action = 'list', target, ...title] = parts;
    if (action === 'list' && !target)
      panel('CONVERSATIONS', () =>
        crew.state.conversations.length
          ? crew.state.conversations.map(
              c =>
                `${c.id} ${c.kind === 'group' ? 'Crew Chat' : c.member} · ${c.title}${c.archived ? ' (archived)' : ''}`,
            )
          : ['No named conversations. Use /conversation new NAME|group TITLE.'],
      );
    else if (action === 'new') {
      const c = crew.conversations.create(target, title.join(' '));
      app.view = c.kind === 'group' ? 'group' : 'chat';
      if (c.member) app.selected = c.member;
      app.panel = null;
      app.scroll = 0;
      app.notice = `Conversation ${c.id}: ${c.title}`;
    } else if (action === 'open' && target && !title.length) {
      const c = crew.conversations.open(target);
      app.view = c.kind === 'group' ? 'group' : 'chat';
      if (c.member) app.selected = c.member;
      app.panel = null;
      app.scroll = 0;
      app.notice = c.title;
    } else if (['archive', 'restore'].includes(action) && target && !title.length) {
      const c = crew.conversations.archive(target, action === 'archive');
      app.notice = `${action}: ${c.title}`;
    } else if (action === 'default' && !title.length) {
      if (target === 'group') {
        crew.state.activeGroupConversation = null;
        app.view = 'group';
      } else {
        const name = target || app.selected;
        crew.member(name);
        delete crew.state.activeConversations[name];
        chat(name);
      }
      crew.save();
      app.panel = null;
      app.scroll = 0;
    } else
      throw new Error(
        'Use /conversation list|new NAME|group TITLE|open ID|archive ID|restore ID|default [NAME|group].',
      );
  } else if (command === '/new-all') {
    if (parts.length) throw new Error('Use /new-all without arguments.');
    if (
      crew.running.size ||
      crew.state.tasks.some(task => !TERMINAL.has(task.status)) ||
      crew.state.workflows.some(flow => !TERMINAL.has(flow.status)) ||
      crew.state.discussions.some(discussion => discussion.status === 'working')
    ) {
      throw new Error('Finish or cancel active work first. Use /stop all before /new-all.');
    }
    for (const member of crew.state.members) crew.conversations.create(member.name, 'New conversation');
    crew.conversations.create('group', 'New Crew Chat');
    app.view = 'group';
    app.panel = null;
    app.scroll = 0;
    app.activityScroll = 0;
    app.notice = 'Fresh conversations ready for all teammates and Crew Chat. Previous conversations remain saved.';
  } else if (command === '/new' || command === '/clear') {
    if (app.view === 'group') {
      if (command === '/clear')
        throw new Error('Use /new to start a blank Crew Chat. Previous discussions remain saved.');
      if (crew.state.activeGroupConversation) {
        if (crew.discussions.current?.status === 'working')
          throw new Error('A discussion is active. Use /stop before starting a fresh conversation.');
        crew.conversations.create('group', 'New Crew Chat');
      }
      crew.discussions.newConversation();
      app.panel = null;
      app.scroll = 0;
      app.notice = 'Fresh Crew Chat ready. Previous discussions remain saved.';
      return;
    }
    if (crew.state.activeConversations[app.selected]) {
      if (command === '/clear')
        throw new Error('Use /conversation archive ID to keep this history, or /new for a blank conversation.');
      const c = crew.conversations.create(app.selected, 'New conversation');
      app.panel = null;
      app.scroll = 0;
      app.notice = `Fresh conversation ${c.id} ready.`;
      return;
    }
    const member = idle(crew, app.selected);
    crew.archive(`${command.slice(1)} ${app.selected}`);
    member.messages = [];
    member.status = 'ready';
    if (command === '/new') member.threadId = null;
    crew.save();
    app.panel = null;
    app.notice =
      command === '/new'
        ? 'Fresh conversation ready.'
        : 'Local transcript cleared. Codex still remembers this session.';
  } else if (command === '/undo') {
    app.notice = `Restored ${crew.undo()}.`;
    if (!crew.state.members.some(m => m.name === app.selected)) app.selected = crew.state.members[0].name;
    app.panel = null;
  } else if (command === '/archives') {
    if (!parts[0])
      panel(
        'ARCHIVES',
        crew.state.archives.length
          ? crew.state.archives.map(a => `${a.id} ${a.at} ${a.reason}${a.undoable === false ? ' (use restore)' : ''}`)
          : ['No archived changes.'],
      );
    else if (parts[0] === 'restore') {
      app.selected = crew.restoreArchive(parts[1], parts[2]);
      app.panel = null;
      app.notice = `Restored as ${app.selected}.`;
    } else throw new Error('Use /archives or /archives restore ID [NAME]. Choose a new name if the original exists.');
  } else if (command === '/queue') {
    const [action, id, position] = parts;
    if (!action || action === 'list')
      panel(
        'TASK QUEUE',
        () => [
          `Dispatch: ${crew.queue.paused ? 'PAUSED — /queue resume' : 'RUNNING'}`,
          '',
          ...crew.state.tasks.map(
            t =>
              `${t.id} ${t.status} -> ${t.member}${t.workflowId ? ` [workflow ${t.workflowId}]` : ''}\n${t.text.slice(0, 140)}`,
          ),
        ],
        { followLatest: true },
      );
    else if (action === 'show') {
      crew.queue.get(id);
      markdownPanel(`TASK ${id}`, () => {
        const task = crew.queue.get(id);
        return [
          `${task.status} -> ${task.member}`,
          `Depends on: ${task.dependsOn || 'none'}`,
          `Conversation: ${task.conversationId || 'default'}`,
          ...(task.steering || []).map(
            s =>
              `Correction ${s.id}: ${s.text} (${s.appliedAt ? `delivered ${new Date(s.appliedAt).toISOString()}` : 'pending'})`,
          ),
          `Elapsed: ${task.startedAt ? Math.floor(((task.finishedAt || Date.now()) - task.startedAt) / 1000) : 0}s`,
          '',
          'PROMPT',
          task.text,
          '',
          'RESULT',
          task.result || '(none)',
          '',
          'ERROR',
          task.error || '(none)',
          `Next: ${taskNextAction(crew, task)}`,
        ];
      });
    } else if (action === 'pause') crew.queue.pause();
    else if (action === 'resume') crew.queue.resume();
    else if (action === 'cancel') crew.queue.cancel(id);
    else if (action === 'move') crew.queue.move(id, Number(position));
    else if (action === 'retry') app.notice = `Queued retry ${crew.queue.retry(id).id}.`;
    else throw new Error('Use /queue list|show|pause|resume|cancel|move|retry.');
  } else if (command === '/recovery') {
    if (parts.length > 1) throw new Error('Use /recovery [WORKFLOW_ID].');
    const flows = ['group', 'activity'].includes(app.view)
      ? crew.discussions.associatedWorkflows()
      : crew.state.workflows.filter(
          flow =>
            !flow.sourceConversationId &&
            !flow.sourceDiscussionId &&
            (flow.conversations?.[app.selected] || null) === (crew.state.activeConversations[app.selected] || null),
        );
    const id = parts[0] || flows.findLast(flow => flow.status !== 'completed')?.id;
    if (!id)
      throw new Error('No unfinished workflow in this conversation. Use /workflow list, then /recovery WORKFLOW_ID.');
    const flow = crew.workflows.recovery(id);
    crew.queue.resumeScope(task => task.workflowId === flow.id);
    app.panel = null;
    app.notice = `Recovery started for ${flow.id}; completed work preserved. Investigation, repair and verification continue automatically within existing permissions. Check /activity for progress.`;
  } else if (command === '/workflow') {
    const [action, id] = parts;
    if (action === 'report' || action === 'criteria') {
      if (parts.length !== 2) throw new Error(`Use /workflow ${action} WORKFLOW_ID.`);
      const flow = crew.workflows.get(id);
      panel(`WORKFLOW ${action.toUpperCase()} ${id}`, () =>
        action === 'report' ? workflowReport(crew.state, flow, crew) : criteriaLines(flow),
      );
      return;
    }
    if (!action || action === 'list') {
      const filter = action === 'list' ? id : null;
      if (filter && !['active', 'paused', 'all'].includes(filter))
        throw new Error('Use /workflow list [active|paused|all].');
      panel('WORKFLOWS', []);
      app.panel.getRows = width =>
        crew.state.workflows.filter(
          flow =>
            !filter ||
            filter === 'all' ||
            (filter === 'paused' ? flow.status === 'paused' : flow.status !== 'paused' && !TERMINAL.has(flow.status)),
        ).length
          ? crew.state.workflows
              .filter(
                flow =>
                  !filter ||
                  filter === 'all' ||
                  (filter === 'paused'
                    ? flow.status === 'paused'
                    : flow.status !== 'paused' && !TERMINAL.has(flow.status)),
              )
              .flatMap(flow => {
                const goal = (flow.requestGoal || flow.text).trim().split(/\r?\n/)[0];
                const preview = renderMarkdown(goal, width, { folder: crew.folder }).slice(0, 2);
                const steps = crew.state.tasks.filter(task => task.workflowId === flow.id);
                const done = steps.filter(task => task.status === 'completed').length;
                const current = steps.find(task => task.id === flow.currentTask);
                return [
                  { text: `${flow.id} · ${flow.status}`, tone: 'heading' },
                  ...preview,
                  {
                    text: `Progress: ${done}/${steps.length} steps${current ? ` · current ${current.member} (${current.status})` : ''}`,
                    tone: 'muted',
                  },
                  { text: `/workflow show ${flow.id}`, tone: 'muted' },
                  { text: '', tone: 'body' },
                ];
              })
          : [{ text: 'No workflows. Use /task GOAL.', tone: 'body' }];
    } else if (action === 'show') {
      crew.workflows.get(id);
      markdownPanel(`WORKFLOW ${id}`, () => {
        const flow = crew.workflows.get(id);
        return [
          `Status: ${flow.status}`,
          ...(flow.engine === 'lead'
            ? [`Execution: persistent lead · model turns ${flow.turns}/${flow.turnBudget}`]
            : []),
          `Goal: ${flow.text}`,
          ...(flow.workspace
            ? [
                `Branch: ${flow.branch}`,
                `Worktree: ${flow.workspace}`,
                ...Object.entries(flow.conversations || {}).map(([name, id]) => `${name}: /conversation open ${id}`),
              ]
            : []),
          ...(flow.steering || []).map(s => `Correction: ${s.text}`),
          '',
          ...crew.state.tasks
            .filter(t => t.workflowId === id)
            .map(t => `${t.id} ${t.kind} -> ${t.member}: ${t.status}`),
          ...crew.state.tasks
            .filter(t => t.workflowId === id)
            .flatMap(t => [
              ...(crew.state.members.find(member => member.name === t.member)?.progress?.taskId === t.id
                ? [`  Progress: ${crew.state.members.find(member => member.name === t.member).progress.action}`]
                : []),
              ...(t.result ? [`  Result: ${t.result}`] : []),
              ...(t.error ? [`  Error: ${t.error}`] : []),
            ]),
          '',
          'SUMMARY',
          flow.result || '(pending)',
          '',
          'ERROR',
          flow.error || '(none)',
          `Next: ${nextAction(
            crew,
            flow,
            crew.state.tasks.filter(task => task.workflowId === id),
          )}`,
          '',
          'EXECUTION EVIDENCE',
          ...crew.state.tasks
            .filter(t => t.workflowId === id)
            .flatMap(t => {
              const attempts = t.executionAttempts || [];
              if (!attempts.length) return [];
              return attempts.map(
                attempt =>
                  `${t.member} (${t.id}): ${attempt.command}\n` +
                  `Context: ${attempt.cwd}; ${attempt.policy?.sandbox || 'unknown'}; approval ${attempt.policy?.approval || 'unknown'}\n` +
                  `Exit: ${attempt.exitCode ?? 'unknown'}\n${attempt.output || attempt.accessFailure || '(no output)'}`,
              );
            }),
        ];
      });
      app.panel.followLatest = true;
    } else if (action === 'budget') {
      if (parts.length !== 3 || !/^\d+$/.test(parts[2]))
        throw new Error('Use /workflow budget WORKFLOW_ID TOTAL_TURNS.');
      const flow = crew.workflows.setBudget(id, Number(parts[2]));
      app.notice = `Workflow ${id} model-turn budget: ${flow.turns}/${flow.turnBudget}. Resume explicitly to continue stopped work.`;
    } else if (action === 'cancel') crew.workflows.cancel(id);
    else if (action === 'pause') {
      if (parts.length !== 2) throw new Error('Use /workflow pause WORKFLOW_ID.');
      crew.workflows.pause(id);
      app.notice = `Workflow ${id} paused; any active turn will stop before it can resume.`;
    } else if (action === 'resume') {
      if (parts.length !== 2) throw new Error('Use /workflow resume WORKFLOW_ID.');
      const flow = crew.workflows.resume(id);
      crew.queue.resumeScope(task => task.workflowId === flow.id);
      app.notice = `Workflow ${flow.id} resumed; completed steps are preserved.`;
    } else if (action === 'retry') {
      const result = crew.workflows.retry(id);
      const show = flow => {
        app.notice = `Workflow ${flow.id} created. Retry may repeat earlier edits.`;
      };
      if (result?.then) return result.then(show);
      show(result);
    } else throw new Error('Use /workflow list [active|paused|all]|show|pause|cancel|resume|retry.');
  } else if (command === '/diff') {
    if (parts[0] === 'git' || (!parts[0] && !crew.state.lastDiff))
      return load(
        'REPOSITORY DIFF',
        gitDiff(crew.folder).then(diff => diff.split('\n')),
      );
    const diff = !parts[0] || parts[0] === 'last' ? crew.state.lastDiff : crew.queue.get(parts[0]).diff;
    panel(
      'WRITER DIFF',
      diff ? diff.text.split('\n') : ['No captured writer diff yet. Use /diff git for repository changes.'],
    );
  } else if (command === '/changes')
    panel(
      'CHANGED FILES',
      crew.state.lastDiff?.files.length
        ? crew.state.lastDiff.files
        : ['No changed text files captured in the latest writer task.'],
    );
  else if (command === '/doctor')
    return load(
      'STARTUP CHECKS',
      checkRuntime().then(result => [
        result.ok ? 'READY' : 'ACTION NEEDED',
        ...result.lines,
        `Folder: ${crew.folder}`,
        `Saved state: ${crew.file}`,
      ]),
    );
  else if (command === '/progress') {
    const name = parts[0] || app.selected;
    crew.member(name);
    panel(`PROGRESS ${name}`, () => {
      const m = crew.chatMember(name),
        p = m.progress;
      return [
        `Status: ${m.status}`,
        `Action: ${p?.action || 'Not started'}`,
        `Elapsed: ${p ? Math.floor(((p.finishedAt || Date.now()) - p.startedAt) / 1000) : 0}s`,
        `Requested model: ${modelLabel(p || m)}`,
        `Events: ${p?.events || 0}`,
        '',
        'CHANGED FILES',
        ...(p?.files || []),
        '',
        'LATEST SYSTEM MESSAGE',
        directMessages(m).findLast(msg => msg.role === 'system')?.text || '(none)',
      ];
    });
  } else if (command === '/markdown') {
    if (parts.length > 1 || (text && !['on', 'off', 'refresh'].includes(text)))
      throw new Error('Use /markdown on|off|refresh.');
    if (text === 'refresh') {
      const result = crew.markdownExporter.refresh(crew.state);
      app.notice = `Markdown exports refreshed: ${result.written} written, ${result.failed} failed.${result.failed ? ' See Activity for errors.' : ''}`;
      return;
    }
    if (text) crew.setMarkdown(text === 'on');
    app.notice = `Markdown saving ${crew.state.markdownEnabled ? 'ON' : 'OFF'}; destination: ${crew.folder}/docs/pongkan-docs. Existing documents are retained.`;
  } else if (command === '/context') {
    if (parts.length > 1 || (text && !['on', 'off', 'status'].includes(text)))
      throw new Error('Use /context on|off|status.');
    if (text === 'on' || text === 'off') {
      crew.state.contextOptimization = text === 'on';
      crew.save();
      app.notice = `Context optimization ${text.toUpperCase()} for future prompts; saved history and active turns are preserved.`;
    } else
      panel('CONTEXT OPTIMIZER', () => [
        `Mode: ${crew.state.contextOptimization ? 'ON' : 'OFF (default)'}`,
        '',
        'Opt in: /context on | Disable: /context off',
        'Locally clips long assistant replies in handoffs, discussions and recovered history.',
        'Preserves user text, clarification answers, file lists and original saved records.',
        'Target: 24,000 characters per context section; protected text may exceed it.',
        'Does not control Codex session history. Character counts are not token usage.',
        '',
        ...Object.entries(crew.state.contextStats || {}).map(
          ([kind, stats]) =>
            `${kind}: ${stats.before} -> ${stats.after} characters; ${stats.clipped} shortened replies`,
        ),
        'Counts show the latest optimized section of each type, not total prompt size.',
        'Middle text can contain important evidence. Inspect /queue show ID for full task results.',
      ]);
  } else if (command === '/model') {
    const [action, target, model, effort, ...extra] = parts;
    if (action === 'list' && parts.length === 1) {
      const catalog = readModelCatalog();
      panel('MODEL CHOICES', modelCatalogLines(catalog, app.selected));
    } else if (action === 'set' || action === 'reset') {
      if (action === 'set') {
        if (!target || !model || extra.length) throw new Error('Use /model set NAME|all MODEL [EFFORT].');
        validateModelChoice(model, effort);
      } else if (parts.length > 2) throw new Error('Use /model reset [NAME|all].');
      const names = target === 'all' ? crew.state.members.map(member => member.name) : [target || app.selected];
      const members = names.map(name => idle(crew, name));
      for (const member of members) {
        if (action === 'reset') {
          delete member.model;
          delete member.reasoningEffort;
        } else {
          member.model = model;
          if (effort) member.reasoningEffort = effort;
          else delete member.reasoningEffort;
        }
      }
      crew.save();
      crew.notify(`Model settings updated: ${names.join(', ')}`);
      app.notice = 'Model settings saved for future turns. Conversation history is preserved.';
    } else if (parts.length <= 1) {
      const name = action || app.selected;
      crew.member(name);
      const render = (defaults = {}) => {
        const member = crew.chatMember(name);
        return [
          `Status: ${member.status}`,
          `Requested model: ${modelLabel(member, defaults)}`,
          `Action: ${member.progress?.action || 'Not started'}`,
          `Last turn requested: ${member.progress ? modelLabel(member.progress) : 'Not started'}`,
          '',
          'Model selections are requests; Codex reports errors for unavailable models.',
          'Inherited settings are resolved by Codex for this project; running sessions may differ.',
          'Use /model list, /model set NAME|all MODEL [EFFORT], or /model reset [NAME|all].',
        ];
      };
      const member = crew.member(name);
      if (member.model && member.reasoningEffort) panel(`MODEL ${name}`, () => render());
      else
        return load(
          `MODEL ${name}`,
          readModelDefaults(
            crew.state.workflows.find(
              f => f.workspace && Object.values(f.conversations || {}).includes(crew.state.activeConversations[name]),
            )?.workspace || crew.folder,
          )
            .then(defaults => render(defaults))
            .catch(() => [...render(), '', 'Inherited model unavailable. Use /model set to choose a specific model.']),
        );
    } else
      throw new Error(
        'Use /model [NAME], /model list, /model set NAME|all MODEL [EFFORT], or /model reset [NAME|all].',
      );
  } else if (command === '/status')
    panel('STATUS', () => [
      `Preset: ${crew.state.activePreset || 'default / customized'}`,
      `Lead: ${nameLabel(crew.leadName)} | Reviewer: ${nameLabel(crew.reviewerName)}`,
      `Questions: ${crew.state.questionsEnabled === false ? 'OFF' : 'ON'} | Waiting: ${crew.state.tasks.filter(t => t.status === 'waiting').length}`,
      `Dispatch: ${crew.queue.paused ? 'PAUSED' : 'RUNNING'}`,
      '',
      ...crew.state.members.flatMap(m => [
        `${m.name}: ${m.status} | ${m.writable ? 'write' : 'read'} | requested model: ${modelLabel(m)}`,
        `  ${m.progress?.action || 'Not started'} | ${m.messages.length} messages`,
      ]),
    ]);
  else if (command === '/folder') panel('FOLDER', [crew.folder, '', 'Saved state:', crew.file]);
  else throw new Error('Unknown command. Press ? or use /help.');
}
import { gitDiff } from './diff.js';
import { checkRuntime } from './runtime.js';
import { TERMINAL } from './tasks.js';
