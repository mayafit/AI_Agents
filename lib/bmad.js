const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync, execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const chalk = require('chalk');
const yaml = require('yaml');
const jsYaml = require('js-yaml');
const { withExperimentalWarningSuppressed } = require('./warning-filter');

/**
 * Build the env object passed to the bmad-method child spawn.
 * Extends parent env with GIT_TERMINAL_PROMPT=0 and a NODE_OPTIONS
 * value that silences the ExperimentalWarning about CJS require() of
 * an ES Module (Bug A). Callers that need a different NODE_OPTIONS
 * can merge after this call.
 *
 * @param {NodeJS.ProcessEnv} [parentEnv=process.env]
 * @returns {NodeJS.ProcessEnv}
 */
function buildChildSpawnEnv(parentEnv = process.env) {
    return {
        ...parentEnv,
        GIT_TERMINAL_PROMPT: '0',
        // Bug A — keep the bmad-method child as quiet about CJS-require-ESM
        // as the parent. Preserves any NODE_OPTIONS the user already set.
        NODE_OPTIONS: withExperimentalWarningSuppressed(parentEnv.NODE_OPTIONS),
    };
}

const BMAD_DIR = '_bmad';
const CONFIG_DIR = path.join(BMAD_DIR, '_config', 'agents');

// ── Canonical config paths (Story 22.7) ─────────────────────────────────────
//
// BMAD v6.3.0 (PR #2159) removed the `bmad-init` skill and moved the canonical
// project config from `_bmad/_config/manifest.yaml` to `_bmad/bmm/config.yaml`.
// All ma-agents code paths and skills MUST read from CANONICAL_CONFIG_REL.
//
// LEGACY_MANIFEST_REL is kept ONLY as a detection marker for the migration
// shim in ensureCanonicalConfigLocation() below — it is NEVER read silently
// as a value source. The stale-module surgery in runUpdateStep() still
// references it because that code cleans up pre-6.3 install artifacts before
// handing control to bmad-method; the cleanup is a write-path, not a
// canonical-config read.
const CANONICAL_CONFIG_REL = path.join(BMAD_DIR, 'bmm', 'config.yaml');
const LEGACY_MANIFEST_REL = path.join(BMAD_DIR, '_config', 'manifest.yaml');

/**
 * Project-relative directory name used to stage the bundled plugin
 * (`lib/bmad-extension-plugin/`) before invoking `bmad-method install
 * --custom-source <stage-path>`.
 *
 * Kept as a module-level constant (not an env-var) so the path is stable
 * across runs and easy for operators to inspect after a failed install.
 * See Story 22.8 (adds this path to the ma-agents-managed .gitignore).
 */
const PLUGIN_STAGE_DIR_NAME = '.ma-agents-plugin-stage';

/**
 * Copy the bundled plugin (`lib/bmad-extension-plugin/`) into the target
 * project at `<projectRoot>/.ma-agents-plugin-stage/` so that bmad-method
 * 6.3.0's PluginResolver (local-file strategy) can install it via
 * `--custom-source <stage-path>`.
 *
 * Contract (Story 22.6 AC 2, AC 3):
 *   - Produces a fresh byte-identical copy of the source tree (not a symlink,
 *     not a hardlink). fs-extra's `copySync` performs a recursive file copy;
 *     combined with the pre-copy wipe below it guarantees the stage is a
 *     clean snapshot of the build output.
 *   - Any pre-existing stage directory (left over from a prior failed install)
 *     is removed first so content never merges across runs. This mirrors
 *     `scripts/build-plugin.js`'s own wipe-and-recreate pattern and defends
 *     against cross-version skill bleed (the skill catalog renamed in 22.2).
 *   - On platforms where the source contains symlinks, they are dereferenced
 *     by `fs-extra.copySync` (`dereference: true`) — the stage is a flat copy
 *     so a BMAD installer that writes into the stage never touches repo source.
 *
 * Return shape:
 *   `{ stagePath, customSourceArg }` — where `stagePath` is the absolute path
 *   used for filesystem work (remove on cleanup, surface on failure) and
 *   `customSourceArg` is what to pass to bmad-method's `--custom-source`.
 *   Why split them: bmad-method 6.3.0's `parseSource()` only treats strings
 *   starting with `/`, `./`, `../`, or `~` as local paths; a Windows
 *   absolute like `D:\path\...` falls through to "Not a valid Git URL or
 *   local path" and the plugin silently fails to resolve. We pass the
 *   relative form `./<dir>` (the installer runs with cwd = projectRoot, so
 *   it resolves to the same absolute path) to stay cross-platform safe.
 *
 * @param {string} projectRoot - Absolute path to the target project
 * @returns {{ stagePath: string, customSourceArg: string }}
 * @throws {Error} If the source plugin bundle is missing (build was skipped)
 */
function stagePlugin(projectRoot) {
    // Edge-case #2 — normalize to absolute FIRST. Callers may pass a relative
    // `./some-project` path; downstream `fs.statSync` / `path.join` then
    // resolve against the current cwd, which differs between the ma-agents
    // CLI process and the bmad-method child (runCommand sets cwd = projectRoot).
    // Resolving here once keeps every subsequent path op unambiguous.
    // path.resolve does NOT require the path to exist, so it's safe to run
    // before the existence check below.
    projectRoot = path.resolve(projectRoot);
    // Import inside the function so unit-tests can exercise the helper without
    // the build-plugin.js require-chain loading the full pipeline.
    const { OUT_DIR: pluginBundlePath } = require('../scripts/build-plugin');
    if (!fs.existsSync(pluginBundlePath)) {
        throw new Error(
            `Bundled plugin not found at ${pluginBundlePath} — run \`npm run build:plugin\` before installing.`
        );
    }
    // Edge-case #1 — the bundle directory may exist but be empty (half-built
    // or a partially wiped prior `scripts/build-plugin.js` run). Verify the
    // two load-bearing manifests are present before we copy anything; without
    // these, bmad-method's PluginResolver would either silently install a
    // no-op or throw deep in its pipeline with a less diagnosable message.
    const requiredBundleEntries = [
        path.join('.claude-plugin', 'marketplace.json'),
        path.join('skills', 'module.yaml'),
    ];
    for (const rel of requiredBundleEntries) {
        const abs = path.join(pluginBundlePath, rel);
        if (!fs.existsSync(abs)) {
            throw new Error(
                `Bundled plugin at ${pluginBundlePath} is missing required file ` +
                `"${rel}" — run \`npm run build:plugin\` to regenerate a complete bundle.`
            );
        }
    }
    if (!fs.existsSync(projectRoot)) {
        throw new Error(
            `Cannot stage plugin — projectRoot does not exist: ${projectRoot}`
        );
    }
    // Edge-case #3 — projectRoot must be a directory. A caller passing a file
    // path would otherwise surface as a confusing EEXIST/ENOTDIR deep inside
    // the fs.copySync call. Fail fast with a clear message.
    if (!fs.statSync(projectRoot).isDirectory()) {
        throw new Error(
            `Cannot stage plugin — projectRoot is not a directory: ${projectRoot}`
        );
    }
    const stagePath = path.join(projectRoot, PLUGIN_STAGE_DIR_NAME);
    // Remove any stale stage left behind by a previous failed install.
    // Merging old and new content would risk shipping retired skill IDs
    // (Story 22.2) and break the byte-identical guarantee in AC 3.
    //
    // Security: reject a stage path that IS a symlink before removing it.
    // Without this check, fs.removeSync follows the link and could delete
    // content outside the project (e.g., if an attacker or a careless user
    // pre-created `.ma-agents-plugin-stage` as a symlink to a home dir).
    if (fs.existsSync(stagePath)) {
        const stageLstat = fs.lstatSync(stagePath);
        if (stageLstat.isSymbolicLink()) {
            throw new Error(
                `Refusing to stage plugin — ${stagePath} is a symbolic link. ` +
                `Remove it manually and re-run; ma-agents will not follow symlinks ` +
                `inside the project root for safety.`
            );
        }
        // Edge-case #5 — on Windows, a prior install may still hold file
        // handles (EBUSY/EPERM). Re-throw with context so the operator knows
        // which path failed and can close the offending process.
        try {
            fs.removeSync(stagePath);
        } catch (err) {
            throw new Error(
                `Cannot wipe stale stage ${stagePath}: ${err.message}`
            );
        }
    }
    // `dereference: true` copies symlink targets as regular files — we never
    // want a symlink inside the stage pointing back into repo source, because
    // bmad-method may write into the staged plugin during install.
    //
    // Edge-case #6 — if the copy aborts mid-tree (disk full, permission flip,
    // user Ctrl+C at the OS layer), the partial stage would be merged on next
    // run and break AC 3's byte-identical guarantee. Best-effort remove the
    // half-populated stage, then rethrow with a contextual message.
    try {
        fs.copySync(pluginBundlePath, stagePath, { overwrite: true, dereference: true });
    } catch (err) {
        try { fs.removeSync(stagePath); } catch { /* swallow — primary error wins */ }
        throw new Error(`Stage copy failed: ${err.message}`);
    }
    // POSIX-style `./<dir>` satisfies BMAD's parseSource() local-path detector
    // on both Linux/macOS and Windows. The installer's cwd is always
    // projectRoot (see runCommand calls below), so this resolves identically
    // to `stagePath`.
    const customSourceArg = `./${PLUGIN_STAGE_DIR_NAME}`;
    console.log(chalk.gray(`  Staged plugin: ${stagePath}`));
    return { stagePath, customSourceArg };
}

/**
 * Remove the plugin stage directory produced by {@link stagePlugin}.
 *
 * Call this only after the bmad-method install succeeds. On failure we
 * deliberately leave the stage in place (Story 22.6 AC 6) so operators can
 * inspect exactly what was about to be installed and re-run BMAD directly
 * with `--custom-source <stage>` as a bypass.
 *
 * @param {string} stagePath - Absolute path returned by stagePlugin()
 * @returns {void}
 */
function cleanupStage(stagePath) {
    if (!stagePath) return;
    try {
        // Edge-case #4 — if the path is (now) a symlink, unlink ONLY the link.
        // `fs.removeSync` on a symlink-to-directory would recurse into the
        // target and could delete files outside the project root (e.g., if a
        // concurrent process replaced the stage with a symlink between
        // stagePlugin() and cleanupStage()). `lstatSync` does not follow the
        // link; `unlinkSync` removes the link entry without touching the
        // target.
        if (fs.existsSync(stagePath)) {
            const lst = fs.lstatSync(stagePath);
            if (lst.isSymbolicLink()) {
                fs.unlinkSync(stagePath);
                console.log(chalk.gray(`  Removed plugin stage symlink: ${stagePath}`));
                return;
            }
        }
        fs.removeSync(stagePath);
        console.log(chalk.gray(`  Removed plugin stage directory: ${stagePath}`));
    } catch (err) {
        // Non-fatal — surface a warning so the operator can clean up manually.
        // We do not rethrow because the install itself succeeded; leaving the
        // stage on disk is a cosmetic issue compared to breaking an otherwise
        // green install.
        console.warn(
            chalk.yellow(
                `  Warning: failed to remove plugin stage directory at ${stagePath}: ${err.message}`
            )
        );
    }
}

/**
 * F2a — Ensure the **project-root** `.gitignore` lists the plugin-stage
 * directory exactly once. The single canonical write site for the Story 22.8
 * policy: every BMAD orchestrator that calls `stagePlugin(projectRoot)` must
 * call this immediately afterwards (or beforehand) with the same `projectRoot`.
 *
 * Why this lives here, not in the installer:
 *   - The reason the entry exists is `stagePlugin()` writing
 *     `<projectRoot>/.ma-agents-plugin-stage/`. The two operations belong
 *     together so a future maintainer sees them as one unit.
 *   - The pre-F2a placement (inside `installSkill()` per-agent loop) wrote
 *     per-skill-dir `.gitignore` files because `installPath` is the agent's
 *     skills directory, not the project root. Moving the call here makes
 *     the project-root contract self-evident.
 *
 * Lazy-require — `lib/installer.js` requires `./bmad` for `PLUGIN_STAGE_DIR_NAME`
 * at module top, so a top-level require of installer here would create a
 * load-order circular dependency. The runtime `require('./installer')` below
 * is safe because installer's exports object is fully populated by the time
 * this function is invoked (after CLI startup).
 *
 * Failure policy — gitignore management is cosmetic relative to the install.
 * If writing the file fails (permission denied, read-only fs, ENOSPC), we
 * surface a warning and continue rather than aborting an otherwise-green
 * install. The install will have produced no observable side effect under
 * the project's `.gitignore` policy in that case, which is the same outcome
 * as a project that already lists the entry.
 *
 * @param {string} projectRoot - Absolute path to the target project root
 *   (the directory containing the project's top-level `.gitignore`).
 * @returns {void}
 */
function ensurePluginStageGitignoredForProject(projectRoot) {
    if (typeof projectRoot !== 'string' || projectRoot.length === 0) return;
    let installer;
    try {
        installer = require('./installer');
    } catch (err) {
        // Installer module failed to load — should never happen in a valid
        // install, but if it does we cannot do anything useful here.
        console.warn(chalk.yellow(`  Warning: could not load installer for gitignore policy: ${err.message}`));
        return;
    }
    if (typeof installer.ensurePluginStageIgnored === 'function') {
        try {
            installer.ensurePluginStageIgnored(projectRoot);
        } catch (err) {
            // EACCES on read-only `.gitignore`, EROFS on read-only filesystem, etc.
            // Logged so the operator can fix it manually; never fatal to the install.
            console.warn(
                chalk.yellow(
                    `  Warning: could not update ${path.join(projectRoot, '.gitignore')} with plugin-stage entry: ${err.message}`
                )
            );
        }
    }

    // Bug 27.11 — also ensure the regenerated, installer-managed `_bmad/` tree is
    // gitignored. Same project-root contract and same non-fatal failure policy as
    // the plugin-stage entry above. `_bmad-output/` is intentionally left tracked
    // (see ensureBmadOutputTracked) and is not matched by these patterns.
    if (typeof installer.ensureBmadDirIgnored === 'function') {
        try {
            installer.ensureBmadDirIgnored(projectRoot);
        } catch (err) {
            console.warn(
                chalk.yellow(
                    `  Warning: could not update ${path.join(projectRoot, '.gitignore')} with _bmad/ entry: ${err.message}`
                )
            );
        }
    }

    // Story 29.1 — ensure the Knowledge Atlas site output directory is gitignored.
    // `_bmad-output/knowledge-site/` is transient (regenerated on each skill run)
    // and must not be committed. `_bmad-output/` itself remains tracked.
    if (typeof installer.ensureKnowledgeSiteIgnored === 'function') {
        try {
            installer.ensureKnowledgeSiteIgnored(projectRoot);
        } catch (err) {
            console.warn(
                chalk.yellow(
                    `  Warning: could not update ${path.join(projectRoot, '.gitignore')} with knowledge-site/ entry: ${err.message}`
                )
            );
        }
    }
}

/**
 * Run a shell command, relaying output to stdout/stderr.
 * Always uses pipe mode so that on failure, error.stdout and error.stderr
 * are populated — enabling classifyRecompileFailure to detect EBUSY and
 * other subprocess errors by inspecting their text.
 * Output is manually relayed to the terminal on success; on failure the
 * subprocess output is relayed before rethrowing so the user still sees it.
 */
function runCommand(command, options = {}) {
    try {
        const result = execSync(command, { ...options, stdio: 'pipe' });
        if (result && result.length > 0) {
            process.stdout.write(result);
        }
    } catch (err) {
        if (err.stdout && err.stdout.length > 0) process.stdout.write(err.stdout);
        if (err.stderr && err.stderr.length > 0) process.stderr.write(err.stderr);
        throw err;
    }
}

function getBmadCommand(args) {
    // bmad-method 6.3.0 replaced the `tools/bmad-npx-wrapper.js` entry point
    // with `tools/installer/bmad-cli.js` (see `bin.bmad-method` in the
    // upstream package.json). Prefer the new entry; fall back to the legacy
    // wrapper path only to keep older local checkouts working during a
    // partial upgrade (defensive — the test suite pins the installed version).
    const candidates = [
        'bmad-method/tools/installer/bmad-cli.js',
        'bmad-method/tools/bmad-npx-wrapper.js',
    ];
    let lastError = null;
    for (const candidate of candidates) {
        try {
            const resolved = require.resolve(candidate);
            return `node "${resolved}" ${args}`;
        } catch (err) {
            // Remember the last failure so diagnostics can chain back to the
            // actual MODULE_NOT_FOUND / ENOENT from require.resolve.
            lastError = err;
        }
    }
    const wrapped = new Error(
        'bmad-method CLI entry point not found in node_modules — run "npm install" first'
    );
    if (lastError) {
        wrapped.cause = lastError;
    }
    throw wrapped;
}

function isBmadInstalled(projectRoot = process.cwd()) {
    return fs.existsSync(path.join(projectRoot, BMAD_DIR));
}

/**
 * Returns true when the operator has explicitly declared offline mode via env.
 *
 * Use `MA_AGENTS_OFFLINE=1` (or `true`) on air-gapped hosts so the installer
 * skips network-dependent diagnostics and emits actionable guidance instead
 * of bubbling a raw upstream `git fetch` failure.
 *
 * @returns {boolean}
 */
