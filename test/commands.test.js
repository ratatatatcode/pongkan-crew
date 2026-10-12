import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from '../src/crew.js';
import { execute, HELP, queuePrompt } from '../src/commands.js';
import { screen } from '../src/ui.js';

function setup(t) {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-controls-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const crew = new Crew(folder);
  return { crew, selected: 'chief', panel: null, notice: '', scroll: 0, send() {}, quit() {} };
}

test('queue shortcut submits a follow-up and resumes a paused crew without commands', t => {
  const app = setup(t);
  app.view = 'group';
  app.crew.queue.pause();
  const discussion = app.crew.discussions.start('Introduce yourselves');
  // Keep execution offline while verifying the keyboard submission boundary.
  app.crew.queue.drain = () => {};
  queuePrompt(app, 'What did you just do?');
  assert.equal(app.crew.queue.paused, false);
  assert.equal(app.crew.discussions.current, discussion);
  assert.equal(discussion.messages.at(-1).text, 'What did you just do?');
  assert.equal(discussion.messages[0].submission, 'enter');
  assert.equal(discussion.messages.at(-1).submission, 'shift-left');
  assert.equal(discussion.status, 'working');
  assert.match(app.notice, /queued/i);
});

test('new-all opens fresh saved chats for the whole crew and preserves previous history across restart', t => {
  const app = setup(t);
  app.view = 'activity';
  app.selected = 'developer';
  app.crew.member('chief').messages.push({ role: 'user', text: 'Keep legacy history' });
  const old = app.crew.conversations.create('developer', 'Earlier work');
  old.messages.push({ role: 'assistant', text: 'Keep named history' });
  old.threadId = 'old-session';
  const oldGroup = app.crew.conversations.create('group', 'Earlier discussion');
  app.crew.discussions.newConversation();
  execute(app, '/new-all');
  assert.equal(app.view, 'group');
  assert.equal(app.selected, 'developer');
  assert.notEqual(app.crew.state.activeGroupConversation, oldGroup.id);
  assert.equal(app.crew.discussions.current, undefined);
  for (const member of app.crew.state.members) {
    const chat = app.crew.chatMember(member.name);
    assert.deepEqual(chat.messages, []);
    assert.equal(chat.threadId, null);
    assert.ok(app.crew.state.activeConversations[member.name]);
  }
  const restored = new Crew(app.crew.folder);
  assert.equal(restored.member('chief').messages[0].text, 'Keep legacy history');
  assert.equal(restored.conversations.get(old.id).messages[0].text, 'Keep named history');
  assert.deepEqual(restored.state.activeConversations, app.crew.state.activeConversations);
  assert.doesNotMatch(screen(restored, 'developer', '', '', 100, 30, 0, null, { view: 'group' }), /Earlier discussion/);
});

