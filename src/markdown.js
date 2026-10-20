import { nameLabel, formatTeammateNames } from './name-display.js';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const graphemes = text => [...segmenter.segment(text)].map(part => part.segment);

export function clean(text) {
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
}
function graphemeWidth(char) {
  if (/^[\p{Mark}\u200d\ufe0f]+$/u.test(char)) return 0;
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(char)) return 2;
  const code = char.codePointAt(0);
  return code >= 0x1100 &&
    (code <= 0x115f ||
      code === 0x2329 ||
      code === 0x232a ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe6f) ||
      (code >= 0xff01 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      code >= 0x20000)
    ? 2
    : 1;
}
export function cellWidth(text) {
  text = clean(text);
  if (/^[\x20-\x7e]*$/.test(text)) return text.length;
  return graphemes(text).reduce((sum, char) => sum + graphemeWidth(char), 0);
}
export function fitText(text, width) {
  text = clean(text);
  if (/^[\x20-\x7e]*$/.test(text)) return text.slice(0, width).padEnd(width);
  let result = '',
    cells = 0;
  for (const char of graphemes(text)) {
    const size = graphemeWidth(char);
    if (cells + size > width) break;
    result += char;
    cells += size;
  }
  return result + ' '.repeat(Math.max(0, width - cells));
}
export function wrapText(text, width, preserve = false) {
  width = Math.max(2, width);
  const output = [];
  for (const raw of clean(text).replace(/\t/g, '    ').split('\n')) {
    if (!raw) {
      output.push('');
      continue;
    }
    if (preserve) {
      let line = '',
        size = 0;
      for (const char of graphemes(raw)) {
        const next = graphemeWidth(char);
        if (size + next > width) {
          output.push(line);
          line = '';
          size = 0;
        }
        line += char;
        size += next;
      }
      output.push(line);
      continue;
    }
    let line = '',
      lineWidth = 0;
    for (const word of raw.trim().split(/\s+/)) {
      const wordWidth = cellWidth(word);
      if (wordWidth > width) {
        if (line) output.push(line);
        const chunks = wrapText(word, width, true);
        output.push(...chunks.slice(0, -1));
        line = chunks.at(-1);
        lineWidth = cellWidth(line);
      } else if (line && lineWidth + 1 + wordWidth > width) {
        output.push(line);
        line = word;
        lineWidth = wordWidth;
      } else {
        lineWidth += (line ? 1 : 0) + wordWidth;
        line += (line ? ' ' : '') + word;
      }
    }
    output.push(line);
  }
  return output;
}

