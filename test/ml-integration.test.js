const assert = require('assert').strict;
const fs = require('fs-extra');
const path = require('path');
const { checkUvInstalled, scaffoldMlProject } = require('../lib/installer');
const { registerMlWorkflows } = require('../lib/bmad');

const TEST_DIR = path.join(__dirname, 'tmp-ml-test');

async function testUvValidation() {
    console.log('Testing uv validation...');
    const installed = checkUvInstalled();
    console.log(`  uv installed: ${installed}`);
    // We can't strictly assert true/false because it depends on the environment,
    // but we can assert it returns a boolean.
    assert.strictEqual(typeof installed, 'boolean');
}

async function testScaffolding() {
    console.log('Testing ML scaffolding...');
    if (fs.existsSync(TEST_DIR)) await fs.remove(TEST_DIR);
    await fs.ensureDir(TEST_DIR);

    await scaffoldMlProject(TEST_DIR, 'test_ml_project', 'wandb');

    const expectedDirs = [
        'data/raw', 'data/processed', 'data/splits',
        'src/test_ml_project',
        'tests', 'scripts', 'logs', 'notebooks', 'configs',
        '_bmad-output/planning-artifacts',
        '_bmad-output/implementation-artifacts'
    ];

    for (const dir of expectedDirs) {
        assert.ok(fs.existsSync(path.join(TEST_DIR, dir)), `Missing dir: ${dir}`);
    }

    const configPath = path.join(TEST_DIR, 'configs/ml_config.yaml');
    assert.ok(fs.existsSync(configPath), 'Missing ml_config.yaml');
    const config = await fs.readFile(configPath, 'utf-8');
    assert.ok(config.includes('test_ml_project'), 'Config missing project name');
    assert.ok(config.includes('wandb'), 'Config missing tracking tool');

    await fs.remove(TEST_DIR);
}

async function testWorkflowRegistration() {
    console.log('Testing ML workflow registration...');
    if (fs.existsSync(TEST_DIR)) await fs.remove(TEST_DIR);
    await fs.ensureDir(path.join(TEST_DIR, '_bmad', 'bmm'));
    await fs.ensureDir(path.join(TEST_DIR, '_bmad', '_config'));

    const moduleHelpPath = path.join(TEST_DIR, '_bmad', 'bmm', 'module-help.csv');
    const bmadHelpPath = path.join(TEST_DIR, '_bmad', '_config', 'bmad-help.csv');

    await fs.writeFile(moduleHelpPath, 'module,trigger,name,code,icon,file,command,is_async,category,mode,description,input,output,tags\n');
    await fs.writeFile(bmadHelpPath, 'module,trigger,name,code,icon,file,command,is_async,category,agent_id,advisor,title,mode,description,input,output\n');

    await registerMlWorkflows(TEST_DIR);

    const moduleHelp = await fs.readFile(moduleHelpPath, 'utf-8');
    const bmadHelp = await fs.readFile(bmadHelpPath, 'utf-8');

    assert.ok(moduleHelp.includes('/ml-ideation'), 'Missing ml-ideation in module-help');
    assert.ok(bmadHelp.includes('/ml-analysis'), 'Missing ml-analysis in bmad-help');
    assert.ok(bmadHelp.includes('Isaac'), 'Missing Isaac persona in bmad-help');

    await fs.remove(TEST_DIR);
}

async function runTests() {
    try {
        await testUvValidation();
        await testScaffolding();
        await testWorkflowRegistration();
        console.log('\n✅ All ML integration tests passed!');
    } catch (err) {
        console.error('\n❌ ML integration tests failed:');
        console.error(err);
        process.exit(1);
    }
}

runTests();
