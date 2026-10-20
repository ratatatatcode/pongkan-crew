import { spawn } from 'node:child_process';

export function launchRestart(
  script,
  args,
  { cwd = process.cwd(), platform = process.platform, spawnProcess = spawn } = {},
) {
  const child = spawnProcess(process.execPath, [script, ...args], {
    cwd,
    detached: platform !== 'win32',
    stdio: 'inherit',
    windowsHide: false,
  });
  return new Promise((resolve, reject) => {
    child.once('spawn', () => resolve(child));
    child.once('error', reject);
  });
}
