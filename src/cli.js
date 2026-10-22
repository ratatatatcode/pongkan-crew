#!/usr/bin/env node
import { resolve } from 'node:path';
import { emitKeypressEvents } from 'node:readline';
import { PassThrough } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { isatty } from 'node:tty';

import { Crew } from './crew.js';
import { screen } from './ui.js';
import { execute, queuePrompt, cycle, HELP } from './commands.js';
import { acquireLock, checkRuntime } from './runtime.js';
import { completions } from './controls.js';
import { commandPickerKey } from './command-picker.js';
import { layoutInput, navigateInput, PromptHistory, promptEnterAction } from './input.js';
import { MOUSE_ON, MOUSE_OFF, scrollView, terminalInput } from './scroll.js';
import { enableWindowsMouse, connectWindowsInput } from './windows-input.js';
import { runWorker } from './scheduler.js';
import { answerShortcut } from './answer-shortcut.js';
import { TerminalRenderer, scheduleRender } from './terminal-renderer.js';
import { sourceChanged } from './source-version.js';
import { launchRestart } from './restart.js';
import { startTerminalTitle } from './terminal-title.js';

const args = process.argv.slice(2);
const help = `Pongkan Crew — folder-specific Codex teammates
Usage: node src/cli.js [--folder <path>] [--preview|--doctor|--worker [--once]]
Requires Node 22+ and a signed-in Codex CLI. Defaults to current folder.
State: <folder>/.pongkan-crew/state.json. --preview does not call Codex.`;

