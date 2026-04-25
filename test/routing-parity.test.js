#!/usr/bin/env node
/**
 * Routing-parity regression test (F2b).
 *
 * Asserts that the five flagship IDE tools (claude-code, copilot, cline,
 * roo-code, kilocode) all route ma-agent persona skills to the SAME tree
 * the bmad-method 6.3.0 PluginResolver writes into.
 *
 * The bug this guards against:
 *   Pre-F2b, ma-agents declared copilot's `skillsDir` as
 *   `.github/copilot/skills` while bmad-method 6.3.0 wrote `github-copilot`
 *   plugin skills (including the five `ma-agent-*` personas) into
 *   `.github/skills`. The two writers landed in different trees, so the
 *   personas appeared "missing" for copilot.
 *
 * What this test checks:
 *   1. Every flagship tool's ma-agents `skillsDir` is byte-identical to
 *      the bmad-method `target_dir` resolved from
 *      `node_modules/bmad-method/tools/installer/ide/platform-codes.yaml`
 *      via the agent's `bmadPlatformCode` (defaults to the ma-agents id
 *      when no override is set).
 *   2. The `PERSONA_SKILL_IDS` source-of-truth list contains the five
 *      `ma-agent-*` skill directory names that the smoke verifier checks.
 *   3. Every persona is present under
 *      `lib/bmad-extension/skills/<persona>/SKILL.md` so a clean build
 *      will route all five into every flagship tool's tree.
 *
 * The test does NOT execute a real install — that is the smoke
 * verifier's job (`.github/scripts/multi-tool-smoke-verify.sh`). This is
 * a fast unit-level guard so a future contributor cannot reintroduce
 * the routing-divergence bug by editing `lib/agents.js` in isolation.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const PROJECT_ROOT = path.join(__dirname, '..');
const BMAD_PLATFORM_CODES_YAML = path.join(
  PROJECT_ROOT,
  'node_modules',
  'bmad-method',
  'tools',
  'installer',
  'ide',
  'platform-codes.yaml'
);
const EXTENSION_SKILLS_DIR = path.join(
  PROJECT_ROOT,
  'lib',
  'bmad-extension',
  'skills'
);

// Single source of truth for the five ma-agents persona skill directories.
// MUST stay in sync with `.github/scripts/multi-tool-smoke-verify.sh`'s
// `PERSONAS` array and `lib/bmad.js`'s on-prem prefix mapping.
const PERSONA_SKILL_IDS = Object.freeze([
  'ma-agent-cyber',
  'ma-agent-devops',
  'ma-agent-sre',
  'ma-agent-sqa',
  'ma-agent-ml',
]);

// Flagship tools — the matrix that the multi-tool-smoke workflow runs.
// MUST stay in sync with `.github/workflows/multi-tool-smoke.yml`'s
// matrix.tool list. A new entry here without a matrix entry (or vice
// versa) means the safety net has a hole.
const FLAGSHIP_TOOL_IDS = Object.freeze([
  'claude-code',
  'copilot',
  'cline',
  'roo-code',
  'kilocode',
]);

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

const { getAgent, getBmadPlatformCode } = require('../lib/agents');

// Load bmad-method's platform-codes.yaml so we can compare each flagship's
// ma-agents `skillsDir` against bmad-method's authoritative target_dir.
let bmadPlatforms;
try {
  const yamlText = fs.readFileSync(BMAD_PLATFORM_CODES_YAML, 'utf-8');
  const doc = yaml.load(yamlText);
  if (!doc || typeof doc !== 'object' || !doc.platforms) {
    throw new Error('platform-codes.yaml has no `platforms` map');
  }
  bmadPlatforms = doc.platforms;
} catch (err) {
  console.error(`FATAL: cannot load bmad-method platform-codes.yaml — ${err.message}`);
  console.error('       Run `npm install` and re-run the test.');
  process.exit(1);
}

console.log('\nF2b routing-parity tests');

// ─── Test 1 — flagship tools all exist in lib/agents.js ────────────────────

test('1.1: every FLAGSHIP_TOOL_ID is registered in lib/agents.js', () => {
  for (const id of FLAGSHIP_TOOL_IDS) {
    const agent = getAgent(id);
    assert.ok(agent, `flagship tool '${id}' is not registered in lib/agents.js`);
    assert.strictEqual(
      agent.category,
      'ide',
      `flagship '${id}' must be category 'ide', got '${agent.category}'`
    );
  }
});

// ─── Test 2 — skillsDir parity with bmad-method's target_dir ───────────────

test(
  "2.1: every flagship's skillsDir matches bmad-method target_dir " +
    '(routing parity — F2b regression guard)',
  () => {
    const mismatches = [];
    for (const id of FLAGSHIP_TOOL_IDS) {
      const agent = getAgent(id);
      const platformCode = getBmadPlatformCode(id);
      const platform = bmadPlatforms[platformCode];
      if (!platform) {
        mismatches.push(
          `${id}: bmad-method has no platform '${platformCode}' (check bmadPlatformCode override in lib/agents.js)`
        );
        continue;
      }
      const target = platform.installer && platform.installer.target_dir;
      if (!target) {
        mismatches.push(
          `${id}: bmad-method platform '${platformCode}' has no installer.target_dir`
        );
        continue;
      }
      // Normalize both sides to forward slashes so the comparison is
      // OS-independent (lib/agents.js declares POSIX-style paths).
      const maAgentsDir = agent.skillsDir.replace(/\\/g, '/');
      const bmadTargetDir = target.replace(/\\/g, '/');
      if (maAgentsDir !== bmadTargetDir) {
        mismatches.push(
          `${id}: ma-agents skillsDir='${maAgentsDir}' but bmad-method target_dir='${bmadTargetDir}' for platform '${platformCode}'`
        );
      }
    }
    if (mismatches.length > 0) {
      throw new Error(
        'routing divergence detected — personas will land in a different tree than legacy ma-agents skills:\n  ' +
          mismatches.join('\n  ')
      );
    }
  }
);

// ─── Test 3 — persona source coverage ──────────────────────────────────────

test(
  '3.1: every PERSONA_SKILL_ID has a SKILL.md under lib/bmad-extension/skills/',
  () => {
    const missing = [];
    for (const id of PERSONA_SKILL_IDS) {
      const skillMd = path.join(EXTENSION_SKILLS_DIR, id, 'SKILL.md');
      if (!fs.existsSync(skillMd)) {
        missing.push(skillMd);
      }
    }
    if (missing.length > 0) {
      throw new Error(
        'persona source files missing — bundle build will not route them:\n  ' +
          missing.join('\n  ')
      );
    }
  }
);

test(
  "3.2: every PERSONA_SKILL_ID's bmad-skill-manifest.yaml declares type: agent",
  () => {
    const wrongType = [];
    for (const id of PERSONA_SKILL_IDS) {
      const manifestPath = path.join(
        EXTENSION_SKILLS_DIR,
        id,
        'bmad-skill-manifest.yaml'
      );
      if (!fs.existsSync(manifestPath)) {
        wrongType.push(`${id}: bmad-skill-manifest.yaml not found`);
        continue;
      }
      const doc = yaml.load(fs.readFileSync(manifestPath, 'utf-8'));
      if (!doc || doc.type !== 'agent') {
        wrongType.push(
          `${id}: expected type='agent', got type='${doc && doc.type}'`
        );
      }
    }
    if (wrongType.length > 0) {
      throw new Error(
        'persona manifests have wrong type (must be `type: agent` for BMAD plugin routing):\n  ' +
          wrongType.join('\n  ')
      );
    }
  }
);

// ─── Test 4 — smoke verifier and workflow agreement ────────────────────────

test(
  '4.1: multi-tool-smoke-verify.sh PERSONAS list matches PERSONA_SKILL_IDS',
  () => {
    const verifierPath = path.join(
      PROJECT_ROOT,
      '.github',
      'scripts',
      'multi-tool-smoke-verify.sh'
    );
    const text = fs.readFileSync(verifierPath, 'utf-8');
    const match = text.match(/^PERSONAS="([^"]+)"/m);
    if (!match) {
      throw new Error('PERSONAS="..." line not found in multi-tool-smoke-verify.sh');
    }
    const verifierSet = new Set(match[1].trim().split(/\s+/));
    const expectedSet = new Set(PERSONA_SKILL_IDS);
    const missing = [...expectedSet].filter((p) => !verifierSet.has(p));
    const extra = [...verifierSet].filter((p) => !expectedSet.has(p));
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        'PERSONAS drift between test and CI:\n' +
          (missing.length ? `  missing in verifier: ${missing.join(', ')}\n` : '') +
          (extra.length ? `  extra in verifier:   ${extra.join(', ')}` : '')
      );
    }
  }
);

test(
  '4.2: multi-tool-smoke.yml matrix tool ids match FLAGSHIP_TOOL_IDS',
  () => {
    const workflowPath = path.join(
      PROJECT_ROOT,
      '.github',
      'workflows',
      'multi-tool-smoke.yml'
    );
    const text = fs.readFileSync(workflowPath, 'utf-8');
    const matrixIds = [];
    const re = /-\s*\{\s*name:\s*([a-z0-9-]+)\s*,/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      matrixIds.push(m[1]);
    }
    if (matrixIds.length === 0) {
      throw new Error('could not parse any matrix tool ids from multi-tool-smoke.yml');
    }
    const matrixSet = new Set(matrixIds);
    const expectedSet = new Set(FLAGSHIP_TOOL_IDS);
    const missing = [...expectedSet].filter((p) => !matrixSet.has(p));
    const extra = [...matrixSet].filter((p) => !expectedSet.has(p));
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        'flagship-tool drift between test and CI matrix:\n' +
          (missing.length ? `  missing in workflow: ${missing.join(', ')}\n` : '') +
          (extra.length ? `  extra in workflow:   ${extra.join(', ')}` : '')
      );
    }
  }
);

test(
  "4.3: multi-tool-smoke.yml matrix skills_dir for each flagship matches lib/agents.js",
  () => {
    const workflowPath = path.join(
      PROJECT_ROOT,
      '.github',
      'workflows',
      'multi-tool-smoke.yml'
    );
    const text = fs.readFileSync(workflowPath, 'utf-8');
    // Match `- { name: foo, skills_dir: .bar/skills }` rows.
    const rowRe = /-\s*\{\s*name:\s*([a-z0-9-]+)\s*,\s*skills_dir:\s*([^\s}]+)/g;
    const matrix = {};
    let m;
    while ((m = rowRe.exec(text)) !== null) {
      matrix[m[1]] = m[2];
    }
    const drift = [];
    for (const id of FLAGSHIP_TOOL_IDS) {
      const agent = getAgent(id);
      const declared = agent.skillsDir.replace(/\\/g, '/');
      const matrixDir = matrix[id];
      if (!matrixDir) {
        drift.push(`${id}: missing from matrix`);
        continue;
      }
      if (matrixDir !== declared) {
        drift.push(
          `${id}: workflow skills_dir='${matrixDir}' but lib/agents.js skillsDir='${declared}'`
        );
      }
    }
    if (drift.length > 0) {
      throw new Error(
        'CI matrix and lib/agents.js disagree on skills_dir:\n  ' + drift.join('\n  ')
      );
    }
  }
);

// ─── Summary ───────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
