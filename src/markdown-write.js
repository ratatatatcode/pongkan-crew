import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

function windowsWrite(folder, key = null, content = null, obsolete = []) {
  const script = fileURLToPath(new URL('./windows-markdown.ps1', import.meta.url));
  try {
    const output = execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', script], {
      input: JSON.stringify({ folder, key, content, obsolete }),
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, TEMP: folder, TMP: folder },
      timeout: 30000,
    });
    const result = JSON.parse(output);
    if (!result.ok) throw new Error(result.error || 'Markdown writer failed');
  } catch (error) {
    let message = error.message;
    try {
      message = JSON.parse(error.stdout).error || message;
    } catch {
      /* Execution or protocol failure. */
    }
    throw new Error(message);
  }
}

// Linux descriptor paths anchor operations to opened directories, even if a
// path component is renamed/replaced. Never fall back to unchecked paths.
function pinnedDirectory(folder, action) {
  if (process.platform !== 'linux')
    throw new Error('Safe Markdown writing requires Windows or Linux directory-handle support.');
  const descriptors = [];
  try {
    const flags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
    let descriptor = openSync('/', flags);
    descriptors.push(descriptor);
    for (const segment of resolve(folder).split('/').filter(Boolean)) {
      descriptor = openSync(`/proc/self/fd/${descriptor}/${segment}`, flags);
      descriptors.push(descriptor);
    }
    for (const segment of ['docs', 'pongkan-docs']) {
      const child = `/proc/self/fd/${descriptor}/${segment}`;
      try {
        mkdirSync(child, segment === 'pongkan-docs' ? { mode: 0o700 } : undefined);
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
      try {
        descriptor = openSync(child, flags);
      } catch (error) {
        throw new Error(`Unsafe Markdown directory: ${child}: ${error.message}`);
      }
      descriptors.push(descriptor);
      if (segment === 'pongkan-docs') fchmodSync(descriptor, 0o700);
    }
    return action(`/proc/self/fd/${descriptor}`);
  } finally {
    for (const descriptor of descriptors.reverse()) closeSync(descriptor);
  }
}

export function markdownDirectory(folder) {
  if (process.platform === 'win32') windowsWrite(folder);
  else pinnedDirectory(folder, () => {});
  return join(folder, 'docs', 'pongkan-docs');
}
export function writeMarkdown(folder, key, content, obsolete = []) {
  if (!/^(task|discussion|workflow)-[a-f0-9]{8}$/.test(key)) throw new Error('Invalid Markdown record ID');
  if (!Array.isArray(obsolete) || obsolete.some(name => !/^task-[a-f0-9]{8}$/.test(name) || name === key))
    throw new Error('Invalid obsolete Markdown record ID');
  if (process.platform === 'win32') return windowsWrite(folder, key, content, obsolete);
  return pinnedDirectory(folder, directory => {
    const path = join(directory, `${key}.md`),
      marker = `<!-- pongkan-crew export ${key} -->\n`;
    const check = () => {
      let descriptor;
      try {
        descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      } catch (error) {
        if (error.code === 'ENOENT') return;
        throw error;
      }
      try {
        const info = fstatSync(descriptor);
        if (!info.isFile() || info.nlink !== 1) throw new Error('Unsafe Markdown destination');
        if (!readFileSync(descriptor, 'utf8').startsWith(marker)) throw new Error('Markdown filename conflict');
      } finally {
        closeSync(descriptor);
      }
    };
    check();
    const temporary = join(directory, `.pongkan-export-${randomUUID()}.tmp`);
    let created = false;
    try {
      writeFileSync(temporary, content, { flag: 'wx', encoding: 'utf8', mode: 0o600 });
      created = true;
      check();
      renameSync(temporary, path);
      created = false;
      for (const name of obsolete) {
        const legacy = join(directory, `${name}.md`);
        let descriptor;
        try {
          descriptor = openSync(legacy, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        } catch (error) {
          if (['ENOENT', 'ELOOP'].includes(error.code)) continue;
          throw error;
        }
        try {
          const info = fstatSync(descriptor);
          if (
            info.isFile() &&
            info.nlink === 1 &&
            readFileSync(descriptor, 'utf8').startsWith(`<!-- pongkan-crew export ${name} -->\n`)
          )
            unlinkSync(legacy);
        } finally {
          closeSync(descriptor);
        }
      }
    } finally {
      if (created) unlinkSync(temporary);
    }
  });
}
