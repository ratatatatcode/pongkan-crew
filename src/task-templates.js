export const TEMPLATE_NAME = /^[a-z][a-z0-9-]{0,31}$/;
export function templateCommand(crew, action, name, text) {
  const entries = crew.state.templates || [];
  if (action === 'list')
    return entries.map(
      entry => `${entry.name}: ${entry.text.replace(/\s+/g, ' ').slice(0, 120)}${entry.text.length > 120 ? '…' : ''}`,
    );
  if (!name || !TEMPLATE_NAME.test(name))
    throw new Error('Template name must use 1–32 lowercase letters, digits or hyphens, starting with a letter.');
  const entry = entries.find(entry => entry.name === name);
  if (action === 'save') {
    if (!text?.trim() || text.length > 8000)
      throw new Error('Use /template save NAME INSTRUCTIONS (1–8000 characters). Optional placeholder: {{goal}}.');
    if (entry) throw new Error('Template already exists. Delete it explicitly before replacing it.');
    if (entries.length >= 50) throw new Error('At most 50 templates can be saved.');
    crew.state.templates = [...entries, { name, text: text.trim() }];
    crew.save();
    return;
  }
  if (!entry) throw new Error('Unknown template. Use /template list.');
  if (action === 'show') return [entry.text];
  if (action === 'delete') {
    crew.state.templates = entries.filter(entry => entry.name !== name);
    crew.save();
    return;
  }
  if (!text?.trim() || text.length > 8000) throw new Error('Use /template run NAME GOAL (1–8000 characters).');
  const expanded = entry.text.includes('{{goal}}')
    ? entry.text.replaceAll('{{goal}}', () => text)
    : `${entry.text}\n\nGoal: ${text}`;
  if (expanded.length > 16000)
    throw new Error('Expanded template exceeds 16000 characters. Shorten the instructions or goal.');
  return expanded;
}