function isOfflineModeDeclared() {
    const flag = String(process.env.MA_AGENTS_OFFLINE || '').trim().toLowerCase();
    return flag === '1' || flag === 'true' || flag === 'yes';
}

/**
 * Heuristic: does the caught recompile error look like a network failure?
 *
 * bmad-method 6.2.2 always shells out to `git fetch` / `git clone` / `npm install`
 * against external module repos. On an air-gapped host those commands fail with
 * recognizable DNS/routing/git errors. We match on common substrings rather than
 * exit codes because execSync collapses everything into a single Error.message.
 *
 * @param {Error} error - The error thrown from runCommand() during recompile
 * @returns {boolean}
 */
function looksLikeOfflineFailure(error) {
    if (!error || !error.message) {
        return false;
    }
    const haystack = `${error.message} ${error.stderr || ''} ${error.stdout || ''}`.toLowerCase();
    const needles = [
        'enotfound',
        'getaddrinfo',
        'could not resolve host',
        'could not resolve',
        'network is unreachable',
        'connection refused',
        'connection timed out',
        'etimedout',
        'econnrefused',
        'econnreset',
        'unable to access',
        'failed to connect',
        'fatal: unable to',
        'git fetch',
        'git clone',
        // Intentionally NOT matching bare 'proxy' / 'ssl' / 'certificate' —
        // those words appear in benign error messages (e.g. YAML errors that
        // reference certificate-generation skills) and would cause false
        // positives that push non-network failures through the offline path.
    ];
    return needles.some(n => haystack.includes(n));
}

/**
 * Heuristic: does the caught recompile error look like a Windows EBUSY lock?
 *
 * On Windows, rmdir calls during BMAD recompile can fail with EBUSY (resource
 * busy or locked) because Windows Defender or Explorer holds a file lock on
 * newly-created directories. This is a transient OS-level condition that
 * does not indicate a real installation failure — treat it as warn-and-continue.
 *
 * @param {Error} error - The error thrown from runCommand() during recompile
 * @returns {boolean}
 */
function looksLikeEbusyFailure(error) {
    const msg = [error?.message, error?.stderr, error?.stdout]
        .filter(Boolean).join(' ').toLowerCase();
    return msg.includes('ebusy') || msg.includes('resource busy') || msg.includes('resource busy or locked');
}

/**
 * Inspect the vendored BMAD cache (post pre-population) and report which
 * modules are present. Used to classify recompile failures: when the cache is
 * intact we can safely downgrade an offline-mode failure to a warning.
 *
 * @param {string} [cacheRoot] - Override the cache dir (primarily for tests)
 * @returns {{ present: string[], missing: string[], intact: boolean, cacheDir: string }}
 */
function inspectBmadCache(cacheRoot) {
    const cacheDir = cacheRoot || path.join(os.homedir(), '.bmad', 'cache', 'external-modules');
    const manifestPath = path.join(__dirname, 'bmad-cache', 'cache-manifest.json');

    let expected = [];
    try {
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            expected = Object.keys(manifest.modules || {});
        }
    } catch {
        // If the manifest is unreadable, treat the cache as not-intact so the
        // caller surfaces a loud error rather than silently proceeding.
        expected = [];
    }

    const present = [];
    const missing = [];
    for (const mod of expected) {
        if (fs.existsSync(path.join(cacheDir, mod))) {
            present.push(mod);
        } else {
            missing.push(mod);
        }
    }

    return {
        present,
        missing,
        intact: expected.length > 0 && missing.length === 0,
        cacheDir,
    };
}

/**
 * Human-readable descriptions for each BMAD module shipped in the bundled
 * cache. Surfaced by the install wizard's module-selection prompt so users
 * know what they're enabling. Keyed by module id; missing keys fall back to
 * the bare id at the call site.
 */
const BMAD_MODULE_DESCRIPTIONS = Object.freeze({
    bmm: 'BMad Method core — analyst, PM, architect, dev, UX, tech-writer (required)',
    bmb: 'BMad Builder — agent, module, and workflow builders',
    cis: 'Creative Intelligence Suite — innovation and ideation toolkit',
    gds: 'Game Dev Studio — game development workflows',
    tea: 'Test Architecture Enterprise — Test Architect (Murat) + 9 testarch workflows',
    wds: 'Whiteport Design Studio — strategic UX and design-first planning',
});

/**
 * Return the BMAD modules this ma-agents bundle can install. `bmm` (the
 * BMad core) is always first because it ships inside the `bmad-method`
 * npm dependency itself, not in `lib/bmad-cache/` — the cache only carries
 * the optional external modules (bmb, cis, gds, tea, wds, ...).
 *
 * Each entry carries a `retired` flag so the caller can hide modules that
 * have been retired upstream (driven by the manifest's `retiredUpstream`
 * marker; at v6.8.0 the bundled set — tea, bmb, cis, gds, wds — are all
 * active `type: bmad-org` clones, so none are flagged).
 *
 * If the cache manifest is missing or unreadable, falls back to a list
 * containing only `bmm` — that's the minimum a successful install needs.
 *
 * @returns {Array<{ id: string, retired: boolean, description: string }>}
 */
function getInstallableBmadModules() {
    const manifestPath = path.join(__dirname, 'bmad-cache', 'cache-manifest.json');
    const bmmEntry = {
        id: 'bmm',
        retired: false,
        description: BMAD_MODULE_DESCRIPTIONS.bmm,
    };
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
        return [bmmEntry];
    }
    const cacheEntries = Object.entries(manifest.modules || {}).map(([id, meta]) => ({
        id,
        retired: !!(meta && meta.retiredUpstream),
        description: BMAD_MODULE_DESCRIPTIONS[id] || `(${id})`,
    }));
    return [bmmEntry, ...cacheEntries];
}

/**
 * Detect which BMad modules are already installed under a given project
 * root by checking for `_bmad/<id>/` directories. Used by the install
 * wizard's update path to pre-check the user's existing module set.
 *
 * @param {string} projectRoot - Absolute or relative project root
 * @returns {string[]} Module ids that have a corresponding `_bmad/<id>/` dir
 */
function getInstalledBmadModules(projectRoot) {
    if (!projectRoot) return [];
    const bmadDir = path.join(projectRoot, BMAD_DIR);
    if (!fs.existsSync(bmadDir)) return [];
    const installable = getInstallableBmadModules().map(m => m.id);
    return installable.filter(id => fs.existsSync(path.join(bmadDir, id)));
}

/**
 * Validate a user-supplied module list (e.g. parsed from `--bmad-modules
 * tea,bmb`) against the set of installable modules and ensure `bmm` is
 * always present. Without `bmm` the BMad core agents (analyst, PM, dev,
 * architect, ...) are absent and downstream skills break, so we force-add
 * it rather than letting the user shoot themselves in the foot.
 *
 * @param {Object} ctx
 * @param {string[]} ctx.requested - Module ids the user asked for
 * @param {Array<{id: string}>} ctx.available - Installable modules (already
 *   filtered for retirement at the call site if desired)
 * @returns {string[]} The validated, deduped, bmm-forced module list
 * @throws {Error} If any requested id is not in `available`
 */
function resolveBmadModules(ctx) {
    if (!ctx || !Array.isArray(ctx.requested) || !Array.isArray(ctx.available)) {
        throw new Error(
            'resolveBmadModules requires ctx with requested (array) and available (array)'
        );
    }
    const availableIds = new Set(ctx.available.map(m => m.id));
    const requested = ctx.requested.map(s => String(s).trim()).filter(Boolean);
    const invalid = requested.filter(id => !availableIds.has(id));
    if (invalid.length > 0) {
        const knownList = ctx.available.map(m => m.id).join(', ');
        throw new Error(
            `Unknown BMAD module(s): ${invalid.join(', ')}. Available: ${knownList}`
        );
    }
    const result = requested.includes('bmm') ? [...requested] : ['bmm', ...requested];
    const seen = new Set();
    return result.filter(id => (seen.has(id) ? false : (seen.add(id), true)));
}

/**
 * Decide what to do when the BMAD recompile step throws.
 *
 * Classifies the failure and returns a structured diagnosis so the caller can:
 *   (a) 'warn'    — downgrade to a yellow diagnostic and proceed
 *                    (offline + cache intact)
 *   (b) 'error'   — print an actionable red error listing missing modules
 *                    and the remediation command (offline + cache incomplete)
 *   (c) 'rethrow' — the failure does not look offline-related; historically
 *                    the caller in applyCustomizations() prints red and
 *                    continues (we preserve that behaviour to avoid breaking
 *                    the install pipeline when a non-network error happens
 *                    mid-pipeline). Callers that want harder failure semantics
 *                    can throw on `action === 'rethrow'` themselves.
 *
 * Keeping this pure/sync makes it trivial to unit-test without spawning
 * subprocesses.
 *
 * Note on cache validity: we only verify module *directory presence*, not
 * structural integrity. prePopulateBmadCache() runs immediately before
 * recompile and performs structural repair (see its structurallyBroken
 * check), so by the time this classifier is consulted the cache is either
 * present-and-repaired or absent.
 *
 * @param {Error} error - The error thrown from runCommand()
 * @param {Object} [opts]
 * @param {Function} [opts.cacheInspector] - Override for testing
 * @returns {{ action: 'warn' | 'error' | 'rethrow', message: string, missing?: string[] }}
 */
function classifyRecompileFailure(error, opts = {}) {
    const declaredOffline = isOfflineModeDeclared();
    const looksOffline = looksLikeOfflineFailure(error);
    const inspector = opts.cacheInspector || inspectBmadCache;

    // EBUSY: Windows file-lock transient error — warn and continue.
    // Windows Defender / Explorer can briefly lock newly-created directories
    // during BMAD recompile. This is not a real failure; downgrade to a warning
    // so the install pipeline is not cancelled on a transient OS condition.
    if (looksLikeEbusyFailure(error)) {
        return {
            action: 'warn',
            reason: 'ebusy',
            message:
                'BMAD recompile encountered a Windows file-lock (EBUSY / resource busy or locked). ' +
                'This is a transient condition (Windows Defender or Explorer briefly held a lock). ' +
                'The install will proceed — re-run if BMAD personas appear incomplete.',
        };
    }

    if (!declaredOffline && !looksOffline) {
        return {
            action: 'rethrow',
            message: error && error.message ? error.message : 'unknown error',
        };
    }

    const cache = inspector();

    if (cache.intact) {
        return {
            action: 'warn',
            message:
                'BMAD recompile reported a network-related failure, but the vendored cache is intact — ' +
                `proceeding with cached modules (${cache.present.join(', ')}). ` +
                'Set MA_AGENTS_OFFLINE=1 on air-gapped hosts to silence this diagnostic.',
        };
    }

    return {
        action: 'error',
        missing: cache.missing,
        message:
            'BMAD recompile failed on an air-gapped host and the vendored cache is incomplete. ' +
            `Missing modules: ${cache.missing.join(', ') || '(cache manifest unreadable)'}. ` +
            'Remediation: on a connected host run `npm run build:bmad-cache` then re-run the installer; ' +
            `or copy a populated cache into ${cache.cacheDir}.`,
    };
}

/**
 * Resolve the correct CLI flag for passing extension/custom-module sources.
 *
 * bmad-method 6.3.0 renamed `--custom-content` to `--custom-source`. To keep
 * the builder working across both versions (and to survive local downgrades),
 * grep the installed install command for the newer flag first and fall back
 * to the legacy name. We read once and cache the result because buildBmadArgs
 * can be called repeatedly during a single install flow.
 *
 * @returns {'--custom-source' | '--custom-content'}
 */
let _cachedCustomContentFlag = null;
function resolveCustomContentFlag() {
    if (_cachedCustomContentFlag) return _cachedCustomContentFlag;
    const candidates = [
        { path: 'bmad-method/tools/installer/commands/install.js', flags: ['--custom-source', '--custom-content'] },
        { path: 'bmad-method/tools/cli/commands/install.js', flags: ['--custom-source', '--custom-content'] },
    ];
    for (const { path: relPath, flags } of candidates) {
        try {
            const resolved = require.resolve(relPath);
            const content = fs.readFileSync(resolved, 'utf8');
            for (const flag of flags) {
                if (content.includes(flag)) {
                    _cachedCustomContentFlag = flag;
                    return flag;
                }
            }
        } catch {
            // try next
        }
    }
    // Defensive default — keep older behavior if we cannot inspect the installed
    // package. The installer will fail loudly with an unknown-flag error, which
    // is a safer failure mode than silently dropping the extension.
    _cachedCustomContentFlag = '--custom-content';
    return _cachedCustomContentFlag;
}

/**
 * Build a complete bmad-method CLI command from an install context object.
 * Replaces ad-hoc string concatenation with a single authoritative builder.
 * Architecture Decision P2-6.
 *
 * @param {Object} ctx - Install context
 * @param {string} ctx.projectRoot - Project root directory
 * @param {string[]} ctx.modules - Module IDs (e.g. ['bmm', 'bmb'])
 * @param {string[]} ctx.tools - Tool/IDE IDs (e.g. ['claude-code', 'cursor'])
 * @param {string} ctx.action - 'install' (default) or 'update'
 * @param {string} [ctx.userName] - User name for agents
 * @param {string} [ctx.commLang] - Communication language
 * @param {string} [ctx.docLang] - Document output language
 * @param {string} [ctx.outputFolder] - Output folder relative to project root
 * @param {string} [ctx.customSource] - Absolute path to a staged plugin
 *   directory (Story 22.6). When provided, this is appended as
 *   `--custom-source <path>`; when omitted no extension flag is added.
 *   The legacy fallback to `lib/bmad-extension/` was removed when the
 *   stage-and-invoke flow replaced applyCustomizations().
 * @returns {string} Complete command string ready for execSync
 */
function buildBmadArgs(ctx) {
    if (!ctx || !ctx.projectRoot || !Array.isArray(ctx.modules)) {
        throw new Error('buildBmadArgs requires ctx with projectRoot (string) and modules (array)');
    }
    const parts = ['install'];

    parts.push('--directory', `"${ctx.projectRoot}"`);
    parts.push('--modules', ctx.modules.join(','));
    parts.push('--tools', ctx.tools && ctx.tools.length > 0 ? ctx.tools.join(',') : 'none');
    parts.push('--yes');

    // Optional params — only include if provided (let bmad-method default otherwise)
    if (ctx.userName) {
        parts.push('--user-name', `"${ctx.userName}"`);
    }
    if (ctx.commLang) {
        parts.push('--communication-language', `"${ctx.commLang}"`);
    }
    if (ctx.docLang) {
        parts.push('--document-output-language', `"${ctx.docLang}"`);
    }
    if (ctx.outputFolder) {
        parts.push('--output-folder', `"${ctx.outputFolder}"`);
    }

    // Story 22.6 — stage-and-invoke. When callers pass an explicit customSource
    // (the project-local `.ma-agents-plugin-stage/` directory produced by
    // stagePlugin()), we append it via the 6.3.0 `--custom-source` flag (with a
    // downgrade path to the legacy `--custom-content` name for local checkouts
    // that still run bmad-method 6.2.x). The hand-parsed `lib/bmad-extension/`
    // fallback that lived here was removed alongside applyCustomizations().
    if (ctx.customSource) {
        const flag = resolveCustomContentFlag();
        parts.push(flag, `"${ctx.customSource}"`);
    }

    if (ctx.action === 'update') {
        parts.push('--action', 'update');
    }

    return getBmadCommand(parts.join(' '));
}

/**
 * Common pre-install hook invoked at the top of every BMAD entry point
 * (installBmad, updateBmad, runMigration). Centralizing this makes it
 * obvious which actions every entry point shares, and lets us add new
 * shared pre-checks in one place rather than tracking N call sites.
 *
 * F3 Section 6 — added so updateBmad() and runMigration() also get the
 * canonical-config-location drift signal that installBmad() already has.
 *
 * Idempotency: ensureCanonicalConfigLocation is read-mostly (only writes
 * is a notice log when both legacy and canonical config exist, and only
 * sets the migration-needed flag in its return value when the legacy
 * file is the only one present). Calling it twice in a single entry-
 * point invocation (e.g. installBmad → runMigration) re-emits the same
 * notice, but:
 *   - The notice is informational, not destructive.
 *   - Operators upgrading from pre-6.3 see at most two identical lines,
 *     which is acceptable for a one-shot migration path.
 *   - Steady-state installs (canonical-only or fresh) emit zero notices.
 *
 * @param {string} projectRoot - Absolute path to the project root.
 * @returns {ReturnType<typeof ensureCanonicalConfigLocation>} The drift
 *   detection result so callers that need the `needsRegeneration` flag
 *   (e.g. installBmad's migration check) can use it without a second call.
 */
function preInstallHooks(projectRoot) {
    // Edge-case-hunter E6: guard against undefined / empty projectRoot
    // because path.join('', anything) silently resolves to a relative path
    // against the caller's cwd, which would surface the drift signal for
    // the WRONG project. Caller error must surface loud, not silently.
    if (!projectRoot || typeof projectRoot !== 'string') {
        throw new Error(
            `preInstallHooks: projectRoot must be a non-empty string (got ${JSON.stringify(projectRoot)})`
        );
    }
    // Story 22.7 AC #6 — normalize the config location BEFORE any read that
    // assumes the canonical v6.3.0 path. This runs ahead of
    // detectMigrationNeed() so operators upgrading from a pre-6.3 install get
    // a clear message that legacy config is NOT used as a fallback; the
    // downstream bmad-method install will regenerate the new layout.
    return ensureCanonicalConfigLocation(projectRoot);
}

