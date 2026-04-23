#!/usr/bin/env node
/**
 * Tests for Story 15-3: Convert 5 Custom Agents to BMAD 6.2.0 Skill Folders
 * (Updated by Story 22.2 — skill IDs renamed from `bmad-ma-agent-*` to `ma-agent-*`
 *  to vacate the upstream-reserved `bmad-*` namespace.)
 *
 * Verifies:
 * - Each agent has SKILL.md and bmad-skill-manifest.yaml
 * - SKILL.md contains Persona, Menu, Critical Actions sections
 * - bmad-skill-manifest.yaml has all required fields
 * - Menu items reference new skill names (not old paths)
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.join(__dirname, '..');
const SKILLS_DIR = path.join(PROJECT_ROOT, 'lib', 'bmad-extension', 'skills');

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

// ─── Agent definitions ───────────────────────────────────────────────────────
const AGENTS = [
  {
    folder: 'ma-agent-sre',
    name: 'ma-agent-sre',
    displayName: 'Alex',
    title: 'SRE Agent',
    skillNames: ['sre-health-check', 'sre-fix-deployments', 'sre-performance-opt'],
    oldPaths: ['bmm/workflows/sre/', '_bmad/bmm/workflows/sre/'],
    chatTopic: 'reliability',
    menuItemCount: 6 // MH, CH, HC, FD, PO, DA
  },
  {
    folder: 'ma-agent-devops',
    name: 'ma-agent-devops',
    displayName: 'Amit',
    title: 'DevOps Agent',
    skillNames: ['devops-configure-infrastructure', 'devops-optimize-pipelines', 'devops-manage-helm'],
    oldPaths: ['bmm/workflows/devops/', '_bmad/bmm/workflows/devops/'],
    chatTopic: 'DevOps',
    menuItemCount: 6 // MH, CH, CO, PL, MH(helm), DA
  },
  {
    folder: 'ma-agent-cyber',
    name: 'ma-agent-cyber',
    displayName: 'Yael',
    title: 'Cyber Analyst',
    skillNames: ['cyber-vulnerability-scan', 'cyber-security-audit', 'cyber-threat-modeling'],
    oldPaths: ['bmm/workflows/cyber/', '_bmad/custom/workflows/cyber/'],
    chatTopic: 'security',
    menuItemCount: 6 // MH, CH, VS, SA, TM, DA
  },
  {
    folder: 'ma-agent-sqa',
    name: 'ma-agent-sqa',
    displayName: 'Gad',
    title: 'Software Quality Assurance & Standards Expert',
    skillNames: ['sqa-audit', 'sqa-ieee12207', 'sqa-requirements-quality'],
    oldPaths: ['bmm/workflows/sqa/', '_bmad/bmm/workflows/sqa/'],
    chatTopic: 'quality assurance',
    menuItemCount: 14 // MH, CH, AU, IC, RQ, GS, GD, GP, GO, SS, GT, SD, MR, DA
  },
  {
    folder: 'ma-agent-ml',
    name: 'ma-agent-ml',
    displayName: 'Demerzel',
    title: 'ML Scientist',
    skillNames: ['ml-ideation', 'ml-eda', 'ml-architecture', 'ml-detailed-design', 'ml-techspec', 'ml-infra', 'ml-experiment', 'ml-analysis', 'ml-hparam', 'ml-revision', 'ml-advise', 'ml-retrospective'],
    oldPaths: ['bmm/workflows/ml/', '_bmad/bmm/workflows/ml/'],
    chatTopic: 'Machine Learning',
    menuItemCount: 15 // MH, CH, MLI, MLE, MLA, MLD, MLS, MLNF, MLX, MLAN, MLH, MLR, MLAD, MLRT, DA
  }
];

const REQUIRED_MANIFEST_FIELDS = [
  'type', 'name', 'displayName', 'title', 'capabilities',
  'role', 'identity', 'communicationStyle', 'principles', 'module'
];

// ─── File existence tests ────────────────────────────────────────────────────
console.log('\n File existence tests\n');

for (const agent of AGENTS) {
  const skillDir = path.join(SKILLS_DIR, agent.folder);

  test(`${agent.folder}: SKILL.md exists`, () => {
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    assert.ok(fs.existsSync(skillMdPath), `Missing: ${skillMdPath}`);
  });

  test(`${agent.folder}: bmad-skill-manifest.yaml exists`, () => {
    const manifestPath = path.join(skillDir, 'bmad-skill-manifest.yaml');
    assert.ok(fs.existsSync(manifestPath), `Missing: ${manifestPath}`);
  });
}

// ─── SKILL.md content tests ─────────────────────────────────────────────────
console.log('\n SKILL.md content tests\n');

for (const agent of AGENTS) {
  const skillDir = path.join(SKILLS_DIR, agent.folder);
  const skillMdPath = path.join(skillDir, 'SKILL.md');

  let content = '';
  try {
    content = fs.readFileSync(skillMdPath, 'utf8');
  } catch (e) {
    // File not found — tests will fail naturally
  }

  test(`${agent.folder}: SKILL.md contains Persona section`, () => {
    assert.ok(content.includes('## Persona'), 'Missing ## Persona section');
  });

  test(`${agent.folder}: SKILL.md contains Menu section`, () => {
    assert.ok(content.includes('## Menu'), 'Missing ## Menu section');
  });

  test(`${agent.folder}: SKILL.md contains Critical Actions section`, () => {
    assert.ok(content.includes('## Critical Actions'), 'Missing ## Critical Actions section');
  });

  test(`${agent.folder}: SKILL.md contains Activation Sequence section`, () => {
    assert.ok(content.includes('## Activation Sequence'), 'Missing ## Activation Sequence section');
  });

  test(`${agent.folder}: SKILL.md contains agent display name (${agent.displayName})`, () => {
    assert.ok(content.includes(agent.displayName), `Missing display name: ${agent.displayName}`);
  });

  test(`${agent.folder}: SKILL.md contains Role field`, () => {
    assert.ok(content.includes('**Role:**'), 'Missing **Role:** field');
  });

  test(`${agent.folder}: SKILL.md contains Identity field`, () => {
    assert.ok(content.includes('**Identity:**'), 'Missing **Identity:** field');
  });

  test(`${agent.folder}: SKILL.md contains Communication Style field`, () => {
    assert.ok(content.includes('**Communication Style:**'), 'Missing **Communication Style:** field');
  });

  test(`${agent.folder}: SKILL.md contains Principles field`, () => {
    assert.ok(content.includes('**Principles:**'), 'Missing **Principles:** field');
  });

  // Verify menu references new skill names
  for (const skillName of agent.skillNames) {
    test(`${agent.folder}: Menu references skill "${skillName}"`, () => {
      assert.ok(content.includes(skillName), `Missing skill reference: ${skillName}`);
    });
  }

  // Verify NO old workflow paths remain in menu
  for (const oldPath of agent.oldPaths) {
    test(`${agent.folder}: No old path references "${oldPath}" in SKILL.md`, () => {
      assert.ok(!content.includes(oldPath), `Old path still referenced: ${oldPath}`);
    });
  }
}

// ─── bmad-skill-manifest.yaml content tests ──────────────────────────────────
console.log('\n bmad-skill-manifest.yaml content tests\n');

for (const agent of AGENTS) {
  const skillDir = path.join(SKILLS_DIR, agent.folder);
  const manifestPath = path.join(skillDir, 'bmad-skill-manifest.yaml');

  let content = '';
  try {
    content = fs.readFileSync(manifestPath, 'utf8');
  } catch (e) {
    // File not found — tests will fail naturally
  }

  // Parse simple YAML key-value pairs (no nested structures expected)
  const fields = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      fields[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }

  for (const field of REQUIRED_MANIFEST_FIELDS) {
    test(`${agent.folder}: manifest has required field "${field}"`, () => {
      assert.ok(fields[field], `Missing or empty field: ${field}`);
    });
  }

  test(`${agent.folder}: manifest type is "agent"`, () => {
    assert.strictEqual(fields.type, 'agent', `Expected type: agent, got: ${fields.type}`);
  });

  test(`${agent.folder}: manifest name matches "${agent.name}"`, () => {
    assert.strictEqual(fields.name, agent.name, `Expected name: ${agent.name}, got: ${fields.name}`);
  });

  test(`${agent.folder}: manifest displayName is "${agent.displayName}"`, () => {
    assert.strictEqual(fields.displayName, agent.displayName, `Expected displayName: ${agent.displayName}, got: ${fields.displayName}`);
  });

  test(`${agent.folder}: manifest module is "ma-skills"`, () => {
    assert.strictEqual(fields.module, 'ma-skills', `Expected module: ma-skills, got: ${fields.module}`);
  });
}

// ─── Cross-validation: Critical Actions match extension customize.yaml ────────
console.log('\n Critical Actions cross-validation\n');

for (const agent of AGENTS) {
  const skillDir = path.join(SKILLS_DIR, agent.folder);
  const skillMdPath = path.join(skillDir, 'SKILL.md');

  let content = '';
  try {
    content = fs.readFileSync(skillMdPath, 'utf8');
  } catch (e) {
    // File not found
  }

  test(`${agent.folder}: Critical Actions includes MANIFEST reading`, () => {
    assert.ok(content.includes('Read the skills MANIFEST'), 'Missing MANIFEST reading action');
  });

  test(`${agent.folder}: Critical Actions includes always_load skill reading`, () => {
    assert.ok(content.includes('always_load: true'), 'Missing always_load skill reading action');
  });

  test(`${agent.folder}: Critical Actions includes project-context check`, () => {
    assert.ok(content.includes('project-context.md'), 'Missing project-context check');
  });
}

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  errors.forEach(e => console.error(`  \u2717 ${e.name}: ${e.error}`));
  process.exit(1);
}
