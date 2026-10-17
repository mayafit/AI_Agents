#!/usr/bin/env node
/**
 * Bug: ma-skills module-help.csv used the pre-6.10 column schema.
 *
 * bmad-method 6.10.0 merges every module's module-help.csv into
 * _bmad/_config/bmad-help.csv under one canonical header and, on a header
 * mismatch, warns and loads the file POSITIONALLY. Our pre-6.10 header
 * (module,phase,name,code,sequence,workflow-file,command,required,agent,...)
 * therefore put every value in the wrong column for all 51 rows: skill =
 * "anytime", description empty, phase = "false" — so bmad-help described and
 * routed every ma-skills entry wrongly.
 *
 * These checks read the canonical header from the INSTALLED bmad-method, so a
 * future bmad-method bump that changes the schema fails here first.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE_CSV = path.join(ROOT, 'lib', 'bmad-extension', 'skills', 'module-help.csv');
const PLUGIN_CSV = path.join(ROOT, 'lib', 'bmad-extension-plugin', 'skills', 'module-help.csv');
const SKILLS_DIR = path.join(ROOT, 'lib', 'bmad-extension', 'skills');
const BMAD_DIR = path.dirname(require.resolve('bmad-method/package.json', { paths: [ROOT] }));
const { MODULE_HELP_CSV_HEADER } = require(path.join(BMAD_DIR, 'tools', 'installer', 'modules', 'module-help-schema.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

/** Parse one CSV line, honouring double-quoted fields and "" escapes. */
function parseLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function readCsv(file) {
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
  const header = lines[0];
  const cols = parseLine(header);
  const rows = lines.slice(1).map(parseLine).map(f => Object.fromEntries(cols.map((c, i) => [c, f[i]])));
  return { header, cols, rows, widths: lines.slice(1).map(l => parseLine(l).length) };
}

/** Every module-help.csv shipped by bmad-method itself plus the bundled external modules. */
function otherModuleHelpFiles() {
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== 'node_modules') walk(f);
      else if (e.name === 'module-help.csv') files.push(f);
    }
  })(BMAD_DIR);
  for (const rel of ['tea/src', 'cis/src', 'bmb/skills']) {
    const f = path.join(ROOT, 'lib', 'bmad-cache', rel, 'module-help.csv');
    if (fs.existsSync(f)) files.push(f);
  }
  return files;
}

console.log('\nma-skills module-help.csv matches bmad-method\'s canonical schema\n');

const csv = readCsv(SOURCE_CSV);

test('header is exactly bmad-method\'s MODULE_HELP_CSV_HEADER', () => {
  assert.strictEqual(csv.header, MODULE_HELP_CSV_HEADER);
});

test('every row has exactly one field per header column', () => {
  csv.widths.forEach((w, i) => assert.strictEqual(w, csv.cols.length, `row ${i + 2} has ${w} fields`));
});

test('every row names a skill directory that ships in lib/bmad-extension/skills', () => {
  for (const r of csv.rows) {
    assert.ok(fs.existsSync(path.join(SKILLS_DIR, r.skill, 'SKILL.md')), `no skill directory for "${r.skill}"`);
  }
});

test('every row has a display-name, description, phase and required flag', () => {
  for (const r of csv.rows) {
    for (const k of ['display-name', 'description', 'phase']) assert.ok(r[k], `${r.skill}: empty ${k}`);
    assert.ok(['true', 'false'].includes(r.required), `${r.skill}: required=${r.required}`);
  }
});

test('menu codes are present and unique within ma-skills', () => {
  const seen = new Map();
  for (const r of csv.rows) {
    assert.ok(/^[A-Z0-9]{2,5}$/.test(r['menu-code']), `${r.skill}: bad menu-code "${r['menu-code']}"`);
    assert.ok(!seen.has(r['menu-code']), `${r['menu-code']} used by both ${seen.get(r['menu-code'])} and ${r.skill}`);
    seen.set(r['menu-code'], r.skill);
  }
});

test('menu codes do not collide with bmad-method or the bundled modules', () => {
  const taken = new Map();
  for (const f of otherModuleHelpFiles()) {
    const other = readCsv(f);
    if (!other.cols.includes('menu-code')) continue;
    for (const r of other.rows) if (r['menu-code']) taken.set(r['menu-code'].toUpperCase(), path.relative(ROOT, f));
  }
  assert.ok(taken.size > 0, 'found no other module-help.csv to compare against');
  for (const r of csv.rows) {
    assert.ok(!taken.has(r['menu-code']), `${r.skill}: menu-code ${r['menu-code']} already used in ${taken.get(r['menu-code'])}`);
  }
});

// bmad-method's manifest generator (tools/installer/core/manifest-generator.js)
// yaml.parse()s each SKILL.md frontmatter and silently drops the skill from
// _bmad/_config/skill-manifest.csv when it throws or the name does not match
// the directory. my-next-issue's unquoted "(Jira: assignee = ...)" did exactly
// that, so its _bmad/ma-skills/ copy was never cleaned up after install.
test('every extension SKILL.md frontmatter parses as YAML with a matching name', () => {
  const yaml = require('yaml');
  for (const r of csv.rows) {
    const text = fs.readFileSync(path.join(SKILLS_DIR, r.skill, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(fm, `${r.skill}: no frontmatter`);
    let meta;
    assert.doesNotThrow(() => { meta = yaml.parse(fm[1]); }, `${r.skill}: frontmatter is not valid YAML`);
    assert.strictEqual(meta.name, r.skill, `${r.skill}: frontmatter name is "${meta.name}"`);
    assert.ok(typeof meta.description === 'string' && meta.description, `${r.skill}: no description`);
  }
});

test('the plugin bundle carries the same module-help.csv', () => {
  const norm = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  assert.strictEqual(norm(PLUGIN_CSV), norm(SOURCE_CSV), 'run npm run build:plugin');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
