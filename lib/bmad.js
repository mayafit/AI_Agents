const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

const BMAD_DIR = '_bmad';
const CONFIG_DIR = path.join(BMAD_DIR, '_config', 'agents');

function isBmadInstalled(projectRoot = process.cwd()) {
    return fs.existsSync(path.join(projectRoot, BMAD_DIR));
}

async function installBmad(modules = ['bmm', 'bmb'], tools = [], projectRoot = process.cwd()) {
    let command = 'npx bmad-method install --yes';

    if (modules && modules.length > 0) {
        command += ` --modules ${modules.join(',')}`;
    }

    if (tools && tools.length > 0) {
        command += ` --tools ${tools.join(',')}`;
    } else {
        command += ' --tools none';
    }

    console.log(chalk.gray(`  Running: ${command}`));
    try {
        execSync(command, { stdio: 'inherit', cwd: projectRoot });
        return true;
    } catch (error) {
        console.error(chalk.red(`  BMAD installation failed: ${error.message}`));
        return false;
    }
}

async function updateBmad(modules = ['bmm', 'bmb'], tools = [], projectRoot = process.cwd()) {
    let command = 'npx bmad-method install --action update --yes';

    if (modules && modules.length > 0) {
        command += ` --modules ${modules.join(',')}`;
    }

    if (tools && tools.length > 0) {
        command += ` --tools ${tools.join(',')}`;
    } else {
        command += ' --tools none';
    }

    console.log(chalk.gray(`  Running: ${command}`));
    try {
        execSync(command, { stdio: 'inherit', cwd: projectRoot });
        return true;
    } catch (error) {
        console.error(chalk.red(`  BMAD update failed: ${error.message}`));
        return false;
    }
}

async function applyCustomizations(projectRoot = process.cwd(), modules = ['bmm', 'bmb'], tools = [], selectedAgentIds = []) {
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

    // Recompile agents to apply YAML customizations
    // IMPORTANT: Steps 3-5 must run AFTER recompile because the recompile regenerates
    // the _bmad/bmm/ tree and would wipe any files placed there beforehand.
    let command = 'npx bmad-method install --yes';
    if (modules && modules.length > 0) {
        command += ` --modules ${modules.join(',')}`;
    }
    if (tools && tools.length > 0) {
        command += ` --tools ${tools.join(',')}`;
    } else {
        command += ' --tools none';
    }
    console.log(chalk.gray(`  Running: ${command}`));
    try {
        execSync(command, { stdio: 'inherit', cwd: projectRoot });
    } catch (error) {
        console.error(chalk.red(`  BMAD recompile failed: ${error.message}`));
    }

    // 3. Apply workflows (AFTER recompile so they persist)
    if (fs.existsSync(workflowSourceDir)) {
        await fs.ensureDir(workflowTargetDir);
        await fs.copy(workflowSourceDir, workflowTargetDir);
        console.log(chalk.cyan(`    + Applied BMAD workflows`));
    }

    // 4. Apply MIL-STD-498 templates (AFTER recompile so they persist)
    if (fs.existsSync(templateSourceDir)) {
        await fs.ensureDir(templateTargetDir);
        await fs.copy(templateSourceDir, templateTargetDir);
        console.log(chalk.cyan(`    + Applied MIL-STD-498 templates`));
    }

    // 5. Copy agent templates to compiled location (AFTER recompile)
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

    // 6. Register custom workflows in BMAD CSV registries (after recompile)
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

module.exports = {
    isBmadInstalled,
    installBmad,
    updateBmad,
    applyCustomizations
};
