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

    // Extension module — always pass on both install and update.
    // bmad-method 6.2.2 detects _bmad/_config/custom/ on update and tries
    // to reinstall the cached module, but fails with "Source for module
    // 'custom' is not available" unless the source path is provided.
    //
    // bmad-method 6.3.0 renamed the flag from --custom-content to
    // --custom-source (see tools/installer/commands/install.js:25). We detect
    // which flag the installed version supports and use it. This is a
    // minimal rename — Story 22.6 replaces applyCustomizations() with the
    // stage-and-invoke design that no longer depends on either flag.
    const extensionPath = path.join(__dirname, 'bmad-extension');
    if (fs.existsSync(extensionPath)) {
        const flag = resolveCustomContentFlag();
        parts.push(flag, `"${extensionPath}"`);
    }

    if (ctx.action === 'update') {
        parts.push('--action', 'update');
    }

    return getBmadCommand(parts.join(' '));
}

async function installBmad(modules = ['bmm', 'bmb'], tools = [], projectRoot = process.cwd(), force = false, { userName = '', commLang = '', docLang = '', outputFolder = '' } = {}) {
    // Detect migration need
    const detection = detectMigrationNeed(projectRoot);

    if (detection.migrate) {
        const fromLabel = detection.fromVersion === 'unknown' ? 'unknown version' : detection.fromVersion;
        console.log(chalk.yellow(`  Upgrading BMAD from ${fromLabel} to ${BMAD_TARGET_VERSION}...`));
        return await runMigration(modules, tools, projectRoot, force, { userName, commLang, docLang, outputFolder });
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
    });

    await prePopulateBmadCache(force);

    console.log(chalk.gray(`  Running: ${command}`));
    try {
        runCommand(command, { cwd: projectRoot, env: buildChildSpawnEnv() });
        await deployMethodology(projectRoot, force);
        return true;
    } catch (error) {
        console.error(chalk.red(`  BMAD installation failed: ${error.message}`));
        return false;
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
    const command = buildBmadArgs({
        projectRoot,
        modules,
        tools,
        action: 'update',
        userName,
        commLang,
        docLang,
        outputFolder,
    });

    await prePopulateBmadCache(force);

    console.log(chalk.gray(`  Running: ${command}`));
    try {
        runCommand(command, { cwd: projectRoot, env: buildChildSpawnEnv() });
    } catch (error) {
        // Rollback on failure
        console.error(chalk.red(`  BMAD update failed: ${error.message}`));
        if (backedUpFiles.length > 0) {
            console.log(chalk.yellow('  Rolling back — restoring backed-up customizations...'));
            await restoreCustomizations(projectRoot);
        }
        console.error(chalk.red('  Migration aborted. Your project remains on the previous version.'));
        console.error(chalk.yellow('  Suggestion: Run "npm update bmad-method" manually, then retry installation.'));
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

    await deployMethodology(projectRoot, force);

    console.log(chalk.green(`  Migration to BMAD ${BMAD_TARGET_VERSION} complete!`));
    return true;
}

async function updateBmad(modules = ['bmm', 'bmb'], tools = [], projectRoot = process.cwd(), force = false, { userName = '', commLang = '', docLang = '', outputFolder = '' } = {}) {
    const command = buildBmadArgs({
        projectRoot,
        modules,
        tools,
        action: 'update',
        userName,
        commLang,
        docLang,
        outputFolder,
    });

    await prePopulateBmadCache(force);

    // bmad-method 6.2.2 installs the custom extension as module "custom" in _bmad/
    // but caches it as "ma-skills" (the code from module.yaml). On update it reads
    // the files-manifest, finds module "custom", and fails because it can't locate
    // the source for a module named "custom". Fix: strip stale "custom" module
    // entries from the manifest so the module gets cleanly reinstalled via --custom-content.
    // bmad-method 6.2.2 bug: on --action update --yes, the installer reads
    // manifest.yaml to discover previously installed modules, then preserves them
    // all (non-interactive default). It then tries to reinstall each one.
    // "custom" fails because there's no source under that name (it's "ma-skills"),
    // and "bmb" fails due to a broken directory structure in 6.2.2.
    //
    // Fix: before running bmad-method, clean all three persistence layers:
    //   1. manifest.yaml   — remove stale module entries
    //   2. files-manifest.csv — remove stale file tracking entries
    //   3. physical directories — remove _bmad/bmb/ and _bmad/_config/custom/

    const staleModules = ['custom', 'bmb'];

    // 1. Clean manifest.yaml (the primary trigger for the re-install loop)
    const yamlManifestPath = path.join(projectRoot, BMAD_DIR, '_config', 'manifest.yaml');
    if (fs.existsSync(yamlManifestPath)) {
        try {
            const yamlContent = await fs.readFile(yamlManifestPath, 'utf-8');
            const manifest = yaml.parse(yamlContent);
            if (manifest?.modules && Array.isArray(manifest.modules)) {
                const before = manifest.modules.length;
                manifest.modules = manifest.modules.filter(
                    m => !staleModules.includes(typeof m === 'string' ? m : m.name)
                );
                const removed = before - manifest.modules.length;
                if (removed > 0) {
                    await fs.writeFile(yamlManifestPath, yaml.stringify(manifest), 'utf-8');
                    console.log(chalk.gray(`  Cleaned ${removed} stale module(s) from manifest.yaml`));
                }
            }
        } catch (err) {
            // Non-fatal
        }
    }

    // 2. Clean files-manifest.csv (prevents stale file-tracking references)
    const filesManifestPath = path.join(projectRoot, BMAD_DIR, '_config', 'files-manifest.csv');
    if (fs.existsSync(filesManifestPath)) {
        try {
            let csv = await fs.readFile(filesManifestPath, 'utf-8');
            const before = csv.split('\n').length;
            csv = csv.split('\n').filter(line => {
                const fields = line.split(',');
                const mod = fields[2] && fields[2].replace(/"/g, '');
                return !staleModules.includes(mod);
            }).join('\n');
            const after = csv.split('\n').length;
            if (after < before) {
                await fs.writeFile(filesManifestPath, csv, 'utf-8');
                console.log(chalk.gray(`  Cleaned ${before - after} stale entries from files-manifest.csv`));
            }
        } catch (err) {
            // Non-fatal
        }
    }

    // 3. Remove physical directories so bmad-method's manifest-generator
    //    doesn't re-discover them via scanInstalledModules().
    //    _bmad/custom/ is safe to remove — applyCustomizations() recreates it after.
    const staleDirs = [
        path.join(projectRoot, BMAD_DIR, 'bmb'),
        path.join(projectRoot, BMAD_DIR, 'custom'),
        path.join(projectRoot, BMAD_DIR, '_config', 'custom'),
    ];
    for (const dir of staleDirs) {
        if (fs.existsSync(dir)) {
            try {
                await fs.remove(dir);
                console.log(chalk.gray(`  Removed stale directory: ${path.relative(projectRoot, dir)}`));
            } catch (err) {
                // Non-fatal
            }
        }
    }

    console.log(chalk.gray(`  Running: ${command}`));
    try {
        runCommand(command, { cwd: projectRoot, env: buildChildSpawnEnv() });
        await deployMethodology(projectRoot, force);
        return true;
    } catch (error) {
        console.error(chalk.red(`  BMAD update failed: ${error.message}`));
        return false;
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

async function applyCustomizations(projectRoot = process.cwd(), modules = ['bmm', 'bmb'], tools = [], selectedAgentIds = [], force = false, { userName = '', commLang = '', docLang = '', outputFolder = '' } = {}) {
    const sourceDir = path.join(__dirname, 'bmad-customizations');
    const workflowSourceDir = path.join(__dirname, 'bmad-workflows');
    const configTargetDir = path.join(projectRoot, CONFIG_DIR);
    const agentTargetDir = path.join(projectRoot, BMAD_DIR, 'custom', 'agents');
    const workflowTargetDir = path.join(projectRoot, BMAD_DIR, 'bmm', 'workflows');
    const templateSourceDir = path.join(__dirname, 'mil498-templates');
    const templateTargetDir = path.join(projectRoot, BMAD_DIR, 'bmm', 'templates', 'mil498');

    // Mapping from BMAD agent IDs to their .md template filenames
    const agentMdMap = {
        'bmm-sre': 'sre.md',
        'bmm-devops': 'devops.md',
        'bmm-cyber': 'cyber.md',
        'bmm-mil498': 'mil498.md',
        'bmm-demerzel': 'demerzel.md'
    };

    // 1. Apply YAML customizations (filtered by selected agents)
    // These must be in place BEFORE recompile so BMAD can use them during compilation
    if (fs.existsSync(sourceDir)) {
        await fs.ensureDir(configTargetDir);
        const files = await fs.readdir(sourceDir);
        for (const file of files) {
            if (file.endsWith('.customize.yaml')) {
                const agentId = file.replace('.customize.yaml', '');
                // Always copy generic; filter others by selected agents
                if (agentId === 'generic' || selectedAgentIds.length === 0 || selectedAgentIds.includes(agentId)) {
                    await fs.copy(path.join(sourceDir, file), path.join(configTargetDir, file));
                    console.log(chalk.cyan(`    + Applied customization: ${file}`));
                }
            }
        }
    }

    // 2. Apply detailed agent templates to custom dir (.md files, filtered by selected agents)
    // These go to _bmad/custom/agents/ for BMAD's custom agent resolution
    if (fs.existsSync(sourceDir)) {
        await fs.ensureDir(agentTargetDir);
        const files = await fs.readdir(sourceDir);
        for (const file of files) {
            if (file.endsWith('.md')) {
                const matchingAgentId = Object.entries(agentMdMap).find(([, mdFile]) => mdFile === file)?.[0];
                if (!matchingAgentId || selectedAgentIds.length === 0 || selectedAgentIds.includes(matchingAgentId)) {
                    await fs.copy(path.join(sourceDir, file), path.join(agentTargetDir, file));
                    console.log(chalk.cyan(`    + Applied agent template: ${file}`));
                }
            }
        }
    }

    // STAGE:RECOMPILE — Recompile agents to apply YAML customizations
    // IMPORTANT: Steps 3-5 must run AFTER recompile because the recompile regenerates
    // the _bmad/bmm/ tree and would wipe any files placed there beforehand.
    const command = buildBmadArgs({
        projectRoot,
        modules,
        tools,
        action: 'install',
        userName,
        commLang,
        docLang,
        outputFolder,
    });
    await prePopulateBmadCache(force);

    console.log(chalk.gray(`  Running: ${command}`));
    try {
        runCommand(command, { cwd: projectRoot, env: buildChildSpawnEnv() });
    } catch (error) {
        // Air-gapped / offline classification (bug-bmad-recompile-fails-on-airgapped-network).
        // bmad-method 6.2.2 unconditionally performs `git fetch` / `git clone` / `npm install`
        // against external module repos; on a disconnected host those calls throw and we used
        // to swallow the error with a one-line red banner. Instead: classify the failure,
        // downgrade to a warning when the vendored cache is intact, or surface an actionable
        // error listing the missing modules and the remediation command.
        const diagnosis = classifyRecompileFailure(error);
        if (diagnosis.action === 'warn') {
            console.warn(chalk.yellow(`  BMAD recompile warning (offline): ${diagnosis.message}`));
        } else if (diagnosis.action === 'error') {
            console.error(chalk.red(`  BMAD recompile failed: ${diagnosis.message}`));
        } else {
            console.error(chalk.red(`  BMAD recompile failed: ${diagnosis.message}`));
        }
    }

    // STAGE:EXTENSION — Deploy BMAD extension module (AFTER recompile — extensions/ survives recompile)
    // NOTE: Stage 1 deploys persona/menu customize.yaml to _bmad/_config/agents/ (consumed
    // by BMAD's agent compilation). This stage deploys the extension module to
    // _bmad/extensions/ma-agents-skills/ which adds critical_actions for skill loading.
    // These are complementary paths: _config/agents/ drives agent recompilation (persona/menu),
    // while extensions/ adds runtime behavior (critical_actions). BMAD does NOT merge them —
    // they are consumed by different mechanisms. The 4 custom agents have persona/menu in both
    // locations; this is intentional for backward compatibility during transition (Story 8.3).
    const extensionSource = path.join(__dirname, 'bmad-extension');
    const extensionTarget = path.join(projectRoot, BMAD_DIR, 'extensions', 'ma-agents-skills');
    if (fs.existsSync(extensionSource)) {
        await fs.ensureDir(extensionTarget);
        await fs.copy(extensionSource, extensionTarget);
        console.log(chalk.cyan('    + Deployed BMAD extension module: ma-agents-skills'));
    }

    // STAGE:CUSTOMIZE — Deploy built-in agent customizations from lib/bmad-customize/
    // These add critical_actions to the 8 built-in BMM agents (pm, architect, dev, qa,
    // sm, tech-writer, ux-designer, bmad-master) so they load project skills at startup.
    // Runs AFTER --custom-content (extension module) and BEFORE quick-update.
    // Post-deploy: phase:/on_prem_phase_prefix: keys are stripped for standard profile;
    // for on-prem profile the prefix is injected as critical_actions[0] instead.
    const customizeSource = path.join(__dirname, 'bmad-customize');
    if (fs.existsSync(customizeSource)) {
        await fs.ensureDir(configTargetDir);
        const customizeFiles = (await fs.readdir(customizeSource)).filter(f => f.endsWith('.customize.yaml'));
        for (const file of customizeFiles) {
            await fs.copy(path.join(customizeSource, file), path.join(configTargetDir, file));
            console.log(chalk.cyan(`    + Applied built-in customization: ${file}`));
        }
        const profile = require('./profile').getProfile(projectRoot) ?? 'standard';
        await applyPersonaPhasePrefix(customizeSource, configTargetDir, profile);
    }

    // STAGE:WORKFLOWS — Apply workflows (AFTER recompile so they persist)
    if (fs.existsSync(workflowSourceDir)) {
        await fs.ensureDir(workflowTargetDir);
        await fs.copy(workflowSourceDir, workflowTargetDir);
        console.log(chalk.cyan(`    + Applied BMAD workflows`));
    }

    // 5. Apply MIL-STD-498 templates (AFTER recompile so they persist)
    if (fs.existsSync(templateSourceDir)) {
        await fs.ensureDir(templateTargetDir);
        await fs.copy(templateSourceDir, templateTargetDir);
        console.log(chalk.cyan(`    + Applied MIL-STD-498 templates`));
    }

    // 6. Copy agent templates to compiled location (AFTER recompile)
    // BMAD recompile doesn't generate custom agents (mil498, cyber) in _bmad/bmm/agents/.
    // Without this, updateAgentInstructions() creates the file with only the MA-AGENTS block.
    if (fs.existsSync(sourceDir)) {
        const compiledAgentDir = path.join(projectRoot, BMAD_DIR, 'bmm', 'agents');
        await fs.ensureDir(compiledAgentDir);
        const files = await fs.readdir(sourceDir);
        for (const file of files) {
            if (file.endsWith('.md')) {
                const matchingAgentId = Object.entries(agentMdMap).find(([, mdFile]) => mdFile === file)?.[0];
                if (!matchingAgentId || selectedAgentIds.length === 0 || selectedAgentIds.includes(matchingAgentId)) {
                    await fs.copy(path.join(sourceDir, file), path.join(compiledAgentDir, file));
                    console.log(chalk.cyan(`    + Applied compiled agent: ${file}`));
                }
            }
        }
    }

    // 7. Register custom workflows in BMAD CSV registries (after recompile)
    if (selectedAgentIds.length === 0 || selectedAgentIds.includes('bmm-mil498')) {
        await registerMilWorkflows(projectRoot);
    }

    // 8. Register ML workflows
    if (selectedAgentIds.length === 0 || selectedAgentIds.includes('bmm-demerzel')) {
        await registerMlWorkflows(projectRoot);
    }
}

/**
 * Append MIL-STD-498 workflow entries to the BMAD CSV registries
 * so they appear as available slash commands.
 */
async function registerMilWorkflows(projectRoot) {
    const milEntries = [
        {
            name: 'Generate SRS', code: 'GS',
            file: '_bmad/bmm/workflows/mil498/srs/workflow.yaml',
            command: 'bmad-mil-generate-srs',
            description: 'Generate a MIL-STD-498 Software Requirements Specification from BMAD project artifacts'
        },
        {
            name: 'Generate SDD', code: 'GD',
            file: '_bmad/bmm/workflows/mil498/sdd/workflow.yaml',
            command: 'bmad-mil-generate-sdd',
            description: 'Generate a MIL-STD-498 Software Design Description from architecture and design docs'
        },
        {
            name: 'Generate SDP', code: 'GP',
            file: '_bmad/bmm/workflows/mil498/sdp/workflow.yaml',
            command: 'bmad-mil-generate-sdp',
            description: 'Generate a MIL-STD-498 Software Development Plan from project planning artifacts'
        },
        {
            name: 'Generate OCD', code: 'GO',
            file: '_bmad/bmm/workflows/mil498/ocd/workflow.yaml',
            command: 'bmad-mil-generate-ocd',
            description: 'Generate a MIL-STD-498 Operational Concept Description from PRD and architecture'
        },
        {
            name: 'Generate SSS', code: 'SS',
            file: '_bmad/bmm/workflows/mil498/sss/workflow.yaml',
            command: 'bmad-mil-generate-sss',
            description: 'Generate a MIL-STD-498 System/Subsystem Specification from project requirements'
        },
        {
            name: 'Generate STD', code: 'GT',
            file: '_bmad/bmm/workflows/mil498/std/workflow.yaml',
            command: 'bmad-mil-generate-std',
            description: 'Generate a MIL-STD-498 Software Test Description from epics stories and architecture'
        },
        {
            name: 'Generate SSDD', code: 'SD',
            file: '_bmad/bmm/workflows/mil498/ssdd/workflow.yaml',
            command: 'bmad-mil-generate-ssdd',
            description: 'Generate a MIL-STD-498 System/Subsystem Design Description from architecture and PRD'
        }
    ];

    // Append or update entries in module-help.csv
    const moduleHelpPath = path.join(projectRoot, BMAD_DIR, 'bmm', 'module-help.csv');
    if (fs.existsSync(moduleHelpPath)) {
        let content = await fs.readFile(moduleHelpPath, 'utf-8');
        for (const entry of milEntries) {
            const row = `bmm,anytime,${entry.name},${entry.code},,${entry.file},${entry.command},false,mil498,Create Mode,${entry.description},planning_artifacts,document,`;
            // Remove any existing line for this command, then append the current one
            const lines = content.split('\n').filter(line => !line.includes(entry.command));
            content = lines.join('\n').trimEnd() + '\n' + row + '\n';
        }
        await fs.writeFile(moduleHelpPath, content, 'utf-8');
        console.log(chalk.cyan(`    + Registered MIL-STD-498 workflows in module-help.csv`));
    }

    // Append or update entries in bmad-help.csv
    const bmadHelpPath = path.join(projectRoot, BMAD_DIR, '_config', 'bmad-help.csv');
    if (fs.existsSync(bmadHelpPath)) {
        let content = await fs.readFile(bmadHelpPath, 'utf-8');
        for (const entry of milEntries) {
            const row = `bmm,anytime,${entry.name},${entry.code},,${entry.file},${entry.command},false,mil498,bmad:MIL-STD-498 compliance:agent:mil498,Joseph,📜 MIL-STD-498 Expert,Create Mode,${entry.description},planning_artifacts,document`;
            // Remove any existing line for this command, then append the current one
            const lines = content.split('\n').filter(line => !line.includes(entry.command));
            content = lines.join('\n').trimEnd() + '\n' + row + '\n';
        }
        await fs.writeFile(bmadHelpPath, content, 'utf-8');
        console.log(chalk.cyan(`    + Registered MIL-STD-498 workflows in bmad-help.csv`));
    }
}

/**
 * Append ML lifecycle workflow entries to the BMAD CSV registries
 * so they appear as available slash commands for Demerzel.
 */
async function registerMlWorkflows(projectRoot) {
    const mlEntries = [
        { name: 'ML Ideation & PRD', code: 'MLI', command: 'ml-ideation', description: 'Frame ML research problem, define requirements, and produce Research Thesis and PRD' },
        { name: 'ML EDA & Research', code: 'MLE', command: 'ml-eda', description: 'Perform exploratory data analysis, establish baselines, and produce EDA report' },
        { name: 'ML Architecture Design', code: 'MLA', command: 'ml-architecture', description: 'Design model architecture, stack, and experiment tracking strategy' },
        { name: 'ML Detailed Design', code: 'MLD', command: 'ml-detailed-design', description: 'Break down infrastructure and experiment tasks from architecture' },
        { name: 'ML TechSpec (Contract)', code: 'MLS', command: 'ml-techspec', description: 'Lock experiment parameters and performance tiers before training' },
        { name: 'ML Infra & Sync', code: 'MLNF', command: 'ml-infra', description: 'Build ML infrastructure, manage dependencies, and run smoke tests' },
        { name: 'ML Experiment', code: 'MLX', command: 'ml-experiment', description: 'Execute training experiments against locked TechSpec and log metrics' },
        { name: 'ML Results Analysis', code: 'MLAN', command: 'ml-analysis', description: 'Evaluate experiment outcomes against TechSpec success tiers' },
        { name: 'ML HPO (Tuning)', code: 'MLH', command: 'ml-hparam', description: 'Perform automated hyperparameter optimization' },
        { name: 'ML Iterative Revision', code: 'MLR', command: 'ml-revision', description: 'Amend hypothesis and requirements based on experiment findings' },
        { name: 'ML Advise & Search', code: 'MLAD', command: 'ml-advise', description: 'Search past experiments and surface findings or failure warnings' },
        { name: 'ML Retrospective', code: 'MLRT', command: 'ml-retrospective', description: 'Capture session learnings and update project context' }
    ];

    // Append or update entries in module-help.csv
    const moduleHelpPath = path.join(projectRoot, BMAD_DIR, 'bmm', 'module-help.csv');
    if (fs.existsSync(moduleHelpPath)) {
        let content = await fs.readFile(moduleHelpPath, 'utf-8');
        for (const entry of mlEntries) {
            const row = `bmm,anytime,${entry.name},${entry.code},,skills/${entry.command}/SKILL.md,${entry.command},false,bmm-demerzel,Create Mode,${entry.description},planning_artifacts,document,`;
            // Remove any existing line for this command, then append the current one
            const lines = content.split('\n').filter(line => !line.includes(entry.command));
            content = lines.join('\n').trimEnd() + '\n' + row + '\n';
        }
        await fs.writeFile(moduleHelpPath, content, 'utf-8');
        console.log(chalk.cyan(`    + Registered ML workflows in module-help.csv`));
    }

    // Append or update entries in bmad-help.csv
    const bmadHelpPath = path.join(projectRoot, BMAD_DIR, '_config', 'bmad-help.csv');
    if (fs.existsSync(bmadHelpPath)) {
        let content = await fs.readFile(bmadHelpPath, 'utf-8');
        for (const entry of mlEntries) {
            const row = `bmm,anytime,${entry.name},${entry.code},,skills/${entry.command}/SKILL.md,${entry.command},false,bmm-demerzel,bmad:Machine Learning Lifecycle:agent:demerzel,Demerzel,🧪 ML Scientist,Create Mode,${entry.description},planning_artifacts,document`;
            // Remove any existing line for this command, then append the current one
            const lines = content.split('\n').filter(line => !line.includes(entry.command));
            content = lines.join('\n').trimEnd() + '\n' + row + '\n';
        }
        await fs.writeFile(bmadHelpPath, content, 'utf-8');
        console.log(chalk.cyan(`    + Registered ML workflows in bmad-help.csv`));
    }
}

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
    applyCustomizations,
    prePopulateBmadCache,
    deployMethodology,
    // Migration functions (exported for testing)
    detectMigrationNeed,
    compareVersions,
    backupCustomizations,
    restoreCustomizations,
    mergeUserCustomizations,
    cleanupLegacyArtifacts,
    parseCustomizeYaml,
    registerMlWorkflows,
    // Story 21.7 — phase-aware persona prefix (exported for testing)
    applyPersonaPhasePrefix,
    // Offline-safe recompile helpers (exported for testing — see bug
    // bug-bmad-recompile-fails-on-airgapped-network)
    isOfflineModeDeclared,
    looksLikeOfflineFailure,
    looksLikeEbusyFailure,
    inspectBmadCache,
    classifyRecompileFailure,
};
