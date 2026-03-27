#!/usr/bin/env node
/**
 * Tests for Story 15.5: Convert SRE/DevOps/Cyber/Extension Workflows to SKILL.md Packages
 *
 * Validates:
 * - All 25 skill folders exist under lib/bmad-extension/skills/
 * - Each folder contains SKILL.md and bmad-skill-manifest.yaml
 * - SKILL.md files have valid YAML frontmatter (name, description, type, triggers)
 * - bmad-skill-manifest.yaml files have correct structure (type, name, module)
 * - Workflow content is preserved verbatim (NFR32)
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

const SKILLS_DIR = path.join(__dirname, '..', 'lib', 'bmad-extension', 'skills');

// ─── Expected skill folders ─────────────────────────────────────────────────

const SRE_SKILLS = [
  'sre-check-deployment-status',
  'sre-check-secrets',
  'sre-check-system-status',
  'sre-day-2-ops',
  'sre-deployment-strategies',
  'sre-fix-deployments',
  'sre-gitops-status'
];

const DEVOPS_SKILLS = [
  'devops-configure-infrastructure',
  'devops-disconnected-deployment',
  'devops-docker-compose-setup',
  'devops-manage-helm',
  'devops-sign-docker-image'
];

const CYBER_SKILLS = [
  'cyber-generate-certs',
  'cyber-immunity-estimation',
  'cyber-security-audit',
  'cyber-vault-secrets',
  'cyber-verify-docker-users',
  'cyber-verify-image-signature',
  'cyber-vulnerability-scan'
];

const EXTENSION_SKILLS = [
  'add-sprint',
  'add-to-sprint',
  'create-bug-story',
  'modify-sprint',
  'project-context-expansion',
  'sprint-status-view'
];

const ALL_SKILLS = [...SRE_SKILLS, ...DEVOPS_SKILLS, ...CYBER_SKILLS, ...EXTENSION_SKILLS];

// ─── Helper: parse YAML frontmatter from SKILL.md ─────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const raw = match[1];
  const result = {};
  for (const line of raw.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.substring(0, colonIdx).trim();
    let value = line.substring(colonIdx + 1).trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

// ─── AC #1: Folder structure tests ─────────────────────────────────────────

console.log('\nAC #1-4 — Skill folder structure (25 skills)');

test('skills directory exists', () => {
  assert.ok(fs.existsSync(SKILLS_DIR), 'lib/bmad-extension/skills/ must exist');
});

test('exactly 25 skill folders exist', () => {
  const dirs = fs.readdirSync(SKILLS_DIR).filter(d =>
    fs.statSync(path.join(SKILLS_DIR, d)).isDirectory()
  );
  assert.strictEqual(dirs.length, 25, `Expected 25 skill folders, found ${dirs.length}: ${dirs.join(', ')}`);
});

test('7 SRE skill folders exist', () => {
  for (const skill of SRE_SKILLS) {
    assert.ok(fs.existsSync(path.join(SKILLS_DIR, skill)),
      `SRE skill folder missing: ${skill}`);
  }
});

test('5 DevOps skill folders exist', () => {
  for (const skill of DEVOPS_SKILLS) {
    assert.ok(fs.existsSync(path.join(SKILLS_DIR, skill)),
      `DevOps skill folder missing: ${skill}`);
  }
});

test('7 Cyber skill folders exist', () => {
  for (const skill of CYBER_SKILLS) {
    assert.ok(fs.existsSync(path.join(SKILLS_DIR, skill)),
      `Cyber skill folder missing: ${skill}`);
  }
});

test('6 Extension skill folders exist', () => {
  for (const skill of EXTENSION_SKILLS) {
    assert.ok(fs.existsSync(path.join(SKILLS_DIR, skill)),
      `Extension skill folder missing: ${skill}`);
  }
});

// ─── AC #1-4: File existence tests ─────────────────────────────────────────

console.log('\nFile existence — SKILL.md and bmad-skill-manifest.yaml');

for (const skill of ALL_SKILLS) {
  test(`${skill}/SKILL.md exists`, () => {
    assert.ok(fs.existsSync(path.join(SKILLS_DIR, skill, 'SKILL.md')),
      `SKILL.md missing in ${skill}/`);
  });

  test(`${skill}/bmad-skill-manifest.yaml exists`, () => {
    assert.ok(fs.existsSync(path.join(SKILLS_DIR, skill, 'bmad-skill-manifest.yaml')),
      `bmad-skill-manifest.yaml missing in ${skill}/`);
  });
}

// ─── Frontmatter format tests ──────────────────────────────────────────────

console.log('\nSKILL.md frontmatter validation');

for (const skill of ALL_SKILLS) {
  test(`${skill}/SKILL.md has valid frontmatter with name, description, type`, () => {
    const content = fs.readFileSync(path.join(SKILLS_DIR, skill, 'SKILL.md'), 'utf-8');
    assert.ok(content.startsWith('---'), `SKILL.md must start with --- frontmatter delimiter`);

    const fm = parseFrontmatter(content);
    assert.ok(fm, 'Frontmatter must be parseable');
    assert.strictEqual(fm.name, skill, `Frontmatter name must match folder name: expected "${skill}", got "${fm.name}"`);
    assert.ok(fm.description, 'Frontmatter must have description');
    assert.strictEqual(fm.type, 'skill', `Frontmatter type must be "skill", got "${fm.type}"`);
  });
}

// ─── Frontmatter triggers test ─────────────────────────────────────────────

console.log('\nSKILL.md triggers validation');

for (const skill of ALL_SKILLS) {
  test(`${skill}/SKILL.md has triggers section`, () => {
    const content = fs.readFileSync(path.join(SKILLS_DIR, skill, 'SKILL.md'), 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(fmMatch, 'Frontmatter must exist');
    assert.ok(fmMatch[1].includes('triggers:'), 'Frontmatter must include triggers section');
    assert.ok(fmMatch[1].includes('  - "'), 'Triggers must have at least one entry');
  });
}

// ─── Manifest validation ─────────────────────────────────────────────────

console.log('\nbmad-skill-manifest.yaml validation');

for (const skill of ALL_SKILLS) {
  test(`${skill}/bmad-skill-manifest.yaml has correct structure`, () => {
    const content = fs.readFileSync(path.join(SKILLS_DIR, skill, 'bmad-skill-manifest.yaml'), 'utf-8');
    assert.ok(content.includes('type: skill'), `Manifest must have type: skill`);
    assert.ok(content.includes(`name: ${skill}`), `Manifest must have name: ${skill}`);
    assert.ok(content.includes('module: ma-skills'), 'Manifest must have module: ma-skills');
  });
}

// ─── NFR32: Content preservation tests ─────────────────────────────────────

console.log('\nNFR32 — Workflow content preserved verbatim');

const SRE_SOURCE = path.join(__dirname, '..', 'lib', 'bmad-workflows', 'sre');
const DEVOPS_SOURCE = path.join(__dirname, '..', 'lib', 'bmad-workflows', 'devops');
const CYBER_SOURCE = path.join(__dirname, '..', 'lib', 'bmad-workflows', 'cyber');
const EXT_SOURCE = path.join(__dirname, '..', 'lib', 'bmad-extension', 'workflows');

/**
 * Normalize line endings to LF for cross-platform comparison.
 */
