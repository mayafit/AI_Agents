#!/usr/bin/env node
/**
 * Regression tests for bug-bmad-recompile-fails-on-airgapped-network.
 *
 * bmad-method 6.2.2's installer unconditionally performs `git fetch` /
 * `git clone` / `npm install` against external module repos. On an
 * air-gapped host those commands fail and lib/bmad.js used to swallow the
 * error with a one-line red banner ("BMAD recompile failed: ..."). These
 * tests lock in the new offline-safe classifier behaviour:
 *
 *   - Offline declared + cache intact -> WARN (downgrade)
 *   - Offline declared + cache missing -> ERROR (actionable remediation)
 *   - Not offline and error doesn't look offline -> RETHROW (loud failure)
 *
 * We mock the cache inspector and the environment so the test runs
 * deterministically and cross-platform (including in CI where ~/.bmad may
 * not exist). No real subprocess is spawned.
 */
'use strict';

const assert = require('assert');
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
        errors.push({ name, err });
    }
}

console.log('\nBug: BMAD recompile on air-gapped network\n');

const bmad = require('../lib/bmad');

// ---- isOfflineModeDeclared ----

console.log('isOfflineModeDeclared()');

test('returns false when env is unset', () => {
    const prev = process.env.MA_AGENTS_OFFLINE;
    delete process.env.MA_AGENTS_OFFLINE;
    try {
        assert.strictEqual(bmad.isOfflineModeDeclared(), false);
    } finally {
        if (prev !== undefined) process.env.MA_AGENTS_OFFLINE = prev;
    }
});

test('returns true for "1", "true", "yes" (case-insensitive)', () => {
    const prev = process.env.MA_AGENTS_OFFLINE;
    try {
        for (const v of ['1', 'true', 'TRUE', 'yes', 'YES']) {
            process.env.MA_AGENTS_OFFLINE = v;
            assert.strictEqual(bmad.isOfflineModeDeclared(), true, `failed for ${v}`);
        }
    } finally {
        if (prev !== undefined) process.env.MA_AGENTS_OFFLINE = prev;
        else delete process.env.MA_AGENTS_OFFLINE;
    }
});

test('returns false for "0", "false", empty', () => {
    const prev = process.env.MA_AGENTS_OFFLINE;
    try {
        for (const v of ['0', 'false', '', 'no']) {
            process.env.MA_AGENTS_OFFLINE = v;
            assert.strictEqual(bmad.isOfflineModeDeclared(), false, `failed for "${v}"`);
        }
    } finally {
        if (prev !== undefined) process.env.MA_AGENTS_OFFLINE = prev;
        else delete process.env.MA_AGENTS_OFFLINE;
    }
});

// ---- looksLikeOfflineFailure ----

console.log('\nlooksLikeOfflineFailure()');

test('detects ENOTFOUND', () => {
    const err = new Error('getaddrinfo ENOTFOUND github.com');
    assert.strictEqual(bmad.looksLikeOfflineFailure(err), true);
});

test('detects git fetch failure', () => {
    const err = new Error("Command failed: git fetch origin --depth 1\nfatal: unable to access 'https://github.com/...': Could not resolve host");
    assert.strictEqual(bmad.looksLikeOfflineFailure(err), true);
});

test('detects connection refused / timed out', () => {
    assert.strictEqual(
        bmad.looksLikeOfflineFailure(new Error('connect ECONNREFUSED 140.82.114.3:443')),
        true,
    );
    assert.strictEqual(
        bmad.looksLikeOfflineFailure(new Error('connect ETIMEDOUT')),
        true,
    );
});

test('ignores non-network failures', () => {
    assert.strictEqual(
        bmad.looksLikeOfflineFailure(new Error('SyntaxError in agent.yaml at line 42')),
        false,
    );
    assert.strictEqual(bmad.looksLikeOfflineFailure(null), false);
    assert.strictEqual(bmad.looksLikeOfflineFailure(undefined), false);
});

test('inspects stderr/stdout properties too', () => {
    const err = new Error('Command failed');
    err.stderr = 'fatal: unable to access https://github.com/bmad-code-org/...';
    assert.strictEqual(bmad.looksLikeOfflineFailure(err), true);
});

