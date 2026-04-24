#!/usr/bin/env node
/**
 * F1a — On-Prem Persona Phase-Prefix Restoration
 *
 * Bug: bug-on-prem-persona-phase-prefix-feature-is-dead-code-after-stage-and-invoke
 *
 * Contract under test (applyOnPremPhasePrefixToDeployedSkills):
 *   1. On-prem profile → prefix block injected into every deployed persona
 *      SKILL.md across all tool skill-dirs (claude-code, copilot, cline,
 *      roo-code, kilocode).
 *   2. Standard profile → no-op (zero writes; zero prefix content anywhere).
 *   3. Idempotent — re-running replaces the marker block in place, byte-stable.
 *   4. Tool not installed → not touched (no directory is created).
 *   5. Persona skill not deployed for a tool → silent skip (do not invent
 *      SKILL.md files).
 *   6. Malformed source customize YAML → skip that persona only, don't crash.
 *   7. Source customize file missing → skip that persona only.
 *   8. Persona without on_prem_phase_prefix key → skip (the pass is opt-in).
 *   9. SKILL.md without YAML frontmatter → block prepended.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const {
    applyOnPremPhasePrefixToDeployedSkills,
    injectOnPremPrefixBlock,
    buildOnPremPrefixBlock,
    PERSONA_SKILL_MAP,
    TOOL_SKILL_DIRS,
    ON_PREM_PREFIX_MARKER_BEGIN,
    ON_PREM_PREFIX_MARKER_END,
} = require('../lib/bmad');

// ── Test harness ──────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const errors = [];

async function test(name, fn) {
    try {
        await fn();
        console.log(`  \u2713 ${name}`);
        passed++;
    } catch (err) {
        console.error(`  \u2717 ${name}: ${err.stack || err.message}`);
        failed++;
        errors.push({ name, error: err.message });
    }
}

function mktemp() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-f1a-'));
}

function cleanup(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

/**
 * Build a tmp project with realistic deployed SKILL.md files in each tool
 * skill-dir. Returns both the projectRoot and a customize-source override
 * (so we don't mutate the repo's lib/bmad-customize/ during testing).
 */
function buildFixture({ tools = TOOL_SKILL_DIRS, personas = Object.keys(PERSONA_SKILL_MAP), customizeOverrides = {} } = {}) {
    const projectRoot = mktemp();
    const customizeSrc = path.join(projectRoot, '.fixture-customize');
    fs.mkdirSync(customizeSrc, { recursive: true });

    // Write customize source YAML files. Use a fake but realistic prefix
    // text per persona so the test can uniquely identify each injection.
    for (const personaId of personas) {
        const override = customizeOverrides[personaId];
        if (override === 'SKIP') continue; // simulate missing source file
        const content = override !== undefined
            ? override
            : [
                `phase: planning`,
                `on_prem_phase_prefix: "/no_think prefix for ${personaId}"`,
                `critical_actions:`,
                `  - "existing action for ${personaId}"`,
                ``,
            ].join('\n');
        fs.writeFileSync(
            path.join(customizeSrc, `${personaId}.customize.yaml`),
            content,
            'utf8',
        );
    }

    // Write deployed SKILL.md for each (tool, persona) pair.
    for (const toolRel of tools) {
        const toolDir = path.join(projectRoot, toolRel);
        fs.mkdirSync(toolDir, { recursive: true });
        for (const personaId of personas) {
            if (customizeOverrides[personaId] === 'SKIP_DEPLOY') continue;
            const skillDirName = PERSONA_SKILL_MAP[personaId];
            const skillDir = path.join(toolDir, skillDirName);
            fs.mkdirSync(skillDir, { recursive: true });
            const skillMd = [
                `---`,
                `name: ${skillDirName}`,
                `description: Test persona for F1a.`,
                `---`,
                ``,
                `# Persona ${personaId}`,
                ``,
                `## Overview`,
                ``,
                `Original body content for ${personaId}.`,
                ``,
            ].join('\n');
            fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMd, 'utf8');
        }
    }

    return { projectRoot, customizeSrc };
}

function readSkill(projectRoot, toolRel, skillDirName) {
    return fs.readFileSync(
        path.join(projectRoot, toolRel, skillDirName, 'SKILL.md'),
        'utf8',
    );
}

// ── Tests ─────────────────────────────────────────────────────────────────
console.log('\n F1a — on-prem persona phase-prefix post-install pass\n');

