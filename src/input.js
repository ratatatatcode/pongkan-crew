import { clean, cellWidth, fitText } from './markdown.js';
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export class PromptHistory {
  entries = [];
  index = 0;
  draft = '';
  add(text) {
    if (this.entries.at(-1) !== text) this.entries.push(text);
    if (this.entries.length > 100) this.entries.shift();
    this.index = this.entries.length;
    this.draft = '';
  }
  move(delta, input) {
    if (this.index === this.entries.length) this.draft = input;
    this.index = Math.max(0, Math.min(this.entries.length, this.index + delta));
    return this.index === this.entries.length ? this.draft : this.entries[this.index];
  }
}

export function layoutInput(text, cursor, label, width, maxRows = 5) {
  text = clean(text);
  const chars = Array.from(text);
  cursor = Math.max(0, Math.min(cursor, chars.length));
  const prefix = fitText(`${label}> `, Math.min(cellWidth(`${label}> `), Math.max(2, width - 5)));
  const padding = ' '.repeat(cellWidth(prefix));
  const available = Math.max(2, width - cellWidth(prefix) - 1);
  const rows = [{ text: '', start: 0 }];
  let offset = 0;
  for (const { segment } of segmenter.segment(text)) {
    if (cellWidth(rows.at(-1).text) + cellWidth(segment) > available) rows.push({ text: '', start: offset });
    rows.at(-1).text += segment;
    offset += Array.from(segment).length;
  }
  if (cellWidth(rows.at(-1).text) >= available) rows.push({ text: '', start: offset });
  const cursorRow = rows.findLastIndex(row => row.start <= cursor);
  const cursorCells = cellWidth(chars.slice(rows[cursorRow].start, cursor).join(''));
  maxRows = Math.max(1, maxRows);
  const collapsed = rows.length > maxRows && maxRows > 1;
  const visibleRows = maxRows - (collapsed ? 1 : 0);
  const first = Math.max(0, cursorRow - visibleRows + 1);
  const visible = rows.slice(first, first + visibleRows);
  const end = rows[first + visible.length]?.start ?? chars.length;
  const hiddenCharacters = rows[first].start + chars.length - end;
  const lines = visible.map((row, index) => `${index ? padding : prefix}${row.text}`);
  if (collapsed) lines.unshift(fitText(`[${hiddenCharacters.toLocaleString('en-US')} characters hidden]`, width - 1));
  const move = delta => {
    const target = rows[cursorRow + delta];
    if (!target) return cursor;
    const next = rows[cursorRow + delta + 1];
    let count = target.start,
      cells = 0;
    for (const { segment } of segmenter.segment(target.text)) {
      if (cells + cellWidth(segment) > cursorCells) break;
      const end = count + Array.from(segment).length;
      if (next && end >= next.start) break;
      cells += cellWidth(segment);
      count = end;
    }
    return count;
  };
  return {
    lines,
    cursorRow: cursorRow - first + (collapsed ? 1 : 0),
    cursorColumn: cellWidth(prefix) + cursorCells,
    hiddenBefore: first,
    hiddenAfter: rows.length - first - visible.length,
    totalRows: rows.length,
    up: move(-1),
    down: move(1),
    lineStart: rows[cursorRow].start,
    lineEnd: rows[cursorRow + 1]
      ? rows[cursorRow + 1].start -
        Array.from([...segmenter.segment(rows[cursorRow].text)].at(-1)?.segment || '').length
      : chars.length,
  };
}

export function navigateInput(text, cursor, key, label, width) {
  const length = Array.from(text).length;
  if (key.name === 'left') return { cursor: Math.max(0, cursor - 1) };
  if (key.name === 'right') return { cursor: Math.min(length, cursor + 1) };
  const layout = layoutInput(text, cursor, label, width);
  if (key.name === 'home') return { cursor: key.ctrl ? 0 : layout.lineStart };
  if (key.name === 'end') return { cursor: key.ctrl ? length : layout.lineEnd };
  const next = key.name === 'up' ? layout.up : layout.down;
  return next === cursor ? { history: key.name === 'up' ? -1 : 1 } : { cursor: next };
}
