import { HELP } from './commands.js';
import { wrapText } from './markdown.js';
const catalogs = new WeakMap();

function catalog(help) {
  if (catalogs.has(help)) return catalogs.get(help);
  const seen = new Set();
  const entries = [];
  for (const line of help) {
    if (!line.startsWith('/')) continue;
    const [usage, ...description] = line.split(/\s{2,}/);
    const grouped = usage.match(/^(\/[a-z-]+) ([a-z][\s\S]*\|[\s\S]*)$/);
    const variants = grouped
      ? grouped[2].split('|').map(part => `${grouped[1]} ${part}`)
      : [usage, ...[...usage.matchAll(/\/[a-z-]+/g)].slice(1).map(match => match[0])];
    for (const variant of variants) {
      const command = variant.match(/^\/[a-z-]+(?: [a-z-]+)*/)?.[0].replace(/ or$/, '');
      if (!command || seen.has(command)) continue;
      seen.add(command);
      entries.push({ command, usage: variant, description: description.join(' '), searchable: line.toLowerCase() });
    }
  }
  catalogs.set(help, entries);
  return entries;
}

export function commandChoices(query = '', help = HELP) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return catalog(help).filter(entry => words.every(word => entry.searchable.includes(word)));
}

export function openCommandPicker(app, query, help = HELP) {
  const picker = {
    title: 'COMMANDS',
    kind: 'command-picker',
    query,
    pickerIndex: 0,
    choices: commandChoices(query, help),
    offset: 0,
  };
  picker.update = () => {
    picker.choices = commandChoices(picker.query, help);
    picker.pickerIndex = 0;
    picker.offset = 0;
  };
  picker.getRows = width => {
    const start = Math.max(0, picker.pickerIndex - 3);
    return [
      { text: `Search: ${picker.query || '(type to filter)'}`, tone: 'user' },
      { text: '↑/↓ select · Enter fills prompt · Esc closes · Then Tab completes arguments', tone: 'muted' },
      { text: `${picker.choices.length} matches`, tone: 'muted' },
      ...picker.choices.slice(start, start + 6).flatMap((entry, index) => [
        ...wrapText(`${start + index === picker.pickerIndex ? '›' : ' '} ${entry.usage}`, width).map(text => ({
          text,
          tone: start + index === picker.pickerIndex ? 'selected' : 'heading',
        })),
        ...wrapText(entry.description, width).map(text => ({ text, tone: 'muted' })),
      ]),
    ];
  };
  app.panel = picker;
}

export function selectCommand(app) {
  const entry = app.panel?.choices[app.panel.pickerIndex];
  if (!entry) return null;
  app.panel = null;
  return entry.command + ' ';
}

export function commandPickerKey(app, str, key = {}) {
  const picker = app.panel;
  if (picker?.kind !== 'command-picker') return { handled: false };
  if (key.name === 'escape' || (key.ctrl && key.name === 'c')) return { handled: false };
  if (key.name === 'return') return { handled: true, input: selectCommand(app) };
  if (key.name === 'up' || key.name === 'down') {
    const count = picker.choices.length;
    if (count) picker.pickerIndex = (picker.pickerIndex + (key.name === 'up' ? -1 : 1) + count) % count;
    picker.offset = 0;
  } else if (key.name === 'backspace') {
    picker.query = Array.from(picker.query).slice(0, -1).join('');
    picker.update();
  } else if (key.ctrl && key.name === 'u') {
    picker.query = '';
    picker.update();
  } else if (!key.ctrl && !key.meta && str && !/[\x00-\x1f\x7f]/.test(str)) {
    picker.query = (picker.query + str).slice(0, 500);
    picker.update();
  }
  return { handled: true };
}
