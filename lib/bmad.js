const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

const BMAD_DIR = '_bmad';
const CONFIG_DIR = path.join(BMAD_DIR, '_config', 'agents');

function isBmadInstalled(projectRoot = process.cwd()) {
    return fs.existsSync(path.join(projectRoot, BMAD_DIR));
}

async function installBmad(agentIds, projectRoot = process.cwd()) {
    let command = 'npx bmad-method install --yes';

    if (agentIds && agentIds.length > 0) {
        command += ` --tools ${agentIds.join(',')}`;
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

async function updateBmad(agentIds, projectRoot = process.cwd()) {
    let command = 'npx bmad-method install --action update --yes';

    if (agentIds && agentIds.length > 0) {
        command += ` --tools ${agentIds.join(',')}`;
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

async function applyCustomizations(projectRoot = process.cwd()) {
    const sourceDir = path.join(__dirname, 'bmad-customizations');
    const workflowSourceDir = path.join(__dirname, 'bmad-workflows');
    const configTargetDir = path.join(projectRoot, CONFIG_DIR);
    const agentTargetDir = path.join(projectRoot, BMAD_DIR, 'bmm', 'agents');
    const workflowTargetDir = path.join(projectRoot, BMAD_DIR, 'bmm', 'workflows');

    // 1. Apply YAML customizations
    if (fs.existsSync(sourceDir)) {
        await fs.ensureDir(configTargetDir);
        const files = await fs.readdir(sourceDir);
        for (const file of files) {
            if (file.endsWith('.customize.yaml')) {
                await fs.copy(path.join(sourceDir, file), path.join(configTargetDir, file));
                console.log(chalk.cyan(`    + Applied customization: ${file}`));
            }
        }
    }

    // 2. Apply detailed agent templates (.md files)
    if (fs.existsSync(sourceDir)) {
        await fs.ensureDir(agentTargetDir);
        const files = await fs.readdir(sourceDir);
        for (const file of files) {
            if (file.endsWith('.md')) {
                await fs.copy(path.join(sourceDir, file), path.join(agentTargetDir, file));
                console.log(chalk.cyan(`    + Applied agent template: ${file}`));
            }
        }
    }

    // 3. Apply workflows
    if (fs.existsSync(workflowSourceDir)) {
        await fs.ensureDir(workflowTargetDir);
        await fs.copy(workflowSourceDir, workflowTargetDir);
        console.log(chalk.cyan(`    + Applied BMAD workflows`));
    }

    // Recompile agents to apply changes
    const command = 'npx bmad-method install --action compile-agents --yes';
    console.log(chalk.gray(`  Running: ${command}`));
    try {
        execSync(command, { stdio: 'inherit', cwd: projectRoot });
    } catch (error) {
        console.error(chalk.red(`  BMAD recompile failed: ${error.message}`));
    }
}

module.exports = {
    isBmadInstalled,
    installBmad,
    updateBmad,
    applyCustomizations
};
