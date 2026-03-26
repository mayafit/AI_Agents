const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const chalk = require('chalk');

const BMAD_DIR = '_bmad';
const CONFIG_DIR = path.join(BMAD_DIR, '_config', 'agents');

function getBmadCommand(args) {
    try {
        const wrapperPath = require.resolve('bmad-method/tools/bmad-npx-wrapper.js');
        return `node "${wrapperPath}" ${args}`;
    } catch (err) {
        const wrapped = new Error('bmad-method not found in node_modules — run "npm install" first');
        wrapped.cause = err;
        throw wrapped;
    }
}

function isBmadInstalled(projectRoot = process.cwd()) {
    return fs.existsSync(path.join(projectRoot, BMAD_DIR));
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

    // Extension module — only if directory exists
    const extensionPath = path.join(__dirname, 'bmad-extension');
    if (fs.existsSync(extensionPath)) {
        parts.push('--custom-content', `"${extensionPath}"`);
    }

    if (ctx.action === 'update') {
        parts.push('--action', 'update');
    }

    return getBmadCommand(parts.join(' '));
}

async function installBmad(modules = ['bmm', 'bmb'], tools = [], projectRoot = process.cwd(), force = false, { userName = '', commLang = '', docLang = '', outputFolder = '' } = {}) {
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
        execSync(command, { stdio: 'inherit', cwd: projectRoot, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
        await deployMethodology(projectRoot, force);
        return true;
    } catch (error) {
        console.error(chalk.red(`  BMAD installation failed: ${error.message}`));
        return false;
    }
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

    console.log(chalk.gray(`  Running: ${command}`));
    try {
        execSync(command, { stdio: 'inherit', cwd: projectRoot, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
        await deployMethodology(projectRoot, force);
        return true;
    } catch (error) {
        console.error(chalk.red(`  BMAD update failed: ${error.message}`));
        return false;
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
        'bmm-mil498': 'mil498.md'
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
        execSync(command, { stdio: 'inherit', cwd: projectRoot, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
    } catch (error) {
        console.error(chalk.red(`  BMAD recompile failed: ${error.message}`));
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

            if (await fs.pathExists(dst)) {
                if (force) {
                    await fs.remove(dst);
                    await fs.copy(src, dst);
                    restoreGitDir(dst);
                    console.log(chalk.cyan(`    + Replaced cached module: ${mod}`));
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
    installBmad,
    updateBmad,
    applyCustomizations,
    prePopulateBmadCache,
    deployMethodology,
};
