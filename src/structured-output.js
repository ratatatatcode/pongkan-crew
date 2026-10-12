// Codex can emit commentary agent messages before its schema-constrained final.
// Extract complete objects only; never repair malformed or truncated JSON.
export function structuredOutput(text, requiredKeys) {
  const stack = [];
  let quoted = false,
    escaped = false,
    result;
  const value = String(text || '');
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"' && stack.length) quoted = true;
    else if (char === '{') stack.push(index);
    else if (char === '}' && stack.length) {
      const start = stack.pop();
      try {
        const candidate = JSON.parse(value.slice(start, index + 1));
        if (requiredKeys.every(key => Object.hasOwn(candidate, key))) result = candidate;
      } catch {
        /* Ignore prose and incomplete objects; validation still follows. */
      }
    }
  }
  if (!result) throw new Error('No complete structured report was returned.');
  return result;
}
