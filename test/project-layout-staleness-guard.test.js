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
const EXPECTED_TEST_COUNT = 61;

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

/**
 * What `generateBmmConfig` writes for a store's path — a VERBATIM transcription
 * of `storeConfigPath` (bin/cli.js:901), which is:
 *
 *     toPortablePath(store && store.path, projectRoot).portable
 *
 * and which has NO backend check. This function used to carry an extra
 * `backend !== 'file-system' → '.'` short-circuit, and removing it survived
 * mutation. It survived because it was dead — the resolver never produces a
 * non-file-system store carrying a path (`storeFromRaw`'s confluence branch
 * returns backend/space_key/root_page and nothing else), so
 * `toPortablePath(undefined)` already returns `.` for exactly those stores.
 *
 * It is gone rather than kept, because it was also a DIVERGENCE: had a store
 * ever arrived with both a backend and a path, the generator would have written
 * the path while this transcription expected `.`, and the guard would have
 * reported drift on a config the generator had just written. The construction
 * that makes the two forms agree is pinned by the M32 test below, so if a future
 * backend ever resolves with a path, that test fails rather than this silently
 * disagreeing with the generator.
 */
function expectedStorePath(store, projectRoot) {
  return cli.toPortablePath(store && store.path, projectRoot).portable;
}

// The two derived artifact roots `generateBmmConfig` writes when a store sits at
// `.` (bin/cli.js `canonicalArtifactPath`). Named, so the shipped table and this
// transcription cannot drift apart on a typo.
const CANON_PLANNING = '{project-root}/_bmad-output/planning-artifacts';
const CANON_IMPL = '{project-root}/_bmad-output/implementation-artifacts';

// The `When` cell of each shipped table row, as a token. These three are the ONLY
// conditions the shipped table may state; `parseDerivationTable` throws on
// anything else, so a hand-edited condition cannot be silently ignored here.
const WHEN_ALWAYS = 'always';
const WHEN_JIRA = 'jira';
const WHEN_OTHER = 'other';

/**
 * Step P4's derivation table, EXECUTED — one row per generated field, carrying
 * the binding record it is derived from and the value that field should hold.
 *
 * Deliberately shaped as a table rather than a run of `if`s, because Section 4
 * now asserts a row-by-row correspondence between it and the table in the
 * SHIPPED text. Before that correspondence existed, all four substantive rows
 * could be deleted from all 41 shipped copies with this suite still fully green
 * — the review finding this fix round exists to close. `when` is carried per row
 * so the correspondence is checked PER SPRINT MODE rather than over a union,
 * which would hide a row silently moving from one mode to the other.
 */
function derivedFields(topology, projectRoot) {
  const rows = [];
  const derive = (when, source, field, expected) =>
    rows.push({ when, source, field, expected });

  const software = expectedStorePath(topology.softwareRequirementsStore, projectRoot);
  const system = expectedStorePath(topology.systemRequirementsStore, projectRoot);
  derive(WHEN_ALWAYS, 'software_requirements_store', 'software_requirements_path', software);
  derive(WHEN_ALWAYS, 'software_requirements_store', 'knowledgebase_path', software);
  derive(WHEN_ALWAYS, 'software_requirements_store', 'planning_artifacts',
    software === '.' ? CANON_PLANNING : software);
  derive(WHEN_ALWAYS, 'system_requirements_store', 'system_requirements_path', system);

  // Story 31.9 — the two stores' backends and Confluence spaces, now carried by
  // the generated config so a skill's gateway check can read them from the
  // RESOLVED configuration rather than opening the committed binding a second
  // time. They are derived from the SAME binding records as the paths above, so
  // a re-bind that changes only a backend is drift the P4 table can now name;
  // before, only the opaque stamp could see it.
  const backendOf = (s) => (s && typeof s.backend === 'string' && s.backend !== '')
    ? s.backend : 'file-system';
  const spaceOf = (s) => (backendOf(s) === 'confluence' && typeof s.spaceKey === 'string')
    ? s.spaceKey : '';
  derive(WHEN_ALWAYS, 'software_requirements_store', 'software_requirements_backend',
    backendOf(topology.softwareRequirementsStore));
  derive(WHEN_ALWAYS, 'software_requirements_store', 'software_requirements_space_key',
    spaceOf(topology.softwareRequirementsStore));
  derive(WHEN_ALWAYS, 'system_requirements_store', 'system_requirements_backend',
    backendOf(topology.systemRequirementsStore));
  derive(WHEN_ALWAYS, 'system_requirements_store', 'system_requirements_space_key',
    spaceOf(topology.systemRequirementsStore));

  const sprint = topology.sprintManagement || { mode: 'same', path: '.' };
  if (sprint.mode === 'jira') {
    derive(WHEN_JIRA, 'sprint_management', 'sprint_backend', 'jira');
    derive(WHEN_JIRA, 'sprint_management', 'jira_url', sprint.jiraUrl);
    derive(WHEN_JIRA, 'sprint_management', 'jira_project_key', sprint.jiraProjectKey);
    // F1. In jira mode `implementation_artifacts` is a CONSTANT — a Jira sprint
    // store has no path — and `sprint_management_path` is NOT derived at all.
    // `writeConfigField` (bin/cli.js:630) only ever updates-or-appends; it never
    // deletes. So a project bound to the file system and later re-bound to Jira
    // keeps its old `sprint_management_path:` line in a config the generator has
    // JUST written. Comparing that survivor would HALT every such project on a
    // freshly generated file. It is not derived here, so it is not compared.
    derive(WHEN_JIRA, 'sprint_management', 'implementation_artifacts', CANON_IMPL);
  } else {
    const sp = expectedStorePath(sprint, projectRoot);
    derive(WHEN_OTHER, 'sprint_management', 'sprint_backend', 'file-system');
    derive(WHEN_OTHER, 'sprint_management', 'sprint_management_path', sp);
    derive(WHEN_OTHER, 'sprint_management', 'implementation_artifacts',
      sp === '.' ? CANON_IMPL : sp);
  }
  return rows;
}

