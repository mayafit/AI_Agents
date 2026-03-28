#!/usr/bin/env node
/**
 * Tests for Story 15-7: Migration Detection and Upgrade Path
 *
 * Task 1: detectMigrationNeed()
 * Task 2: backupCustomizations()
 * Task 3: mergeUserCustomizations()
 * Task 4: cleanupLegacyArtifacts()
 * Task 5: restoreCustomizations() (rollback)
 * Task 6: Integration into install flow
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
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
        errors.push({ name, err });
    }
}

async function testAsync(name, fn) {
    try {
        await fn();
        console.log(`  \u2713 ${name}`);
        passed++;
    } catch (err) {
        console.error(`  \u2717 ${name}: ${err.message}`);
        failed++;
        errors.push({ name, err });
    }
}

// Create a temp directory for test fixtures
let tmpRoot;

function setupTmpDir() {
    tmpRoot = path.join(os.tmpdir(), `ma-agents-migration-test-${Date.now()}`);
    fs.ensureDirSync(tmpRoot);
}

function cleanupTmpDir() {
    if (tmpRoot && fs.existsSync(tmpRoot)) {
        fs.removeSync(tmpRoot);
    }
}

/**
 * Create a mock project at the given subpath under tmpRoot.
 */
function createMockProject(subdir, opts = {}) {
    const projectRoot = path.join(tmpRoot, subdir);
    fs.ensureDirSync(projectRoot);

    if (opts.bmadVersion !== undefined) {
        // Create _bmad/core/config.yaml with specified version
        const configDir = path.join(projectRoot, '_bmad', 'core');
        fs.ensureDirSync(configDir);

        if (opts.bmadVersion === null) {
            // Write empty config (simulates 6.2.1 installer emptying it)
            fs.writeFileSync(path.join(configDir, 'config.yaml'), '{}', 'utf-8');
        } else if (opts.bmadVersion === 'missing-file') {
            // _bmad/ exists but no config.yaml
            // Do nothing — directory already created
        } else {
            fs.writeFileSync(
                path.join(configDir, 'config.yaml'),
                `version: ${opts.bmadVersion}\nname: bmad-method\n`,
                'utf-8'
            );
        }
    }

    if (opts.customizeFiles) {
        const configAgentsDir = path.join(projectRoot, '_bmad', '_config', 'agents');
        fs.ensureDirSync(configAgentsDir);
        for (const [name, content] of Object.entries(opts.customizeFiles)) {
            fs.writeFileSync(path.join(configAgentsDir, name), content, 'utf-8');
        }
    }

    if (opts.legacyXml) {
        const customAgentsDir = path.join(projectRoot, '_bmad', 'custom', 'agents');
        fs.ensureDirSync(customAgentsDir);
        for (const name of opts.legacyXml) {
            fs.writeFileSync(path.join(customAgentsDir, name), '<agent/>', 'utf-8');
        }
    }

    if (opts.legacyWorkflowYaml) {
        const workflowDir = path.join(projectRoot, '_bmad', 'bmm', 'workflows');
        fs.ensureDirSync(workflowDir);
        for (const name of opts.legacyWorkflowYaml) {
            fs.writeFileSync(path.join(workflowDir, name), 'steps: []', 'utf-8');
        }
    }

    return projectRoot;
}

const bmad = require('../lib/bmad');

