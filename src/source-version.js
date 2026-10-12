import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function fingerprint(folder) {
  const hash = createHash('sha256');
  for (const name of readdirSync(folder)
    .filter(name => name.endsWith('.js'))
    .sort()) {
    hash.update(name);
    hash.update(readFileSync(join(folder, name)));
  }
  return hash.digest('hex');
}
export function sourceChanged(folder = fileURLToPath(new URL('.', import.meta.url))) {
  const initial = fingerprint(folder);
  return () => fingerprint(folder) !== initial;
}