export function renderMarkdown(text, width, { folder = '', names = [] } = {}) {
  width = Math.max(12, width);
  // Workflow responses stay as JSON in storage; present assignments as prose.
  let plan;
  try {
    plan = JSON.parse(
      clean(text)
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/\s*```$/, ''),
    );
  } catch {
    /* Ordinary Markdown. */
  }
  if (
    Array.isArray(plan?.steps) &&
    plan.steps.length &&
    typeof plan.reviewer === 'string' &&
    plan.steps.every(step => typeof step?.member === 'string' && typeof step.task === 'string')
  ) {
    const rows = [{ text: 'WORKFLOW PLAN', tone: 'heading' }];
    for (const [index, step] of plan.steps.entries()) {
      rows.push(
        { text: '', tone: 'body' },
        ...wrapText(`${index + 1}. ${nameLabel(step.member)}`, width).map(text => ({ text, tone: 'heading' })),
        ...renderMarkdown(step.task, width - 2, { folder, names }).map(row => ({ ...row, text: '  ' + row.text })),
      );
    }
    rows.push(
      { text: '', tone: 'body' },
      ...wrapText(`Reviewer: ${nameLabel(plan.reviewer)}`, width).map(text => ({ text, tone: 'heading' })),
    );
    return rows;
  }
  const source = clean(formatTeammateNames(text, names)).split('\n'),
    result = [],
    references = [];
  const emit = (text, tone = 'body', prefix = '', continuation = prefix) => {
    const room = Math.max(2, width - Math.max(cellWidth(prefix), cellWidth(continuation)));
    for (const [index, line] of wrapText(text, room).entries())
      result.push({ text: (index ? continuation : prefix) + line, tone });
  };
  const blank = () => {
    if (result.length && result.at(-1).text) result.push({ text: '', tone: 'body' });
  };
  const reference = target => {
    let location = target.replace(/^<|>$/g, '').trim();
    const root = folder.replace(/\\/g, '/').replace(/\/$/, '');
    const normalized = location.replace(/\\/g, '/');
    if (root && normalized.toLowerCase().startsWith(root.toLowerCase() + '/'))
      location = normalized.slice(root.length + 1);
    let index = references.indexOf(location);
    if (index === -1) {
      references.push(location);
      index = references.length - 1;
    }
    return index + 1;
  };
  const inline = raw => {
    const code = [];
    return raw
      .replace(/`([^`]+)`/g, (_, value) => {
        code.push(value);
        return `\ue000${code.length - 1}\ue001`;
      })
      .replace(
        /!?\[([^\]]+)\]\((<[^>]*>|(?:[^()]|\([^()]*\))*)\)/g,
        (_, label, target) => `${label} [${reference(target)}]`,
      )
      .replace(/(\*\*|__)(?=\S)(.+?)\1/g, '$2')
      .replace(/(^|\s)(\*|_)(?=\S)(.+?)\2(?=\s|[.,!?;:]|$)/g, '$1$3')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/\ue000(\d+)\ue001/g, (_, index) => code[Number(index)]);
  };
  const tableCells = line =>
    line
      .trim()
      .replace(/^\||\|$/g, '')
      .split(/(?<!\\)\|/)
      .map(cell => cell.trim().replace(/\\\|/g, '|'));
  const tableDivider = line => line.includes('|') && tableCells(line).every(cell => /^:?-{3,}:?$/.test(cell));
  const labelPattern = /^\s*\*\*([^*\n]+?:)\*\*\s*(.*)$/;
  const special = (line, next) =>
    !line.trim() ||
    labelPattern.test(line) ||
    /^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```|~~~|(?:---+|\*\*\*+)\s*$)/.test(line) ||
    (line.includes('|') && tableDivider(next || ''));
  for (let i = 0; i < source.length; i++) {
    const line = source[i];
    if (!line.trim()) {
      blank();
      continue;
    }
    const fence = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (fence) {
      blank();
      emit(fence[2].trim() || 'Code', 'muted', '  ');
      i++;
      for (; i < source.length && !source[i].trim().startsWith(fence[1]); i++) {
        for (const part of wrapText(source[i], width - 4, true)) result.push({ text: '  │ ' + part, tone: 'code' });
      }
      blank();
      continue;
    }
    if (line.includes('|') && tableDivider(source[i + 1] || '')) {
      const headers = tableCells(line).map(inline);
      blank();
      i += 2;
      for (; i < source.length && source[i].trim() && source[i].includes('|'); i++) {
        const cells = tableCells(source[i]);
        emit(inline(cells[0] || ''), 'heading', '  ');
        for (let column = 1; column < Math.max(headers.length, cells.length); column++) {
          emit(`${headers[column] || 'Details'}: ${inline(cells[column] || '')}`, 'body', '    ');
        }
        blank();
      }
      i--;
      continue;
    }
    const heading = line.match(/^\s*#{1,6}\s+(.+?)\s*#*$/);
    if (heading) {
      blank();
      emit(inline(heading[1]), 'heading');
      continue;
    }
    const label = line.match(labelPattern);
    if (label) {
      blank();
      emit(inline(label[1]), 'heading');
      let paragraph = label[2];
      while (i + 1 < source.length && !special(source[i + 1], source[i + 2])) paragraph += ' ' + source[++i].trim();
      if (paragraph.trim()) emit(inline(paragraph));
      continue;
    }
    const list = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (list) {
      const prefix = ' '.repeat(Math.min(list[1].length, 6) + 2) + (/\d/.test(list[2]) ? list[2] : '•') + ' ';
      emit(inline(list[3]), 'body', prefix, ' '.repeat(cellWidth(prefix)));
      continue;
    }
    if (/^\s*>/.test(line)) {
      emit(inline(line.replace(/^\s*>\s?/, '')), 'muted', '  │ ');
      continue;
    }
    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      blank();
      continue;
    }
    let paragraph = line.trim();
    while (i + 1 < source.length && !special(source[i + 1], source[i + 2])) paragraph += ' ' + source[++i].trim();
    emit(inline(paragraph));
  }
  if (references.length) {
    blank();
    emit('References', 'muted');
    references.forEach((location, index) => emit(location, 'link', `  [${index + 1}] `, '      '));
  }
  while (result.at(-1)?.text === '') result.pop();
  return result;
}