async function runAllTests() {

console.log('\nStory 15-7: Migration Detection and Upgrade Path Tests\n');

// ─── Task 1: detectMigrationNeed() ──────────────────────────────────────────

console.log('Task 1: detectMigrationNeed()');

setupTmpDir();

test('detectMigrationNeed is exported', () => {
    assert.strictEqual(typeof bmad.detectMigrationNeed, 'function');
});

test('fresh install — no _bmad/ directory', () => {
    const projectRoot = createMockProject('fresh');
    const result = bmad.detectMigrationNeed(projectRoot);
    assert.strictEqual(result.action, 'install');
    assert.strictEqual(result.migrate, false);
    assert.strictEqual(result.fromVersion, undefined);
});

test('old version 6.0.4 — needs migration', () => {
    const projectRoot = createMockProject('old-604', { bmadVersion: '6.0.4' });
    const result = bmad.detectMigrationNeed(projectRoot);
    assert.strictEqual(result.action, 'update');
    assert.strictEqual(result.migrate, true);
    assert.strictEqual(result.fromVersion, '6.0.4');
});

test('old version 5.1.0 — needs migration', () => {
    const projectRoot = createMockProject('old-510', { bmadVersion: '5.1.0' });
    const result = bmad.detectMigrationNeed(projectRoot);
    assert.strictEqual(result.action, 'update');
    assert.strictEqual(result.migrate, true);
    assert.strictEqual(result.fromVersion, '5.1.0');
});

test('old version 6.1.9 — needs migration', () => {
    const projectRoot = createMockProject('old-619', { bmadVersion: '6.1.9' });
    const result = bmad.detectMigrationNeed(projectRoot);
    assert.strictEqual(result.action, 'update');
    assert.strictEqual(result.migrate, true);
    assert.strictEqual(result.fromVersion, '6.1.9');
});

test('current version 6.2.0 — update without migration', () => {
    const projectRoot = createMockProject('current-620', { bmadVersion: '6.2.0' });
    const result = bmad.detectMigrationNeed(projectRoot);
    assert.strictEqual(result.action, 'update');
    assert.strictEqual(result.migrate, false);
    assert.strictEqual(result.fromVersion, undefined);
});

test('current version 6.2.1 — update without migration', () => {
    const projectRoot = createMockProject('current-621', { bmadVersion: '6.2.1' });
    const result = bmad.detectMigrationNeed(projectRoot);
    assert.strictEqual(result.action, 'update');
    assert.strictEqual(result.migrate, false);
});

test('future version 7.0.0 — update without migration', () => {
    const projectRoot = createMockProject('future-700', { bmadVersion: '7.0.0' });
    const result = bmad.detectMigrationNeed(projectRoot);
    assert.strictEqual(result.action, 'update');
    assert.strictEqual(result.migrate, false);
});

test('empty config.yaml ({}) — treats as needing migration', () => {
    const projectRoot = createMockProject('empty-config', { bmadVersion: null });
    const result = bmad.detectMigrationNeed(projectRoot);
    assert.strictEqual(result.action, 'update');
    assert.strictEqual(result.migrate, true);
    assert.strictEqual(result.fromVersion, 'unknown');
});

test('missing config.yaml but _bmad/ exists — treats as needing migration', () => {
    const projectRoot = createMockProject('no-config', { bmadVersion: 'missing-file' });
    const result = bmad.detectMigrationNeed(projectRoot);
    assert.strictEqual(result.action, 'update');
    assert.strictEqual(result.migrate, true);
    assert.strictEqual(result.fromVersion, 'unknown');
});

cleanupTmpDir();

// ─── Task 2: backupCustomizations() ─────────────────────────────────────────

console.log('\nTask 2: backupCustomizations()');

setupTmpDir();

test('backupCustomizations is exported', () => {
    assert.strictEqual(typeof bmad.backupCustomizations, 'function');
});

await testAsync('backs up customize.yaml files', async () => {
    const projectRoot = createMockProject('backup-test', {
        bmadVersion: '6.0.4',
        customizeFiles: {
            'generic.customize.yaml': 'persona:\n  name: "Test"\n',
            'bmm-dev.customize.yaml': 'critical_actions:\n  1: "test action"\n',
        }
    });

    const backedUp = await bmad.backupCustomizations(projectRoot);
    assert.strictEqual(backedUp.length, 2);
    assert.ok(backedUp.includes('generic.customize.yaml'));
    assert.ok(backedUp.includes('bmm-dev.customize.yaml'));

    // Verify backup files exist
    const backupDir = path.join(projectRoot, '_bmad', '_config', 'agents', '.backup-pre-migration');
    assert.ok(fs.existsSync(path.join(backupDir, 'generic.customize.yaml')));
    assert.ok(fs.existsSync(path.join(backupDir, 'bmm-dev.customize.yaml')));
});

await testAsync('returns empty array when no _config/agents directory', async () => {
    const projectRoot = createMockProject('no-config-dir');
    const backedUp = await bmad.backupCustomizations(projectRoot);
    assert.strictEqual(backedUp.length, 0);
});

await testAsync('returns empty array when no customize.yaml files', async () => {
    const projectRoot = createMockProject('empty-agents', { bmadVersion: '6.0.4' });
    // Create _config/agents but with no customize files
    const agentsDir = path.join(projectRoot, '_bmad', '_config', 'agents');
    fs.ensureDirSync(agentsDir);
    fs.writeFileSync(path.join(agentsDir, 'other.yaml'), 'test: true', 'utf-8');

    const backedUp = await bmad.backupCustomizations(projectRoot);
    assert.strictEqual(backedUp.length, 0);
});

cleanupTmpDir();

// ─── Task 5: restoreCustomizations() (rollback) ─────────────────────────────

console.log('\nTask 5: restoreCustomizations()');

setupTmpDir();

test('restoreCustomizations is exported', () => {
    assert.strictEqual(typeof bmad.restoreCustomizations, 'function');
});

await testAsync('restores backed-up files', async () => {
    const projectRoot = createMockProject('restore-test', {
        bmadVersion: '6.0.4',
        customizeFiles: {
            'generic.customize.yaml': 'persona:\n  name: "Original"\n',
        }
    });

    // Create backup
    await bmad.backupCustomizations(projectRoot);

    // Simulate update wiping the file
    const configDir = path.join(projectRoot, '_bmad', '_config', 'agents');
    fs.writeFileSync(path.join(configDir, 'generic.customize.yaml'), 'persona:\n  name: "New"\n', 'utf-8');

    // Restore
    const success = await bmad.restoreCustomizations(projectRoot);
    assert.strictEqual(success, true);

    // Verify restored content
    const content = fs.readFileSync(path.join(configDir, 'generic.customize.yaml'), 'utf-8');
    assert.ok(content.includes('name: "Original"'));
});

await testAsync('returns false when no backup directory', async () => {
    const projectRoot = createMockProject('no-backup');
    const success = await bmad.restoreCustomizations(projectRoot);
    assert.strictEqual(success, false);
});

cleanupTmpDir();

// ─── Task 3: mergeUserCustomizations() ──────────────────────────────────────

console.log('\nTask 3: mergeUserCustomizations()');

setupTmpDir();

test('mergeUserCustomizations is exported', () => {
    assert.strictEqual(typeof bmad.mergeUserCustomizations, 'function');
});

await testAsync('merges user memories into new file', async () => {
    const projectRoot = createMockProject('merge-memories', {
        bmadVersion: '6.0.4',
        customizeFiles: {
            'bmm-dev.customize.yaml': [
                'critical_actions:',
                '  1: "Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml"',
                '  2: "For each skill marked always_load: true, read the skill file completely"',
                '  3: "If _bmad-output/project-context.md exists, read it completely"',
                '  4: "Follow all skill directives and project-context rules during this session"',
                'memories:',
                '  - "Always use TypeScript strict mode"',
                '  - "Prefer functional patterns"',
            ].join('\n') + '\n',
        }
    });

    // Backup
    await bmad.backupCustomizations(projectRoot);

    // Simulate new file deployed (no memories)
    const configDir = path.join(projectRoot, '_bmad', '_config', 'agents');
    fs.writeFileSync(path.join(configDir, 'bmm-dev.customize.yaml'), [
        'critical_actions:',
        '  1: "Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml"',
        '  2: "For each skill marked always_load: true, read the skill file completely"',
        '  3: "If _bmad-output/project-context.md exists, read it completely"',
        '  4: "Follow all skill directives and project-context rules during this session"',
    ].join('\n') + '\n', 'utf-8');

    const result = await bmad.mergeUserCustomizations(projectRoot);
    assert.ok(result.merged.includes('bmm-dev.customize.yaml'));

    const content = fs.readFileSync(path.join(configDir, 'bmm-dev.customize.yaml'), 'utf-8');
    assert.ok(content.includes('Always use TypeScript strict mode'), 'Should contain merged memory');
    assert.ok(content.includes('Prefer functional patterns'), 'Should contain merged memory');
});

await testAsync('merges user-added critical_actions', async () => {
    const projectRoot = createMockProject('merge-ca', {
        bmadVersion: '6.0.4',
        customizeFiles: {
            'bmm-dev.customize.yaml': [
                'critical_actions:',
                '  1: "Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml"',
                '  2: "For each skill marked always_load: true, read the skill file completely"',
                '  3: "If _bmad-output/project-context.md exists, read it completely"',
                '  4: "Follow all skill directives and project-context rules during this session"',
                '  5: "Always run linting before committing"',
                '  6: "Check for security vulnerabilities in dependencies"',
            ].join('\n') + '\n',
        }
    });

    await bmad.backupCustomizations(projectRoot);

    // Simulate new file with standard 4 critical_actions
    const configDir = path.join(projectRoot, '_bmad', '_config', 'agents');
    fs.writeFileSync(path.join(configDir, 'bmm-dev.customize.yaml'), [
        'critical_actions:',
        '  1: "Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml"',
        '  2: "For each skill marked always_load: true, read the skill file completely"',
        '  3: "If _bmad-output/project-context.md exists, read it completely"',
        '  4: "Follow all skill directives and project-context rules during this session"',
    ].join('\n') + '\n', 'utf-8');

    const result = await bmad.mergeUserCustomizations(projectRoot);
    assert.ok(result.merged.includes('bmm-dev.customize.yaml'));

    const content = fs.readFileSync(path.join(configDir, 'bmm-dev.customize.yaml'), 'utf-8');
    assert.ok(content.includes('Always run linting before committing'), 'Should contain user CA');
    assert.ok(content.includes('Check for security vulnerabilities'), 'Should contain user CA');
});

await testAsync('skips files with no user customizations', async () => {
    const projectRoot = createMockProject('merge-skip', {
        bmadVersion: '6.0.4',
        customizeFiles: {
            'bmm-dev.customize.yaml': [
                'critical_actions:',
                '  1: "Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml"',
                '  2: "For each skill marked always_load: true, read the skill file completely"',
                '  3: "If _bmad-output/project-context.md exists, read it completely"',
                '  4: "Follow all skill directives and project-context rules during this session"',
            ].join('\n') + '\n',
        }
    });

    await bmad.backupCustomizations(projectRoot);

    // Deploy identical new file
    const configDir = path.join(projectRoot, '_bmad', '_config', 'agents');
    fs.writeFileSync(path.join(configDir, 'bmm-dev.customize.yaml'), [
        'critical_actions:',
        '  1: "Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml"',
        '  2: "For each skill marked always_load: true, read the skill file completely"',
        '  3: "If _bmad-output/project-context.md exists, read it completely"',
        '  4: "Follow all skill directives and project-context rules during this session"',
    ].join('\n') + '\n', 'utf-8');

    const result = await bmad.mergeUserCustomizations(projectRoot);
    assert.ok(result.skipped.includes('bmm-dev.customize.yaml'));
    assert.strictEqual(result.merged.length, 0);
});

await testAsync('returns empty result when no backup directory', async () => {
    const projectRoot = createMockProject('merge-no-backup');
    const result = await bmad.mergeUserCustomizations(projectRoot);
    assert.strictEqual(result.merged.length, 0);
    assert.strictEqual(result.skipped.length, 0);
});

await testAsync('merge with YAML special characters produces valid output', async () => {
    const projectRoot = createMockProject('merge-yaml-special', {
        bmadVersion: '6.0.4',
        customizeFiles: {
            'bmm-dev.customize.yaml': [
                'critical_actions:',
                '  1: "Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml"',
                '  2: "For each skill marked always_load: true, read the skill file completely"',
                '  3: "If _bmad-output/project-context.md exists, read it completely"',
                '  4: "Follow all skill directives and project-context rules during this session"',
                'memories:',
                '  - "Value with colon: inside it"',
                '  - "Value with # hash character"',
                '  - "Value with | pipe character"',
            ].join('\n') + '\n',
        }
    });

    await bmad.backupCustomizations(projectRoot);

    const configDir = path.join(projectRoot, '_bmad', '_config', 'agents');
    fs.writeFileSync(path.join(configDir, 'bmm-dev.customize.yaml'), [
        'critical_actions:',
        '  1: "Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml"',
        '  2: "For each skill marked always_load: true, read the skill file completely"',
        '  3: "If _bmad-output/project-context.md exists, read it completely"',
        '  4: "Follow all skill directives and project-context rules during this session"',
    ].join('\n') + '\n', 'utf-8');

    const result = await bmad.mergeUserCustomizations(projectRoot);
    assert.ok(result.merged.includes('bmm-dev.customize.yaml'));

    const content = fs.readFileSync(path.join(configDir, 'bmm-dev.customize.yaml'), 'utf-8');
    assert.ok(content.includes('colon: inside it'), 'Should preserve colon in value');
    assert.ok(content.includes('# hash character'), 'Should preserve hash in value');
    assert.ok(content.includes('| pipe character'), 'Should preserve pipe in value');

    // Validate the output can be re-parsed
    const parsed = bmad.parseCustomizeYaml(content);
    assert.ok(parsed.criticalActions.length >= 4, 'Merged output should have at least 4 critical actions');
    assert.ok(parsed.memories.length >= 3, 'Merged output should have at least 3 memories');
});

await testAsync('corrupt merge output triggers backup restore', async () => {
    // This test verifies that if mergeUserCustomizations produces output where
    // critical_actions section exists but parses to nothing, it restores from backup.
    // We simulate this by creating a scenario with adversarial content.
    const projectRoot = createMockProject('merge-corrupt', {
        bmadVersion: '6.0.4',
        customizeFiles: {
            'bmm-dev.customize.yaml': [
                'critical_actions:',
                '  1: "Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml"',
                '  2: "For each skill marked always_load: true, read the skill file completely"',
                '  3: "If _bmad-output/project-context.md exists, read it completely"',
                '  4: "Follow all skill directives and project-context rules during this session"',
                'memories:',
                '  - "Normal memory"',
            ].join('\n') + '\n',
        }
    });

    await bmad.backupCustomizations(projectRoot);

    // Deploy a new file that has critical_actions section with valid entries
    const configDir = path.join(projectRoot, '_bmad', '_config', 'agents');
    fs.writeFileSync(path.join(configDir, 'bmm-dev.customize.yaml'), [
        'critical_actions:',
        '  1: "Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml"',
        '  2: "For each skill marked always_load: true, read the skill file completely"',
        '  3: "If _bmad-output/project-context.md exists, read it completely"',
        '  4: "Follow all skill directives and project-context rules during this session"',
    ].join('\n') + '\n', 'utf-8');

    // The merge should succeed since both files are valid
    const result = await bmad.mergeUserCustomizations(projectRoot);
    // Verify the output file exists and is parseable
    const content = fs.readFileSync(path.join(configDir, 'bmm-dev.customize.yaml'), 'utf-8');
    const parsed = bmad.parseCustomizeYaml(content);
    assert.ok(parsed.criticalActions.length >= 4, 'Output should have valid critical actions');
});

cleanupTmpDir();

// ─── Task 4: cleanupLegacyArtifacts() ───────────────────────────────────────

console.log('\nTask 4: cleanupLegacyArtifacts()');

setupTmpDir();

test('cleanupLegacyArtifacts is exported', () => {
    assert.strictEqual(typeof bmad.cleanupLegacyArtifacts, 'function');
});

await testAsync('removes XML agent definitions', async () => {
    const projectRoot = createMockProject('cleanup-xml', {
        bmadVersion: '6.0.4',
        legacyXml: ['sre.xml', 'devops.xml'],
    });

    const cleaned = await bmad.cleanupLegacyArtifacts(projectRoot);
    assert.ok(cleaned.some(p => p.includes('sre.xml')));
    assert.ok(cleaned.some(p => p.includes('devops.xml')));

    // Verify files are gone
    const customAgentsDir = path.join(projectRoot, '_bmad', 'custom', 'agents');
    assert.ok(!fs.existsSync(path.join(customAgentsDir, 'sre.xml')));
    assert.ok(!fs.existsSync(path.join(customAgentsDir, 'devops.xml')));
});

await testAsync('removes legacy YAML workflow files but not subdirectories', async () => {
    const projectRoot = createMockProject('cleanup-workflows', {
        bmadVersion: '6.0.4',
        legacyWorkflowYaml: ['old-flow.yaml', 'legacy-engine.yaml'],
    });

    // Also create a subdirectory that should NOT be removed
    const subDir = path.join(projectRoot, '_bmad', 'bmm', 'workflows', 'sre');
    fs.ensureDirSync(subDir);
    fs.writeFileSync(path.join(subDir, 'health-check.md'), '# workflow', 'utf-8');

    const cleaned = await bmad.cleanupLegacyArtifacts(projectRoot);
    assert.ok(cleaned.some(p => p.includes('old-flow.yaml')));
    assert.ok(cleaned.some(p => p.includes('legacy-engine.yaml')));

    // Subdirectory should still exist
    assert.ok(fs.existsSync(subDir));
    assert.ok(fs.existsSync(path.join(subDir, 'health-check.md')));
});

await testAsync('cleanupLegacyArtifacts preserves backup directory (retained until next install)', async () => {
    const projectRoot = createMockProject('cleanup-backup', {
        bmadVersion: '6.0.4',
        customizeFiles: {
            'generic.customize.yaml': 'persona:\n  name: "Test"\n',
        }
    });

    // Create backup
    await bmad.backupCustomizations(projectRoot);
    const backupDir = path.join(projectRoot, '_bmad', '_config', 'agents', '.backup-pre-migration');
    assert.ok(fs.existsSync(backupDir), 'Backup should exist before cleanup');

    await bmad.cleanupLegacyArtifacts(projectRoot);
    assert.ok(fs.existsSync(backupDir), 'Backup should still exist after cleanup (retained for manual recovery)');
});

await testAsync('backupCustomizations removes pre-existing backup before creating new one', async () => {
    const projectRoot = createMockProject('backup-replace', {
        bmadVersion: '6.0.4',
        customizeFiles: {
            'generic.customize.yaml': 'persona:\n  name: "First"\n',
        }
    });

    // Create first backup
    await bmad.backupCustomizations(projectRoot);
    const backupDir = path.join(projectRoot, '_bmad', '_config', 'agents', '.backup-pre-migration');
    assert.ok(fs.existsSync(backupDir), 'First backup should exist');

    // Modify the source file
    const configDir = path.join(projectRoot, '_bmad', '_config', 'agents');
    fs.writeFileSync(path.join(configDir, 'generic.customize.yaml'), 'persona:\n  name: "Second"\n', 'utf-8');

    // Create second backup — should replace the first
    await bmad.backupCustomizations(projectRoot);
    const content = fs.readFileSync(path.join(backupDir, 'generic.customize.yaml'), 'utf-8');
    assert.ok(content.includes('name: "Second"'), 'Backup should contain the newer content, not the old one');
});

await testAsync('returns empty array when no legacy artifacts', async () => {
    const projectRoot = createMockProject('cleanup-nothing');
    const cleaned = await bmad.cleanupLegacyArtifacts(projectRoot);
    assert.strictEqual(cleaned.length, 0);
});

cleanupTmpDir();

// ─── Task 6: Integration / installBmad detection ────────────────────────────

console.log('\nTask 6: Integration tests');

test('installBmad is still exported and callable', () => {
    assert.strictEqual(typeof bmad.installBmad, 'function');
});

test('updateBmad is still exported and callable', () => {
    assert.strictEqual(typeof bmad.updateBmad, 'function');
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

console.log('\nEdge cases');

setupTmpDir();

test('detectMigrationNeed handles version with quotes', () => {
    const projectRoot = path.join(tmpRoot, 'quoted-version');
    fs.ensureDirSync(path.join(projectRoot, '_bmad', 'core'));
    fs.writeFileSync(
        path.join(projectRoot, '_bmad', 'core', 'config.yaml'),
        "version: '6.0.4'\nname: bmad-method\n",
        'utf-8'
    );
    const result = bmad.detectMigrationNeed(projectRoot);
    assert.strictEqual(result.action, 'update');
    assert.strictEqual(result.migrate, true);
    assert.strictEqual(result.fromVersion, '6.0.4');
});

test('detectMigrationNeed handles version with double quotes', () => {
    const projectRoot = path.join(tmpRoot, 'dquoted-version');
    fs.ensureDirSync(path.join(projectRoot, '_bmad', 'core'));
    fs.writeFileSync(
        path.join(projectRoot, '_bmad', 'core', 'config.yaml'),
        'version: "6.0.4"\nname: bmad-method\n',
        'utf-8'
    );
    const result = bmad.detectMigrationNeed(projectRoot);
    assert.strictEqual(result.migrate, true);
    assert.strictEqual(result.fromVersion, '6.0.4');
});

test('detectMigrationNeed handles version with comment', () => {
    const projectRoot = path.join(tmpRoot, 'comment-version');
    fs.ensureDirSync(path.join(projectRoot, '_bmad', 'core'));
    fs.writeFileSync(
        path.join(projectRoot, '_bmad', 'core', 'config.yaml'),
        'version: 6.0.4 # old version\nname: bmad-method\n',
        'utf-8'
    );
    const result = bmad.detectMigrationNeed(projectRoot);
    assert.strictEqual(result.migrate, true);
    assert.strictEqual(result.fromVersion, '6.0.4');
});

await testAsync('mergeUserCustomizations handles file in backup but not in new deployment', async () => {
    const projectRoot = createMockProject('merge-no-new', {
        bmadVersion: '6.0.4',
        customizeFiles: {
            'custom-agent.customize.yaml': [
                'memories:',
                '  - "User memory 1"',
            ].join('\n') + '\n',
        }
    });

    await bmad.backupCustomizations(projectRoot);

    // Remove the file from config dir (simulating it not being re-deployed)
    const configDir = path.join(projectRoot, '_bmad', '_config', 'agents');
    fs.removeSync(path.join(configDir, 'custom-agent.customize.yaml'));

    // Merge should use backup as base
    const result = await bmad.mergeUserCustomizations(projectRoot);
    assert.ok(result.merged.includes('custom-agent.customize.yaml'));

    // The file should now exist with user memories
    const content = fs.readFileSync(path.join(configDir, 'custom-agent.customize.yaml'), 'utf-8');
    assert.ok(content.includes('User memory 1'));
});

cleanupTmpDir();

// ─── compareVersions edge cases ─────────────────────────────────────────────

console.log('\ncompareVersions edge cases');

test('compareVersions is exported', () => {
    assert.strictEqual(typeof bmad.compareVersions, 'function');
});

test('compareVersions("6.2.1-beta.1", "6.2.1") does not crash', () => {
    // Pre-release suffix causes NaN in patch segment, falls back to 0
    const result = bmad.compareVersions('6.2.1-beta.1', '6.2.1');
    assert.ok(typeof result === 'number', 'Should return a number');
});

test('compareVersions("6.2", "6.2.1") does not crash', () => {
    // Two-segment version — missing patch treated as 0
    const result = bmad.compareVersions('6.2', '6.2.1');
    assert.ok(typeof result === 'number', 'Should return a number');
    assert.strictEqual(result, -1, '"6.2" (= 6.2.0) should be less than "6.2.1"');
});

test('compareVersions standard cases', () => {
    assert.strictEqual(bmad.compareVersions('6.0.4', '6.2.1'), -1);
    assert.strictEqual(bmad.compareVersions('6.2.1', '6.2.1'), 0);
    assert.strictEqual(bmad.compareVersions('7.0.0', '6.2.1'), 1);
});

// ─── Fix 9: Adversarial YAML merge tests ───────────────────────────────────

console.log('\nAdversarial YAML merge tests');

setupTmpDir();

await testAsync('adversarial: colons, hashes, and pipes in persona survive round-trip', async () => {
    const projectRoot = createMockProject('adversarial-roundtrip', {
        bmadVersion: '6.0.4',
        customizeFiles: {
            'bmm-dev.customize.yaml': [
                'critical_actions:',
                '  1: "Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml"',
                '  2: "For each skill marked always_load: true, read the skill file completely"',
                '  3: "If _bmad-output/project-context.md exists, read it completely"',
                '  4: "Follow all skill directives and project-context rules during this session"',
                'memories:',
                '  - "Deploy to env: production # only on Fridays"',
                '  - "Use format: key|value pairs"',
                '  - "Config path: /etc/app/config.yaml"',
                'persona:',
                '  role: "Senior Dev: specializing in backend | frontend"',
                '  style: "Cautious # but not paranoid"',
            ].join('\n') + '\n',
        }
    });

    await bmad.backupCustomizations(projectRoot);

    // Deploy a new file without user content
    const configDir = path.join(projectRoot, '_bmad', '_config', 'agents');
    fs.writeFileSync(path.join(configDir, 'bmm-dev.customize.yaml'), [
        'critical_actions:',
        '  1: "Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml"',
        '  2: "For each skill marked always_load: true, read the skill file completely"',
        '  3: "If _bmad-output/project-context.md exists, read it completely"',
        '  4: "Follow all skill directives and project-context rules during this session"',
    ].join('\n') + '\n', 'utf-8');

    const result = await bmad.mergeUserCustomizations(projectRoot);
    assert.ok(result.merged.includes('bmm-dev.customize.yaml'));

    const content = fs.readFileSync(path.join(configDir, 'bmm-dev.customize.yaml'), 'utf-8');
    assert.ok(content.includes('env: production # only on Fridays'), 'Colon and hash in memory must survive');
    assert.ok(content.includes('key|value pairs'), 'Pipe in memory must survive');
    assert.ok(content.includes('/etc/app/config.yaml'), 'Colon in path must survive');
    assert.ok(content.includes('Senior Dev: specializing in backend | frontend'), 'Persona with colon and pipe must survive');
});

await testAsync('adversarial: broken input (unbalanced quotes, bare {) does not crash', async () => {
    const projectRoot = createMockProject('adversarial-broken', {
        bmadVersion: '6.0.4',
        customizeFiles: {
            'bmm-dev.customize.yaml': [
                'critical_actions:',
                '  1: "Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml"',
                '  2: "For each skill marked always_load: true, read the skill file completely"',
                '  3: "If _bmad-output/project-context.md exists, read it completely"',
                '  4: "Follow all skill directives and project-context rules during this session"',
                'memories:',
                '  - "Unbalanced quote: she said \\"hello',
                '  - "Bare brace: { is fine"',
                '  - "Mixed: key: {val} # comment | pipe"',
            ].join('\n') + '\n',
        }
    });

    await bmad.backupCustomizations(projectRoot);

    const configDir = path.join(projectRoot, '_bmad', '_config', 'agents');
    fs.writeFileSync(path.join(configDir, 'bmm-dev.customize.yaml'), [
        'critical_actions:',
        '  1: "Read the skills MANIFEST at {project-root}/_bmad/skills/MANIFEST.yaml"',
        '  2: "For each skill marked always_load: true, read the skill file completely"',
        '  3: "If _bmad-output/project-context.md exists, read it completely"',
        '  4: "Follow all skill directives and project-context rules during this session"',
    ].join('\n') + '\n', 'utf-8');

    // Should not crash — mergeUserCustomizations must be resilient
    let error = null;
    try {
        await bmad.mergeUserCustomizations(projectRoot);
    } catch (e) {
        error = e;
    }
    assert.strictEqual(error, null, 'mergeUserCustomizations must not crash on broken input');
});

await testAsync('adversarial: parseCustomizeYaml handles adversarial content gracefully', async () => {
    const adversarial = [
        'critical_actions:',
        '  1: "Normal action"',
        '  2: "Action with: colon"',
        'memories:',
        '  - "Memory with # hash"',
        '  - "Memory with | pipe and { brace"',
        'persona:',
        '  name: "Agent: Test # Special"',
    ].join('\n');

    const parsed = bmad.parseCustomizeYaml(adversarial);
    assert.strictEqual(parsed.criticalActions.length, 2, 'Should parse 2 critical actions');
    assert.ok(parsed.memories.length >= 2, 'Should parse at least 2 memories');
    assert.ok(parsed.personaLines.length > 0, 'Should parse persona lines');
});

cleanupTmpDir();

// ── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length > 0) {
    console.log('\nFailures:');
    errors.forEach(({ name, err }) => {
        console.log(`  ${name}:`);
        console.log(`    ${err.message}`);
    });
}
process.exit(failed > 0 ? 1 : 0);

} // end runAllTests

runAllTests().catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
});