async function installBmad(modules = ['bmm', 'bmb'], tools = [], projectRoot = process.cwd(), force = false, { userName = '', commLang = '', docLang = '', outputFolder = '' } = {}) {
    preInstallHooks(projectRoot);

    // Detect migration need
    const detection = detectMigrationNeed(projectRoot);

    if (detection.migrate) {
        const fromLabel = detection.fromVersion === 'unknown' ? 'unknown version' : detection.fromVersion;
        console.log(chalk.yellow(`  Upgrading BMAD from ${fromLabel} to ${BMAD_TARGET_VERSION}...`));
        return await runMigration(modules, tools, projectRoot, force, { userName, commLang, docLang, outputFolder });
    }

    // Story 22.6 — stage-and-invoke. Copy the bundled plugin into the project
    // and hand its path to bmad-method via --custom-source so BMAD's own
    // PluginResolver places the skills (no more post-install manifest surgery).
    //
    // Edge-case #7 — stagePlugin() can throw (missing bundle, invalid
    // projectRoot, stale-stage wipe EBUSY, half-populated copy). The CLI
    // caller (bin/cli.js) treats this function's return value as a
    // success/failure boolean and does not try/catch around it, so an
    // uncaught throw here would bubble out as a crash. Catch staging errors
    // explicitly, log them, and propagate as `return false` like the other
    // failure branches.
    let stagePath;
    let customSourceArg;
    try {
        ({ stagePath, customSourceArg } = stagePlugin(projectRoot));
    } catch (error) {
        console.error(chalk.red(`  Plugin staging failed: ${error.message}`));
        return false;
    }
    // F2a — Story 22.8 gitignore policy. Apply at the project root next to
    // stagePlugin() so the two operations are co-located. Idempotent and
    // non-fatal (see ensurePluginStageGitignoredForProject() for details).
    ensurePluginStageGitignoredForProject(projectRoot);
    const command = buildBmadArgs({
        projectRoot,
        modules,
        tools,
        action: detection.action,
        userName,
        commLang,
        docLang,
        outputFolder,
        customSource: customSourceArg,
    });

    await prePopulateBmadCache(force);

    console.log(chalk.cyan(`  Invoking bmad-method with --tools ${(tools && tools.length > 0) ? tools.join(',') : 'none'}`));
    console.log(chalk.gray(`  Running: ${command}`));
    // Edge-case #8 — track bmad-method success and post-step (deployMethodology)
    // success SEPARATELY. The stage must only be cleaned up when BOTH succeed;
    // otherwise the operator loses the exact bundle that was handed to
    // bmad-method when a post-install step fails, making diagnosis harder.
    let bmadInvokeSucceeded = false;
    let postStepsSucceeded = false;
    try {
        runCommand(command, { cwd: projectRoot, env: buildChildSpawnEnv() });
        bmadInvokeSucceeded = true;
        // Bug 27.14 — repair any module artifact path that upstream's
        // suffix-match output-folder resolution contaminated (e.g. gds paths
        // pinned to bmb's "skills" instead of the chosen output folder). Runs
        // after bmad-method writes the config and before downstream consumers.
        normalizeModuleOutputFolders(projectRoot);
        // F1a — on-prem persona phase-prefix pass. Runs BEFORE
        // deployMethodology so a methodology-deploy failure doesn't prevent
        // the prefix from being applied (they are independent concerns).
        // No-op for standard profile; reads profile from `.ma-agents.json`
        // if present (the same signal setProfile() / Story 21.10 writes).
        const profile = require('./profile').getProfile(projectRoot);
        await applyOnPremPhasePrefixToDeployedSkills(projectRoot, profile);
        await deployMethodology(projectRoot, force);
        await deployClineWorkflows(projectRoot, tools);
        postStepsSucceeded = true;
        return true;
    } catch (error) {
        // Edge-case #7 — surface stagePlugin errors (or any downstream error)
        // as a clean non-zero outcome rather than an uncaught exception. The
        // existing try/catch already satisfies this; the explicit
        // `bmadInvokeSucceeded` check below distinguishes pre-invoke failures
        // (stage never created / already left in place by stagePlugin's own
        // error paths) from runtime bmad/deploy failures.
        console.error(chalk.red(`  BMAD installation failed: ${error.message}`));
        return false;
    } finally {
        if (bmadInvokeSucceeded && postStepsSucceeded) {
            cleanupStage(stagePath);
        } else {
            // AC 6 — leave the stage for diagnostics so the operator can
            // re-run bmad-method manually against the same bundle. This fires
            // for BOTH bmad-method failure and post-step failure (e.g.,
            // deployMethodology throwing after a green bmad install).
            console.error(chalk.yellow(`  Install failed — plugin stage left in place for inspection: ${stagePath}`));
        }
    }
}

/**
 * Run the full migration pipeline: backup → update → merge → cleanup.
 * Rolls back on failure (NFR29).
 */
async function runMigration(modules, tools, projectRoot, force, { userName, commLang, docLang, outputFolder }) {
    // F3 Section 6 — invoke shared pre-install hooks. When runMigration is
    // called from installBmad() this is a re-call (installBmad already ran
    // the hook); the duplicate is intentional so runMigration is correct
    // when invoked from any future entry point. ensureCanonicalConfigLocation
    // is idempotent — see preInstallHooks() docstring.
    preInstallHooks(projectRoot);

    // Step 1: Backup existing customizations
    console.log(chalk.cyan('  Step 1/4: Backing up existing customizations...'));
    const backedUpFiles = await backupCustomizations(projectRoot);

    // Step 2: Run bmad-method with --action update
    console.log(chalk.cyan('  Step 2/4: Updating BMAD-METHOD...'));
    // Story 22.6 — migration path also uses stage-and-invoke so the plugin
    // rides in on --custom-source instead of the retired manifest-surgery path.
    //
    // Edge-case #7 — catch stagePlugin() errors so the migration surfaces as
    // a clean `return false` rather than an uncaught exception bubbling out
    // of installBmad() into the CLI.
    let stagePath;
    let customSourceArg;
    try {
        ({ stagePath, customSourceArg } = stagePlugin(projectRoot));
    } catch (error) {
        console.error(chalk.red(`  Plugin staging failed: ${error.message}`));
        if (backedUpFiles.length > 0) {
            console.log(chalk.yellow('  Rolling back — restoring backed-up customizations...'));
            await restoreCustomizations(projectRoot);
        }
        return false;
    }
    // F2a — Story 22.8 gitignore policy on the migration path. Same rationale
    // as installBmad(): co-locate with stagePlugin() so the project-root write
    // happens once per pipeline pass.
    ensurePluginStageGitignoredForProject(projectRoot);
    const command = buildBmadArgs({
        projectRoot,
        modules,
        tools,
        action: 'update',
        userName,
        commLang,
        docLang,
        outputFolder,
        customSource: customSourceArg,
    });

    await prePopulateBmadCache(force);

    console.log(chalk.cyan(`  Invoking bmad-method with --tools ${(tools && tools.length > 0) ? tools.join(',') : 'none'}`));
    console.log(chalk.gray(`  Running: ${command}`));
    try {
        runCommand(command, { cwd: projectRoot, env: buildChildSpawnEnv() });
    } catch (error) {
        // Rollback on failure — leave the stage in place (AC 6) so the
        // operator can re-run BMAD manually with `--custom-source <stage>`
        // as a bypass, and inspect what was about to be installed.
        console.error(chalk.red(`  BMAD update failed: ${error.message}`));
        if (backedUpFiles.length > 0) {
            console.log(chalk.yellow('  Rolling back — restoring backed-up customizations...'));
            await restoreCustomizations(projectRoot);
        }
        console.error(chalk.red('  Migration aborted. Your project remains on the previous version.'));
        console.error(chalk.yellow('  Suggestion: Run "npm update bmad-method" manually, then retry installation.'));
        console.error(chalk.yellow(`  Plugin stage left in place for inspection: ${stagePath}`));
        return false;
    }

    // Bug 27.14 — repair contaminated module artifact paths on the migration
    // path too (same upstream suffix-match resolution applies to updates).
    normalizeModuleOutputFolders(projectRoot);

    // Step 3: Merge user customizations
    if (backedUpFiles.length > 0) {
        console.log(chalk.cyan('  Step 3/4: Merging user customizations...'));
        await mergeUserCustomizations(projectRoot);
    } else {
        console.log(chalk.gray('  Step 3/4: No customizations to merge'));
    }

    // Step 4: Clean up legacy artifacts
    console.log(chalk.cyan('  Step 4/4: Cleaning up legacy artifacts...'));
    await cleanupLegacyArtifacts(projectRoot);

    // F1a — on-prem persona phase-prefix pass. Migrations can flip profile
    // or re-stage skills, so the pass runs here too. Identical no-op
    // semantics for standard profile.
    const profile = require('./profile').getProfile(projectRoot);
    await applyOnPremPhasePrefixToDeployedSkills(projectRoot, profile);

    await deployMethodology(projectRoot, force);
    await deployClineWorkflows(projectRoot, tools);

    // All migration steps succeeded — safe to clean up the stage now.
    // Cleaning up earlier would remove diagnostics if any of steps 3-4 or
    // deployMethodology failed after a successful bmad-method invocation.
    cleanupStage(stagePath);

    console.log(chalk.green(`  Migration to BMAD ${BMAD_TARGET_VERSION} complete!`));
    return true;
}

async function updateBmad(modules = ['bmm', 'bmb'], tools = [], projectRoot = process.cwd(), force = false, { userName = '', commLang = '', docLang = '', outputFolder = '' } = {}) {
    // F3 Section 6 — invoke shared pre-install hooks so operators using the
    // update entry point also receive the canonical-config-location drift
    // signal. Previously only installBmad() ran this check, meaning a
    // pre-6.3 → 6.3+ upgrade triggered via `--action update` (skipping the
    // install path) would silently miss the drift notice.
    preInstallHooks(projectRoot);

    // Story 22.6 — stage-and-invoke replaces the legacy manifest-surgery block
    // that used to live here (hand-parsing of BMAD-internal registry files,
    // hardcoded stale-module whitelist, CSV column indexing, and physical
    // directory removal). bmad-method 6.3.0's PluginResolver handles update
    // semantics natively via --custom-source, so we only need to stage the
    // bundled plugin and invoke the installer.
    //
    // Edge-case #7 — catch stagePlugin() errors so the CLI caller receives a
    // false return rather than an uncaught exception (same rationale as
    // installBmad). Without this, a broken bundle or stale stage with held
    // file handles would crash the CLI instead of logging a diagnosable
    // message.
    let stagePath;
    let customSourceArg;
    try {
        ({ stagePath, customSourceArg } = stagePlugin(projectRoot));
    } catch (error) {
        console.error(chalk.red(`  Plugin staging failed: ${error.message}`));
        return false;
    }
    // F2a — Story 22.8 gitignore policy on the update path. Idempotent re-runs
    // are the explicit AC #4 contract; calling here on every update keeps the
    // entry present even if the project's `.gitignore` was reset between runs.
    ensurePluginStageGitignoredForProject(projectRoot);
    const command = buildBmadArgs({
        projectRoot,
        modules,
        tools,
        action: 'update',
        userName,
        commLang,
        docLang,
        outputFolder,
        customSource: customSourceArg,
    });

    await prePopulateBmadCache(force);

    // Story 22.6 — the legacy manifest-surgery block that used to live here
    // (hand-parsing of BMAD-internal registry files, hardcoded stale-module
    // whitelist, physical directory removal) has been removed. bmad-method
    // 6.3.0's PluginResolver handles update semantics natively via
    // --custom-source against the staged plugin bundle. Story 22.7's
    // "legacy-WRITE" annotation was retired along with the block it
    // annotated — canonical config reads still go through
    // readCanonicalBmadConfig() (see exports below).
    console.log(chalk.cyan(`  Invoking bmad-method with --tools ${(tools && tools.length > 0) ? tools.join(',') : 'none'}`));
    console.log(chalk.gray(`  Running: ${command}`));
    // Edge-case #8 — same split-tracking as installBmad(): the stage must
    // survive a deployMethodology failure so the operator can inspect what
    // was handed to bmad-method.
    let bmadInvokeSucceeded = false;
    let postStepsSucceeded = false;
    try {
        runCommand(command, { cwd: projectRoot, env: buildChildSpawnEnv() });
        bmadInvokeSucceeded = true;
        // F1a — on-prem persona phase-prefix pass; identical call to
        // installBmad(). Runs on every update so a profile flipped since
        // the last install gets re-stamped (Story 21.10 reconfigure).
        const profile = require('./profile').getProfile(projectRoot);
        await applyOnPremPhasePrefixToDeployedSkills(projectRoot, profile);
        await deployMethodology(projectRoot, force);
        await deployClineWorkflows(projectRoot, tools);
        postStepsSucceeded = true;
        return true;
    } catch (error) {
        console.error(chalk.red(`  BMAD update failed: ${error.message}`));
        return false;
    } finally {
        if (bmadInvokeSucceeded && postStepsSucceeded) {
            cleanupStage(stagePath);
        } else {
            console.error(chalk.yellow(`  Update failed — plugin stage left in place for inspection: ${stagePath}`));
        }
    }
}

/**
 * Strip `phase` and `on_prem_phase_prefix` top-level keys from all deployed
 * customize.yaml files in `configTargetDir`. Called for EVERY profile so that
 * standard-profile deployments never contain the extension keys (NFR44).
 *
 * @param {string} configTargetDir  Path to _bmad/_config/agents/
 */
async function stripOnPremKeys(configTargetDir) {
    if (!fs.existsSync(configTargetDir)) return;
    const files = (await fs.readdir(configTargetDir)).filter(f => f.endsWith('.customize.yaml'));
    for (const file of files) {
        const filePath = path.join(configTargetDir, file);
        let raw;
        try {
            raw = await fs.readFile(filePath, 'utf8');
        } catch {
            continue;
        }
        let doc;
        try {
            doc = jsYaml.load(raw);
        } catch {
            continue;
        }
        if (!doc || typeof doc !== 'object') continue;
        if (!Object.prototype.hasOwnProperty.call(doc, 'phase') &&
            !Object.prototype.hasOwnProperty.call(doc, 'on_prem_phase_prefix')) {
            continue; // Nothing to strip — pre-Epic-21 file, leave untouched
        }
        delete doc.phase;
        delete doc.on_prem_phase_prefix;
        await fs.writeFile(filePath, jsYaml.dump(doc, { lineWidth: -1 }), 'utf8');
    }
}

/**
 * For on-prem profile: inject `on_prem_phase_prefix` as `critical_actions[0]`
 * into each deployed customize.yaml that carries the extension keys, then strip
 * those keys from the deployed file. Idempotent: the prefix is inserted once
 * (the extension keys are removed afterwards so a second run is a no-op on the
 * deployed file — `stripOnPremKeys` covers the second pass).
 *
 * Must be called AFTER the STAGE:CUSTOMIZE copy AND after `stripOnPremKeys`
 * has already been called (or will be called immediately after on the same
 * set of files). In practice we call stripOnPremKeys once at the end for all
 * profiles, and applyOnPremPhasePrefix writes the merged file atomically.
 *
 * @param {string} customizeSourceDir  lib/bmad-customize/ (source of truth)
 * @param {string} configTargetDir     _bmad/_config/agents/ (deployed location)
 */
async function applyOnPremPhasePrefix(customizeSourceDir, configTargetDir) {
    if (!fs.existsSync(configTargetDir)) return;
    const files = (await fs.readdir(customizeSourceDir)).filter(f => f.endsWith('.customize.yaml'));
    for (const file of files) {
        const sourceFile = path.join(customizeSourceDir, file);
        const targetFile = path.join(configTargetDir, file);
        if (!fs.existsSync(targetFile)) continue;
        let sourceDoc;
        try {
            sourceDoc = jsYaml.load(await fs.readFile(sourceFile, 'utf8'));
        } catch {
            continue;
        }
        if (!sourceDoc || typeof sourceDoc !== 'object') continue;
        const prefix = sourceDoc.on_prem_phase_prefix;
        if (!prefix || typeof prefix !== 'string' || !prefix.trim()) continue;
        // Read the deployed file (may already be stripped if stripOnPremKeys ran first,
        // or may still have the keys if we run in combined mode)
        let deployedDoc;
        try {
            deployedDoc = jsYaml.load(await fs.readFile(targetFile, 'utf8'));
        } catch {
            continue;
        }
        if (!deployedDoc || typeof deployedDoc !== 'object') continue;
        // Build final critical_actions: [prefix, ...original entries]
        const originalActions = Array.isArray(deployedDoc.critical_actions)
            ? deployedDoc.critical_actions
            : [];
        deployedDoc.critical_actions = [prefix, ...originalActions];
        // Remove extension keys (idempotency: they were in the copy, we strip them now)
        delete deployedDoc.phase;
        delete deployedDoc.on_prem_phase_prefix;
        await fs.writeFile(targetFile, jsYaml.dump(deployedDoc, { lineWidth: -1 }), 'utf8');
    }
}

