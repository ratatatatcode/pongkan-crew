import { basename } from 'node:path';

const FRAMES = ['[=   ]', '[ =  ]', '[  = ]', '[   =]', '[  = ]', '[ =  ]'];
const safeText = (value, limit = 80) =>
  String(value || '')
    .replace(/[\x00-\x1f\x7f-\x9f\u2028\u2029]/g, '')
    .slice(0, limit);

function titleState(crew) {
  let waiting = 0,
    queued = 0;
  for (const task of crew.state.tasks) {
    if (task.status === 'waiting') waiting++;
    else if (task.status === 'queued') queued++;
  }
  for (const input of crew.state.inputs)
    if (input.status === 'blocked' && input.question && !input.answeredAt) waiting++;
  return { active: crew.running.size, waiting, queued, paused: crew.queue.paused };
}

export function terminalTitle(crew, now = Date.now(), status = titleState(crew)) {
  const { active, waiting, queued, paused } = status;
  let marker = '[ok]',
    label = 'Ready';
  if (active) {
    marker = FRAMES[Math.floor(now / 250) % FRAMES.length];
    label = `Working (${active})${waiting ? ` | ${waiting} waiting` : ''}`;
  } else if (waiting) {
    marker = '[?]';
    label = `Needs your answer (${waiting})`;
  } else if (paused) {
    marker = '[||]';
    label = 'Paused';
  } else if (queued) {
    marker = '[..]';
    label = `Queued (${queued})`;
  }
  return `${marker} Pongkan Crew | ${label} | ${safeText(basename(crew.folder))}`;
}

export function startTerminalTitle(
  crew,
  output,
  {
    env = process.env,
    originalTitle = process.title,
    now = Date.now,
    schedule = setInterval,
    cancel = clearInterval,
    setTitle = output === process.stdout && process.platform === 'win32'
      ? title => {
          process.title = title;
        }
      : null,
  } = {},
) {
  if (!output.isTTY || env.TERM === 'dumb') return () => {};
  let stopped = false,
    previous = '',
    status,
    sampledAt;
  const writeTitle = title => {
    try {
      setTitle?.(title);
    } catch {
      // Hosts without native console-title support can still handle the OSC sequence.
    }
    output.write(`\x1b]0;${title}\x07`);
  };
  const draw = () => {
    if (stopped || output.destroyed || output.writableNeedDrain) return;
    const at = now();
    // Animate from a cached snapshot; large task histories are sampled once per second.
    if (!status || at - sampledAt >= 1000 || at < sampledAt || status.active !== crew.running.size) {
      status = titleState(crew);
      sampledAt = at;
    }
    const title = terminalTitle(crew, at, status);
    if (title === previous) return;
    writeTitle(title);
    previous = title;
  };
  // Preserve the host title on terminals supporting the title stack, with a fallback on exit.
  output.write('\x1b[22;0t');
  draw();
  const timer = schedule(draw, 250);
  timer?.unref?.();
  return () => {
    if (stopped) return;
    stopped = true;
    cancel(timer);
    if (!output.destroyed) {
      writeTitle(safeText(originalTitle, 1024));
      output.write('\x1b[23;0t');
    }
  };
}
