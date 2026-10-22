// Optional live check: lead decisions, one delegate and independent review in a temporary read-only project.
import { mkdtempSync, writeFileSync, rmSync, realpathSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute, sep } from 'node:path';
import { Crew } from '../src/crew.js';
import { acquireLock } from '../src/runtime.js';

const root = realpathSync(tmpdir());
const folder = mkdtempSync(join(root, 'pongkan-live-'));
const release = acquireLock(folder);
let crew, timer;
try {
  writeFileSync(join(folder, 'hello.txt'), 'PONGKAN_WORKFLOW_OK\n');
  crew = new Crew(folder);
  for (const member of crew.state.members) member.writable = false;
  crew.save();
  let lastActivity;
  crew.on('change', () => {
    const text = crew.activity.at(-1);
    if (text && text !== lastActivity) {
      console.log(text);
      lastActivity = text;
    }
  });
  const workflow = crew.workflows.start(
    'Use exactly one researcher step to read hello.txt and report its marker. Reviewer must verify the marker against the file. Chief must include the marker in the final summary. This is a read-only connection check; do not change any files.',
  );
  timer = setTimeout(() => crew.workflows.cancel(workflow.id), 180000);
  await crew.workflows.settled(workflow.id);
  if (workflow.status !== 'completed' || !workflow.result?.includes('PONGKAN_WORKFLOW_OK'))
    throw new Error(workflow.error || 'Workflow did not return the expected marker.');
  if (readFileSync(join(folder, 'hello.txt'), 'utf8') !== 'PONGKAN_WORKFLOW_OK\n')
    throw new Error('The fixture was unexpectedly modified.');
  console.log('LIVE_WORKFLOW_OK: persistent lead, delegation, independent review and delivery passed.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  if (crew) await crew.close();
  release();
  const rel = relative(root, realpathSync(folder));
  if (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep) && rel.startsWith('pongkan-live-'))
    rmSync(folder, { recursive: true, force: true });
}