async function main() {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(help + '\n\n' + HELP.join('\n'));
    return;
  }
  let folder = process.cwd(),
    preview = false,
    doctor = false,
    worker = false,
    once = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--folder' && args[i + 1]) folder = resolve(args[++i]);
    else if (args[i] === '--preview') preview = true;
    else if (args[i] === '--doctor') doctor = true;
    else if (args[i] === '--worker') worker = true;
    else if (args[i] === '--once') once = true;
    else throw new Error(`Unknown or incomplete option: ${args[i]}\n${help}`);
  }
  if ((once && !worker) || [preview, doctor, worker].filter(Boolean).length > 1)
    throw new Error('Use one mode: --preview, --doctor, or --worker [--once].');
  if (!preview && !doctor && !worker && (!isatty(0) || !process.stdout.isTTY))
    throw new Error('Open this app in an interactive terminal, or use --preview.');
  const release = acquireLock(folder);
  process.once('exit', release);
  let crew;
  try {
    crew = new Crew(folder);
  } catch (error) {
    release();
    throw error;
  }
  const app = {
    crew,
    selected: crew.state.members[0].name,
    notice: '',
    scroll: 0,
    panel: null,
    view: 'chat',
    activityScroll: 0,
  };
  let input = [],
    cursor = 0,
    closing = false;
  const history = new PromptHistory();
  let restoreMouse = () => {};
  let stopInput = () => {};
  let usingStdin = false;
  if (preview) {
    console.log(screen(crew, app.selected, '', 'Preview — no agents running'));
    release();
    return;
  }
  console.log('Checking Codex, login, folder access and saved state...');
  const diagnostics = await checkRuntime();
  if (doctor || !diagnostics.ok) {
    console.log([...diagnostics.lines, `Folder: ${crew.folder}`, 'Folder lock and saved state: OK'].join('\n'));
    release();
    if (!diagnostics.ok) process.exitCode = 1;
    return;
  }
  const stopTitle = startTerminalTitle(crew, process.stdout);
  process.once('exit', stopTitle);
  if (worker) {
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    console.log(`Worker active: ${crew.folder}. Press Ctrl+C to stop.`);
    const logWatch = notice => console.log(`${notice.text}\n${notice.detail}`);
    crew.on('watch', logWatch);
    try {
      await runWorker(crew, { once, signal: controller.signal });
    } finally {
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
      crew.removeListener('watch', logWatch);
      stopTitle();
      process.removeListener('exit', stopTitle);
      await crew.close();
      release();
    }
    return;
  }
  if (crew.queue.paused) app.notice = 'Saved work is paused. /queue list to inspect; /queue resume to dispatch.';
  const terminal = new TerminalRenderer(process.stdout);
  let outputBlocked = false;
  process.stdout.on('drain', () => {
    outputBlocked = false;
    render();
  });
  const render = scheduleRender(() => {
    if (closing) return;
    if (outputBlocked) return;
    const columns = process.stdout.columns || 100,
      rows = process.stdout.rows || 30;
    const width = Math.max(30, columns - 1);
    const promptLabel = app.view === 'activity' ? 'activity' : app.view === 'group' ? 'crew' : app.selected;
    const composer = layoutInput(
      input.join(''),
      cursor,
      promptLabel,
      width,
      Math.max(1, Math.min(5, Math.floor(rows / 5))),
    );
    const content = screen(crew, app.selected, input.join(''), app.notice, columns, rows, app.scroll, app.panel, {
      color: !('NO_COLOR' in process.env) && process.env.TERM !== 'dumb',
      view: app.view,
      activityScroll: app.activityScroll,
      composer,
    });
    const inputRow = content.split('\n').length - composer.lines.length - 4 + composer.cursorRow;
    const inputColumn = composer.cursorColumn + 1;
    outputBlocked = terminal.draw(content, inputRow, inputColumn, `${columns}x${rows}`) === false;
  });
  app.send = (name, text) => {
    const task = crew.queue.enqueue(name, text);
    app.notice = `Task ${task.id}: ${task.status}${crew.queue.paused ? '; /queue resume to start' : ''}`;
  };
  let ticker;
  const changed = sourceChanged();
  let nextVersionCheck = Date.now() + 5000;
  let nextTipRotation = Date.now() + 30000;
  app.quit = async () => {
    if (closing) return;
    closing = true;
    render.cancel();
    clearInterval(ticker);
    stopTitle();
    process.removeListener('exit', stopTitle);
    stopInput();
    if (usingStdin) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
    restoreMouse();
    process.stdout.write(MOUSE_OFF + '\x1b[?25h\x1b[?1049l');
    try {
      await crew.close();
    } finally {
      release();
    }
  };
  app.restart = async () => {
    if (closing) return;
    await app.quit();
    try {
      if (process.env.PONGKAN_CREW_SUPERVISED === '1' && process.connected) {
        await new Promise((resolveSent, rejectSent) =>
          process.send({ type: 'pongkan-restart' }, error => (error ? rejectSent(error) : resolveSent())),
        );
        process.exit(0);
      }
      const code = await launchRestart(resolve(process.argv[1]), args);
      process.exit(code);
    } catch (error) {
      process.stderr.write(`Could not restart Crew: ${error.message}\n`);
      process.exitCode = 1;
    }
  };
  const setInput = text => {
    input = Array.from(text);
    cursor = input.length;
  };
  const dispatch = line => {
    const result = execute(app, line);
    if (result?.then)
      void result
        .then(() => render())
        .catch(error => {
          app.notice = error.message;
          render();
        });
  };
  process.stdout.write(MOUSE_OFF + '\x1b[?1049h');
  try {
    restoreMouse = enableWindowsMouse();
  } catch (error) {
    app.notice = `Mouse unavailable: ${error.message}. Use PgUp/PgDn to scroll.`;
  }
  const keyboard = new PassThrough();
  keyboard.setEncoding('utf8');
  emitKeypressEvents(keyboard);
  const consume = terminalInput(
    text => keyboard.write(text),
    amount => {
      scrollView(app, amount);
      render();
    },
    undefined,
    text => {
      if (app.panel?.kind === 'command-picker') {
        commandPickerKey(app, text.replace(/\s+/g, ' '));
        render();
        return;
      }
      const chars = Array.from(text.replace(/\r\n?/g, '\n'));
      input.splice(cursor, 0, ...chars);
      cursor += chars.length;
      render();
    },
  );
  const useStdin = () => {
    usingStdin = true;
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', consume);
    process.stdin.resume();
    process.stdout.write(MOUSE_ON);
  };
  if (process.platform === 'win32') {
    const decoder = new StringDecoder('utf8');
    stopInput = connectWindowsInput(
      chunk => consume(decoder.write(chunk)),
      useStdin,
      () => process.stdout.write(MOUSE_ON),
      () => {
        // The native reader disables VT input; restore it before using Node.
        try {
          enableWindowsMouse();
        } catch {}
        app.notice = 'Native mouse input unavailable. Use PgUp/PgDn to scroll.';
        render();
      },
    );
  } else useStdin();
  keyboard.on('keypress', (str, key = {}) => {
    try {
      const picked = commandPickerKey(app, str, key);
      if (picked.handled) {
        if (picked.input != null) setInput(picked.input);
        render();
        return;
      }
      if (key.ctrl && key.name === 'c') {
        void app.quit();
        return;
      }
      if (key.name === 'f1' || (str === '?' && input.length === 0)) dispatch('/help');
      else if (key.name === 'f2') dispatch(key.shift ? '/switch prev' : '/switch');
      else if (key.name === 'escape') {
        if (app.panel) app.panel = null;
        else if (app.view === 'activity' || app.view === 'group') dispatch('/chat');
        else setInput('');
      } else if (key.name === 'tab') {
        const text = input.join('');
        if (text.startsWith('/') || text.startsWith('@')) {
          const matches = completions(
            text,
            crew.state.members.map(m => m.name),
            Object.keys(crew.presets.list()),
            {
              workflows: crew.state.workflows.map(flow => flow.id),
              worktrees: crew.state.workflows.filter(flow => flow.workspace).map(flow => flow.id),
              tasks: crew.state.tasks.map(task => task.id),
              templates: (crew.state.templates || []).map(entry => entry.name),
              conversations: crew.state.conversations.map(chat => chat.id),
            },
          );
          if (matches.length === 1) setInput(matches[0] + ' ');
          else if (matches.length) app.notice = matches.join(' | ');
          else app.notice = 'No completion. Use /help QUERY to search.';
        } else cycle(app, key.shift ? -1 : 1);
      } else if (app.panel?.kind === 'codex-permissions' && ['up', 'down'].includes(key.name)) {
        const count = 4;
        app.panel.permissionIndex = (app.panel.permissionIndex + (key.name === 'down' ? 1 : -1) + count) % count;
      } else if (app.panel?.kind === 'codex-permissions' && promptEnterAction(str, key) === 'submit') {
        app.panel.onSelect();
      } else if (key.shift && key.name === 'left') {
        const text = input.join('').trim();
        if (text) {
          const queued = queuePrompt(app, text);
          if (queued?.then)
            void queued
              .then(() => render())
              .catch(error => {
                app.notice = error.message;
                render();
              });
          history.add(text);
          setInput('');
        }
      } else if (
        ['up', 'down', 'left', 'right', 'home', 'end'].includes(key.name) &&
        !(key.shift && key.name === 'right')
      ) {
        const label = app.view === 'activity' ? 'activity' : app.view === 'group' ? 'crew' : app.selected;
        const movement = navigateInput(
          input.join(''),
          cursor,
          key,
          label,
          Math.max(30, (process.stdout.columns || 100) - 1),
        );
        if (movement.history) setInput(history.move(movement.history, input.join('')));
        else cursor = movement.cursor;
      } else if (key.name === 'pageup' || key.name === 'pagedown') {
        scrollView(app, key.name === 'pageup' ? 10 : -10);
      } else if (key.shift && key.name === 'right') setInput(answerShortcut(app, input.join('')));
      else if (promptEnterAction(str, key) === 'newline') {
        input.splice(cursor++, 0, '\n');
      } else if (promptEnterAction(str, key) === 'submit') {
        const line = input.join('').trim();
        setInput('');
        if (line) {
          history.add(line);
          dispatch(line);
        }
      } else if (key.name === 'backspace') {
        if (cursor > 0) input.splice(--cursor, 1);
      } else if (key.name === 'delete') input.splice(cursor, 1);
      else if (key.ctrl && key.name === 'u') setInput('');
      else if (key.ctrl && key.name === 'w') {
        const before = input.slice(0, cursor).join('');
        const keep = Array.from(before.replace(/\s*\S+\s*$/, '')).length;
        input.splice(keep, cursor - keep);
        cursor = keep;
      } else if (key.ctrl && (key.name === 'p' || key.name === 'n')) {
        setInput(history.move(key.name === 'p' ? -1 : 1, input.join('')));
      } else if (key.ctrl && key.name === 'k') dispatch('/stop');
      else if (key.ctrl && key.name === 'l') {
        terminal.size = null;
      } else if (!key.ctrl && !key.meta && str && !/[\x00-\x1f\x7f]/.test(str)) {
        const chars = Array.from(str);
        input.splice(cursor, 0, ...chars);
        cursor += chars.length;
      }
    } catch (error) {
      app.notice = error.message;
    }
    render();
  });
  crew.on('change', render);
  crew.on('watch', notice => {
    app.notice = `${notice.text} /watch inbox to read; /briefing for current progress.`;
    render();
  });
  process.stdout.on('resize', render);
  process.on('SIGTERM', app.quit);
  process.on('SIGINT', app.quit);
  ticker = setInterval(() => {
    if (Date.now() >= nextVersionCheck) {
      nextVersionCheck = Date.now() + 5000;
      try {
        if (!crew.codeChanged && changed()) {
          crew.codeChanged = true;
          crew.notify('Crew code changed on disk. Restart to load the update.');
        }
      } catch {
        /* A transient update may temporarily remove a source file. */
      }
    }
    try {
      crew.scheduler.tick();
    } catch (error) {
      app.notice = error.message;
    }
    if (crew.running.size || app.panel?.getLines) render();
    else if (Date.now() >= nextTipRotation) {
      nextTipRotation = Date.now() + 30000;
      render();
    }
  }, 1000);
  ticker.unref();
  render();
  if (process.env.PONGKAN_CREW_SUPERVISED === '1' && process.connected) {
    process.send({ type: 'pongkan-ready' }, error => {
      if (error) {
        console.error(`Restart supervisor unavailable: ${error.message}`);
        void app.quit();
      }
    });
    process.channel?.unref();
  }
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
