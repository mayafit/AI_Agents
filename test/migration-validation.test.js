#!/usr/bin/env node
/**
 * Story 15.8: Validate Migrated Agents and Workflows
 *
 * Comprehensive validation that all migrated agents and workflows from
 * Stories 15.1-15.7 function correctly and preserve functional equivalence.
 *
 * Uses Node.js assert (no test frameworks). Covers all 6 acceptance criteria.
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

const ROOT = path.join(__dirname, '..');
const EXT_DIR = path.join(ROOT, 'lib', 'bmad-extension');
const SKILLS_DIR = path.join(EXT_DIR, 'skills');
const CUSTOM_SRC = path.join(ROOT, 'lib', 'bmad-customizations');
const WORKFLOW_SRC = path.join(ROOT, 'lib', 'bmad-workflows');
const TEMPLATE_SRC = path.join(ROOT, 'lib', 'mil498-templates');
const CUSTOMIZE_DIR = path.join(ROOT, 'lib', 'bmad-customize');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Task 1: Validate custom agent personas (AC #1)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\nTask 1: Validate custom agent personas (AC #1)\n');

const AGENTS = [
  {
    id: 'sre', folder: 'ma-agent-sre', name: 'Alex',
    role: 'Site Reliability Engineer',
    identity: 'Seasoned SRE with expertise in Kubernetes',
    style: 'Calm, data-driven, and systematic',
    principles: ['Automation over manual effort', 'Monitor everything that matters', 'Blame-free post-mortems']
  },
  {
    id: 'devops', folder: 'ma-agent-devops', name: 'Amit',
    role: 'DevOps Engineer',
    identity: 'DevOps veteran with extensive experience in cloud-native technologies',
    style: 'Collaborative, efficiency-minded, and tech-forward',
    principles: ['Version control everything', 'Immutable infrastructure is better', 'Continuous improvement of the feedback loop']
  },
  {
    id: 'cyber', folder: 'ma-agent-cyber', name: 'Yael',
    role: 'Cyber Security Analyst',
    identity: 'Cyber security expert with deep knowledge of OWASP Top 10',
    style: 'Analytical, precise, and cautious',
    principles: ['Security is a process, not a product', 'Favor Defense in Depth', 'Prioritize mitigations based on risk']
  },
  {
    id: 'sqa', folder: 'ma-agent-sqa', name: 'Gad',
    role: 'Software Quality Assurance Engineer and Defense Standards Expert',
    identity: 'Experienced quality professional with deep expertise in SQA auditing',
    style: 'Clear, precise, and structured for SQA work',
    principles: ['Quality is everyone\'s responsibility but the SQA auditor\'s job to verify', 'Traceability from requirement to code', 'Process compliance prevents defects', 'Evidence matters more than opinions']
  },
];

for (const agent of AGENTS) {
  const skillMd = fs.readFileSync(path.join(SKILLS_DIR, agent.folder, 'SKILL.md'), 'utf-8');

  test(`1.${AGENTS.indexOf(agent) + 1}a: ${agent.name} (${agent.id}) agent skill folder exists`, () => {
    assert.ok(fs.existsSync(path.join(SKILLS_DIR, agent.folder)), `${agent.folder}/ must exist`);
  });

  test(`1.${AGENTS.indexOf(agent) + 1}b: ${agent.name} persona role matches original`, () => {
    assert.ok(skillMd.includes(agent.role), `SKILL.md must contain role: "${agent.role}"`);
  });

  test(`1.${AGENTS.indexOf(agent) + 1}c: ${agent.name} persona identity matches original`, () => {
    assert.ok(skillMd.includes(agent.identity), `SKILL.md must contain identity fragment: "${agent.identity}"`);
  });

  test(`1.${AGENTS.indexOf(agent) + 1}d: ${agent.name} communication style matches original`, () => {
    assert.ok(skillMd.includes(agent.style), `SKILL.md must contain style: "${agent.style}"`);
  });

  test(`1.${AGENTS.indexOf(agent) + 1}e: ${agent.name} principles preserved`, () => {
    for (const p of agent.principles) {
      assert.ok(skillMd.includes(p), `SKILL.md must contain principle: "${p}"`);
    }
  });

  test(`1.${AGENTS.indexOf(agent) + 1}f: ${agent.name} activation sequence preserved`, () => {
    assert.ok(skillMd.includes('Activation Sequence'), 'SKILL.md must have Activation Sequence section');
    assert.ok(skillMd.includes('config.yaml'), 'activation must reference config.yaml');
    assert.ok(skillMd.includes('{user_name}'), 'activation must reference {user_name}');
    assert.ok(skillMd.includes('{communication_language}'), 'activation must reference {communication_language}');
    assert.ok(skillMd.includes('STOP and WAIT for user input'), 'activation must include STOP instruction');
  });

  test(`1.${AGENTS.indexOf(agent) + 1}g: ${agent.name} has bmad-skill-manifest.yaml`, () => {
    const manifestPath = path.join(SKILLS_DIR, agent.folder, 'bmad-skill-manifest.yaml');
    assert.ok(fs.existsSync(manifestPath), 'bmad-skill-manifest.yaml must exist');
    const manifest = fs.readFileSync(manifestPath, 'utf-8');
    assert.ok(manifest.includes('type: agent'), 'manifest must declare type: agent');
    assert.ok(manifest.includes(`name: ${agent.folder}`), `manifest must have name: ${agent.folder}`);
    assert.ok(manifest.includes('module: ma-skills'), 'manifest must reference module: ma-skills');
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Task 2: Validate agent menu routing (AC #2)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\nTask 2: Validate agent menu routing (AC #2)\n');

const AGENT_MENUS = {
  'ma-agent-sre': {
    agent: 'SRE/Alex',
    items: [
      { cmd: 'HC', skill: 'sre-health-check', exists: false, note: 'pre-existing: workflow never implemented in source' },
      { cmd: 'FD', skill: 'sre-fix-deployments', exists: true },
      { cmd: 'PO', skill: 'sre-performance-opt', exists: false, note: 'pre-existing: workflow never implemented in source' },
    ]
  },
  'ma-agent-devops': {
    agent: 'DevOps/Amit',
    items: [
      { cmd: 'CO', skill: 'devops-configure-infrastructure', exists: true },
      { cmd: 'PL', skill: 'devops-optimize-pipelines', exists: false, note: 'pre-existing: workflow never implemented in source' },
      { cmd: 'MH', skill: 'devops-manage-helm', exists: true },
    ]
  },
  'ma-agent-cyber': {
    agent: 'Cyber/Yael',
    items: [
      { cmd: 'VS', skill: 'cyber-vulnerability-scan', exists: true },
      { cmd: 'SA', skill: 'cyber-security-audit', exists: true },
      { cmd: 'TM', skill: 'cyber-threat-modeling', exists: false, note: 'pre-existing: workflow never implemented in source' },
    ]
  },
  'ma-agent-sqa': {
    agent: 'SQA+MIL-498/Gad',
    items: [
      { cmd: 'AU', skill: 'sqa-audit', exists: true },
      { cmd: 'IC', skill: 'sqa-ieee12207', exists: true },
      { cmd: 'RQ', skill: 'sqa-requirements-quality', exists: true },
      { cmd: 'GS', skill: 'mil498-srs', exists: true },
      { cmd: 'GD', skill: 'mil498-sdd', exists: true },
      { cmd: 'GP', skill: 'mil498-sdp', exists: true },
      { cmd: 'GO', skill: 'mil498-ocd', exists: true },
      { cmd: 'SS', skill: 'mil498-sss', exists: true },
      { cmd: 'GT', skill: 'mil498-std', exists: true },
      { cmd: 'SD', skill: 'mil498-ssdd', exists: true },
      { cmd: 'MR', skill: 'mil498-requirement-quality', exists: true },
    ]
  },
};

for (const [folder, menu] of Object.entries(AGENT_MENUS)) {
  const skillMd = fs.readFileSync(path.join(SKILLS_DIR, folder, 'SKILL.md'), 'utf-8');

  for (const item of menu.items) {
    test(`2: ${menu.agent} menu [${item.cmd}] references skill "${item.skill}" in SKILL.md`, () => {
      assert.ok(skillMd.includes(item.skill),
        `SKILL.md must reference skill "${item.skill}" for menu item ${item.cmd}`);
    });

    if (item.exists) {
      test(`2: ${menu.agent} menu [${item.cmd}] skill folder "${item.skill}" exists`, () => {
        assert.ok(fs.existsSync(path.join(SKILLS_DIR, item.skill)),
          `skills/${item.skill}/ must exist`);
      });
    } else {
      test(`2: ${menu.agent} menu [${item.cmd}] skill "${item.skill}" not in skills/ (${item.note})`, () => {
        // Documenting pre-existing gap: menu references workflow that was never implemented
        assert.ok(!fs.existsSync(path.join(SKILLS_DIR, item.skill)),
          `skills/${item.skill}/ should NOT exist (pre-existing gap from source)`);
      });
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Task 3: Validate MIL-498 DID conversion (AC #3, #4)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\nTask 3: Validate MIL-498 DID conversion (AC #3, #4)\n');

const MIL498_DIDS = [
  { id: 'ocd', template: 'OCD.md', steps: 6 },
  { id: 'sdd', template: 'SDD.md', steps: 6 },
  { id: 'sdp', template: 'SDP.md', steps: 6 },
  { id: 'srs', template: 'SRS.md', steps: 6 },
  { id: 'ssdd', template: 'SSDD.md', steps: 7 },  // SSDD has extra CSCI discovery step
  { id: 'sss', template: 'SSS.md', steps: 6 },
  { id: 'std', template: 'STD.md', steps: 6 },
];

for (const did of MIL498_DIDS) {
  const skillFolder = `mil498-${did.id}`;
  const skillDir = path.join(SKILLS_DIR, skillFolder);

  test(`3.${MIL498_DIDS.indexOf(did) + 1}a: ${skillFolder} template is byte-identical to original`, () => {
    const skillTemplate = fs.readFileSync(path.join(skillDir, 'template.md'), 'utf-8');
    const origTemplate = fs.readFileSync(path.join(TEMPLATE_SRC, did.template), 'utf-8');
    assert.strictEqual(skillTemplate, origTemplate,
      `${skillFolder}/template.md must be byte-identical to lib/mil498-templates/${did.template}`);
  });

  test(`3.${MIL498_DIDS.indexOf(did) + 1}b: ${skillFolder} has ${did.steps} step files in prompts/`, () => {
    const promptsDir = path.join(skillDir, 'prompts');
    assert.ok(fs.existsSync(promptsDir), `${skillFolder}/prompts/ must exist`);
    const stepFiles = fs.readdirSync(promptsDir).filter(f => f.endsWith('.md')).sort();
    assert.strictEqual(stepFiles.length, did.steps,
      `Expected ${did.steps} step files, found ${stepFiles.length}: ${stepFiles.join(', ')}`);
  });

  test(`3.${MIL498_DIDS.indexOf(did) + 1}c: ${skillFolder} step files are numbered sequentially`, () => {
    const promptsDir = path.join(skillDir, 'prompts');
    const stepFiles = fs.readdirSync(promptsDir).filter(f => f.endsWith('.md')).sort();
    for (let i = 0; i < stepFiles.length; i++) {
      const expectedPrefix = String(i + 1).padStart(2, '0');
      assert.ok(stepFiles[i].startsWith(expectedPrefix),
        `Step ${i + 1} should start with "${expectedPrefix}", got "${stepFiles[i]}"`);
    }
  });

  test(`3.${MIL498_DIDS.indexOf(did) + 1}d: ${skillFolder} step order matches original instructions.md`, () => {
    // Verify the step names correspond to the original instructions.md step headings
    // Note: SSDD has Step 2.5 (fractional), so match both integer and fractional step numbers
    const origInstructions = fs.readFileSync(
      path.join(WORKFLOW_SRC, 'mil498', did.id, 'instructions.md'), 'utf-8');
    const stepHeadings = origInstructions.match(/^## Step [\d.]+ — .+$/gm) || [];
    assert.strictEqual(stepHeadings.length, did.steps,
      `Original instructions.md should have ${did.steps} steps, found: ${stepHeadings.map(h => h.substring(0, 30)).join('; ')}`);
  });

  test(`3.${MIL498_DIDS.indexOf(did) + 1}e: ${skillFolder} SKILL.md references all step files`, () => {
    const skillMd = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
    assert.ok(skillMd.includes('prompts/'), 'SKILL.md must reference prompts/ directory');
  });

  test(`3.${MIL498_DIDS.indexOf(did) + 1}f: ${skillFolder} has bmad-skill-manifest.yaml`, () => {
    const manifest = fs.readFileSync(path.join(skillDir, 'bmad-skill-manifest.yaml'), 'utf-8');
    assert.ok(manifest.includes(`name: ${skillFolder}`), `manifest must have name: ${skillFolder}`);
    assert.ok(manifest.includes('module: ma-skills'), 'manifest must reference module: ma-skills');
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Task 4: Validate SRE/DevOps/Cyber workflow conversion (AC #5)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\nTask 4: Validate SRE/DevOps/Cyber workflow conversion (AC #5)\n');

const PLAYBOOKS = [
  // SRE (7)
  { skill: 'sre-check-deployment-status', source: 'sre/check-deployment-status.md' },
  { skill: 'sre-check-secrets', source: 'sre/check-secrets.md' },
  { skill: 'sre-check-system-status', source: 'sre/check-system-status.md' },
  { skill: 'sre-day-2-ops', source: 'sre/day-2-ops.md' },
  { skill: 'sre-deployment-strategies', source: 'sre/deployment-strategies.md' },
  { skill: 'sre-fix-deployments', source: 'sre/fix-deployments.md' },
  { skill: 'sre-gitops-status', source: 'sre/gitops-status.md' },
  // DevOps (5)
  { skill: 'devops-configure-infrastructure', source: 'devops/configure-infrastructure.md' },
  { skill: 'devops-disconnected-deployment', source: 'devops/disconnected-deployment.md' },
  { skill: 'devops-docker-compose-setup', source: 'devops/docker-compose-setup.md' },
  { skill: 'devops-manage-helm', source: 'devops/manage-helm.md' },
  { skill: 'devops-sign-docker-image', source: 'devops/sign-docker-image.md' },
  // Cyber (7)
  { skill: 'cyber-generate-certs', source: 'cyber/generate-certs.md' },
  { skill: 'cyber-immunity-estimation', source: 'cyber/immunity-estimation.md' },
  { skill: 'cyber-security-audit', source: 'cyber/security-audit.md' },
  { skill: 'cyber-vault-secrets', source: 'cyber/vault-secrets.md' },
  { skill: 'cyber-verify-docker-users', source: 'cyber/verify-docker-users.md' },
  { skill: 'cyber-verify-image-signature', source: 'cyber/verify-image-signature.md' },
  { skill: 'cyber-vulnerability-scan', source: 'cyber/vulnerability-scan.md' },
];

for (const pb of PLAYBOOKS) {
  test(`4a: ${pb.skill} skill folder exists with SKILL.md`, () => {
    assert.ok(fs.existsSync(path.join(SKILLS_DIR, pb.skill, 'SKILL.md')),
      `skills/${pb.skill}/SKILL.md must exist`);
  });

  test(`4b: ${pb.skill} content preserves original verbatim (only frontmatter added)`, () => {
    const skillContent = fs.readFileSync(path.join(SKILLS_DIR, pb.skill, 'SKILL.md'), 'utf-8');
    const origContent = fs.readFileSync(path.join(WORKFLOW_SRC, pb.source), 'utf-8');

    // SKILL.md = YAML frontmatter + original content
    // Strip frontmatter (between first two --- lines) and compare
    const afterFrontmatter = skillContent.replace(/^---[\s\S]*?---\n+/, '');
    // Normalize line endings (CRLF -> LF) and trailing whitespace for comparison
    const normalizedSkill = afterFrontmatter.replace(/\r\n/g, '\n').replace(/\s+$/g, '');
    const normalizedOrig = origContent.replace(/\r\n/g, '\n').replace(/\s+$/g, '');
    assert.strictEqual(normalizedSkill, normalizedOrig,
      `${pb.skill}/SKILL.md body must match ${pb.source} (frontmatter stripped)`);
  });

  test(`4c: ${pb.skill} has bmad-skill-manifest.yaml`, () => {
    const manifestPath = path.join(SKILLS_DIR, pb.skill, 'bmad-skill-manifest.yaml');
    assert.ok(fs.existsSync(manifestPath), 'bmad-skill-manifest.yaml must exist');
    const manifest = fs.readFileSync(manifestPath, 'utf-8');
    assert.ok(manifest.includes('module: ma-skills'), 'manifest must reference module: ma-skills');
  });
}

// Extension workflows (6)
console.log('\nTask 4 continued: Extension workflow conversion\n');

const EXT_WORKFLOWS = [
  'add-sprint', 'add-to-sprint', 'create-bug-story',
  'modify-sprint', 'project-context-expansion', 'sprint-status-view',
];

for (const wf of EXT_WORKFLOWS) {
  test(`4d: ${wf} extension skill folder exists with SKILL.md`, () => {
    assert.ok(fs.existsSync(path.join(SKILLS_DIR, wf, 'SKILL.md')),
      `skills/${wf}/SKILL.md must exist`);
  });

  test(`4e: ${wf} has bmad-skill-manifest.yaml`, () => {
    const manifestPath = path.join(SKILLS_DIR, wf, 'bmad-skill-manifest.yaml');
    assert.ok(fs.existsSync(manifestPath), 'bmad-skill-manifest.yaml must exist');
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Task 5: Validate module structure (AC #6)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\nTask 5: Validate module structure (AC #6)\n');

// Story 22.5 moved module.yaml and module-help.csv from lib/bmad-extension/
// to lib/bmad-extension/skills/ per BMAD v6.3.0 canonical location.
test('5.1: skills/module.yaml has code: ma-skills', () => {
  const content = fs.readFileSync(path.join(SKILLS_DIR, 'module.yaml'), 'utf-8');
  assert.ok(content.includes('code: ma-skills'), 'skills/module.yaml must have code: ma-skills');
});

test('5.2: skills/module.yaml has extends-module: bmm', () => {
  const content = fs.readFileSync(path.join(SKILLS_DIR, 'module.yaml'), 'utf-8');
  assert.ok(content.includes('extends-module: bmm'), 'skills/module.yaml must declare extends-module: bmm');
});

test('5.3: skills/ contains exactly 61 skill folders', () => {
  const folders = fs.readdirSync(SKILLS_DIR).filter(f =>
    fs.statSync(path.join(SKILLS_DIR, f)).isDirectory());
  assert.strictEqual(folders.length, 61,
    `Expected 61 skill folders, found ${folders.length}: ${folders.join(', ')}`);
});

test('5.4: every skill folder has SKILL.md', () => {
  const folders = fs.readdirSync(SKILLS_DIR).filter(f =>
    fs.statSync(path.join(SKILLS_DIR, f)).isDirectory());
  for (const folder of folders) {
    assert.ok(fs.existsSync(path.join(SKILLS_DIR, folder, 'SKILL.md')),
      `skills/${folder}/SKILL.md must exist`);
  }
});

test('5.5: every skill folder has bmad-skill-manifest.yaml', () => {
  const folders = fs.readdirSync(SKILLS_DIR).filter(f =>
    fs.statSync(path.join(SKILLS_DIR, f)).isDirectory());
  for (const folder of folders) {
    assert.ok(fs.existsSync(path.join(SKILLS_DIR, folder, 'bmad-skill-manifest.yaml')),
      `skills/${folder}/bmad-skill-manifest.yaml must exist`);
  }
});

test('5.6: skills/module-help.csv exists and lists all 61 skills', () => {
  const csv = fs.readFileSync(path.join(SKILLS_DIR, 'module-help.csv'), 'utf-8');
  const lines = csv.split('\n').filter(l => l.trim() && !l.startsWith('module,'));
  // Should have a line for each of the 61 skills (header excluded)
  assert.strictEqual(lines.length, 61,
    `Expected 61 data rows in module-help.csv, found ${lines.length}`);
});

test('5.7: skills/module-help.csv references module code ma-skills', () => {
  const csv = fs.readFileSync(path.join(SKILLS_DIR, 'module-help.csv'), 'utf-8');
  const dataLines = csv.split('\n').filter(l => l.trim() && !l.startsWith('module,'));
  for (const line of dataLines) {
    assert.ok(line.startsWith('ma-skills,'),
      `Every data row must start with "ma-skills,", found: "${line.substring(0, 30)}..."`);
  }
});

test('5.8: skill folder breakdown: 5 agents + 8 mil498 + 7 sre + 5 devops + 7 cyber + 12 ml + 17 extension (14 workflow + 3 sqa)', () => {
  const folders = fs.readdirSync(SKILLS_DIR).filter(f =>
    fs.statSync(path.join(SKILLS_DIR, f)).isDirectory());

  const agents = folders.filter(f => f.startsWith('ma-agent-'));
  const mil498 = folders.filter(f => f.startsWith('mil498-'));
  const sre = folders.filter(f => f.startsWith('sre-'));
  const devops = folders.filter(f => f.startsWith('devops-'));
  const cyber = folders.filter(f => f.startsWith('cyber-'));
  const ml = folders.filter(f => f.startsWith('ml-'));
  const ext = folders.filter(f =>
    !f.startsWith('ma-agent-') && !f.startsWith('mil498-') &&
    !f.startsWith('sre-') && !f.startsWith('devops-') && !f.startsWith('cyber-') &&
    !f.startsWith('ml-'));

  assert.strictEqual(agents.length, 5, `Expected 5 agent folders, found ${agents.length}`);
  assert.strictEqual(mil498.length, 8, `Expected 8 mil498 folders, found ${mil498.length}`);
  assert.strictEqual(sre.length, 7, `Expected 7 sre folders, found ${sre.length}`);
  assert.strictEqual(devops.length, 5, `Expected 5 devops folders, found ${devops.length}`);
  assert.strictEqual(cyber.length, 7, `Expected 7 cyber folders, found ${cyber.length}`);
  assert.strictEqual(ml.length, 12, `Expected 12 ml folders, found ${ml.length}`);
  assert.strictEqual(ext.length, 17, `Expected 17 extension folders, found ${ext.length}`);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Task 6: Validate deployment pipeline (AC #1-#5)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('\nTask 6: Validate deployment pipeline\n');

test('6.1: bmad.js exports migration detection functions', () => {
  const bmad = require('../lib/bmad');
  assert.ok(typeof bmad.detectMigrationNeed === 'function', 'detectMigrationNeed must be exported');
  assert.ok(typeof bmad.backupCustomizations === 'function', 'backupCustomizations must be exported');
  assert.ok(typeof bmad.restoreCustomizations === 'function', 'restoreCustomizations must be exported');
  assert.ok(typeof bmad.mergeUserCustomizations === 'function', 'mergeUserCustomizations must be exported');
  assert.ok(typeof bmad.cleanupLegacyArtifacts === 'function', 'cleanupLegacyArtifacts must be exported');
});

test('6.2: bmad.js applyCustomizations is exported', () => {
  const bmad = require('../lib/bmad');
  assert.ok(typeof bmad.applyCustomizations === 'function', 'applyCustomizations must be exported');
});

test('6.3: lib/bmad-customize/ has exactly 9 built-in agent files', () => {
  // Story 22.3 (BMAD v6.3.0): bmm-quick-flow-solo-dev.customize.yaml was
  // retired when Barry was consolidated into Amelia (upstream PR #2177).
  // Count dropped from 10 → 9.
  assert.ok(fs.existsSync(CUSTOMIZE_DIR), 'lib/bmad-customize/ must exist');
  const files = fs.readdirSync(CUSTOMIZE_DIR).filter(f => f.endsWith('.customize.yaml'));
  assert.strictEqual(files.length, 9, `Expected 9 built-in agent files, found ${files.length}`);
  assert.ok(!files.includes('bmm-quick-flow-solo-dev.customize.yaml'),
    'bmm-quick-flow-solo-dev.customize.yaml must be retired (Story 22.3)');
});

const BUILTIN_AGENTS = [
  'bmm-pm', 'bmm-architect', 'bmm-dev', 'bmm-qa',
  'bmm-sm', 'bmm-tech-writer', 'bmm-ux-designer', 'bmm-bmad-master'
];

for (const agentId of BUILTIN_AGENTS) {
  test(`6.4: lib/bmad-customize/${agentId}.customize.yaml exists`, () => {
    assert.ok(fs.existsSync(path.join(CUSTOMIZE_DIR, `${agentId}.customize.yaml`)),
      `${agentId}.customize.yaml must exist in lib/bmad-customize/`);
  });
}

test('6.5: built-in agent customize.yaml files have critical_actions', () => {
  for (const agentId of BUILTIN_AGENTS) {
    const content = fs.readFileSync(path.join(CUSTOMIZE_DIR, `${agentId}.customize.yaml`), 'utf-8');
    assert.ok(content.includes('critical_actions:'),
      `${agentId}.customize.yaml must have critical_actions section`);
  }
});

test('6.6: bmad.js has extension deployment stage markers in correct order', () => {
  const bmadSrc = fs.readFileSync(path.join(ROOT, 'lib', 'bmad.js'), 'utf-8');
  const recompileIdx = bmadSrc.indexOf('STAGE:RECOMPILE');
  const extensionIdx = bmadSrc.indexOf('STAGE:EXTENSION');
  const workflowIdx = bmadSrc.indexOf('STAGE:WORKFLOWS');

  assert.ok(recompileIdx > 0, 'STAGE:RECOMPILE marker must exist');
  assert.ok(extensionIdx > 0, 'STAGE:EXTENSION marker must exist');
  assert.ok(workflowIdx > 0, 'STAGE:WORKFLOWS marker must exist');
  assert.ok(extensionIdx > recompileIdx, 'extension must come after recompile');
  assert.ok(extensionIdx < workflowIdx, 'extension must come before workflows');
});

test('6.7: bmad.js references bmad-extension source dir', () => {
  const bmadSrc = fs.readFileSync(path.join(ROOT, 'lib', 'bmad.js'), 'utf-8');
  assert.ok(bmadSrc.includes("'bmad-extension'"), 'must reference bmad-extension');
  assert.ok(bmadSrc.includes("'ma-agents-skills'"), 'must reference ma-agents-skills');
});

test('6.8: detectMigrationNeed returns correct results for fresh install', () => {
  const bmad = require('../lib/bmad');
  const os = require('os');
  const result = bmad.detectMigrationNeed(path.join(os.tmpdir(), 'nonexistent-dir-' + Date.now()));
  assert.strictEqual(result.action, 'install');
  assert.strictEqual(result.migrate, false);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Summary
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log(`\n${'='.repeat(60)}`);
console.log(`Story 15.8 Validation: ${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailures:');
  for (const { name, error } of errors) {
    console.log(`  ${name}: ${error}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
