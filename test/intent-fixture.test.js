import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Crew } from './helpers/crew-fixture.js';

test('dispatcher fixtures require an explicit AI decision instead of guessing from words', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'pongkan-intent-fixture-'));
  const crew = new Crew(t, folder);
  t.after(async () => {
    await crew.close();
    rmSync(folder, { recursive: true, force: true });
  });
  assert.throws(
    () =>
      crew.inputs.resolve(
        { text: 'Rejig this so it feels right.' },
        {
          workflows: [],
          assignments: [],
          messages: [],
        },
      ),
    /Missing mocked AI decision/,
  );
});