// Human labels for the drift message, per binding record. Kept beside
// `derivedFields` so a record added there without a label is a visible hole.
const STORE_LABELS = Object.freeze({
  software_requirements_store: 'software requirements store',
  system_requirements_store: 'system requirements store',
  sprint_management: 'sprint management',
});

/**
 * The rows of `derivedFields` that disagree with what `config.yaml` carries —
 * which is what AC1's "names the drift (which store moved, from where to where)"
 * is made of.
 */
function namedMoves(topology, configContent, projectRoot) {
  const moved = [];
  for (const row of derivedFields(topology, projectRoot)) {
    const actual = readConfigField(configContent, row.field);
    if (actual !== row.expected) {
      moved.push({
        store: STORE_LABELS[row.source], field: row.field, from: actual, to: row.expected,
      });
    }
  }
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

// F1 — the jira shape. `SPRINT_MODES` (bin/cli.js:1426) has admitted `jira`
// since before this story, the installer prompts for both coordinates
// (bin/cli.js:472/488), and `generateBmmConfig` has a live jira branch — so this
// is reachable today, not a future mode. The suite shipped with ZERO jira
// fixtures, which is how the false clause in the P4 jira row survived review.
const JIRA_URL = 'https://jira.example.com';
const JIRA_KEY = 'PROJ';
function jiraLayout(over) {
  return Object.assign({
    knowledgebase: { mode: 'same', path: '.' },
    sprintManagement: { mode: 'jira', jiraUrl: JIRA_URL, jiraProjectKey: JIRA_KEY },
  }, over || {});
}

/** Regenerate `config.yaml` from whatever binding is committed — `ma-agents bind`. */
function regenerate(tmpDir) {
  quiet(() => cli.generateBmmConfig({ projectRoot: tmpDir }));
}

function readConfig(tmpDir) {
  return fs.readFileSync(path.join(tmpDir, CONFIG_REL), 'utf-8');
}

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
    // M27 — the symmetric partner of the `implementation_artifacts` assertion in
    // the sprint-move test below. `planning_artifacts` is where planning
    // documents land; without this, dropping it from the derivation table left
    // every fixture green.
    const planning = r.moved.find((m) => m.field === 'planning_artifacts');
    assert.ok(planning, `the derived planning_artifacts must be compared too — it is where ` +
      `planning documents land; got ${JSON.stringify(r.moved.map((m) => m.field))}`);
    assert.strictEqual(planning.from, CANON_PLANNING,
      'a store at `.` generates the canonical planning-artifacts root');
    assert.strictEqual(planning.to, 'elsewhere',
      'a store with a real path generates that path verbatim (3.12.3)');
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

test('[behaviour] a DIVERGENT project (knowledge and sprint at different paths) proceeds', () => {
  withTmpDir((tmpDir) => {
    // Every fixture above puts both concerns at `.`, which makes several
    // generated fields accidentally equal — so a generator that wrote the WRONG
    // store into `sprint_management_path` would look correct. This is the
    // multi-repo shape, where they differ, and the guard must still say "matched"
    // on a config it just generated. A false HALT here is the cry-wolf failure.
    const kb = path.join(tmpDir, 'kb-here');
    const sp = path.join(tmpDir, 'sprints-there');
    fs.mkdirSync(kb, { recursive: true });
    fs.mkdirSync(sp, { recursive: true });
    boundProject(tmpDir, {
      knowledgebase: { mode: 'local', path: kb },
      sprintManagement: { mode: 'local', path: sp },
    });

    const cfg = fs.readFileSync(path.join(tmpDir, CONFIG_REL), 'utf-8');
    assert.strictEqual(readConfigField(cfg, 'knowledgebase_path'), 'kb-here',
      'precondition: the knowledge store and the sprint store are at DIFFERENT paths');
    assert.strictEqual(readConfigField(cfg, 'sprint_management_path'), 'sprints-there',
      'precondition: sprint_management_path comes from the SPRINT record, not the knowledge one');

    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.PROCEED_MATCHED,
      `a freshly generated divergent config must not read as drift (got ${r.verdict}: ` +
      `${JSON.stringify((r.moved || []).map((m) => m.field))})`);
  });
});

test('[behaviour] a DIVERGENT store pair: moving only the SYSTEM store is named as that store', () => {
  withTmpDir((tmpDir) => {
    // FR264: the legacy single-valued `knowledgebase_path` resolves to the
    // SOFTWARE store. With the two stores at different paths, a generator that
    // sourced it from the SYSTEM store instead would be invisible to every
    // fixture where they agree.
    const sys = path.join(tmpDir, 'system-store');
    const soft = path.join(tmpDir, 'software-store');
    fs.mkdirSync(sys, { recursive: true });
    fs.mkdirSync(soft, { recursive: true });
    boundProject(tmpDir, {
      systemRequirementsStore: { mode: 'local', path: sys },
      softwareRequirementsStore: { mode: 'local', path: soft },
      knowledgebase: { mode: 'local', path: soft },
      sprintManagement: { mode: 'same', path: '.' },
    });
    const cfg = fs.readFileSync(path.join(tmpDir, CONFIG_REL), 'utf-8');
    assert.strictEqual(readConfigField(cfg, 'knowledgebase_path'), 'software-store',
      'precondition: FR264 — the legacy field follows the SOFTWARE store');
    assert.strictEqual(readConfigField(cfg, 'system_requirements_path'), 'system-store',
      'precondition: the per-store fields genuinely differ');
    assert.strictEqual(runGuard(tmpDir).verdict, V.PROCEED_MATCHED,
      'precondition: the freshly generated divergent config is matched');

    const moved = path.join(tmpDir, 'system-store-moved');
    fs.mkdirSync(moved, { recursive: true });
    rebind(tmpDir, {
      systemRequirementsStore: { mode: 'local', path: moved },
      softwareRequirementsStore: { mode: 'local', path: soft },
      sprintManagement: { mode: 'same', path: '.' },
    });

    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.HALT_DRIFT, `expected drift, got ${r.verdict}`);
    assert.deepStrictEqual(r.moved.map((m) => m.field), ['system_requirements_path'],
      'AC1: only the store that actually moved may be named — naming the others too would ' +
      'make the message useless, and naming none would make it unactionable');
    assert.strictEqual(r.moved[0].from, 'system-store');
    assert.strictEqual(r.moved[0].to, 'system-store-moved');
  });
});

