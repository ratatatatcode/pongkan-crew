import { spawn } from 'node:child_process';

export async function launchRestart(script, args, { cwd = process.cwd(), spawnProcess = spawn } = {}) {
  // Keep the original process attached until the replacement session finishes.
  // Otherwise CMD resumes reading the same console while the child starts.
  for (;;) {
    const result = await new Promise((resolve, reject) => {
      const child = spawnProcess(process.execPath, [script, ...args], {
        cwd,
        detached: false,
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
        windowsHide: false,
        env: { ...process.env, PONGKAN_CREW_SUPERVISED: '1' },
      });
      let ready = false;
      let restart = false;
      child.on('message', message => {
        if (message?.type === 'pongkan-ready') ready = true;
        if (message?.type === 'pongkan-restart' && ready) restart = true;
      });
      child.once('error', reject);
      child.once('close', (code, signal) => {
        if (!ready) {
          reject(
            new Error(
              `Replacement CLI exited before becoming ready (${signal || `exit code ${code}`}). See its startup error above.`,
            ),
          );
          return;
        }
        resolve({ restart: restart && code === 0, code: code ?? 1 });
      });
    });
    if (!result.restart) return result.code;
  }
}