/**
 * Exported for testing without running the full installer.
 * Applies post-deploy YAML rewriting for phase-aware persona prefixes.
 *
 * - Always strips `phase` and `on_prem_phase_prefix` from deployed files (NFR44).
 * - When profile === 'on-prem', additionally injects the prefix as critical_actions[0].
 *
 * @param {string} customizeSourceDir  lib/bmad-customize/
 * @param {string} configTargetDir     _bmad/_config/agents/
 * @param {string} profile             'on-prem' | 'standard' | undefined
 */
async function applyPersonaPhasePrefix(customizeSourceDir, configTargetDir, profile) {
    if (profile === 'on-prem') {
        await applyOnPremPhasePrefix(customizeSourceDir, configTargetDir);
    } else {
        await stripOnPremKeys(configTargetDir);
    }
}

// ─── F1a — on-prem persona phase-prefix restoration ──────────────────────────
//
// Pre-22.6, the phase-prefix pass ran against `.customize.yaml` files in
// `_bmad/_config/agents/` via the now-retired `applyCustomizations()` flow.
// Under the stage-and-invoke architecture those YAML files are no longer
// deployed — bmad-method 6.3.0's PluginResolver emits per-tool persona SKILL.md
// files under each tool's skills directory (e.g. `.claude/skills/bmad-agent-pm/
// SKILL.md`). The persona content that used to live in YAML `critical_actions`
// now lives inline in markdown.
//
// This helper walks the deployed tool trees after the install succeeds and
// injects the `on_prem_phase_prefix` text (read from the canonical
// `lib/bmad-customize/bmm-<persona>.customize.yaml` source) into each persona
// SKILL.md using a marker-delimited block for idempotency. Only runs when
// profile === 'on-prem'; no-op in every other case.
//
// Marker convention: `<!-- BEGIN:ma-on-prem-phase-prefix -->` …
// `<!-- END:ma-on-prem-phase-prefix -->`. A second run replaces the existing
// block byte-for-byte; removing/reverting is a manifest-uninstall concern
// (Story 21.11) owned elsewhere.

const ON_PREM_PREFIX_MARKER_BEGIN = '<!-- BEGIN:ma-on-prem-phase-prefix -->';
const ON_PREM_PREFIX_MARKER_END = '<!-- END:ma-on-prem-phase-prefix -->';

// ma-agents persona-id → deployed SKILL directory name. The deployed name
// mirrors the BMAD plugin's skill manifest (Story 22.2 renamed these from
// `bmad-ma-agent-*` to `bmad-agent-*`; keep the mapping explicit so future
// upstream renames surface here as a contained change rather than a silent
// no-op across every tool tree).
const PERSONA_SKILL_MAP = Object.freeze({
    'bmm-pm':           'bmad-agent-pm',
    'bmm-architect':    'bmad-agent-architect',
    'bmm-dev':          'bmad-agent-dev',
    'bmm-analyst':      'bmad-agent-analyst',
    'bmm-tech-writer':  'bmad-agent-tech-writer',
    'bmm-ux-designer':  'bmad-agent-ux-designer',
    'bmm-sm':           'bmad-agent-sm',
    'bmm-qa':           'bmad-agent-qa',
});

// Tool skill-dir roots. Kept in sync with `lib/agents.js` canonical
// `skillsDir` values — duplicated here (not imported) to avoid pulling the
// agents module into install-time code paths that don't need it. The five
// IDE tools listed are the only targets that receive `bmad-agent-*` persona
// skills post-22.6 (verified 2026-04-23 via scratch install).
// bmad-method 6.5.0 moved copilot, roo, and kilo to the shared .agents/skills/
// directory. Deduplicated here — F1a walks each unique dir once.
const TOOL_SKILL_DIRS = Object.freeze([
    path.join('.claude', 'skills'),
    path.join('.agents', 'skills'),   // copilot, roo-code, kilocode (bmad-method 6.5.0)
    path.join('.cline', 'skills'),
]);

/**
 * Build the marker-wrapped block that is injected into a persona SKILL.md.
 * Kept as a single-source helper so the test assertions and the production
 * code match byte-for-byte.
 *
 * @param {string} prefixText  The `on_prem_phase_prefix` from the customize YAML
 * @returns {string}           Multi-line block with markers and trailing newline
 */
function buildOnPremPrefixBlock(prefixText) {
    return [
        ON_PREM_PREFIX_MARKER_BEGIN,
        '## On-Prem Phase Prefix',
        '',
        prefixText,
        ON_PREM_PREFIX_MARKER_END,
        '',
    ].join('\n');
}

/**
 * Inject-or-replace the on-prem prefix block inside `skillContent`. Idempotent:
 * a second call with the same prefix returns identical content.
 *
 * Placement rule:
 *   - If an existing marker block is present, replace it in place (byte-stable).
 *   - Otherwise, insert the new block immediately AFTER the YAML frontmatter
 *     (the second `---` line) and BEFORE the rest of the markdown body.
 *   - If no frontmatter exists, prepend the block.
 *
 * @param {string} skillContent  Current SKILL.md contents
 * @param {string} prefixText    Prefix text to inject
 * @returns {string}             Updated content
 */
function injectOnPremPrefixBlock(skillContent, prefixText) {
    const block = buildOnPremPrefixBlock(prefixText);
    const beginIdx = skillContent.indexOf(ON_PREM_PREFIX_MARKER_BEGIN);
    if (beginIdx !== -1) {
        const endIdx = skillContent.indexOf(ON_PREM_PREFIX_MARKER_END, beginIdx);
        if (endIdx !== -1) {
            const afterEnd = endIdx + ON_PREM_PREFIX_MARKER_END.length;
            // Swallow the single trailing newline that belongs to the existing
            // block so we don't accumulate blank lines on repeated runs.
            const tail = skillContent[afterEnd] === '\n'
                ? skillContent.slice(afterEnd + 1)
                : skillContent.slice(afterEnd);
            return skillContent.slice(0, beginIdx) + block + tail;
        }
        // Malformed half-block (begin without end). Treat as fresh-insert below
        // rather than silently corrupting the file further.
    }

    // Fresh insert. Place after frontmatter when present. Accept both LF
    // and CRLF line endings — BMAD-deployed SKILL.md files are LF today
    // (verified 2026-04-23), but operators on Windows may hand-edit with
    // editors that rewrite to CRLF; we shouldn't corrupt their file.
    const fmMatch = skillContent.match(/^---\r?\n/);
    if (fmMatch) {
        const searchFrom = fmMatch[0].length;
        // Close delimiter may be `\n---\n` or `\r\n---\r\n`; match either.
        const closeMatch = skillContent.slice(searchFrom).match(/\r?\n---\r?\n/);
        if (closeMatch) {
            const insertAt = searchFrom + closeMatch.index + closeMatch[0].length;
            return skillContent.slice(0, insertAt) + '\n' + block + skillContent.slice(insertAt);
        }
    }
    return block + skillContent;
}

/**
 * F1a — post-install on-prem phase-prefix pass.
 *
 * For each persona with an `on_prem_phase_prefix` in the canonical customize
 * source, locate the deployed `SKILL.md` in every tool skill-dir that exists
 * under `projectRoot`, and inject the prefix block. No-op when `profile` is
 * not `'on-prem'` so standard-profile installs never see on-prem content
 * (NFR44 — bug spec edge-case 1).
 *
 * Invariants:
 *   - Never creates a tool directory that the install didn't create first
 *     (bug spec edge-case 2): missing dirs are skipped.
 *   - Malformed YAML in the source is logged and that persona is skipped
 *     (bug spec edge-case 3) — other personas still get their prefix.
 *   - A persona skill that hasn't been deployed (e.g. copilot's per-bug-A
 *     routing gap, or personas consolidated upstream) is a silent skip —
 *     we don't invent files the deployer didn't emit (bug spec edge-case 4).
 *   - Re-running against an already-prefixed file replaces the existing
 *     marker block rather than stacking a second one (bug spec edge-case 5).
 *
 * @param {string} projectRoot        Absolute path to the install target
 * @param {string} [profile]          Resolved profile value; only 'on-prem' acts
 * @param {string} [customizeSourceDir]  Override for tests. Defaults to
 *                                      `lib/bmad-customize/`.
 * @returns {Promise<{ tool: string, persona: string, injected: boolean }[]>}
 *          Per-file outcome list — useful for test assertions and operator logs
 */
async function applyOnPremPhasePrefixToDeployedSkills(
    projectRoot,
    profile,
    customizeSourceDir = path.join(__dirname, 'bmad-customize'),
) {
    if (profile !== 'on-prem') {
        return [];
    }
    if (!projectRoot || typeof projectRoot !== 'string') {
        return [];
    }
    if (!fs.existsSync(customizeSourceDir)) {
        return [];
    }

    // Build the persona → prefix map once. Malformed sources are logged and
    // skipped (bug spec edge-case 3).
    const personaPrefix = new Map();
    for (const [personaId, skillDirName] of Object.entries(PERSONA_SKILL_MAP)) {
        const sourceFile = path.join(customizeSourceDir, `${personaId}.customize.yaml`);
        if (!fs.existsSync(sourceFile)) continue;
        let doc;
        try {
            doc = jsYaml.load(await fs.readFile(sourceFile, 'utf8'));
        } catch (err) {
            console.warn(chalk.yellow(
                `  on-prem prefix: skipping ${personaId} — malformed source YAML: ${err.message}`
            ));
            continue;
        }
        if (!doc || typeof doc !== 'object') continue;
        const prefix = doc.on_prem_phase_prefix;
        if (typeof prefix !== 'string' || !prefix.trim()) continue;
        personaPrefix.set(skillDirName, prefix);
    }
    if (personaPrefix.size === 0) return [];

    const results = [];
    for (const toolRel of TOOL_SKILL_DIRS) {
        const toolSkillsDir = path.join(projectRoot, toolRel);
        if (!fs.existsSync(toolSkillsDir)) continue; // tool not installed

        for (const [skillDirName, prefix] of personaPrefix) {
            const skillDir = path.join(toolSkillsDir, skillDirName);
            const skillFile = path.join(skillDir, 'SKILL.md');
            if (!fs.existsSync(skillFile)) {
                // Persona not deployed for this tool — e.g. copilot routing gap
                // (tracked separately). Do not invent files.
                continue;
            }
            let content;
            try {
                content = await fs.readFile(skillFile, 'utf8');
            } catch (err) {
                console.warn(chalk.yellow(
                    `  on-prem prefix: could not read ${skillFile}: ${err.message}`
                ));
                continue;
            }
            const updated = injectOnPremPrefixBlock(content, prefix);
            if (updated === content) {
                results.push({ tool: toolRel, persona: skillDirName, injected: false });
                continue;
            }
            try {
                await fs.writeFile(skillFile, updated, 'utf8');
                results.push({ tool: toolRel, persona: skillDirName, injected: true });
            } catch (err) {
                console.warn(chalk.yellow(
                    `  on-prem prefix: could not write ${skillFile}: ${err.message}`
                ));
            }
        }
    }

    if (results.some(r => r.injected)) {
        const count = results.filter(r => r.injected).length;
        console.log(chalk.cyan(`    + Injected on-prem phase prefix into ${count} persona SKILL.md file(s)`));
    }
    return results;
}

// Story 22.6 — `applyCustomizations()` removed. Its responsibilities are now
// handled by bmad-method 6.3.0's PluginResolver, invoked via --custom-source
// against the staged plugin bundle (see stagePlugin() above). The supporting
// `registerMilWorkflows()` and `registerMlWorkflows()` helpers were removed
// alongside it — their CSV registrations now ship in the plugin's own
// `module-help.csv` and are merged by BMAD's installer.
//
// The ~290 lines of manifest-surgery, custom-agent-YAML staging, and CSV
// rewriting that used to live here are gone — BMAD owns placement now.
// Remaining helpers below (deployMethodology, prePopulateBmadCache, etc.) are
// independent concerns invoked from installBmad()/updateBmad() directly.

/**
 * Deploy the methodology presentation to the target project's _bmad-output/methodology/ directory.
 * Version-aware: skips if target is same or newer; overwrites only with --force.
 * AC: #1, #2, #3, #5 (Story 6.1)
 */
async function deployMethodology(projectRoot = process.cwd(), force = false) {
    const methodologySource = path.join(__dirname, 'methodology');
    if (!(await fs.pathExists(methodologySource))) {
        console.log(chalk.gray('  No methodology content found — skipping'));
        return;
    }

    const methodologyTarget = path.join(projectRoot, '_bmad-output', 'methodology');
    await fs.ensureDir(methodologyTarget);

    // Version comparison
    const sourceVersionFile = path.join(methodologySource, 'version.json');
    const targetVersionFile = path.join(methodologyTarget, 'version.json');

    let sourceVersion = '0.0.0';
    let targetVersion = null;

    if (await fs.pathExists(sourceVersionFile)) {
        try {
            const v = JSON.parse(await fs.readFile(sourceVersionFile, 'utf-8'));
            sourceVersion = v.version || '0.0.0';
        } catch { /* ignore */ }
    }

    if (await fs.pathExists(targetVersionFile)) {
        try {
            const v = JSON.parse(await fs.readFile(targetVersionFile, 'utf-8'));
            targetVersion = v.version || null;
        } catch { /* ignore */ }
    }

    if (targetVersion !== null && !force) {
        // Simple semver comparison: skip if target is same or newer
        const semverGte = (a, b) => {
            const pa = a.split('.').map(Number);
            const pb = b.split('.').map(Number);
            for (let i = 0; i < 3; i++) {
                if ((pa[i] || 0) > (pb[i] || 0)) return true;
                if ((pa[i] || 0) < (pb[i] || 0)) return false;
            }
            return true;
        };
        if (semverGte(targetVersion, sourceVersion)) {
            console.log(chalk.gray(`  ✓ Methodology presentation is up to date (v${targetVersion})`));
            return;
        }
    }

    await fs.copy(methodologySource, methodologyTarget, { overwrite: true });
    console.log(chalk.green('  ✓ Methodology presentation installed to _bmad-output/methodology/'));
    console.log(chalk.gray('  Hint: Share this with your team for BMAD-METHOD onboarding'));
    console.log(chalk.gray('  Tip: Use /open-presentation to open the slides (install via npx ma-agents install open-presentation)'));
}

/**
 * Detect whether a `.clinerules/workflows/*.md` file is a ma-agents-generated
 * Cline workflow wrapper (as opposed to a user-authored file that happens to
 * live in the same directory).
 *
 * Reconciliation (Story 27.4) deletes stale wrappers, so the matcher must be
 * conservative: it returns `true` ONLY for the exact shape this function emits.
 * Every generated wrapper contains a line that points the reader back into the
 * backing skill via a `.cline/skills/<name>/` reference (either `SKILL.md` or
 * `workflow.md`). User files under `.clinerules/` will not carry that marker,
 * so they are never mistaken for wrappers and never deleted.
 *
 * @param {string} content - Raw UTF-8 contents of the candidate `.md` file.
 * @returns {boolean} `true` if the content matches the generated-wrapper shape.
 */