// ─── F1 — the jira sprint backend. Reachable today, and untested until now. ───

test('[behaviour] F1 a file-system → jira re-bind: the surviving `sprint_management_path` is NOT drift', () => {
  withTmpDir((tmpDir) => {
    // The shipped P4 jira row used to claim a jira generation leaves "no
    // `sprint_management_path:`". It does not: `writeConfigField` updates or
    // appends and NEVER deletes, so the field written by the earlier
    // file-system binding survives verbatim. Combined with "Any disagreement is
    // drift → HALT", that clause made the guard HALT on a config `ma-agents
    // bind` had just written — a false halt, on the cry-wolf side of the fence.
    const sp = path.join(tmpDir, 'sprints-there');
    fs.mkdirSync(sp, { recursive: true });
    boundProject(tmpDir, {
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'local', path: sp },
    });
    assert.strictEqual(readConfigField(readConfig(tmpDir), 'sprint_management_path'), 'sprints-there',
      'precondition: the file-system binding wrote a real sprint_management_path');

    // Re-bind to Jira and regenerate, exactly as `ma-agents bind` would.
    rebind(tmpDir, jiraLayout());
    regenerate(tmpDir);
    const cfg = readConfig(tmpDir);

    assert.strictEqual(readConfigField(cfg, 'sprint_backend'), 'jira',
      'precondition: the config really was regenerated under the jira branch');
    assert.strictEqual(readConfigField(cfg, 'sprint_management_path'), 'sprints-there',
      'THE PREMISE, proven on disk: the generator did not remove the stale field. If this ' +
      'ever becomes null, generateBmmConfig learned to delete and the P4 jira row may say so.');
    assert.strictEqual(readConfigField(cfg, 'implementation_artifacts'), CANON_IMPL,
      'precondition: a jira generation always writes the canonical implementation_artifacts');

    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.PROCEED_MATCHED,
      `a FRESHLY generated jira config must not read as drift (got ${r.verdict}: ` +
      `${JSON.stringify((r.moved || []).map((m) => m.field))}). This is the false HALT.`);
  });
});

test('[behaviour] F1 a jira project whose Jira coordinates moved IS drift, and is named', () => {
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, jiraLayout());
    assert.strictEqual(runGuard(tmpDir).verdict, V.PROCEED_MATCHED,
      'precondition: a freshly generated jira config is matched');

    rebind(tmpDir, jiraLayout({
      sprintManagement: { mode: 'jira', jiraUrl: 'https://jira.elsewhere.com', jiraProjectKey: JIRA_KEY },
    }));
    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.HALT_DRIFT,
      `a Jira instance that moved is drift like any other store move (got ${r.verdict})`);
    assert.deepStrictEqual(r.moved.map((m) => m.field), ['jira_url'],
      `only the coordinate that moved may be named, got ` +
      `${JSON.stringify(r.moved.map((m) => m.field))}`);
    assert.strictEqual(r.moved[0].from, JIRA_URL);
    assert.strictEqual(r.moved[0].to, 'https://jira.elsewhere.com');
  });
});

