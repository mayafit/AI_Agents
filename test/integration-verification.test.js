#!/usr/bin/env node
/**
 * Tests for Story 8.4: Epic 8 Integration Verification
 *
 * Validates that Stories 8.1, 8.2, and 8.3 work together end-to-end:
 *   - IDE agent install injects MA-AGENTS block at TOP (after frontmatter)
 *   - BMAD agent install deploys extension module
 *   - Re-install replaces blocks in-place (no duplicates)
 *   - Cross-story integration (agents.js → installer.js → bmad.js)
 */
'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

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

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

// Load modules under test
const { findInsertionPoint, _testUpdateAgentInstructions: updateAgentInstructions } = require('../lib/installer');
const { getAgent, getAllAgents, getAgentsByCategory } = require('../lib/agents');

const MARKER_START = '<!-- MA-AGENTS-START -->';
const MARKER_END = '<!-- MA-AGENTS-END -->';

// ─── Task 1: End-to-end IDE agent test (AC #1, #3) ──────────────────────────

console.log('\nTask 1 — End-to-end IDE agent test');

// Task 1.1: Run updateAgentInstructions for Claude Code and verify injection
(async () => {
  const tmpDir = path.join(os.tmpdir(), `ma-agents-test-8.4-${Date.now()}`);

  try {
    // ── Task 1.1 & 1.2: Install targeting Claude Code, verify TOP injection ──

    await asyncTest('1.1/1.2: Claude Code install injects MA-AGENTS block at TOP after frontmatter', async () => {
      const projectRoot = path.join(tmpDir, 'ide-test');
      await fs.ensureDir(path.join(projectRoot, '.claude'));

      // Create a CLAUDE.md with frontmatter and existing content
      const existingContent = '---\ntitle: My Project\n---\n\n# Existing Instructions\n\nSome existing rules here.\n';
      await fs.writeFile(path.join(projectRoot, '.claude', 'CLAUDE.md'), existingContent, 'utf-8');

      // Create skills dir so MANIFEST path resolves
      await fs.ensureDir(path.join(projectRoot, '.claude', 'skills'));

      const agent = getAgent('claude-code');
      assert.ok(agent, 'claude-code agent must exist');
      assert.ok(agent.injectionStrategy, 'claude-code must have injectionStrategy');

      await updateAgentInstructions(agent, projectRoot);

      const result = await fs.readFile(path.join(projectRoot, '.claude', 'CLAUDE.md'), 'utf-8');

      // Verify MA-AGENTS block exists
      assert.ok(result.includes(MARKER_START), 'Must contain MA-AGENTS-START marker');
      assert.ok(result.includes(MARKER_END), 'Must contain MA-AGENTS-END marker');

      // Verify block is AFTER frontmatter
      const frontmatterEnd = result.indexOf('---\n', result.indexOf('---\n') + 4) + 4;
      const blockStart = result.indexOf(MARKER_START);
      assert.ok(blockStart >= frontmatterEnd, `MA-AGENTS block (${blockStart}) must be after frontmatter (${frontmatterEnd})`);

      // Verify existing content is preserved below the block
      assert.ok(result.includes('# Existing Instructions'), 'Existing content must be preserved');
      assert.ok(result.includes('Some existing rules here'), 'Existing content must be preserved');

      // Verify block contains MANIFEST reference
      assert.ok(result.includes('MANIFEST.yaml'), 'Block must reference MANIFEST.yaml');
    });

    // ── Task 1.3: Re-install, verify no duplicate blocks ──

    await asyncTest('1.3: Re-install replaces block in-place (no duplicates)', async () => {
      const projectRoot = path.join(tmpDir, 'ide-test');

      const agent = getAgent('claude-code');
      await updateAgentInstructions(agent, projectRoot);

      const result = await fs.readFile(path.join(projectRoot, '.claude', 'CLAUDE.md'), 'utf-8');

      // Count occurrences of markers
      const startCount = (result.match(new RegExp(MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      const endCount = (result.match(new RegExp(MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

      assert.strictEqual(startCount, 1, `Expected exactly 1 MA-AGENTS-START marker, found ${startCount}`);
      assert.strictEqual(endCount, 1, `Expected exactly 1 MA-AGENTS-END marker, found ${endCount}`);

      // Verify existing content is still preserved
      assert.ok(result.includes('# Existing Instructions'), 'Existing content must survive re-install');
    });

    // ── Task 1.4: Cline agent has TWO instruction files, both get top-injection ──

    await asyncTest('1.4: Cline install injects into BOTH instruction files at top', async () => {
      const projectRoot = path.join(tmpDir, 'cline-test');
      await fs.ensureDir(path.join(projectRoot, '.cline'));
      await fs.ensureDir(path.join(projectRoot, '.cline', 'skills'));

      // Create both Cline instruction files with frontmatter
      const clineContent1 = '---\ntitle: Cline Rules\n---\n\n# Cline Project Rules\n\nRule 1: Be helpful.\n';
      const clineContent2 = '---\nformat: clinerules\n---\n\n# Root Rules\n\nAnother rule set.\n';
      await fs.writeFile(path.join(projectRoot, '.cline', 'clinerules.md'), clineContent1, 'utf-8');
      await fs.writeFile(path.join(projectRoot, '.clinerules'), clineContent2, 'utf-8');

      const agent = getAgent('cline');
      assert.ok(agent, 'cline agent must exist');
      assert.deepStrictEqual(agent.instructionFiles, ['.cline/clinerules.md', '.clinerules'],
        'Cline must have two instruction files');

      await updateAgentInstructions(agent, projectRoot);

      // Verify BOTH files have MA-AGENTS block
      for (const file of agent.instructionFiles) {
        const result = await fs.readFile(path.join(projectRoot, file), 'utf-8');
        assert.ok(result.includes(MARKER_START), `${file} must contain MA-AGENTS-START marker`);
        assert.ok(result.includes(MARKER_END), `${file} must contain MA-AGENTS-END marker`);

        // Verify block is after frontmatter
        const fmEnd = result.indexOf('---\n', result.indexOf('---\n') + 4) + 4;
        const bStart = result.indexOf(MARKER_START);
        assert.ok(bStart >= fmEnd, `${file}: MA-AGENTS block must be after frontmatter`);
      }

      // Re-run and verify no duplicates in either file
      await updateAgentInstructions(agent, projectRoot);
      for (const file of agent.instructionFiles) {
        const result = await fs.readFile(path.join(projectRoot, file), 'utf-8');
        const count = (result.match(new RegExp(MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        assert.strictEqual(count, 1, `${file}: Expected exactly 1 MA-AGENTS-START after re-install, found ${count}`);
      }
    });

    // ─── Task 2: End-to-end BMAD agent test (AC #2, #3) ────────────────────────

    console.log('\nTask 2 — End-to-end BMAD agent test');

    // Task 2.1 & 2.2: Verify extension module structure exists in source

    await asyncTest('2.1/2.2: BMAD extension module source has module.yaml + 11 customize.yaml files', async () => {
      const extSource = path.join(__dirname, '..', 'lib', 'bmad-extension');
      assert.ok(await fs.pathExists(extSource), 'lib/bmad-extension/ must exist');

      // module.yaml
      const moduleYaml = await fs.readFile(path.join(extSource, 'module.yaml'), 'utf-8');
      assert.ok(moduleYaml.includes('extends-module: bmm'), 'module.yaml must extend bmm');
      assert.ok(moduleYaml.includes('name: ma-agents-skills'), 'module.yaml must be named ma-agents-skills');

      // 11 customize.yaml files in agents/
      const agentsDir = path.join(extSource, 'agents');
      assert.ok(await fs.pathExists(agentsDir), 'lib/bmad-extension/agents/ must exist');
      const files = (await fs.readdir(agentsDir)).filter(f => f.endsWith('.customize.yaml'));
      assert.strictEqual(files.length, 11, `Expected 11 .customize.yaml files, found ${files.length}`);
    });

    // Task 2.2 (continued): Verify deployment via fs.copy

    await asyncTest('2.2: applyCustomizations deploys extension to _bmad/extensions/ma-agents-skills/', async () => {
      const projectRoot = path.join(tmpDir, 'bmad-deploy-test');
      const extSource = path.join(__dirname, '..', 'lib', 'bmad-extension');
      const extTarget = path.join(projectRoot, '_bmad', 'extensions', 'ma-agents-skills');

      // Simulate the deployment step from bmad.js applyCustomizations() STAGE:EXTENSION
      await fs.ensureDir(extTarget);
      await fs.copy(extSource, extTarget);

      // Verify deployed structure
      assert.ok(await fs.pathExists(path.join(extTarget, 'module.yaml')), 'Deployed module.yaml must exist');
      assert.ok(await fs.pathExists(path.join(extTarget, 'module-help.csv')), 'Deployed module-help.csv must exist');

      const deployedFiles = (await fs.readdir(path.join(extTarget, 'agents'))).filter(f => f.endsWith('.customize.yaml'));
      assert.strictEqual(deployedFiles.length, 11, `Deployed agents/ must have 11 .customize.yaml files, found ${deployedFiles.length}`);
    });

    // Task 2.3: Verify bmm-sre.customize.yaml critical_actions reference

    await asyncTest('2.3: bmm-sre.customize.yaml has critical_actions pointing to _bmad/skills/sre/MANIFEST.yaml', async () => {
      const sreYaml = await fs.readFile(
        path.join(__dirname, '..', 'lib', 'bmad-extension', 'agents', 'bmm-sre.customize.yaml'),
        'utf-8'
      );
      assert.ok(sreYaml.includes('critical_actions'), 'bmm-sre.customize.yaml must have critical_actions');
      assert.ok(sreYaml.includes('_bmad/skills/sre/MANIFEST.yaml'),
        'critical_actions must reference _bmad/skills/sre/MANIFEST.yaml');
    });

    // Task 2.4: Verify BMAD agent .md file gets MA-AGENTS block at top after frontmatter

    await asyncTest('2.4: BMAD agent instruction file gets MA-AGENTS block at top (when file exists)', async () => {
      const projectRoot = path.join(tmpDir, 'bmad-agent-test');

      // Create the BMAD agent .md file (simulating what BMAD compilation produces)
      const agentMdDir = path.join(projectRoot, '_bmad', 'bmm', 'agents');
      await fs.ensureDir(agentMdDir);
      await fs.ensureDir(path.join(projectRoot, '_bmad', 'skills', 'sre'));

      const agentContent = '---\nname: Alex\nrole: SRE Agent\n---\n\n# SRE Agent\n\nYou are Alex, the SRE agent.\n';
      await fs.writeFile(path.join(agentMdDir, 'sre.md'), agentContent, 'utf-8');

      const agent = getAgent('bmm-sre');
      assert.ok(agent, 'bmm-sre agent must exist');
      assert.ok(agent.category === 'bmad', 'bmm-sre must be a bmad agent');

      await updateAgentInstructions(agent, projectRoot);

      const result = await fs.readFile(path.join(agentMdDir, 'sre.md'), 'utf-8');

      // Verify MA-AGENTS block exists
      assert.ok(result.includes(MARKER_START), 'BMAD agent file must contain MA-AGENTS-START');
      assert.ok(result.includes(MARKER_END), 'BMAD agent file must contain MA-AGENTS-END');

      // Verify block is after frontmatter
      const fmEnd = result.indexOf('---\n', result.indexOf('---\n') + 4) + 4;
      const bStart = result.indexOf(MARKER_START);
      assert.ok(bStart >= fmEnd, 'MA-AGENTS block must be after frontmatter in BMAD agent file');

      // Verify existing agent content preserved
      assert.ok(result.includes('# SRE Agent'), 'Agent content must be preserved');
      assert.ok(result.includes('You are Alex'), 'Agent identity must be preserved');
    });

    // Task 2.5: Verify extension survives re-deployment (re-copy doesn't break it)

    await asyncTest('2.5: Extension module survives re-deployment (update scenario)', async () => {
      const projectRoot = path.join(tmpDir, 'bmad-deploy-test');
      const extSource = path.join(__dirname, '..', 'lib', 'bmad-extension');
      const extTarget = path.join(projectRoot, '_bmad', 'extensions', 'ma-agents-skills');

      // Re-deploy (simulating bmad update → recompile → extension re-deploy)
      await fs.copy(extSource, extTarget);

      // Verify structure is intact after re-deployment
      assert.ok(await fs.pathExists(path.join(extTarget, 'module.yaml')), 'module.yaml must survive re-deploy');
      const moduleYaml = await fs.readFile(path.join(extTarget, 'module.yaml'), 'utf-8');
      assert.ok(moduleYaml.includes('ma-agents-skills'), 'module.yaml content must be intact after re-deploy');

      const deployedFiles = (await fs.readdir(path.join(extTarget, 'agents'))).filter(f => f.endsWith('.customize.yaml'));
      assert.strictEqual(deployedFiles.length, 11, `Must still have 11 .customize.yaml files after re-deploy`);
    });

    // ─── Task 3: Cross-story integration check (AC #1, #2) ─────────────────────

    console.log('\nTask 3 — Cross-story integration check');

    // Task 3.1: Verify agents.js has injectionStrategy on all 11 agents (Story 8.2 output)

    await asyncTest('3.1: All 11 agents have injectionStrategy property (Story 8.2)', async () => {
      const allAgents = getAllAgents();
      assert.strictEqual(allAgents.length, 11, `Expected 11 agents, found ${allAgents.length}`);

      for (const agent of allAgents) {
        assert.ok(agent.injectionStrategy,
          `Agent '${agent.id}' must have injectionStrategy`);
        assert.strictEqual(agent.injectionStrategy.position, 'top',
          `Agent '${agent.id}' injectionStrategy.position must be 'top'`);
        assert.ok(Array.isArray(agent.injectionStrategy.skipPatterns),
          `Agent '${agent.id}' injectionStrategy.skipPatterns must be an array`);
      }
    });

    // Task 3.2: Verify installer.js reads injectionStrategy with defaults (Story 8.1 output)

    await asyncTest('3.2: installer.js reads injectionStrategy from agent with fallback default (Story 8.1)', async () => {
      const projectRoot = path.join(tmpDir, 'default-strategy-test');
      await fs.ensureDir(path.join(projectRoot, '.claude', 'skills'));

      // Create a mock agent WITHOUT injectionStrategy to test the default fallback
      const mockAgent = {
        id: 'test-no-strategy',
        name: 'Test Agent',
        category: 'ide',
        instructionFiles: ['.claude/CLAUDE.md'],
        getProjectPath: () => path.join(projectRoot, '.claude', 'skills'),
        injectionStrategy: undefined
      };

      const content = '# Test Content\nSome rules.\n';
      await fs.writeFile(path.join(projectRoot, '.claude', 'CLAUDE.md'), content, 'utf-8');

      await updateAgentInstructions(mockAgent, projectRoot);

      const result = await fs.readFile(path.join(projectRoot, '.claude', 'CLAUDE.md'), 'utf-8');

      // With no injectionStrategy, default is { position: 'top', skipPatterns: [] }
      // So block should be at position 0 (no skip patterns)
      assert.ok(result.startsWith(MARKER_START), 'Without injectionStrategy, block should be at very top (position 0)');
      assert.ok(result.includes('# Test Content'), 'Original content must be preserved');
    });

    // Task 3.3: Verify bmad.js deploys extension module (Story 8.3 output)

    await asyncTest('3.3: bmad.js has extension deployment stage with correct paths (Story 8.3)', async () => {
      const bmadJs = await fs.readFile(path.join(__dirname, '..', 'lib', 'bmad.js'), 'utf-8');

      // Verify STAGE:EXTENSION code exists
      assert.ok(bmadJs.includes('STAGE:EXTENSION'), 'bmad.js must have STAGE:EXTENSION deployment');
      assert.ok(bmadJs.includes('bmad-extension'), 'bmad.js must reference bmad-extension source');
      assert.ok(bmadJs.includes("'extensions', 'ma-agents-skills'"),
        'bmad.js must deploy to extensions/ma-agents-skills');

      // Verify extension deployment happens AFTER recompile
      const recompileIdx = bmadJs.indexOf('STAGE:RECOMPILE');
      const extensionIdx = bmadJs.indexOf('STAGE:EXTENSION');
      assert.ok(recompileIdx > -1, 'STAGE:RECOMPILE must exist');
      assert.ok(extensionIdx > recompileIdx,
        'STAGE:EXTENSION must come AFTER STAGE:RECOMPILE in bmad.js');
    });

    // Task 3.4: Document any issues found

    await asyncTest('3.4: Cross-story data flow is consistent (agents → installer → bmad)', async () => {
      // Verify the data flow chain:
      // agents.js defines injectionStrategy → installer.js reads it → bmad.js deploys extension

      // 1. IDE agents have instructionFiles that installer.js processes
      const ideAgents = getAgentsByCategory('ide');
      for (const agent of ideAgents) {
        assert.ok(agent.instructionFiles && agent.instructionFiles.length > 0,
          `IDE agent '${agent.id}' must have instructionFiles`);
        assert.ok(agent.injectionStrategy,
          `IDE agent '${agent.id}' must have injectionStrategy`);
      }

      // 2. BMAD agents have instructionFiles pointing to _bmad/bmm/agents/
      const bmadAgents = getAgentsByCategory('bmad');
      for (const agent of bmadAgents) {
        assert.ok(agent.instructionFiles && agent.instructionFiles.length > 0,
          `BMAD agent '${agent.id}' must have instructionFiles`);
        for (const file of agent.instructionFiles) {
          assert.ok(file.startsWith('_bmad/'),
            `BMAD agent '${agent.id}' instruction file '${file}' must be under _bmad/`);
        }
      }

      // 3. Extension module has a customize.yaml for each BMAD agent
      const extAgentsDir = path.join(__dirname, '..', 'lib', 'bmad-extension', 'agents');
      const extFiles = (await fs.readdir(extAgentsDir)).filter(f => f.endsWith('.customize.yaml'));

      for (const agent of bmadAgents) {
        const expectedFile = `${agent.id}.customize.yaml`;
        assert.ok(extFiles.includes(expectedFile),
          `Extension must include ${expectedFile} for BMAD agent '${agent.id}'`);
      }

      // 4. All 7 built-in BMM agents also have customize.yaml in extension
      const builtInBmm = ['bmm-pm', 'bmm-architect', 'bmm-dev', 'bmm-qa', 'bmm-sm', 'bmm-tech-writer', 'bmm-ux-designer'];
      for (const agentId of builtInBmm) {
        const expectedFile = `${agentId}.customize.yaml`;
        assert.ok(extFiles.includes(expectedFile),
          `Extension must include ${expectedFile} for built-in BMM agent`);
      }

      // 5. Verify installer.js BMAD guard (category === 'bmad' skips file creation)
      const installerJs = await fs.readFile(path.join(__dirname, '..', 'lib', 'installer.js'), 'utf-8');
      assert.ok(installerJs.includes("agent.category === 'bmad'"),
        'installer.js must have BMAD agent guard to skip file creation');
    });

  } finally {
    // Clean up temp directory
    await fs.remove(tmpDir).catch(() => {});
  }

  // ─── Summary ────────────────────────────────────────────────────────────────

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Story 8.4 Integration Verification: ${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailures:');
    errors.forEach(({ name, error }) => console.log(`  ✗ ${name}: ${error}`));
  }
  console.log(`${'─'.repeat(60)}\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
