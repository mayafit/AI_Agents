#!/usr/bin/env node
/**
 * Story 36.6 (AC2, AC3) — run every file of the `npm test` chain individually.
 *
 * `package.json` `scripts.test` is one `&&` chain, so the first failing file
 * hides every file after it. This runner reads the chain from `package.json`
 * (the one authority on which files the suite holds), runs each file on its own
 * with `node <file>`, and prints a per-file summary, so no file is reported
 * without having run.
 *
 * With `--allowlist <json>` (test/known-failures-linux.json) the run is a gate:
 *   - a failing file that is not in the allowlist fails the run (a NEW failure);
 *   - an allowlisted file that passes fails the run (a STALE entry);
 *   - an allowlisted file that is not in the chain fails the run (STALE);
 *   - every entry must name a bug key whose record exists at
 *     `_bmad-output/implementation-artifacts/<key>.md` (or under `done/`).
 * With `--require-pass <file>` (repeatable) that file must pass, must not be
 * allowlisted and must report 0 skipped tests when it prints a skip count.
 *
 * Usage:
 *   node .github/scripts/run-test-chain.js [--allowlist <json>] [--require-pass <file>]...
 *        [--from <file>] [--timeout-min <n>] [--json <out>]
 *
 * `--from <file>` starts at that chain position (the Windows halt record).
 * Exit 0 when the gate holds (or, without an allowlist, when every file passed); 1 otherwise;
 * 2 on a usage or chain-format error.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const BUG_DIRS = [
  path.join(ROOT, '_bmad-output', 'implementation-artifacts'),
  path.join(ROOT, '_bmad-output', 'implementation-artifacts', 'done'),
];

function usage(msg) {
  console.error(`run-test-chain: ${msg}`);
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { allowlist: null, requirePass: [], from: null, timeoutMin: 20, json: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { if (i + 1 >= argv.length) usage(`${a} needs a value`); return argv[++i]; };
    if (a === '--allowlist') opts.allowlist = next();
    else if (a === '--require-pass') opts.requirePass.push(normalize(next()));
    else if (a === '--from') opts.from = normalize(next());
    else if (a === '--timeout-min') opts.timeoutMin = Number(next());
    else if (a === '--json') opts.json = next();
    else usage(`unknown argument ${a}`);
  }
  return opts;
}

function normalize(file) {
  return file.replace(/\\/g, '/').replace(/^\.\//, '');
}

/** The chain files, in order, from `package.json` `scripts.test`. */
function readChain() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const parts = String(pkg.scripts && pkg.scripts.test || '').split('&&').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) usage('package.json scripts.test is empty');
  return parts.map((p, i) => {
    const m = /^node (test\/[A-Za-z0-9._-]+\.js)$/.exec(p);
    if (!m) usage(`chain element ${i + 1} is not "node test/<file>.js": ${JSON.stringify(p)}`);
    return m[1];
  });
}

function bugRecordExists(key) {
  return BUG_DIRS.some((d) => fs.existsSync(path.join(d, `${key}.md`)));
}

function readAllowlist(file) {
  const doc = JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
  const failures = doc && doc.failures;
  if (!failures || typeof failures !== 'object' || Array.isArray(failures)) {
    usage(`${file}: expected { "failures": { "test/<file>.js": "<bug-key>" } }`);
  }
  return new Map(Object.entries(failures).map(([k, v]) => [normalize(k), v]));
}

/** `N passed, M failed[, K skipped]` as printed by the suites, when present (last one wins). */
function counts(output) {
  const re = /(\d+) passed,\s*(\d+) failed(?:,\s*(\d+) skipped)?/g;
  let m;
  let last = null;
  while ((m = re.exec(output)) !== null) last = { passed: +m[1], failed: +m[2], skipped: m[3] === undefined ? null : +m[3] };
  return last;
}