function isGeneratedClineWrapper(content) {
    if (typeof content !== 'string' || content.length === 0) return false;
    // The generated-wrapper fingerprint: a body line that instructs the reader
    // to read a file under `.cline/skills/<name>/` (SKILL.md or workflow.md).
    // Matches forward-slashed paths only — that is exactly what we emit.
    return /\.cline\/skills\/[^/\s`]+\/(?:SKILL|workflow)\.md/.test(content);
}

/**
 * Generate Cline workflow wrappers for all BMAD skills installed to .cline/skills/.
 * Creates .clinerules/workflows/<skill-name>.md for each installed skill so they
 * can be invoked via / commands in Cline chat.
 *
 * Reconciliation (Story 27.4): after (re)generating wrappers for all current
 * skills, any stale wrapper under `.clinerules/workflows/` whose backing
 * `.cline/skills/<name>/` directory no longer exists is removed. This keeps
 * `/`-invocation in Cline from offering workflows for skills BMAD renamed away
 * or retired. Deletion is scoped strictly to ma-agents-generated wrapper files
 * (see {@link isGeneratedClineWrapper}); user-authored files elsewhere under
 * `.clinerules/` are never touched, and the operation is idempotent.
 *
 * No-op when 'cline' is not in the selected tools list.
 */
async function deployClineWorkflows(projectRoot, tools = []) {
    if (!tools.includes('cline')) return;

    const clineSkillsDir = path.join(projectRoot, '.cline', 'skills');
    if (!(await fs.pathExists(clineSkillsDir))) return;

    // Cline expects .clinerules/ to be a directory, not a file.
    // Legacy installs created it as a flat file (instruction injection duplicate of
    // .cline/clinerules.md). Detect and remove it so ensureDir can proceed.
    const clinerulesPath = path.join(projectRoot, '.clinerules');
    if (await fs.pathExists(clinerulesPath)) {
        const stat = await fs.lstat(clinerulesPath);
        if (stat.isFile()) {
            await fs.remove(clinerulesPath);
            console.log(chalk.gray('  Removed legacy .clinerules file (content is in .cline/clinerules.md)'));
        }
    }

    const workflowsDir = path.join(projectRoot, '.clinerules', 'workflows');
    await fs.ensureDir(workflowsDir);

    const entries = await fs.readdir(clineSkillsDir, { withFileTypes: true });
    const skillDirs = entries.filter(e => e.isDirectory());

    // Live skill-name set: every `.cline/skills/<name>/` that backs a wrapper
    // (i.e. contains a SKILL.md). Used below to reconcile stale wrappers.
    const liveSkillNames = new Set();

    let generated = 0;
    for (const entry of skillDirs) {
        const skillName = entry.name;
        const skillDir = path.join(clineSkillsDir, skillName);
        const skillMdPath = path.join(skillDir, 'SKILL.md');
        const workflowMdPath = path.join(skillDir, 'workflow.md');

        if (!(await fs.pathExists(skillMdPath))) continue;
        liveSkillNames.add(skillName);

        const skillMdContent = await fs.readFile(skillMdPath, 'utf8');
        let displayName = skillName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        let description = '';

        const fmMatch = skillMdContent.match(/^---\n([\s\S]*?)\n---/);
        if (fmMatch) {
            const fm = fmMatch[1];
            const nameMatch = fm.match(/^name:\s*(.+)$/m);
            const descMatch = fm.match(/^description:\s*(.+)$/m);
            if (nameMatch) displayName = nameMatch[1].trim();
            if (descMatch) description = descMatch[1].trim().replace(/^['"]|['"]$/g, '');
        }

        const hasWorkflow = await fs.pathExists(workflowMdPath);
        const lines = [`# ${displayName}`, ''];
        if (description) lines.push(description, '');

        if (hasWorkflow) {
            lines.push(
                '## Step 1: Read and follow the BMAD skill workflow',
                `Read the file \`.cline/skills/${skillName}/workflow.md\` and follow all instructions within it exactly.`,
                ''
            );
        } else {
            lines.push(
                '## Step 1: Read and follow the BMAD skill instructions',
                `Read the file \`.cline/skills/${skillName}/SKILL.md\`. Ignore the YAML frontmatter block (the \`---\` delimited section at the top of the file). Follow all instructions in the body of that file exactly.`,
                ''
            );
        }

        await fs.writeFile(path.join(workflowsDir, `${skillName}.md`), lines.join('\n'), 'utf8');
        generated++;
    }

    // Reconciliation (Story 27.4): remove stale wrappers whose backing skill
    // dir no longer exists. Scope is strictly the generated-wrapper `.md` files
    // directly inside `workflows/` — subdirectories and non-wrapper user files
    // are left untouched.
    let removed = 0;
    const workflowEntries = await fs.readdir(workflowsDir, { withFileTypes: true });
    for (const wf of workflowEntries) {
        // Only top-level `.md` files are candidate wrappers. Skip directories
        // and any non-markdown file outright.
        if (!wf.isFile()) continue;
        if (!wf.name.endsWith('.md')) continue;

        const wrapperName = wf.name.slice(0, -'.md'.length);
        // A wrapper whose name is still in the live set is current — keep it.
        // (It was just (re)written above.)
        if (liveSkillNames.has(wrapperName)) continue;

        // Name is not backed by a live skill. Before deleting, confirm the file
        // actually matches the ma-agents generated-wrapper shape so we never
        // remove a user-authored `.md` that happens to share a stale name.
        const wrapperPath = path.join(workflowsDir, wf.name);
        let wrapperContent;
        try {
            wrapperContent = await fs.readFile(wrapperPath, 'utf8');
        } catch {
            // Unreadable (e.g. vanished mid-run) — nothing to reconcile.
            continue;
        }
        if (!isGeneratedClineWrapper(wrapperContent)) continue;

        await fs.remove(wrapperPath);
        removed++;
    }

    if (generated > 0) {
        console.log(chalk.green(`  ✓ Generated ${generated} Cline workflow wrappers in .clinerules/workflows/`));
        console.log(chalk.gray('  Tip: In Cline, type / to browse and invoke BMAD skills'));
    }
    if (removed > 0) {
        console.log(chalk.green(`  ✓ Removed ${removed} stale Cline workflow wrapper${removed === 1 ? '' : 's'} (backing skill no longer present)`));
    }
}

/**
 * Story 30.6b — install the user's selected custom-marketplace subset
 * (30.6a's wizard selection, pruned + staged by
 * `lib/custom-marketplace.js#stageCustomMarketplaceSubset`) via bmad-method's
 * own `--custom-source`, reusing this module's EXISTING install-invocation
 * primitives (`buildBmadArgs`, `runCommand`, `buildChildSpawnEnv`,
 * `deployClineWorkflows`) — no new child-process or git logic is hand-rolled.
 *
 * Callers MUST gate this on the preceding base BMAD install/update step
 * having left a usable installation (AC 6, 30.6b) — this function assumes
 * `_bmad/` already exists and only ever passes `--action update`.
 *
 * @param {Object} ctx
 * @param {string} ctx.projectRoot
 * @param {string[]} ctx.modules - The same bmad module set used for the base install.
 * @param {string[]} ctx.tools - The same IDE/tool set used for the base install.
 * @param {{ source: string, mode: 'discovery'|'direct', selectedCodes: string[],
 *   plugins: Array<Object>, rootDir: string, sourceUrl: string|null }} ctx.selection -
 *   30.6a's `promptCustomMarketplace()` return value (extended with `rootDir`/`sourceUrl`).
 * @returns {Promise<boolean>} true on success; false on any failure (logged, never thrown).
 */
async function installCustomMarketplaceSubset({ projectRoot, modules, tools, selection, deps = {} }) {
    // Lazy require — mirrors the ensurePluginStageGitignoredForProject()
    // pattern above (avoids a load-order circular dependency, since this
    // function is the only bmad.js call site that needs the adapter).
    const customMarketplace = require('./custom-marketplace');
    const { CustomMarketplaceError } = customMarketplace;

    // Injectable seam (defaults to the real implementations) — lets unit
    // tests exercise this function's own orchestration logic (staging
    // failure handling, success/failure branching, Cline reconcile,
    // stage-cleanup-vs-leave-in-place policy) without spawning a real
    // bmad-method child process or fighting Node's require-cache semantics
    // to stub out module-internal function bindings.
    const stageFn = deps.stageCustomMarketplaceSubset || customMarketplace.stageCustomMarketplaceSubset;
    const runCommandFn = deps.runCommand || runCommand;
    const deployClineWorkflowsFn = deps.deployClineWorkflows || deployClineWorkflows;
    const cleanupStageFn = deps.cleanupStage || cleanupStage;
    const buildChildSpawnEnvFn = deps.buildChildSpawnEnv || buildChildSpawnEnv;
    // Story 30.7 (FR242) — persist the source + selection (+ SHA pin) once the
    // subset is actually installed. Lazy-required for the same load-order
    // reason as `./custom-marketplace` above; injectable so tests can assert
    // the persisted shape without depending on the real .ma-agents.json path.
    const setCustomMarketplaceSelectionFn = deps.setCustomMarketplaceSelection || require('./profile').setCustomMarketplaceSelection;

    let stagePath;
    let customSourceArg;
    let resolvedModules;
    try {
        ({ stagePath, customSourceArg, resolvedModules } = await stageFn({
            source: selection.source,
            mode: selection.mode,
            rootDir: selection.rootDir,
            sourceUrl: selection.sourceUrl,
            plugins: selection.plugins,
            selectedCodes: selection.selectedCodes,
            projectRoot,
        }));
    } catch (err) {
        const message = err instanceof CustomMarketplaceError ? err.message : `Custom marketplace staging error: ${err.message}`;
        console.error(chalk.red(`  Custom marketplace subset staging failed: ${message}`));
        return false;
    }

    const command = buildBmadArgs({
        projectRoot,
        modules,
        tools,
        action: 'update',
        customSource: customSourceArg,
    });

    console.log(chalk.cyan(`  Installing custom marketplace subset (${selection.selectedCodes.join(', ')})...`));
    console.log(chalk.gray(`  Running: ${command}`));

    try {
        runCommandFn(command, { cwd: projectRoot, env: buildChildSpawnEnvFn() });
        // FR242 — reconcile Cline workflow wrappers for any newly-installed
        // custom module, same mechanism official-module installs already use.
        await deployClineWorkflowsFn(projectRoot, tools);
        // Only clean up the stage once BOTH the bmad-method invocation and the
        // Cline reconcile succeeded — mirrors installBmad()'s "leave the stage
        // for diagnostics on any post-invoke failure" policy (AC 8, 30.6b).
        cleanupStageFn(stagePath);

        // Story 30.7 (FR242) — persist source + selection (+ SHA pin) now that
        // the subset is actually installed. `resolvedModules[].cloneSha` is
        // only stamped for Git-URL sources (see custom-module-manager.js
        // `resolvePlugin()`); local-path sources persist `sha: null`, which is
        // the correct value (no commit concept applies). A persistence
        // failure is logged as a warning only — it must never turn an
        // otherwise-successful install into a reported failure.
        try {
            const sha = (resolvedModules || []).map((m) => m.cloneSha).find((s) => s) || null;
            setCustomMarketplaceSelectionFn(projectRoot, {
                source: selection.source,
                sourceUrl: selection.sourceUrl ?? null,
                mode: selection.mode,
                selectedCodes: selection.selectedCodes,
                sha,
            });
        } catch (persistErr) {
            console.warn(chalk.yellow(`  Warning: could not persist custom marketplace selection: ${persistErr.message}`));
        }

        return true;
    } catch (error) {
        console.error(chalk.red(`  Custom marketplace subset install failed: ${error.message}`));
        console.error(chalk.yellow(`  Custom marketplace stage left in place for inspection: ${stagePath}`));
        return false;
    }
}

/**
 * Write bmad-method's `.bmad-channel.json` marker for an offline-cached
 * module if one is not already present.
 *
 * Why this exists: bmad-method's `cloneExternalModule()` (in
 * `node_modules/bmad-method/tools/installer/modules/external-manager.js`)
 * resolves the install ref by hitting GitHub's API for the latest stable
 * tag. On an air-gapped machine the API call throws and the function
 * falls back to reading the cached marker via `readChannelMarker()`. If
 * the marker is missing, it instead throws `Could not resolve stable tag
 * for '<module>'` and aborts the entire install.
 *
 * Pre-3.12.2 ma-agents copied each module's source tree (with `.git/`
 * restored from `_git_preserved/`) into `~/.bmad/cache/external-modules/`
 * but never wrote the marker. The result: any first-time offline install
 * that pre-populated more than `bmm` failed at the first external module.
 * Pre-3.12.1 the bug was masked because ma-agents only ever requested
 * `--modules bmm` (built into bmad-method itself, no cache-marker check).
 *
 * The marker schema is the same one bmad-method writes after a successful
 * online clone (line 419 of external-manager.js). Channel defaults to
 * `stable` because that's bmad-method's own default when a registry
 * entry has no `default_channel` field.
 *
 * Best-effort: failures are swallowed. The next install attempt (online or
 * offline-with-marker) will write a fresh one.
 *
 * @param {string} moduleDir - Cache dir for the module
 *   (e.g. `~/.bmad/cache/external-modules/tea`)
 * @param {{ branch?: string, commitSha?: string }} [manifestEntry] - Entry
 *   from `lib/bmad-cache/cache-manifest.json` for this module
 * @returns {Promise<boolean>} `true` if the marker was written, `false` if
 *   it already existed or the manifest entry is missing required fields
 */
async function ensureCacheMarker(moduleDir, manifestEntry) {
    const markerPath = path.join(moduleDir, '.bmad-channel.json');
    if (await fs.pathExists(markerPath)) return false;
    if (!manifestEntry || !manifestEntry.commitSha) return false;
    try {
        await fs.writeFile(
            markerPath,
            JSON.stringify(
                {
                    channel: 'stable',
                    version: manifestEntry.branch || 'main',
                    sha: manifestEntry.commitSha,
                    writtenAt: new Date().toISOString(),
                },
                null,
                2,
            ),
        );
        return true;
    } catch {
        // Best-effort — marker is a fallback, not a correctness requirement.
        // If we can't write it, bmad-method will surface its own error.
        return false;
    }
}

async function prePopulateBmadCache(force = false) {
    const cacheSource = path.join(__dirname, 'bmad-cache');
    if (!(await fs.pathExists(cacheSource))) {
        console.log(chalk.gray('  No bundled BMAD cache found — skipping pre-population'));
        return;
    }

    try {
        const targetDir = path.join(os.homedir(), '.bmad', 'cache', 'external-modules');
        await fs.ensureDir(targetDir);

        // Load manifest once so each module copy can stamp a `.bmad-channel.json`
        // marker for bmad-method's offline fallback. Missing/malformed manifest
        // is non-fatal — copy still happens, marker is just skipped.
        let manifest = null;
        try {
            const manifestPath = path.join(cacheSource, 'cache-manifest.json');
            if (await fs.pathExists(manifestPath)) {
                manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
            }
        } catch {
            manifest = null;
        }

        const entries = await fs.readdir(cacheSource);
        const modules = entries.filter(e => e !== 'cache-manifest.json');

        let copied = 0, skipped = 0, replaced = 0, markersWritten = 0;

        for (const mod of modules) {
            const src = path.join(cacheSource, mod);
            const dst = path.join(targetDir, mod);
            const stat = await fs.stat(src);
            if (!stat.isDirectory()) continue;

            // Always refresh if the cached module is structurally broken
            // (e.g. bmb missing skills/ dir causes ENOENT in bmad-method)
            const structurallyBroken = (await fs.pathExists(dst))
                && (await fs.pathExists(path.join(src, 'skills')))
                && !(await fs.pathExists(path.join(dst, 'skills')));

            if (await fs.pathExists(dst)) {
                if (force || structurallyBroken) {
                    await fs.remove(dst);
                    await fs.copy(src, dst);
                    restoreGitDir(dst);
                    const reason = structurallyBroken ? '(structural repair)' : '';
                    console.log(chalk.cyan(`    + Replaced cached module: ${mod} ${reason}`));
                    replaced++;
                } else {
                    console.log(chalk.gray(`    ~ Cached module exists, skipping: ${mod}`));
                    skipped++;
                }
            } else {
                await fs.copy(src, dst);
                restoreGitDir(dst);
                console.log(chalk.cyan(`    + Pre-populated cached module: ${mod}`));
                copied++;
            }

            // Stamp the offline-fallback marker. Always attempt — even on the
            // skip path, since prior ma-agents versions copied the module
            // without the marker and left users wedged on offline installs.
            // ensureCacheMarker no-ops when the marker already exists.
            const wrote = await ensureCacheMarker(dst, manifest && manifest.modules ? manifest.modules[mod] : null);
            if (wrote) markersWritten++;
        }

        if (copied > 0 || replaced > 0) {
            console.log(chalk.gray(`  Cache pre-population complete: ${copied} copied, ${skipped} skipped, ${replaced} replaced`));
        }
        if (markersWritten > 0) {
            console.log(chalk.gray(`  Wrote ${markersWritten} offline-fallback marker(s) (.bmad-channel.json)`));
        }
    } catch (err) {
        console.error(chalk.red(`  Cache pre-population failed: ${err.message}`));
    }
}

// ── Canonical config helpers (Story 22.7) ───────────────────────────────────

/**
 * Read and parse the canonical v6.3.0 project config at `_bmad/bmm/config.yaml`.
 *
 * This is the ONLY sanctioned read path for BMAD-canonical values in ma-agents
 * code. If the file is absent, this returns `null` — callers MUST NOT fall
 * back silently to the legacy `_bmad/_config/manifest.yaml`. Callers that need
 * to handle a legacy install should invoke `ensureCanonicalConfigLocation()`
 * BEFORE reading so that the layout is normalized first.
 *
 * Malformed YAML logs a warning and returns `null` rather than throwing — the
 * caller decides whether to error out or fall back to defaults.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {object|null} Parsed config object, or `null` when the file is
 *   missing or unreadable.
 */
function readCanonicalBmadConfig(projectRoot) {
    const configPath = path.join(projectRoot, CANONICAL_CONFIG_REL);
    if (!fs.existsSync(configPath)) {
        return null;
    }
    try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        if (!raw.trim()) {
            // Empty file — treat as "present but has no values".
            return {};
        }
        const parsed = yaml.parse(raw);
        // yaml.parse returns null for `{}` / empty-like content; normalize.
        return parsed === null || parsed === undefined ? {} : parsed;
    } catch (err) {
        console.log(chalk.yellow(
            `  Warning: failed to parse ${CANONICAL_CONFIG_REL}: ${err.message}`
        ));
        return null;
    }
}

// ── Bug 27.14 — output-folder propagation normalization ──────────────────────
//
// Upstream bmad-method's resolveConfigValue (official-modules.js) resolves the
// `{output_folder}` token via a `endsWith('_output_folder')` suffix match over
// all collected answers. When bmb (answer key `bmb_..._output_folder` = "skills")
// and gds are co-installed, gds's `{output_folder}` resolves alphabetically to
// bmb's "skills" value, so gds artifact paths become `{project-root}/skills/...`
// instead of `{project-root}/_bmad-output/...`.
//
// ma-agents owns no part of that resolution (it lives in vendored node_modules),
// so this is a post-install WORK-AROUND: after bmad-method writes the config,
// re-read `[core] output_folder` and rewrite any contaminated module artifact
// path back onto the canonical output folder. We deliberately scope the rewrite
// to the well-known core artifact keys so we never touch a module's INTENTIONAL
// own-folder values (e.g. bmb's `bmad_builder_output_folder = ".../skills"` or
// wds's `design_artifacts = ".../design-artifacts"`).
//
// Upstream follow-up (do NOT edit node_modules here): patch resolveConfigValue
// to require an exact `output_folder` / `core_output_folder` key instead of the
// `endsWith` suffix match. Tracked as an upstream follow-up.