// ---- classifyRecompileFailure ----

console.log('\nclassifyRecompileFailure()');

const intactCache = () => ({
    present: ['bmb', 'cis', 'gds', 'tea', 'wds'],
    missing: [],
    intact: true,
    cacheDir: '/fake/.bmad/cache/external-modules',
});

const missingCache = () => ({
    present: ['bmb'],
    missing: ['cis', 'gds', 'tea', 'wds'],
    intact: false,
    cacheDir: '/fake/.bmad/cache/external-modules',
});

test('rethrows loudly when error does not look offline and offline not declared', () => {
    const prev = process.env.MA_AGENTS_OFFLINE;
    delete process.env.MA_AGENTS_OFFLINE;
    try {
        const result = bmad.classifyRecompileFailure(
            new Error('SyntaxError in customize.yaml'),
            { cacheInspector: intactCache },
        );
        assert.strictEqual(result.action, 'rethrow');
    } finally {
        if (prev !== undefined) process.env.MA_AGENTS_OFFLINE = prev;
    }
});

test('warns and proceeds when offline declared and cache intact', () => {
    const prev = process.env.MA_AGENTS_OFFLINE;
    process.env.MA_AGENTS_OFFLINE = '1';
    try {
        const result = bmad.classifyRecompileFailure(
            new Error('getaddrinfo ENOTFOUND github.com'),
            { cacheInspector: intactCache },
        );
        assert.strictEqual(result.action, 'warn');
        assert.ok(result.message.includes('vendored cache is intact'));
    } finally {
        if (prev !== undefined) process.env.MA_AGENTS_OFFLINE = prev;
        else delete process.env.MA_AGENTS_OFFLINE;
    }
});

test('warns when offline is merely inferred (error looks like network) and cache intact', () => {
    const prev = process.env.MA_AGENTS_OFFLINE;
    delete process.env.MA_AGENTS_OFFLINE;
    try {
        const result = bmad.classifyRecompileFailure(
            new Error("fatal: unable to access 'https://github.com/...': Could not resolve host"),
            { cacheInspector: intactCache },
        );
        assert.strictEqual(result.action, 'warn');
    } finally {
        if (prev !== undefined) process.env.MA_AGENTS_OFFLINE = prev;
    }
});

test('emits actionable error when offline and cache incomplete', () => {
    const prev = process.env.MA_AGENTS_OFFLINE;
    process.env.MA_AGENTS_OFFLINE = '1';
    try {
        const result = bmad.classifyRecompileFailure(
            new Error('getaddrinfo ENOTFOUND github.com'),
            { cacheInspector: missingCache },
        );
        assert.strictEqual(result.action, 'error');
        assert.deepStrictEqual(result.missing, ['cis', 'gds', 'tea', 'wds']);
        assert.ok(
            result.message.includes('npm run build:bmad-cache'),
            'error should include actionable remediation command',
        );
        assert.ok(
            result.message.includes('/fake/.bmad/cache/external-modules'),
            'error should include cache path',
        );
    } finally {
        if (prev !== undefined) process.env.MA_AGENTS_OFFLINE = prev;
        else delete process.env.MA_AGENTS_OFFLINE;
    }
});

// ---- inspectBmadCache (lightweight integration — uses real manifest) ----

console.log('\ninspectBmadCache()');

test('reads real cache-manifest.json and reports expected modules', () => {
    // Point at a directory that doesn't exist so every module is "missing"
    // — the test just verifies we consult the manifest correctly.
    const result = bmad.inspectBmadCache(path.join(__dirname, '__nonexistent_cache__'));
    assert.ok(Array.isArray(result.present));
    assert.ok(Array.isArray(result.missing));
    // cache-manifest.json ships with bmb/cis/gds/tea/wds
    assert.ok(
        result.missing.includes('bmb'),
        `expected bmb in missing, got: ${JSON.stringify(result.missing)}`,
    );
    assert.strictEqual(result.intact, false);
});

// ---- Summary ----

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) {
    for (const { name, err } of errors) {
        console.error(`FAIL: ${name}`);
        console.error(err.stack || err);
    }
    process.exit(1);
}
