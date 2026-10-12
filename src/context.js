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