test('[behaviour] F1 a jira binding against a file-system-generated config halts on the right fields', () => {
  withTmpDir((tmpDir) => {
    // The `git pull` that switches the team to Jira. The config is NOT
    // regenerated, so it still describes the file-system backend.
    const sp = path.join(tmpDir, 'sprints-there');
    fs.mkdirSync(sp, { recursive: true });
    boundProject(tmpDir, {
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'local', path: sp },
    });
    rebind(tmpDir, jiraLayout());

    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.HALT_DRIFT, `expected drift, got ${r.verdict}`);
    assert.deepStrictEqual(r.moved.map((m) => m.field).sort(),
      ['implementation_artifacts', 'jira_project_key', 'jira_url', 'sprint_backend'],
      'the four fields a jira generation would derive differently must all be named');
    assert.ok(!r.moved.some((m) => m.field === 'sprint_management_path'),
      'F1: `sprint_management_path` is not derived in jira mode, so a stale one is not ' +
      'reportable drift — naming it would send the user chasing a field bind cannot fix');
    assert.strictEqual(r.moved.find((m) => m.field === 'jira_url').from, null,
      'a field the old generation never wrote reports `from: null`, not a fabricated path');
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

test('[behaviour] F4 P3 stamp-absent: a READABLE binding with an unstamped config halts', () => {
  withTmpDir((tmpDir) => {
    // The one branch of the procedure that had no fixture at all: binding
    // present AND config present AND no stamp. The AC5 test below deletes the
    // binding first, so it lands in P2 and never exercises this return — which
    // is why turning it into PROCEED survived mutation. This is the P3 shape:
    // the binding is right there, and the config carries no evidence it was
    // generated from it.
    boundProject(tmpDir, SAME);
    const cfgPath = path.join(tmpDir, CONFIG_REL);
    fs.writeFileSync(cfgPath,
      fs.readFileSync(cfgPath, 'utf-8').replace(/^project_layout_stamp:.*$\n?/m, ''), 'utf-8');
    assert.ok(fs.existsSync(path.join(tmpDir, LAYOUT_REL)),
      'precondition: unlike the AC5 case, the binding is still committed');
    assert.strictEqual(cli.readProjectLayoutStamp(fs.readFileSync(cfgPath, 'utf-8')).reason,
      cli.STAMP_ABSENT, 'precondition: the stamp really is absent');

    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.HALT_STAMP_ABSENT,
      `a config that cannot say which binding it came from must HALT, not proceed on the ` +
      `strength of the field table agreeing (got ${r.verdict})`);
    assert.notStrictEqual(r.verdict, V.PROCEED_MATCHED,
      'the field table agreeing is NOT evidence of provenance — the stamp covers backend, ' +
      'space_key and gitUrl, none of which the table can see');
    assert.strictEqual(r.silent, false, 'a HALT is never silent');
  });
});

test('[behaviour] M23 a hand-edited legacy `knowledgebase_path` is drift on its own', () => {
  withTmpDir((tmpDir) => {
    // `knowledgebase_path` and `software_requirements_path` are generated from
    // the same store and are therefore always EQUAL in a generated file — which
    // made dropping the legacy field from the derivation table invisible to every
    // fixture. They can still diverge in a file a human edited or a merge
    // mangled, and the legacy field is the one 32 existing consumers read.
    boundProject(tmpDir, SAME);
    const cfgPath = path.join(tmpDir, CONFIG_REL);
    fs.writeFileSync(cfgPath, fs.readFileSync(cfgPath, 'utf-8')
      .replace(/^knowledgebase_path:.*$/m, 'knowledgebase_path: "where-it-used-to-be"'), 'utf-8');
    assert.strictEqual(readConfigField(readConfig(tmpDir), 'software_requirements_path'), '.',
      'precondition: ONLY the legacy field was disturbed');

    const r = runGuard(tmpDir);
    assert.strictEqual(r.verdict, V.HALT_DRIFT,
      `the legacy field is generated, so a disagreement in it is drift (got ${r.verdict})`);
    assert.deepStrictEqual(r.moved.map((m) => m.field), ['knowledgebase_path'],
      `only knowledgebase_path disagrees, got ${JSON.stringify(r.moved.map((m) => m.field))}`);
    assert.strictEqual(r.moved[0].from, 'where-it-used-to-be');
    assert.strictEqual(r.moved[0].to, '.');
  });
});

test('[behaviour] M17 the stamp reader enforces the lowercase-hex rule the shipped block asserts', () => {
  // The block tells the agent that a stamp which is "uppercased" is NOT one
  // ma-agents wrote. That rule belongs to Story 31.3's reader and 31.4 must not
  // change it — but nothing pinned it from the consumer side, so loosening the
  // reader to accept uppercase hex left this suite green while the shipped text
  // went on asserting the opposite. Pinned here, in the direction 31.4 needs.
  const digest = crypto.createHash('sha256').update('anything').digest('hex');
  const good = cli.readProjectLayoutStamp(`project_layout_stamp: sha256:${digest}\n`);
  assert.strictEqual(good.ok, true, `precondition: lowercase hex is accepted, got ${good.reason}`);

  const upper = cli.readProjectLayoutStamp(`project_layout_stamp: sha256:${digest.toUpperCase()}\n`);
  assert.strictEqual(upper.ok, false,
    'the block promises the agent that an uppercased stamp HALTs; if the reader accepts it, ' +
    'the shipped text is making a claim the code no longer honours');
  assert.strictEqual(upper.reason, cli.STAMP_MALFORMED,
    `uppercase hex is malformed, not absent — got ${upper.reason}`);

  const block = fs.readFileSync(
    path.join(PROJECT_ROOT, 'skills', 'close-sprint', 'SKILL.md'), 'utf-8').replace(/\r\n/g, '\n');
  assert.ok(/64 lowercase hexadecimal characters/.test(block),
    'the shipped block must state the rule this test just pinned, or the two halves of the ' +
    'claim can drift apart again');
});

test('[behaviour] M32 a non-file-system store resolves with NO path, which is why the table\'s `.` rule is exact', () => {
  withTmpDir((tmpDir) => {
    // The construction `expectedStorePath` now rests on, pinned. `storeConfigPath`
    // (bin/cli.js:901) has no backend check: it portable-ises `store.path` and
    // nothing else. The shipped table therefore states the FACT — "a store whose
    // `backend:` is not `file-system` has no `path:` at all, and so generates
    // `.`" — rather than a backend RULE the generator does not implement. That
    // phrasing is only true because the resolver never produces a
    // non-file-system store carrying a path. If a future backend ever resolves
    // with BOTH, this test fails — which is exactly when someone needs to know,
    // because at that moment the shipped table would start overstating.
    quiet(() => cli.writeProjectLayoutYaml({
      systemRequirementsStore: {
        backend: 'confluence', spaceKey: 'ENG', rootPage: { title: 'Home', id: '42' },
      },
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    }));
    const t = cli.resolveProjectTopology(tmpDir);
    assert.strictEqual(t.ok, true, `precondition: the confluence binding resolves`);
    const store = t.topology.systemRequirementsStore;
    assert.strictEqual(store.backend, 'confluence', 'precondition: the backend survived the round trip');
    assert.strictEqual(store.path, undefined,
      `a non-file-system store must resolve with no path at all, got ${JSON.stringify(store.path)}`);
    assert.strictEqual(expectedStorePath(store, tmpDir), '.',
      'and it therefore derives the local-artifacts default either way');

    // And the transcription must follow `storeConfigPath`, not invent a rule of
    // its own. Handed a store that DOES carry both a backend and a path — which
    // the resolver cannot currently produce, which is the whole point — the
    // generator would write that path, so this must expect that path. A
    // `backend !== 'file-system' → '.'` short-circuit here would expect `.`
    // instead and report drift on a config the generator had just written.
    const hypothetical = { backend: 'confluence', path: path.join(tmpDir, 'somewhere') };
    assert.strictEqual(expectedStorePath(hypothetical, tmpDir), 'somewhere',
      'the derivation must mirror `storeConfigPath` (bin/cli.js:901), which portable-ises ' +
      '`store.path` with no backend check at all — the guard must never expect a value the ' +
      'generator would not write');
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

// ─── STORY 31.9 CLOSED HALF OF THE PINNED GAP ────────────────────────────────
//
// These two tests used a BACKEND change (`file-system` → `confluence`, no path
// change) as their example of a move the field table cannot see, because
// `config.yaml` recorded `.` for a confluence store exactly as it does for the
// local default. Story 31.9 made the generated config carry
// `{system,software}_requirements_backend` and `…_space_key`, because a skill's
// Confluence gateway check has to read the backend from the RESOLVED
// configuration. That closed exactly this drift class — as the pinned test below
// said it must be handled: "If this now HALTs, the gap was closed."
//
// So the example is now `root_page`, which `config.yaml` still does not carry
// and 31.9 deliberately did not add (the gate does not need it). The gap is
// narrower, not gone, and it is still pinned rather than assumed away.
const CONFLUENCE_BASE = Object.freeze({
  systemRequirementsStore: {
    backend: 'confluence', spaceKey: 'ENG', rootPage: { title: 'Home', id: '42' },
  },
  knowledgebase: { mode: 'same', path: '.' },
  sprintManagement: { mode: 'same', path: '.' },
});
const CONFLUENCE_PAGE_MOVED = Object.freeze({
  systemRequirementsStore: {
    // SAME backend, SAME space — only the root page was renamed/re-pointed.
    backend: 'confluence', spaceKey: 'ENG', rootPage: { title: 'Engineering Home', id: '99' },
  },
  knowledgebase: { mode: 'same', path: '.' },
  sprintManagement: { mode: 'same', path: '.' },
});

test('[behaviour] AC6 the stamp, not the fields, is what catches an invisible move', () => {
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, CONFLUENCE_BASE);
    rebind(tmpDir, CONFLUENCE_PAGE_MOVED);

    const withStamp = runGuard(tmpDir, { stampVerifiable: true });
    assert.strictEqual(withStamp.verdict, V.HALT_DRIFT,
      `a root-page change is drift and the stamp must catch it (got ${withStamp.verdict})`);
    assert.strictEqual(withStamp.stampDrift, true,
      'the stamp — not the field table — is what fired here');
    assert.strictEqual(withStamp.moved.length, 0,
      'precondition for the next test: the field table genuinely sees nothing');
  });
});

test('[behaviour] KNOWN GAP, pinned: without stamp verification the field table misses it', () => {
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, CONFLUENCE_BASE);
    rebind(tmpDir, CONFLUENCE_PAGE_MOVED);

    // This is NOT an assertion that the guard is complete. It is the opposite:
    // it pins, in a test, what the guard's always-available path cannot see, so
    // the limitation is a documented fact rather than an unstated assumption. An
    // agent with no shell cannot recompute the stamp, and for this drift class it
    // will PROCEED. Story 31.10 owns the root page; if the guard is ever made
    // complete here, this test must be deleted deliberately — it will start
    // failing, which is the point.
    const noShell = runGuard(tmpDir, { stampVerifiable: false });
    assert.strictEqual(noShell.verdict, V.PROCEED_MATCHED,
      `pinning the gap: with no stamp verification this drift is invisible to the field ` +
      `table (got ${noShell.verdict}). If this now HALTs, the gap was closed — delete this test.`);
  });
});