async function runAll() {

    // 1. On-prem profile injects the prefix into every tool/persona pair.
    await test('on-prem install: prefix injected across all 5 tool skill-dirs for every persona', async () => {
        const { projectRoot, customizeSrc } = buildFixture();
        try {
            const results = await applyOnPremPhasePrefixToDeployedSkills(
                projectRoot, 'on-prem', customizeSrc,
            );
            const injected = results.filter(r => r.injected);
            // 5 tools × 8 personas = 40 injections
            const expected = TOOL_SKILL_DIRS.length * Object.keys(PERSONA_SKILL_MAP).length;
            assert.strictEqual(injected.length, expected,
                `expected ${expected} injections, got ${injected.length}`);

            // Spot-check one file per tool.
            for (const toolRel of TOOL_SKILL_DIRS) {
                const content = readSkill(projectRoot, toolRel, 'bmad-agent-pm');
                assert.ok(content.includes(ON_PREM_PREFIX_MARKER_BEGIN),
                    `${toolRel}: begin marker missing`);
                assert.ok(content.includes(ON_PREM_PREFIX_MARKER_END),
                    `${toolRel}: end marker missing`);
                assert.ok(content.includes('/no_think prefix for bmm-pm'),
                    `${toolRel}: prefix text missing`);
                // Original content preserved
                assert.ok(content.includes('Original body content for bmm-pm'),
                    `${toolRel}: original body dropped`);
                // Block placed after frontmatter
                const bodyStart = content.indexOf('\n---\n') + '\n---\n'.length;
                assert.ok(content.indexOf(ON_PREM_PREFIX_MARKER_BEGIN) > bodyStart,
                    `${toolRel}: block placed before/inside frontmatter`);
            }
        } finally { cleanup(projectRoot); }
    });

    // 2. Standard profile is a full no-op.
    await test('standard profile: no writes, no prefix anywhere (NFR44 parity)', async () => {
        const { projectRoot, customizeSrc } = buildFixture();
        try {
            const before = readSkill(projectRoot, '.claude/skills', 'bmad-agent-pm');
            const results = await applyOnPremPhasePrefixToDeployedSkills(
                projectRoot, 'standard', customizeSrc,
            );
            assert.deepStrictEqual(results, [],
                'standard profile must return empty result list');
            const after = readSkill(projectRoot, '.claude/skills', 'bmad-agent-pm');
            assert.strictEqual(after, before,
                'standard profile must not modify any file');
            // Global: no marker anywhere in the tree.
            for (const toolRel of TOOL_SKILL_DIRS) {
                const content = readSkill(projectRoot, toolRel, 'bmad-agent-architect');
                assert.ok(!content.includes(ON_PREM_PREFIX_MARKER_BEGIN),
                    `${toolRel}: marker leaked into standard-profile install`);
                assert.ok(!content.includes('/no_think'),
                    `${toolRel}: /no_think leaked into standard-profile install`);
            }
        } finally { cleanup(projectRoot); }
    });

    // 3. undefined profile (not yet resolved) is also a no-op.
    await test('undefined profile: treated as standard, no-op', async () => {
        const { projectRoot, customizeSrc } = buildFixture();
        try {
            const before = readSkill(projectRoot, '.claude/skills', 'bmad-agent-pm');
            const results = await applyOnPremPhasePrefixToDeployedSkills(
                projectRoot, undefined, customizeSrc,
            );
            assert.deepStrictEqual(results, [], 'undefined profile must be no-op');
            const after = readSkill(projectRoot, '.claude/skills', 'bmad-agent-pm');
            assert.strictEqual(after, before);
        } finally { cleanup(projectRoot); }
    });

    // 4. Idempotency — running twice produces byte-identical content.
    await test('idempotency: two consecutive on-prem passes produce byte-identical SKILL.md', async () => {
        const { projectRoot, customizeSrc } = buildFixture();
        try {
            await applyOnPremPhasePrefixToDeployedSkills(projectRoot, 'on-prem', customizeSrc);
            const afterFirst = readSkill(projectRoot, '.claude/skills', 'bmad-agent-pm');
            await applyOnPremPhasePrefixToDeployedSkills(projectRoot, 'on-prem', customizeSrc);
            const afterSecond = readSkill(projectRoot, '.claude/skills', 'bmad-agent-pm');
            assert.strictEqual(afterFirst, afterSecond,
                'second pass must not mutate the file (no prefix stacking)');
            // Ensure only ONE marker block exists.
            const beginCount = afterSecond.split(ON_PREM_PREFIX_MARKER_BEGIN).length - 1;
            const endCount = afterSecond.split(ON_PREM_PREFIX_MARKER_END).length - 1;
            assert.strictEqual(beginCount, 1, 'exactly one BEGIN marker expected');
            assert.strictEqual(endCount, 1, 'exactly one END marker expected');
        } finally { cleanup(projectRoot); }
    });

    // 5. Tool not installed → directory not created.
    await test('tool not installed: no tool skill-dir gets created', async () => {
        // Build fixture with ONLY claude-code; assert the other 4 dirs stay absent.
        const { projectRoot, customizeSrc } = buildFixture({
            tools: [path.join('.claude', 'skills')],
        });
        try {
            await applyOnPremPhasePrefixToDeployedSkills(projectRoot, 'on-prem', customizeSrc);
            for (const toolRel of TOOL_SKILL_DIRS) {
                if (toolRel === path.join('.claude', 'skills')) continue;
                assert.ok(!fs.existsSync(path.join(projectRoot, toolRel)),
                    `pass created ${toolRel} which the install did not`);
            }
            // Claude got injected.
            const claudePm = readSkill(projectRoot, '.claude/skills', 'bmad-agent-pm');
            assert.ok(claudePm.includes(ON_PREM_PREFIX_MARKER_BEGIN),
                '.claude/skills/bmad-agent-pm must still be injected');
        } finally { cleanup(projectRoot); }
    });

    // 6. Persona skill not deployed for a tool → silent skip.
    await test('persona skill missing in a tool: silent skip, no crash', async () => {
        const { projectRoot, customizeSrc } = buildFixture();
        try {
            // Remove one specific persona from one specific tool.
            const targetMissing = path.join(
                projectRoot, '.cline', 'skills', 'bmad-agent-pm',
            );
            fs.rmSync(targetMissing, { recursive: true, force: true });
            const results = await applyOnPremPhasePrefixToDeployedSkills(
                projectRoot, 'on-prem', customizeSrc,
            );
            // The remaining tools still got the pm prefix.
            const clauded = readSkill(projectRoot, '.claude/skills', 'bmad-agent-pm');
            assert.ok(clauded.includes(ON_PREM_PREFIX_MARKER_BEGIN));
            // .cline/bmad-agent-pm was NOT invented.
            assert.ok(!fs.existsSync(path.join(targetMissing, 'SKILL.md')),
                'pass invented a missing persona SKILL.md');
            // Results do not include an entry for the missing pair.
            const missingEntry = results.find(r =>
                r.tool === path.join('.cline', 'skills') &&
                r.persona === 'bmad-agent-pm');
            assert.strictEqual(missingEntry, undefined,
                'results should not include the missing pair');
        } finally { cleanup(projectRoot); }
    });

    // 7. Malformed source YAML → that persona skipped, others still injected.
    await test('malformed source YAML: skip that persona only', async () => {
        const { projectRoot, customizeSrc } = buildFixture({
            customizeOverrides: {
                'bmm-pm': 'phase: [unclosed\n', // invalid YAML
            },
        });
        try {
            const results = await applyOnPremPhasePrefixToDeployedSkills(
                projectRoot, 'on-prem', customizeSrc,
            );
            // bmm-pm was skipped; check a well-formed persona still got injected.
            const archContent = readSkill(projectRoot, '.claude/skills', 'bmad-agent-architect');
            assert.ok(archContent.includes(ON_PREM_PREFIX_MARKER_BEGIN),
                'architect should still have the prefix injected');
            const pmContent = readSkill(projectRoot, '.claude/skills', 'bmad-agent-pm');
            assert.ok(!pmContent.includes(ON_PREM_PREFIX_MARKER_BEGIN),
                'pm should be untouched (malformed source)');
            // No PM entry in results.
            const pmEntry = results.find(r => r.persona === 'bmad-agent-pm' && r.injected);
            assert.strictEqual(pmEntry, undefined);
        } finally { cleanup(projectRoot); }
    });

    // 8. Source customize file missing → skip that persona, no crash.
    await test('source customize file missing: skip that persona silently', async () => {
        const { projectRoot, customizeSrc } = buildFixture({
            customizeOverrides: { 'bmm-dev': 'SKIP' },
        });
        try {
            await applyOnPremPhasePrefixToDeployedSkills(
                projectRoot, 'on-prem', customizeSrc,
            );
            const devContent = readSkill(projectRoot, '.claude/skills', 'bmad-agent-dev');
            assert.ok(!devContent.includes(ON_PREM_PREFIX_MARKER_BEGIN),
                'dev should be untouched when source YAML is missing');
            const pmContent = readSkill(projectRoot, '.claude/skills', 'bmad-agent-pm');
            assert.ok(pmContent.includes(ON_PREM_PREFIX_MARKER_BEGIN),
                'pm should still be injected');
        } finally { cleanup(projectRoot); }
    });

    // 9. Persona source without on_prem_phase_prefix → skip.
    await test('source has no on_prem_phase_prefix: skip that persona', async () => {
        const { projectRoot, customizeSrc } = buildFixture({
            customizeOverrides: {
                'bmm-sm': 'phase: planning\ncritical_actions:\n  - "action"\n',
            },
        });
        try {
            await applyOnPremPhasePrefixToDeployedSkills(
                projectRoot, 'on-prem', customizeSrc,
            );
            const smContent = readSkill(projectRoot, '.claude/skills', 'bmad-agent-sm');
            assert.ok(!smContent.includes(ON_PREM_PREFIX_MARKER_BEGIN),
                'sm should not be injected (no on_prem_phase_prefix)');
        } finally { cleanup(projectRoot); }
    });

    // 10. SKILL.md without frontmatter — block prepended.
    await test('SKILL.md without frontmatter: block prepended to start', async () => {
        const { projectRoot, customizeSrc } = buildFixture({ tools: ['.claude/skills'] });
        try {
            const skillPath = path.join(projectRoot, '.claude/skills/bmad-agent-pm/SKILL.md');
            fs.writeFileSync(skillPath, '# Plain persona — no frontmatter\n\nBody.\n', 'utf8');
            await applyOnPremPhasePrefixToDeployedSkills(
                projectRoot, 'on-prem', customizeSrc,
            );
            const updated = fs.readFileSync(skillPath, 'utf8');
            assert.ok(updated.startsWith(ON_PREM_PREFIX_MARKER_BEGIN),
                'block must be at the very start when no frontmatter');
            assert.ok(updated.includes('# Plain persona'),
                'original body preserved');
        } finally { cleanup(projectRoot); }
    });

    // 11. buildOnPremPrefixBlock produces a stable shape.
    await test('buildOnPremPrefixBlock: stable shape with markers and section header', () => {
        const out = buildOnPremPrefixBlock('test prefix text');
        assert.ok(out.startsWith(ON_PREM_PREFIX_MARKER_BEGIN + '\n'));
        assert.ok(out.includes('## On-Prem Phase Prefix'));
        assert.ok(out.includes('test prefix text'));
        assert.ok(out.includes(ON_PREM_PREFIX_MARKER_END + '\n'));
    });

    // 12. injectOnPremPrefixBlock replaces an existing block in place.
    await test('injectOnPremPrefixBlock: replaces existing marker block in place', () => {
        const original = [
            '---', 'name: test', '---', '',
            ON_PREM_PREFIX_MARKER_BEGIN,
            'OLD prefix',
            ON_PREM_PREFIX_MARKER_END,
            '',
            'body',
        ].join('\n');
        const updated = injectOnPremPrefixBlock(original, 'NEW prefix');
        assert.ok(updated.includes('NEW prefix'), 'new prefix must be present');
        assert.ok(!updated.includes('OLD prefix'), 'old prefix must be gone');
        // Body preserved
        assert.ok(updated.includes('body'), 'body preserved');
        // Exactly one marker pair.
        const beginCount = updated.split(ON_PREM_PREFIX_MARKER_BEGIN).length - 1;
        assert.strictEqual(beginCount, 1);
    });

    // 13. projectRoot invalid — no crash, returns empty list.
    await test('invalid projectRoot: returns empty, no crash', async () => {
        const res1 = await applyOnPremPhasePrefixToDeployedSkills(null, 'on-prem');
        assert.deepStrictEqual(res1, []);
        const res2 = await applyOnPremPhasePrefixToDeployedSkills('', 'on-prem');
        assert.deepStrictEqual(res2, []);
    });

    // 14. customizeSourceDir missing — returns empty.
    await test('customize source dir missing: returns empty', async () => {
        const projectRoot = mktemp();
        try {
            const res = await applyOnPremPhasePrefixToDeployedSkills(
                projectRoot, 'on-prem',
                path.join(projectRoot, 'does-not-exist'),
            );
            assert.deepStrictEqual(res, []);
        } finally { cleanup(projectRoot); }
    });

    // 15. Real-repo smoke — verify the live lib/bmad-customize/ source has a
    //     valid on_prem_phase_prefix for at least bmm-pm (prevents silent
    //     regression where the authoring file loses the key).
    await test('repo smoke: lib/bmad-customize/bmm-pm.customize.yaml has on_prem_phase_prefix', () => {
        const jsYaml = require('js-yaml');
        const filePath = path.join(
            __dirname, '..', 'lib', 'bmad-customize', 'bmm-pm.customize.yaml',
        );
        assert.ok(fs.existsSync(filePath), 'bmm-pm.customize.yaml must exist in repo');
        const doc = jsYaml.load(fs.readFileSync(filePath, 'utf8'));
        assert.ok(doc.on_prem_phase_prefix && doc.on_prem_phase_prefix.trim().length > 0,
            'bmm-pm.customize.yaml must ship a non-empty on_prem_phase_prefix');
        assert.ok(doc.on_prem_phase_prefix.includes('/no_think'),
            'planning persona prefix must contain /no_think');
    });

    // ── Summary ──
    console.log(`\n  ${passed} passed, ${failed} failed\n`);
    if (errors.length > 0) {
        console.error('Failures:');
        for (const e of errors) {
            console.error(`  - ${e.name}: ${e.error}`);
        }
        process.exit(1);
    }
}

runAll().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
