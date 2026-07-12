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
const yaml = require('js-yaml');

const PROJECT_ROOT = path.join(__dirname, '..');
const EXTENSION_DIR = path.join(PROJECT_ROOT, 'lib', 'bmad-extension');
const SKILLS_DIR = path.join(EXTENSION_DIR, 'skills');
const PLUGIN_DIR = path.join(EXTENSION_DIR, '.claude-plugin');
const TEMPLATE_PATH = path.join(PLUGIN_DIR, 'marketplace.json.template');
const MODULE_YAML_PATH = path.join(SKILLS_DIR, 'module.yaml');
const MODULE_CSV_PATH = path.join(SKILLS_DIR, 'module-help.csv');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');

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

// Edge-case-hunter finding 1: the previous line-based parser broke on multi-line
// strings and quoted colons. Delegate to js-yaml for full-spec coverage.
function parseYaml(content) {
  const doc = yaml.load(content);
  if (doc === null || doc === undefined) return {};
  if (typeof doc !== 'object') {
    throw new Error(`module.yaml must parse to an object, got ${typeof doc}`);
  }
  return doc;
}

// Semver compare: returns negative/zero/positive. Only MAJOR.MINOR.PATCH; pre-release ignored.
function semverCompare(a, b) {
  const pa = String(a).split('-')[0].split('.').map((n) => parseInt(n, 10));
  const pb = String(b).split('-')[0].split('.').map((n) => parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da - db;
  }
  return 0;
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
  // Edge-case-hunter finding 8: guard against _comment being a non-array/non-string value.
  assert.ok(Array.isArray(template._comment) || typeof template._comment === 'string',
    `_comment must be an array of strings or a single string, got ${typeof template._comment}`);
  const commentText = Array.isArray(template._comment)
    ? template._comment.join(' ')
    : String(template._comment);
  assert.ok(
    /not.*claude-only|not.*claude-specific|skills-capable platform|shared.*convention/i.test(commentText),
    '_comment must document that .claude-plugin/ is a shared BMAD convention, not Claude-specific'
  );
});