test('[behaviour] 31.9 a BACKEND change is now caught by the field table, no shell needed', () => {
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, SAME);
    rebind(tmpDir, CONFLUENCE_BASE);

    // The half of the old gap Story 31.9 closed. A skill's Confluence gateway
    // check reads `system_requirements_backend` out of the generated config; if
    // that field could go stale unnoticed, the gate would route a
    // Confluence-backed store to the file system — the precise silent
    // degradation FR262 forbids. So it must be visible WITHOUT a shell.
    const noShell = runGuard(tmpDir, { stampVerifiable: false });
    assert.strictEqual(noShell.verdict, V.HALT_DRIFT,
      `a store re-bound to Confluence must be drift the field table alone can see ` +
      `(got ${noShell.verdict})`);
    assert.ok(noShell.moved.some((m) => m.store === 'system requirements store'),
      `the drift must NAME the system requirements store, not merely fire: ` +
      `${JSON.stringify(noShell.moved)}`);
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
  // Story 31.9 — the per-store backend and Confluence space. Binding-derived
  // like the rest, so a skill that reads one without the preflight is exactly
  // the OQ-3 hole this list exists to find: a gateway check keyed on a STALE
  // backend would route a Confluence-backed store to the file system.
  'system_requirements_backend', 'software_requirements_backend',
  'system_requirements_space_key', 'software_requirements_space_key',
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
    const stripped = body.slice(0, guardAt) + ' '.repeat(block.length) + body.slice(guardAt + block.length);
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

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4b — [text] F2: THE SHIPPED P4 TABLE IS BOUND TO THE BEHAVIOUR
//
// The review finding this section exists to close: every substantive row of the
// P4 derivation table could be deleted from all 41 shipped copies and this suite
// stayed green, 45/45, exit 0. `derivedFields` is an independent hand
// transcription, so gutting the text did not perturb it, and Section 4's
// correspondence tests bound only verdict NAMES and HALT COUNTS — never table
// semantics. That is the mechanism that let the false jira row (F1) ship.
//
// Three independent bindings are asserted below, because any one alone is
// escapable:
//   1. FIELD SETS, per sprint mode — the shipped table names exactly the fields
//      the procedure compares. Deleting a row shrinks one side; adding one grows
//      it. Checked per mode so a row cannot hide by moving between modes.
//   2. ROW SEMANTICS, against the REAL generator — for each row, a binding that
//      differs only in that row's record must change only fields that row names.
//      This is what pins WHICH store maps to WHICH field; a field moved from one
//      row to another passes (1) and fails here.
//   3. GENERATOR COVERAGE — every field `generateBmmConfig` actually writes
//      appears somewhere in the shipped table (asserted in Section 5's OQ-3
//      test, which already reads the generator's field list).
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 4b. [text] F2 — the shipped P4 table ↔ the behaviour ===\n');

const TABLE_HEADER =
  '| When | Binding record it is derived from | Field(s) it generates in `config.yaml` |';

/**
 * Parse the P4 derivation table out of the SHIPPED block. Throws — never
 * silently returns nothing — because a parser that yields an empty table on a
 * reworded heading would turn every assertion below into a vacuous pass, which
 * is the exact failure mode this section exists to remove.
 */
function parseDerivationTable(block) {
  const lines = block.split('\n');
  const at = lines.indexOf(TABLE_HEADER);
  if (at === -1) {
    throw new Error(
      'the shipped block no longer contains the P4 derivation table header this suite binds ' +
      'to. If the table was reformatted, update TABLE_HEADER deliberately — do NOT let this ' +
      'parse to nothing.');
  }
  if (!/^\|\s*-+\s*\|/.test(lines[at + 1] || '')) {
    throw new Error(`expected a markdown separator row under the table header, got ` +
      `${JSON.stringify(lines[at + 1])}`);
  }
  const rows = [];
  for (let i = at + 2; i < lines.length; i++) {
    if (!/^\|/.test(lines[i])) break;
    const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length !== 3) {
      throw new Error(`table row ${rows.length + 1} has ${cells.length} cells, expected 3: ` +
        JSON.stringify(lines[i]));
    }
    const [whenCell, sourceCell, fieldCell] = cells;
    let when;
    if (/^always$/i.test(whenCell)) when = WHEN_ALWAYS;
    else if (/`mode: jira`/.test(whenCell)) when = WHEN_JIRA;
    else if (/any other mode/.test(whenCell)) when = WHEN_OTHER;
    else throw new Error(`unrecognised When cell ${JSON.stringify(whenCell)} — this suite can ` +
      `only bind to the three declared conditions`);
    const source = (sourceCell.match(/`([a-z_]+_store|sprint_management)`/) || [])[1];
    if (!source) {
      throw new Error(`table row ${rows.length + 1} names no binding record in its middle ` +
        `cell: ${JSON.stringify(sourceCell)}`);
    }
    const fields = [...fieldCell.matchAll(/`([a-z_]+):`/g)].map((m) => m[1]);
    if (fields.length === 0) {
      throw new Error(`table row ${rows.length + 1} names no config field: ` +
        JSON.stringify(fieldCell));
    }
    rows.push({ when, source, fields });
  }
  if (rows.length === 0) throw new Error('the P4 derivation table has no rows at all');
  return rows;
}

