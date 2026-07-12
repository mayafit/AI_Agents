/**
 * Story 30.5 SPIKE PoC — prove enumerate-then-stage-locally under --yes with
 * ZERO bmad-method core modifications.
 *
 * Requires bmad-method's CustomModuleManager via its (un-exported, deep) path to
 * demonstrate BOTH (a) that the surface is reachable at all — NFR17 — and
 * (b) that ambient-credential enumeration of a LOCAL marketplace works fully
 * offline and non-interactively.
 *
 * Run: node spike/30-5-enumerate-poc.js
 * (Reads bmad-method from the main worktree's node_modules by absolute path,
 *  since the story worktree has no node_modules of its own.)
 */
'use strict';

const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

// --- Locate the installed bmad-method deep module (pinned-internal surface) ---
const BMAD_ROOT = 'D:/Code/AI_Agents/node_modules/bmad-method';
const CMM_PATH = path.join(BMAD_ROOT, 'tools/installer/modules/custom-module-manager.js');

function line(label, val) {
    console.log(`  ${label.padEnd(26)} ${val}`);
}

async function main() {
    console.log('\n=== 30.5 SPIKE: enumerate-then-stage-locally PoC ===\n');

    // 1) Reachability of the pinned-internal surface (deep require; no exports map)
    console.log('[1] Deep-require CustomModuleManager (NFR17 reachability):');
    line('deep path exists:', fs.existsSync(CMM_PATH));
    const { CustomModuleManager } = require(CMM_PATH);
    const mgr = new CustomModuleManager();
    line('constructed:', !!mgr);
    for (const m of ['parseSource', 'resolveSource', 'discoverModules', 'resolvePlugin']) {
        line(`method ${m}:`, typeof mgr[m]);
    }

    // 2) Build a LOCAL marketplace fixture (no network) with 3 plugins.
    //    NOTE: parseSource() only treats /, ./, ../, ~ as local paths; a bare
    //    Windows C:\ absolute is REJECTED. We therefore reference the fixture
    //    with a ./-relative path (cwd = worktree root), exactly as ma-agents'
    //    stagePlugin() already does (lib/bmad.js — Story 22.6 workaround).
    const fixtureRel = './spike/_tmp/marketplace';
    const fixture = path.resolve(process.cwd(), fixtureRel);
    fs.rmSync(path.resolve(process.cwd(), './spike/_tmp'), { recursive: true, force: true });
    fs.mkdirSync(path.join(fixture, '.claude-plugin'), { recursive: true });
    const marketplace = {
        name: 'intra-perimeter-marketplace',
        owner: 'ma-agents-spike',
        plugins: [
            { name: 'alpha-mod', description: 'Alpha', source: './alpha', skills: [] },
            { name: 'beta-mod', description: 'Beta', source: './beta', skills: [] },
            { name: 'gamma-mod', description: 'Gamma', source: './gamma', skills: [] },
        ],
    };
    fs.writeFileSync(
        path.join(fixture, '.claude-plugin', 'marketplace.json'),
        JSON.stringify(marketplace, null, 2),
    );
    console.log('\n[2] Local marketplace fixture written at:', fixture);

    // 3) LOCAL-PATH ambient-cred enumeration (offline, non-interactive)
    console.log('\n[3] LOCAL-PATH enumeration via resolveSource + discoverModules:');
    line('bare-abs rejected:', mgr.parseSource(fixture).isValid === false ? 'yes (C:\\ not local)' : 'no');
    line('./-relative used:', fixtureRel);
    const local = await mgr.resolveSource(fixtureRel, { skipInstall: true, silent: true });
    line('parsed.type:', local.parsed.type);
    line('mode:', local.mode);
    line('marketplace read:', !!local.marketplace);
    const localPlugins = await mgr.discoverModules(local.marketplace, local.sourceUrl);
    line('discovered codes:', localPlugins.map((p) => p.code).join(', '));
    const localOk = local.parsed.type === 'local' && local.mode === 'discovery' && localPlugins.length === 3;
    line('LOCAL ENUM RESULT:', localOk ? 'WORKS' : 'FAILS');

    // 4) SUBSET-then-stage: ma-agents picks a subset, prunes marketplace.json,
    //    stages locally. This is the durable subset mechanism.
    console.log('\n[4] Subset (ma-agents own pick) + prune + stage-locally:');
    const chosen = new Set(['alpha-mod', 'gamma-mod']); // ma-agents multiselect result
    const stageRel = './spike/_tmp/stage';
    const stage = path.resolve(process.cwd(), stageRel);
    fs.rmSync(stage, { recursive: true, force: true });
    fs.mkdirSync(path.join(stage, '.claude-plugin'), { recursive: true });
    const pruned = {
        ...marketplace,
        plugins: marketplace.plugins.filter((p) => chosen.has(p.name)),
    };
    fs.writeFileSync(
        path.join(stage, '.claude-plugin', 'marketplace.json'),
        JSON.stringify(pruned, null, 2),
    );
    const staged = await mgr.resolveSource(stageRel, { skipInstall: true, silent: true });
    const stagedPlugins = await mgr.discoverModules(staged.marketplace, staged.sourceUrl);
    line('staged codes:', stagedPlugins.map((p) => p.code).join(', '));
    // bmad-method's _resolveCustomSourcesCli auto-selects ALL discovered => exactly the subset.
    const subsetOk = stagedPlugins.length === 2 && stagedPlugins.every((p) => chosen.has(p.code));
    line('SUBSET-VIA-PRUNE RESULT:', subsetOk ? 'WORKS' : 'FAILS');

    // 5) GIT-URL descriptor + ambient-cred posture (parse only; no live clone here)
    console.log('\n[5] GIT-URL parseSource (descriptor + ambient-cred posture):');
    const gitUrl = 'https://git.intra.example/team/bmad-marketplace.git@v1.2.0';
    const g = mgr.parseSource(gitUrl);
    line('type:', g.type);
    line('isValid:', g.isValid);
    line('cloneUrl:', g.cloneUrl);
    line('version:', g.version);
    line('cacheKey:', g.cacheKey);
    const ssh = mgr.parseSource('git@git.intra.example:team/bmad-marketplace.git');
    line('ssh type/valid:', `${ssh.type}/${ssh.isValid}`);
    line('NOTE:', 'clone uses env GIT_TERMINAL_PROMPT=0 + process.env (ambient creds, never prompts)');

    console.log('\n=== VERDICT ===');
    line('local enum:', localOk ? 'WORKS' : 'FAILS');
    line('subset-via-prune:', subsetOk ? 'WORKS' : 'FAILS');
    line('git-url parse:', g.isValid && g.type === 'url' ? 'WORKS' : 'FAILS');
    console.log('');

    // Clean up throwaway fixtures so nothing transient gets committed.
    fs.rmSync(path.resolve(process.cwd(), './spike/_tmp'), { recursive: true, force: true });
}

main().catch((e) => {
    console.error('PoC ERROR:', e);
    process.exit(1);
});
