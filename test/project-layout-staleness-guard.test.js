#!/usr/bin/env node
/**
 * Story 31.4 — the staleness fail-loud guard: skills refuse to run against a
 * stale generated `_bmad/bmm/config.yaml`.
 *
 * WHAT THIS SUITE IS FOR. Story 31.3 made `config.yaml` a GENERATED file, derived
 * from the committed binding in `_bmad-output/project-layout.yaml` and carrying a
 * content-based `project_layout_stamp:` naming the binding state it came from.
 * Nothing yet stopped a skill from running against that file AFTER a `git pull`
 * relocated a knowledge store. Story 31.4 adds a preflight — an instruction block
 * embedded in every affected skill (the Story 17.22 convention:
 * `mcp-detection-pattern-spec.md` §7.1, skills are markdown instruction documents
 * and the pattern is embedded per skill, never a shared importable module).
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * WHAT THIS SUITE CAN AND CANNOT ESTABLISH — READ THIS BEFORE TRUSTING IT
 * ═════════════════════════════════════════════════════════════════════════════
 * The guard is TEXT A MODEL IS ASKED TO OBEY. There is no function to call, so no
 * test here — none — proves that an agent reading a skill actually halts. Saying
 * otherwise would be exactly the failure this epic keeps producing: a test that
 * proves presence and is read as proving behaviour.
 *
 * So the suite splits, explicitly, into two kinds of claim:
 *
 *   (A) BEHAVIOUR OF THE DECISION PROCEDURE. `runGuard()` below is an executable
 *       transcription of the block's steps P1–P5, written ONLY against the
 *       functions `bin/cli.js` exports for this purpose
 *       (`resolveProjectTopology`, `readProjectLayoutStamp`,
 *       `computeProjectLayoutStamp`) and run against REAL on-disk fixture
 *       projects. These tests prove the DECISION the block prescribes is the
 *       right one, is reachable through the published contract, and writes
 *       nothing. They do not prove a model executes it.
 *
 *   (B) PRESENCE, PLACEMENT AND PARITY OF THE TEXT. These prove the block exists,
 *       is byte-identical in every copy and through both deployment pipelines,
 *       sits in the §2.6 gateway position, and — the part that makes (A) worth
 *       anything — that the block's branches and `runGuard()`'s verdicts are in
 *       EXACT correspondence, neither able to gain or lose a branch without the
 *       other. Without that correspondence test, (A) would be testing a program
 *       nobody ships.
 *
 * Every test name below is prefixed `[behaviour]` or `[text]` so a reader can
 * never mistake one claim for the other.
 *
 * THE TEST COUNT IS PINNED IN BOTH DIRECTIONS (EXPECTED_TEST_COUNT), for the
 * reason recorded in the sibling project-layout suites: this epic has already
 * shipped one suite that exited 0 having reported nothing.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// A `!==` check — a SURPLUS fails as loudly as a shortfall.
const EXPECTED_TEST_COUNT = 43;

let passed = 0;
let failed = 0;
const errors = [];

// Armed BEFORE the first test, so it catches the process dying before the
// summary block rather than after everything it protects has already happened.
let summaryPrinted = false;
process.on('exit', (code) => {
  if (summaryPrinted) return;
  console.error(
    `\n  FATAL: this suite exited with code ${code} WITHOUT printing its summary, so its ` +
    `${passed + failed} completed test(s) were never reported. Forcing a non-zero exit so ` +
    `this cannot read as a pass.`
  );
  process.exitCode = code === 0 ? 1 : code;
});

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

// ─── Modules under test ──────────────────────────────────────────────────────
let cli;
try {
  cli = require('../bin/cli.js');
} catch (e) {
  console.error('\n  FATAL: cannot load bin/cli.js');
  console.error(' ', e.stack || e.message);
  process.exit(1);
}

let yamlOracle = null;
try { yamlOracle = require('js-yaml'); } catch (e) { yamlOracle = null; }
if (!yamlOracle) {
  console.error('\n  FATAL: js-yaml (a declared direct dependency) could not be loaded; the ' +
    'YAML oracle assertions in this suite cannot run, and degrading to "skip the oracle" ' +
    'would leave them reporting a pass while asserting materially less.');
  process.exit(1);
}

const PROJECT_ROOT = path.join(__dirname, '..');
const CONFIG_REL = path.join('_bmad', 'bmm', 'config.yaml');
const LAYOUT_REL = path.join('_bmad-output', 'project-layout.yaml');

// ═════════════════════════════════════════════════════════════════════════════
// (A) THE DECISION PROCEDURE, EXECUTABLE
//
// A transcription of the embedded block's steps P1–P5. It reads; it never
// writes. Every fact it uses comes from a function bin/cli.js exports — the
// stamp FORMAT is never parsed here, per the contract note at bin/cli.js:712
// ("Comparison is on the opaque string; 31.4 must not parse it").
// ═════════════════════════════════════════════════════════════════════════════

// The block's nine terminal branches. Named constants, not string literals at
// the call sites, so a renamed branch is a compile-time-ish break rather than a
// silently-never-matched assertion.
const V = Object.freeze({
  HALT_BINDING_UNREADABLE: 'halt:binding-unreadable',   // P1, binding present but unusable
  HALT_UNCONFIGURED: 'halt:unconfigured',               // P2, no binding AND no config
  HALT_BINDING_MISSING: 'halt:binding-missing',         // P2, no binding but an F26 config
  PROCEED_PRE_F26: 'proceed:pre-f26',                   // P2, genuinely pre-F26 (AC5/NFR82)
  HALT_CONFIG_MISSING: 'halt:config-missing',           // P3, binding but no config
  HALT_STAMP_ABSENT: 'halt:stamp-absent',               // P3, binding but unstamped config
  HALT_STAMP_MALFORMED: 'halt:stamp-malformed',         // P3, claim present and unreadable
  HALT_DRIFT: 'halt:drift',                             // P4, the binding moved
  PROCEED_MATCHED: 'proceed:matched',                   // P5, everything agrees
});

// The three fields ONLY an F26 generation writes. This is the discriminator
// AC5 leans on: a genuine pre-F26 config.yaml carries none of them, so an
// absent stamp is corroborated rather than believed on its own.
const F26_MARKER_FIELDS = Object.freeze([
  'project_layout_stamp',
  'system_requirements_path',
  'software_requirements_path',
]);

function readConfigField(content, field) {
  const m = content.match(new RegExp(`^${field}:(.*)$`, 'm'));
  if (!m) return null;
  let v = m[1].replace(/\r$/, '').trim();
  if (/^"[^]*"$/.test(v) || /^'[^]*'$/.test(v)) v = v.slice(1, -1);
  return v;
}

// What `generateBmmConfig` writes for a store's path: its portable path, or `.`
// when the store has no filesystem path at all (a confluence store).
function expectedStorePath(store, projectRoot) {
  if (!store) return '.';
  if (store.backend && store.backend !== 'file-system') return '.';
  const raw = store.path != null ? store.path : '.';
  return cli.toPortablePath(raw, projectRoot).portable;
}

/**
 * Step P4's derivation table, executed. Returns one entry per store whose
 * generated field disagrees with the committed binding — which is what AC1's
 * "names the drift (which store moved, from where to where)" is made of.
 */