// `<binding record> → <config field>` PAIRS, not a flat field set. The pair is
// the semantic unit: a set comparison catches a row being deleted, but a field
// silently reattributed to a different binding record keeps the set identical
// while making the drift message name the wrong store.
function tablePairsFor(rows, sprintMode) {
  const want = sprintMode === 'jira' ? WHEN_JIRA : WHEN_OTHER;
  const out = new Set();
  for (const r of rows) {
    if (r.when === WHEN_ALWAYS || r.when === want) {
      for (const f of r.fields) out.add(`${r.source} → ${f}`);
    }
  }
  return [...out].sort();
}

function codePairsFor(sprintMode, projectRoot) {
  const topology = {
    systemRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
    softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
    sprintManagement: sprintMode === 'jira'
      ? { mode: 'jira', jiraUrl: JIRA_URL, jiraProjectKey: JIRA_KEY }
      : { mode: 'same', path: '.' },
  };
  return [...new Set(derivedFields(topology, projectRoot).map((r) => `${r.source} → ${r.field}`))]
    .sort();
}

for (const mode of ['file-system', 'jira']) {
  test(`[text] F2 the shipped P4 table maps EXACTLY the record→field pairs compared in ${mode} mode`, () => {
    const rows = parseDerivationTable(extractBlock(readGuarded(GUARDED[0])));
    assert.deepStrictEqual(tablePairsFor(rows, mode), codePairsFor(mode, PROJECT_ROOT),
      `the shipped table and the executed derivation must be the SAME table in ${mode} mode, ` +
      `down to which binding record each field comes from. Deleting a row from the 41 shipped ` +
      `copies — or reattributing one field to another record, which leaves the drift message ` +
      `naming the wrong store — has to turn this red. Before this test, neither did.`);
  });
}

test('[text] F2 every shipped row is one this suite knows how to exercise', () => {
  const rows = parseDerivationTable(extractBlock(readGuarded(GUARDED[0])));
  assert.deepStrictEqual(
    rows.map((r) => `${r.when}/${r.source}`).sort(),
    ['always/software_requirements_store', 'always/system_requirements_store',
      'jira/sprint_management', 'other/sprint_management'].sort(),
    'a row added to, removed from, or re-sourced in the shipped table must be reflected in ' +
    'ROW_SEMANTICS_CASES below — otherwise the semantics test silently stops covering it');
});

// For each shipped row: a pair of bindings differing ONLY in that row's binding
// record, run through the REAL generator. Whatever the generator changes between
// the two configs must be named by that row and by no other.
const ROW_SEMANTICS_CASES = [
  {
    row: 'always/software_requirements_store',
    base: (t) => ({
      systemRequirementsStore: { mode: 'same', path: '.' },
      softwareRequirementsStore: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    }),
    next: (t) => ({
      systemRequirementsStore: { mode: 'same', path: '.' },
      softwareRequirementsStore: { mode: 'local', path: path.join(t, 'soft-moved') },
      sprintManagement: { mode: 'same', path: '.' },
    }),
  },
  {
    row: 'always/system_requirements_store',
    base: (t) => ({
      systemRequirementsStore: { mode: 'same', path: '.' },
      softwareRequirementsStore: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    }),
    next: (t) => ({
      systemRequirementsStore: { mode: 'local', path: path.join(t, 'sys-moved') },
      softwareRequirementsStore: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' },
    }),
  },
  {
    row: 'other/sprint_management',
    base: (t) => ({ knowledgebase: { mode: 'same', path: '.' }, sprintManagement: { mode: 'same', path: '.' } }),
    next: (t) => ({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'local', path: path.join(t, 'sprints-moved') },
    }),
  },
  {
    // The file-system → jira transition. It exercises `sprint_backend`, both Jira
    // coordinates AND `implementation_artifacts` in one move, and is also the
    // shape that produces the surviving `sprint_management_path` of F1 — which
    // must NOT show up as a change, because the generator does not rewrite it.
    row: 'jira/sprint_management',
    base: (t) => ({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'local', path: path.join(t, 'sprints-moved') },
    }),
    next: () => jiraLayout(),
  },
];

