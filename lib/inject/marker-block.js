'use strict';

/**
 * Story 36.5 — marker-block writer (FR301, NFR46, NFR49; Decision P5-11.10).
 *
 * Splices or removes ONE named block in an instruction file. The marker pair is
 * a parameter, so the same module serves the installer's `ma-agents` block
 * (Story 39.2) and the `ma-standards` block written by `ma-standards-apply`
 * (Story 37.2).
 *
 * Contract:
 *   - A marker matches only a line whose text, without its line terminator, is
 *     exactly equal to the marker string. No trimming, no prefix or substring
 *     matching, no case folding. A 3.x `<!-- MA-AGENTS-START -->` block and any
 *     other owner's markers are therefore never matched.
 *   - Every byte outside the block is preserved, line endings included. The
 *     block's own lines use the line ending of its existing start-marker line,
 *     else the first line ending found in the file, else LF.
 *   - Block absent, file present: the block is APPENDED (fs.appendFileSync);
 *     the existing bytes are never rewritten. Separator: a line ending if the
 *     file does not end with one, then one blank line.
 *   - Block content unchanged: nothing is written (mtime untouched).
 *   - Removal deletes the block lines and, when the line before the block is
 *     blank and the line after it is blank or absent, that one blank line (so
 *     append-then-remove restores a file that ended with a line ending). The
 *     file is deleted only when nothing but whitespace remains (NFR49).
 *   - Duplicate, unbalanced or out-of-order markers are refused with a
 *     MarkerBlockError and nothing is written.
 *
 * File I/O is done in `latin1` so every byte round-trips exactly, even bytes
 * that are not valid UTF-8. Block bodies are given as JavaScript strings and are
 * written as UTF-8.
 */

const fs = require('fs');
const path = require('path');

const MA_AGENTS_MARKERS = Object.freeze({
  start: '<!-- ma-agents:start -->',
  end: '<!-- ma-agents:end -->'
});

const MA_STANDARDS_MARKERS = Object.freeze({
  start: '<!-- ma-standards:start -->',
  end: '<!-- ma-standards:end -->'
});

class MarkerBlockError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MarkerBlockError';
  }
}

function validateMarkers(markers) {
  if (!markers || typeof markers.start !== 'string' || typeof markers.end !== 'string') {
    throw new MarkerBlockError('markers must be { start: string, end: string }');
  }
  for (const m of [markers.start, markers.end]) {
    if (m.length === 0 || /[\r\n]/.test(m)) {
      throw new MarkerBlockError(`invalid marker ${JSON.stringify(m)}: must be one non-empty line`);
    }
  }
  if (markers.start === markers.end) {
    throw new MarkerBlockError('start and end markers must differ');
  }
}

/**
 * Split text into lines, keeping each line's terminator.
 * @param {string} text
 * @returns {{ text: string, eol: string }[]} eol is '\r\n', '\n' or '' (last line only)
 */
function splitLines(text) {
  const lines = [];
  const re = /\r?\n/g;
  let pos = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    lines.push({ text: text.slice(pos, m.index), eol: m[0] });
    pos = m.index + m[0].length;
  }
  if (pos < text.length) lines.push({ text: text.slice(pos), eol: '' });
  return lines;
}

function joinLines(lines) {
  let out = '';
  for (const l of lines) out += l.text + l.eol;
  return out;
}

function isMarkerLine(line, marker) {
  return line.text === marker;
}

/**
 * Locate the block delimited by `markers`.
 * @returns {null | { startLine: number, endLine: number }}
 * @throws {MarkerBlockError} on duplicate, unbalanced or out-of-order markers
 */
function locate(lines, markers) {
  const starts = [];
  const ends = [];
  lines.forEach((l, i) => {
    if (isMarkerLine(l, markers.start)) starts.push(i);
    if (isMarkerLine(l, markers.end)) ends.push(i);
  });
  if (starts.length === 0 && ends.length === 0) return null;
  if (starts.length !== 1 || ends.length !== 1 || ends[0] < starts[0]) {
    throw new MarkerBlockError(
      `ambiguous markers ${markers.start} / ${markers.end}: ` +
      `${starts.length} start line(s), ${ends.length} end line(s); refusing to write`
    );
  }
  return { startLine: starts[0], endLine: ends[0] };
}

function findBlock(text, markers) {
  validateMarkers(markers);
  const lines = splitLines(text);
  const loc = locate(lines, markers);
  if (!loc) return null;
  const blockLines = lines.slice(loc.startLine, loc.endLine + 1);
  // Block text: start marker through end marker, without the end marker's terminator.
  const last = blockLines[blockLines.length - 1];
  const blockText = joinLines(blockLines.slice(0, -1)) + last.text;
  return { startLine: loc.startLine, endLine: loc.endLine, text: blockText };
}