// Artifact keys that must always live under `[core] output_folder`. These are
// the canonical bmm/gds planning+implementation+architecture artifact keys plus
// tea's test_artifacts. Module-specific own-folder keys (bmb_*_output_folder,
// design_artifacts, project_knowledge, *_output sub-paths) are intentionally
// excluded.
const OUTPUT_FOLDER_ARTIFACT_KEYS = [
    'planning_artifacts',
    'architecture_artifacts',
    'implementation_artifacts',
    'test_artifacts',
];

/**
 * Given an artifact path value and the canonical output folder, return a
 * corrected value if the path's output-folder segment differs from the
 * canonical one, or `null` if no change is needed.
 *
 * Handles both conventions:
 *   - `{project-root}/<seg>/<suffix...>`  (config.toml style)
 *   - `<seg>/<suffix...>`                 (config.yaml stripped style)
 *
 * The leading `<seg>` (the first path segment after an optional `{project-root}/`
 * prefix) is the resolved output folder; if it !== `outputFolder` it is rewritten.
 * Only single-segment output folders are handled (the bmad default), which covers
 * the observed `skills` vs `_bmad-output` contamination.
 */
function correctArtifactPath(value, outputFolder) {
    if (typeof value !== 'string' || !value) return null;
    const ROOT = '{project-root}/';
    let prefix = '';
    let rest = value;
    if (rest.startsWith(ROOT)) {
        prefix = ROOT;
        rest = rest.slice(ROOT.length);
    }
    const slash = rest.indexOf('/');
    if (slash === -1) return null; // no segment/suffix split — leave as-is
    const seg = rest.slice(0, slash);
    const suffix = rest.slice(slash); // includes leading '/'
    if (seg === outputFolder) return null; // already canonical
    return `${prefix}${outputFolder}${suffix}`;
}

/**
 * Rewrite contaminated artifact paths inside `_bmad/config.toml`. Returns the
 * number of lines changed. Uses line-based editing (no TOML dependency) so we
 * preserve comments, ordering, and formatting exactly.
 */
function normalizeTomlOutputFolders(tomlPath, outputFolder) {
    if (!fs.existsSync(tomlPath)) return 0;
    let raw;
    try {
        raw = fs.readFileSync(tomlPath, 'utf-8');
    } catch {
        return 0;
    }
    const usesCrlf = /\r\n/.test(raw);
    const eol = usesCrlf ? '\r\n' : '\n';
    const lines = raw.split(/\r?\n/);
    let changed = 0;
    let inModuleSection = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
        if (sectionMatch) {
            const section = sectionMatch[1].trim();
            inModuleSection = section.startsWith('modules.');
            continue;
        }
        if (!inModuleSection) continue;

        // key = "value"  (only quoted string values are artifact paths)
        const kvMatch = line.match(/^(\s*)([A-Za-z0-9_]+)(\s*=\s*)"([^"]*)"(\s*(?:#.*)?)$/);
        if (!kvMatch) continue;
        const [, indent, key, eq, val, trailer] = kvMatch;
        if (!OUTPUT_FOLDER_ARTIFACT_KEYS.includes(key)) continue;
        const corrected = correctArtifactPath(val, outputFolder);
        if (corrected === null) continue;
        lines[i] = `${indent}${key}${eq}"${corrected}"${trailer}`;
        changed++;
    }

    if (changed > 0) {
        fs.writeFileSync(tomlPath, lines.join(eol), 'utf-8');
    }
    return changed;
}

/**
 * Rewrite contaminated artifact paths inside a per-module `_bmad/<mod>/config.yaml`.
 * Returns the number of keys changed. Uses js-yaml so we keep schema fidelity.
 */
function normalizeYamlOutputFolders(yamlPath, outputFolder) {
    if (!fs.existsSync(yamlPath)) return 0;
    let raw;
    try {
        raw = fs.readFileSync(yamlPath, 'utf-8');
    } catch {
        return 0;
    }
    let doc;
    try {
        doc = yaml.parse(raw);
    } catch {
        return 0;
    }
    if (!doc || typeof doc !== 'object') return 0;

    let changed = 0;
    for (const key of OUTPUT_FOLDER_ARTIFACT_KEYS) {
        if (typeof doc[key] !== 'string') continue;
        const corrected = correctArtifactPath(doc[key], outputFolder);
        if (corrected === null) continue;
        doc[key] = corrected;
        changed++;
    }

    if (changed > 0) {
        // Preserve the leading comment header (everything up to the first
        // non-comment, non-blank line) so the "Generated by BMAD installer"
        // banner survives the rewrite.
        const headerLines = [];
        for (const l of raw.split(/\r?\n/)) {
            if (l.trim() === '' || l.trimStart().startsWith('#')) {
                headerLines.push(l);
            } else {
                break;
            }
        }
        const header = headerLines.length > 0 ? headerLines.join('\n') + '\n' : '';
        fs.writeFileSync(yamlPath, header + yaml.stringify(doc), 'utf-8');
    }
    return changed;
}

/**
 * Bug 27.14 — post-install pass that re-points any contaminated module artifact
 * path at the canonical `[core] output_folder`. Reads the output folder from
 * `_bmad/config.toml` (the install-owned source of truth), then normalizes both
 * `_bmad/config.toml` and every `_bmad/<mod>/config.yaml`.
 *
 * Idempotent and non-fatal: a second run finds nothing to change, and any I/O
 * error is logged and swallowed (config normalization must never abort an
 * otherwise-green install).
 *
 * @param {string} projectRoot - Absolute path to the project root.
 * @returns {number} Total number of artifact paths rewritten (for tests/logging).
 */
function normalizeModuleOutputFolders(projectRoot) {
    if (typeof projectRoot !== 'string' || !projectRoot) return 0;
    const tomlPath = path.join(projectRoot, BMAD_DIR, 'config.toml');
    if (!fs.existsSync(tomlPath)) return 0;

    let tomlRaw;
    try {
        tomlRaw = fs.readFileSync(tomlPath, 'utf-8');
    } catch {
        return 0;
    }

    // Extract `[core] output_folder = "..."`. Only the value inside the [core]
    // section counts; module sections may carry their own output_folder-like keys.
    let outputFolder = null;
    let inCore = false;
    for (const line of tomlRaw.split(/\r?\n/)) {
        const section = line.match(/^\s*\[([^\]]+)\]\s*$/);
        if (section) {
            inCore = section[1].trim() === 'core';
            continue;
        }
        if (!inCore) continue;
        const kv = line.match(/^\s*output_folder\s*=\s*"([^"]*)"/);
        if (kv) {
            outputFolder = kv[1].trim();
            break;
        }
    }
    if (!outputFolder) return 0; // nothing canonical to normalize against

    let total = 0;
    try {
        total += normalizeTomlOutputFolders(tomlPath, outputFolder);

        // Walk each `_bmad/<mod>/config.yaml`.
        const bmadDir = path.join(projectRoot, BMAD_DIR);
        let entries = [];
        try {
            entries = fs.readdirSync(bmadDir, { withFileTypes: true });
        } catch {
            entries = [];
        }
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const cfg = path.join(bmadDir, entry.name, 'config.yaml');
            total += normalizeYamlOutputFolders(cfg, outputFolder);
        }
    } catch (err) {
        console.warn(chalk.yellow(`  Warning: output-folder normalization skipped: ${err.message}`));
        return total;
    }

    if (total > 0) {
        console.log(chalk.green(
            `  Normalized ${total} module artifact path(s) to output folder "${outputFolder}/" (bug 27.14 work-around)`
        ));
    }
    return total;
}

/**
 * Migration shim: normalize the project layout so that canonical config lives
 * at `_bmad/bmm/config.yaml` (v6.3.0) instead of `_bmad/_config/manifest.yaml`
 * (legacy pre-6.3 location).
 *
 * Behavior (idempotent):
 *  - Both files present:       PREFER_NEW — log that legacy exists, do nothing.
 *      The new path already wins; operators can delete the legacy file at
 *      their discretion. We never read it silently.
 *  - Only new path present:    no-op (normal 6.3+ install).
 *  - Only legacy path present: flag for migration — return the signal so the
 *      caller can invoke bmad-method's installer to regenerate the new
 *      layout. We deliberately DO NOT translate-in-place: the legacy manifest
 *      schema differs from the new config schema (module list vs. shared
 *      core+module sections), and a faithful translation requires upstream
 *      knowledge we don't own.
 *  - Neither present:          no-op (fresh install — bmad-method will create
 *      the new layout).
 *
 * This function NEVER writes to the new path from legacy content and NEVER
 * reads legacy content as a value source. Its sole job is to surface the
 * drift signal so the caller can trigger regeneration via the normal install
 * flow, which writes `_bmad/bmm/config.yaml` directly.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {{
 *   newExists: boolean,
 *   legacyExists: boolean,
 *   needsRegeneration: boolean,
 * }}
 */
function ensureCanonicalConfigLocation(projectRoot) {
    const newPath = path.join(projectRoot, CANONICAL_CONFIG_REL);
    const legacyPath = path.join(projectRoot, LEGACY_MANIFEST_REL);
    const newExists = fs.existsSync(newPath);
    const legacyExists = fs.existsSync(legacyPath);

    if (newExists && legacyExists) {
        // Drift state. New wins; warn once so operators notice the legacy
        // file still lingering in `_bmad/_config/`. Story 22.6 removes the
        // manifest-surgery code that was writing there, so this file becomes
        // a non-participant after upgrade.
        console.log(chalk.yellow(
            `  Notice: legacy ${LEGACY_MANIFEST_REL} still present alongside ${CANONICAL_CONFIG_REL}. ` +
            `The canonical v6.3.0 path is used; the legacy file is ignored and may be removed.`
        ));
        return { newExists: true, legacyExists: true, needsRegeneration: false };
    }

    if (!newExists && legacyExists) {
        console.log(chalk.yellow(
            `  Detected legacy BMAD config at ${LEGACY_MANIFEST_REL} with no ${CANONICAL_CONFIG_REL}. ` +
            `bmad-method will regenerate the canonical v6.3.0 layout during install — legacy file is NOT read as a fallback.`
        ));
        return { newExists: false, legacyExists: true, needsRegeneration: true };
    }

    return { newExists, legacyExists: false, needsRegeneration: false };
}

// ── Migration constants ─────────────────────────────────────────────────────

const BMAD_TARGET_VERSION = '6.10.0';
const BMAD_MIGRATION_THRESHOLD = '6.2.0'; // versions below this need migration
const BACKUP_DIR_NAME = '.backup-pre-migration';

/**
 * Standard critical_actions injected by ma-agents (used to distinguish
 * user-added entries from standard ones during merge).
 */
const STANDARD_CRITICAL_ACTIONS = [
    'Read the skills MANIFEST at {project-root}',
    'For each skill marked always_load: true, read the skill file completely',
    'If _bmad-output/project-context.md exists, read it completely',
    'Follow all skill directives and project-context rules during this session',
];

// ── Migration functions ─────────────────────────────────────────────────────

/**
 * Compare two semver-style version strings (X.Y.Z only).
 * Returns -1 if a < b, 0 if a == b, 1 if a > b.
 *
 * **Limitation:** Only supports strict X.Y.Z numeric versions.
 * Pre-release suffixes (e.g. "6.2.1-beta.1") are ignored — the hyphen
 * and everything after it will be parsed as NaN by Number(), which
 * falls back to 0 via the `|| 0` guard. Two-segment versions like
 * "6.2" are handled by treating the missing patch as 0.
 *
 * @param {string} a - First version string (X.Y.Z)
 * @param {string} b - Second version string (X.Y.Z)
 * @returns {number} -1 | 0 | 1
 */
function compareVersions(a, b) {
    const SEMVER_RE = /^\d+\.\d+\.\d+$/;
    if (a && !SEMVER_RE.test(a)) {
        console.log(chalk.yellow(`  Warning: compareVersions received non-standard version "${a}" — only X.Y.Z is fully supported`));
    }
    if (b && !SEMVER_RE.test(b)) {
        console.log(chalk.yellow(`  Warning: compareVersions received non-standard version "${b}" — only X.Y.Z is fully supported`));
    }
    const pa = (a || '0.0.0').split('.').map(Number);
    const pb = (b || '0.0.0').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const va = pa[i] || 0;
        const vb = pb[i] || 0;
        if (va < vb) return -1;
        if (va > vb) return 1;
    }
    return 0;
}

/**
 * Detect whether a migration is needed by inspecting `_bmad/core/config.yaml`.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {{ action: 'install'|'update', migrate: boolean, fromVersion?: string }}
 */