test('[text] F2 each shipped row derives EXACTLY its own fields, measured on the real generator', () => {
  const rows = parseDerivationTable(extractBlock(readGuarded(GUARDED[0])));
  const allFields = [...new Set(rows.reduce((a, r) => a.concat(r.fields), []))];
  let exercised = 0;

  for (const kase of ROW_SEMANTICS_CASES) {
    const row = rows.find((r) => `${r.when}/${r.source}` === kase.row);
    assert.ok(row, `no shipped row matches ${kase.row}`);
    withTmpDir((tmpDir) => {
      for (const dir of ['soft-moved', 'sys-moved', 'sprints-moved']) {
        fs.mkdirSync(path.join(tmpDir, dir), { recursive: true });
      }
      boundProject(tmpDir, kase.base(tmpDir));
      const before = allFields.map((f) => readConfigField(readConfig(tmpDir), f));
      rebind(tmpDir, kase.next(tmpDir));
      regenerate(tmpDir);
      const after = allFields.map((f) => readConfigField(readConfig(tmpDir), f));

      const changed = allFields.filter((f, i) => before[i] !== after[i]).sort();
      assert.ok(changed.length > 0,
        `${kase.row}: the fixture changed this row's binding record but the generator wrote ` +
        `no different field — the case has gone stale and proves nothing`);
      const strays = changed.filter((f) => !row.fields.includes(f));
      assert.deepStrictEqual(strays, [],
        `${kase.row}: changing ONLY this row's binding record changed ${JSON.stringify(strays)}, ` +
        `which the shipped row does not name. The table would be telling an agent to look for ` +
        `drift in the wrong place — this is the "which store maps to which field" semantics, ` +
        `and it is what a row-count test cannot see.`);
      exercised += changed.length;
    });
  }
  assert.ok(exercised >= 8,
    `this test must actually observe generated fields changing; it saw ${exercised}`);
});

// ─── F3 — AC5's discriminator, pinned in the SHIPPED TEXT ────────────────────

function blockStep(block, step) {
  const start = block.indexOf(`### Step ${step} `);
  assert.notStrictEqual(start, -1, `the shipped block has no Step ${step}`);
  const rest = block.slice(start);
  const end = rest.indexOf('\n### ', 1);
  return end === -1 ? rest : rest.slice(0, end);
}

test('[text] F3/AC5 the shipped P2 discriminator names EXACTLY the three F26 marker fields', () => {
  const p2 = blockStep(extractBlock(readGuarded(GUARDED[0])), 'P2');
  // Every config field named in a P2 branch CONDITION (the bolded lead of a
  // bullet). Narrowing the discriminator to `project_layout_stamp:` alone —
  // reintroducing 31.3's review nit — shrinks this set and turns it red.
  const conditions = p2.split('\n').filter((l) => /^- \*\*/.test(l));
  assert.ok(conditions.length >= 3, `expected three P2 branches, found ${conditions.length}`);
  const named = new Set();
  for (const line of conditions) {
    for (const m of line.matchAll(/`([a-z_]+):`/g)) named.add(m[1]);
  }
  assert.deepStrictEqual([...named].sort(), [...F26_MARKER_FIELDS].sort(),
    'AC5 leans on all three fields: a config that lost only its stamp is still betrayed by ' +
    'the two per-store fields. The shipped text must name the same three the procedure does.');
  // Both P2 branches, not only the permissive one: `runGuard` tests each marker
  // with `^field:` under the `m` flag, so a commented-out or indented marker is
  // not a marker on EITHER side of the discriminator.
  const halting = conditions.find((l) => /any of/.test(l));
  assert.ok(halting, 'the P2 halting branch must still enumerate the markers');
  assert.ok(/at column 0/.test(halting),
    `the halting branch must be column-0-qualified the way P3's stamp check is — a ` +
    `\`# system_requirements_path:\` in a comment must not make a pre-F26 project HALT. ` +
    `Read: ${JSON.stringify(halting.trim())}`);
});

test('[text] F3/AC5 the shipped permissive branch is conditioned on ALL THREE being absent', () => {
  const p2 = blockStep(extractBlock(readGuarded(GUARDED[0])), 'P2');
  const bullet = p2.split('\n').find((l) => l.includes('this is genuinely a pre-F26 project'));
  assert.ok(bullet, 'the shipped block must still carry the one permissive branch');
  const condition = bullet.slice(0, bullet.indexOf('→'));
  assert.ok(condition.length > 0, 'the permissive branch must state a condition before its verdict');
  assert.ok(/none of those three fields/.test(condition),
    `AC5's ONLY permissive branch must require that all three markers are absent. Widening it ` +
    `to "\`config.yaml\` exists" waves through any stampless config — the precise regression ` +
    `31.3's review nit was raised about. Condition read: ${JSON.stringify(condition.trim())}`);
  assert.ok(/at column 0/.test(condition),
    'and the absence must be an absence of FIELDS, not of substrings — a commented-out or ' +
    'indented marker is not the field');
  assert.ok(/The existence of `config.yaml` is NOT on its own a reason to take this branch/
    .test(p2),
    'the shipped text must rule out the widened reading explicitly, not merely fail to state it');
});

// ─── F5 — the mtime POLICY, not one sentence ────────────────────────────────