test('new-all rejects arguments and unfinished work before changing any conversations', t => {
  const app = setup(t);
  const before = JSON.stringify(app.crew.state);
  assert.throws(() => execute(app, '/new-all extra'), /Use \/new-all/);
  assert.equal(JSON.stringify(app.crew.state), before);
  for (const status of ['queued', 'running', 'waiting']) {
    app.crew.state.tasks.push({ id: 'busy', member: 'chief', status });
    const busy = JSON.stringify(app.crew.state);
    assert.throws(() => execute(app, '/new-all'), /finish|stop|cancel/i);
    assert.equal(JSON.stringify(app.crew.state), busy);
    app.crew.state.tasks.pop();
  }
});
test('question mark and help open complete paged help without sending a prompt', t => {
  const app = setup(t);
  app.send = () => assert.fail('help must not call Codex');
  execute(app, '?');
  assert.deepEqual(app.panel.lines, HELP);
  assert.match(screen(app.crew, app.selected, '', '', 100, 25, 0, app.panel), /HELP/);
  execute(app, '/help');
  assert.ok(app.panel.lines.some(line => line.includes('/crew remove')));
});
test('crew controls persist names, roles and permissions and retain an active selection', t => {
  const app = setup(t);
  execute(app, '/crew add designer Improve layouts');
  execute(app, '/crew role designer Design terminal layouts');
  execute(app, '/crew access designer write');
  execute(app, '/crew rename designer artist');
  execute(app, '/chat artist');
  assert.equal(app.selected, 'artist');
  assert.equal(new Crew(app.crew.folder).member('artist').role, 'Design terminal layouts');
  assert.equal(app.crew.member('artist').writable, true);
  execute(app, '/crew remove artist');
  assert.equal(app.selected, 'chief');
  assert.throws(() => app.crew.member('artist'), /Unknown/);
  assert.throws(() => execute(app, '/crew access chief unrestricted'), /read.*write/);
});
test('busy members cannot be removed or reconfigured and last member cannot be removed', t => {
  const app = setup(t);
  app.crew.running.set('chief', new AbortController());
  for (const line of [
    '/crew remove chief',
    '/crew rename chief boss',
    '/crew role chief New role',
    '/crew access chief write',
    '/new',
  ]) {
    assert.throws(() => execute(app, line), /Stop/);
  }
  app.crew.running.clear();
  for (const name of ['researcher', 'developer']) execute(app, `/crew remove ${name}`);
  assert.throws(() => execute(app, '/crew remove reviewer'), /designated/);
  // Legacy single-member rosters must still keep their last teammate.
  app.crew.state.members = [app.crew.member('chief')];
  app.crew.state.coordination = null;
  assert.throws(() => execute(app, '/crew remove chief'), /last/);
});
test('clear keeps session while new resets it; retry resends last user message', t => {
  const app = setup(t);
  const member = app.crew.member('chief');
  member.threadId = 'saved';
  member.messages.push({ role: 'user', text: 'Original task' });
  app.send = (name, text) => assert.deepEqual([name, text], ['chief', 'Original task']);
  execute(app, '/retry');
  execute(app, '/clear');
  assert.equal(member.threadId, 'saved');
  assert.equal(member.messages.length, 0);
  execute(app, '/new');
  assert.equal(member.threadId, null);
});
test('invalid commands and missing arguments produce usage errors', t => {
  const app = setup(t);
  for (const line of ['/crew', '/crew rename chief', '/crew role chief', '/send', '/task', '/unknown']) {
    assert.throws(() => execute(app, line));
  }
});

test('activity and chat switches preserve selected teammate and do not send prompts', t => {
  const app = setup(t);
  app.selected = 'researcher';
  app.send = () => assert.fail('view switches must not call Codex');
  for (const command of ['/switch activity', '/activity', '/act']) {
    execute(app, command);
    assert.equal(app.view, 'activity');
    assert.equal(app.selected, 'researcher');
    assert.equal(app.panel, null);
  }
  assert.throws(() => execute(app, 'accidental message'), /\/chat/);
  execute(app, '/switch chat');
  assert.equal(app.view, 'chat');
  execute(app, '/activity');
  execute(app, '/chat');
  assert.equal(app.view, 'chat');
  assert.equal(app.selected, 'researcher');
  execute(app, '/switch');
  assert.equal(app.view, 'group');
  execute(app, '/switch');
  assert.equal(app.view, 'activity');
  execute(app, '/switch');
  assert.equal(app.view, 'chat');
  execute(app, '/switch prev');
  assert.equal(app.view, 'activity');
  execute(app, '/chat developer');
  assert.equal(app.selected, 'developer');
  assert.equal(app.view, 'chat');
  assert.throws(() => execute(app, '/switch unknown'), /chat.*activity/);
});

test('help overlays return to activity and its log follows new entries', t => {
  const app = setup(t);
  app.crew.member('chief').messages.push({ role: 'assistant', text: 'PRIVATE_CHAT_CONTENT' });
  app.crew.notify('researcher: Running a command in the selected project');
  execute(app, '/activity');
  execute(app, '/help');
  execute(app, '/close');
  assert.equal(app.view, 'activity');
  const render = () => screen(app.crew, app.selected, '', '', 110, 32, 0, app.panel, { view: app.view });
  assert.match(render(), /\[ ACTIVITY \]/);
  assert.match(render(), /Running a command/);
  assert.doesNotMatch(render(), /PRIVATE_CHAT_CONTENT/);
  app.crew.notify('developer: NEW_LIVE_EVENT');
  assert.match(render(), /NEW_LIVE_EVENT/);
  execute(app, '/chat');
  const chat = render();
  assert.match(chat, /\[ CHAT \]/);
  assert.match(chat, /PRIVATE_CHAT_CONTENT/);
  assert.doesNotMatch(chat, /NEW_LIVE_EVENT/);
});