function namedMoves(topology, configContent, projectRoot) {
  const moved = [];
  const check = (label, field, expected) => {
    const actual = readConfigField(configContent, field);
    if (actual !== expected) moved.push({ store: label, field, from: actual, to: expected });
  };

  const software = expectedStorePath(topology.softwareRequirementsStore, projectRoot);
  const system = expectedStorePath(topology.systemRequirementsStore, projectRoot);
  check('software requirements store', 'software_requirements_path', software);
  check('software requirements store (legacy field)', 'knowledgebase_path', software);
  check('system requirements store', 'system_requirements_path', system);

  const sprint = topology.sprintManagement || { mode: 'same', path: '.' };
  if (sprint.mode === 'jira') {
    check('sprint management', 'sprint_backend', 'jira');
    check('sprint management', 'jira_url', sprint.jiraUrl);
    check('sprint management', 'jira_project_key', sprint.jiraProjectKey);
  } else {
    const sp = expectedStorePath(sprint, projectRoot);
    check('sprint management', 'sprint_backend', 'file-system');
    check('sprint management', 'sprint_management_path', sp);
    check('implementation artifacts', 'implementation_artifacts',
      sp === '.' ? '{project-root}/_bmad-output/implementation-artifacts' : sp);
  }
  check('planning artifacts', 'planning_artifacts',
    software === '.' ? '{project-root}/_bmad-output/planning-artifacts' : software);

  return moved;
}

/**
 * The guard, as the embedded block prescribes it.
 *
 * @param {string} projectRoot
 * @param {{stampVerifiable?: boolean}} opts  `stampVerifiable: false` models the
 *   block's degraded path — an agent with no shell, which can execute the
 *   derivation table but cannot recompute the stamp. It exists so the residual
 *   blind spot is PINNED by a test rather than left as an unstated assumption.
 */
function runGuard(projectRoot, opts) {
  const stampVerifiable = !opts || opts.stampVerifiable !== false;
  const configPath = path.join(projectRoot, CONFIG_REL);

  // ── Step P1. THE RESOLVER FIRST, THE STAMP SECOND (bin/cli.js:747). The
  // filesystem establishes `unbound`; the stamp only ever corroborates it.
  const binding = cli.resolveProjectTopology(projectRoot);
  if (!binding.ok && binding.reason !== cli.BINDING_UNBOUND) {
    // Default-deny: every reason that is not UNBOUND lands here, so a reason
    // added later refuses by construction rather than by remembering to.
    return { verdict: V.HALT_BINDING_UNREADABLE, message: binding.message, silent: false };
  }

  const configExists = fs.existsSync(configPath);
  const configContent = configExists ? fs.readFileSync(configPath, 'utf-8') : null;

  // ── Step P2. No committed binding.
  if (!binding.ok) {
    if (!configExists) {
      return {
        verdict: V.HALT_UNCONFIGURED, silent: false,
        message:
          'Neither _bmad-output/project-layout.yaml nor _bmad/bmm/config.yaml exists, so ' +
          'nothing states where this project\'s knowledge stores live. Run ' +
          '`npx ma-agents install` to configure the project, or `ma-agents bind` if ' +
          'ma-agents is already installed and only the binding is missing.',
      };
    }
    const markers = F26_MARKER_FIELDS.filter(
      (f) => new RegExp(`^${f}:`, 'm').test(configContent));
    if (markers.length > 0) {
      return {
        verdict: V.HALT_BINDING_MISSING, markers, silent: false,
        message:
          `_bmad/bmm/config.yaml carries ${markers.join(', ')}, which only an F26 generation ` +
          `writes — so this project HAS been bound — but _bmad-output/project-layout.yaml is ` +
          `not here. Restore it, or run \`ma-agents bind\` to write a fresh one.`,
      };
    }
    // AC5 / NFR82. The ONLY permissive branch in the whole procedure, and it is
    // reached only after the filesystem said `unbound` AND the config was shown
    // to carry none of the three fields an F26 generation writes.
    return { verdict: V.PROCEED_PRE_F26, silent: true };
  }

  // ── Step P3. The binding is readable — what was config.yaml generated from?
  if (!configExists) {
    return {
      verdict: V.HALT_CONFIG_MISSING, silent: false,
      message:
        '_bmad-output/project-layout.yaml commits this project\'s knowledge binding, but ' +
        '_bmad/bmm/config.yaml has never been generated from it. Run `npx ma-agents install`, ' +
        'or `ma-agents bind` if ma-agents is already installed.',
    };
  }

  const stamp = cli.readProjectLayoutStamp(configContent);
  if (!stamp.ok) {
    // Branch BY NAME, never by string literal (bin/cli.js:3789). `absent` and
    // `malformed` are different facts; only `absent` is even arguably benign,
    // and here — with a readable binding in hand — neither is.
    if (stamp.reason === cli.STAMP_ABSENT) {
      return { verdict: V.HALT_STAMP_ABSENT, message: stamp.message, silent: false };
    }
    // Default-deny, so a third stamp reason added later refuses rather than
    // falling through into the comparison.
    return {
      verdict: V.HALT_STAMP_MALFORMED, message: stamp.message, raw: stamp.raw, silent: false,
    };
  }

  // ── Step P4. Content comparison — never mtime.
  const moved = namedMoves(binding.topology, configContent, projectRoot);
  const stampDrift = stampVerifiable
    && stamp.value !== cli.computeProjectLayoutStamp(binding.topology, projectRoot);
  if (moved.length > 0 || stampDrift) {
    return {
      verdict: V.HALT_DRIFT, moved, stampDrift, silent: false,
      message:
        'The committed binding in _bmad-output/project-layout.yaml no longer matches the ' +
        'state _bmad/bmm/config.yaml was generated from:\n' +
        moved.map((m) => `  - ${m.store}: was ${JSON.stringify(m.from)}, is now ` +
          `${JSON.stringify(m.to)}`).join('\n') +
        '\nRun `ma-agents bind` to regenerate _bmad/bmm/config.yaml from the committed ' +
        'binding, then run this skill again.',
    };
  }

  // ── Step P5.
  return { verdict: V.PROCEED_MATCHED, silent: true };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function withTmpDir(fn) {
  const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-stale-')));
  const origCwd = process.cwd();
  process.chdir(tmpDir);
  try {
    return fn(tmpDir);
  } finally {
    process.chdir(origCwd);
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* Windows lock */ }
  }
}

