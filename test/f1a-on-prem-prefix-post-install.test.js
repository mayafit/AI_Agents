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
 *
 * Bug `antigravity-path-divergence` extends the contract:
 *  10. The target set is derived from the deployed trees ON DISK, not from the
 *      TOOL_SKILL_DIRS registry list — a tree ma-agents' registry does not name
 *      (upstream bmad-method wrote `.agent/skills` for Antigravity while our
 *      registry said `.antigravity/skills`) is patched like any other, proven
 *      by injection count AND per-persona sha256 digest across every tree.
 *  11. Discovery is confined to dot-prefixed tool containers, so a SOURCE
 *      checkout's own `lib/.../skills/` can never be rewritten by the patcher.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const {
    applyOnPremPhasePrefixToDeployedSkills,
    discoverDeployedSkillTrees,
    injectOnPremPrefixBlock,
    buildOnPremPrefixBlock,
    PERSONA_SKILL_MAP,
    TOOL_SKILL_DIRS,
    ON_PREM_PREFIX_MARKER_BEGIN,
    ON_PREM_PREFIX_MARKER_END,
} = require('../lib/bmad');
const { getAllAgents } = require('../lib/agents');

// A deployed tree named by NOTHING in ma-agents — the shape of the bug: BMAD
// (or any other writer) creates it, our registry has never heard of it.
const UNREGISTERED_TREE = path.join('.some-unregistered-tool', 'skills');

