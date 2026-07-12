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
 *
 * Story 30.6b — prune + stage the user's selected subset (consumes
 * `enumerateCustomSource()`'s output + the wizard's `selectedCodes`). This
 * still lives in the SAME file as 30.6a's enumerate adapter (not a new
 * module) because staging a selection also needs the pinned-internal
 * `resolvePlugin` method — keeping every deep-require consumer in one file
 * preserves the single-call-site NFR17 mitigation. `stageCustomMarketplaceSubset()`
 * only stages to a local directory; it never invokes bmad-method itself — the
 * actual `--custom-source` install is `lib/bmad.js#installCustomMarketplaceSubset()`,
 * which reuses `buildBmadArgs`/`runCommand` (no hand-rolled child-process/git logic).
 */

const path = require('node:path');
const fs = require('fs-extra');
const yaml = require('js-yaml');

/** Deep, pinned-internal require path (NFR17). Single call site. */
const CUSTOM_MODULE_MANAGER_PATH = 'bmad-method/tools/installer/modules/custom-module-manager.js';

/**
 * Registry-index mode (this story) — the BMAD registry layout used by the
 * official plugin registry (`bmad-code-org/bmad-plugins-marketplace`) and any
 * source that follows the same convention. A `registry/` directory holding
 * `official.yaml` and/or `community-index.yaml` (each a top-level `modules:`
 * list) is a THIRD source shape, distinct from `discovery`
 * (`.claude-plugin/marketplace.json`) and `direct` (whole repo = one module).
 * Detection precedence is: discovery > registry > direct (see
 * `enumerateCustomSource`).
 */
const REGISTRY_DIR_NAME = 'registry';
const REGISTRY_OFFICIAL_INDEX = 'official.yaml';
const REGISTRY_COMMUNITY_INDEX = 'community-index.yaml';
const REGISTRY_SCHEMA_FILE = 'registry-schema.yaml';

/** Convert an OS-native relative path to a POSIX ('/'-separated) one for the
 *  staged marketplace.json (bmad-method's parseSource/skills detection is
 *  POSIX-oriented, and JSON marketplaces are always written POSIX-style). */
function toPosix(relPath) {
    return relPath.split(path.sep).join('/');
}

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
 * NFR71 (registry mode) — a per-entry trust annotation the wizard appends to
 * each registry choice so the community/unverified trust tier is explicit at
 * the point of selection (not just in the one-time source-level warning). A
 * `bmad-certified` (official) entry is labelled as such; anything else is made
 * explicitly "unverified/community — installed as-is, not vetted".
 *
 * @param {{ trustTier?: string, type?: string }} plugin - a normalized registry entry
 * @returns {string} human-readable trust label
 */
function registryTrustLabel(plugin) {
    if (plugin && plugin.trustTier === 'bmad-certified') {
        return 'bmad-certified';
    }
    return 'unverified/community — installed as-is, not vetted by ma-agents';
}

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

// ─── Registry-index mode (this story) ──────────────────────────────────────

/**
 * Detect the BMAD registry-index layout inside an already-resolved source root.
 * A source is treated as a registry when its `registry/` directory holds an
 * `official.yaml` and/or a `community-index.yaml` module index (or, failing
 * those, a `registry-schema.yaml`, which still marks the source as a registry
 * even if it currently declares no modules). Called ONLY after discovery
 * (`.claude-plugin/marketplace.json`) has been ruled out, so discovery always
 * wins (AC1 precedence).
 *
 * @param {string} rootDir - Absolute resolved source root.
 * @returns {Promise<{ isRegistry: boolean, officialPath: string|null, communityPath: string|null }>}
 */
async function detectRegistryLayout(rootDir) {
    const registryDir = path.join(rootDir, REGISTRY_DIR_NAME);
    if (!(await fs.pathExists(registryDir))) {
        return { isRegistry: false, officialPath: null, communityPath: null };
    }
    const officialAbs = path.join(registryDir, REGISTRY_OFFICIAL_INDEX);
    const communityAbs = path.join(registryDir, REGISTRY_COMMUNITY_INDEX);
    const schemaAbs = path.join(registryDir, REGISTRY_SCHEMA_FILE);
    const [hasOfficial, hasCommunity, hasSchema] = await Promise.all([
        fs.pathExists(officialAbs),
        fs.pathExists(communityAbs),
        fs.pathExists(schemaAbs),
    ]);
    if (!hasOfficial && !hasCommunity && !hasSchema) {
        return { isRegistry: false, officialPath: null, communityPath: null };
    }
    return {
        isRegistry: true,
        officialPath: hasOfficial ? officialAbs : null,
        communityPath: hasCommunity ? communityAbs : null,
    };
}