function bodyToLines(body, markers) {
  if (typeof body !== 'string') throw new MarkerBlockError('block body must be a string');
  if (body === '') return [];
  const parts = body.split(/\r?\n/);
  if (parts[parts.length - 1] === '') parts.pop();
  for (const p of parts) {
    if (p === markers.start || p === markers.end) {
      throw new MarkerBlockError('block body must not contain its own marker lines');
    }
  }
  return parts;
}

function renderBlock(markers, body, eol) {
  return [markers.start, ...bodyToLines(body, markers), markers.end].join(eol);
}

function firstEol(lines) {
  for (const l of lines) if (l.eol) return l.eol;
  return '\n';
}

/**
 * Pure splice.
 * @param {string|null} text existing content, or null when the file is absent
 * @returns {{ text: string, action: 'created'|'appended'|'replaced'|'unchanged', appended?: string }}
 */
function spliceText(text, markers, body) {
  validateMarkers(markers);
  if (text === null || text === undefined) {
    const block = renderBlock(markers, body, '\n');
    return { text: block + '\n', action: 'created' };
  }
  const lines = splitLines(text);
  const loc = locate(lines, markers);
  if (loc) {
    const eol = lines[loc.startLine].eol;
    const block = renderBlock(markers, body, eol);
    const out = joinLines(lines.slice(0, loc.startLine)) +
      block + lines[loc.endLine].eol +
      joinLines(lines.slice(loc.endLine + 1));
    return out === text ? { text, action: 'unchanged' } : { text: out, action: 'replaced' };
  }
  const eol = firstEol(lines);
  const block = renderBlock(markers, body, eol);
  let sep = '';
  if (text.length > 0) sep = (/\n$/.test(text) ? '' : eol) + eol;
  const appended = sep + block + eol;
  return { text: text + appended, action: 'appended', appended };
}

/**
 * Pure removal.
 * @returns {{ text: string, action: 'absent'|'removed'|'emptied' }}
 */
function removeText(text, markers) {
  validateMarkers(markers);
  const lines = splitLines(text);
  const loc = locate(lines, markers);
  if (!loc) return { text, action: 'absent' };
  const before = lines.slice(0, loc.startLine);
  const after = lines.slice(loc.endLine + 1);
  const prev = before[before.length - 1];
  const next = after[0];
  if (prev && prev.text === '' && (!next || next.text === '')) before.pop();
  const out = joinLines(before) + joinLines(after);
  return { text: out, action: /^\s*$/.test(out) ? 'emptied' : 'removed' };
}

// latin1 <-> JS string helpers: file bytes map 1:1 onto latin1 code units.
function utf8AsLatin1(s) {
  return Buffer.from(s, 'utf8').toString('latin1');
}

function toLatin1Markers(markers) {
  return { start: utf8AsLatin1(markers.start), end: utf8AsLatin1(markers.end) };
}

/**
 * Write `body` into the block delimited by `markers` in `filePath`.
 * @returns {'created'|'appended'|'replaced'|'unchanged'}
 */
function spliceFile(filePath, markers, body) {
  validateMarkers(markers);
  const m = toLatin1Markers(markers);
  const b = utf8AsLatin1(body);
  if (!fs.existsSync(filePath)) {
    const r = spliceText(null, m, b);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, r.text, 'latin1');
    return r.action;
  }
  const text = fs.readFileSync(filePath, 'latin1');
  const r = spliceText(text, m, b);
  if (r.action === 'appended') {
    fs.appendFileSync(filePath, r.appended, 'latin1');
  } else if (r.action === 'replaced') {
    fs.writeFileSync(filePath, r.text, 'latin1');
  }
  return r.action;
}

/**
 * Remove the block delimited by `markers` from `filePath`.
 * @returns {'absent'|'removed'|'deleted'}
 */
function removeFile(filePath, markers) {
  validateMarkers(markers);
  if (!fs.existsSync(filePath)) return 'absent';
  const text = fs.readFileSync(filePath, 'latin1');
  const r = removeText(text, toLatin1Markers(markers));
  if (r.action === 'absent') return 'absent';
  if (r.action === 'emptied') {
    fs.unlinkSync(filePath);
    return 'deleted';
  }
  fs.writeFileSync(filePath, r.text, 'latin1');
  return 'removed';
}

module.exports = {
  MA_AGENTS_MARKERS,
  MA_STANDARDS_MARKERS,
  MarkerBlockError,
  findBlock,
  renderBlock,
  spliceText,
  removeText,
  spliceFile,
  removeFile,
  _splitLines: splitLines
};