// Swallow installer chatter so the suite's own report stays readable.
function quiet(fn) {
  const orig = console.log;
  let out = '';
  console.log = (...a) => { out += a.join(' ') + '\n'; };
  try { return { value: fn(), out }; } finally { console.log = orig; }
}

/** A bound, freshly-generated project: layout written, config generated from it. */
function boundProject(tmpDir, layout) {
  quiet(() => cli.writeProjectLayoutYaml(layout));
  quiet(() => cli.generateBmmConfig({ projectRoot: tmpDir }));
}

/** Rewrite the binding to a NEW layout — the `git pull` that moves a store. */
function rebind(tmpDir, layout) {
  fs.rmSync(path.join(tmpDir, LAYOUT_REL), { force: true });
  quiet(() => cli.writeProjectLayoutYaml(layout));
}

/** A byte-exact snapshot of every file under a root, for the AC2 no-write checks. */
function snapshot(root) {
  const out = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(root, p)] =
        crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    }
  };
  walk(root);
  return out;
}

const SAME = { knowledgebase: { mode: 'same', path: '.' }, sprintManagement: { mode: 'same', path: '.' } };

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1 — [behaviour] the decision procedure, against real fixtures
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 1. [behaviour] the decision procedure ===\n');

test('[behaviour] AC7 matched state: a freshly generated config proceeds, silently', () => {
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, SAME);
    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.PROCEED_MATCHED,
      `a project whose config was just generated from its binding must proceed, got ${r.verdict}`);
    assert.strictEqual(r.silent, true, 'a matched project gets NO message (AC7)');
  });
});

test('[behaviour] AC1 drifted state: a moved store halts and is named from → to', () => {
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, SAME);
    const moved = path.join(tmpDir, 'elsewhere');
    fs.mkdirSync(moved, { recursive: true });
    rebind(tmpDir, {
      knowledgebase: { mode: 'local', path: moved },
      sprintManagement: { mode: 'same', path: '.' },
    });

    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.HALT_DRIFT, `a relocated store must HALT, got ${r.verdict}`);
    assert.ok(r.moved.length > 0, 'the drift must be named per store, not merely detected');
    const software = r.moved.find((m) => m.field === 'software_requirements_path');
    assert.ok(software, `the moved store must be named; got fields ` +
      `${JSON.stringify(r.moved.map((m) => m.field))}`);
    assert.strictEqual(software.from, '.', 'the OLD path must be reported (from)');
    assert.strictEqual(software.to, 'elsewhere', 'the NEW path must be reported (to)');
    assert.ok(/ma-agents bind/.test(r.message),
      `the halt must name the recovery command (AC1), got:\n${r.message}`);
    assert.ok(/no longer matches/.test(r.message), 'the halt must name the drift, not just stop');
  });
});

test('[behaviour] AC1 the drifted config is NOT guessed past — every path field is compared', () => {
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, SAME);
    const moved = path.join(tmpDir, 'sprints-elsewhere');
    fs.mkdirSync(moved, { recursive: true });
    rebind(tmpDir, {
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'local', path: moved },
    });
    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.HALT_DRIFT,
      'a moved SPRINT store must halt too — not only the knowledge stores');
    assert.ok(r.moved.some((m) => m.field === 'sprint_management_path'),
      `sprint_management_path must be named, got ${JSON.stringify(r.moved.map((m) => m.field))}`);
    assert.ok(r.moved.some((m) => m.field === 'implementation_artifacts'),
      'the derived implementation_artifacts must be compared too — it is where stories land');
  });
});

test('[behaviour] AC5 missing project-layout.yaml on a genuine pre-F26 config: no halt', () => {
  withTmpDir((tmpDir) => {
    // A pre-F26 config: today's fields, none of the three F26 markers.
    fs.mkdirSync(path.join(tmpDir, '_bmad', 'bmm'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, CONFIG_REL),
      'user_name: dev\noutput_folder: _bmad-output\nknowledgebase_path: "."\n' +
      'sprint_backend: file-system\n', 'utf-8');

    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.PROCEED_PRE_F26,
      `a project that never had a binding must degrade to today's behaviour, got ${r.verdict}`);
    assert.strictEqual(r.silent, true,
      'NFR82: nothing moved, so the user hears nothing — no warning, no prompt, no bind offer');
  });
});

test('[behaviour] AC5 does NOT swallow drift: a lost binding with an F26 config halts', () => {
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, SAME);
    // The binding is deleted / gitignored / not pulled — the config remains.
    fs.rmSync(path.join(tmpDir, LAYOUT_REL), { force: true });

    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.HALT_BINDING_MISSING,
      `a config generated under F26 whose binding vanished is NOT a pre-F26 project ` +
      `(got ${r.verdict}) — this is the branch where AC5's degrade could swallow real drift`);
    assert.ok(r.markers.includes('project_layout_stamp'),
      'the stamp is one of the three F26 markers that discriminate');
    assert.ok(/ma-agents bind/.test(r.message), 'the halt must be actionable');
  });
});

test('[behaviour] AC5 the discriminator survives a config that lost ONLY its stamp', () => {
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, SAME);
    fs.rmSync(path.join(tmpDir, LAYOUT_REL), { force: true });
    // Exactly the nit inherited from 31.3's review: the stamp line is gone, the
    // per-store fields remain. `readProjectLayoutStamp` alone would say `absent`,
    // whose message calls that "a config generated before F26" — which this file
    // demonstrably is not.
    const cfgPath = path.join(tmpDir, CONFIG_REL);
    fs.writeFileSync(cfgPath,
      fs.readFileSync(cfgPath, 'utf-8').replace(/^project_layout_stamp:.*$\n?/m, ''), 'utf-8');
    assert.strictEqual(cli.readProjectLayoutStamp(fs.readFileSync(cfgPath, 'utf-8')).reason,
      cli.STAMP_ABSENT, 'precondition: the stamp reader now reports `absent` for this file');

    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.HALT_BINDING_MISSING,
      `an absent stamp must be CORROBORATED against the per-store fields, not believed ` +
      `(got ${r.verdict})`);
    assert.deepStrictEqual(r.markers.sort(),
      ['software_requirements_path', 'system_requirements_path'],
      'the two per-store fields are what proves this config post-dates F26');
  });
});

test('[behaviour] AC7 missing config.yaml with a binding present: actionable halt', () => {
  withTmpDir((tmpDir) => {
    quiet(() => cli.writeProjectLayoutYaml(SAME));
    assert.ok(!fs.existsSync(path.join(tmpDir, CONFIG_REL)), 'precondition: no config.yaml');

    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.HALT_CONFIG_MISSING, `expected a halt, got ${r.verdict}`);
    assert.ok(/ma-agents install/.test(r.message) && /ma-agents bind/.test(r.message),
      `AC7: the message must point at install OR bind, got:\n${r.message}`);
  });
});