/**
 * Normalize one raw registry-index entry (conforming to
 * `registry/registry-schema.yaml`) into the SAME plugin-choice object shape the
 * wizard's multiselect (30.6a/6b) already consumes, plus the registry-only
 * pointer fields the two-level install needs (`repository`, `moduleDefinition`,
 * `approvedSha`, `approvedTag`, `version`, `trustTier`).
 *
 * @param {Object} entry - raw YAML module entry
 * @param {{ official: boolean }} ctx - which index the entry came from
 * @returns {Object} normalized plugin-choice object
 */
function normalizeRegistryEntry(entry, { official }) {
    const trustTier = entry.trust_tier || (official ? 'bmad-certified' : 'unverified');
    const type = entry.type || (official ? 'bmad-org' : 'community');
    return {
        code: entry.code || entry.name,
        name: entry.name,
        displayName: entry.display_name || entry.name,
        description: entry.description || '',
        type,
        trustTier,
        category: entry.category || null,
        subcategory: entry.subcategory || null,
        // Registry-only pointer fields (two-level install).
        repository: entry.repository || null,
        moduleDefinition: entry.module_definition || null,
        approvedSha: entry.approved_sha || null,
        approvedTag: entry.approved_tag || null,
        version: entry.version || null,
        builtIn: entry.built_in === true,
        isExternal: true,
    };
}

/**
 * Parse one registry index file (`official.yaml` / `community-index.yaml`) into
 * a normalized entry list. A missing/empty `modules:` key yields `[]`; a YAML
 * syntax error or a non-list `modules:` throws a clean `CustomMarketplaceError`
 * (AC4 malformed-index fail-clean). Individual entries that lack a usable
 * `name` or `repository` pointer are SKIPPED (they are not installable and must
 * not sink an otherwise-valid registry).
 *
 * @param {string} indexPath - absolute path to the index file
 * @param {{ official: boolean }} ctx
 * @returns {Promise<Array<Object>>} normalized entries
 * @throws {CustomMarketplaceError}
 */
async function parseRegistryIndex(indexPath, { official }) {
    const label = path.basename(indexPath);
    let raw;
    try {
        raw = await fs.readFile(indexPath, 'utf8');
    } catch (err) {
        throw new CustomMarketplaceError(`Could not read registry index "${label}": ${err.message}`, { cause: err });
    }
    let doc;
    try {
        doc = yaml.load(raw);
    } catch (err) {
        throw new CustomMarketplaceError(
            `Registry index "${label}" is not valid YAML: ${err.message}`,
            { cause: err }
        );
    }
    if (doc === null || doc === undefined) return [];
    if (typeof doc !== 'object' || Array.isArray(doc)) {
        throw new CustomMarketplaceError(`Registry index "${label}" is not a mapping with a "modules" list.`);
    }
    const modules = doc.modules;
    if (modules === undefined || modules === null) return [];
    if (!Array.isArray(modules)) {
        throw new CustomMarketplaceError(`Registry index "${label}" has a "modules" key that is not a list.`);
    }
    const out = [];
    for (const entry of modules) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
        if (typeof entry.name !== 'string' || !entry.name.trim()) continue; // not addressable — skip
        if (typeof entry.repository !== 'string' || !entry.repository.trim()) continue; // no pointer — not installable
        out.push(normalizeRegistryEntry(entry, { official }));
    }
    return out;
}

/**
 * Build the `registry`-mode enumeration result: parse the official + community
 * indexes, merge, and de-dupe by `name` (official — bmad-certified — wins over
 * a same-named community entry).
 *
 * @param {string} rootDir
 * @param {string|null} sourceUrl
 * @param {{ officialPath: string|null, communityPath: string|null }} layout
 * @returns {Promise<{ mode: 'registry', plugins: Array<Object>, rootDir: string, sourceUrl: string|null }>}
 */
