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
    displayName: 'Gadi',
    title: 'Software Quality Assurance & Standards Expert',
    skillNames: ['sqa-audit', 'sqa-ieee12207', 'sqa-requirements-quality'],
    oldPaths: ['bmm/workflows/sqa/', '_bmad/bmm/workflows/sqa/'],
    chatTopic: 'quality assurance',
    menuItemCount: 14 // MH, CH, AU, IC, RQ, GS, GD, GP, GO, SS, GT, SD, MR, DA
  }
  // Story 30.4 removed ma-agent-ml (Demerzel) — deprecated for new installs,
  // FR244-FR247. The ml-* skills it referenced (ml-ideation, ml-eda,
  // ml-architecture, ml-detailed-design, ml-techspec, ml-infra, ml-experiment,
  // ml-analysis, ml-hparam, ml-revision, ml-advise, ml-retrospective) were
  // removed along with it.
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

// ─── Critical Action 1 is pinned to the lib/agents.js registry ────────────────
// bug-ma-agent-personas-cite-a-manifest-path-that-is-never-created, AC 3.
//
// The three assertions above are PATH-AGNOSTIC: they check only that the
// substring 'Read the skills MANIFEST' appears. That is exactly how `bffe2bd`
// was able to strip the `sqa/` segment out of ma-agent-sqa's Critical Action 1
// while the suite stayed green, and the defect then survived until it was found
// by hand in a real install eighteen months later.
//
// These tests pin the FULL line and DERIVE the expected path from the registry
// in lib/agents.js rather than restating it, so the text and the registry can
// never disagree again. Coverage is every tree that ships a copy: the source
// bundle, the generated plugin mirror, and the committed .agents/ deployed tree.
console.log('\n Critical Action 1 pinned to lib/agents.js registry\n');

const { getAgentsByCategory } = require('../lib/agents');

const PERSONA_TREES = [
  { label: 'source', dir: path.join(PROJECT_ROOT, 'lib', 'bmad-extension', 'skills') },
  { label: 'plugin mirror', dir: path.join(PROJECT_ROOT, 'lib', 'bmad-extension-plugin', 'skills') },
  { label: '.agents mirror', dir: path.join(PROJECT_ROOT, '.agents', 'skills') },
];

// Derived, not restated: the registry's `bmad`-category agents each declare
// `_bmad/skills/<slug>`, and the persona that cites it is `ma-agent-<slug>`.
// If a registry skillsDir moves, the expected string moves with it.
const REGISTRY_SKILLS_DIRS = new Map(
  getAgentsByCategory('bmad').map(a => [`ma-agent-${path.posix.basename(a.skillsDir)}`, a])
);

/** Return the Nth numbered line of a SKILL.md's `## Critical Actions` block. */
function criticalActionLine(content, n) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex(l => /^##\s+Critical Actions\s*$/.test(l));
  if (start === -1) return null;
  const numbered = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    if (/^\s*\d+\.\s/.test(lines[i])) numbered.push(lines[i].trim());
  }
  return numbered[n - 1] ?? null;
}

test('lib/agents.js registers a skillsDir for every ma-agent-* persona under test', () => {
  const missing = AGENTS.map(a => a.folder).filter(f => !REGISTRY_SKILLS_DIRS.has(f));
  assert.deepStrictEqual(
    missing, [],
    `No lib/agents.js bmad-category registry entry maps to: ${missing.join(', ')}`
  );
});

for (const tree of PERSONA_TREES) {
  for (const agent of AGENTS) {
    test(`${agent.folder} (${tree.label}): Critical Action 1 matches its lib/agents.js skillsDir`, () => {
      const registryEntry = REGISTRY_SKILLS_DIRS.get(agent.folder);
      assert.ok(registryEntry, `No registry entry for ${agent.folder}`);

      const skillMdPath = path.join(tree.dir, agent.folder, 'SKILL.md');
      assert.ok(fs.existsSync(skillMdPath), `Missing ${skillMdPath}`);

      const actual = criticalActionLine(fs.readFileSync(skillMdPath, 'utf8'), 1);
      const expected =
        `1. Read the skills MANIFEST at {project-root}/${registryEntry.skillsDir}/MANIFEST.yaml if it exists`;

      assert.strictEqual(
        actual, expected,
        `Critical Action 1 does not match registry entry '${registryEntry.id}' ` +
        `(skillsDir: '${registryEntry.skillsDir}')\n` +
        `      expected: ${expected}\n` +
        `      actual:   ${actual}`
      );
    });
  }
}

// The ` if it exists` guard above is a suffix on STANDARD_CRITICAL_ACTIONS[0],
// so step 1 keeps classifying STANDARD. Step 2 is the fragile one: its
// conditional wording must still contain STANDARD_CRITICAL_ACTIONS[1]
// *verbatim*, because lib/bmad.js's isStandardCriticalAction matches with a
// case-sensitive `trimmed.includes()`. A lowercased `for` silently reclassifies
// every persona's step 2 as a user customization. Derived from the constant.
test('Critical Action 2 still contains STANDARD_CRITICAL_ACTIONS[1] verbatim in every tree', () => {
  const bmadSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'lib', 'bmad.js'), 'utf8');
  const block = bmadSrc.match(/const STANDARD_CRITICAL_ACTIONS = \[([\s\S]*?)\n\];/);
  assert.ok(block, 'Could not locate STANDARD_CRITICAL_ACTIONS in lib/bmad.js');

  const needles = [...block[1].matchAll(/'([^']*)'/g)].map(m => m[1]);
  assert.strictEqual(needles.length, 4, `Expected 4 standard critical actions, got ${needles.length}`);
  const alwaysLoadNeedle = needles[1];

  const offenders = [];
  for (const tree of PERSONA_TREES) {
    for (const agent of AGENTS) {
      const skillMdPath = path.join(tree.dir, agent.folder, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) continue;
      const line = criticalActionLine(fs.readFileSync(skillMdPath, 'utf8'), 2);
      if (line === null || !line.includes(alwaysLoadNeedle)) {
        offenders.push(`${tree.label}/${agent.folder}: ${line}`);
      }
    }
  }
  assert.deepStrictEqual(
    offenders, [],
    `Critical Action 2 would classify as CUSTOM (missing '${alwaysLoadNeedle}'):\n      ` +
    offenders.join('\n      ')
  );
});

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  errors.forEach(e => console.error(`  \u2717 ${e.name}: ${e.error}`));
  process.exit(1);
}
