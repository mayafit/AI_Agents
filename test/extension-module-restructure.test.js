#!/usr/bin/env node
/**
 * Tests for extension module restructure (Story 15-2)
 *
 * Verifies:
 *   - module.yaml has all required fields for BMAD 6.2.0 conventions
 *   - skills/ directory exists with correct subdirectories
 *   - module-help.csv has entries for all skills
 *   - Old agents/ and workflows/ directories still exist (preserved for 15.3-15.6)
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.join(__dirname, '..');
const EXTENSION_DIR = path.join(PROJECT_ROOT, 'lib', 'bmad-extension');
const SKILLS_DIR = path.join(EXTENSION_DIR, 'skills');

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

// ─── Helper: parse simple YAML (key: value pairs) ──────────────────────────
function parseSimpleYaml(content) {
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let val = trimmed.slice(colonIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

// ─── Helper: parse CSV ──────────────────────────────────────────────────────
function parseCsv(content) {
  const lines = content.trim().split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  });
  return { headers, rows };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Task 1: module.yaml validation
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n--- Task 1: skills/module.yaml ---');

// Story 22.5 moved module.yaml from lib/bmad-extension/ to lib/bmad-extension/skills/
// per BMAD v6.3.0 canonical location (PluginResolver Strategy 1 reads from the
// common parent of all skill paths).
const moduleYamlPath = path.join(SKILLS_DIR, 'module.yaml');
const legacyModuleYamlPath = path.join(EXTENSION_DIR, 'module.yaml');

test('skills/module.yaml file exists (v6.3.0 canonical location)', () => {
  assert.ok(fs.existsSync(moduleYamlPath), 'skills/module.yaml must exist');
});

test('legacy lib/bmad-extension/module.yaml is removed (Story 22.5)', () => {
  assert.ok(
    !fs.existsSync(legacyModuleYamlPath),
    'legacy module.yaml must be removed — v6.3.0 uses skills/module.yaml'
  );
});

let moduleYaml = {};
test('module.yaml is parseable', () => {
  const content = fs.readFileSync(moduleYamlPath, 'utf8');
  moduleYaml = parseSimpleYaml(content);
  assert.ok(Object.keys(moduleYaml).length > 0, 'module.yaml must have fields');
});

test('module.yaml has code: ma-skills', () => {
  assert.strictEqual(moduleYaml.code, 'ma-skills', 'code field must be ma-skills');
});

test('module.yaml has name field', () => {
  assert.ok(moduleYaml.name, 'name field must be present');
  assert.strictEqual(moduleYaml.name, 'MA-Agents Skills & Agents');
});

test('module.yaml has description field', () => {
  assert.ok(moduleYaml.description, 'description field must be present');
  assert.strictEqual(
    moduleYaml.description,
    'Enterprise methodology enforcement, specialized agents, and operational workflows'
  );
});

test('module.yaml has extends-module: bmm', () => {
  assert.strictEqual(moduleYaml['extends-module'], 'bmm', 'extends-module must be bmm');
});

test('module.yaml has default_selected: false', () => {
  assert.strictEqual(moduleYaml['default_selected'], 'false', 'default_selected must be false');
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Task 2: skills/ directory structure
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n--- Task 2: skills/ directory ---');

const skillsDir = path.join(EXTENSION_DIR, 'skills');

test('skills/ directory exists', () => {
  assert.ok(fs.existsSync(skillsDir), 'skills/ directory must exist');
  assert.ok(fs.statSync(skillsDir).isDirectory(), 'skills/ must be a directory');
});

// Expected skill directories based on ACTUAL file inventory
const expectedAgentSkills = [
  'ma-agent-sre',
  'ma-agent-devops',
  'ma-agent-cyber',
  'ma-agent-sqa',
  // Note: ma-agent-mil498 retired in Epic 16 — MIL-STD-498 workflows absorbed into Gadi (ma-agent-sqa)
  // Story 22.2 renamed the bmad-ma-agent-* namespace to ma-agent-* to vacate the upstream-reserved bmad-* prefix.
  // Story 30.4 removed ma-agent-ml (Demerzel deprecated for new installs, FR244-FR247).
];

const expectedSqaSkills = [
  'sqa-audit',
  'sqa-ieee12207',
  'sqa-requirements-quality',
];

const expectedMil498Skills = [
  'mil498-sss', 'mil498-ssdd', 'mil498-ocd', 'mil498-sdp',
  'mil498-srs', 'mil498-sdd', 'mil498-std', 'mil498-requirement-quality',
];

const expectedSreSkills = [
  'sre-check-deployment-status', 'sre-check-secrets', 'sre-check-system-status',
  'sre-day-2-ops', 'sre-deployment-strategies', 'sre-fix-deployments',
  'sre-gitops-status',
];

const expectedDevopsSkills = [
  'devops-configure-infrastructure', 'devops-disconnected-deployment',
  'devops-docker-compose-setup', 'devops-manage-helm', 'devops-sign-docker-image',
];

const expectedCyberSkills = [
  'cyber-generate-certs', 'cyber-immunity-estimation', 'cyber-security-audit',
  'cyber-vault-secrets', 'cyber-verify-docker-users', 'cyber-verify-image-signature',
  'cyber-vulnerability-scan',
];

const expectedExtensionSkills = [
  'create-bug-story', 'bmad-dev-story', 'add-sprint', 'modify-sprint',
  'add-to-sprint', 'project-context-expansion', 'sprint-status-view',
  'cleanup-done', 'generate-backlog', 'prioritize-backlog', 'remove-from-sprint',
  'bmad-sprint-planning', 'bmad-sprint-status', 'close-sprint',
  // Story 29.1 — Knowledge Atlas skill entrypoint (BMAD-extension pipeline copy).
  'bmad-knowledge',
];

// Story 30.4: the 12 ml-* skills were removed along with ma-agent-ml
// (Demerzel deprecation, FR244-FR247). No expectedMlSkills list remains —
// see test/demerzel-ml-removal-drift.test.js for the removal guard.

const allExpectedSkills = [
  ...expectedAgentSkills,
  ...expectedMil498Skills,
  ...expectedSreSkills,
  ...expectedDevopsSkills,
  ...expectedCyberSkills,
  ...expectedExtensionSkills,
  ...expectedSqaSkills,
];

test('skills/ has exactly 50 subdirectories', () => {
  const entries = fs.readdirSync(skillsDir).filter(e =>
    fs.statSync(path.join(skillsDir, e)).isDirectory()
  );
  assert.strictEqual(entries.length, 50, `Expected 50 skill dirs, found ${entries.length}`);
});

test('all 4 agent skill directories exist', () => {
  for (const skill of expectedAgentSkills) {
    const p = path.join(skillsDir, skill);
    assert.ok(fs.existsSync(p), `Missing agent skill dir: ${skill}`);
  }
});

test('all 8 MIL-498 skill directories exist', () => {
  for (const skill of expectedMil498Skills) {
    const p = path.join(skillsDir, skill);
    assert.ok(fs.existsSync(p), `Missing MIL-498 skill dir: ${skill}`);
  }
});

test('all 7 SRE skill directories exist', () => {
  for (const skill of expectedSreSkills) {
    const p = path.join(skillsDir, skill);
    assert.ok(fs.existsSync(p), `Missing SRE skill dir: ${skill}`);
  }
});

test('all 5 DevOps skill directories exist', () => {
  for (const skill of expectedDevopsSkills) {
    const p = path.join(skillsDir, skill);
    assert.ok(fs.existsSync(p), `Missing DevOps skill dir: ${skill}`);
  }
});

test('all 7 Cyber skill directories exist', () => {
  for (const skill of expectedCyberSkills) {
    const p = path.join(skillsDir, skill);
    assert.ok(fs.existsSync(p), `Missing Cyber skill dir: ${skill}`);
  }
});

test('all 14 extension workflow skill directories exist', () => {
  for (const skill of expectedExtensionSkills) {
    const p = path.join(skillsDir, skill);
    assert.ok(fs.existsSync(p), `Missing extension skill dir: ${skill}`);
  }
});

test('all 3 SQA skill directories exist', () => {
  for (const skill of expectedSqaSkills) {
    const p = path.join(skillsDir, skill);
    assert.ok(fs.existsSync(p), `Missing SQA skill dir: ${skill}`);
  }
});

test('every skill directory contains a .gitkeep file', () => {
  for (const skill of allExpectedSkills) {
    const gk = path.join(skillsDir, skill, '.gitkeep');
    assert.ok(fs.existsSync(gk), `Missing .gitkeep in ${skill}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Task 3: module-help.csv validation
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n--- Task 3: skills/module-help.csv ---');

// Story 22.5 moved module-help.csv from lib/bmad-extension/ to lib/bmad-extension/skills/
// PluginResolver Strategy 1 requires module.yaml AND module-help.csv to live at
// the common parent of all skill directories.
const csvPath = path.join(SKILLS_DIR, 'module-help.csv');
const legacyCsvPath = path.join(EXTENSION_DIR, 'module-help.csv');

test('skills/module-help.csv exists (v6.3.0 canonical location)', () => {
  assert.ok(fs.existsSync(csvPath), 'skills/module-help.csv must exist');
});

test('legacy lib/bmad-extension/module-help.csv is removed (Story 22.5)', () => {
  assert.ok(
    !fs.existsSync(legacyCsvPath),
    'legacy module-help.csv must be removed — v6.3.0 uses skills/module-help.csv'
  );
});

let csvData = { headers: [], rows: [] };
test('module-help.csv is parseable', () => {
  const content = fs.readFileSync(csvPath, 'utf8');
  csvData = parseCsv(content);
  assert.ok(csvData.headers.length > 0, 'CSV must have headers');
  assert.ok(csvData.rows.length > 0, 'CSV must have data rows');
});

test('module-help.csv has correct header columns', () => {
  const expected = ['module', 'phase', 'name', 'code'];
  for (const col of expected) {
    assert.ok(csvData.headers.includes(col), `Missing header column: ${col}`);
  }
});

test('module-help.csv has 50 skill entries (excluding header)', () => {
  assert.strictEqual(csvData.rows.length, 50, `Expected 50 rows, found ${csvData.rows.length}`);
});

test('all CSV entries use module code ma-skills', () => {
  const moduleIdx = csvData.headers.indexOf('module');
  for (const row of csvData.rows) {
    assert.strictEqual(row[moduleIdx], 'ma-skills', `Row has wrong module: ${row[moduleIdx]}`);
  }
});

test('CSV has entries for all 4 agent skills', () => {
  const codeIdx = csvData.headers.indexOf('code');
  const codes = csvData.rows.map(r => r[codeIdx]);
  for (const skill of expectedAgentSkills) {
    assert.ok(codes.includes(skill), `Missing CSV entry for agent skill: ${skill}`);
  }
});

test('CSV has entries for all 3 SQA skills', () => {
  const codeIdx = csvData.headers.indexOf('code');
  const codes = csvData.rows.map(r => r[codeIdx]);
  for (const skill of expectedSqaSkills) {
    assert.ok(codes.includes(skill), `Missing CSV entry for SQA skill: ${skill}`);
  }
});

test('CSV has entries for all 8 MIL-498 skills', () => {
  const codeIdx = csvData.headers.indexOf('code');
  const codes = csvData.rows.map(r => r[codeIdx]);
  for (const skill of expectedMil498Skills) {
    assert.ok(codes.includes(skill), `Missing CSV entry for MIL-498 skill: ${skill}`);
  }
});

test('CSV has entries for all 7 SRE skills', () => {
  const codeIdx = csvData.headers.indexOf('code');
  const codes = csvData.rows.map(r => r[codeIdx]);
  for (const skill of expectedSreSkills) {
    assert.ok(codes.includes(skill), `Missing CSV entry for SRE skill: ${skill}`);
  }
});

test('CSV has entries for all 5 DevOps skills', () => {
  const codeIdx = csvData.headers.indexOf('code');
  const codes = csvData.rows.map(r => r[codeIdx]);
  for (const skill of expectedDevopsSkills) {
    assert.ok(codes.includes(skill), `Missing CSV entry for DevOps skill: ${skill}`);
  }
});

test('CSV has entries for all 7 Cyber skills', () => {
  const codeIdx = csvData.headers.indexOf('code');
  const codes = csvData.rows.map(r => r[codeIdx]);
  for (const skill of expectedCyberSkills) {
    assert.ok(codes.includes(skill), `Missing CSV entry for Cyber skill: ${skill}`);
  }
});

test('CSV has entries for all 15 extension workflow skills', () => {
  const codeIdx = csvData.headers.indexOf('code');
  const codes = csvData.rows.map(r => r[codeIdx]);
  for (const skill of expectedExtensionSkills) {
    assert.ok(codes.includes(skill), `Missing CSV entry for extension skill: ${skill}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Task 4: Directory state after Story 15.6 migration
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n--- Task 4: Directory state after Story 15.6 ---');

test('agents/ directory is empty or absent (Story 15.6 moved files to bmad-customize/)', () => {
  const agentsDir = path.join(EXTENSION_DIR, 'agents');
  if (fs.existsSync(agentsDir)) {
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.customize.yaml'));
    assert.strictEqual(files.length, 0, `agents/ must have 0 .customize.yaml files after 15.6, found ${files.length}`);
  }
  // If directory doesn't exist, that's also correct
});

test('workflows/ directory still exists', () => {
  const workflowsDir = path.join(EXTENSION_DIR, 'workflows');
  assert.ok(fs.existsSync(workflowsDir), 'workflows/ directory must be preserved');
  assert.ok(fs.statSync(workflowsDir).isDirectory(), 'workflows/ must be a directory');
});

test('workflows/ directory contains workflow subdirs', () => {
  const workflowsDir = path.join(EXTENSION_DIR, 'workflows');
  const dirs = fs.readdirSync(workflowsDir).filter(e =>
    fs.statSync(path.join(workflowsDir, e)).isDirectory()
  );
  assert.ok(dirs.length >= 6, `Expected at least 6 workflow dirs, found ${dirs.length}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Summary
// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (errors.length > 0) {
  console.error('\nFailures:');
  for (const { name, error } of errors) {
    console.error(`  ${name}: ${error}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