function sha256(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

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

    // 10b. SKILL.md with CRLF frontmatter — block still inserted correctly.
    await test('SKILL.md with CRLF frontmatter: block inserted after frontmatter (no corruption)', async () => {
        const { projectRoot, customizeSrc } = buildFixture({ tools: ['.claude/skills'] });
        try {
            const skillPath = path.join(projectRoot, '.claude/skills/bmad-agent-pm/SKILL.md');
            const crlfContent = '---\r\nname: bmad-agent-pm\r\ndescription: CRLF test\r\n---\r\n\r\n# PM\r\nBody.\r\n';
            fs.writeFileSync(skillPath, crlfContent, 'utf8');
            await applyOnPremPhasePrefixToDeployedSkills(
                projectRoot, 'on-prem', customizeSrc,
            );
            const updated = fs.readFileSync(skillPath, 'utf8');
            assert.ok(updated.includes(ON_PREM_PREFIX_MARKER_BEGIN),
                'block must be injected into CRLF file');
            assert.ok(updated.includes('# PM\r\nBody.'),
                'CRLF body must be preserved');
            // Block must come AFTER the closing frontmatter delimiter.
            const fmClose = updated.indexOf('---\r\n', 4);
            assert.ok(fmClose !== -1, 'closing frontmatter delimiter preserved');
            const markerPos = updated.indexOf(ON_PREM_PREFIX_MARKER_BEGIN);
            assert.ok(markerPos > fmClose,
                `block must appear after closing frontmatter (marker at ${markerPos}, close at ${fmClose})`);
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

    // ── Bug `antigravity-path-divergence` — disk-derived patch targets ──────

    // 16. AC2: every deployed persona in EVERY tree that exists carries the
    //     prefix — including a tree ma-agents' registry has never heard of.
    //     Proven by injection count per tree AND by per-persona sha256 digest,
    //     not by spot check.
    await test('AC2 an UNREGISTERED deployed tree is patched — count + digest across every tree', async () => {
        const allTrees = [...TOOL_SKILL_DIRS, UNREGISTERED_TREE];
        const { projectRoot, customizeSrc } = buildFixture({ tools: allTrees });
        try {
            // Precondition — the extra tree really is named by nothing of ours.
            const normalized = UNREGISTERED_TREE.replace(/\\/g, '/');
            assert.ok(
                !TOOL_SKILL_DIRS.map(d => d.replace(/\\/g, '/')).includes(normalized),
                'fixture tree must NOT be in TOOL_SKILL_DIRS or the test proves nothing',
            );
            assert.ok(
                !getAllAgents().some(a => String(a.skillsDir).replace(/\\/g, '/') === normalized),
                'fixture tree must NOT be any agent skillsDir or the test proves nothing',
            );

            const results = await applyOnPremPhasePrefixToDeployedSkills(
                projectRoot, 'on-prem', customizeSrc,
            );
            const injected = results.filter(r => r.injected);
            const personaDirs = Object.values(PERSONA_SKILL_MAP);

            // Count — every tree, every persona.
            assert.strictEqual(injected.length, allTrees.length * personaDirs.length,
                `expected ${allTrees.length * personaDirs.length} injections across ` +
                `${allTrees.length} trees, got ${injected.length}`);
            for (const toolRel of allTrees) {
                const n = injected.filter(r => r.tool === toolRel).length;
                assert.strictEqual(n, personaDirs.length,
                    `${toolRel}: expected ${personaDirs.length} injections, got ${n}`);
            }

            // Digest — the same persona is byte-identical in every tree, so the
            // unregistered tree cannot be "present but differently patched".
            for (const dirName of personaDirs) {
                const digests = new Set(allTrees.map(
                    t => sha256(path.join(projectRoot, t, dirName, 'SKILL.md'))));
                assert.strictEqual(digests.size, 1,
                    `${dirName}: ${digests.size} distinct digests across ${allTrees.length} trees ` +
                    `(expected 1) — [${[...digests].map(d => d.slice(0, 8)).join(', ')}]`);
            }

            // Anti-vacuity — the shared digest is of a file that really carries
            // the block (identical-but-unpatched would also give one digest).
            const sample = readSkill(projectRoot, UNREGISTERED_TREE, 'bmad-agent-pm');
            assert.ok(sample.includes(ON_PREM_PREFIX_MARKER_BEGIN),
                'the unregistered tree was not actually patched');
            assert.ok(sample.includes('/no_think prefix for bmm-pm'),
                'the unregistered tree is missing the prefix text');
        } finally { cleanup(projectRoot); }
    });

    // 17. Nested dot container (the `.github/copilot/skills` shape).
    await test('a nested dot-container tree (.github/copilot/skills) is discovered and patched', async () => {
        const nested = path.join('.github', 'copilot', 'skills');
        const { projectRoot, customizeSrc } = buildFixture({ tools: [nested] });
        try {
            const results = await applyOnPremPhasePrefixToDeployedSkills(
                projectRoot, 'on-prem', customizeSrc,
            );
            assert.strictEqual(results.filter(r => r.injected).length,
                Object.keys(PERSONA_SKILL_MAP).length,
                'every persona in the nested tree should have been injected');
            assert.ok(readSkill(projectRoot, nested, 'bmad-agent-pm')
                .includes(ON_PREM_PREFIX_MARKER_BEGIN));
        } finally { cleanup(projectRoot); }
    });

    // 18. Source-tree protection — discovery must never reach a non-dot
    //     container, so a SOURCE checkout's shipped skills (which carry pinned
    //     digests in the release gate) can never be rewritten by an install.
    await test('a non-dot container with personas is NOT patched (source-tree protection)', async () => {
        const { projectRoot, customizeSrc } = buildFixture({ tools: ['.claude/skills'] });
        try {
            const sourceSkill = path.join(
                projectRoot, 'lib', 'bmad-extension', 'skills', 'bmad-agent-pm');
            fs.mkdirSync(sourceSkill, { recursive: true });
            const sourceFile = path.join(sourceSkill, 'SKILL.md');
            fs.writeFileSync(sourceFile,
                '---\nname: bmad-agent-pm\n---\n\n# shipped source artifact\n', 'utf8');
            const before = sha256(sourceFile);

            await applyOnPremPhasePrefixToDeployedSkills(projectRoot, 'on-prem', customizeSrc);

            assert.strictEqual(sha256(sourceFile), before,
                'the patcher reached into a non-dot SOURCE skills tree');
            assert.ok(!fs.readFileSync(sourceFile, 'utf8').includes(ON_PREM_PREFIX_MARKER_BEGIN),
                'the on-prem block leaked into a source artifact');
            // Anti-vacuity — the deployed tree next to it WAS patched.
            assert.ok(readSkill(projectRoot, '.claude/skills', 'bmad-agent-pm')
                .includes(ON_PREM_PREFIX_MARKER_BEGIN),
                'nothing was patched at all — the assertion above is vacuous');
        } finally { cleanup(projectRoot); }
    });

    // 19. The discovery primitive itself.
    await test('discoverDeployedSkillTrees: unknown trees in, persona-less and non-dot dirs out', async () => {
        const { projectRoot } = buildFixture({
            tools: [path.join('.claude', 'skills'), UNREGISTERED_TREE],
        });
        try {
            // A dot container with a `skills` dir but no personas — not a target.
            fs.mkdirSync(path.join(projectRoot, '.empty-tool', 'skills', 'some-workflow'),
                { recursive: true });
            // A non-dot container that DOES hold a persona — still not a target.
            const nonDot = path.join(projectRoot, 'lib', 'bmad-extension', 'skills', 'bmad-agent-pm');
            fs.mkdirSync(nonDot, { recursive: true });
            fs.writeFileSync(path.join(nonDot, 'SKILL.md'), '# source\n', 'utf8');

            const trees = discoverDeployedSkillTrees(projectRoot)
                .map(t => t.replace(/\\/g, '/')).sort();
            assert.deepStrictEqual(
                trees,
                ['.claude/skills', UNREGISTERED_TREE.replace(/\\/g, '/')].sort(),
                `unexpected discovery result: ${JSON.stringify(trees)}`,
            );
        } finally { cleanup(projectRoot); }
    });

    // 20. Discovery degrades safely.
    await test('discoverDeployedSkillTrees: invalid root or empty marker list returns []', async () => {
        assert.deepStrictEqual(discoverDeployedSkillTrees(null), []);
        assert.deepStrictEqual(discoverDeployedSkillTrees(''), []);
        const empty = mktemp();
        try {
            assert.deepStrictEqual(discoverDeployedSkillTrees(empty), []);
            assert.deepStrictEqual(discoverDeployedSkillTrees(empty, []), []);
        } finally { cleanup(empty); }
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