function runFile(file, timeoutMin) {
  const start = Date.now();
  const r = spawnSync(process.execPath, [file], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMin * 60 * 1000,
    maxBuffer: 1 << 28,
    windowsHide: true,
  });
  const output = `${r.stdout || ''}${r.stderr ? `\n${r.stderr}` : ''}`;
  let status = r.status;
  let note = '';
  if (r.error && r.error.code === 'ETIMEDOUT') { status = 124; note = `timed out after ${timeoutMin} min`; }
  else if (r.error) { status = 125; note = r.error.message; }
  else if (r.signal) { status = 128; note = `killed by ${r.signal}`; }
  return { file, exit: status, seconds: Math.round((Date.now() - start) / 100) / 10, counts: counts(output), note, output };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const chain = readChain();
  let files = chain;
  if (opts.from) {
    const at = chain.indexOf(opts.from);
    if (at < 0) usage(`--from ${opts.from} is not in the chain`);
    files = chain.slice(at);
  }
  const allow = opts.allowlist ? readAllowlist(opts.allowlist) : null;
  const ci = !!process.env.GITHUB_ACTIONS;

  console.log(`chain: ${chain.length} files; running ${files.length}${opts.from ? ` from ${opts.from} (position ${chain.indexOf(opts.from) + 1})` : ''}`);
  const results = [];
  for (const file of files) {
    const pos = chain.indexOf(file) + 1;
    if (ci) console.log(`::group::[${pos}/${chain.length}] ${file}`);
    else console.log(`\n----- [${pos}/${chain.length}] ${file}`);
    const r = runFile(file, opts.timeoutMin);
    r.position = pos;
    process.stdout.write(r.output.endsWith('\n') ? r.output : `${r.output}\n`);
    console.log(`----- ${file}: exit ${r.exit} (${r.seconds} s)${r.note ? ` ${r.note}` : ''}`);
    if (ci) console.log('::endgroup::');
    delete r.output;
    results.push(r);
  }

  // ─── verdicts ───────────────────────────────────────────────────────────────
  const problems = [];
  for (const r of results) {
    const key = allow ? allow.get(r.file) : undefined;
    if (r.exit === 0) r.verdict = key ? 'STALE allowlist entry (passes)' : 'pass';
    else r.verdict = allow ? (key ? `known failure (${key})` : 'NEW failure') : 'FAIL';
    if (allow && r.exit !== 0 && !key) problems.push(`NEW failure: ${r.file} (exit ${r.exit}) is not in ${opts.allowlist}`);
    if (allow && r.exit === 0 && key) problems.push(`STALE allowlist entry: ${r.file} passes; remove it from ${opts.allowlist} (${key})`);
  }
  if (allow) {
    for (const [file, key] of allow) {
      if (!chain.includes(file)) problems.push(`STALE allowlist entry: ${file} is not in the chain (${key})`);
      if (typeof key !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(key)) problems.push(`allowlist entry ${file}: bug key ${JSON.stringify(key)} is not a key`);
      else if (!bugRecordExists(key)) problems.push(`allowlist entry ${file}: bug record _bmad-output/implementation-artifacts/${key}.md does not exist`);
    }
  }
  for (const file of opts.requirePass) {
    const r = results.find((x) => x.file === file);
    if (!chain.includes(file)) problems.push(`required file ${file} is not in the chain`);
    else if (!r) problems.push(`required file ${file} did not run (before --from)`);
    else {
      if (r.exit !== 0) problems.push(`required file ${file} failed (exit ${r.exit})`);
      if (allow && allow.has(file)) problems.push(`required file ${file} is allowlisted`);
      if (r.counts && r.counts.skipped) problems.push(`required file ${file} skipped ${r.counts.skipped} test(s)`);
    }
  }
  if (!allow) {
    for (const r of results) if (r.exit !== 0) problems.push(`FAIL: ${r.file} (exit ${r.exit})`);
  }

  // ─── summary ────────────────────────────────────────────────────────────────
  const failing = results.filter((r) => r.exit !== 0);
  const lines = [
    '## npm test chain, file by file',
    '',
    `${results.length} of ${chain.length} files run; ${results.length - failing.length} passed, ${failing.length} failed.`,
    '',
    '| # | File | Exit | Passed / failed / skipped | Seconds | Verdict |',
    '|---|---|---|---|---|---|',
    ...results.map((r) => `| ${r.position} | \`${r.file}\` | ${r.exit} | ${r.counts ? `${r.counts.passed} / ${r.counts.failed} / ${r.counts.skipped === null ? '–' : r.counts.skipped}` : '–'} | ${r.seconds} | ${r.verdict}${r.note ? ` (${r.note})` : ''} |`),
    '',
    problems.length ? '### Gate problems' : (allow ? '### Gate holds: every failure is allowlisted and no entry is stale.' : '### Every file passed.'),
    ...problems.map((p) => `- ${p}`),
    '',
  ];
  const text = lines.join('\n');
  console.log(`\n${text}`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  if (opts.json) fs.writeFileSync(path.resolve(opts.json), `${JSON.stringify({ chainLength: chain.length, results, problems }, null, 2)}\n`);
  process.exit(problems.length ? 1 : 0);
}

main();
