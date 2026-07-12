'use strict';

/**
 * Story 30.6a — Custom marketplace source: thin adapter over bmad-method's
 * `CustomModuleManager`.
 *
 * Scope (per the 30.5 spike hand-off design, `_bmad-output/implementation-
 * artifacts/epic-runs/epic-30/30-5-spike-findings.md` §5): enumerate ONLY.
 * This module does NOT prune/stage/install anything — that lands in Story
 * 30.6b, which consumes `enumerateCustomSource()`'s return value (the
 * discovered plugin list) and the wizard's `selectedCodes` (see
 * `bin/cli.js#promptCustomMarketplace`).
 *
 * NFR17 — pinned-internal coupling.
 * bmad-method's `package.json` has no `exports` map, so a deep require of
 * `tools/installer/modules/custom-module-manager.js` is reachable but is an
 * installer-internal surface, not a documented/supported API. This is a
 * single-call-site (blast-radius-of-one) wrapper around that surface, per the
 * spike's mitigation list. `test/custom-marketplace-surface-drift.test.js`
 * fails loudly if the deep path, exported class, consumed methods, or the
 * installed bmad-method version drift from what this file was written
 * against.
 *
 * FR241 — zero token handling. Enumeration relies entirely on bmad-method's
 * own `cloneRepo()`, which sets `GIT_TERMINAL_PROMPT=0` (never prompts) and
 * spreads `process.env` (ambient SSH agent / credential helper / git config
 * creds). ma-agents never reads, stores, or logs a credential here.
 */

const path = require('node:path');

/** Deep, pinned-internal require path (NFR17). Single call site. */
const CUSTOM_MODULE_MANAGER_PATH = 'bmad-method/tools/installer/modules/custom-module-manager.js';

/**
 * The `CustomModuleManager` methods the custom-marketplace feature depends on.
 * Any drift in this set (renamed/removed on a bmad-method pin bump) must fail
 * the surface-drift test. 6a's `enumerateCustomSource()` calls `resolveSource`
 * + `discoverModules` (and `parseSource` transitively); `resolvePlugin` is the
 * staging primitive Story 30.6b will consume — it is guarded here now so the
 * drift test catches a regression BEFORE 6b lands, per the 30.5 spike
 * mitigation list (the four methods it names as the consumed surface).
 */
const REQUIRED_METHODS = ['parseSource', 'resolveSource', 'discoverModules', 'resolvePlugin'];

/**
 * NFR71 — custom-source content is pass-through and outside ma-agents' sealed
 * -bundle guarantee. Shown once, before the user is offered the multiselect
 * (i.e. before anything from the source could be installed).
 */
const NFR71_WARNING =
    'Custom marketplace content is outside ma-agents\' sealed-bundle guarantee — ' +
    'it is installed as-is from the source you provided and is not vetted by ma-agents.';

/**
 * Error type raised by this adapter for any enumeration failure (unreachable
 * source, invalid input, drifted surface). Callers should catch this and
 * print `err.message` only — never `err.stack` — to keep the wizard's
 * "fail clean" contract (no raw stack-dump on an unreachable source).
 */
class CustomMarketplaceError extends Error {
    constructor(message, { cause } = {}) {
        super(message);
        this.name = 'CustomMarketplaceError';
        if (cause !== undefined) this.cause = cause;
    }
}

/**
 * Deep-require bmad-method's CustomModuleManager (NFR17 single call site).
 *
 * @returns {{ CustomModuleManager: Function }}
 * @throws {CustomMarketplaceError} if the pinned-internal surface is not
 *   reachable at all (module moved/renamed on a bmad-method version bump).
 */
function loadCustomModuleManagerModule() {
    try {
        // eslint-disable-next-line global-require, import/no-dynamic-require
        return require(CUSTOM_MODULE_MANAGER_PATH);
    } catch (err) {
        throw new CustomMarketplaceError(
            `bmad-method's CustomModuleManager is not reachable at the pinned-internal ` +
            `path "${CUSTOM_MODULE_MANAGER_PATH}" (NFR17). This usually means the ` +
            `installed bmad-method version moved or renamed the module — re-run the ` +
            `surface-drift test (test/custom-marketplace-surface-drift.test.js) after ` +
            `any bmad-method version bump.`,
            { cause: err }
        );
    }
}

/**
 * Assert the pinned-internal surface this adapter depends on is present and
 * shaped as expected. Used by both this module (defensively, before use) and
 * the drift/smoke test (explicitly, as its own assertion).
 *
 * @returns {{ version: string, mgr: import('bmad-method/tools/installer/modules/custom-module-manager').CustomModuleManager }}
 * @throws {CustomMarketplaceError} on any drift — missing class, missing
 *   method, or a method that is no longer a function.
 */