test('[behaviour] AC7 missing config.yaml AND missing binding: still actionable, still a halt', () => {
  withTmpDir((tmpDir) => {
    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.HALT_UNCONFIGURED, `expected a halt, got ${r.verdict}`);
    assert.ok(/ma-agents install/.test(r.message),
      `an unconfigured project is pointed at install, got:\n${r.message}`);
    assert.notStrictEqual(r.verdict, V.PROCEED_PRE_F26,
      'no binding AND no config is not a pre-F26 project — it is an unconfigured one');
  });
});

test('[behaviour] a MALFORMED stamp halts and is never read as pre-F26', () => {
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, SAME);
    const cfgPath = path.join(tmpDir, CONFIG_REL);
    fs.writeFileSync(cfgPath, fs.readFileSync(cfgPath, 'utf-8')
      .replace(/^project_layout_stamp:.*$/m, 'project_layout_stamp: sha256:DEADBEEF'), 'utf-8');

    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.HALT_STAMP_MALFORMED,
      `a damaged stamp must halt, not degrade to permissive (got ${r.verdict})`);
    assert.notStrictEqual(r.verdict, V.PROCEED_PRE_F26,
      'the superseded null-conflation reading must not be reintroduced');
    assert.ok(/not a stamp this ma-agents wrote/.test(r.message),
      `the reader's own message is reported verbatim, got:\n${r.message}`);
    assert.ok(/DEADBEEF/.test(r.message), 'the offending value is quoted back to the user');
  });
});

test('[behaviour] a binding present but UNREADABLE halts — and is not "no binding"', () => {
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, SAME);
    fs.writeFileSync(path.join(tmpDir, LAYOUT_REL),
      '<<<<<<< HEAD\nschema_version: 2\n=======\nschema_version: 2\n>>>>>>> origin/main\n', 'utf-8');

    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.HALT_BINDING_UNREADABLE,
      `an unresolved merge conflict in the binding must halt, got ${r.verdict}`);
    assert.notStrictEqual(r.verdict, V.PROCEED_PRE_F26,
      'a binding that cannot be read is a different fact from a project that has none');
  });
});

test('[behaviour] default-deny: every non-UNBOUND resolver reason lands in the refuse bucket', () => {
  // Not a fixture test — an enumeration. A reason added to the resolver later
  // must refuse by construction, so this asserts over the exported constants
  // rather than over the three cases that happen to exist today.
  const reasons = Object.keys(cli)
    .filter((k) => /^BINDING_/.test(k) && k !== 'BINDING_UNBOUND')
    .map((k) => cli[k]);
  assert.ok(reasons.length >= 3,
    `expected the resolver's refuse reasons to be exported; found ${reasons.length}`);
  for (const reason of reasons) {
    assert.notStrictEqual(reason, cli.BINDING_UNBOUND,
      `${reason} must not collapse into UNBOUND — UNBOUND is the only permissive reason`);
  }
});

test('[behaviour] AC6 content-based, not mtime: a NEWER binding with identical content proceeds', () => {
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, SAME);
    // The `git pull` / fresh-clone shape: project-layout.yaml is rewritten with
    // byte-identical content and a later mtime. P5-9.3's second rule ("newer
    // than" ⇒ fail loud) would cry wolf here on a clean checkout.
    const layoutPath = path.join(tmpDir, LAYOUT_REL);
    const bytes = fs.readFileSync(layoutPath);
    const future = new Date(Date.now() + 60 * 60 * 1000);
    fs.writeFileSync(layoutPath, bytes);
    fs.utimesSync(layoutPath, future, future);
    const cfgStat = fs.statSync(path.join(tmpDir, CONFIG_REL));
    assert.ok(fs.statSync(layoutPath).mtimeMs > cfgStat.mtimeMs,
      'precondition: the binding is now strictly NEWER than the generated config');

    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.PROCEED_MATCHED,
      `mtime must not decide staleness — nothing moved, so this must proceed (got ${r.verdict})`);
  });
});

test('[behaviour] AC6 content-based, not mtime: an OLDER moved binding still halts', () => {
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, SAME);
    const moved = path.join(tmpDir, 'elsewhere');
    fs.mkdirSync(moved, { recursive: true });
    rebind(tmpDir, {
      knowledgebase: { mode: 'local', path: moved },
      sprintManagement: { mode: 'same', path: '.' },
    });
    // Backdate the binding an hour: the mtime rule would call this "not stale".
    const layoutPath = path.join(tmpDir, LAYOUT_REL);
    const past = new Date(Date.now() - 60 * 60 * 1000);
    fs.utimesSync(layoutPath, past, past);
    assert.ok(fs.statSync(layoutPath).mtimeMs < fs.statSync(path.join(tmpDir, CONFIG_REL)).mtimeMs,
      'precondition: the moved binding is strictly OLDER than the generated config');

    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.HALT_DRIFT,
      `real drift must be caught however the timestamps fall (got ${r.verdict})`);
  });
});

test('[behaviour] AC6 the stamp, not the fields, is what catches an invisible move', () => {
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, SAME);
    // A store changes BACKEND with no path change. config.yaml records `.` for a
    // confluence store exactly as it does for the local default, so the
    // derivation table sees nothing. The stamp covers the backend, so it does.
    rebind(tmpDir, {
      systemRequirementsStore: {
        backend: 'confluence', spaceKey: 'ENG', rootPage: { title: 'Home', id: '42' },
      },
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    });

    const withStamp = runGuard(tmpDir, { stampVerifiable: true });
    assert.strictEqual(withStamp.verdict, V.HALT_DRIFT,
      `a backend change is drift and the stamp must catch it (got ${withStamp.verdict})`);
    assert.strictEqual(withStamp.stampDrift, true,
      'the stamp — not the field table — is what fired here');
    assert.strictEqual(withStamp.moved.length, 0,
      'precondition for the next test: the field table genuinely sees nothing');
  });
});

test('[behaviour] KNOWN GAP, pinned: without stamp verification the field table misses it', () => {
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, SAME);
    rebind(tmpDir, {
      systemRequirementsStore: {
        backend: 'confluence', spaceKey: 'ENG', rootPage: { title: 'Home', id: '42' },
      },
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    });

    // This is NOT an assertion that the guard is complete. It is the opposite:
    // it pins, in a test, the one thing the guard's always-available path cannot
    // see, so the limitation is a documented fact rather than an unstated
    // assumption. An agent with no shell cannot recompute the stamp, and for
    // this drift class it will PROCEED. Story 31.6 owns the Confluence read
    // path; if the guard is ever made complete here, this test must be deleted
    // deliberately — it will start failing, which is the point.
    const noShell = runGuard(tmpDir, { stampVerifiable: false });
    assert.strictEqual(noShell.verdict, V.PROCEED_MATCHED,
      `pinning the gap: with no stamp verification this drift is invisible to the field ` +
      `table (got ${noShell.verdict}). If this now HALTs, the gap was closed — delete this test.`);
  });
});

