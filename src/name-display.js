export const nameLabel = name => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

export function formatTeammateNames(text, names = []) {
  if (!names.length) return text;
  const escaped = [...new Set(names)]
    .sort((a, b) => b.length - a.length)
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(^|[^\\w-])(${escaped.join('|')})(?![\\w-])`, 'gi');
  // Keep executable examples, paths, links and code literal.
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`|\/[a-z][\w-]*(?:[ \t]+[\w-]+)*|\S*[\\/]\S+|\b[\w-]+\.[\w.-]+\b)/g)
    .map((part, index) =>
      index % 2 ? part : part.replace(pattern, (_match, prefix, name) => prefix + nameLabel(name)),
    )
    .join('');
}
