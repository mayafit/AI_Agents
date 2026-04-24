const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
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

async function installBmad(modules = ['bmm', 'bmb'], tools = [], projectRoot = process.cwd(), force = false, { userName = '', commLang = '', docLang = '', outputFolder = '' } = {}) {
    // Story 22.7 AC #6 — normalize the config location BEFORE any read that
    // assumes the canonical v6.3.0 path. This runs ahead of
    // detectMigrationNeed() so operators upgrading from a pre-6.3 install get
    // a clear message that legacy config is NOT used as a fallback; the
    // downstream bmad-method install will regenerate the new layout.
    ensureCanonicalConfigLocation(projectRoot);

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
        // F1a — on-prem persona phase-prefix pass. Runs BEFORE
        // deployMethodology so a methodology-deploy failure doesn't prevent
        // the prefix from being applied (they are independent concerns).
        // No-op for standard profile; reads profile from `.ma-agents.json`
        // if present (the same signal setProfile() / Story 21.10 writes).
        const profile = require('./profile').getProfile(projectRoot);
        await applyOnPremPhasePrefixToDeployedSkills(projectRoot, profile);
        await deployMethodology(projectRoot, force);
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

    // All migration steps succeeded — safe to clean up the stage now.
    // Cleaning up earlier would remove diagnostics if any of steps 3-4 or
    // deployMethodology failed after a successful bmad-method invocation.
    cleanupStage(stagePath);

    console.log(chalk.green(`  Migration to BMAD ${BMAD_TARGET_VERSION} complete!`));
    return true;
}

async function updateBmad(modules = ['bmm', 'bmb'], tools = [], projectRoot = process.cwd(), force = false, { userName = '', commLang = '', docLang = '', outputFolder = '' } = {}) {
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
const TOOL_SKILL_DIRS = Object.freeze([
    path.join('.claude', 'skills'),
    path.join('.github', 'copilot', 'skills'),
    path.join('.cline', 'skills'),
    path.join('.roo', 'skills'),
    path.join('.kilocode', 'skills'),
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

async function prePopulateBmadCache(force = false) {
    const cacheSource = path.join(__dirname, 'bmad-cache');
    if (!(await fs.pathExists(cacheSource))) {
        console.log(chalk.gray('  No bundled BMAD cache found — skipping pre-population'));
        return;
    }

    try {
        const targetDir = path.join(os.homedir(), '.bmad', 'cache', 'external-modules');
        await fs.ensureDir(targetDir);

        const entries = await fs.readdir(cacheSource);
        const modules = entries.filter(e => e !== 'cache-manifest.json');

        let copied = 0, skipped = 0, replaced = 0;

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
        }

        if (copied > 0 || replaced > 0) {
            console.log(chalk.gray(`  Cache pre-population complete: ${copied} copied, ${skipped} skipped, ${replaced} replaced`));
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

const BMAD_TARGET_VERSION = '6.3.0';
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

/**
 * Merge user customizations from backed-up files into new customize.yaml files.
 * Detects user-added memories, extra critical_actions, and persona overrides.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {Promise<{ merged: string[], skipped: string[] }>}
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

    // Point origin at the local directory so `git fetch origin` succeeds offline
    try {
        const localUrl = 'file://' + moduleDir.replace(/\\/g, '/');
        execSync(`git remote set-url origin "${localUrl}"`, {
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
    // Story 22.7 — canonical config (_bmad/bmm/config.yaml) helpers
    readCanonicalBmadConfig,
    ensureCanonicalConfigLocation,
    CANONICAL_CONFIG_REL,
    LEGACY_MANIFEST_REL,
    // Story 22.6 — stage-and-invoke helpers (exported for unit tests)
    stagePlugin,
    cleanupStage,
    PLUGIN_STAGE_DIR_NAME,
    // Migration functions (exported for testing)
    detectMigrationNeed,
    compareVersions,
    backupCustomizations,
    restoreCustomizations,
    mergeUserCustomizations,
    cleanupLegacyArtifacts,
    parseCustomizeYaml,
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
};