test('[behaviour] the field table alone still catches every path move (no shell required)', () => {
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, SAME);
    const moved = path.join(tmpDir, 'elsewhere');
    fs.mkdirSync(moved, { recursive: true });
    rebind(tmpDir, {
      knowledgebase: { mode: 'local', path: moved },
      sprintManagement: { mode: 'same', path: '.' },
    });
    const r = runGuard(tmpDir, { stampVerifiable: false });
    assert.strictEqual(r.verdict, V.HALT_DRIFT,
      `the ordinary drift class — a store that moved — must not depend on a shell being ` +
      `available (got ${r.verdict})`);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2 — [behaviour] AC2: read paths never write
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 2. [behaviour] AC2 — the preflight writes nothing ===\n');

const NO_WRITE_CASES = [
  ['matched', (tmpDir) => { boundProject(tmpDir, SAME); }],
  ['drifted', (tmpDir) => {
    boundProject(tmpDir, SAME);
    const moved = path.join(tmpDir, 'elsewhere');
    fs.mkdirSync(moved, { recursive: true });
    rebind(tmpDir, { knowledgebase: { mode: 'local', path: moved }, sprintManagement: { mode: 'same', path: '.' } });
  }],
  ['pre-F26', (tmpDir) => {
    fs.mkdirSync(path.join(tmpDir, '_bmad', 'bmm'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, CONFIG_REL), 'user_name: dev\n', 'utf-8');
  }],
  ['malformed stamp', (tmpDir) => {
    boundProject(tmpDir, SAME);
    const p = path.join(tmpDir, CONFIG_REL);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf-8')
      .replace(/^project_layout_stamp:.*$/m, 'project_layout_stamp: nope'), 'utf-8');
  }],
  ['unreadable binding', (tmpDir) => {
    boundProject(tmpDir, SAME);
    fs.writeFileSync(path.join(tmpDir, LAYOUT_REL), '\tnot: [valid\n', 'utf-8');
  }],
];

for (const [label, build] of NO_WRITE_CASES) {
  test(`[behaviour] AC2 ${label}: the guard leaves every byte on disk unchanged`, () => {
    withTmpDir((tmpDir) => {
      build(tmpDir);
      const before = snapshot(tmpDir);
      runGuard(tmpDir);
      const after = snapshot(tmpDir);
      assert.deepStrictEqual(after, before,
        'AC2: the preflight is a read path and read paths never write — not the config, ' +
        'not the binding, not a lock file, not a backup');
    });
  });
}