function normalizeLF(str) {
  return str.replace(/\r\n/g, '\n');
}

/**
 * Verify that the original workflow content appears verbatim in the SKILL.md
 * (after stripping the frontmatter header). Line endings are normalized to LF
 * since git on Windows may store CRLF while the Write tool produces LF.
 */
function verifyContentPreserved(sourceFile, skillName) {
  test(`${skillName} preserves original content verbatim`, () => {
    const original = normalizeLF(fs.readFileSync(sourceFile, 'utf-8')).trim();
    const skillContent = normalizeLF(fs.readFileSync(path.join(SKILLS_DIR, skillName, 'SKILL.md'), 'utf-8'));
    // Strip frontmatter
    const bodyMatch = skillContent.match(/^---\n[\s\S]*?\n---\n\n?([\s\S]*)$/);
    assert.ok(bodyMatch, 'SKILL.md must have frontmatter followed by body');
    const body = bodyMatch[1].trim();
    assert.strictEqual(body, original,
      `Content mismatch in ${skillName}: original length=${original.length}, body length=${body.length}`);
  });
}

// SRE content checks
const sreFiles = [
  ['check-deployment-status.md', 'sre-check-deployment-status'],
  ['check-secrets.md', 'sre-check-secrets'],
  ['check-system-status.md', 'sre-check-system-status'],
  ['day-2-ops.md', 'sre-day-2-ops'],
  ['deployment-strategies.md', 'sre-deployment-strategies'],
  ['fix-deployments.md', 'sre-fix-deployments'],
  ['gitops-status.md', 'sre-gitops-status']
];
for (const [file, skill] of sreFiles) {
  verifyContentPreserved(path.join(SRE_SOURCE, file), skill);
}

// DevOps content checks
const devopsFiles = [
  ['configure-infrastructure.md', 'devops-configure-infrastructure'],
  ['disconnected-deployment.md', 'devops-disconnected-deployment'],
  ['docker-compose-setup.md', 'devops-docker-compose-setup'],
  ['manage-helm.md', 'devops-manage-helm'],
  ['sign-docker-image.md', 'devops-sign-docker-image']
];
for (const [file, skill] of devopsFiles) {
  verifyContentPreserved(path.join(DEVOPS_SOURCE, file), skill);
}

// Cyber content checks
const cyberFiles = [
  ['generate-certs.md', 'cyber-generate-certs'],
  ['immunity-estimation.md', 'cyber-immunity-estimation'],
  ['security-audit.md', 'cyber-security-audit'],
  ['vault-secrets.md', 'cyber-vault-secrets'],
  ['verify-docker-users.md', 'cyber-verify-docker-users'],
  ['verify-image-signature.md', 'cyber-verify-image-signature'],
  ['vulnerability-scan.md', 'cyber-vulnerability-scan']
];
for (const [file, skill] of cyberFiles) {
  verifyContentPreserved(path.join(CYBER_SOURCE, file), skill);
}

// Extension content checks
const extFiles = [
  ['add-sprint/workflow.md', 'add-sprint'],
  ['add-to-sprint/workflow.md', 'add-to-sprint'],
  ['create-bug-story/workflow.md', 'create-bug-story'],
  ['modify-sprint/workflow.md', 'modify-sprint'],
  ['project-context-expansion/workflow.md', 'project-context-expansion'],
  ['sprint-status-view/workflow.md', 'sprint-status-view']
];
for (const [file, skill] of extFiles) {
  verifyContentPreserved(path.join(EXT_SOURCE, file), skill);
}

// ─── No .gitkeep in skill directories ──────────────────────────────────────

console.log('\nNo .gitkeep files in skill directories');

test('no .gitkeep files exist in any skill directory', () => {
  for (const skill of ALL_SKILLS) {
    const gitkeep = path.join(SKILLS_DIR, skill, '.gitkeep');
    assert.ok(!fs.existsSync(gitkeep), `.gitkeep found in ${skill}/`);
  }
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailures:');
  for (const { name, error } of errors) {
    console.log(`  ${name}: ${error}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