function assertCustomModuleManagerSurface() {
    const mod = loadCustomModuleManagerModule();
    if (typeof mod.CustomModuleManager !== 'function') {
        throw new CustomMarketplaceError(
            `bmad-method's "${CUSTOM_MODULE_MANAGER_PATH}" no longer exports a ` +
            `CustomModuleManager class (NFR17 surface drift). Cannot enumerate custom ` +
            `marketplace sources until ma-agents' adapter (lib/custom-marketplace.js) ` +
            `is updated for the new shape.`
        );
    }

    let mgr;
    try {
        mgr = new mod.CustomModuleManager();
    } catch (err) {
        throw new CustomMarketplaceError(
            `bmad-method's CustomModuleManager constructor threw (NFR17 surface drift): ${err.message}`,
            { cause: err }
        );
    }

    const missing = REQUIRED_METHODS.filter((m) => typeof mgr[m] !== 'function');
    if (missing.length > 0) {
        throw new CustomMarketplaceError(
            `bmad-method's CustomModuleManager is missing expected method(s): ` +
            `${missing.join(', ')} (NFR17 surface drift). The custom-marketplace ` +
            `feature depends on: ${REQUIRED_METHODS.join(', ')}.`
        );
    }

    let version = null;
    try {
        // eslint-disable-next-line global-require
        version = require('bmad-method/package.json').version;
    } catch {
        // Best-effort only — absence doesn't invalidate the surface check above.
    }

    return { version, mgr };
}

/**
 * Enumerate the plugins declared by a custom marketplace source.
 *
 * Thin wrapper over `CustomModuleManager#resolveSource` +
 * `CustomModuleManager#discoverModules` (FR240). Performs NO staging, no
 * pruning, no install — see the module doc-comment above. Authentication is
 * whatever bmad-method's own `cloneRepo()` uses (ambient git creds; zero
 * token handling — FR241).
 *
 * @param {string} source - A local filesystem path OR a Git URL (HTTPS/SSH)
 *   pointing at a repository. If it contains `.claude-plugin/marketplace.json`
 *   ("discovery" mode) every declared plugin is enumerated; otherwise
 *   ("direct" mode, FR240) the source itself is treated as a single module.
 * @returns {Promise<{ mode: 'discovery'|'direct', plugins: Array<Object>, rootDir: string, sourceUrl: string|null }>}
 * @throws {CustomMarketplaceError} on invalid input, an unreachable/unauthorized
 *   remote, or a drifted pinned-internal surface. Always a clean, human-readable
 *   message — never a raw upstream stack.
 */
async function enumerateCustomSource(source) {
    if (!source || typeof source !== 'string' || !source.trim()) {
        throw new CustomMarketplaceError('A custom marketplace source (path or Git URL) is required.');
    }

    const { mgr } = assertCustomModuleManagerSurface();

    let resolved;
    try {
        // skipInstall: true  — this is enumeration only, never run a source's own
        //                      `npm install` as a side effect of browsing it.
        // silent: true       — ma-agents owns all user-facing output; suppress
        //                      bmad-method's own spinner/log lines here.
        resolved = await mgr.resolveSource(source, { skipInstall: true, silent: true });
    } catch (err) {
        // Fail clean (NFR71 posture + spike §3 "fails clean" contract): a
        // human-readable one-liner, no upstream stack surfaced to the wizard.
        throw new CustomMarketplaceError(
            `Could not reach custom marketplace source "${source}": ${err.message}`,
            { cause: err }
        );
    }

    if (resolved.mode === 'discovery') {
        let plugins;
        try {
            plugins = await mgr.discoverModules(resolved.marketplace, resolved.sourceUrl);
        } catch (err) {
            throw new CustomMarketplaceError(
                `Could not read the plugin list from "${source}": ${err.message}`,
                { cause: err }
            );
        }
        return { mode: 'discovery', plugins, rootDir: resolved.rootDir, sourceUrl: resolved.sourceUrl };
    }

    // FR240 — "direct" mode (no marketplace.json at the source root): treat the
    // whole source as a single module so the wizard's multiselect still has
    // exactly one, well-described choice. 30.6b decides how a direct-mode
    // selection stages; 6a only surfaces it.
    const singlePlugin = {
        code: path.basename(resolved.rootDir),
        name: path.basename(resolved.rootDir),
        description: '(direct-mode source — no marketplace.json; the whole source is one module)',
        source: '.',
        skills: [],
        type: 'custom-direct',
        trustTier: 'unverified',
        builtIn: false,
        isExternal: true,
    };
    return { mode: 'direct', plugins: [singlePlugin], rootDir: resolved.rootDir, sourceUrl: resolved.sourceUrl };
}

module.exports = {
    CUSTOM_MODULE_MANAGER_PATH,
    REQUIRED_METHODS,
    NFR71_WARNING,
    CustomMarketplaceError,
    assertCustomModuleManagerSurface,
    enumerateCustomSource,
};