test('_comment documents that plugins[].source "./" is relative to .claude-plugin/ parent (finding 7 hand-off for 22.4)', () => {
  // Edge-case-hunter finding 7 (deferred to 22.4): the "./" source string is ambiguous.
  // To avoid 22.4 interpreting it wrong, the template itself must declare the convention.
  const commentText = Array.isArray(template._comment)
    ? template._comment.join(' ')
    : String(template._comment);
  assert.ok(
    /source\s*[:"\s]*\.\/.*relative|relative.*\.claude-plugin|directory containing \.claude-plugin/i.test(commentText),
    '_comment must clarify that source "./" resolves relative to the directory containing .claude-plugin/'
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
  moduleYaml = parseYaml(content);
  assert.strictEqual(moduleYaml.code, 'ma-skills', 'code must be ma-skills');
  assert.ok(moduleYaml.description, 'description must be present');
  assert.ok(moduleYaml.module_version, 'module_version must be present (v6.3.0)');
});

test('skills/module.yaml has a non-empty name (edge-case-hunter finding 9)', () => {
  assert.ok(typeof moduleYaml.name === 'string' && moduleYaml.name.trim().length > 0,
    'module.yaml must declare a non-empty name');
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

test('module.yaml exists ONLY at skills/ location — half-done-migration guard (finding 3)', () => {
  // Edge-case-hunter finding 3: if both the legacy and canonical module.yaml exist,
  // PluginResolver Strategy 1 is ambiguous and the install silently uses the wrong one.
  const legacy = path.join(EXTENSION_DIR, 'module.yaml');
  const canonical = MODULE_YAML_PATH;
  const legacyExists = fs.existsSync(legacy);
  const canonicalExists = fs.existsSync(canonical);
  assert.ok(!(legacyExists && canonicalExists),
    'both legacy (lib/bmad-extension/module.yaml) and canonical (skills/module.yaml) ' +
    'module.yaml exist — half-done migration. Remove the legacy file.');
});

test('extends-module parent is resolvable in node_modules/bmad-method (finding 4)', () => {
  // Edge-case-hunter finding 4: if module.yaml's `extends-module: bmm` points to
  // a module that does not exist at install time, installs fail opaquely. Verify
  // the parent's module.yaml is present under bmad-method's src/ tree.
  const parent = moduleYaml['extends-module'];
  if (!parent) return; // extends-module is optional
  const parentYamlPath = path.join(
    PROJECT_ROOT,
    'node_modules',
    'bmad-method',
    'src',
    `${parent}-skills`,
    'module.yaml',
  );
  assert.ok(fs.existsSync(parentYamlPath),
    `extends-module "${parent}" not resolvable: expected ${parentYamlPath} to exist. ` +
    'If bmad-method v6.3.0 reorganized its module layout, update this assertion.');
});

test('skills/module-help.csv exists alongside module.yaml (PluginResolver Strategy 1)', () => {
  assert.ok(fs.existsSync(MODULE_CSV_PATH),
    'skills/module-help.csv must exist alongside skills/module.yaml so PluginResolver Strategy 1 succeeds');
});

// ─── AC 5-6 precursor / AC 7: skills list hygiene + version-bump convention
console.log('\n--- AC 5/6/7: Skills list hygiene ---');

test('template lists the four renamed ma-agent-* skills (Story 22.2 contract; ma-agent-ml removed by Story 30.4)', () => {
  const required = [
    './skills/ma-agent-cyber',
    './skills/ma-agent-devops',
    './skills/ma-agent-sre',
    './skills/ma-agent-sqa',
  ];
  for (const p of required) {
    assert.ok(plugin.skills.includes(p),
      `template.plugins[0].skills missing Story 22.2 entry: ${p}`);
  }
  assert.ok(!plugin.skills.includes('./skills/ma-agent-ml'),
    'template.plugins[0].skills must NOT list ma-agent-ml (Story 30.4 — Demerzel deprecated for new installs)');
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

test('bmad_min_version <= pinned bmad-method dependency (finding 2: drift guard)', () => {
  // Edge-case-hunter finding 2: if we pin bmad-method@X but declare a higher
  // bmad_min_version, the plugin claims a floor the project itself cannot satisfy.
  // Forward-compat assumes upstream stays additive; breaking upstream changes
  // require a matching bump here + the _comment note.
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const bmadPin = (pkg.dependencies && pkg.dependencies['bmad-method']) || '';
  const pinned = bmadPin.replace(/^[^\d]*/, ''); // strip ^, ~, etc.
  assert.ok(/^\d+\.\d+\.\d+$/.test(pinned),
    `bmad-method dependency "${bmadPin}" must resolve to an exact MAJOR.MINOR.PATCH`);
  assert.ok(semverCompare(template.bmad_min_version, pinned) <= 0,
    `bmad_min_version (${template.bmad_min_version}) must be <= pinned bmad-method (${pinned}). ` +
    'Either lower the floor or bump the pin.');
});

test('bmad_min_version EQUALS pinned bmad-method (template — F3 #4: stricter than <=)', () => {
  // F3 Section 4 — Adversarial review found the marketplace's bmad_min_version
  // could legitimately drift below the pinned bmad-method (the <= test allows
  // it). When the pin is bumped, the floor SHOULD bump in lockstep so the
  // published marketplace.json reflects the exact tested-against version. This
  // assertion is stricter and catches forgotten bumps.
  //
  // Bump procedure when bmad-method is updated:
  //   1. Update package.json dependencies.bmad-method
  //   2. Update lib/bmad-extension/.claude-plugin/marketplace.json.template
  //      bmad_min_version to the same value
  //   3. Re-run `npm run build:plugin` to regenerate the rendered manifest
  //   4. This test guards step 2 against being forgotten
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const bmadPin = (pkg.dependencies && pkg.dependencies['bmad-method']) || '';
  const pinned = bmadPin.replace(/^[^\d]*/, ''); // strip ^, ~, etc.
  // Edge-case-hunter E12: skip with a clear hint when the pin is not a
  // plain semver (file: / git+: / npm:alias:). The strictEqual assertion
  // assumes a semver value; cryptic failures mask the real config state.
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(pinned)) {
    console.log(`    (skip: bmad-method pinned to non-semver "${bmadPin}" — strict-equality test does not apply)`);
    return;
  }
  assert.strictEqual(template.bmad_min_version, pinned,
    `marketplace template bmad_min_version (${template.bmad_min_version}) ` +
    `must equal pinned bmad-method (${pinned}). ` +
    'When bumping bmad-method, update marketplace.json.template in lockstep.');
});

test('bmad_min_version EQUALS pinned bmad-method (rendered bundle — F3 #4)', () => {
  // The build script renders the template into the committed bundle. We also
  // check the rendered output to catch a stale bundle (caught by Section 3's
  // drift guard in CI, but the failure here is more actionable for local devs).
  const renderedPath = path.join(
    PROJECT_ROOT,
    'lib',
    'bmad-extension-plugin',
    '.claude-plugin',
    'marketplace.json'
  );
  if (!fs.existsSync(renderedPath)) {
    // The bundle may legitimately be absent on a fresh checkout that never
    // ran `npm install` — skip with a hint rather than failing opaquely.
    console.log('    (skip: rendered marketplace.json not present — run `npm run build:plugin`)');
    return;
  }
  // Edge-case-hunter E11: a mid-build crash can leave a half-written
  // marketplace.json on disk. JSON.parse would throw a generic SyntaxError;
  // we re-throw with an actionable hint.
  let rendered;
  try {
    rendered = JSON.parse(fs.readFileSync(renderedPath, 'utf8'));
  } catch (err) {
    throw new Error(
      `rendered marketplace.json at ${renderedPath} is malformed JSON — ` +
      `likely a crashed/partial build. Re-run \`npm run build:plugin\`. ` +
      `Original parse error: ${err.message}`
    );
  }
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const bmadPin = (pkg.dependencies && pkg.dependencies['bmad-method']) || '';
  const pinned = bmadPin.replace(/^[^\d]*/, '');
  // Edge-case-hunter E12: skip with a clear hint when the pin is not a
  // plain semver (file: / git+: / npm:alias:). The strictEqual assertion
  // assumes a semver value; cryptic failures mask the real config state.
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(pinned)) {
    console.log(`    (skip: bmad-method pinned to non-semver "${bmadPin}" — strict-equality test does not apply)`);
    return;
  }
  assert.strictEqual(rendered.bmad_min_version, pinned,
    `rendered marketplace.json bmad_min_version (${rendered.bmad_min_version}) ` +
    `must equal pinned bmad-method (${pinned}). Re-run \`npm run build:plugin\`.`);
});

test('template _comment explains forward-compat assumption for bmad_min_version (finding 2)', () => {
  const commentText = Array.isArray(template._comment)
    ? template._comment.join(' ')
    : String(template._comment);
  assert.ok(
    /forward.?compat|additive.*upstream|upstream.*additive/i.test(commentText),
    '_comment must note that forward-compat assumes upstream bmad-method changes remain additive'
  );
});

test('every template-listed skill has a SKILL.md file (finding 5)', () => {
  // Edge-case-hunter finding 5: a dir may exist but the skill payload (SKILL.md) is missing,
  // leaving the install silently broken. Assert it is present for each listed skill.
  for (const rel of plugin.skills) {
    const normalized = rel.replace(/^\.\//, '');
    const abs = path.join(EXTENSION_DIR, normalized);
    const skillMd = path.join(abs, 'SKILL.md');
    assert.ok(fs.existsSync(skillMd),
      `SKILL.md missing for template-listed skill: ${rel} (expected ${skillMd})`);
  }
});

// ─── Summary ───────────────────────────────────────────────────────────────
console.log('\n=== Results ===');
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