function detectMigrationNeed(projectRoot) {
    const bmadPath = path.join(projectRoot, BMAD_DIR);
    if (!fs.existsSync(bmadPath)) {
        return { action: 'install', migrate: false };
    }

    // _bmad/ exists — try to read version from config.yaml
    const configPath = path.join(bmadPath, 'core', 'config.yaml');
    let version = null;

    if (fs.existsSync(configPath)) {
        try {
            const content = fs.readFileSync(configPath, 'utf-8');
            // Simple regex extraction — config.yaml is a simple key: value YAML
            const match = content.match(/^version:\s*['"]?([^\s'"#]+)/m);
            if (match) {
                version = match[1];
            }
        } catch {
            // Cannot read — treat as unknown version
        }
    }

    // If _bmad/ exists but no version found (e.g. config.yaml is `{}` or missing),
    // treat as needing migration since it's likely a pre-6.2.0 install
    if (!version) {
        console.log(chalk.yellow('  BMAD version not found in config.yaml — assuming pre-6.2.0 install'));
        return { action: 'update', migrate: true, fromVersion: 'unknown' };
    }

    if (compareVersions(version, BMAD_MIGRATION_THRESHOLD) < 0) {
        return { action: 'update', migrate: true, fromVersion: version };
    }

    return { action: 'update', migrate: false };
}

/**
 * Back up existing customize.yaml files before migration.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {Promise<string[]>} List of backed-up file names
 */
async function backupCustomizations(projectRoot) {
    const configDir = path.join(projectRoot, CONFIG_DIR);
    const backupDir = path.join(configDir, BACKUP_DIR_NAME);

    if (!fs.existsSync(configDir)) {
        console.log(chalk.gray('  No _bmad/_config/agents/ directory — nothing to back up'));
        return [];
    }

    const files = await fs.readdir(configDir);
    const customizeFiles = files.filter(f => f.endsWith('.customize.yaml'));

    if (customizeFiles.length === 0) {
        console.log(chalk.gray('  No customize.yaml files found — nothing to back up'));
        return [];
    }

    // Remove previous backup before creating a new one
    if (fs.existsSync(backupDir)) {
        await fs.remove(backupDir);
        console.log(chalk.dim('  Removed previous migration backup'));
    }

    await fs.ensureDir(backupDir);
    const backedUp = [];

    for (const file of customizeFiles) {
        await fs.copy(path.join(configDir, file), path.join(backupDir, file));
        backedUp.push(file);
        console.log(chalk.cyan(`    + Backed up: ${file}`));
    }

    console.log(chalk.green(`  Backed up ${backedUp.length} customize.yaml file(s) to ${BACKUP_DIR_NAME}/`));
    return backedUp;
}

/**
 * Restore backed-up customize.yaml files (rollback on failure).
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {Promise<boolean>} true if restore succeeded
 */
async function restoreCustomizations(projectRoot) {
    const configDir = path.join(projectRoot, CONFIG_DIR);
    const backupDir = path.join(configDir, BACKUP_DIR_NAME);

    if (!fs.existsSync(backupDir)) {
        console.log(chalk.yellow('  No backup directory found — cannot restore'));
        return false;
    }

    try {
        const files = await fs.readdir(backupDir);
        const customizeFiles = files.filter(f => f.endsWith('.customize.yaml'));

        for (const file of customizeFiles) {
            await fs.copy(path.join(backupDir, file), path.join(configDir, file), { overwrite: true });
            console.log(chalk.cyan(`    + Restored: ${file}`));
        }

        console.log(chalk.green(`  Restored ${customizeFiles.length} customize.yaml file(s) from backup`));
        return true;
    } catch (err) {
        console.error(chalk.red(`  Failed to restore customizations: ${err.message}`));
        return false;
    }
}

/**
 * Check whether a critical_action line is one of the standard ma-agents entries.
 * Uses a substring match against STANDARD_CRITICAL_ACTIONS patterns.
 */
function isStandardCriticalAction(line) {
    const trimmed = (typeof line === 'string' ? line : '').trim().replace(/^["']|["']$/g, '');
    return STANDARD_CRITICAL_ACTIONS.some(std => trimmed.includes(std));
}

/**
 * Parse a simple YAML customize.yaml file into a structured object.
 * Returns raw text sections for keys like persona, memories, critical_actions.
 * This is intentionally simple — only parses the top-level keys we care about.
 *
 * @param {string} content - YAML file content
 * @returns {{ memories: string[], criticalActions: string[], personaLines: string[], raw: string }}
 */
function parseCustomizeYaml(content) {
    const result = {
        memories: [],
        criticalActions: [],
        personaLines: [],
        raw: content,
    };

    const lines = content.split('\n');
    let currentSection = null;

    for (const line of lines) {
        // Detect top-level keys
        if (/^memories\s*:/.test(line)) {
            currentSection = 'memories';
            continue;
        } else if (/^critical_actions\s*:/.test(line)) {
            currentSection = 'criticalActions';
            continue;
        } else if (/^persona\s*:/.test(line)) {
            currentSection = 'persona';
            continue;
        } else if (/^[a-z_]+\s*:/.test(line) && !line.startsWith(' ') && !line.startsWith('\t')) {
            // New top-level key — stop current section
            currentSection = null;
        }

        if (currentSection === 'memories' && /^\s+[-\d]/.test(line)) {
            // Extract the value from list item (- "value") or numbered (1: "value")
            const listMatch = line.match(/^\s+-\s*["']?(.+?)["']?\s*$/);
            const numMatch = line.match(/^\s+\d+\s*:\s*["']?(.+?)["']?\s*$/);
            const value = listMatch ? listMatch[1] : (numMatch ? numMatch[1] : null);
            if (value) result.memories.push(value);
        } else if (currentSection === 'criticalActions' && /^\s+[-\d]/.test(line)) {
            const listMatch = line.match(/^\s+-\s*["']?(.+?)["']?\s*$/);
            const numMatch = line.match(/^\s+\d+\s*:\s*["']?(.+?)["']?\s*$/);
            const value = listMatch ? listMatch[1] : (numMatch ? numMatch[1] : null);
            if (value) result.criticalActions.push(value);
        } else if (currentSection === 'persona' && /^\s+/.test(line)) {
            result.personaLines.push(line);
        }
    }

    return result;
}

// ─── F1b: Legacy→plugin-bundle translation for upgrade migration ────────────
//
// Pre-6.3.0 ma-agents deployed `*.customize.yaml` files to `_bmad/_config/agents/`
// where BMAD's agent-compilation read persona/memories/critical_actions and
// injected them into the compiled agent prompts. Story 22.6 removed that
// compilation step and now delegates placement to bmad-method 6.3.0's
// PluginResolver via `--custom-source`. Result: `_bmad/_config/agents/` is no
// longer a deployment target — the deployed LLM-readable skills live at
// `<tool-skillsDir>/bmad-agent-<name>/SKILL.md` (for bmm-* personas BMAD
// itself deploys) and `<tool-skillsDir>/ma-agent-<name>/SKILL.md` (for the
// ma-agents-owned custom agents bundled in our plugin).
//
// Consequence: on upgrade from pre-6.3, simply merging user edits back into
// `_bmad/_config/agents/` silently strands them. This translator bridges the
// gap by parsing legacy `.customize.yaml` backups and appending user-edited
// content to the deployed `SKILL.md` files with idempotency markers so
// repeated runs do not duplicate content.

/**
 * Block marker used to delimit translated user customizations inside a
 * deployed SKILL.md file. Stable across runs so the translator can detect
 * a prior apply and replace the block rather than appending a second copy.
 * Public so tests can locate the block deterministically.
 */
const MA_CUSTOMIZATIONS_MARKER_START = '<!-- ma-agents:user-customizations:start -->';
const MA_CUSTOMIZATIONS_MARKER_END = '<!-- ma-agents:user-customizations:end -->';

/**
 * Diagnostic directory where legacy `.customize.yaml` files are preserved when
 * they contain fields that cannot be translated to the plugin-bundle format.
 * Kept under `_bmad/` so it survives across installs and is discoverable by
 * users looking for their pre-upgrade customizations.
 *
 * Stored as a forward-slash string (not `path.join`) so it is stable across
 * Windows and POSIX in user-facing log output; callers that need a
 * filesystem path should still pass it through `path.join`/`path.resolve`
 * which normalize mixed separators on Windows.
 */
const LEGACY_CUSTOMIZATIONS_DIR = '_bmad/.ma-agents-customizations-legacy';

/**
 * Map a legacy `.customize.yaml` filename (e.g. `bmm-pm.customize.yaml`) to the
 * set of candidate deployed skill directory names. Legacy files targeted the
 * pre-6.3 BMAD persona IDs (`bmm-<name>`); v6.3.0 deploys those personas as
 * plugin skills named `bmad-agent-<name>` and ma-agents-owned personas as
 * `ma-agent-<name>`. Both candidates are returned so the translator can
 * overlay whichever the upstream installer actually produced.
 *
 * @param {string} customizeFilename - e.g. `bmm-pm.customize.yaml`
 * @returns {string[]} Candidate skill directory names ordered by preference
 */
function getCandidateSkillDirNames(customizeFilename) {
    const base = customizeFilename.replace(/\.customize\.yaml$/, '');
    // `generic.customize.yaml` targeted a non-persona umbrella file that
    // BMAD 6.3.0 does not deploy — no skill candidate.
    if (base === 'generic') return [];
    // `bmm-<name>` legacy → `bmad-agent-<name>` (BMAD core) or `ma-agent-<name>`
    // (ma-agents plugin, for cyber/devops/sqa/sre/ml which used bmm-<name>
    // legacy filenames but are now owned by our plugin).
    if (base.startsWith('bmm-')) {
        const suffix = base.slice('bmm-'.length);
        return [`bmad-agent-${suffix}`, `ma-agent-${suffix}`];
    }
    // Already in `ma-agent-*` form → pass through.
    if (base.startsWith('ma-agent-')) return [base];
    // Unknown prefix — try as-is and as a `ma-agent-<id>` variant.
    return [base, `ma-agent-${base}`];
}

/**
 * Enumerate the IDE/BMAD tool skill directories that may contain deployed
 * persona skills. Reads from `lib/agents.js` so the list stays in lockstep
 * with the installer's own fan-out (Story 22.10). Returns absolute paths to
 * directories that actually exist on disk; non-existent tool dirs are
 * silently skipped (the tool was not selected for install).
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {string[]} Absolute skills-dir paths that exist
 */
function getDeployedSkillsRoots(projectRoot) {
    const agentsModule = require('./agents');
    const roots = new Set();
    for (const agent of agentsModule.getAllAgents()) {
        if (!agent || !agent.skillsDir) continue;
        const abs = path.resolve(projectRoot, agent.skillsDir);
        if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
            roots.add(abs);
        }
    }
    return [...roots];
}

/**
 * Build the translated markdown block to append to a deployed SKILL.md.
 * Encodes legacy user edits as a clearly-labelled section between the
 * ma-customizations markers. Pure string building — no filesystem access.
 *
 * Translation policy:
 *   - `memories[]` → bullet list under "### User Memories"
 *   - `critical_actions[]` (non-standard only) → numbered list under
 *     "### Additional Critical Actions (from pre-6.3 customization)"
 *   - `persona.*` lines (raw YAML child lines) → fenced YAML block under
 *     "### User Persona Overrides" so users can re-apply manually; we do
 *     NOT rewrite the deployed persona narrative (bmad-method v6.3.0 owns
 *     that content in SKILL.md's Identity/Communication Style sections).
 *
 * @param {object} parsed - Output of parseCustomizeYaml()
 * @param {string} sourceFilename - Original `.customize.yaml` name, for trace
 * @returns {{ block: string, droppedFields: string[] }}
 */
function buildCustomizationsMarkdownBlock(parsed, sourceFilename) {
    // Defang our own marker literals inside user-originated text BEFORE
    // interpolating it into the block template. A user memory/critical-
    // action/persona line that contains the literal marker would otherwise
    // let an attacker (or accidental copy-paste) break out of the block
    // and either swallow content during idempotent replace or inject
    // instructions outside the "this is user-migrated content" region.
    // A zero-width space inside the `ma-agents:` prefix is invisible to the
    // LLM's reader but disambiguates the string from our real markers.
    const defang = (s) => {
        if (typeof s !== 'string') return s;
        return s.replace(
            /<!--\s*ma-agents:user-customizations:(start|end)\s*-->/g,
            '<!-- ma-agents\u200B:user-customizations:$1 -->'
        );
    };

    const lines = [];
    lines.push(MA_CUSTOMIZATIONS_MARKER_START);
    lines.push('');
    lines.push(`## User Customizations (migrated from ${defang(sourceFilename)})`);
    lines.push('');
    lines.push('> Auto-migrated by ma-agents on upgrade to plugin-bundle format.');
    lines.push('> Edit this block directly or re-run `ma-agents install` after');
    lines.push(`> updating \`${defang(sourceFilename)}\` in \`${LEGACY_CUSTOMIZATIONS_DIR}/\`.`);
    lines.push('');

    // User-added memories (always user content).
    if (parsed.memories && parsed.memories.length > 0) {
        lines.push('### User Memories');
        lines.push('');
        for (const memory of parsed.memories) {
            lines.push(`- ${defang(memory)}`);
        }
        lines.push('');
    }

    // Non-standard critical_actions — filter out the standard ma-agents set
    // so upgrade does not duplicate what bmad-method already ships.
    const userCriticalActions = (parsed.criticalActions || []).filter(
        ca => !isStandardCriticalAction(ca)
    );
    if (userCriticalActions.length > 0) {
        lines.push('### Additional Critical Actions');
        lines.push('');
        userCriticalActions.forEach((ca, idx) => {
            lines.push(`${idx + 1}. ${defang(ca)}`);
        });
        lines.push('');
    }

    // Persona overrides — preserve as raw YAML because we cannot safely
    // rewrite the persona narrative without breaking the bmad-method-owned
    // SKILL.md structure. Users can read and re-apply as needed.
    const droppedFields = [];
    if (parsed.personaLines && parsed.personaLines.length > 0) {
        lines.push('### User Persona Overrides');
        lines.push('');
        lines.push('> NOTE: v6.3.0 deploys persona text directly in SKILL.md above.');
        lines.push('> These legacy overrides are preserved verbatim — review and');
        lines.push('> edit the persona sections above if you want them active.');
        lines.push('');
        lines.push('```yaml');
        lines.push('persona:');
        for (const ln of parsed.personaLines) {
            lines.push(defang(ln));
        }
        lines.push('```');
        lines.push('');
        droppedFields.push('persona (preserved as read-only YAML; v6.3.0 persona schema differs)');
    }

    lines.push(MA_CUSTOMIZATIONS_MARKER_END);
    return { block: lines.join('\n'), droppedFields };
}

/**
 * Apply the translated block to a single SKILL.md file. Idempotent: if the
 * file already contains a marker block, it is replaced in place; otherwise
 * the block is appended with a single blank line of separation. Writes are
 * skipped when the existing block byte-matches the incoming block (repeated
 * runs do not bump mtime).
 *
 * @param {string} skillFile - Absolute path to the SKILL.md
 * @param {string} block - Translated markdown block (with markers)
 * @returns {Promise<boolean>} true if the file was written, false if no-op
 */
async function applyCustomizationsBlockToSkill(skillFile, block) {
    const existing = await fs.readFile(skillFile, 'utf-8');
    const startIdx = existing.indexOf(MA_CUSTOMIZATIONS_MARKER_START);
    const endIdx = existing.indexOf(MA_CUSTOMIZATIONS_MARKER_END);
    let next;
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        // Replace existing block (idempotent on second run).
        const before = existing.slice(0, startIdx);
        const after = existing.slice(endIdx + MA_CUSTOMIZATIONS_MARKER_END.length);
        next = `${before.trimEnd()}\n\n${block}\n${after.trimStart() ? '\n' + after.trimStart() : ''}`;
    } else {
        // Append with separation.
        next = `${existing.trimEnd()}\n\n${block}\n`;
    }
    if (next === existing) return false;
    await fs.writeFile(skillFile, next, 'utf-8');
    return true;
}

/**
 * Translate user-edited legacy `.customize.yaml` files into appended blocks
 * on the deployed SKILL.md files across every tool skills-dir. Non-destructive
 * (wraps edits in marker block), idempotent (re-runs replace the block), and
 * preserves the original legacy file alongside so users can diff/inspect.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {Promise<{
 *   translated: Array<{ file: string, skillFiles: string[] }>,
 *   preserved: string[],
 *   warnings: string[],
 *   noTargetFound: string[],
 * }>}
 */
async function translateUserCustomizations(projectRoot) {
    const backupDir = path.join(projectRoot, CONFIG_DIR, BACKUP_DIR_NAME);
    const legacyPreserveDir = path.join(projectRoot, LEGACY_CUSTOMIZATIONS_DIR);
    const result = {
        translated: [],
        preserved: [],
        warnings: [],
        noTargetFound: [],
    };

    if (!fs.existsSync(backupDir)) {
        return result;
    }

    // Enumerate `.customize.yaml` entries but verify each is a regular file.
    // A directory or symlink-to-directory named with the suffix would otherwise
    // trigger a spurious "malformed" warning and pointless preservation on
    // every run — skip silently at the source.
    const backupEntries = await fs.readdir(backupDir, { withFileTypes: true });
    const backupFiles = backupEntries
        .filter(d => d.isFile() && d.name.endsWith('.customize.yaml'))
        .map(d => d.name);
    if (backupFiles.length === 0) {
        return result;
    }

    /**
     * Recognized top-level keys in a legacy `.customize.yaml`. Anything else
     * the user added (e.g. `extra_config`) cannot be translated without a
     * field-level mapping and is surfaced as a drop warning.
     */
    const KNOWN_TOP_LEVEL_KEYS = new Set([
        'memories', 'critical_actions', 'persona',
        // Epic 21 / Story 21.7 keys (handled by F1a, safe to ignore here):
        'phase', 'on_prem_phase_prefix',
    ]);

    const deployedSkillsRoots = getDeployedSkillsRoots(projectRoot);
    if (deployedSkillsRoots.length === 0) {
        result.warnings.push(
            'No deployed tool skills directories found under projectRoot — ' +
            'customizations preserved for manual reapplication.'
        );
    }

    // Resolve shipped customize defaults so we can tell which legacy files
    // represent actual user edits vs. verbatim-shipped defaults that the
    // user never touched. If the user never edited the file, we skip
    // translation entirely (no noise on the deployed SKILL.md).
    const shippedDir = path.join(__dirname, 'bmad-customize');

    for (const file of backupFiles) {
        const backupPath = path.join(backupDir, file);
        let parsed;
        try {
            const backupContent = await fs.readFile(backupPath, 'utf-8');
            parsed = parseCustomizeYaml(backupContent);
        } catch (err) {
            // Edge-case: legacy file malformed — log and continue so other
            // files still migrate. Preserves user data by copying the raw
            // file to the diagnostic directory.
            result.warnings.push(
                `Skipped malformed legacy file ${file}: ${err.message}`
            );
            try {
                await fs.ensureDir(legacyPreserveDir);
                await fs.copy(backupPath, path.join(legacyPreserveDir, file), { overwrite: true });
                result.preserved.push(file);
            } catch { /* best-effort preservation */ }
            continue;
        }

        // Scan the raw YAML for unknown top-level keys (user added a custom
        // field that cannot be translated). Surface as a non-blocking warning
        // so the user knows to re-apply manually from the preserved file.
        const unknownKeys = [];
        for (const line of (parsed.raw || '').split('\n')) {
            const m = line.match(/^([a-z_][a-z0-9_]*)\s*:/);
            if (m && !KNOWN_TOP_LEVEL_KEYS.has(m[1])) {
                if (!unknownKeys.includes(m[1])) unknownKeys.push(m[1]);
            }
        }

        // Detect user content vs. shipped defaults.
        const userMemories = parsed.memories || [];
        const userCriticalActions = (parsed.criticalActions || []).filter(
            ca => !isStandardCriticalAction(ca)
        );
        let hasPersonaOverride = false;
        const shippedPath = path.join(shippedDir, file);
        if (fs.existsSync(shippedPath)) {
            try {
                const shippedContent = await fs.readFile(shippedPath, 'utf-8');
                const shippedParsed = parseCustomizeYaml(shippedContent);
                if (
                    parsed.personaLines.join('\n').trim() !==
                        shippedParsed.personaLines.join('\n').trim() &&
                    parsed.personaLines.length > 0
                ) {
                    hasPersonaOverride = true;
                }
            } catch {
                // If shipped default unreadable, treat any persona content as user edit.
                if (parsed.personaLines.length > 0) hasPersonaOverride = true;
            }
        } else if (parsed.personaLines.length > 0) {
            hasPersonaOverride = true;
        }

        const hasUserContent =
            userMemories.length > 0 ||
            userCriticalActions.length > 0 ||
            hasPersonaOverride ||
            unknownKeys.length > 0;
        if (!hasUserContent) continue;

        // Build the translated block using only user-originated content.
        const userParsed = {
            memories: userMemories,
            criticalActions: userCriticalActions,
            // Only attach personaLines if the user actually overrode them,
            // so unchanged shipped persona defaults don't leak into the block.
            personaLines: hasPersonaOverride ? parsed.personaLines : [],
        };
        const { block, droppedFields } = buildCustomizationsMarkdownBlock(userParsed, file);

        // Fan out to every candidate skill dir across every installed tool.
        const candidates = getCandidateSkillDirNames(file);
        const skillFilesTouched = [];
        for (const root of deployedSkillsRoots) {
            for (const skillDirName of candidates) {
                const skillFile = path.join(root, skillDirName, 'SKILL.md');
                if (!fs.existsSync(skillFile)) continue;
                try {
                    // Return value (changed/no-op) is intentionally ignored —
                    // for the summary we report coverage, not mtime bumps.
                    // Idempotent re-runs report the same skill file list.
                    await applyCustomizationsBlockToSkill(skillFile, block);
                    skillFilesTouched.push(skillFile);
                } catch (err) {
                    result.warnings.push(
                        `Failed to apply translation to ${skillFile}: ${err.message}`
                    );
                }
            }
        }

        // Always preserve the legacy file so the user can diff/re-apply, and
        // emit a dropped-field warning if any field could not translate 1:1.
        try {
            await fs.ensureDir(legacyPreserveDir);
            await fs.copy(backupPath, path.join(legacyPreserveDir, file), { overwrite: true });
            if (!result.preserved.includes(file)) result.preserved.push(file);
        } catch (err) {
            result.warnings.push(
                `Could not preserve legacy file ${file} at ${legacyPreserveDir}: ${err.message}`
            );
        }

        if (droppedFields.length > 0) {
            result.warnings.push(
                `${file}: ${droppedFields.length} field(s) need manual review — ` +
                `${droppedFields.join(', ')} — see ${LEGACY_CUSTOMIZATIONS_DIR}/${file}`
            );
        }

        if (unknownKeys.length > 0) {
            result.warnings.push(
                `${file}: unknown top-level key(s) [${unknownKeys.join(', ')}] ` +
                `have no plugin-bundle equivalent — original preserved at ` +
                `${LEGACY_CUSTOMIZATIONS_DIR}/${file}`
            );
        }

        if (skillFilesTouched.length === 0) {
            // No deployed target matched this legacy file — user customizations
            // could not reach any live skill. Non-blocking but visible.
            result.noTargetFound.push(file);
            result.warnings.push(
                `${file}: no deployed SKILL.md matched candidates ` +
                `[${candidates.join(', ')}] — reapply manually from ` +
                `${LEGACY_CUSTOMIZATIONS_DIR}/${file}`
            );
        } else {
            result.translated.push({ file, skillFiles: skillFilesTouched });
        }
    }

    return result;
}

/**
 * Merge user customizations from backed-up files into new customize.yaml files.
 * Detects user-added memories, extra critical_actions, and persona overrides.
 *
 * As of F1b: after the legacy-format merge, also invokes
 * {@link translateUserCustomizations} so the user's edits reach the deployed
 * plugin-bundle SKILL.md files. The legacy-format write is retained for
 * backward compatibility with installs that still read `_bmad/_config/agents/`
 * (e.g. the hash-comparison path in bmad-method 6.3.0's installer.js@2706)
 * and for diagnostic visibility.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {Promise<{ merged: string[], skipped: string[], translation?: object }>}
 */
async function mergeUserCustomizations(projectRoot) {
    const configDir = path.join(projectRoot, CONFIG_DIR);
    const backupDir = path.join(configDir, BACKUP_DIR_NAME);
    const result = { merged: [], skipped: [] };

    if (!fs.existsSync(backupDir)) {
        console.log(chalk.gray('  No backup directory — skipping customization merge'));
        return result;
    }

    const backupFiles = (await fs.readdir(backupDir)).filter(f => f.endsWith('.customize.yaml'));

    for (const file of backupFiles) {
        const backupPath = path.join(backupDir, file);
        const newPath = path.join(configDir, file);

        const backupContent = await fs.readFile(backupPath, 'utf-8');
        const oldParsed = parseCustomizeYaml(backupContent);

        // Detect user additions
        const userMemories = oldParsed.memories; // all memories are user content
        const userCriticalActions = oldParsed.criticalActions.filter(ca => !isStandardCriticalAction(ca));

        // Detect persona overrides — compare with defaults from our shipped customizations
        const shippedDir = path.join(__dirname, 'bmad-customizations');
        const shippedPath = path.join(shippedDir, file);
        let hasPersonaOverride = false;

        if (fs.existsSync(shippedPath)) {
            const shippedContent = await fs.readFile(shippedPath, 'utf-8');
            const shippedParsed = parseCustomizeYaml(shippedContent);
            // If the user's persona section differs from shipped, they customized it
            if (oldParsed.personaLines.join('\n').trim() !== shippedParsed.personaLines.join('\n').trim()
                && oldParsed.personaLines.length > 0) {
                hasPersonaOverride = true;
            }
        } else {
            // No shipped version — any persona content is user-added
            if (oldParsed.personaLines.length > 0) {
                hasPersonaOverride = true;
            }
        }

        const hasUserContent = userMemories.length > 0 || userCriticalActions.length > 0 || hasPersonaOverride;

        if (!hasUserContent) {
            result.skipped.push(file);
            continue;
        }

        // Merge into new file
        let newContent;
        if (fs.existsSync(newPath)) {
            newContent = await fs.readFile(newPath, 'utf-8');
        } else {
            // New file doesn't exist — use backup as base
            newContent = backupContent;
        }

        // Append user memories
        if (userMemories.length > 0) {
            // Check if memories section already exists
            if (/^memories\s*:/m.test(newContent)) {
                // Append to existing memories section
                const memoriesBlock = userMemories.map(m => `  - "${m}"`).join('\n');
                newContent = newContent.replace(/^(memories\s*:.*)/m, `$1\n${memoriesBlock}`);
            } else {
                // Add new memories section
                const memoriesBlock = '\nmemories:\n' + userMemories.map(m => `  - "${m}"`).join('\n') + '\n';
                newContent = newContent.trimEnd() + '\n' + memoriesBlock;
            }
            console.log(chalk.cyan(`    + Merged ${userMemories.length} user memories into ${file}`));
        }

        // Append user critical_actions (non-standard ones)
        if (userCriticalActions.length > 0) {
            if (/^critical_actions\s*:/m.test(newContent)) {
                // Find the last numbered entry and continue from there
                const caLines = newContent.split('\n');
                let lastCaIdx = -1;
                let lastNum = 0;
                for (let i = 0; i < caLines.length; i++) {
                    const numMatch = caLines[i].match(/^\s+(\d+)\s*:/);
                    if (numMatch && parseInt(numMatch[1]) > lastNum) {
                        lastNum = parseInt(numMatch[1]);
                        lastCaIdx = i;
                    }
                }
                if (lastCaIdx >= 0) {
                    const extraLines = userCriticalActions.map((ca, idx) =>
                        `  ${lastNum + idx + 1}: "${ca}"`
                    );
                    caLines.splice(lastCaIdx + 1, 0, ...extraLines);
                    newContent = caLines.join('\n');
                }
            } else {
                const caBlock = '\ncritical_actions:\n' + userCriticalActions.map((ca, idx) =>
                    `  ${idx + 1}: "${ca}"`
                ).join('\n') + '\n';
                newContent = newContent.trimEnd() + '\n' + caBlock;
            }
            console.log(chalk.cyan(`    + Merged ${userCriticalActions.length} user critical_actions into ${file}`));
        }

        // If persona was overridden by the user, keep the user's persona block
        if (hasPersonaOverride) {
            // Replace persona section in new file with user's version
            const personaBlock = 'persona:\n' + oldParsed.personaLines.join('\n');
            if (/^persona\s*:/m.test(newContent)) {
                // Replace existing persona section up to next top-level key
                newContent = newContent.replace(
                    /^persona\s*:[\s\S]*?(?=\n[a-z_]+\s*:|$)/m,
                    personaBlock + '\n'
                );
            } else {
                newContent = newContent.trimEnd() + '\n' + personaBlock + '\n';
            }
            console.log(chalk.cyan(`    + Preserved user persona overrides in ${file}`));
        }

        await fs.writeFile(newPath, newContent, 'utf-8');

        // Validate merged output: re-read and parse to ensure YAML integrity
        try {
            const written = await fs.readFile(newPath, 'utf-8');
            const validated = parseCustomizeYaml(written);
            if (validated.criticalActions.length === 0 && written.includes('critical_actions:')) {
                // critical_actions section exists but parsed to nothing — likely corrupt
                console.log(chalk.yellow(`    ! Merge output validation failed for ${file} — restoring from backup`));
                await fs.copy(backupPath, newPath, { overwrite: true });
                result.skipped.push(file);
                continue;
            }
        } catch (parseErr) {
            console.log(chalk.yellow(`    ! Merge output parse error for ${file}: ${parseErr.message} — restoring from backup`));
            await fs.copy(backupPath, newPath, { overwrite: true });
            result.skipped.push(file);
            continue;
        }

        result.merged.push(file);
    }

    if (result.merged.length > 0) {
        console.log(chalk.green(`  Merged user customizations into ${result.merged.length} file(s)`));
    }
    if (result.skipped.length > 0) {
        console.log(chalk.gray(`  ${result.skipped.length} file(s) had no user customizations to merge`));
    }

    // F1b: translate user edits to the plugin-bundle format so they reach the
    // deployed SKILL.md files. The legacy merge above keeps
    // `_bmad/_config/agents/` consistent (for bmad-method's own hash-compare
    // path) but the LLM-readable skills live in `<tool>/skills/`; this is the
    // load-bearing step on upgrade.
    try {
        const translation = await translateUserCustomizations(projectRoot);
        result.translation = translation;

        if (translation.translated.length > 0) {
            const totalSkillFiles = translation.translated.reduce(
                (acc, t) => acc + t.skillFiles.length, 0
            );
            console.log(chalk.green(
                `  Translated ${translation.translated.length} customization(s) ` +
                `to ${totalSkillFiles} deployed SKILL.md file(s)`
            ));
        }
        if (translation.preserved.length > 0) {
            console.log(chalk.gray(
                `  Preserved ${translation.preserved.length} legacy customize.yaml ` +
                `file(s) at ${LEGACY_CUSTOMIZATIONS_DIR}/ for manual review`
            ));
        }
        for (const warning of translation.warnings) {
            console.log(chalk.yellow(`  ! ${warning}`));
        }
        if (translation.noTargetFound.length > 0) {
            console.log(chalk.yellow(
                `  Summary: ${translation.translated.length} customization(s) migrated; ` +
                `${translation.noTargetFound.length} require manual reapplication — ` +
                `see ${LEGACY_CUSTOMIZATIONS_DIR}/`
            ));
        }
    } catch (err) {
        // Translation failures are non-blocking: the legacy merge already ran,
        // and the preserved backup gives the user a path to re-apply by hand.
        console.log(chalk.yellow(
            `  ! Customization translation failed: ${err.message} — ` +
            `legacy files preserved at ${BACKUP_DIR_NAME}/`
        ));
    }

    return result;
}

/**
 * Clean up legacy artifacts after successful migration.
 * Conservative approach: only removes known-replaced files.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {Promise<string[]>} List of cleaned-up paths (relative to projectRoot)
 */
async function cleanupLegacyArtifacts(projectRoot) {
    const cleaned = [];

    // 1. Remove old custom agent XML definitions in _bmad/custom/agents/
    const customAgentsDir = path.join(projectRoot, BMAD_DIR, 'custom', 'agents');
    if (fs.existsSync(customAgentsDir)) {
        const files = await fs.readdir(customAgentsDir);
        for (const file of files) {
            if (file.endsWith('.xml')) {
                await fs.remove(path.join(customAgentsDir, file));
                const relPath = path.join(BMAD_DIR, 'custom', 'agents', file);
                cleaned.push(relPath);
            }
        }
    }

    // 2. Remove legacy YAML workflow files (engine artifacts, not extension workflows)
    // These are in _bmad/bmm/workflows/ — only remove known legacy patterns
    const legacyWorkflowDir = path.join(projectRoot, BMAD_DIR, 'bmm', 'workflows');
    if (fs.existsSync(legacyWorkflowDir)) {
        const entries = await fs.readdir(legacyWorkflowDir);
        for (const entry of entries) {
            const entryPath = path.join(legacyWorkflowDir, entry);
            const stat = await fs.stat(entryPath);
            // Only remove .yaml files at the root of workflows/ (legacy engine artifacts)
            // Do NOT remove subdirectories (those contain current workflow content)
            if (!stat.isDirectory() && entry.endsWith('.yaml')) {
                await fs.remove(entryPath);
                const relPath = path.join(BMAD_DIR, 'bmm', 'workflows', entry);
                cleaned.push(relPath);
            }
        }
    }

    // NOTE: Backup directory (.backup-pre-migration/) is intentionally preserved
    // after cleanup. It is only removed when a NEW backup is created by
    // backupCustomizations() during the next migration cycle. This ensures
    // users can manually recover customizations if needed.

    // Print migration log
    if (cleaned.length > 0) {
        console.log(chalk.green(`\n  Migration cleanup summary:`));
        for (const item of cleaned) {
            console.log(chalk.gray(`    - Removed: ${item}`));
        }
        console.log(chalk.green(`  Cleaned up ${cleaned.length} legacy artifact(s)`));
    } else {
        console.log(chalk.gray('  No legacy artifacts to clean up'));
    }

    return cleaned;
}

/**
 * Restore _git_preserved → .git and set origin to a local file:// URL.
 *
 * bmad-method's cloneExternalModule() runs `git fetch origin --depth 1` on
 * cached modules.  On a disconnected machine that fetch fails, which causes
 * bmad-method to DELETE the cached directory and attempt a fresh clone (which
 * also fails).  By pointing origin at the local directory itself the fetch
 * becomes a no-op local operation that succeeds without network access.
 */
function restoreGitDir(moduleDir) {
    const preserved = path.join(moduleDir, '_git_preserved');
    const gitDir = path.join(moduleDir, '.git');

    if (!fs.existsSync(preserved)) return;
    if (fs.existsSync(gitDir)) {
        fs.removeSync(gitDir);
    }
    fs.renameSync(preserved, gitDir);

    // Point origin at the local directory so `git fetch origin` succeeds offline.
    // Use pathToFileURL so a Windows absolute path becomes a well-formed
    // `file:///C:/...` URL (three slashes) rather than `file://C:/...`, and so
    // paths containing spaces or other reserved characters are percent-encoded.
    // execFileSync (arg array) avoids shell interpolation — matching the rest of
    // the codebase's git calls (see scripts/build-bmad-cache.js).
    try {
        const localUrl = pathToFileURL(moduleDir).href;
        execFileSync('git', ['remote', 'set-url', 'origin', localUrl], {
            cwd: moduleDir,
            stdio: 'pipe'
        });
    } catch {
        // Non-fatal — worst case the fetch fails and bmad-method re-clones
    }
}

module.exports = {
    isBmadInstalled,
    buildBmadArgs,
    resolveCustomContentFlag,
    installBmad,
    updateBmad,
    prePopulateBmadCache,
    deployMethodology,
    deployClineWorkflows,
    // Story 27.4 — exported for unit tests of stale-wrapper reconciliation
    isGeneratedClineWrapper,
    // Story 22.7 — canonical config (_bmad/bmm/config.yaml) helpers
    readCanonicalBmadConfig,
    normalizeModuleOutputFolders,
    correctArtifactPath,
    ensureCanonicalConfigLocation,
    CANONICAL_CONFIG_REL,
    LEGACY_MANIFEST_REL,
    // Story 22.6 — stage-and-invoke helpers (exported for unit tests)
    stagePlugin,
    cleanupStage,
    PLUGIN_STAGE_DIR_NAME,
    // Story 30.6b — custom-marketplace subset install (exported for unit tests)
    installCustomMarketplaceSubset,
    // F2a — Story 22.8 gitignore policy (project-root only). Exported so the
    // regression test can invoke it directly without spinning up the full
    // CLI / bmad-method pipeline.
    ensurePluginStageGitignoredForProject,
    // Migration functions (exported for testing)
    detectMigrationNeed,
    compareVersions,
    backupCustomizations,
    restoreCustomizations,
    mergeUserCustomizations,
    cleanupLegacyArtifacts,
    parseCustomizeYaml,
    // F1b — exported for unit/integration tests
    translateUserCustomizations,
    buildCustomizationsMarkdownBlock,
    applyCustomizationsBlockToSkill,
    getCandidateSkillDirNames,
    getDeployedSkillsRoots,
    MA_CUSTOMIZATIONS_MARKER_START,
    MA_CUSTOMIZATIONS_MARKER_END,
    LEGACY_CUSTOMIZATIONS_DIR,
    // Story 21.7 — phase-aware persona prefix (exported for testing)
    applyPersonaPhasePrefix,
    // F1a — on-prem persona phase-prefix restoration post-22.6
    // (exported for integration testing)
    applyOnPremPhasePrefixToDeployedSkills,
    injectOnPremPrefixBlock,
    buildOnPremPrefixBlock,
    PERSONA_SKILL_MAP,
    TOOL_SKILL_DIRS,
    ON_PREM_PREFIX_MARKER_BEGIN,
    ON_PREM_PREFIX_MARKER_END,
    // Offline-safe recompile helpers (exported for testing — see bug
    // bug-bmad-recompile-fails-on-airgapped-network)
    isOfflineModeDeclared,
    looksLikeOfflineFailure,
    looksLikeEbusyFailure,
    inspectBmadCache,
    classifyRecompileFailure,
    // Shared subprocess primitive (exported for testing — Story 28.2 / FR212:
    // the install/update/migration success-or-failure decision rides on whether
    // this throws on a non-zero exit, NOT on parsing installer stdout, so the
    // v6.9.0 warn-only `uv` banner cannot affect it).
    runCommand,
    // Module selection — replaces hardcoded ['bmm'] in the CLI install path
    BMAD_MODULE_DESCRIPTIONS,
    getInstallableBmadModules,
    getInstalledBmadModules,
    resolveBmadModules,
    // 3.12.2 — offline-fallback marker for bmad-method's cloneExternalModule
    ensureCacheMarker,
};
