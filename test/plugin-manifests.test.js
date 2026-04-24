#!/usr/bin/env node
/**
 * Tests for Story 22.5 — Plugin Manifests.
 *
 * Verifies:
 *   - lib/bmad-extension/.claude-plugin/marketplace.json.template exists and is parseable
 *   - Template includes required BMAD v6.3.0 top-level fields (name, owner, description, plugins[])
 *   - Template's plugins[0] has skills[] and all listed skill paths exist under skills/
 *   - Template lists the five ma-agent-* renamed skills (Story 22.2 contract)
 *   - Template declares compatible_tools with all five BMAD-supported tools (AC 2)
 *   - lib/bmad-extension/skills/module.yaml exists with required v6.3.0 fields
 *   - module_version is present and a valid semver (AC 7)
 *   - Legacy lib/bmad-extension/module.yaml is absent (AC 3)
 *   - No skill directory is silently missing from the marketplace.json skills list
 *     (Edge-case: detects skill ID drift if a new skill is added without updating
 *     the manifest.)
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.join(__dirname, '..');
const EXTENSION_DIR = path.join(PROJECT_ROOT, 'lib', 'bmad-extension');
const SKILLS_DIR = path.join(EXTENSION_DIR, 'skills');
const PLUGIN_DIR = path.join(EXTENSION_DIR, '.claude-plugin');
const TEMPLATE_PATH = path.join(PLUGIN_DIR, 'marketplace.json.template');
const MODULE_YAML_PATH = path.join(SKILLS_DIR, 'module.yaml');
const MODULE_CSV_PATH = path.join(SKILLS_DIR, 'module-help.csv');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.message}`);
    failed++;
  }
}

function parseSimpleYaml(content) {
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let val = trimmed.slice(colonIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

console.log('\n=== Story 22.5: Plugin Manifests ===');

// ─── AC 1 / Task 2: marketplace.json.template exists and is parseable ──────
console.log('\n--- AC 1: marketplace.json.template ---');

test('.claude-plugin/ directory exists', () => {
  assert.ok(fs.existsSync(PLUGIN_DIR), '.claude-plugin/ directory must exist');
  assert.ok(fs.statSync(PLUGIN_DIR).isDirectory(), '.claude-plugin must be a directory');
});

test('marketplace.json.template exists', () => {
  assert.ok(fs.existsSync(TEMPLATE_PATH), 'marketplace.json.template must exist');
});

let template;
test('marketplace.json.template is valid JSON', () => {
  const raw = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  // Template may contain ${var} placeholders — JSON.parse treats them as strings,
  // which is fine because they are quoted (e.g. "version": "${version}").
  template = JSON.parse(raw);
  assert.ok(template && typeof template === 'object', 'template must parse to an object');
});

test('template has BMAD v6.3.0 required top-level fields', () => {
  const required = ['name', 'owner', 'description', 'plugins'];
  for (const f of required) {
    assert.ok(Object.prototype.hasOwnProperty.call(template, f),
      `missing required field: ${f}`);
  }
});

test('template.name is ma-agents', () => {
  assert.strictEqual(template.name, 'ma-agents');
});

test('template.plugins is a non-empty array', () => {
  assert.ok(Array.isArray(template.plugins), 'plugins must be an array');
  assert.ok(template.plugins.length >= 1, 'plugins must have at least one entry');
});

let plugin;
test('template.plugins[0] (ma-skills) has required BMAD v6.3.0 fields', () => {
  plugin = template.plugins[0];
  const required = ['name', 'source', 'description', 'version', 'skills'];
  for (const f of required) {
    assert.ok(Object.prototype.hasOwnProperty.call(plugin, f),
      `plugins[0] missing field: ${f}`);
  }
  assert.strictEqual(plugin.name, 'ma-skills');
  assert.ok(Array.isArray(plugin.skills), 'plugins[0].skills must be an array');
});

// ─── AC 2: compatible_tools declares multi-tool parity ─────────────────────
console.log('\n--- AC 2: Multi-tool compatibility ---');

test('template declares compatible_tools with all five BMAD-supported tools', () => {
  assert.ok(Array.isArray(template.compatible_tools),
    'compatible_tools must be an array');
  const expected = ['claude-code', 'copilot', 'cline', 'roo-code', 'kilocode'];
  for (const tool of expected) {
    assert.ok(template.compatible_tools.includes(tool),
      `compatible_tools missing required entry: ${tool}`);
  }
});

test('template includes a top-of-file _comment documenting the shared-convention filename', () => {
  // AC 2: document that .claude-plugin/ is NOT Claude-specific.
  assert.ok(Object.prototype.hasOwnProperty.call(template, '_comment'),
    'template must have a _comment field documenting the shared convention');
  const commentText = Array.isArray(template._comment)
    ? template._comment.join(' ')
    : String(template._comment);
  assert.ok(
    /not.*claude-only|not.*claude-specific|skills-capable platform|shared.*convention/i.test(commentText),
    '_comment must document that .claude-plugin/ is a shared BMAD convention, not Claude-specific'
  );
});

// ─── AC 3: skills/module.yaml exists with v6.3.0 fields ────────────────────
console.log('\n--- AC 3: skills/module.yaml ---');

test('skills/module.yaml exists (v6.3.0 canonical location)', () => {
  assert.ok(fs.existsSync(MODULE_YAML_PATH), 'skills/module.yaml must exist');
});

let moduleYaml;
test('skills/module.yaml parses and has required fields', () => {
  const content = fs.readFileSync(MODULE_YAML_PATH, 'utf8');
  moduleYaml = parseSimpleYaml(content);
  assert.strictEqual(moduleYaml.code, 'ma-skills', 'code must be ma-skills');
  assert.ok(moduleYaml.description, 'description must be present');
  assert.ok(moduleYaml.module_version, 'module_version must be present (v6.3.0)');
});

test('skills/module.yaml module_version is a valid semver', () => {
  const ver = moduleYaml.module_version;
  assert.ok(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(ver),
    `module_version "${ver}" must match MAJOR.MINOR.PATCH (semver)`);
});

test('legacy lib/bmad-extension/module.yaml is removed (AC 3)', () => {
  const legacy = path.join(EXTENSION_DIR, 'module.yaml');
  assert.ok(!fs.existsSync(legacy),
    'legacy module.yaml must be removed; v6.3.0 uses skills/module.yaml');
});

test('skills/module-help.csv exists alongside module.yaml (PluginResolver Strategy 1)', () => {
  assert.ok(fs.existsSync(MODULE_CSV_PATH),
    'skills/module-help.csv must exist alongside skills/module.yaml so PluginResolver Strategy 1 succeeds');
});

// ─── AC 5-6 precursor / AC 7: skills list hygiene + version-bump convention
console.log('\n--- AC 5/6/7: Skills list hygiene ---');

test('template lists the five renamed ma-agent-* skills (Story 22.2 contract)', () => {
  const required = [
    './skills/ma-agent-cyber',
    './skills/ma-agent-devops',
    './skills/ma-agent-sre',
    './skills/ma-agent-ml',
    './skills/ma-agent-sqa',
  ];
  for (const p of required) {
    assert.ok(plugin.skills.includes(p),
      `template.plugins[0].skills missing Story 22.2 entry: ${p}`);
  }
});

test('every skill path declared in the template resolves to an on-disk directory', () => {
  for (const rel of plugin.skills) {
    // Strip leading ./ and resolve relative to lib/bmad-extension/
    const normalized = rel.replace(/^\.\//, '');
    const abs = path.join(EXTENSION_DIR, normalized);
    assert.ok(fs.existsSync(abs),
      `template lists nonexistent skill path: ${rel} (resolved: ${abs})`);
    assert.ok(fs.statSync(abs).isDirectory(),
      `template path is not a directory: ${rel}`);
  }
});

test('every on-disk skill directory is listed in the template (no silent drift)', () => {
  // Edge-case: adding a new skill without updating marketplace.json.template
  // silently breaks the plugin install. This test catches that.
  const onDisk = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const listed = new Set(plugin.skills.map((p) => path.basename(p)));
  const missing = onDisk.filter((name) => !listed.has(name));
  assert.strictEqual(missing.length, 0,
    `skill directories present on disk but absent from marketplace.json.template: ${missing.join(', ')}`);
});

test('template does not contain duplicate skill entries', () => {
  const seen = new Set();
  const dups = [];
  for (const p of plugin.skills) {
    if (seen.has(p)) dups.push(p);
    seen.add(p);
  }
  assert.strictEqual(dups.length, 0,
    `duplicate skill entries in template: ${dups.join(', ')}`);
});

test('template version placeholder is present for Story 22.4 build-time substitution', () => {
  // AC 4: the build script (22.4) will substitute ${version} from package.json.
  // If this is hand-pinned before 22.4 lands the script, the manifest will
  // drift from package.json — so we assert the placeholder is still here.
  assert.strictEqual(plugin.version, '${version}',
    'plugins[0].version must remain "${version}" as a build-time placeholder; Story 22.4 resolves it');
});

test('bmad_min_version is declared (edge-case: min-version compat)', () => {
  assert.ok(template.bmad_min_version,
    'bmad_min_version must be declared so installers can reject incompatible BMAD versions');
  assert.ok(/^\d+\.\d+\.\d+$/.test(template.bmad_min_version),
    `bmad_min_version "${template.bmad_min_version}" must be MAJOR.MINOR.PATCH`);
});

// ─── Summary ───────────────────────────────────────────────────────────────
console.log('\n=== Results ===');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