async function enumerateRegistrySource(rootDir, sourceUrl, layout) {
    const official = layout.officialPath ? await parseRegistryIndex(layout.officialPath, { official: true }) : [];
    const community = layout.communityPath ? await parseRegistryIndex(layout.communityPath, { official: false }) : [];

    // Official entries are appended first so they win the de-dupe on a name
    // collision (a bmad-certified module must never be shadowed by an unverified
    // community entry of the same name).
    const byName = new Map();
    for (const p of [...official, ...community]) {
        if (!byName.has(p.name)) byName.set(p.name, p);
    }
    return { mode: 'registry', plugins: [...byName.values()], rootDir, sourceUrl };
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

    // AC1 precedence: discovery (above) wins; else a `registry/` layout →
    // `registry` mode; else `direct` (below). The registry index is a
    // higher-level pointer format (each entry names a separate module repo),
    // so it is enumerated distinctly from a single-repo direct source.
    let registryLayout;
    try {
        registryLayout = await detectRegistryLayout(resolved.rootDir);
    } catch (err) {
        throw new CustomMarketplaceError(
            `Could not inspect "${source}" for a registry layout: ${err.message}`,
            { cause: err }
        );
    }
    if (registryLayout.isRegistry) {
        try {
            return await enumerateRegistrySource(resolved.rootDir, resolved.sourceUrl, registryLayout);
        } catch (err) {
            if (err instanceof CustomMarketplaceError) throw err;
            throw new CustomMarketplaceError(
                `Could not read the registry index from "${source}": ${err.message}`,
                { cause: err }
            );
        }
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

// ─── Story 30.6b — prune + stage the selected subset ───────────────────────

/** Project-relative stage dir for the pruned custom-marketplace subset. Sibling of
 *  `lib/bmad.js#PLUGIN_STAGE_DIR_NAME` (the bundled-plugin stage) but a distinct
 *  directory: the two stages are unrelated content and must never merge. */
const CUSTOM_MARKETPLACE_STAGE_DIR_NAME = '.ma-agents-custom-marketplace-stage';

/**
 * FR240 direct-mode gap-fill: `enumerateCustomSource()`'s synthetic direct-mode
 * plugin object always carries `skills: []` (6a only needs it to render ONE
 * multiselect choice). bmad-method's own `PluginResolver.resolve()` returns `[]`
 * immediately when `plugin.skills` is empty, so staging a direct-mode selection
 * as-is would resolve to zero installable skills. bmad-method's own CLI
 * (`ui.js#_resolveCustomSourcesCli`, direct-mode branch) works around this by
 * scanning the source root for immediate subdirectories containing `SKILL.md`
 * and using THOSE directory names as `plugin.skills` before calling
 * `resolvePlugin`. This mirrors that scan exactly so 30.6b's direct-mode
 * staging matches what bmad-method's own non-interactive install would do.
 *
 * @param {string} rootDir - Absolute path to the direct-mode source root.
 * @returns {Promise<string[]>} Directory names (not paths) that contain a SKILL.md.
 */
async function scanSkillDirs(baseDir) {
    let entries;
    try {
        entries = await fs.readdir(baseDir, { withFileTypes: true });
    } catch {
        return [];
    }
    const skillDirs = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillMd = path.join(baseDir, entry.name, 'SKILL.md');
        if (await fs.pathExists(skillMd)) {
            skillDirs.push(entry.name);
        }
    }
    return skillDirs;
}

/** Story 30.6b direct-mode scan (thin alias of {@link scanSkillDirs} at the
 *  source root) — kept as a named export for the 30.6b surface. */
async function scanDirectModeSkillDirs(rootDir) {
    return scanSkillDirs(rootDir);
}

/**
 * Resolve every selected plugin's installable skill/module layout via
 * bmad-method's own `CustomModuleManager#resolvePlugin` (the pinned-internal
 * method 30.6a already guards in `REQUIRED_METHODS`, reserved for this story).
 *
 * @param {Object} ctx
 * @param {'discovery'|'direct'} ctx.mode
 * @param {string} ctx.rootDir - Absolute path returned by `enumerateCustomSource`.
 * @param {string|null} ctx.sourceUrl - Absolute/null, as returned by `enumerateCustomSource`.
 * @param {Array<Object>} ctx.plugins - The FULL enumerated plugin list (30.6a's return value).
 * @param {string[]} ctx.selectedCodes - The user's chosen subset of plugin codes.
 * @returns {Promise<Array<{ plugin: Object, rawPlugin: Object, resolved: Array<Object> }>>}
 * @throws {CustomMarketplaceError} if no enumerated plugin matches `selectedCodes`.
 */
async function resolveSelectedPlugins({ mode, rootDir, sourceUrl, plugins, selectedCodes }) {
    const { mgr } = assertCustomModuleManagerSurface();
    const selectedSet = new Set(selectedCodes);
    const selectedPlugins = (plugins || []).filter((p) => selectedSet.has(p.code));

    if (selectedPlugins.length === 0) {
        throw new CustomMarketplaceError(
            `None of the selected codes (${[...selectedSet].join(', ') || '(none)'}) matched an ` +
            `enumerated plugin — nothing to stage.`
        );
    }

    // Local sources pass their rootDir as `localPath` (manifest tracking only);
    // URL sources pass `null` here since the clone metadata already carries the
    // origin. Mirrors resolvePlugin's own call sites (custom-module-manager.js,
    // ui.js#_resolveCustomSourcesCli).
    const localPath = sourceUrl ? null : rootDir;

    const resolvedByPlugin = [];
    for (const plugin of selectedPlugins) {
        let rawPlugin;
        if (mode === 'discovery') {
            rawPlugin = plugin.rawPlugin;
        } else {
            // FR240 direct mode — see scanDirectModeSkillDirs() doc comment.
            const skillDirNames = await scanDirectModeSkillDirs(rootDir);
            rawPlugin = {
                name: plugin.code,
                description: plugin.description || '',
                version: plugin.version || null,
                source: '.',
                skills: skillDirNames,
            };
        }
        const resolved = await mgr.resolvePlugin(rootDir, rawPlugin, sourceUrl, localPath);
        resolvedByPlugin.push({ plugin, rawPlugin, resolved });
    }
    return resolvedByPlugin;
}

/**
 * FR238 — pre-flight guard mirroring (and pre-empting, with a friendlier
 * message) bmad-method 6.10.0's `_copyResolvedSkills` fail-loud invariants
 * (`tools/installer/modules/official-modules.js`):
 *   (a) the overall resolution must be non-empty (an empty selection would
 *       otherwise silently install nothing — worse than a loud abort, since
 *       the custom-module install path has no built-in guard for this case);
 *   (b) each individual resolved module's skill directories must have
 *       UNIQUE leaf (basename) names — `_copyResolvedSkills` flattens skills
 *       by leaf name into that module's target dir and throws on a collision.
 * Scope note: uniqueness is checked PER MODULE, matching the upstream guard's
 * exact scope — the same leaf name reused across two DIFFERENT modules is
 * fine (each module installs into its own `bmadDir/<code>/`).
 *
 * @param {Array<{ plugin: Object, rawPlugin: Object, resolved: Array<Object> }>} resolvedByPlugin
 * @param {Object} [ctx]
 * @param {string} [ctx.source] - Original source string, for error messages only.
 * @returns {Array<Object>} The flattened list of resolved modules (all plugins).
 * @throws {CustomMarketplaceError} on any violation above.
 */
function assertResolutionNonEmptyAndUniqueLeaves(resolvedByPlugin, { source = '', mode = null } = {}) {
    const allModules = resolvedByPlugin.flatMap((r) => r.resolved || []);

    if (allModules.length === 0) {
        // AC7 — a direct-mode source that resolves to nothing is the exact
        // failure a mis-pointed registry URL used to produce. Name the likely
        // cause and note that registry indexes are now supported (so re-running
        // will auto-detect them), instead of a bare "zero modules" abort.
        const directHint =
            mode === 'direct'
                ? ' The source has no `.claude-plugin/marketplace.json` and no `module.yaml`/skills ' +
                  'directories at its root. If it is a BMAD registry index (a `registry/` directory ' +
                  'with `official.yaml`/`community-index.yaml`), that format is now supported — re-run ' +
                  'and it will be detected as a `registry` source.'
                : '';
        throw new CustomMarketplaceError(
            `Custom marketplace selection from "${source}" resolved to zero installable modules ` +
            `— bmad-method's PluginResolver could not locate module.yaml/skills for any selected ` +
            `plugin. Nothing would be installed; aborting before staging (FR238).${directHint}`
        );
    }

    for (const mod of allModules) {
        if (!Array.isArray(mod.skillPaths) || mod.skillPaths.length === 0) {
            throw new CustomMarketplaceError(
                `Module '${mod.code}' (from plugin '${mod.pluginName}') resolved to zero skill ` +
                `directories — installing it would create an empty module. Aborting before staging (FR238).`
            );
        }
        const seenLeaves = new Map();
        for (const skillPath of mod.skillPaths) {
            const leaf = path.basename(skillPath);
            if (seenLeaves.has(leaf)) {
                throw new CustomMarketplaceError(
                    `Module '${mod.code}' has two skill directories that share the leaf name ` +
                    `'${leaf}' ('${seenLeaves.get(leaf)}' and '${skillPath}') — they would overwrite ` +
                    `each other on install. bmad-method 6.10.0's _copyResolvedSkills fails loud on ` +
                    `this exact case; ma-agents checks it first so the failure is clean (FR238).`
                );
            }
            seenLeaves.set(leaf, skillPath);
        }
    }

    return allModules;
}

/**
 * Prune the enumerated marketplace down to `selectedCodes` and stage the
 * resulting subset's actual content into a project-local directory, ready to
 * be handed to bmad-method as an additional `--custom-source`.
 *
 * Stages ONLY (no bmad-method invocation) — `lib/bmad.js#installCustomMarketplaceSubset`
 * performs the actual install using this function's return value.
 *
 * @param {Object} ctx
 * @param {string} ctx.source - Original source string (path or Git URL), for messages only.
 * @param {'discovery'|'direct'} ctx.mode
 * @param {string} ctx.rootDir
 * @param {string|null} ctx.sourceUrl
 * @param {Array<Object>} ctx.plugins - Full enumerated list (30.6a's return value).
 * @param {string[]} ctx.selectedCodes
 * @param {string} ctx.projectRoot
 * @returns {Promise<{ stagePath: string, customSourceArg: string, resolvedModules: Array<Object> }>}
 * @throws {CustomMarketplaceError} on a drifted surface, an unmatched selection, or a failed
 *   FR238 pre-flight check (see assertResolutionNonEmptyAndUniqueLeaves).
 */
/**
 * Prepare a clean, empty stage directory under `projectRoot`. Safety pattern
 * mirrors lib/bmad.js#stagePlugin (Story 22.6/22.8): never follow a pre-existing
 * stage path that is a symlink, and wipe any stale stage from a prior failed run
 * before copying fresh content. Shared by both the discovery/direct
 * (`stageCustomMarketplaceSubset`) and registry (`stageRegistrySubset`) paths.
 *
 * @param {string} projectRoot - already-resolved absolute project root
 * @returns {string} absolute stage path (created empty)
 * @throws {CustomMarketplaceError}
 */
function prepareCleanStageDir(projectRoot) {
    const stagePath = path.join(projectRoot, CUSTOM_MARKETPLACE_STAGE_DIR_NAME);
    if (fs.existsSync(stagePath)) {
        const stageLstat = fs.lstatSync(stagePath);
        if (stageLstat.isSymbolicLink()) {
            throw new CustomMarketplaceError(
                `Refusing to stage custom marketplace subset — ${stagePath} is a symbolic link. ` +
                `Remove it manually and re-run.`
            );
        }
        try {
            fs.removeSync(stagePath);
        } catch (err) {
            throw new CustomMarketplaceError(`Cannot wipe stale stage ${stagePath}: ${err.message}`);
        }
    }
    fs.mkdirpSync(stagePath);
    return stagePath;
}

async function stageCustomMarketplaceSubset({ source, mode, rootDir, sourceUrl, plugins, selectedCodes, projectRoot }) {
    projectRoot = path.resolve(projectRoot);

    const resolvedByPlugin = await resolveSelectedPlugins({ mode, rootDir, sourceUrl, plugins, selectedCodes });
    const allModules = assertResolutionNonEmptyAndUniqueLeaves(resolvedByPlugin, { source, mode });

    const stagePath = prepareCleanStageDir(projectRoot);

    // Copy every resolved file, preserving its path relative to rootDir, so
    // bmad-method's own re-resolution against the stage (a fresh 'local' type
    // source once staged) reproduces the identical result: same skill dirs at
    // the same relative locations, same module.yaml if one was found, and the
    // same synthesized fallback if strategy 5 applies (a pure function of the
    // marketplace.json entry + the copied skill dirs' SKILL.md frontmatter).
    const copyRelativeToRoot = (absSrc) => {
        const rel = path.relative(rootDir, absSrc);
        const dest = path.join(stagePath, rel);
        fs.copySync(absSrc, dest, { overwrite: true, dereference: true });
    };
    try {
        for (const mod of allModules) {
            for (const skillPath of mod.skillPaths) copyRelativeToRoot(skillPath);
            if (mod.moduleYamlPath) copyRelativeToRoot(mod.moduleYamlPath);
            if (mod.moduleHelpCsvPath) copyRelativeToRoot(mod.moduleHelpCsvPath);
        }
    } catch (err) {
        try { fs.removeSync(stagePath); } catch { /* swallow — primary error wins */ }
        throw new CustomMarketplaceError(`Staging the custom marketplace subset failed: ${err.message}`, { cause: err });
    }

    // Prune: write a marketplace.json containing ONLY the selected plugins'
    // raw entries (direct mode has no original marketplace.json to prune, so
    // this synthesizes the one entry from the direct-mode plugin descriptor).
    const prunedPlugins = resolvedByPlugin.map(({ rawPlugin }) => rawPlugin);
    const marketplaceDir = path.join(stagePath, '.claude-plugin');
    fs.mkdirpSync(marketplaceDir);
    fs.writeFileSync(
        path.join(marketplaceDir, 'marketplace.json'),
        JSON.stringify({ name: path.basename(rootDir), plugins: prunedPlugins }, null, 2)
    );

    // POSIX-style `./<dir>` satisfies bmad-method's parseSource() local-path
    // detector on both Windows and POSIX (see lib/bmad.js#stagePlugin for the
    // same rationale) — bmad-method's cwd is always projectRoot.
    const customSourceArg = `./${CUSTOM_MARKETPLACE_STAGE_DIR_NAME}`;
    return { stagePath, customSourceArg, resolvedModules: allModules };
}

// ─── Registry-index mode — two-level stage + install ───────────────────────

/**
 * Resolve one selected registry entry into a staged rawPlugin + resolved
 * modules. Two-level: clone the entry's `repository` (via bmad-method's own
 * `resolveSource`/`cloneRepo` — ambient git creds, GIT_TERMINAL_PROMPT=0, no
 * token handling — FR241), locate the module at `module_definition` (fallback:
 * the repo root, i.e. PluginResolver over the whole clone), scan for skill
 * directories, and resolve via `resolvePlugin`.
 *
 * A community entry is cloned at its `approved_tag` (the tag the registry
 * publishes for the approved release — it points at `approved_sha`). We pin to
 * the TAG rather than the raw SHA because bmad-method's `cloneRepo()` drives
 * `git clone --branch <ref>` / `git fetch origin <ref>`, which accept a tag or
 * branch but NOT a bare commit SHA. The `approved_sha` is still recorded on the
 * persisted selection (see lib/bmad.js#installCustomMarketplaceSubset) as the
 * immutable record of what the registry approved.
 *
 * @param {Object} plugin - a normalized registry entry (from enumerateCustomSource)
 * @param {(input: string, opts: Object) => Promise<Object>} resolveSourceFn
 * @param {(repoPath: string, rawPlugin: Object, url: string|null, local: string|null) => Promise<Array>} resolvePluginFn
 * @returns {Promise<{ plugin: Object, rawPlugin: Object, resolved: Array<Object>, entryRootDir: string }>}
 * @throws {CustomMarketplaceError}
 */
async function resolveRegistryEntry(plugin, resolveSourceFn, resolvePluginFn) {
    if (!plugin.repository) {
        throw new CustomMarketplaceError(
            `Registry entry '${plugin.code}' has no repository pointer — cannot install it.`
        );
    }

    // Pin ref (tag/branch) — see the doc-comment above for why never a raw SHA.
    const pinOverride = plugin.approvedTag || null;

    let resolvedSource;
    try {
        resolvedSource = await resolveSourceFn(plugin.repository, {
            skipInstall: true,
            silent: true,
            ...(pinOverride ? { pinOverride } : {}),
        });
    } catch (err) {
        throw new CustomMarketplaceError(
            `Could not clone registry entry '${plugin.code}' from "${plugin.repository}"` +
            `${pinOverride ? ` @ ${pinOverride}` : ''}: ${err.message}`,
            { cause: err }
        );
    }

    const entryRootDir = resolvedSource.rootDir;
    const entrySourceUrl = resolvedSource.sourceUrl || null;

    // Locate the module within the clone. `module_definition` is a POSIX,
    // repo-relative path to the module's module.yaml; its directory is the
    // module root. Absent → fall back to the repo root (PluginResolver over the
    // whole clone), matching the AC3 fallback.
    let relModuleDirPosix = '.';
    if (plugin.moduleDefinition) {
        const defPosix = toPosix(plugin.moduleDefinition).replace(/^\.\//, '');
        const moduleYamlAbs = path.join(entryRootDir, ...defPosix.split('/'));
        if (!(await fs.pathExists(moduleYamlAbs))) {
            throw new CustomMarketplaceError(
                `Registry entry '${plugin.code}': module_definition "${plugin.moduleDefinition}" ` +
                `was not found inside ${plugin.repository}. The registry pointer is stale or the ` +
                `repository layout changed; aborting before staging (FR238).`
            );
        }
        relModuleDirPosix = path.posix.dirname(defPosix);
    }

    const moduleBaseAbs =
        relModuleDirPosix === '.' ? entryRootDir : path.join(entryRootDir, ...relModuleDirPosix.split('/'));
    const skillNames = await scanSkillDirs(moduleBaseAbs);
    const skillRelPaths = skillNames.map((n) => (relModuleDirPosix === '.' ? n : `${relModuleDirPosix}/${n}`));

    const rawPlugin = {
        name: plugin.code,
        description: plugin.description || '',
        version: plugin.version || null,
        source: relModuleDirPosix,
        // Empty when the module dir has no SKILL.md subdirs — resolvePlugin then
        // returns [] and the FR238 guard aborts cleanly (zero installable modules).
        skills: skillRelPaths,
    };

    const localPath = entrySourceUrl ? null : entryRootDir;
    const resolved = await resolvePluginFn(entryRootDir, rawPlugin, entrySourceUrl, localPath);

    return { plugin, rawPlugin, resolved, entryRootDir };
}

/**
 * Registry-mode counterpart of {@link stageCustomMarketplaceSubset}. For each
 * selected registry entry it clones the entry's `repository`, resolves the
 * pointed module, and stages the resolved content into the SAME project-local
 * stage directory the discovery/direct path uses — but namespaced under the
 * entry's `code/` so modules pulled from DIFFERENT repositories can never
 * collide on a shared relative path. Enforces the same FR238 non-empty +
 * unique-leaf guard, then returns the same `{ stagePath, customSourceArg,
 * resolvedModules }` shape so lib/bmad.js#installCustomMarketplaceSubset installs
 * it identically via `buildBmadArgs` + `--custom-source`.
 *
 * @param {Object} ctx
 * @param {string} ctx.source - Original registry source string (messages only).
 * @param {Array<Object>} ctx.plugins - Full enumerated registry entry list.
 * @param {string[]} ctx.selectedCodes
 * @param {string} ctx.projectRoot
 * @param {Object} [ctx.deps] - Injectable seams (tests): { resolveSource, resolvePlugin }.
 * @returns {Promise<{ stagePath: string, customSourceArg: string, resolvedModules: Array<Object> }>}
 * @throws {CustomMarketplaceError}
 */
async function stageRegistrySubset({ source, plugins, selectedCodes, projectRoot, deps = {} }) {
    projectRoot = path.resolve(projectRoot);
    const { mgr } = assertCustomModuleManagerSurface();
    const resolveSourceFn = deps.resolveSource || ((input, opts) => mgr.resolveSource(input, opts));
    const resolvePluginFn =
        deps.resolvePlugin || ((repoPath, rawPlugin, url, local) => mgr.resolvePlugin(repoPath, rawPlugin, url, local));

    const selectedSet = new Set(selectedCodes);
    const selected = (plugins || []).filter((p) => selectedSet.has(p.code));
    if (selected.length === 0) {
        throw new CustomMarketplaceError(
            `None of the selected codes (${[...selectedSet].join(', ') || '(none)'}) matched a ` +
            `registry entry — nothing to stage.`
        );
    }

    // Each entry is staged under its own `code/` namespace, so two selected
    // entries sharing a code would silently overwrite each other. enumerate
    // de-dupes by `name`, but a malformed registry could give two differently-
    // named entries the same `code` — reject that here rather than stage a
    // corrupt subset (FR238 fail-clean).
    const seenCodes = new Set();
    for (const p of selected) {
        if (seenCodes.has(p.code)) {
            throw new CustomMarketplaceError(
                `Two selected registry entries share the code '${p.code}' — codes must be unique ` +
                `to install. Aborting before staging (FR238).`
            );
        }
        seenCodes.add(p.code);
    }

    // Resolve every selected entry (each from its own clone) BEFORE touching the
    // stage dir, so an unreachable/stale entry aborts clean with nothing staged.
    const entries = [];
    for (const plugin of selected) {
        entries.push(await resolveRegistryEntry(plugin, resolveSourceFn, resolvePluginFn));
    }

    const allModules = assertResolutionNonEmptyAndUniqueLeaves(
        entries.map(({ plugin, rawPlugin, resolved }) => ({ plugin, rawPlugin, resolved })),
        { source, mode: 'registry' }
    );

    const stagePath = prepareCleanStageDir(projectRoot);

    // Copy each entry's resolved content under a `code/` namespace so entries
    // cloned from different repos never overwrite each other, and rewrite the
    // staged rawPlugin's skill/source paths to match that namespace so
    // bmad-method's re-resolution against the stage reproduces the identical
    // module (skills at code/<rel>, module.yaml at their common parent).
    const stagedPlugins = [];
    try {
        for (const { plugin, resolved, entryRootDir } of entries) {
            const prefix = plugin.code;
            const relFromEntry = (absSrc) => toPosix(path.relative(entryRootDir, absSrc));
            const copyUnderPrefix = (absSrc) => {
                const dest = path.join(stagePath, prefix, ...relFromEntry(absSrc).split('/'));
                fs.copySync(absSrc, dest, { overwrite: true, dereference: true });
            };

            const stagedSkills = [];
            for (const mod of resolved) {
                for (const skillPath of mod.skillPaths) {
                    copyUnderPrefix(skillPath);
                    stagedSkills.push(`${prefix}/${relFromEntry(skillPath)}`);
                }
                if (mod.moduleYamlPath) copyUnderPrefix(mod.moduleYamlPath);
                if (mod.moduleHelpCsvPath) copyUnderPrefix(mod.moduleHelpCsvPath);
            }

            stagedPlugins.push({
                name: plugin.code,
                description: plugin.description || '',
                version: plugin.version || null,
                source: prefix,
                skills: stagedSkills,
            });
        }
    } catch (err) {
        try { fs.removeSync(stagePath); } catch { /* swallow — primary error wins */ }
        throw new CustomMarketplaceError(`Staging the registry subset failed: ${err.message}`, { cause: err });
    }

    const marketplaceDir = path.join(stagePath, '.claude-plugin');
    fs.mkdirpSync(marketplaceDir);
    fs.writeFileSync(
        path.join(marketplaceDir, 'marketplace.json'),
        JSON.stringify({ name: 'ma-agents-custom-registry-subset', plugins: stagedPlugins }, null, 2)
    );

    const customSourceArg = `./${CUSTOM_MARKETPLACE_STAGE_DIR_NAME}`;
    return { stagePath, customSourceArg, resolvedModules: allModules };
}

// ─── Story 30.7 — persist + re-enumerate/reconcile on update ───────────────

/**
 * Pure reconcile — no I/O. Compares a freshly re-enumerated plugin list
 * against the PERSISTED selection from a prior install and reports the
 * difference. Newly-appeared plugins are reported only — never added to the
 * returned selection (FR242's "report only" contract); the caller decides
 * what to do with `added`/`removed` (typically: print a report, and re-install
 * only `stillPresent`).
 *
 * @param {Object} ctx
 * @param {string[]} ctx.persistedSelectedCodes - The previously-persisted `selectedCodes`.
 * @param {Array<{ code: string }>} ctx.enumeratedPlugins - Fresh `enumerateCustomSource()` output.
 * @returns {{ added: string[], removed: string[], stillPresent: string[] }}
 *   `added` — declared now but not previously selected (report only, not auto-selected).
 *   `removed` — previously selected but no longer declared by the source.
 *   `stillPresent` — previously selected AND still declared (safe to re-install as-is).
 */
function reconcileCustomMarketplaceSelection({ persistedSelectedCodes, enumeratedPlugins }) {
    const persistedSet = new Set(persistedSelectedCodes || []);
    const enumeratedCodes = (enumeratedPlugins || []).map((p) => p.code);
    const enumeratedSet = new Set(enumeratedCodes);

    const added = enumeratedCodes.filter((c) => !persistedSet.has(c));
    const removed = [...persistedSet].filter((c) => !enumeratedSet.has(c));
    const stillPresent = [...persistedSet].filter((c) => enumeratedSet.has(c));

    return { added, removed, stillPresent };
}

module.exports = {
    CUSTOM_MODULE_MANAGER_PATH,
    REQUIRED_METHODS,
    NFR71_WARNING,
    CustomMarketplaceError,
    assertCustomModuleManagerSurface,
    enumerateCustomSource,
    // Story 30.6b — prune + stage the selected subset
    CUSTOM_MARKETPLACE_STAGE_DIR_NAME,
    scanDirectModeSkillDirs,
    scanSkillDirs,
    resolveSelectedPlugins,
    assertResolutionNonEmptyAndUniqueLeaves,
    stageCustomMarketplaceSubset,
    // Registry-index mode (this story)
    REGISTRY_DIR_NAME,
    REGISTRY_OFFICIAL_INDEX,
    REGISTRY_COMMUNITY_INDEX,
    registryTrustLabel,
    detectRegistryLayout,
    parseRegistryIndex,
    normalizeRegistryEntry,
    enumerateRegistrySource,
    resolveRegistryEntry,
    stageRegistrySubset,
    // Story 30.7 — persist + reconcile on update
    reconcileCustomMarketplaceSelection,
};