test('[behaviour] AC2 the guard never creates config.yaml when it is missing', () => {
  withTmpDir((tmpDir) => {
    quiet(() => cli.writeProjectLayoutYaml(SAME));
    runGuard(tmpDir);
    assert.ok(!fs.existsSync(path.join(tmpDir, CONFIG_REL)),
      'the guard reports the missing config; it must never regenerate it — that is the ' +
      'installer\'s job and `ma-agents bind`\'s, never a skill\'s');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3 — [text] the embedded block: presence, placement, parity
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 3. [text] the embedded block ===\n');

const GUARD_HEADING = '## Knowledge Store Binding Preflight';

// The entry document of every skill whose instructions resolve at least one
// binding-derived field of config.yaml. Pipeline 1 = skills/ (lib/installer.js);
// pipeline 2 = lib/bmad-extension/skills/ (lib/bmad.js). `bmad-sprint-planning`,
// `bmad-sprint-status` and `bmad-dev-story` keep their entry instructions in
// workflow.md — their SKILL.md is a one-line delegator — which is why Story
// 17.22 put the Backend Routing block there too.
const GUARDED = Object.freeze([
  'skills/add-sprint/SKILL.md',
  'skills/add-to-sprint/SKILL.md',
  'skills/bmad-knowledge/SKILL.md',
  'skills/bmad-sprint-planning/SKILL.md',
  'skills/bmad-sprint-status/SKILL.md',
  'skills/cleanup-done/SKILL.md',
  'skills/close-sprint/SKILL.md',
  'skills/generate-backlog/SKILL.md',
  'skills/modify-sprint/SKILL.md',
  'skills/prioritize-backlog/SKILL.md',
  'skills/remove-from-sprint/SKILL.md',
  'skills/sprint-status-view/SKILL.md',
  'skills/story-status-lookup/SKILL.md',
  'lib/bmad-extension/skills/add-sprint/SKILL.md',
  'lib/bmad-extension/skills/add-to-sprint/SKILL.md',
  'lib/bmad-extension/skills/bmad-dev-epic/SKILL.md',
  'lib/bmad-extension/skills/bmad-dev-story/workflow.md',
  'lib/bmad-extension/skills/bmad-knowledge/SKILL.md',
  'lib/bmad-extension/skills/bmad-sprint-planning/workflow.md',
  'lib/bmad-extension/skills/bmad-sprint-status/workflow.md',
  'lib/bmad-extension/skills/cleanup-done/SKILL.md',
  'lib/bmad-extension/skills/close-sprint/SKILL.md',
  'lib/bmad-extension/skills/generate-backlog/SKILL.md',
  'lib/bmad-extension/skills/modify-sprint/SKILL.md',
  'lib/bmad-extension/skills/prioritize-backlog/SKILL.md',
  'lib/bmad-extension/skills/remove-from-sprint/SKILL.md',
  'lib/bmad-extension/skills/sprint-status-view/SKILL.md',
]);

// The generated fields of config.yaml — everything `generateBmmConfig` derives
// from the committed binding. A skill that resolves any of these can resolve a
// STALE one, which is precisely the OQ-3 criterion.
const BINDING_DERIVED_FIELDS = Object.freeze([
  'knowledgebase_path', 'system_requirements_path', 'software_requirements_path',
  'sprint_management_path', 'sprint_backend', 'jira_url', 'jira_project_key',
  'planning_artifacts', 'implementation_artifacts',
]);

function readGuarded(rel) {
  return fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf-8').replace(/\r\n/g, '\n');
}

function extractBlock(body) {
  const i = body.indexOf(GUARD_HEADING);
  if (i === -1) return null;
  const rest = body.slice(i);
  const j = rest.indexOf('\n## ', 1);
  return (j === -1 ? rest : rest.slice(0, j)).trimEnd();
}

test('[text] AC4 every guarded skill carries the block, in both pipelines', () => {
  const missing = GUARDED.filter((rel) => !readGuarded(rel).includes(GUARD_HEADING));
  assert.deepStrictEqual(missing, [], `these skills are missing the preflight: ${missing}`);
  const p1 = GUARDED.filter((r) => r.startsWith('skills/')).length;
  const p2 = GUARDED.filter((r) => r.startsWith('lib/bmad-extension/')).length;
  assert.ok(p1 > 0 && p2 > 0,
    `AC4 names BOTH pipelines; got ${p1} via lib/installer.js and ${p2} via lib/bmad.js`);
});

test('[text] AC4 the block is byte-identical in every copy', () => {
  const seen = new Map();
  for (const rel of GUARDED) {
    const block = extractBlock(readGuarded(rel));
    const h = crypto.createHash('sha256').update(block).digest('hex');
    if (!seen.has(h)) seen.set(h, []);
    seen.get(h).push(rel);
  }
  assert.strictEqual(seen.size, 1,
    `AC4 says "deployed unchanged through both pipelines" — the block must be one text, not ` +
    `${seen.size} variants: ${JSON.stringify([...seen.values()].map((v) => v[0]))}`);
});

test('[text] AC4 the plugin mirror carries the same block, byte-identical', () => {
  const ext = GUARDED.filter((r) => r.startsWith('lib/bmad-extension/'));
  const canonical = extractBlock(readGuarded(ext[0]));
  for (const rel of ext) {
    const mirrored = rel.replace('lib/bmad-extension/', 'lib/bmad-extension-plugin/');
    const abs = path.join(PROJECT_ROOT, mirrored);
    assert.ok(fs.existsSync(abs), `the plugin mirror is missing ${mirrored} — run npm run build:plugin`);
    assert.strictEqual(extractBlock(readGuarded(mirrored)), canonical,
      `${mirrored} drifted from its source — run npm run build:plugin and commit the result`);
  }
});

test('[text] AC3 the block is the FIRST section of every skill it is in', () => {
  for (const rel of GUARDED) {
    const headings = readGuarded(rel).split('\n').filter((l) => /^## /.test(l));
    assert.strictEqual(headings[0], GUARD_HEADING,
      `${rel}: the preflight must be the gateway (mcp-detection-pattern-spec.md §2.6) — ` +
      `no skill logic executes before it. First section is ${JSON.stringify(headings[0])}`);
  }
});

// Heading order is necessary but not sufficient — a skill could carry an
// instruction in its H1 prologue, above every heading. So the second half of AC3
// is measured on INSTRUCTIONS rather than on headings: whatever a skill's first
// actionable line is, the guard comes before it. This is the test that caught
// `## INITIALIZATION` (which loads config.yaml and resolves
// `implementation_artifacts`) sitting ahead of the guard in four files.
const ACTION_MARKERS = Object.freeze([
  '<action>', '<step', 'Load config', 'Read `', 'Locate `', 'Resolve project root',
  'Load and read', 'Attempt to read',
]);

test('[text] AC3 the guard precedes the FIRST instruction in each skill', () => {
  let exercised = 0;
  for (const rel of GUARDED) {
    const body = readGuarded(rel);
    const guardAt = body.indexOf(GUARD_HEADING);
    // Measured against the document with the guard's OWN text removed, so the
    // block's internal "Read `_bmad-output/project-layout.yaml`" is not mistaken
    // for the skill's first instruction.
    const block = extractBlock(body);
    const stripped = body.slice(0, guardAt) + ' '.repeat(block.length) + body.slice(guardAt + block.length);
    for (const m of ACTION_MARKERS) {
      const at = stripped.indexOf(m);
      if (at === -1) continue;
      exercised++;
      assert.ok(guardAt < at,
        `${rel}: ${JSON.stringify(m)} appears at offset ${at}, before the preflight at ` +
        `${guardAt}. No skill logic may execute before the gateway check.`);
    }
  }
  assert.ok(exercised >= GUARDED.length,
    `this test must actually find instructions to order against; it matched only ` +
    `${exercised} across ${GUARDED.length} skills, which means the marker list has gone stale`);
});

test('[text] AC3 the block precedes the Backend Routing check it must gate', () => {
  const withRouting = GUARDED.filter((rel) => readGuarded(rel).includes('## Backend Routing'));
  assert.ok(withRouting.length >= 20,
    `expected most guarded skills to carry Story 17.22's routing block; found ${withRouting.length}`);
  for (const rel of withRouting) {
    const body = readGuarded(rel);
    assert.ok(body.indexOf(GUARD_HEADING) < body.indexOf('## Backend Routing'),
      `${rel}: Backend Routing itself reads sprint-status.yaml, whose location is resolved ` +
      `from the generated config — so the staleness check must run BEFORE it, not after`);
  }
});

test('[text] AC4 no shared importable module was created for the guard', () => {
  // Story 17.22's precedent, restated as a test: the pattern lives in the skill
  // text. A JS module the skills "call" would be the thing the technical note
  // forbids, and would also not survive either deployment pipeline.
  const suspects = ['lib/staleness-guard.js', 'lib/binding-guard.js', 'lib/config-staleness.js'];
  for (const s of suspects) {
    assert.ok(!fs.existsSync(path.join(PROJECT_ROOT, s)),
      `${s} exists — the guard must be embedded instruction text, not a shared module`);
  }
});

test('[text] AC2 the block forbids writing, in the block itself', () => {
  const block = extractBlock(readGuarded(GUARDED[0]));
  assert.ok(/read-only/i.test(block), 'the block must say it is read-only');
  assert.ok(/do NOT regenerate, repair, edit or create/.test(block),
    'the block must forbid regenerating config.yaml by name, not merely imply it');
  assert.ok(/belongs to the installer and to `ma-agents bind`, never to a skill/.test(block),
    'the block must say WHERE regeneration belongs, so the instruction is actionable');
});

test('[text] AC6 the block forbids mtime comparison by name', () => {
  const block = extractBlock(readGuarded(GUARDED[0]));
  assert.ok(/Never decide staleness from file modification times/.test(block),
    'AC6 / OQ-2: the block must rule out mtime explicitly — an agent told only "compare ' +
    'content" will reach for timestamps, and P5-9.3 still tells it to');
  assert.ok(/git pull/.test(block) && /fresh clone/.test(block),
    'the block must say WHY mtime is wrong, or the rule reads as arbitrary and gets ignored');
});

test('[text] AC1 the block names `ma-agents bind` in the drift branch', () => {
  const block = extractBlock(readGuarded(GUARDED[0]));
  const drift = block.slice(block.indexOf('config.yaml` is stale'));
  assert.ok(/ma-agents bind/.test(drift),
    'AC1: the drift halt must instruct the user to run `ma-agents bind`');
  assert.ok(/\{store name\}: was `\{path in config\.yaml\}`, is now `\{path in project-layout\.yaml\}`/
    .test(drift),
    'AC1: the drift message template must name the store and BOTH paths — "something moved" ' +
    'is not "which store moved, from where to where"');
});

test('[text] the block does not contradict Story 31.2\'s pinned UNBOUND wording', () => {
  // 31.2 round 3 pinned that the refuse-to-overwrite message in bin/cli.js says
  // "delete _bmad-output/project-layout.yaml and re-run the installer" and does
  // NOT say `ma-agents bind`, because in this release the installer is the only
  // writer of the binding. That is a DIFFERENT message from this guard's, and
  // this test proves the guard did not reach into it.
  const cliSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'bin', 'cli.js'), 'utf-8');
  const refusal = cliSrc.slice(cliSrc.indexOf('Refusing to overwrite _bmad-output/project-layout.yaml'));
  const window = refusal.slice(0, 700);
  assert.ok(/re-run the installer/.test(window),
    'the refuse-to-overwrite message must still tell the user to re-run the installer');
  assert.ok(!/ma-agents bind/.test(window),
    'Story 31.2 deliberately kept `ma-agents bind` OUT of that message — 31.4 must not add it');
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4 — [text] the block and the executable oracle must stay in step
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 4. [text] block ↔ decision-procedure correspondence ===\n');

// Every verdict `runGuard` can return, paired with the sentence in the block
// that IS that branch. If a branch is added to one side and not the other, one
// of these two tests fails — which is what stops Section 1 from testing a
// program nobody ships.
const BRANCH_MARKERS = Object.freeze({
  [V.HALT_BINDING_UNREADABLE]: 'stopping: the committed knowledge binding cannot be read',
  [V.HALT_UNCONFIGURED]: 'stopping: this project is not configured',
  [V.HALT_BINDING_MISSING]: 'stopping: the committed knowledge binding is missing',
  [V.PROCEED_PRE_F26]: 'this is genuinely a pre-F26 project',
  [V.HALT_CONFIG_MISSING]: 'stopping: the generated config is missing',
  [V.HALT_STAMP_ABSENT]: 'does not record which binding it came from',
  [V.HALT_STAMP_MALFORMED]: 'claims to have been generated and the claim cannot be read',
  [V.HALT_DRIFT]: 'config.yaml` is stale',
  [V.PROCEED_MATCHED]: 'The generated config matches the committed binding',
});

test('[text] every verdict the procedure can return is a named branch of the block', () => {
  const block = extractBlock(readGuarded(GUARDED[0]));
  for (const verdict of Object.values(V)) {
    const marker = BRANCH_MARKERS[verdict];
    assert.ok(marker, `${verdict} has no marker — a verdict was added without its block text`);
    assert.ok(block.includes(marker),
      `${verdict}: the block has no branch matching ${JSON.stringify(marker)}. The executable ` +
      `procedure in this suite would then be testing a decision no skill is told to make.`);
  }
  assert.strictEqual(Object.keys(BRANCH_MARKERS).length, Object.keys(V).length,
    'the marker table and the verdict enum must have the same size');
});

test('[text] the block declares no HALT the procedure cannot produce', () => {
  const block = extractBlock(readGuarded(GUARDED[0]));
  // Every bolded HALT in the block must be one of the mapped branches. A tenth
  // one would mean the shipped text asks for a decision nothing here exercises.
  const halts = (block.match(/\*\*HALT\*\*/g) || []).length;
  const mappedHalts = Object.entries(BRANCH_MARKERS)
    .filter(([v]) => v.startsWith('halt:')).length;
  assert.strictEqual(halts, mappedHalts,
    `the block contains ${halts} HALT branches but the procedure produces ${mappedHalts} halt ` +
    `verdicts — one side gained a branch the other does not have`);
});

test('[text] the block keys on the binding FIRST and the stamp SECOND', () => {
  const block = extractBlock(readGuarded(GUARDED[0]));
  // Measured over the DECISION STEPS only — the block's prologue names both
  // files while explaining what the guard is for, and that prose is not the
  // order under test.
  const steps = block.slice(block.indexOf('### Step P1'));
  assert.ok(steps.indexOf('_bmad-output/project-layout.yaml') < steps.indexOf('project_layout_stamp:'),
    'bin/cli.js:747 — the resolver is asked first so `unbound` is learned from the ' +
    'filesystem, and an absent stamp is only ever corroboration of it');
  assert.ok(steps.indexOf('### Step P1') < steps.indexOf('### Step P3'),
    'the stamp branches live in Step P3, after the binding has been resolved in Step P1');
  assert.ok(/the order is load-bearing/i.test(block),
    'the block must say the order matters, or a reader will reorder it');
});

test('[text] the block treats `malformed` and `absent` as different facts', () => {
  const block = extractBlock(readGuarded(GUARDED[0]));
  assert.ok(/it is NOT a config that predates the stamp/.test(block),
    'the superseded null-conflation reading must be ruled out in the shipped text, not only ' +
    'in this repo\'s history');
  assert.ok(/An absent stamp on its own is never evidence that a project predates the stamp/
    .test(block),
    'the `absent` message in bin/cli.js over-claims ("a config generated before F26"); the ' +
    'block must not inherit that claim');
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5 — [text] OQ-3: the guard is where it needs to be, and only there
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 5. [text] OQ-3 — scope of the guard ===\n');

function skillEntryDocs() {
  const roots = ['skills', path.join('lib', 'bmad-extension', 'skills')];
  const out = [];
  for (const root of roots) {
    const abs = path.join(PROJECT_ROOT, root);
    if (!fs.existsSync(abs)) continue;
    for (const dir of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      for (const name of ['SKILL.md', 'workflow.md']) {
        const p = path.join(abs, dir.name, name);
        if (fs.existsSync(p)) out.push(path.relative(PROJECT_ROOT, p).split(path.sep).join('/'));
      }
    }
  }
  return out;
}

test('[text] OQ-3 the guarded set is EXACTLY the skills that resolve a binding-derived field', () => {
  // The completeness half of the OQ-3 answer, enforced mechanically: a future
  // skill that starts reading `implementation_artifacts` without the preflight
  // fails this test. `sprint_backend` is excluded from the trigger set because
  // Story 17.22's routing block mentions it in a WRITE branch, not a resolve.
  const RESOLVE_FIELDS = BINDING_DERIVED_FIELDS.filter((f) => f !== 'sprint_backend');
  const shouldGuard = new Set();
  for (const rel of skillEntryDocs()) {
    const body = fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf-8');
    const withoutGuard = body.split(GUARD_HEADING)[0] + (body.split('\n## ').slice(1)
      .filter((s) => !s.startsWith('Knowledge Store Binding Preflight')).join('\n## '));
    if (RESOLVE_FIELDS.some((f) => withoutGuard.includes(f))) shouldGuard.add(rel);
  }
  const guarded = new Set(GUARDED);
  const unguarded = [...shouldGuard].filter((r) => !guarded.has(r)).sort();
  assert.deepStrictEqual(unguarded, [],
    `these skill entry documents resolve a binding-derived config field but carry no ` +
    `preflight: ${JSON.stringify(unguarded)}`);
});

test('[text] OQ-3 an `{output_folder}`-only consumer is deliberately NOT guarded', () => {
  // The evidence behind the OQ-3 answer. `output_folder` is a field ma-agents
  // does NOT own (bin/cli.js:930) and `generateBmmConfig` never writes it, so no
  // binding change can make it stale — and `canonicalBindingBytes` does not
  // cover it. sqa-audit reads config.yaml solely to resolve `{output_folder}`.
  const rel = 'lib/bmad-extension/skills/sqa-audit/SKILL.md';
  const body = fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf-8');
  assert.ok(body.includes('_bmad/bmm/config.yaml'), `precondition: ${rel} reads config.yaml`);
  assert.ok(body.includes('{output_folder}'), `precondition: ${rel} consumes {output_folder}`);
  assert.ok(!BINDING_DERIVED_FIELDS.some((f) => body.includes(f)),
    `${rel} must resolve no binding-derived field, or it belongs in GUARDED`);
  assert.ok(!body.includes(GUARD_HEADING),
    `${rel} is not guarded on purpose — guarding it would block a skill on a field that ` +
    `cannot go stale`);
});

test('[text] OQ-3 `output_folder` is not covered by the stamp, so it cannot drift', () => {
  const cliSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'bin', 'cli.js'), 'utf-8');
  const canonical = cliSrc.slice(
    cliSrc.indexOf('function canonicalBindingBytes'),
    cliSrc.indexOf('function computeProjectLayoutStamp'));
  assert.ok(!/output_folder/.test(canonical),
    'if the stamp ever covers output_folder, the 32 {output_folder} consumers become ' +
    'guardable drift surface and the OQ-3 answer changes');
  const gen = cliSrc.slice(cliSrc.indexOf('function generateBmmConfig'));
  const writes = (gen.slice(0, gen.indexOf('\n}\n')).match(/writeConfigField\(content, '([a-z_]+)'/g) || [])
    .map((m) => m.replace(/.*'([a-z_]+)'.*/, '$1'));
  assert.ok(writes.length > 0, 'expected to find the generated field list in generateBmmConfig');
  assert.ok(!writes.includes('output_folder'),
    'generateBmmConfig must not write output_folder — the OQ-3 answer rests on it');
  for (const f of writes) {
    assert.ok(BINDING_DERIVED_FIELDS.includes(f) || f === 'project_layout_stamp',
      `generateBmmConfig writes ${f}, which this suite's BINDING_DERIVED_FIELDS list does not ` +
      `know about — the OQ-3 scope rule has gone stale`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 6 — [behaviour] the 31.3 contract pin the stamp's own suite lacks
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 6. [behaviour] contract pin — an unbound project is never stamped ===\n');

test('[behaviour] an UNBOUND project generated from a fallback layout carries NO stamp', () => {
  withTmpDir((tmpDir) => {
    // The `unbound + fallback` branch of generateBmmConfig. It writes today's
    // fields and deliberately no stamp, because there is no project-layout.yaml
    // to stamp — an invented stamp there would be a false claim that later
    // collides with the real binding. Pinned here because 31.4 is the consumer
    // whose correctness depends on it: the guard learns `unbound` from the
    // filesystem first, so it must never meet a stamp on an unbound project.
    const wrote = quiet(() => cli.generateBmmConfig({ projectRoot: tmpDir, fallbackLayout: SAME }));
    assert.strictEqual(wrote.value, true, 'the fallback branch still generates a usable config');
    assert.ok(!fs.existsSync(path.join(tmpDir, LAYOUT_REL)),
      'precondition: the project is genuinely unbound');

    const content = fs.readFileSync(path.join(tmpDir, CONFIG_REL), 'utf-8');
    const stamp = cli.readProjectLayoutStamp(content);
    assert.strictEqual(stamp.ok, false, 'an unbound project must never be given a stamp');
    assert.strictEqual(stamp.reason, cli.STAMP_ABSENT,
      `expected ${cli.STAMP_ABSENT}, got ${stamp.reason} — a stamp invented for an unbound ` +
      `project is a false claim about a binding that does not exist`);

    // js-yaml oracle: the field is absent to a real parser too, not merely to
    // this module's own regex reader.
    const parsed = yamlOracle.load(content) || {};
    assert.ok(!Object.prototype.hasOwnProperty.call(parsed, 'project_layout_stamp'),
      'the YAML oracle must agree the key is absent');
  });
});

test('[behaviour] and the guard HALTS on it, because the per-store fields betray it', () => {
  withTmpDir((tmpDir) => {
    quiet(() => cli.generateBmmConfig({ projectRoot: tmpDir, fallbackLayout: SAME }));
    const r = runGuard(tmpDir);
    // The fallback branch writes the per-store fields, so AC5's corroboration
    // correctly refuses to call this a pre-F26 project. It is not: it is a
    // project whose installer could not write `_bmad-output/`. Halting is the
    // fail-loud answer; the alternative is running against unverified paths.
    assert.strictEqual(r.verdict, V.HALT_BINDING_MISSING,
      `the unbound-fallback config is not pre-F26 and must not be waved through ` +
      `(got ${r.verdict})`);
  });
});

test('[behaviour] the stamp covers everything that can relocate an artifact', () => {
  // `canonicalBindingBytes` is exported precisely so a test can assert WHAT is
  // covered rather than only that two digests differ.
  const a = cli.canonicalBindingBytes({
    systemRequirementsStore: { mode: 'same', path: '.' },
    softwareRequirementsStore: { mode: 'same', path: '.' },
    sprintManagement: { mode: 'same', path: '.' },
  }, process.cwd());
  assert.ok(/system_requirements_store:/.test(a) && /software_requirements_store:/.test(a)
    && /sprint_management:/.test(a),
    'all three binding records must be inside the stamped bytes');
  assert.ok(!/generated:/.test(a) && !/schema_version/.test(a),
    'a re-dated or migrated file that moved nothing must not read as drift');
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailed tests:');
  errors.forEach((e) => console.log(`  - ${e.name}: ${e.error}`));
}

const total = passed + failed;
summaryPrinted = true;
if (total !== EXPECTED_TEST_COUNT) {
  console.error(
    `\n  FATAL: ${total} tests ran, but this file defines ${EXPECTED_TEST_COUNT}. Tests that ` +
    `silently stop running must FAIL, not pass — and a surplus is just as wrong as a ` +
    `shortfall. If you added or removed a test, update EXPECTED_TEST_COUNT deliberately.`
  );
  process.exit(1);
}
if (failed > 0) process.exit(1);