test('[text] F5/AC6 no sentence in the block instructs the agent to use timestamps', () => {
  const block = extractBlock(readGuarded(GUARDED[0]));
  // Deleting the mtime prohibition is already caught. This catches the opposite
  // and worse edit: ADDING a directly contradictory mtime instruction while the
  // prohibition still stands. Every sentence that mentions time-ordering must be
  // ruling it OUT.
  const TIME_WORDS = /(modification times?|\bmtime\b|timestamps?|newer than|older than)/i;
  const NEGATED = /\b(never|not|no|nothing|cannot|misses|instead of)\b/i;
  const sentences = block
    .split('\n')
    .filter((l) => !/^\s*(```|node -e)/.test(l))
    .reduce((acc, line) => acc.concat(line.split(/(?<=[.:])\s+(?=[A-Z*`(])/)), [])
    .map((s) => s.trim())
    .filter(Boolean);

  const mentions = sentences.filter((s) => TIME_WORDS.test(s));
  assert.ok(mentions.length >= 2,
    `AC6 must be stated more than once — in the prologue and in Step P4 — so removing one ` +
    `sentence cannot remove the policy; found ${mentions.length}`);
  const affirmative = mentions.filter((s) => !NEGATED.test(s));
  assert.deepStrictEqual(affirmative, [],
    `these shipped sentences mention time-ordering WITHOUT ruling it out, so an agent reading ` +
    `the block could take a timestamp comparison as instructed: ${JSON.stringify(affirmative)}`);
  assert.ok(/This is a content comparison of the two files/.test(block),
    'and Step P4 must still say positively what the comparison IS');
});

// ─── F6 — three text/code divergences ───────────────────────────────────────

test('[text] F6 P1 default-denies: its fault list is illustrative, not the whole rule', () => {
  const p1 = blockStep(extractBlock(readGuarded(GUARDED[0])), 'P1');
  // `runGuard` refuses every resolver reason that is not UNBOUND (default-deny),
  // so the CODE is stricter than the enumerated list the text used to ship. An
  // agent reading that list literally would route a non-numeric `schema_version`
  // or a malformed store record to "present and readable → P3".
  assert.ok(/illustrative, not exhaustive/.test(p1),
    'P1 must say its fault list is not the rule, or a fault outside the list reads as readable');
  assert.ok(/\*\*Default-deny:\*\*/.test(p1),
    'P1 must name the policy the procedure implements, in the shipped text');
  assert.ok(/is not a number/.test(p1),
    'a non-numeric `schema_version:` is BINDING_INVALID in bin/cli.js and must not read as fine');
  assert.ok(/does not recognise/.test(p1),
    'an unrecognised `backend:`/`mode:` is BINDING_INVALID too');
  assert.ok(/Anything else takes this HALT/.test(p1),
    'and the closing rule must be the default-deny one, stated as a rule');
  // Bound to the code side: three refuse-reasons exist beyond UNBOUND today, and
  // the text is written so a FOURTH needs no edit. That is the property under test.
  const refuseReasons = Object.keys(cli).filter((k) => /^BINDING_/.test(k) && k !== 'BINDING_UNBOUND');
  assert.ok(refuseReasons.length >= 3,
    `expected the resolver's refuse reasons to be exported; found ${refuseReasons.length}`);
});

test('[text] F6 the block reads fields at column 0 and compares values, not bytes', () => {
  const block = extractBlock(readGuarded(GUARDED[0]));
  const p4 = blockStep(block, 'P4');
  assert.ok(/Read each field only from a line at column 0/.test(p4),
    'P4 must qualify its reads the way P3 qualifies the stamp — `readConfigField` uses ' +
    '`^field:` under the `m` flag, and a substring match would find a commented-out field');
  assert.ok(/strip one balanced pair of surrounding quotes/.test(p4),
    'the generator quotes its scalars, so a byte comparison of the raw line would report ' +
    'drift on every field of a freshly generated config');
  // And the quoted form the table shows must be the form the generator writes.
  assert.ok(/`sprint_backend: "jira"`/.test(p4),
    'the shipped example must show the QUOTED form; `sprint_backend: jira` is not what the ' +
    'generator emits, and a literal-minded agent would compare against the wrong string');
  assert.ok(/The table below IS the whole comparison/.test(p4),
    'the table has to be stated as CLOSED — "every field named is compared, and no field ' +
    'outside it is" — or a reader is free to add a comparison of their own');
  // F1, in the shipped text. The table already omits `sprint_management_path`
  // from the jira row, but only this paragraph says WHY — that the generator
  // never deletes a field — and it is the reason the false clause cannot simply
  // be reinstated by the next person who notices the field lying there.
  assert.ok(/`sprint_management_path:` is not compared at all/.test(p4),
    'P4 must say out loud that `sprint_management_path:` is not compared in jira mode');
  assert.ok(/it never DELETES a field, it only updates or appends one/.test(p4),
    'and it must give the reason (`writeConfigField` updates-or-appends), or the false ' +
    '"and no `sprint_management_path:`" claim gets written back in the next time someone ' +
    'sees a stale one survive a jira re-bind');
  withTmpDir((tmpDir) => {
    boundProject(tmpDir, jiraLayout());
    const line = readConfig(tmpDir).split(/\r?\n/).find((l) => /^sprint_backend:/.test(l));
    assert.strictEqual(line, 'sprint_backend: "jira"',
      `the generator's actual output must match the form the block shows, got ${JSON.stringify(line)}`);
  });
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
  // F2, third binding: the generator's OWN field list, against the SHIPPED
  // table. This closes the loop from the direction the other two do not — it
  // needs no fixture and no transcription, so a row deleted from the 41 copies
  // fails here even if `derivedFields` were mutated to match.
  const tableFields = new Set(
    parseDerivationTable(extractBlock(readGuarded(GUARDED[0])))
      .reduce((a, r) => a.concat(r.fields), []));
  for (const f of writes) {
    if (f === 'project_layout_stamp') continue;
    assert.ok(tableFields.has(f),
      `generateBmmConfig writes ${f} from the committed binding, but the shipped P4 table does ` +
      `not name it — an agent following the block would never compare it, so that field can ` +
      `go stale in silence`);
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
