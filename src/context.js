import { createHash } from 'node:crypto';

// Only acknowledge successful delivery to a real session. A fresh/replaced
// thread or older saved state gets the normal context snapshot again.
export function sessionContext(session, records) {
  const hashes = records.map(record => createHash('sha256').update(`${record.label}\n${record.text}`).digest('hex'));
  const seen = new Set(session?.threadId && session.contextThreadId === session.threadId ? session.contextHashes : []);
  return {
    records: records.filter((_record, index) => !seen.has(hashes[index])),
    commit(prompt) {
      if (!session?.threadId) return;
      const current = session.contextThreadId === session.threadId ? session.contextHashes || [] : [];
      const supplied = hashes.filter((_hash, index) => prompt.includes(`${records[index].label}:`));
      session.contextHashes = [...new Set([...current, ...supplied])].slice(-256);
      session.contextThreadId = session.threadId;
    },
  };
}

export function validSessionContext(session) {
  return (
    (session.contextThreadId === undefined ||
      (typeof session.contextThreadId === 'string' && !!session.contextThreadId)) &&
    (session.contextHashes === undefined ||
      (Array.isArray(session.contextHashes) &&
        session.contextHashes.length <= 256 &&
        session.contextHashes.every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value))))
  );
}

// Deterministic, local clipping of optional context. Never rewrites saved history.
// The character budget is a target: user text and source labels are never dropped.
export function optimizeContext(records, { budget = 24000 } = {}) {
  const render = record => `${record.label}: ${record.text}`;
  const originalSize =
    records.reduce((size, record) => size + record.label.length + 2 + record.text.length, 0) +
    Math.max(0, records.length - 1) * 2;
  const protectedSize = records.filter(r => r.preserve).reduce((sum, r) => sum + render(r).length + 2, 0);
  const optional = records.filter(r => !r.preserve).length;
  const limit = Math.max(256, Math.min(4000, Math.floor((budget - protectedSize) / Math.max(1, optional))));
  let clipped = 0;
  const output = records
    .map(record => {
      if (record.preserve || record.text.length <= limit) return render(record);
      clipped++;
      const marker = '\n[Middle omitted; full text retained in saved history.]\n';
      const room = Math.max(0, limit - marker.length);
      const head = Math.ceil(room * 0.6),
        tail = room - head;
      return `${record.label}: ${record.text.slice(0, head)}${marker}${tail ? record.text.slice(-tail) : ''}`;
    })
    .join('\n\n');
  const text = clipped
    ? '[Context shortened locally. Omitted text may contain relevant evidence; request the full source before relying on missing details.]\n' +
      output
    : output;
  return { text, stats: { before: originalSize, after: text.length, clipped, records: records.length } };
}

export function crewContext(crew, kind, records, budget = 24000) {
  const result = optimizeContext(records, { budget });
  crew.state.contextStats ||= {};
  crew.state.contextStats[kind] = result.stats;
  return result.text;
}

// Prompt-only scope: persisted history and Markdown exports remain complete.
export function recentContext(records, { count = 10, budget = 14000, perRecord = 2400 } = {}) {
  const chosen = [];
  let used = 0;
  for (const record of records.slice(-count).reverse()) {
    const original = String(record.text || '');
    const limit = Math.min(perRecord, budget - used - record.label.length - 10);
    if (limit < 120) break;
    const marker = '\n[Middle omitted; full text is in saved history.]\n';
    const text =
      original.length <= limit
        ? original
        : original.slice(0, Math.floor((limit - marker.length) / 2)) +
          marker +
          original.slice(-Math.ceil((limit - marker.length) / 2));
    const rendered = `${record.label}: ${text}`;
    chosen.unshift(rendered);
    used += rendered.length + 2;
  }
  return (
    (chosen.length < records.length
      ? '[Recent relevant records only; older records remain in saved history. Do not infer missing facts.]\n'
      : '') + chosen.join('\n\n')
  );
}
