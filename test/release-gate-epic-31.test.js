#!/usr/bin/env node
/**
 * Story 31.14 — the Epic 31 release gate.
 *
 * This suite is the executable half of the gate. It covers AC2 (backward
 * compatibility), AC3 (determinism), AC4 (no credentials on disk), AC5
 * (fail-loud paths, asserting message CONTENT), AC6 (global resolution) and
 * AC7 (the FR266 negative). AC1 (air-gap) is a CI workflow and AC9 is a run
 * result; neither can live here. The traceability matrix and the honest record
 * of what could NOT be verified live in
 * `_bmad-output/implementation-artifacts/31-14-release-gate.md`.
 *
 * ─── HOW THESE ASSERTIONS ARE BUILT, AND WHY ────────────────────────────────
 *
 * Epic 31's independent reviews found six recurring defect shapes: a permissive
 * default; a test proving presence rather than effect; a test validating a
 * transcription rather than the artifact; a TAUTOLOGICAL test whose expectation
 * derives from the same source as the code (six instances); a denylist where a
 * closed set was needed; and success reported over a failed write.
 *
 * AC2, AC3, AC4 and AC7 are all negatives or byte-comparisons. A negative
 * asserted as "X was not called" is worthless — it passes when the call moves,
 * is renamed, or happens through another path. So every negative here is proved
 * one of two ways and no other:
 *
 *   (a) BY ENUMERATION AGAINST A CLOSED SET. Walk the entire tree, list every
 *       path that exists, and compare that LIST to an expected list. A file
 *       written by a route nobody anticipated shows up as an unexpected member,
 *       which is exactly what a denylist misses.
 *   (b) BY BYTE IDENTITY. Snapshot every file's bytes before, snapshot after,
 *       and diff the maps. A mutation anywhere in the tree is caught, not only
 *       in the files the test thought to name.
 *
 * ANTI-TAUTOLOGY. Wherever an expectation could be derived from the same source
 * as the code under test, it is instead stated literally in this file, or read
 * from an OUTSIDE authority — the PRD text, the shipped instruction bytes, or
 * js-yaml (a real parser, and a declared direct dependency). Where a constant IS
 * imported from cli.js, it is imported because the point of the test is that two
 * shipped consumers agree, and the comment says so.
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const errors = [];

// ─── The process-level backstop, REGISTERED FIRST ────────────────────────────
//
// Same reasoning as the other project-layout suites: a file that can exit 0
// without printing its summary loses every assertion it already made, and an
// `&&`-chained runner keys on the exit code alone. cli.js contains
// `process.exit(0)` on wizard-cancel paths, and this suite loads cli.js.
let summaryPrinted = false;
process.on('exit', (code) => {
  if (summaryPrinted) return;
  console.error(
    `\n  FATAL: release-gate suite exited with code ${code} WITHOUT printing its summary, ` +
    `so its ${passed + failed} completed test(s) were never reported. Forcing non-zero ` +
    `so this cannot read as a pass.`
  );
  process.exitCode = code === 0 ? 1 : code;
});

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

const yaml = require('js-yaml');
const cli = require('../bin/cli.js');

/**
 * Byte-exact snapshot of every file under `root`, as `relPath -> sha256`.
 * The AC2 / AC4 / AC7 oracle. Deliberately hashes CONTENT, not just names: a
 * route that rewrites an existing file in place changes no name at all.
 */
function snapshotTree(root) {
  const out = {};
  const walk = (dir, rel) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(abs, r);
      else out[r] = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
    }
  };
  walk(root, '');
  return out;
}

function withTmpProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-relgate-'));
  const realDir = fs.realpathSync(dir);
  const cwd = process.cwd();
  try {
    process.chdir(realDir);
    return fn(realDir);
  } finally {
    process.chdir(cwd);
    try { fs.rmSync(realDir, { recursive: true, force: true }); } catch (_) { /* best effort */ }
  }
}

/** Silence cli.js's console output for the duration of `fn`, returning what it said. */
function capture(fn) {
  const lines = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a) => lines.push(a.join(' '));
  console.error = (...a) => lines.push(a.join(' '));
  try { fn(); } finally { console.log = origLog; console.error = origErr; }
  // eslint-disable-next-line no-control-regex
  return lines.join('\n').replace(/\u001b\[[0-9;]*m/g, '');
}

const FS_SAME = { backend: 'file-system', mode: 'same', path: '.' };
const SPRINT_SAME = { mode: 'same', path: '.' };

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1 — AC2. Backward compatibility (NFR76, NFR82).
//
// The AC, as corrected 2026-08-03: a pre-F26 fixture and a default-answers
// fixture must both install to a result identical to the POST-31.2 BASELINE —
// the pre-epic tree PLUS a written `_bmad-output/project-layout.yaml`, and
// NOTHING ELSE. Plus: resolved artifact paths unchanged for a project that
// configures no second store.
//
// LIMIT, STATED UP FRONT. These tests drive the F26 write path
// (`writeProjectLayoutYaml` + `generateBmmConfig`) over a fixture tree, not a
// full `ma-agents install`. A full install is deliberately NOT run here: it
// spawns bmad-method, takes minutes, and — as
// `project-layout-two-store-round-trip` demonstrated during this gate — can
// hang the chain. The end-to-end install proof is AC1's offline harness, which
// runs the REAL installer under `--network none` in CI. What these tests prove
// is the narrower and still load-bearing claim: the F26 additions add exactly
// one file to a project tree and change nothing else in it.
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n=== SECTION 1 — AC2: backward compatibility (NFR76, NFR82) ===\n');

/**
 * A "pre-F26" project: some committed artifacts, a `_bmad/bmm/config.yaml`
 * carrying ONLY the pre-F26 fields, and no `project-layout.yaml`.
 *
 * The field list is stated LITERALLY here rather than derived from cli.js. That
 * is deliberate: if it were derived, a generator that stopped emitting a legacy
 * field would change the fixture and the assertion together, and the test would
 * still pass. It is the pre-epic shape, and the pre-epic shape is a historical
 * fact, not a function of the current code.
 */
const PRE_F26_CONFIG =
  'project_name: "demo"\n' +
  'output_folder: "{project-root}/_bmad-output"\n' +
  'planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"\n' +
  'implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"\n' +
  'knowledgebase_path: "."\n' +
  'sprint_management_path: "."\n' +
  'sprint_backend: "file-system"\n';

function seedPreF26Project(root) {
  fs.mkdirSync(path.join(root, '_bmad', 'bmm'), { recursive: true });
  fs.mkdirSync(path.join(root, '_bmad-output', 'planning-artifacts'), { recursive: true });
  fs.mkdirSync(path.join(root, '_bmad-output', 'implementation-artifacts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, '_bmad', 'bmm', 'config.yaml'), PRE_F26_CONFIG);
  fs.writeFileSync(path.join(root, '_bmad-output', 'planning-artifacts', 'prd.md'), '# PRD\n');
  fs.writeFileSync(path.join(root, '_bmad-output', 'planning-artifacts', 'epics.md'), '# Epics\n');
  fs.writeFileSync(path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml'),
    'tracking_system: file-system\n');
  fs.writeFileSync(path.join(root, 'src', 'index.js'), 'module.exports = 1;\n');
  fs.writeFileSync(path.join(root, 'package.json'), '{ "name": "demo", "version": "0.0.1" }\n');
}

test('AC2.1 a pre-F26 project gains EXACTLY one path — project-layout.yaml — and nothing else changes', () => {
  withTmpProject((root) => {
    seedPreF26Project(root);
    const before = snapshotTree(root);

    capture(() => cli.writeProjectLayoutYaml({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: SPRINT_SAME,
    }));

    const after = snapshotTree(root);

    // (a) BY ENUMERATION: the added set is a closed set of exactly one member.
    const added = Object.keys(after).filter((k) => !(k in before)).sort();
    assert.deepStrictEqual(
      added,
      ['_bmad-output/project-layout.yaml'],
      `the post-31.2 baseline is "the pre-epic tree plus project-layout.yaml, and nothing ` +
      `else". Unexpected additions: ${JSON.stringify(added)}`
    );

    // (b) BY BYTE IDENTITY: nothing that existed before was touched, and nothing
    // was removed. Both halves asserted separately so a delete cannot pass as a
    // "no modification".
    const removed = Object.keys(before).filter((k) => !(k in after)).sort();
    assert.deepStrictEqual(removed, [], `nothing may be removed; removed: ${JSON.stringify(removed)}`);
    const modified = Object.keys(before).filter((k) => before[k] !== after[k]).sort();
    assert.deepStrictEqual(
      modified, [],
      `every pre-existing file must be byte-identical; modified: ${JSON.stringify(modified)}`
    );
  });
});

test('AC2.2 a DEFAULT-ANSWERS project (empty tree) gains exactly project-layout.yaml under _bmad-output/', () => {
  withTmpProject((root) => {
    const before = snapshotTree(root);
    assert.deepStrictEqual(Object.keys(before), [], 'the fixture must start genuinely empty');

    capture(() => cli.writeProjectLayoutYaml({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: SPRINT_SAME,
    }));

    const after = Object.keys(snapshotTree(root)).sort();
    assert.deepStrictEqual(
      after,
      ['_bmad-output/project-layout.yaml'],
      `default answers must produce exactly one file. Got: ${JSON.stringify(after)}`
    );
  });
});

test('AC2.3 resolved artifact paths are UNCHANGED for a project configuring no second store', () => {
  withTmpProject((root) => {
    seedPreF26Project(root);
    capture(() => cli.writeProjectLayoutYaml({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: SPRINT_SAME,
    }));
    const ok = capture(() => cli.generateBmmConfig({ projectRoot: root }));
    void ok;

    const generated = fs.readFileSync(path.join(root, '_bmad', 'bmm', 'config.yaml'), 'utf-8');
    const doc = yaml.load(generated); // outside authority: a real parser

    // The four legacy resolution fields, with their PRE-EPIC values stated
    // literally. FR264: "the legacy fields are retained and resolve to the
    // software requirements store, so every existing reference keeps working
    // unchanged." NFR82: "no change to resolved artifact paths."
    const expected = {
      planning_artifacts: '{project-root}/_bmad-output/planning-artifacts',
      implementation_artifacts: '{project-root}/_bmad-output/implementation-artifacts',
      knowledgebase_path: '.',
      sprint_management_path: '.',
    };
    for (const [field, want] of Object.entries(expected)) {
      assert.strictEqual(
        String(doc[field]), want,
        `NFR82: ${field} must resolve exactly as it did pre-F26 (wanted ${want}, got ${doc[field]})`
      );
    }
  });
});

test('AC2.4 a single-store project sees BOTH new per-store fields resolve to the same location (FR265)', () => {
  withTmpProject((root) => {
    seedPreF26Project(root);
    capture(() => cli.writeProjectLayoutYaml({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: SPRINT_SAME,
    }));
    capture(() => cli.generateBmmConfig({ projectRoot: root }));
    const doc = yaml.load(fs.readFileSync(path.join(root, '_bmad', 'bmm', 'config.yaml'), 'utf-8'));
    assert.strictEqual(String(doc.system_requirements_path), '.', 'FR265: system store reads the one location');
    assert.strictEqual(String(doc.software_requirements_path), '.', 'FR265: software store reads the one location');
    assert.strictEqual(String(doc.knowledgebase_path), '.', 'FR264: the legacy field still resolves');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2 — AC3. Determinism (NFR81).
//
// "The same answers produce a byte-identical project-layout.yaml AND a
// byte-identical generated config.yaml across Linux and Windows; CRLF/LF inputs
// do not change output."
//
// LIMIT, STATED UP FRONT — and this one is a real finding, not a caveat.
// `writeProjectLayoutYaml` stamps `generated: "<YYYY-MM-DD>"` from the wall
// clock (bin/cli.js:2626). Two runs of the same answers are therefore byte-
// identical only while they fall on the same calendar day. cli.js already knows
// this (see the comment at bin/cli.js:4914, which is why `bind` declines to
// rewrite on a no-edit re-run). NFR81 says "the same answers produce an
// identical file"; the date is not an answer. These tests therefore assert
// byte-identity of every line EXCEPT `generated:`, and assert separately that
// `generated:` is the ONLY line that can vary and that its format is
// date-only — so the residual nondeterminism is bounded, named and one line
// wide, rather than assumed away.
//
// The cross-PLATFORM half cannot be executed from a single OS. What is
// executable here — and what actually carries the platform risk — is that the
// emitted bytes contain no platform-dependent construct: no `\r`, no `os.EOL`,
// no backslash separators, and identical output from `\` and `/` inputs. The
// second half of the cross-platform claim is the AC9 run on both platforms.
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n=== SECTION 2 — AC3: determinism (NFR81) ===\n');

function stripGenerated(text) {
  return text.split('\n').filter((l) => !/^generated:/.test(l)).join('\n');
}

test('AC3.1 the same answers produce byte-identical project-layout.yaml (modulo the dated line)', () => {
  const answers = {
    systemRequirementsStore: { backend: 'confluence', spaceKey: 'SYS', rootPage: { title: 'Sys Reqs', id: null } },
    softwareRequirementsStore: { backend: 'file-system', mode: 'same', path: '.' },
    sprintManagement: SPRINT_SAME,
  };
  const render = () => withTmpProject((root) => {
    capture(() => cli.writeProjectLayoutYaml(answers));
    return fs.readFileSync(path.join(root, '_bmad-output', 'project-layout.yaml'), 'utf-8');
  });
  const a = render();
  const b = render();
  assert.strictEqual(stripGenerated(a), stripGenerated(b),
    'NFR81: identical answers must produce identical bytes');
});

test('AC3.2 `generated:` is the ONLY line that may vary, and it is date-only — across FOUR answer shapes', () => {
  // Proving the bound matters more than proving the equality: if a SECOND
  // nondeterministic line were added, AC3.1 above would still pass because it
  // strips only `generated:`. This test closes that.
  //
  // Story 31.14 fix round, FIX-4. This previously ran ONE answer shape — a
  // single-store `mode: 'same'` binding — while the record stated the bound as
  // though it were general. A two-store or Confluence binding emits lines this
  // shape never produces (`space_key:`, `root_page:`, a second store block, a
  // divergent `path:`), and a nondeterministic line in ANY of those would have
  // gone unseen. The claim is now as general as the record states it, because
  // the test is: every shape the wizard can answer is rendered twice and
  // required to agree line for line.
  const SHAPES = {
    'single-store, mode: same (the legacy shape)': {
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: SPRINT_SAME,
    },
    'two DIVERGENT file-system stores (FR257\'s motivating case)': {
      systemRequirementsStore: { backend: 'file-system', mode: 'local', path: 'sysreq' },
      softwareRequirementsStore: { backend: 'file-system', mode: 'local', path: 'swreq' },
      sprintManagement: SPRINT_SAME,
    },
    // Inlined rather than reusing `CONFLUENCE_ANSWERS` below: `test()` runs its
    // body immediately, and that constant is declared further down the file, so
    // referencing it here would hit the temporal dead zone.
    'both stores Confluence-backed': {
      systemRequirementsStore: {
        backend: 'confluence', spaceKey: 'SYSREQ', rootPage: { title: 'System Requirements', id: null },
      },
      softwareRequirementsStore: {
        backend: 'confluence', spaceKey: 'SWREQ', rootPage: { title: 'Software Requirements', id: null },
      },
      sprintManagement: SPRINT_SAME,
    },
    'MIXED — system in Confluence, software on the file system': {
      systemRequirementsStore: {
        backend: 'confluence', spaceKey: 'SYSREQ', rootPage: { title: 'System Requirements', id: null },
      },
      softwareRequirementsStore: { backend: 'file-system', mode: 'local', path: 'swreq' },
      sprintManagement: SPRINT_SAME,
    },
  };

  for (const [label, answers] of Object.entries(SHAPES)) {
    const render = () => withTmpProject((root) => {
      capture(() => cli.writeProjectLayoutYaml(answers));
      return fs.readFileSync(path.join(root, '_bmad-output', 'project-layout.yaml'), 'utf-8');
    });
    const a = render().split('\n');
    const b = render().split('\n');
    assert.strictEqual(a.length, b.length, `${label}: the two renders must have the same line count`);
    const differing = a
      .map((l, i) => (l === b[i] ? null : `${i}: ${JSON.stringify(l)} vs ${JSON.stringify(b[i])}`))
      .filter(Boolean);
    assert.deepStrictEqual(differing, [],
      `${label}: within one run of this suite even \`generated:\` must agree`);

    const genLine = a.find((l) => /^generated:/.test(l));
    assert.ok(genLine,
      `${label}: the file must carry a \`generated:\` line (this test bounds it, it does not remove it)`);
    assert.match(
      genLine, /^generated: "\d{4}-\d{2}-\d{2}"$/,
      `${label}: the residual nondeterminism must be DATE-ONLY — a time or a timestamp would make ` +
      `byte-identity impossible within a day, not merely across one. Got: ${genLine}`
    );
    // And the shape must genuinely be the shape it claims to be, or the
    // extension is decoration: each non-legacy shape must emit lines the
    // single-store shape does not.
    if (label.includes('Confluence')) {
      assert.ok(a.some((l) => /space_key:/.test(l)),
        `${label}: this shape must actually emit a confluence record, or it proves nothing`);
    }
  }
});

test('AC3.3 the emitted binding contains no platform-dependent bytes (LF only, no backslash separators)', () => {
  withTmpProject((root) => {
    capture(() => cli.writeProjectLayoutYaml({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: SPRINT_SAME,
    }));
    const raw = fs.readFileSync(path.join(root, '_bmad-output', 'project-layout.yaml'), 'utf-8');
    assert.ok(!raw.includes('\r'), 'no CR: the file must be LF-only regardless of host OS');
    // A Windows-produced file that embedded `C:\...` would not be readable by a
    // Linux teammate — and this file is COMMITTED, so that is the whole point.
    const pathLines = raw.split('\n').filter((l) => /^\s+(path|gitUrl):/.test(l));
    for (const l of pathLines) {
      assert.ok(!/\\/.test(l), `a committed binding must not carry backslash separators: ${l}`);
    }
  });
});

test('AC3.4 CRLF vs LF in the EXISTING binding does not change the regenerated output', () => {
  const answers = { knowledgebase: { mode: 'same', path: '.' }, sprintManagement: SPRINT_SAME };
  const render = (eol) => withTmpProject((root) => {
    // Seed a pre-existing binding in the given line-ending style, then rewrite.
    capture(() => cli.writeProjectLayoutYaml(answers));
    const p = path.join(root, '_bmad-output', 'project-layout.yaml');
    const seeded = fs.readFileSync(p, 'utf-8').replace(/\r?\n/g, eol);
    fs.writeFileSync(p, seeded);
    capture(() => cli.writeProjectLayoutYaml(answers));
    return fs.readFileSync(p, 'utf-8');
  });
  assert.strictEqual(
    stripGenerated(render('\n')), stripGenerated(render('\r\n')),
    'NFR81: a CRLF-checked-out binding must regenerate to the same bytes as an LF one'
  );
});

test('AC3.5 the generated config.yaml is byte-identical for identical answers, CRLF input included', () => {
  const build = (eol) => withTmpProject((root) => {
    seedPreF26Project(root);
    const cfg = path.join(root, '_bmad', 'bmm', 'config.yaml');
    fs.writeFileSync(cfg, PRE_F26_CONFIG.replace(/\n/g, eol));
    capture(() => cli.writeProjectLayoutYaml({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: SPRINT_SAME,
    }));
    capture(() => cli.generateBmmConfig({ projectRoot: root }));
    return fs.readFileSync(cfg, 'utf-8');
  });
  const lf = build('\n');
  const crlf = build('\r\n');
  assert.strictEqual(
    lf.replace(/\r\n/g, '\n'), crlf.replace(/\r\n/g, '\n'),
    'NFR81: the generated config must not depend on the line-ending style of the file it updates'
  );
  // And the same answers twice must be byte-for-byte equal, stamp included: the
  // stamp is a digest of the binding, so it is deterministic where the date is not.
  assert.strictEqual(build('\n'), lf, 'two identical generations must be byte-identical');
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3 — AC4. No credentials on disk (NFR79).
//
// "A scan of EVERY ma-agents-written artifact after a Confluence-configured
// install finds no credential-shaped value; project-layout.yaml carries only
// the space key and root-page identity."
//
// Done by enumeration in both directions:
//   - the set of FILES written is enumerated and compared to a closed set;
//   - the set of KEYS inside the confluence record is enumerated and compared
//     to a closed set stated literally here (NOT derived from the serializer,
//     which would be the tautology);
//   - every byte of every written file is scanned for credential shapes.
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n=== SECTION 3 — AC4: no credentials on disk (NFR79) ===\n');

/**
 * Credential shapes. A DENYLIST is the wrong instrument for "is this a secret",
 * so it is not the only instrument used: the key-set enumeration below is the
 * closed-set half, and this is the corroborating sweep. Stated literally.
 */
const CREDENTIAL_PATTERNS = [
  [/\b(password|passwd|pwd)\b\s*[:=]/i, 'a password field'],
  [/\b(token|api[_-]?key|apikey|secret|credential)\b\s*[:=]/i, 'a token/secret field'],
  [/\bbearer\s+[A-Za-z0-9._~+/-]{16,}/i, 'a bearer token'],
  [/\bBasic\s+[A-Za-z0-9+/]{16,}={0,2}/, 'an HTTP Basic blob'],
  [/\bATATT[A-Za-z0-9._-]{10,}/, 'an Atlassian API token (ATATT prefix)'],
  [/https?:\/\/[^\s/@"']+:[^\s/@"']+@/, 'a URL carrying inline userinfo'],
  [/\bcookie\b\s*[:=]/i, 'a cookie'],
  [/\bauthorization\b\s*[:=]/i, 'an Authorization header'],
];

test('AC4.0 [harness] the credential sweep actually DETECTS a planted credential', () => {
  // Without this, "no credential found" is indistinguishable from "the scanner
  // is broken". This is the control.
  const poison = [
    'api_token: ATATT3xFfGF0abcdefghij',
    'password: hunter2',
    'url: https://user:pw@confluence.example.com',
    'Authorization: Bearer abcdefghijklmnopqrstuvwxyz',
  ];
  for (const line of poison) {
    const hit = CREDENTIAL_PATTERNS.some(([re]) => re.test(line));
    assert.ok(hit, `the sweep must flag: ${line}`);
  }
});

const CONFLUENCE_ANSWERS = {
  systemRequirementsStore: {
    backend: 'confluence', spaceKey: 'SYSREQ', rootPage: { title: 'System Requirements', id: null },
  },
  softwareRequirementsStore: {
    backend: 'confluence', spaceKey: 'SWREQ', rootPage: { title: 'Software Requirements', id: null },
  },
  sprintManagement: SPRINT_SAME,
};

test('AC4.1 a Confluence-configured binding writes a CLOSED SET of files — nothing else appears', () => {
  withTmpProject((root) => {
    seedPreF26Project(root);
    const before = snapshotTree(root);
    capture(() => cli.writeProjectLayoutYaml(CONFLUENCE_ANSWERS));
    capture(() => cli.generateBmmConfig({ projectRoot: root }));
    const after = snapshotTree(root);

    const added = Object.keys(after).filter((k) => !(k in before)).sort();
    assert.deepStrictEqual(
      added, ['_bmad-output/project-layout.yaml'],
      `configuring Confluence must add exactly the binding. A dotfile cache, a ` +
      `\`.confluence-auth\`, or an exported page body would show up here. Got: ${JSON.stringify(added)}`
    );
    const modified = Object.keys(before).filter((k) => before[k] !== after[k]).sort();
    assert.deepStrictEqual(
      modified, ['_bmad/bmm/config.yaml'],
      `only the generated config may change. Got: ${JSON.stringify(modified)}`
    );
  });
});

test('AC4.2 EVERY ma-agents-written byte is credential-free after a Confluence configuration', () => {
  withTmpProject((root) => {
    capture(() => cli.writeProjectLayoutYaml(CONFLUENCE_ANSWERS));
    capture(() => cli.generateBmmConfig({ projectRoot: root, fallbackLayout: null }));
    // Enumerate every file that now exists — do not name them.
    for (const rel of Object.keys(snapshotTree(root))) {
      const text = fs.readFileSync(path.join(root, rel), 'utf-8');
      for (const [re, what] of CREDENTIAL_PATTERNS) {
        assert.ok(!re.test(text), `NFR79: ${rel} appears to contain ${what}`);
      }
    }
  });
});

test('AC4.3 the confluence record\'s KEY SET is exactly {backend, space_key, root_page{title,id}}', () => {
  withTmpProject((root) => {
    capture(() => cli.writeProjectLayoutYaml(CONFLUENCE_ANSWERS));
    const doc = yaml.load(
      fs.readFileSync(path.join(root, '_bmad-output', 'project-layout.yaml'), 'utf-8')
    );
    for (const rec of ['system_requirements_store', 'software_requirements_store']) {
      const keys = Object.keys(doc[rec]).sort();
      // Stated LITERALLY. NFR79: "project-layout.yaml records only the space key
      // and root page identity." Deriving this from the serializer's own field
      // list would mean a serializer that started emitting `api_token` would
      // change both sides at once and pass.
      assert.deepStrictEqual(
        keys, ['backend', 'root_page', 'space_key'],
        `${rec} may carry only backend + space key + root-page identity. Got: ${JSON.stringify(keys)}`
      );
      const rootKeys = Object.keys(doc[rec].root_page).sort();
      assert.deepStrictEqual(
        rootKeys, ['id', 'title'],
        `${rec}.root_page is an IDENTITY, not content. Got: ${JSON.stringify(rootKeys)}`
      );
    }
  });
});

test('AC4.4 the OQ-4 root-page write-back records an ID only — it cannot become a content mirror', () => {
  withTmpProject((root) => {
    capture(() => cli.writeProjectLayoutYaml(CONFLUENCE_ANSWERS));
    const before = snapshotTree(root);
    let res;
    capture(() => {
      res = cli.recordLearnedRootPageId({
        projectRoot: root,
        storeId: 'system_requirements',
        title: 'System Requirements',
        id: '123456789',
      });
    });
    // Branch on the outcome BY NAME. "recorded" and "refused" must never be
    // allowed to collapse into "did not throw" — that is the shape that let a
    // failed write report success elsewhere in this epic.
    assert.strictEqual(res.outcome, cli.ROOT_ID_RECORDED,
      `the write-back must actually have RECORDED, or this test proves nothing. Got: ${res.outcome}`);
    const after = snapshotTree(root);
    const added = Object.keys(after).filter((k) => !(k in before));
    assert.deepStrictEqual(
      added, [],
      `the write-back may create no file at all. Created: ${JSON.stringify(added)}`
    );
    const doc = yaml.load(
      fs.readFileSync(path.join(root, '_bmad-output', 'project-layout.yaml'), 'utf-8')
    );
    assert.deepStrictEqual(
      Object.keys(doc.system_requirements_store.root_page).sort(), ['id', 'title'],
      'the write-back must not widen the root_page record beyond its identity'
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4 — AC5. Fail-loud paths proven, asserting MESSAGE CONTENT.
//
// Two paths: (i) Confluence-without-MCP, (ii) stale-config drift. For each, the
// AC demands the affected store, the space, the cause and the remedy — not
// merely a non-zero exit.
//
// WHERE THESE PATHS ACTUALLY LIVE, stated plainly, because it bounds what "end
// to end" can mean. Both are executed by an AGENT reading shipped instruction
// text, not by a Node function: the runtime for a skill IS its markdown. So each
// path is proved in two halves —
//   the TEXT half: the shipped bytes carry the four required elements, asserted
//     against ALL shipped copies, not one; and
//   the CODE half: the machinery the text tells the agent to rely on actually
//     detects the condition, driven end to end here.
// Neither half alone is the proof, and the code half does not exist for
// Confluence-without-MCP (the detection is the agent's tool context, which no
// Node process can observe).
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n=== SECTION 4 — AC5: fail-loud paths, message CONTENT (FR262, P5-9.3) ===\n');

const SHIPPED_SKILL_ROOTS = [
  'skills',
  path.join('lib', 'bmad-extension', 'skills'),
  path.join('lib', 'bmad-extension-plugin', 'skills'),
];

/**
 * Every markdown file that ACTUALLY SHIPS ON NPM, as absolute paths.
 *
 * Story 31.14 fix round, FIX-2 attack 2. The previous scope for the FR266 closed
 * set was `SHIPPED_SKILL_ROOTS` — the three `skills/` trees — and that is a
 * strictly smaller set than "shipped agent instruction text". A blatant
 * single-line mirror appended to `lib/bmad-extension/workflows/add-sprint/
 * workflow.md` was NOT scanned and did not fail anything, even though that file
 * ships (`lib/` is in `package.json`'s `files`) and is this repository's own
 * authored agent instruction text.
 *
 * The population is therefore derived from `package.json`'s `files` field — the
 * actual authority on what npm puts in the tarball — rather than from a list
 * maintained here. This is deliberately NOT tautological: `files` is not the
 * thing under test, it is the outside authority that DECIDES the thing under
 * test, and a future `files` entry automatically widens the scan instead of
 * silently escaping it.
 *
 * The enumeration is `git ls-files` intersected with `files`, NOT a filesystem
 * walk and NOT `npm pack`. Two reasons, both learned here:
 *
 *   - a raw filesystem walk picks up untracked and gitignored droppings (this
 *     repository's own suites materialise `.agents/`, `_bmad/` and plugin build
 *     dirs mid-run), so the population would depend on WHEN the suite ran;
 *   - `npm pack --dry-run` is the exact tarball but costs an npm subprocess in
 *     a suite that must stay hermetic.
 *
 * So this is a deliberate SUPERSET of the tarball: 2,332 tracked `.md` under
 * the `files` roots, of which 1,049 actually reach the tarball (npm additionally
 * honours the nested ignore files inside the vendored `lib/bmad-cache/**`
 * packages). A superset is the correct side to err on for a NEGATIVE — it can
 * over-report, which a human then adjudicates, but it cannot let a shipped file
 * go unscanned. Both figures are asserted in AC7.5c.
 */
function shippedFilesWithExtensions(extensions) {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'));
  const roots = pkg.files || [];
  const tracked = execFileSync('git', ['ls-files', '-z'], {
    cwd: REPO_ROOT, maxBuffer: 1 << 28,
  }).toString('utf8').split('\0').filter(Boolean);
  const out = tracked
    .filter((f) => extensions.some((x) => f.toLowerCase().endsWith(x)))
    .filter((f) => roots.some((e) => (e.endsWith('/') ? f.startsWith(e) : f === e)))
    .map((f) => path.join(REPO_ROOT, f));
  return [...new Set(out)].sort();
}

function shippedMarkdown() {
  return shippedFilesWithExtensions(['.md']);
}

/**
 * ─── THE NON-MARKDOWN HALF OF THE POPULATION (Story 31.14, attack 6) ────────
 *
 * The sixth bypass of this check, and the one that needed no cleverness at all:
 * `shippedMarkdown()` scans markdown ONLY. Shipped agent-readable text that is
 * not markdown — TOML, YAML, JSON — was never opened. For those files no verb,
 * no window and no subject filter was ever consulted, so the whole closed set
 * simply did not apply to them.
 *
 * It was not hypothetical when it was found. The vehicle was
 * `lib/bmad-cache/gds/…/gds-create-game-brief/customize.toml:114`, which named
 * Confluence outright in an `external_handoffs` directive in a shipped file
 * nothing scanned, while that workflow's own `SKILL.md` told the agent to
 * "execute each entry in `{workflow.external_handoffs}` … Invoke the tool".
 *
 * THAT FILE NO LONGER SHIPS. FR75 unbundled `gds` and `wds`, and with them went
 * every `external_handoffs` declaration in the tree — there are now zero, in
 * any shipped file, of any extension. The hole this scan closes is therefore no
 * longer demonstrable on a live vehicle, and AC7.5i asserts that absence rather
 * than pretending otherwise. The scan stays widened: the class of bypass is a
 * property of the POPULATION, not of one vendored example, and the next
 * upstream sync can reintroduce one without warning.
 *
 * The population is derived from the SAME outside authority as the markdown
 * half — `package.json`'s `files` ∩ `git ls-files` — for the same reason, and
 * with NO path excluded by rule. A path exclusion for `lib/bmad-cache/**` would
 * be the easy fix here (the real hits are vendored) and would reopen attack 2's
 * scope hole across the 663 shipped markdown files the cache still contributes.
 * This epic already refused that trade once and pinned by digest instead; the
 * same is done below.
 *
 * `.yml` is in the extension set although the shipped tree currently contains
 * ZERO of them (3 tracked `.yml` exist, all under `.github/`, none inside the
 * `files` roots). It is listed so renaming a `.yaml` cannot escape the scan.
 */
const SHIPPED_STRUCTURED_EXTENSIONS = Object.freeze(['.toml', '.yaml', '.yml', '.json']);

function shippedStructuredText() {
  return shippedFilesWithExtensions([...SHIPPED_STRUCTURED_EXTENSIONS]);
}

/**
 * The whole scanned population, each file paired with the window width that
 * suits its format. This is the single list AC7.5 and AC7.5d both walk, so the
 * forward check and the hygiene check can never diverge on scope.
 */
function shippedTextToScan() {
  return [
    ...shippedMarkdown().map((abs) => ({ abs, window: MIRROR_WINDOW_LINES })),
    ...shippedStructuredText().map((abs) => ({ abs, window: MIRROR_WINDOW_LINES_STRUCTURED })),
  ];
}

/** Every shipped skill markdown file, as absolute paths. Enumerated, not listed. */
function shippedSkillMarkdown() {
  const out = [];
  for (const rootRel of SHIPPED_SKILL_ROOTS) {
    const root = path.join(REPO_ROOT, rootRel);
    if (!fs.existsSync(root)) continue;
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) walk(abs);
        else if (e.name.endsWith('.md')) out.push(abs);
      }
    };
    walk(root);
  }
  return out.sort();
}

/**
 * Extract the block introduced by an exact column-0 `## <heading>` line, up to
 * the next column-0 `## `. Returns [] when the heading is absent.
 *
 * The exactness is load-bearing and was learned the hard way: a loose
 * `Backend Routing` substring probe also matches Story 17.22's sprint-tracking
 * block, which is present in 61 tracked markdown files against the gate's 9.
 */
function extractBlocks(text, heading) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i] !== heading) continue;
    const acc = [lines[i]];
    for (let j = i + 1; j < lines.length && !/^## /.test(lines[j]); j += 1) acc.push(lines[j]);
    while (acc.length && acc[acc.length - 1].trim() === '') acc.pop();
    blocks.push(acc.join('\n'));
  }
  return blocks;
}

/**
 * The same extraction, but returning INCLUSIVE LINE RANGES rather than text.
 *
 * Story 31.14 fix round, FIX-2 attack 1. The closed set now scans a multi-line
 * WINDOW, so it can no longer ask "is this exact line one of the pinned block's
 * lines?" — it has to know which REGIONS of each file are pinned, and slide the
 * window only through the regions that are not. Deriving both from the same
 * `## heading` → next column-0 `## ` rule keeps the pin and the scan describing
 * the same boundary.
 *
 * ─── FIX ROUND 5, FIX-2: THE RAW EXTENT IS NOT A SAFE CARVE-OUT ─────────────
 *
 * `extractBlockExtentsRaw` is the rule as written above, and on its own it is a
 * LIVE BLIND SPOT. "Up to the next column-0 `## `" assumes every block is
 * followed by a heading. In `lib/bmad-extension/workflows/remove-from-sprint/
 * workflow.md` the preflight was spliced before `<workflow>` and NOTHING after
 * it is a document heading — the extent only stops at line 143 because
 * `## Sprints with Assigned Items` happens to be markdown INSIDE an `<output>`
 * block. So the raw extent ran 5–142 (138 lines) against a 111-line canonical
 * block, and 26 lines of live agent instruction text — the `<workflow>` opener,
 * all of `<step n="0">`, most of `<step n="1">` — were carved OUT of the AC7.5
 * scan. `mirrorWindowsOutsidePinnedBlocks` walks only UNPINNED segments, so an
 * FR266 mirror planted in those 26 lines was invisible. Verified before the fix:
 * the same three-line `<action>` mirror plant scored 42 passed / 0 failed, exit
 * 0 at line 121 and 41/1 exit 1 at line 160. Position was the only variable. And
 * the terminator is ACCIDENTAL: reword that user-facing `<output>` string and
 * the carve-out grows.
 *
 * The carve-out is therefore CAPPED at the canonical block's own line count. A
 * pin may never cover more bytes than the block it pins; anything past the block
 * is live text and gets scanned. The cap is not a chosen number — it is derived
 * from the block AC7.1/AC7.2 already pin by digest, so it moves only when the
 * pinned block itself moves.
 *
 * AC7.5j is the permanent control: it asserts every carve-out is byte-identical
 * to the canonical block, and pins the ONE file whose raw extent over-runs, so
 * the next occurrence surfaces instead of silently widening a blind spot.
 */
function extractBlockExtentsRaw(lines, heading) {
  const extents = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i] !== heading) continue;
    let j = i + 1;
    while (j < lines.length && !/^## /.test(lines[j])) j += 1;
    extents.push([i, j - 1]);
  }
  return extents;
}

/**
 * The canonical text of a pinned block, and its line count.
 *
 * Read from the SHIPPED BYTES — the three `skills/` roots, the same population
 * AC7.1 and AC7.2 pin by count and by digest — rather than restated here, so the
 * cap cannot drift from the thing it caps. Uniqueness is asserted rather than
 * assumed: if the copies ever disagree there is no single canonical length, and
 * that must be a loud failure, not a silently-chosen first element.
 *
 * Memoised because `collectBlocks` walks 316 files and this is consulted once
 * per scanned file.
 */
const CANONICAL_BLOCK_CACHE = new Map();
function canonicalPinnedBlock(heading) {
  if (CANONICAL_BLOCK_CACHE.has(heading)) return CANONICAL_BLOCK_CACHE.get(heading);
  const texts = new Set(collectBlocks(heading).map((c) => c.block));
  assert.strictEqual(texts.size, 1,
    `the pinned block "${heading}" must have ONE canonical form in the shipped skills/ roots ` +
    `for its length to be a safe carve-out cap; found ${texts.size}`);
  const text = [...texts][0];
  const value = Object.freeze({ text, lines: text.split('\n').length });
  CANONICAL_BLOCK_CACHE.set(heading, value);
  return value;
}

function extractBlockRanges(lines, heading) {
  const canonicalLines = canonicalPinnedBlock(heading).lines;
  return extractBlockExtentsRaw(lines, heading)
    .map(([a, b]) => [a, Math.min(b, a + canonicalLines - 1)]);
}

const GATE_HEADING = '## Knowledge Store Backend Routing';
const PREFLIGHT_HEADING = '## Knowledge Store Binding Preflight';

function collectBlocks(heading) {
  const found = [];
  for (const abs of shippedSkillMarkdown()) {
    for (const b of extractBlocks(fs.readFileSync(abs, 'utf-8'), heading)) {
      found.push({ file: path.relative(REPO_ROOT, abs).replace(/\\/g, '/'), block: b });
    }
  }
  return found;
}

test('AC5.1 the Confluence-without-MCP HALT names the STORE, the SPACE, the CAUSE and the REMEDY — in every shipped copy', () => {
  const copies = collectBlocks(GATE_HEADING);
  assert.ok(copies.length > 0, 'the gate block must exist in the shipped tree at all');
  // The four required elements, each as an independent assertion so a message
  // that dropped one cannot pass on the strength of the other three.
  const REQUIRED = [
    [/Store: the (system|software) requirements store\./,
      'the AFFECTED STORE, named'],
    [/Space: \{the value of the space-key field[^}]*\}/,
      'the SPACE, resolved from the configured field'],
    [/no Confluence MCP was detected|No Confluence MCP server is available/,
      'the CAUSE — no Confluence MCP detected'],
    [/add a Confluence-capable MCP server to your agent's MCP configuration/,
      'the REMEDY — how to configure one'],
    [/re-run the installer \(or `ma-agents bind`\) to bind that store to the file system instead/,
      'the SECOND remedy — re-bind the store'],
    [/Nothing has been read or written on your behalf/,
      'the no-side-effect guarantee'],
  ];
  for (const { file, block } of copies) {
    for (const [re, what] of REQUIRED) {
      assert.match(block, re, `${file}: the fail-loud message must state ${what}`);
    }
  }
});

test('AC5.2 the Confluence-without-MCP path forbids every degradation, explicitly', () => {
  // FR262: skills "do not silently degrade and do not fall back to any local
  // copy". This is the half of the message that is a PROHIBITION rather than an
  // explanation, and it is what stops the fail-loud path quietly becoming a
  // fall-back path in a later edit.
  const FORBIDDEN_DEGRADATIONS = [
    /Do NOT fall back to the file system\./,
    /Do NOT read, create or offer to create a local copy of that store's artifacts\./,
    /Do NOT continue with a partial or empty result as though the store were empty\./,
    /Do NOT change the configured backend on the user's behalf\./,
    /has no degraded mode/,
  ];
  for (const { file, block } of collectBlocks(GATE_HEADING)) {
    for (const re of FORBIDDEN_DEGRADATIONS) {
      assert.match(block, re, `${file}: FR262 requires this prohibition to survive`);
    }
  }
});

test('AC5.3 an unrecognised backend is DEFAULT-DENY, not absorbed by the file-system branch', () => {
  // The permissive-default shape, which this epic produced once already. The
  // gate block must send an unknown backend to a HALT, not to Step B1.
  for (const { file, block } of collectBlocks(GATE_HEADING)) {
    assert.match(block, /### Step B3 — any other value/, `${file}: a third branch must exist`);
    assert.match(block, /unrecognised knowledge-store backend/, `${file}: it must halt by name`);
    assert.match(block, /It is not a catch-all/, `${file}: B1 must be stated NOT to absorb an unknown value`);
  }
});

test('AC5.4 the stale-config drift HALT names both stores and both paths, and prescribes `ma-agents bind`', () => {
  const copies = collectBlocks(PREFLIGHT_HEADING);
  assert.ok(copies.length > 0, 'the preflight block must exist in the shipped tree at all');
  const REQUIRED = [
    [/stopping: `_bmad\/bmm\/config\.yaml` is stale\./, 'the CAUSE — the generated config is stale'],
    [/\{store name\}: was `\{path in config\.yaml\}`, is now `\{path in project-layout\.yaml\}`/,
      'BOTH values for EVERY store that moved'],
    [/naming every store that moved and both of its paths/, 'the instruction to name every affected store'],
    [/Run `ma-agents bind` to regenerate `_bmad\/bmm\/config\.yaml`/, 'the REMEDY'],
    [/Nothing has been read or written on your behalf/, 'the no-side-effect guarantee'],
    [/Compare content, never timestamps/, 'the mtime-unsafe prohibition (OQ-2)'],
  ];
  for (const { file, block } of copies) {
    for (const [re, what] of REQUIRED) {
      assert.match(block, re, `${file}: the stale-config message must state ${what}`);
    }
  }
});

test('AC5.5 [CODE HALF] drift is actually DETECTED end to end — move a store, the stamp disagrees', () => {
  withTmpProject((root) => {
    seedPreF26Project(root);
    capture(() => cli.writeProjectLayoutYaml({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: SPRINT_SAME,
    }));
    capture(() => cli.generateBmmConfig({ projectRoot: root }));

    const cfgPath = path.join(root, '_bmad', 'bmm', 'config.yaml');
    const stampBefore = cli.readProjectLayoutStamp(fs.readFileSync(cfgPath, 'utf-8'));
    assert.ok(stampBefore.ok, `the generated config must carry a readable stamp; got ${stampBefore.reason}`);

    const fresh = cli.resolveProjectTopology(root);
    assert.ok(fresh.ok, 'the binding must resolve');
    assert.strictEqual(
      stampBefore.value, cli.computeProjectLayoutStamp(fresh.topology, root),
      'a just-generated config must MATCH — otherwise the drift test below proves nothing'
    );

    // Now MOVE a store, exactly as a `git pull` would.
    const moved = path.join(root, 'elsewhere');
    fs.mkdirSync(moved, { recursive: true });
    capture(() => cli.writeProjectLayoutYaml({
      systemRequirementsStore: { backend: 'file-system', mode: 'local', path: moved },
      softwareRequirementsStore: FS_SAME,
      sprintManagement: SPRINT_SAME,
    }));

    const after = cli.resolveProjectTopology(root);
    assert.ok(after.ok, 'the moved binding must still resolve');
    assert.notStrictEqual(
      stampBefore.value, cli.computeProjectLayoutStamp(after.topology, root),
      'FR262 / P5-9.3: a store that moved MUST make the stamp disagree — this is the detection ' +
      'the shipped preflight tells the agent to rely on'
    );
  });
});

test('AC5.6 [CODE HALF] an unreadable binding is REFUSED — the generator does not fall back to a default', () => {
  withTmpProject((root) => {
    seedPreF26Project(root);
    fs.mkdirSync(path.join(root, '_bmad-output'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '_bmad-output', 'project-layout.yaml'),
      '<<<<<<< HEAD\nschema_version: 2\n=======\nschema_version: 2\n>>>>>>> other\n'
    );
    const cfgPath = path.join(root, '_bmad', 'bmm', 'config.yaml');
    const beforeBytes = fs.readFileSync(cfgPath);
    let out;
    const rc = (() => { let r; out = capture(() => { r = cli.generateBmmConfig({ projectRoot: root }); }); return r; })();
    assert.strictEqual(rc, false, 'generation must refuse, not succeed');
    assert.ok(
      out.includes('Refusing to regenerate') && out.includes('_bmad-output/project-layout.yaml'),
      `the refusal must name the file it refused over. Said: ${out}`
    );
    assert.ok(
      fs.readFileSync(cfgPath).equals(beforeBytes),
      'the existing config must be left byte-identical — "success reported over a failed write" is ' +
      'one of the six defect shapes this epic produced'
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5 — AC6. Global resolution (NFR83).
//
// "A globally-installed skill, on a machine with no per-machine install state
// for the project, resolves a bound project's topology FROM THE PROJECT ROOT
// ALONE."
//
// The negative here is "does not depend on per-machine state". Asserted by
// REMOVAL, not by inspection: redirect HOME/USERPROFILE into an empty sandbox,
// delete the bound-projects registry, and require the resolved topology to be
// deep-equal to the one resolved with all of it present.
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n=== SECTION 5 — AC6: global resolution (NFR83) ===\n');

test('AC6.1 topology resolves identically with the per-machine registry PRESENT and DELETED', () => {
  const savedHome = process.env.HOME;
  const savedProfile = process.env.USERPROFILE;
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-relgate-home-'));
  try {
    withTmpProject((root) => {
      capture(() => cli.writeProjectLayoutYaml({
        systemRequirementsStore: { backend: 'confluence', spaceKey: 'SYSREQ', rootPage: { title: 'R', id: null } },
        softwareRequirementsStore: FS_SAME,
        sprintManagement: SPRINT_SAME,
      }));

      // (1) With a populated per-machine home.
      process.env.HOME = sandbox;
      process.env.USERPROFILE = sandbox;
      const regPath = cli.boundProjectsPath();
      fs.mkdirSync(path.dirname(regPath), { recursive: true });
      fs.writeFileSync(regPath, JSON.stringify({ projects: [{ root, boundAt: '2026-01-01' }] }, null, 2));
      const withState = cli.resolveProjectTopology(root);
      assert.ok(withState.ok, 'the binding must resolve with per-machine state present');
      assert.ok(fs.existsSync(regPath), 'the fixture registry must actually have been written');

      // (2) With the per-machine home wiped entirely.
      fs.rmSync(regPath, { force: true });
      const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-relgate-nohome-'));
      process.env.HOME = emptyHome;
      process.env.USERPROFILE = emptyHome;
      const withoutState = cli.resolveProjectTopology(root);
      assert.ok(withoutState.ok, 'NFR83: resolution must not require per-machine state');

      assert.deepStrictEqual(
        withoutState.topology, withState.topology,
        'NFR83: the resolved topology must be identical with and without per-machine install state'
      );
      try { fs.rmSync(emptyHome, { recursive: true, force: true }); } catch (_) { /* best effort */ }
    });
  } finally {
    if (savedHome === undefined) delete process.env.HOME; else process.env.HOME = savedHome;
    if (savedProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = savedProfile;
    try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch (_) { /* best effort */ }
  }
});

test('AC6.2 resolution reads ONLY the project root — a second project resolves to its OWN binding', () => {
  // The failure this catches is a resolver that consults an ambient
  // "current project" from per-machine state instead of its argument.
  const a = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-relgate-a-'));
  const b = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-relgate-b-'));
  const cwd = process.cwd();
  try {
    process.chdir(a);
    capture(() => cli.writeProjectLayoutYaml({
      systemRequirementsStore: { backend: 'confluence', spaceKey: 'AAA', rootPage: { title: 'A', id: null } },
      softwareRequirementsStore: FS_SAME,
      sprintManagement: SPRINT_SAME,
    }));
    process.chdir(b);
    capture(() => cli.writeProjectLayoutYaml({
      systemRequirementsStore: { backend: 'confluence', spaceKey: 'BBB', rootPage: { title: 'B', id: null } },
      softwareRequirementsStore: FS_SAME,
      sprintManagement: SPRINT_SAME,
    }));
    // Resolve A while cwd is B: the answer must come from the ARGUMENT.
    const ra = cli.resolveProjectTopology(fs.realpathSync(a));
    const rb = cli.resolveProjectTopology(fs.realpathSync(b));
    assert.ok(ra.ok && rb.ok, 'both bindings must resolve');
    assert.strictEqual(ra.topology.systemRequirementsStore.spaceKey, 'AAA',
      'NFR83: resolution must follow the project root it was given, not the cwd');
    assert.strictEqual(rb.topology.systemRequirementsStore.spaceKey, 'BBB');
  } finally {
    process.chdir(cwd);
    for (const d of [a, b]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* best effort */ } }
  }
});

test('AC6.3 an UNBOUND project is reported by NAME, not defaulted (NFR83 has no permissive fallback)', () => {
  withTmpProject((root) => {
    const r = cli.resolveProjectTopology(root);
    assert.strictEqual(r.ok, false, 'an unbound project must not resolve');
    assert.strictEqual(
      r.reason, cli.BINDING_UNBOUND,
      'the reason must be the NAMED unbound constant — "unbound" and "unreadable" must never collapse'
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 6 — AC7. The FR266 negative, and the two shipped-text invariants.
//
// FR266 (a local mirror of every confluence-backed store) was RETIRED BEFORE
// IMPLEMENTATION. P5-9.6 names an accidental mirror as the single most likely
// way this epic reacquires the subsystem it removed — and a mirror can return
// with NO CODE CHANGING AT ALL, as shipped instruction text telling an agent to
// keep a local copy.
//
// So the negative is enforced as a CLOSED SET over shipped instruction bytes:
// every occurrence of mirror vocabulary in shipped skill markdown must fall
// INSIDE one of the two digest-pinned blocks. A mirror instruction added to any
// other part of any shipped skill fails here. A mirror instruction added INSIDE
// a pinned block changes its digest and fails the pin. Both doors are shut.
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n=== SECTION 6 — AC7: FR266 has no implementation, and the block invariants ===\n');

const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

test('AC7.1 the Story 31.4 preflight is 41 copies at ONE digest, distributed 13/14/14', () => {
  const copies = collectBlocks(PREFLIGHT_HEADING);
  assert.strictEqual(copies.length, 41,
    `expected 41 shipped copies of the preflight, found ${copies.length}`);
  const digests = new Set(copies.map((c) => sha(c.block)));
  assert.strictEqual(digests.size, 1,
    `all 41 copies must be byte-identical; found ${digests.size} distinct digests`);
  assert.strictEqual(
    [...digests][0],
    'ca9bf25ba475f11ac760e8c92a2d41f92a21298d9f11df55881527673e67051f',
    'the preflight digest changed — re-adjudicate the block before re-pinning it'
  );
  const dist = { 'skills/': 0, 'lib/bmad-extension/': 0, 'lib/bmad-extension-plugin/': 0 };
  for (const c of copies) {
    if (c.file.startsWith('lib/bmad-extension-plugin/')) dist['lib/bmad-extension-plugin/']++;
    else if (c.file.startsWith('lib/bmad-extension/')) dist['lib/bmad-extension/']++;
    else if (c.file.startsWith('skills/')) dist['skills/']++;
  }
  assert.deepStrictEqual(
    dist,
    { 'skills/': 13, 'lib/bmad-extension/': 14, 'lib/bmad-extension-plugin/': 14 },
    `both deploy pipelines must carry the block: ${JSON.stringify(dist)}`
  );
});

test('AC7.2 the Story 31.9 gate is 9 copies at ONE digest, distributed 3/3/3', () => {
  const copies = collectBlocks(GATE_HEADING);
  assert.strictEqual(copies.length, 9, `expected 9 shipped copies of the gate, found ${copies.length}`);
  const digests = new Set(copies.map((c) => sha(c.block)));
  assert.strictEqual(digests.size, 1, `all 9 copies must be byte-identical; found ${digests.size}`);
  assert.strictEqual(
    [...digests][0],
    'cda3d3d99cff06edb3b7bbb00bc1399d6a060fc153829fba7108cdfb91b09cfb',
    'the gate digest changed — re-adjudicate the block before re-pinning it'
  );
  const dist = { 'skills/': 0, 'lib/bmad-extension/': 0, 'lib/bmad-extension-plugin/': 0 };
  for (const c of copies) {
    if (c.file.startsWith('lib/bmad-extension-plugin/')) dist['lib/bmad-extension-plugin/']++;
    else if (c.file.startsWith('lib/bmad-extension/')) dist['lib/bmad-extension/']++;
    else if (c.file.startsWith('skills/')) dist['skills/']++;
  }
  assert.deepStrictEqual(dist, { 'skills/': 3, 'lib/bmad-extension/': 3, 'lib/bmad-extension-plugin/': 3 },
    `both deploy pipelines must carry the gate: ${JSON.stringify(dist)}`);
});

test('AC7.3 [control] a LOOSE `Backend Routing` probe matches 39 shipped skill files against the gate\'s 9', () => {
  // Without this control, AC7.2's "9" looks like a number someone chose. It is
  // not: a loose probe also matches Story 17.22's sprint-tracking `## Backend
  // Routing` block, and would return nonsense.
  //
  // Story 31.14 fix round, FIX-4. This previously asserted `> 9`, which pins
  // nothing — the record's prose claimed the control was "pinned so nobody can
  // quietly loosen it", and `> 9` does not do that. It also cited "60 tracked
  // markdown files", which is a DIFFERENT POPULATION from the one this
  // assertion walks (and is 61, not 60, at HEAD). Both numbers are now stated
  // for what they actually measure:
  //
  //   - over SHIPPED SKILL MARKDOWN (this assertion's population, 319 files):
  //     39 loose matches against the gate's 9 — a 4x+ over-match;
  //   - over ALL TRACKED MARKDOWN (`git grep -l 'Backend Routing' -- '*.md'`,
  //     which is what the record's prose cites): 66 files.
  //
  // ─── #148/#149 MERGE: 36 -> 39, WITH THE REASON ──────────────────────────
  //
  // `my-next-issue` (PR #148) is a NEW sprint-tracking skill, shipped in all
  // three deploy pipelines (`skills/my-next-issue/SKILL.md`,
  // `lib/bmad-extension/skills/my-next-issue/SKILL.md`,
  // `lib/bmad-extension-plugin/skills/my-next-issue/SKILL.md`), and — like
  // every other sprint-management skill in this repository — it carries its
  // own `## Backend Routing` heading routing between the file-system and Jira
  // trackers (see its SKILL.md: "Before executing any file-system operations,
  // determine and route to the correct backend"). That is the SAME Story
  // 17.22 sprint-tracking pattern the other 36 pre-existing over-matches
  // already carry, NOT the F26 `## Knowledge Store Backend Routing` gate this
  // control exists to distinguish from (the headings differ in full, and
  // `extractBlocks`/`collectBlocks` match on the exact heading line, not a
  // substring). So all three new copies are benign over-matches of the same
  // kind AC7.2's exact-heading anchor already accounts for, and the anchored
  // 9 (AC7.2) is untouched because none of the three is a copy of the F26
  // gate. 36 + 3 = 39.
  //
  // The exact pin is intentional and matches how AC7.1/AC7.2 pin 41 and 9: if a
  // skill gains or loses the Story 17.22 sprint-tracking block, this number
  // moves and the control must be re-adjudicated rather than quietly widened.
  const loose = shippedSkillMarkdown()
    .filter((f) => fs.readFileSync(f, 'utf-8').includes('Backend Routing'));
  assert.strictEqual(
    loose.length, 39,
    `the loose probe must genuinely over-match the anchored 9; it matched ${loose.length}. ` +
    `If this moved because skills were added or removed, re-adjudicate and re-pin — do NOT ` +
    `relax it back to a '> 9' inequality, which pins nothing.`
  );
  assert.ok(loose.length > 9, 'and the over-match is what makes the exact heading anchor load-bearing');
});

/**
 * FR266's four named machineries: a local MIRROR, its SYNC direction, its
 * TRIGGER, and CONFLICT RESOLUTION. Deliberately over-broad — the scan is meant
 * to over-report and be narrowed by the closed set, not to be tuned until it is
 * silent.
 *
 * ─── TWO HALVES, AND WHY (Story 31.14 fix round 2, FIX-A attack 4a) ──────────
 *
 * The nine entries below the first divider are all NOUNS OF ART — the words an
 * ARCHITECTURE DOCUMENT uses for a mirror. That is a real blind spot, because
 * shipped agent instruction text is not written in architecture vocabulary. It
 * is written in ORDINARY PRODUCT ENGLISH, in the imperative, using the plainest
 * verb available. The Story 31.14 reviewer planted a complete FR266 mirror —
 * mirror, sync direction and trigger, all three — in exactly that register:
 *
 *     Before you begin, download every Confluence page in the software
 *     requirements store and save it under `_bmad-output/pages/`. Read from
 *     there for the rest of the session, and upload your edits back when you
 *     finish.
 *
 * It named Confluence outright, named the software requirements store outright,
 * sat on consecutive lines well inside the four-line window, and the suite
 * returned 37 passed, 0 failed, exit 0. Nothing about it was exotic. It evaded
 * because `download`, `save` and `upload back` are not architecture nouns, and
 * the vocabulary contained nothing else.
 *
 * So the vocabulary now carries a VERB FAMILY as well. This narrows the gap; it
 * does not close it, and the record says so in §9 item 9 rather than claiming
 * otherwise. A verb list is inherently open against natural language — `pull`,
 * `fetch … into`, `keep a copy`, `grab`, `archive` and any number of ordinary
 * synonyms are still absent, and a new one can be coined in a sentence. What
 * the closed set genuinely closes is the PLACE (every tracked shipped markdown
 * file, exceptions pinned by digest) and the SUBJECT (an F26 store must be
 * named). The predicate is a heuristic and is documented as one.
 *
 * ─── THE THIRD HALF, AND THE ONLY PART OF THE PREDICATE THAT IS CLOSED ──────
 * (Story 31.14 fix round 3, FIX-1 — attack 5)
 *
 * Round 2's extension was still a LIST, chosen by the author of the check. The
 * Story 31.14 verifier then found the fifth bypass in the most embarrassing
 * place available: THE PRODUCT'S OWN PROHIBITION. The shipped gate block, in
 * all nine copies, says
 *
 *     do NOT write, copy, cache, export or reconcile a local copy of anything
 *     Confluence returns
 *
 * and of those FIVE enumerated verbs the detector covered only three. `cache`,
 * `export` and `reconcile` were on the list; bare `copy` was not (only
 * `local copy|copies` and `offline copy`) and bare `write` was not (only
 * `writ… to disk` and `write-through|back|behind`). So an instruction using the
 * exact verb the shipped text forbids by name walked past the detector that
 * enforces it — verified live, 38 passed / 0 failed / exit 0, in both forms.
 *
 * The fix is NOT "append two more words and hope". A third undisciplined list
 * extension teaches a reader nothing and would be worse than an honest limit.
 * The fix is that the five verbs are a CLOSED, AUTHORED SET that already exists
 * OUTSIDE this file — in the shipped bytes — so the detector can be BOUND to it
 * the same way AC7.9 is bound to the PRD and AC5.1 to the shipped message.
 * `prohibitedMirrorVerbs()` below extracts the verb list FROM THE SHIPPED GATE
 * BLOCK, and AC7.5f asserts this vocabulary covers every verb it finds. The
 * forward property that buys: if anyone ever edits the prohibition to forbid a
 * sixth verb, AC7.5f goes red until the detector catches up. That axis of the
 * predicate is now closed against an outside authority; the rest of it is still
 * a heuristic and §9 item 9 still says so.
 *
 * `local (copy|copies)`, `offline copy`, `write-(through|back|behind)` and
 * `writ… to disk` are gone from the list below, not because they were wrong but
 * because the two bare verbs strictly SUBSUME them. A list that keeps dead
 * entries reads as broader than it is, which is this epic's signature defect.
 */
const MIRROR_VOCABULARY = [
  // ─── The nouns of art: how an architecture document says "mirror". ───────
  /\bmirror(s|ed|ing)?\b/i,
  /\bsync(s|ed|ing|hronis\w*|hroniz\w*)?\b/i,
  /\bcach(e|es|ed|ing)\b/i,
  /\breconcil\w+\b/i,
  /\breplicat\w+\b/i,
  /\boffline (mirror|cache)\b/i,
  /\b(two[- ]way|bi[- ]?directional)\b/i,
  // ─── The verbs: how a person actually writes the instruction. ────────────
  /\bdownload(s|ed|ing)?\b/i,
  /\bupload(s|ed|ing)?\b/i,
  /\bexport(s|ed|ing)?\b/i,
  /\bimport(s|ed|ing)?\b/i,
  /\bsav(e|es|ed|ing)\b/i,
  /\bpersist(s|ed|ing|ence)?\b/i,
  /\bsnapshot(s|ted|ting)?\b/i,
  /\bshadow(s|ed|ing)?\b/i,
  /\bstash(es|ed|ing)?\b/i,
  /\bstor(e|es|ed|ing) (it |them |everything |the \w+ )?locally\b/i,
  // ─── The two the SHIPPED PROHIBITION names and the list had missed. ──────
  // Bound to the shipped text by AC7.5f; do not remove without removing them
  // from the prohibition first, and that would fail AC7.6.
  /\bcop(y|ies|ied|ying)\b/i,
  /\bwrit(e|es|ing|ten)\b/i,
];

/**
 * ─── THE OUTSIDE AUTHORITY FOR THE VERB HALF ────────────────────────────────
 *
 * The five verbs the SHIPPED gate block prohibits by name, read out of the
 * shipped bytes rather than restated here. Restating them would make AC7.5f
 * tautological — the same defect shape this epic found six times — so the list
 * is parsed from the product text and the test asserts coverage of whatever it
 * finds.
 *
 * The sentence is pinned independently by AC7.6 across all nine copies, so this
 * parse cannot silently start reading a different sentence; and the extraction
 * is asserted non-empty and 9-copy-consistent in AC7.5f, so it cannot silently
 * start reading NOTHING (an empty set would make the coverage loop vacuous,
 * which is FIX-4's defect and must not be reintroduced here).
 */
function prohibitedMirrorVerbs() {
  const perCopy = [];
  for (const { file, block } of collectBlocks(GATE_HEADING)) {
    const m = block.match(
      /do NOT ([a-z]+(?:, [a-z]+)*(?:,)? or [a-z]+) a local copy of anything Confluence returns/
    );
    if (!m) { perCopy.push({ file, verbs: null }); continue; }
    const verbs = m[1].split(/,\s*|\s+or\s+/).map((v) => v.trim().toLowerCase()).filter(Boolean);
    perCopy.push({ file, verbs: [...new Set(verbs)].sort() });
  }
  return perCopy;
}

test('AC7.4 [harness] the mirror vocabulary DETECTS a restored FR266 instruction', () => {
  // The control for AC7.5. FR266's own wording, as it would return.
  const restored = 'Every `confluence`-backed store has a local mirror kept in sync on each read.';
  assert.ok(MIRROR_VOCABULARY.some((re) => re.test(restored)),
    'the vocabulary must flag FR266 restored verbatim');
});

/**
 * The F26 SUBJECT. A mirror of a Confluence-backed knowledge store has to be a
 * mirror OF SOMETHING, and in this product that something is named. Restricting
 * the closed set to F26-subject lines is what keeps it a real gate rather than
 * a lint over every `docker build --no-cache` line in the shipped skill library:
 * scoping by subject narrows WHAT is examined without narrowing WHERE, so a
 * mirror instruction dropped into any shipped skill is still caught.
 */
const F26_SUBJECT = /confluence|knowledge[- ]store|requirements store|space[_ -]?key|root[_ -]?page/i;

test('AC7.4b [harness] the subject filter admits a restored FR266 line and rejects unrelated cache advice', () => {
  const restored = 'Every `confluence`-backed store has a local mirror kept in sync on each read.';
  assert.ok(F26_SUBJECT.test(restored), 'the subject filter must admit an FR266 restoration');
  assert.ok(!F26_SUBJECT.test('npm cache clean --force'), 'and must not admit unrelated cache advice');
});

/**
 * ─── THE MULTI-LINE WINDOW (Story 31.14 fix round, FIX-2 attack 1) ──────────
 *
 * The previous closed set filtered LINE BY LINE, requiring one line to carry
 * BOTH the F26 subject AND a mirror word. That is not an exotic bypass — it is
 * the DEFAULT failure, because this repository hard-wraps markdown prose at ~80
 * columns, so a multi-line instruction is the norm and a single-line one is the
 * exception. A restored FR266, written the way this codebase actually writes
 * prose:
 *
 *     When the software requirements store is Confluence-backed, keep a
 *     local copy of every page you read and sync it back on the next run.
 *
 * evaded the line-by-line set entirely: line 1 has the subject and no mirror
 * word, line 2 has `local copy` and `sync` and no subject. The scan now slides
 * a WINDOW over the lines and joins them before matching, so a sentence split
 * across a wrap is seen as one sentence.
 *
 * Four lines is chosen against the wrap width: at ~80 columns a four-line
 * window spans ~320 characters, comfortably more than one hard-wrapped
 * instruction sentence and short enough that unrelated neighbouring paragraphs
 * are not routinely joined into a false positive. It is a bound, not a proof:
 * an instruction deliberately spread across five or more lines, or split by an
 * intervening block, still evades — that limit is stated in §3 of the record
 * rather than papered over.
 */
const MIRROR_WINDOW_LINES = 4;

/**
 * ─── THE SAME WINDOW, ADAPTED TO STRUCTURED TEXT (attack 6) ─────────────────
 *
 * Four lines is calibrated against MARKDOWN's unit — one hard-wrapped prose
 * sentence. TOML, YAML and JSON have a different unit, and copying the number
 * across unexamined would have changed the semantics silently. So it was
 * measured against the shipped bytes rather than guessed:
 *
 *   - Mean line LENGTH is not the difference. The shipped `.md` population
 *     averages 34.9 characters per line; the shipped `.toml`/`.yaml`/`.json`
 *     population averages 34.7, with a longest line of 497 (no minified JSON
 *     anywhere in the tree). So a character-span argument does not distinguish
 *     them and is not the reason for the change.
 *
 *   - The UNIT is plausibly the difference. In these formats an instruction is
 *     not a wrapped sentence, it is an ENTRY: a contiguous leading comment
 *     block plus the key it documents. Entries run longer than a wrapped
 *     sentence, so a wider window is a reasonable hedge.
 *
 * ─── FIX ROUND 5, FIX-5: THE STATISTIC IS GONE, AND SO IS THE MECHANISM ─────
 *
 * What stood here justified 16 with a measurement: "Over the 745 such entries
 * in the shipped TOML/YAML, the median is 4 lines but the 99th percentile is
 * 16 … Sixteen lines covers 739 of those 745 … 6 of 745 entries are longer
 * than 16 lines." Two things were wrong with that, and both matter more than
 * the number.
 *
 *   1. IT IS NOT CHECKABLE. The script that produced it was never committed
 *      and no test pins the definition of an "entry", so a gate reader cannot
 *      reproduce the figure that justifies the constant. An independent
 *      reconstruction of "contiguous comment block + key" got 291 entries,
 *      median 2, p99 16, 2 over 16, max 18 — against 745 / 4 / 16 / 6 / 118.
 *      Only the p99 coincides. Two defensible readings of the same phrase
 *      differ by 2.6x on the population and 6.5x on the max, which is the
 *      definition of an unpinned measurement. An unverifiable statistic is a
 *      worse justification than an honest guess, because it looks like
 *      evidence. It is REMOVED rather than restated.
 *
 *   2. THE STATED MECHANISM DOES NOT OCCUR. The claim was that a four-line
 *      window could put the F26 subject and the mirror verb in DIFFERENT
 *      windows within the `external_handoffs` entry this attack rides on. It
 *      cannot: line 114 of `gds-create-game-brief/customize.toml` carries
 *      "Confluence", "upload" AND "space_key='GAME'" on ONE PHYSICAL LINE. A
 *      width sweep confirms it — that file matches at a window of 1.
 *
 * ─── SO WHAT 16 ACTUALLY IS ─────────────────────────────────────────────────
 *
 * SIXTEEN IS AN UNMEASURED ROBUSTNESS MARGIN. It is a guess that an entry-shaped
 * instruction may span more lines than a wrapped sentence, and nothing here
 * demonstrates it is the right guess or that any number above 4 is needed.
 *
 *   - IT BUYS NOTHING ON THE CURRENT TREE. Measured, and this part IS
 *     reproducible from the scan itself: the same THREE files, THREE hits and
 *     THREE digest neighbourhoods are reported at every width from 4 through
 *     24. Not one additional passage is found by widening.
 *   - IT COSTS WIDER DIGESTS. A 16-line window digests more surrounding text,
 *     so an unrelated edit anywhere in those 16 lines changes the digest and
 *     forces a re-adjudication. FIX-3 is the concrete bill: two of the three
 *     adjudications described bytes their 16-line window did not cover, and one
 *     of the two was really a window artifact. At width 4 neither
 *     mis-description was available to make.
 *   - IT IS A BOUND, NOT A PROOF, and now without a number attached: an
 *     instruction split across a longer entry still evades. §9 item 16 of the
 *     record states that.
 *
 * The honest summary is that 16 is defensible and unproven, that 4 would very
 * likely do the same job on this tree, and that the wider window has already
 * cost more in adjudication quality than it has bought in coverage.
 */
const MIRROR_WINDOW_LINES_STRUCTURED = 16;

/** Normalised text of a window, so a re-wrap of the SAME sentence digests the same. */
const normaliseWindow = (s) => s.replace(/\s+/g, ' ').trim();

/**
 * Every F26-subject mirror-vocabulary WINDOW in `absPath` that falls OUTSIDE
 * every digest-pinned block. Windows never straddle a pinned region: the file
 * is split into unpinned segments first and the window slides within a segment.
 *
 * `windowLines` defaults to the markdown width. The pinned-block carve-out is
 * applied to structured files too, unchanged — it simply never fires there,
 * because no shipped `.toml`/`.yaml`/`.json` file carries either `## ` heading
 * (verified: 0 of 382). That is stated rather than special-cased, so a future
 * skill shipped as YAML front matter would be pinned by the same rule.
 */
function mirrorWindowsOutsidePinnedBlocks(absPath, windowLines = MIRROR_WINDOW_LINES) {
  const lines = fs.readFileSync(absPath, 'utf-8').replace(/\r\n/g, '\n').split('\n');
  const pinned = [
    ...extractBlockRanges(lines, PREFLIGHT_HEADING),
    ...extractBlockRanges(lines, GATE_HEADING),
  ];
  const isPinned = (i) => pinned.some(([a, b]) => i >= a && i <= b);
  const segments = [];
  let seg = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (isPinned(i)) { if (seg.length) { segments.push(seg); seg = []; } }
    else seg.push(i);
  }
  if (seg.length) segments.push(seg);

  const found = [];
  for (const s of segments) {
    for (let k = 0; k < s.length; k += 1) {
      const idx = s.slice(k, k + windowLines);
      const win = normaliseWindow(idx.map((i) => lines[i]).join(' '));
      if (!F26_SUBJECT.test(win)) continue;
      if (!MIRROR_VOCABULARY.some((re) => re.test(win))) continue;
      found.push({ line: s[k] + 1, text: win });
      k += windowLines - 1; // one report per neighbourhood, not one per line
    }
  }
  return found;
}

/**
 * ─── THE SECOND HALF OF THE CLOSED SET ──────────────────────────────────────
 *
 * Widening the scan from the three `skills/` roots to ALL 1,049 shipped
 * markdown files brings in the human documentation that legitimately DISCUSSES
 * the retirement — README.md says "There is no local mirror and no cache", and
 * `docs/architecture.md` discusses the unrelated bmad-org registry cache. Those
 * cannot be excluded by path (that reopens exactly the scope hole attack 2
 * walked through) and they are not inside a pinned block.
 *
 * So they are admitted the only way that keeps this a CLOSED SET rather than a
 * denylist: by the sha256 of the ADJUDICATED PASSAGE ITSELF. Every entry below
 * was read and adjudicated by hand. If any of these passages is edited, its
 * digest changes and it must be re-adjudicated; if a new mirror passage appears
 * anywhere in any shipped markdown, it has no digest here and fails. The
 * exception is over the BYTES, not over the file.
 *
 * AC7.5d asserts in the other direction — every digest here must still MATCH
 * something — so a stale exception cannot linger and silently widen the set.
 */
const ADJUDICATED_MIRROR_PASSAGES = Object.freeze({
  // README.md — the shipped user documentation of FR266's retirement. All three
  // are NEGATIONS, or describe the page TREE's shape rather than a content
  // mirror. These are the passages §3 of the gate record adjudicated by hand.
  '22df684a': 'README.md:213 — "**There is no local mirror and no cache.**" A PROHIBITION.',
  '2f7c9a2d': 'README.md:217 — "nothing is copied down … nothing to synchronise and nothing '
    + 'to fall out of date". A PROHIBITION.',
  '1000f5f8': 'README.md:221 — "one page per markdown artifact, nested to mirror the source '
    + 'folders". Describes the page TREE\'S SHAPE, which is FR255/FR256\'s actual '
    + 'requirement — not a mirror of page CONTENT.',
  // README.md — the "Deliberately not implemented" section, moved here in the
  // Story 31.14 fix round because CHANGELOG.md does NOT ship on npm (verified:
  // `npm pack --dry-run` = 1,929 entries, CHANGELOG.md not among them) and the
  // record had claimed these limitations were "in the shipped changelog". The
  // whole passage is a statement that FR266 is ABSENT.
  'c85de5ef': 'README.md — "### Deliberately not implemented … a local mirror … was RETIRED '
    + 'before implementation". A RETIREMENT NOTICE.',
  '57c46009': 'README.md — "has no code, no cache, no sync direction, no sync trigger and no '
    + 'conflict-resolution path". An enumeration of what is ABSENT.',
  'd2204218': 'README.md — "removes the need for a mirror entirely … asserts the absence as a '
    + 'closed set". The RATIONALE for the absence.',
  // docs/architecture.md — unrelated pre-existing vocabulary. Neither passage is
  // about a Confluence store; both are pulled in by the window straddling a
  // nearby F26 sentence.
  '054b10ab': 'docs/architecture.md:213 — the bmad-org REGISTRY cache builder (lib/bmad-cache), '
    + 'a pre-existing subsystem unrelated to any knowledge store.',
  // ─── §3.6.1, the NFR80 air-gap posture (re-cut in fix round 3, FIX-1) ─────
  //
  // These two SUPERSEDE the single entry `425df87a` ("docs/architecture.md:219
  // — Installation and skill loading require no network at all … Neither reads
  // a knowledge store"), which is now stale and removed. Nothing about that
  // passage changed and no adjudication was revised: adding the bare `write`
  // verb made line 219's "the installer **writes** the binding" match from a
  // window starting two lines EARLIER, and because the scan reports one window
  // per neighbourhood and then strides, the same prose is now reported at :217
  // and :221 instead of at :219. AC7.5d caught the stale digest, which is the
  // direction it exists for.
  'fd970458': 'docs/architecture.md:217 — §3.6.1 "Air-gap posture with a Confluence-backed '
    + 'knowledge store (NFR80)", opening through "Neither reads a knowledge store: the '
    + 'installer writes the binding and generates `_bmad/bmm/config.yaml` from it, and both '
    + 'are local files." Matched by the bare `write` verb, on a sentence about the '
    + 'INSTALLER\'S OWN local binding file — not page content — inside a NEGATION.',
  '59781ed9': 'docs/architecture.md:221 — the same §3.6.1 posture list, through "There is no '
    + 'local mirror, no cache and therefore no sync (P5-9.6)." A PROHIBITION, and the '
    + 'air-gap posture NFR80 requires this file to state it.',

  // ─── Admitted by the VERB half of the vocabulary (fix round 2, FIX-A) ─────
  //
  // Extending MIRROR_VOCABULARY with the verb family widened the scan from 8
  // hits to 16 over the same 2,332-file population. All eight new hits were
  // read at source and adjudicated by hand; none is an FR266 mirror. They fall
  // into exactly two classes, both stated here rather than excluded by rule.
  //
  // CLASS 1 — one more README NEGATION, this one about credentials.
  '198b6dbe': 'README.md:14 — "with none, the affected skill **halts and says so** rather than '
    + 'quietly reading stale local files. No credentials are ever written to disk." A '
    + 'NEGATION twice over: the halt is the ANTI-mirror behaviour, and the sentence the '
    + '`written … to disk` probe matched is about CREDENTIALS, not page content.',
  //
  // CLASS 2 — seven copies of ONE upstream JSON schema example, in the vendored
  // bmad-org module cache. `lib/bmad-cache/` is NOT authored here: it is
  // generated by `scripts/build-bmad-cache.js` from the upstream BMAD-METHOD
  // registry and committed so an air-gapped install has its modules. The
  // matched text is a `external_handoffs` REPORT FIELD in a headless-run result
  // payload for the GAME DESIGN (gds) module — a record that a corp-specific
  // MCP tool performed a one-way PUBLISH of a produced artifact. A publish
  // handoff is not a mirror: there is no local copy of anything read, no sync
  // direction back, no trigger and no conflict resolution, and no knowledge
  // store of this product is involved. It is the same shape as this product's
  // own FR255/FR256 publish, which FR266's retirement explicitly leaves intact.
  //
  // Pinning them by digest is the right disposition and not a nuisance: these
  // bytes are regenerated by a build, so if upstream changes that example the
  // digest stops matching, AC7.5d fails, and a human re-adjudicates. A path
  // exclusion for `lib/bmad-cache/` would have been the easy fix and would have
  // reopened attack 2's scope hole across 666 shipped files.

  // ─── Admitted by the NON-MARKDOWN half of the population (attack 6) ───────
  //
  // Extending the scan to shipped `.toml`/`.yaml`/`.yml`/`.json` — 382 files
  // that no verb, window or subject filter had ever been applied to — produced
  // exactly THREE hits over the whole population, at a 16-line window. All
  // three were read at source, individually, by hand. None is an FR266 mirror,
  // and the reason is the same in every case: FR266 is a local copy of what
  // Confluence RETURNS plus a direction to read from that copy. Every hit below
  // is the opposite arrow — a locally-produced artifact routed OUTWARD — or no
  // arrow at all.
  //
  // Two further shipped `.toml` files carry the F26 subject and correctly do
  // NOT hit (`gds-gdd/customize.toml:95`, `gds-prd/customize.toml:80`): both say
  // only "route outputs beyond local files (Confluence, Notion, Google Drive,
  // ticket systems, etc.)" with `external_handoffs = []` and no mirror verb.
  // They were read too; they are recorded here because "the scan found nothing
  // there" is only meaningful if someone checked what was there.
  //
  // FIX-3 (fix round 5) rewrote the two descriptions below. The VERDICTS were
  // right and are not re-litigated; the DESCRIPTIONS named bytes the digested
  // window does not cover, which breaks the one thing the digest is for — a
  // human going to the cited line and seeing the passage that was adjudicated.
  '88a4d876': 'lib/bmad-cache/tea/…/bmad-testarch-trace/workflow.yaml:20 — a WINDOW ARTIFACT, '
    + 'not an instruction. The subject comes from `allow_external_pointer_resolution: true # '
    + 'Follow local placeholder pointers (e.g., Jira/Confluence) when compatible adapters '
    + 'exist` — RESOLVING a reference, which is a read, not a local copy — and the verbs '
    + '(`export`, `persist`) come from two unrelated neighbouring keys (`coverage_basis`, '
    + '`summary_confidence`) about the workflow\'s own step outputs. Nothing here copies '
    + 'anything Confluence returns.',
});

test('AC7.5 every F26-subject mirror-vocabulary WINDOW in ALL shipped text — markdown AND toml/yaml/json — is inside a pinned block or an adjudicated passage', () => {
  // THE CLOSED SET. Not "no line matches" — that would be a denylist, and this
  // epic already shipped one where a closed set was needed. The set of PLACES an
  // F26-subject mirror sentence may appear is closed to the two pinned blocks
  // plus a hand-adjudicated, digest-pinned list; everywhere else in everything
  // this package ships is out of bounds.
  //
  // Two things changed in the 31.14 fix round, and both were live bypasses:
  //   attack 1 — the match is now over a multi-line WINDOW, not a single line;
  //   attack 2 — the scope is now ALL shipped markdown, not the three `skills/`
  //              roots. `lib/bmad-extension/workflows/**` is this repository's
  //              own authored agent instruction text, it ships, and it was not
  //              scanned at all.
  //
  // And one changed in the attack-6 round, which was live in the tree:
  //   attack 6 — the population is no longer MARKDOWN ONLY. Shipped `.toml`,
  //              `.yaml`, `.yml` and `.json` are agent-readable instruction
  //              text too, they ship, and not one byte of them was scanned.
  //
  // (There is no `seen` set here. One existed, was populated on every
  // adjudicated hit and was never asserted on — dead code, removed in fix
  // round 5. The property it LOOKED like it guarded — that no adjudicated
  // digest has gone stale — is AC7.5d's job and is asserted there.)
  const strays = [];
  for (const { abs, window } of shippedTextToScan()) {
    const rel = path.relative(REPO_ROOT, abs).replace(/\\/g, '/');
    for (const hit of mirrorWindowsOutsidePinnedBlocks(abs, window)) {
      const digest = sha(hit.text).slice(0, 8);
      if (ADJUDICATED_MIRROR_PASSAGES[digest]) continue;
      strays.push(`${rel}:${hit.line}  [${digest}]  ${hit.text.slice(0, 200)}`);
    }
  }
  assert.deepStrictEqual(
    strays, [],
    `P5-9.6: a mirror can return as shipped instruction text with no code changing. Every ` +
    `F26-subject mirror-vocabulary passage outside the pinned blocks and the adjudicated list ` +
    `must be reviewed BY HAND before its digest is added. Found:\n` + strays.join('\n')
  );
});

test('AC7.5b [harness] a LINE-SPLIT mirror instruction — the default prose shape here — is CAUGHT', () => {
  // The control for attack 1. This exact text was planted in
  // `skills/code-review/SKILL.md` by the Story 31.14 reviewer and the previous
  // line-by-line closed set returned 33/0 with it in place. Subject on line 1,
  // mirror vocabulary on line 2 — which is what an ~80-column hard wrap does to
  // any sentence long enough to be a real instruction.
  const planted = [
    'When the software requirements store is Confluence-backed, keep a',
    'local copy of every page you read and sync it back on the next run.',
  ];
  // The bypass, demonstrated: NEITHER line satisfies the old single-line test.
  for (const line of planted) {
    const bothOnOneLine = F26_SUBJECT.test(line) && MIRROR_VOCABULARY.some((re) => re.test(line));
    assert.ok(!bothOnOneLine,
      `the harness is pointless unless this line genuinely evades a per-line filter: ${line}`);
  }
  // The fix: joined by the window, it matches both filters.
  const win = normaliseWindow(planted.join(' '));
  assert.ok(F26_SUBJECT.test(win), 'the window must carry the F26 subject');
  assert.ok(MIRROR_VOCABULARY.some((re) => re.test(win)), 'and the mirror vocabulary');
  assert.ok(!ADJUDICATED_MIRROR_PASSAGES[sha(win).slice(0, 8)],
    'and it must NOT be pre-adjudicated — a planted mirror is a stray, not an exception');
});

test('AC7.5e [harness] a PLAIN-ENGLISH mirror using no architecture noun is CAUGHT', () => {
  // The control for attack 4a. This exact text was planted in
  // `skills/code-review/SKILL.md` by the Story 31.14 reviewer, on consecutive
  // lines, well inside the four-line window — and the suite returned 37 passed,
  // 0 failed, exit 0 with it live in a shipped skill.
  //
  // It is not an evasion in any interesting sense. It names Confluence, names
  // the software requirements store, and states a mirror, a sync direction and
  // a trigger in the plainest imperative English available. It is simply how a
  // person writes the instruction — which is what made it the serious finding.
  const planted = [
    'Before you begin, download every Confluence page in the software requirements',
    'store and save it under `_bmad-output/pages/`. Read from there for the rest of',
    'the session, and upload your edits back when you finish.',
  ];
  const win = normaliseWindow(planted.join(' '));

  // It carries the SUBJECT — twice — so the subject filter was never the gap.
  assert.ok(F26_SUBJECT.test(win), 'the plant names an F26 store outright');
  // And it fits the window, so the window was not the gap either.
  assert.ok(planted.length <= MIRROR_WINDOW_LINES,
    'the plant fits the window; attack 4a is not a re-run of attack 1');

  // THE BYPASS, demonstrated against the OLD vocabulary: the nine architecture
  // nouns as they stood before this fix round matched nothing in it.
  const OLD_VOCABULARY = [
    /\bmirror(s|ed|ing)?\b/i,
    /\bsync(s|ed|ing|hronis\w*|hroniz\w*)?\b/i,
    /\bcach(e|es|ed|ing)\b/i,
    /\breconcil\w+\b/i,
    /\breplicat\w+\b/i,
    /\blocal (copy|copies)\b/i,
    /\boffline (copy|copies|mirror|cache)\b/i,
    /\bwrite[- ](through|back|behind)\b/i,
    /\b(two[- ]way|bi[- ]?directional)\b/i,
  ];
  assert.ok(!OLD_VOCABULARY.some((re) => re.test(win)),
    'the harness is pointless unless the OLD noun-only vocabulary genuinely missed this');

  // ─── THE FIX, AND THE CORRECTION TO HOW IT WAS ASSERTED ──────────────────
  //
  // Fix round 3, FIX-4. What stood here asserted over the SOURCE TEXT of the
  // matching regexes — `why.join(' ')` — which is this epic's signature defect
  // in its purest form: it measures the LIST, not the MATCH. Proven vacuous in
  // principle, not in theory: replace the three real patterns with the single
  // degenerate `/\bdownload\b|\bzzupload\b|\bzzsave\b/i`, in which only
  // `download` can ever match anything, and the old assertion still PASSED —
  // because the strings `upload` and `sav` appear in that one regex's source.
  //
  // The property that was meant is that THREE DISTINCT PATTERNS ACTUALLY FIRE,
  // one per verb. So each verb is probed in a carrier that contains no other
  // vocabulary word, and the patterns that fire are collected by IDENTITY.
  const perVerb = new Map();
  for (const [verb, probe] of [
    ['download', 'download every Confluence page in the requirements store'],
    ['upload', 'upload your edits to the requirements store when you finish'],
    ['save', 'save the Confluence page under the local artifacts folder'],
  ]) {
    const hits = MIRROR_VOCABULARY.filter((re) => re.test(probe));
    assert.ok(hits.length > 0,
      `no pattern in the vocabulary actually fires on the plant's "${verb}": ${probe}`);
    perVerb.set(verb, hits);
  }
  const distinct = new Set([...perVerb.values()].flat());
  assert.strictEqual(distinct.size, 3,
    `the plant's three verbs must be covered by three DISTINCT patterns that each really ` +
    `matched — not by one pattern whose SOURCE TEXT happens to mention all three. Fired: ` +
    `${[...distinct].map(String).join(', ')}`);
  // …and every one of those three must also fire on the joined window itself,
  // which is the text the scan actually sees.
  const firedOnWindow = MIRROR_VOCABULARY.filter((re) => re.test(win));
  for (const re of distinct) {
    assert.ok(firedOnWindow.includes(re),
      `${re} covers one of the plant's verbs in isolation but does not fire on the window`);
  }

  // And it must NOT be pre-adjudicated — a planted mirror is a stray.
  assert.ok(!ADJUDICATED_MIRROR_PASSAGES[sha(win).slice(0, 8)],
    'a planted mirror is a stray, not an exception');
});

test('AC7.5g [end-to-end] the REAL scan path reports attack 4a and both attack-5 forms as strays', () => {
  // Fix round 3, FIX-4, second gap. AC7.5b and AC7.5e test the PREDICATE in
  // isolation — subject filter, window length, vocabulary — and never call
  // `mirrorWindowsOutsidePinnedBlocks`. So the end-to-end proof that a planted
  // mirror in a real file comes back as a stray existed only as a manual
  // replant recorded in the gate document, in no assertion at all. A manual
  // replant is not a regression test; it does not run again tomorrow.
  //
  // This runs the real function over a real file on disk, containing a real
  // pinned block, and asserts BOTH directions: the plants outside the block are
  // reported, and the identical vocabulary inside the pinned block is not.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ac75g-'));
  try {
    const PLANTS = {
      // Attack 4a — the round-2 plain-English plant.
      '4a': [
        'Before you begin, download every Confluence page in the software requirements',
        'store and save it under `_bmad-output/pages/`. Read from there for the rest of',
        'the session, and upload your edits back when you finish.',
      ],
      // Attack 5, `copy` form — the verifier's fifth bypass, verbatim. Verified
      // live against the round-2 suite: 38 passed, 0 failed, exit 0.
      '5-copy': [
        'Before you begin, copy each page you read into `_bmad-output/confluence/`',
        'and re-read it from there on every later run.',
      ],
      // Attack 5, `write` form — the same bypass through the other uncovered
      // verb of the five the shipped prohibition names.
      '5-write': [
        'Before you begin, write every Confluence page in the software requirements',
        'store into `_bmad-output/pages/`, and read from there for the rest of the',
        'session.',
      ],
    };
    // ─── ANTI-SHRINK (fix round 3, verification of FIX-4) ──────────────────
    //
    // Found by MUTATING this test rather than by reading it: deleting the
    // `5-copy` plant outright left the suite at 40 passed, 0 failed, exit 0.
    // The loop below asserts something about every plant it is GIVEN and
    // nothing about how many it was given, so the set could silently shrink to
    // one — or to none — while the test kept its three-attack name. That is
    // this epic's signature defect (an assertion that measures the LIST it was
    // handed) reappearing inside the test written to close it.
    //
    // The set is therefore pinned by NAME and by SIZE, in both directions.
    assert.deepStrictEqual(Object.keys(PLANTS).sort(), ['4a', '5-copy', '5-write'],
      'AC7.5g is named for three specific attacks and must run all three: a plant removed ' +
      'here must fail this test, not quietly reduce what it covers');

    // The pinned block, taken from the SHIPPED bytes rather than retyped, so
    // the "inside a pinned block is exempt" half is proved against the real
    // thing and cannot drift from it.
    const shippedBlock = collectBlocks(GATE_HEADING)[0];
    assert.ok(shippedBlock, 'the gate block must exist to build this fixture from');

    for (const [name, planted] of Object.entries(PLANTS)) {
      const abs = path.join(dir, `${name}.md`);
      const lines = ['# Fixture', '', ...planted, '', shippedBlock.block, ''];
      fs.writeFileSync(abs, lines.join('\n'), 'utf-8');

      const hits = mirrorWindowsOutsidePinnedBlocks(abs);
      assert.ok(hits.length > 0,
        `attack ${name} must be REPORTED by the real scan path, not merely by the predicate`);
      // The reported window must be the plant, and it must be a stray — no
      // adjudicated digest may absolve it.
      const plantWin = normaliseWindow(planted.join(' '));
      assert.ok(hits.some((h) => h.text.includes(planted[0].trim())),
        `attack ${name}: the reported window must be the plant itself, not a neighbour. ` +
        `Got: ${hits.map((h) => `${h.line}:${h.text.slice(0, 80)}`).join(' | ')}`);
      for (const h of hits) {
        assert.ok(!ADJUDICATED_MIRROR_PASSAGES[sha(h.text).slice(0, 8)],
          `attack ${name}: a planted mirror must be a stray, not an adjudicated exception`);
      }
      // The other direction: the pinned block is FULL of this vocabulary
      // ("do NOT write, copy, cache, export or reconcile a local copy…") and
      // must contribute nothing, or the exemption is what is being measured
      // rather than the plant.
      assert.ok(hits.every((h) => h.line < lines.indexOf(shippedBlock.block) + 1),
        `attack ${name}: no hit may come from inside the pinned block`);
      assert.strictEqual(sha(plantWin).length, 64, 'sanity: the digest function is live');
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('AC7.5f [outside authority] the vocabulary covers EVERY verb the SHIPPED prohibition names', () => {
  // Fix round 3, FIX-1 — attack 5, and the reason it is not just two more words
  // on the list. The shipped gate block enumerates five prohibited verbs:
  //
  //   "do NOT write, copy, cache, export or reconcile a local copy of anything
  //    Confluence returns"
  //
  // and until this round the detector that ENFORCES that sentence covered only
  // three of them. Both uncovered verbs were then used to plant a live mirror
  // in `skills/code-review/SKILL.md` and the suite returned 38 passed, 0
  // failed, exit 0 for each.
  //
  // Appending `copy` and `write` to the list would close those two plants and
  // nothing else — the same one-attack-at-a-time patch that has now been
  // applied three times. This asserts the GENERAL property instead: the
  // detector must cover whatever the product prohibits, and the product's
  // prohibition is the authority. Add a sixth verb to the shipped sentence and
  // this test goes red until the vocabulary catches up.
  const perCopy = prohibitedMirrorVerbs();

  // ANTI-VACUITY, first. A parse that silently returns nothing would make the
  // coverage loop below pass over an empty set — FIX-4's exact defect.
  assert.strictEqual(perCopy.length, 9,
    `the prohibition must be read from all 9 shipped gate blocks; read ${perCopy.length}`);
  const unparsed = perCopy.filter((c) => c.verbs === null).map((c) => c.file);
  assert.deepStrictEqual(unparsed, [],
    `the prohibition sentence must parse in every shipped copy, or this test is vacuous ` +
    `and the vocabulary is unbound: ${unparsed.join(', ')}`);
  const shapes = new Set(perCopy.map((c) => c.verbs.join(',')));
  assert.strictEqual(shapes.size, 1,
    `all 9 copies must prohibit the SAME verbs: ${[...shapes].join(' / ')}`);

  const verbs = perCopy[0].verbs;
  assert.ok(verbs.length >= 5,
    `the parse must find the whole enumerated list, not its tail: ${verbs.join(', ')}`);

  // THE ASSERTION. Every prohibited verb must be detectable, probed in a
  // carrier that contains no OTHER vocabulary word — so a verb passes on its
  // own coverage and never on a neighbour's.
  const uncovered = [];
  for (const verb of verbs) {
    const probe = `Then ${verb} it under the project folder and read from there.`;
    // The carrier alone must be inert, or the probe proves nothing.
    assert.ok(!MIRROR_VOCABULARY.some((re) => re.test('Then it under the project folder and read from there.')),
      'the probe carrier must contain no vocabulary word of its own');
    if (!MIRROR_VOCABULARY.some((re) => re.test(probe))) uncovered.push(verb);
  }
  assert.deepStrictEqual(uncovered, [],
    `the shipped gate block prohibits these verbs by name and MIRROR_VOCABULARY cannot see ` +
    `them, so an instruction using the exact word the product forbids walks past the check ` +
    `that enforces it (this is attack 5, verified live): ${uncovered.join(', ')}`);
});

test('AC7.5c [harness] the scan reaches shipped instruction text OUTSIDE the three skills/ roots', () => {
  // The control for attack 2. `lib/bmad-extension/workflows/add-sprint/
  // workflow.md` ships (`lib/` is in `package.json`'s `files`) and carries
  // authored agent instructions, and the previous scope did not scan it. This
  // asserts the POPULATION, not the absence — the absence is AC7.5's job.
  const shipped = shippedMarkdown().map((f) => path.relative(REPO_ROOT, f).replace(/\\/g, '/'));
  const skillRootFiles = shippedSkillMarkdown().map((f) => path.relative(REPO_ROOT, f).replace(/\\/g, '/'));
  assert.ok(
    shipped.includes('lib/bmad-extension/workflows/add-sprint/workflow.md'),
    'attack 2\'s exact target must now be in the scanned population'
  );
  assert.ok(
    !skillRootFiles.includes('lib/bmad-extension/workflows/add-sprint/workflow.md'),
    'and it must genuinely be OUTSIDE the old skills/-roots scope, or this control proves nothing'
  );
  const inSkillRoots = new Set(skillRootFiles);
  const outside = shipped.filter((f) => !inSkillRoots.has(f));
  // The two populations, both pinned so neither can drift silently.
  //   1,283 = tracked .md under package.json's `files` roots (what this scans);
  //     319 = the three skills/ roots (all the old scope covered);
  //     964 = the widening — every one of these was previously UNSCANNED.
  // Of the 1,283 markdown files, the npm-tarball subset is not re-measured here
  // (a `npm pack` subprocess is deliberately not run in this suite); see the
  // superset/tarball note in the FR75 comment below for the last measured split.
  //
  // ─── FR75: 2,332 -> 1,280 AND 2,016 -> 964, WITH THE REASON ─────────────
  //
  // `gds` and `wds` stopped being bundled, taking 1,223 tracked files out of
  // `lib/bmad-cache/` — 1,052 of them markdown, all of them OUTSIDE the skills/
  // roots. So both figures move by exactly 1,052 and the OLD scope (316) does
  // not move at all, which is what says the widening was not narrowed: the
  // scanned population shrank because the shipped population shrank, not
  // because the scan stopped looking anywhere. Verifiable in one command:
  //
  //     git show --stat <unbundle-commit> -- lib/bmad-cache
  //
  // ─── #148/#149 MERGE: 1,280 -> 1,283 AND 316 -> 319, WITH THE REASON ─────
  //
  // PR #148 added ONE new skill, `my-next-issue`, shipped as `SKILL.md` in all
  // three deploy pipelines: `skills/my-next-issue/SKILL.md`,
  // `lib/bmad-extension/skills/my-next-issue/SKILL.md`, and
  // `lib/bmad-extension-plugin/skills/my-next-issue/SKILL.md` — all three
  // inside the `skills/` roots this scan already covered. So both the total
  // (1,280 -> 1,283) and the old scope (316 -> 319) move by exactly 3, and the
  // WIDENING (964) does not move at all: nothing new landed outside the
  // skills/ roots. The identity-resolution block PR #148 inserted into 8
  // EXISTING sprint skills changed those files' bytes, not the population —
  // no file was added or removed by that insertion. Verifiable in one command:
  //
  //     git diff --name-status --diff-filter=A <merge-base>..origin/main
  //
  // ─── EPIC 36 (STORIES 36.2-36.5): 964 -> 965 AND 1,283 -> 1,284, WITH THE REASON
  //
  // Story 36.2 added ONE shipped markdown file, `docs/on-prem-runtime.md` (the
  // 4.x offline-runtime recipe), under the `docs/` `files` root and OUTSIDE the
  // skills/ roots. So the widening and the total both move by exactly 1 and the
  // OLD scope (319) does not move. The new file is scanned like every other
  // shipped .md (AC7.5 passes on it). Found by Story 36.6's Linux chain run,
  // where this suite failed at HEAD and passed at 38ea256. Verifiable:
  //
  //     git diff --name-status --diff-filter=A 38ea256..HEAD -- docs/ lib/ scripts/ skills/ bin/
  assert.strictEqual(inSkillRoots.size, 319,
    `the OLD scope must be what it was: found ${inSkillRoots.size} skill-root .md`);
  assert.strictEqual(outside.length, 965,
    `the widening must actually widen: ${outside.length} tracked shipped .md now scanned that ` +
    `the skills/-roots scope missed (expected 965, of which 730 reach the npm tarball — ` +
    `663 lib/bmad-cache, 26 lib/bmad-workflows, 8 lib/mil498-templates, ` +
    `7 lib/bmad-extension/workflows, 6 lib/templates, and the root/docs/mil498 documentation; ` +
    `the tarball split was last measured before Epic 36 added docs/on-prem-runtime.md)`
  );
  assert.strictEqual(shipped.length, 1284,
    `and the total scanned markdown population is pinned: found ${shipped.length}`);
});

test('AC7.5h [harness] the scan population includes shipped NON-MARKDOWN agent-readable text', () => {
  // The control for attack 6, and the POPULATION half of its proof. AC7.5i is
  // the behavioural half; this one asserts the set of files, because a widening
  // that quietly narrows again later is exactly how attack 2 got in.
  //
  // The named target is the file the attack was found on. It ships, it names
  // Confluence outright at :114, and the markdown scan never opened it.
  //
  // ─── FIX-4 (fix round 5): BOUND TO THE FUNCTION THE REAL SCAN WALKS ──────
  //
  // This test used to enumerate `shippedStructuredText()` directly. So did
  // AC7.5i. Neither touched `shippedTextToScan()` — the ONE list AC7.5 and
  // AC7.5d actually iterate — so both passed under mutation M1 (delete the
  // structured half from `shippedTextToScan()`, i.e. narrow the real scan back
  // to markdown-only). The only test that caught M1 was AC7.5d, and only
  // INCIDENTALLY: three adjudicated digests happen to live in structured files.
  // Those three are vendored `lib/bmad-cache/**` bytes regenerated by a build
  // (§9 item 28's own churn warning); if they churn away, M1 passes silently
  // and this test goes on claiming to guard a population it never reads.
  //
  // So the population is now DERIVED from the scan list, by the width the scan
  // list pairs with each file. Narrow `shippedTextToScan()` and this test loses
  // its subject and fails, which is what a control for a widening must do.
  const scanList = shippedTextToScan();
  assert.notStrictEqual(MIRROR_WINDOW_LINES, MIRROR_WINDOW_LINES_STRUCTURED,
    'the two widths must differ, or the scan list cannot be partitioned by them');
  const structured = scanList
    .filter((e) => e.window === MIRROR_WINDOW_LINES_STRUCTURED)
    .map((e) => path.relative(REPO_ROOT, e.abs).replace(/\\/g, '/'));
  const md = new Set(scanList
    .filter((e) => e.window === MIRROR_WINDOW_LINES)
    .map((e) => path.relative(REPO_ROOT, e.abs).replace(/\\/g, '/')));
  assert.strictEqual(structured.length + md.size, scanList.length,
    'every entry in the scan list must carry one of the two known widths');
  // …and the scan list's structured half must BE the structured population, so
  // a file can neither be enumerated at the wrong width nor enumerated and then
  // dropped before the scan reaches it.
  assert.deepStrictEqual(
    [...structured].sort(),
    shippedStructuredText().map((f) => path.relative(REPO_ROOT, f).replace(/\\/g, '/')).sort(),
    'the scan list must pair EVERY structured file with the structured width'
  );
  // Attack 6's original target was a `gds` file and FR75 unbundled `gds`, so
  // the control is now carried by another vendored TOML that ships, is not
  // markdown, and is inside the `files` roots. What it has to prove is
  // unchanged: a non-markdown shipped file is in the population the scan walks.
  const TARGET = 'lib/bmad-cache/tea/src/workflows/testarch/'
    + 'bmad-testarch-trace/customize.toml';
  assert.ok(structured.includes(TARGET),
    'the non-markdown control target must be in the scanned population');
  assert.ok(!md.has(TARGET),
    'and it must genuinely be OUTSIDE the markdown population, or this control proves nothing');

  // The populations do not overlap — the structured half is pure widening, not
  // a re-count of files already scanned.
  assert.deepStrictEqual(structured.filter((f) => md.has(f)), [],
    'the structured population must add files, never double-count markdown ones');

  // Pinned by extension, so a silent narrowing fails here rather than passing
  // quietly. `.yml` is deliberately 0: three exist in the repo, all under
  // `.github/`, none inside `package.json`'s `files` roots. It stays in the
  // extension set so renaming a `.yaml` cannot escape.
  const byExt = {};
  for (const x of SHIPPED_STRUCTURED_EXTENSIONS) byExt[x] = 0;
  for (const f of structured) {
    const x = SHIPPED_STRUCTURED_EXTENSIONS.find((e) => f.toLowerCase().endsWith(e));
    byExt[x] += 1;
  }
  // ─── #148/#149 MERGE: 322 -> 325, {.toml:36, .yaml:222->224, .json:64->65} ──
  //
  // PR #148 added two new shipped structured files, both `bmad-skill-manifest
  // .yaml` companions to the new `my-next-issue` skill in the two `lib/`
  // deploy pipelines (`lib/bmad-extension/skills/my-next-issue/
  // bmad-skill-manifest.yaml` and `lib/bmad-extension-plugin/skills/
  // my-next-issue/bmad-skill-manifest.yaml`), and one new `.json`
  // (`skills/my-next-issue/skill.json`, the `skills/` pipeline's own manifest
  // format). The fourth new tracked file at that path,
  // `.agents/skills/my-next-issue/bmad-skill-manifest.yaml`, is NOT inside any
  // `package.json` `files` root (`.agents/` ships nothing), so it does not
  // enter this population. `.toml` is untouched: no new TOML shipped. So
  // `.yaml` +2, `.json` +1, `.toml` +0, `.yml` +0, total +3. Verifiable:
  //
  //     git diff --name-status --diff-filter=A <merge-base>..origin/main -- lib/ skills/
  assert.deepStrictEqual(byExt, { '.toml': 36, '.yaml': 224, '.yml': 0, '.json': 65 },
    `the non-markdown population is pinned by extension: got ${JSON.stringify(byExt)}`);
  assert.strictEqual(structured.length, 325,
    `and its total is pinned: found ${structured.length}`);

  // The scanned whole, and the honest remainder. 2,035 tracked files sit under
  // the `files` roots; 1,283 + 325 = 1,608 of them are now scanned and 427 are
  // not (.py, .js, .ts, .mjs, .cjs, .sh, .ps1, .groovy, .astro, .html, .css,
  // .csv, .xml, .txt, .svg, binaries and dotfiles — plus the two new `.gitkeep`
  // markers below). §9 item 16 enumerates that remainder; this asserts the
  // arithmetic so the record's figures cannot drift from the code's.
  //
  // ─── STORY 31.15: 3,249 -> 3,250 AND 535 -> 536, WITH THE REASON ─────────
  //
  // ONE file was added under a `files` root: `lib/confluence-publish-hook.js`,
  // the publish-trigger generator. Both figures move by exactly one and the two
  // SCANNED populations do not move at all — markdown stays 2,332 and structured
  // stays 382, which is what says the widening was not narrowed. Verifiable in
  // one command:
  //
  //     git diff --name-only <merge-base>..HEAD --diff-filter=A
  //
  // This is arithmetic bookkeeping about the repository's own file count, which
  // this assertion exists to keep honest as files are added — not a rebaseline
  // of a failing invariant. It is recorded here rather than silently edited
  // because this epic treats an unexplained count move as a defect.
  //
  // WHAT IT COSTS, STATED: the new file is `.js`, so it lands in the UNSCANNED
  // remainder — this gate does not read its text for FR266 vocabulary, and that
  // file is where the publish hook's shipped instruction text is authored. The
  // negative for that text is carried instead by
  // `test/project-layout-confluence-publish-hook.test.js` §9, which EXTRACTS
  // `MIRROR_VOCABULARY` from this file rather than restating it and asserts the
  // hook text matches ZERO entries. That is a mitigation in a second suite, not
  // coverage here; a reviewer widening this scan to `.js` would subsume it.
  //
  // ─── FR75: 3,250 -> 2,027 AND 536 -> 425, WITH THE REASON ───────────────
  //
  // Unbundling `gds` and `wds` removed 1,223 tracked files from
  // `lib/bmad-cache/`: 1,052 markdown, 60 structured, 111 in the unscanned
  // remainder. 3,250 - 1,223 = 2,027 and 536 - 111 = 425, and every one of the
  // three scanned/unscanned figures moves DOWN by its own share, which is what
  // a shrinking shipped tree looks like as opposed to a narrowed scan.
  //
  // ─── #148/#149 MERGE: 2,027 -> 2,035 AND 425 -> 427, WITH THE REASON ─────
  //
  // PR #148 added 8 tracked files under the `files` roots for the new
  // `my-next-issue` skill: 3 `.md` (already counted in `shippedMarkdown()`
  // above), 3 structured (2 `.yaml` + 1 `.json`, already counted in
  // `shippedStructuredText()` above), and 2 extension-less `.gitkeep`
  // placeholders (`lib/bmad-extension/skills/my-next-issue/.gitkeep` and
  // `lib/bmad-extension-plugin/skills/my-next-issue/.gitkeep`) that fall into
  // neither scanned population. So `all` moves by +8 (2,027 -> 2,035) while
  // the two SCANNED populations account for +3 and +3 of that move, leaving
  // the UNSCANNED remainder to move by exactly the 2 `.gitkeep` files
  // (425 -> 427). Verifiable in one command:
  //
  //     git diff --name-status --diff-filter=A <merge-base>..origin/main -- lib/ skills/
  //
  // ─── #153: 2,035 -> 2,036 AND 427 -> 428, WITH THE REASON ────────────────
  //
  // PR #153 (bug-bmad-skill-dir-cleanup-ebusy-on-windows) added one tracked
  // file under the `files` roots: `lib/fs-retry-preload.js`, the fs.rm retry
  // shim preloaded into the bmad-method child. It is `.js`, so neither scanned
  // population moves and the whole +1 lands in the UNSCANNED remainder. Its
  // text is an fs wrapper with no instruction text and no FR266 vocabulary.
  //
  // ─── EPIC 36 (STORIES 36.2-36.5): 2,036 -> 2,042 AND 428 -> 433, WITH THE REASON
  //
  // Epic 36 added six tracked files under the `files` roots: one markdown
  // (`docs/on-prem-runtime.md`, 36.2, counted in AC7.5c above) and five in the
  // UNSCANNED remainder — `scripts/build-wheelhouse.py` (36.2), `lib/bundle.js`
  // and `lib/runtime/uv.js` (36.3), `scripts/validate_customize.py` (36.4) and
  // `lib/inject/marker-block.js` (36.5). No structured file was added, so the
  // structured population (325) does not move. `all` moves by +6, the markdown
  // population by +1 and the remainder by +5. Their text is installer and
  // validator code with no FR266 vocabulary. Found by Story 36.6's Linux chain
  // run (this suite failed at HEAD and passed at 38ea256). Verifiable:
  //
  //     git diff --name-status --diff-filter=A 38ea256..HEAD -- docs/ lib/ scripts/ skills/ bin/
  const all = shippedFilesWithExtensions(['']); // '' matches every filename
  assert.strictEqual(all.length, 2042,
    `the shipped tracked population must be what the record says: found ${all.length}`);
  assert.strictEqual(all.length - md.size - structured.length, 433,
    'and the UNSCANNED remainder must be the 433 files item 16 enumerates');
});

test('AC7.5i [end-to-end] a TOML external_handoffs mirror directive is REPORTED, and was NOT before', () => {
  // ─── THE ANTI-VACUITY PROOF FOR ATTACK 6, IN BOTH DIRECTIONS ─────────────
  //
  // Half of a widening test is worthless on its own: an assertion that a mirror
  // is caught can be true because the PREDICATE catches it, while the file it
  // lives in is still never opened. That is this epic's signature defect and it
  // has already been shipped once here (FIX-4). So this asserts both:
  //
  //   FORWARD  — the real scan path reports the plant;
  //   REVERSE  — the markdown-only file predicate does NOT admit the plant's
  //              file, so before this change the plant could not have been seen
  //              at all, no matter what the predicate said.
  //
  // The plant is the natural shape for this vehicle, not a contrived string: an
  // `external_handoffs` entry with a READ-BACK direction, in the same key whose
  // shipped SKILL.md says "execute each entry in `{workflow.external_handoffs}`
  // … Invoke the tool".
  const PLANT = 'external_handoffs = [{ directive = "download every Confluence page in the '
    + 'software requirements store into _bmad-output/pages/ and read from there on every '
    + 'later run", tool = "corp:confluence_download" }]';

  //
  // ─── FIX-4 (fix round 5): "END-TO-END" NOW MEANS THE REAL SCAN LIST ──────
  //
  // This test was labelled [end-to-end] and was not. It called
  // `mirrorWindowsOutsidePinnedBlocks` with a width restated here, and checked
  // the vehicle against `shippedStructuredText()` — never against
  // `shippedTextToScan()`, the list AC7.5 and AC7.5d actually walk. Mutation M1
  // (drop the structured half from `shippedTextToScan()`) therefore left this
  // test green while the real scan narrowed back to markdown-only.
  //
  // The vehicle's entry is now looked up IN the scan list, and the window used
  // for the forward half is READ OFF that entry rather than restated. If the
  // scan stops carrying this file, or carries it at the markdown width, the
  // lookup fails and so does this test.
  // ─── FR75: THE ORIGINAL VEHICLE NO LONGER SHIPS ──────────────────────
  //
  // Attack 6 was found on a `gds` customize.toml, and `gds` is no longer
  // bundled. The carrier below is another vendored TOML that still ships and is
  // still non-markdown; what it carries is the POPULATION half of the proof,
  // which never depended on the file's contents. The contents half is asserted
  // at the bottom of this test, and it now asserts the absence.
  const REAL = path.join(REPO_ROOT, 'lib', 'bmad-cache', 'tea', 'src', 'workflows',
    'testarch', 'bmad-testarch-trace', 'customize.toml');
  assert.ok(fs.existsSync(REAL), 'the non-markdown carrier must exist to prove this on');
  const scanList = shippedTextToScan();
  const entry = scanList.find((e) => e.abs === REAL);
  assert.ok(entry,
    'the real vehicle must be in shippedTextToScan() — the list the REAL scan walks. If it is '
    + 'not, AC7.5 does not open this file however loud its contents are, and this test is a '
    + 'statement about a function nothing calls.');
  assert.strictEqual(entry.window, MIRROR_WINDOW_LINES_STRUCTURED,
    `and the real scan must pair it with the structured width; got ${entry.window}`);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ac75i-'));
  try {
    const abs = path.join(dir, 'customize.toml');
    fs.writeFileSync(abs, ['# External-handoff routing.', '', PLANT, ''].join('\n'), 'utf-8');

    // FORWARD. Through the real function, at the width the REAL SCAN LIST pairs
    // with this exact vehicle — taken from `entry`, not restated.
    const hits = mirrorWindowsOutsidePinnedBlocks(abs, entry.window);
    assert.ok(hits.length > 0,
      'the planted TOML mirror must be REPORTED by the real scan path');
    assert.ok(hits.some((h) => h.text.includes('read from there on every later run')),
      `the reported window must be the plant itself. Got: ${hits.map((h) => h.text).join(' | ')}`);
    for (const h of hits) {
      assert.ok(!ADJUDICATED_MIRROR_PASSAGES[sha(h.text).slice(0, 8)],
        'a planted mirror is a stray, not an adjudicated exception');
    }

    // REVERSE, and this is the half that proves the POPULATION widened rather
    // than an assertion being added that was already true. The markdown
    // population's file predicate is `.md`-only; a `.toml` file is invisible to
    // it however loud its contents are.
    assert.ok(!'customize.toml'.toLowerCase().endsWith('.md'),
      'sanity: the plant does not live in a markdown file');
    const mdPop = new Set(shippedMarkdown());
    // The "after" side is read off the REAL SCAN LIST, not off
    // `shippedStructuredText()` — the whole point of FIX-4 is that the scan
    // list is the thing that must contain the file.
    const scannedPop = new Set(scanList.map((e) => e.abs));
    assert.ok(!mdPop.has(REAL),
      'the markdown-only population must NOT contain the real vehicle — that was the hole');
    assert.ok(scannedPop.has(REAL),
      'and the list the real scan walks must contain it — that is the fix');

    // …and the state of the tree is recorded rather than assumed. FR75 removed
    // the only modules that DECLARED `external_handoffs` values, so no shipped
    // file now assigns that key and there is nothing for an agent to execute.
    // That is an ASSERTION, not a comment: if an upstream sync reintroduces a
    // declaration, this fails and a human re-reads it against the closed set,
    // which is the point of the gate. The widened scan is what keeps a
    // reintroduced one visible in the meantime.
    //
    // A DECLARATION, not a mention. One shipped file still NAMES the key —
    // bmb's customize.toml authoring guide, which documents the four
    // append-only arrays in a schema table. Documentation of a key is not a
    // routing instruction: it assigns nothing, names no tool and no
    // destination, and AC7.5's own vocabulary scan reports zero hits in it. It
    // is pinned below by name so it cannot quietly become a declaration.
    const files = shippedTextToScan()
      .map((e) => ({
        rel: path.relative(REPO_ROOT, e.abs).split(path.sep).join('/'),
        text: fs.readFileSync(e.abs, 'utf-8'),
      }));
    const declarers = files
      .filter((f) => /external_handoffs\s*[=:]/.test(f.text))
      .map((f) => f.rel);
    assert.deepStrictEqual(declarers, [],
      `a shipped file declares external_handoffs again: ${declarers.join(', ')} — ` +
      `re-adjudicate it against the closed set before this gate passes`);

    const mentions = files.filter((f) => /external_handoffs/.test(f.text)).map((f) => f.rel);
    assert.deepStrictEqual(mentions,
      ['lib/bmad-cache/bmb/skills/bmad-workflow-builder/references/customize-toml-guide.md'],
      `the only shipped mention of external_handoffs must be bmb's schema ` +
      `documentation; got: ${mentions.join(', ')}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('AC7.5j [control] every pinned carve-out is EXACTLY the canonical block — a pin cannot swallow live instruction text', () => {
  // ─── THE CONTROL FOR ATTACK 7 (fix round 5, FIX-2) ───────────────────────
  //
  // The pinned blocks are a hole in the AC7.5 scan by design: the closed set
  // excuses them because their bytes are pinned by digest elsewhere. That excuse
  // holds only while the carve-out and the pinned block are the SAME BYTES. They
  // stopped being the same bytes the moment a block was spliced into a file with
  // no following column-0 `## `, and the resulting 26-line over-pin was a live,
  // exploitable blind spot (see `extractBlockRanges`).
  //
  // This asserts the invariant directly and over the WHOLE scanned population,
  // so it generalises past the one file that broke it.
  const HEADINGS = [[PREFLIGHT_HEADING, 'preflight'], [GATE_HEADING, 'gate']];

  // The canonical blocks, and their lengths, pinned LITERALLY here as well as
  // read from the tree. Both digests are AC7.1's and AC7.2's — restated so this
  // control cannot be satisfied by a canonical block that quietly changed.
  const canonical = {};
  for (const [h] of HEADINGS) canonical[h] = canonicalPinnedBlock(h);
  assert.strictEqual(sha(canonical[PREFLIGHT_HEADING].text),
    'ca9bf25ba475f11ac760e8c92a2d41f92a21298d9f11df55881527673e67051f',
    'the canonical preflight block is the one AC7.1 pins');
  assert.strictEqual(canonical[PREFLIGHT_HEADING].lines, 111,
    `the preflight block is 111 lines; got ${canonical[PREFLIGHT_HEADING].lines}`);
  assert.strictEqual(sha(canonical[GATE_HEADING].text),
    'cda3d3d99cff06edb3b7bbb00bc1399d6a060fc153829fba7108cdfb91b09cfb',
    'the canonical gate block is the one AC7.2 pins');
  assert.strictEqual(canonical[GATE_HEADING].lines, 48,
    `the gate block is 48 lines; got ${canonical[GATE_HEADING].lines}`);

  const notCanonical = [];
  const overRunning = [];
  const carveOuts = { preflight: 0, gate: 0 };
  const files = new Set();

  for (const { abs } of shippedTextToScan()) {
    const rel = path.relative(REPO_ROOT, abs).replace(/\\/g, '/');
    const lines = fs.readFileSync(abs, 'utf-8').replace(/\r\n/g, '\n').split('\n');
    for (const [heading, name] of HEADINGS) {
      // (a) FORWARD — what the scan actually carves out must BE the block.
      for (const [a, b] of extractBlockRanges(lines, heading)) {
        carveOuts[name] += 1;
        files.add(rel);
        const text = lines.slice(a, b + 1).join('\n');
        if (text !== canonical[heading].text) {
          notCanonical.push(`${rel}:${a + 1}-${b + 1} (${name}, ${b - a + 1} lines) — the carve-out `
            + `is not byte-identical to the canonical block`);
        }
      }
      // (b) DIAGNOSTIC — which files' RAW `## `-to-`## ` extent over-runs their
      // block. Capping makes the over-run harmless, but it does NOT make it go
      // away, and an over-running extent is the signature of a block spliced
      // into a file that cannot terminate it. Pinned to the one known instance
      // so the NEXT one fails here and is looked at by a human.
      for (const [a, b] of extractBlockExtentsRaw(lines, heading)) {
        const ext = lines.slice(a, b + 1);
        while (ext.length && ext[ext.length - 1].trim() === '') ext.pop();
        if (ext.length !== canonical[heading].lines) {
          overRunning.push(`${rel}:${a + 1}-${b + 1} (${name}) raw extent is ${ext.length} lines `
            + `against a ${canonical[heading].lines}-line block`);
        }
      }
    }
  }

  assert.deepStrictEqual(notCanonical, [],
    `a pinned carve-out that is not the pinned block is a region of live instruction text `
    + `excused from the AC7.5 scan for no reason. Found:\n` + notCanonical.join('\n'));

  // The population, pinned in both directions: a carve-out that stops happening
  // is as much a change as one that appears.
  assert.deepStrictEqual(carveOuts, { preflight: 46, gate: 9 },
    `the shipped tree carries 46 preflight blocks (41 in the skills/ roots + 5 in the workflow `
    + `sources) and 9 gate blocks: ${JSON.stringify(carveOuts)}`);
  assert.strictEqual(files.size, 46,
    `spread over 46 files; found ${files.size}`);

  // The one known over-run, named. This is `remove-from-sprint`'s copy: the
  // block was spliced before `<workflow>`, and the raw extent only stops at all
  // because `## Sprints with Assigned Items` — markdown inside an `<output>`
  // block, not a document heading — happens to sit at column 0 at line 143.
  assert.deepStrictEqual(overRunning, [
    'lib/bmad-extension/workflows/remove-from-sprint/workflow.md:5-142 (preflight) raw extent '
    + 'is 138 lines against a 111-line block',
  ], `a NEW block copy cannot terminate its own extent. Cap it and adjudicate it. Found:\n`
    + overRunning.join('\n'));
});

test('AC7.5d [closed-set hygiene] every adjudicated-passage digest still matches a real passage', () => {
  // The closed set has to be closed in BOTH directions. An exception whose text
  // has since been deleted or rewritten is a hole that silently admits whatever
  // later happens to hash to it — and, more practically, it is a claim in this
  // file that no longer describes the shipped bytes.
  const live = new Set();
  for (const { abs, window } of shippedTextToScan()) {
    for (const hit of mirrorWindowsOutsidePinnedBlocks(abs, window)) {
      live.add(sha(hit.text).slice(0, 8));
    }
  }
  const stale = Object.keys(ADJUDICATED_MIRROR_PASSAGES).filter((d) => !live.has(d));
  assert.deepStrictEqual(stale, [],
    `these adjudicated-passage digests match nothing in the shipped tree any more and must be ` +
    `removed: ${stale.map((d) => `${d} (${ADJUDICATED_MIRROR_PASSAGES[d]})`).join(', ')}`);
});

test('AC7.6 the gate block\'s mirror lines are PROHIBITIONS — the pin cannot be satisfied by a permissive rewrite', () => {
  // The digest pin alone would let a REVIEWED digest change quietly invert the
  // meaning. These are the sentences that make the mirror words prohibitions.
  for (const { file, block } of collectBlocks(GATE_HEADING)) {
    assert.match(block,
      /do NOT write, copy, cache, export or reconcile a local copy of anything Confluence returns/,
      `${file}: FR266's retirement must remain an explicit prohibition`);
    assert.match(block,
      /There is no mirror and no cache, so there is nothing to synchronise and nothing to fall out of date\./,
      `${file}: the "no sync direction / no trigger" half of FR266's retirement must remain stated`);
  }
});

test('AC7.7 the Confluence page-tree module names FR266 retired and reads no page body', () => {
  // The CODE half of the negative. `lib/confluence-page-tree.js` is the only
  // module in this epic that could plausibly acquire a mirror, because it is the
  // one that talks about pages at all.
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'confluence-page-tree.js'), 'utf-8');
  assert.match(src, /FR266[^\n]*RETIRED/i, 'the module must state the retirement it is bound by');
  assert.match(src, /no sync direction, no sync trigger/,
    'the module must state that FR266\'s machinery is absent');
  // And it must not require anything that could fetch or persist: no http, no
  // fs write. Enumerated against what the module actually requires, with
  // comments STRIPPED FIRST — the module's own header documents the prohibition
  // by naming `require('http')`, and a scan that counted its own documentation
  // as a violation would be measuring the wrong artifact.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
  // ─── Story 31.14 fix round, FIX-2 attack 3 ────────────────────────────────
  //
  // The previous guard here was defeatable and the reviewer defeated it. Its
  // forbidden-module regex was `/^(https?|net|tls|...)$/`, which does NOT match
  // a `node:` PREFIX, and its writer list was five SYNC names. So
  // `require('node:https')` plus `fs.promises.writeFile` walked straight past a
  // green suite. (The code half was never actually undefended: Story 31.10's
  // suite bans `require(` in this module outright, and THAT is what caught the
  // planted attack. This assertion was simply the weaker of the two guards.)
  //
  // The primary assertion is therefore now the strong one — this module
  // requires NOTHING — with the enumerated lists kept behind it as the
  // diagnostic that names WHAT was added, and both holes closed.
  const requires = [...code.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]).sort();
  assert.deepStrictEqual(requires, [],
    `lib/confluence-page-tree.js is a pure data module and must require NOTHING — it cannot ` +
    `acquire a capability it never imports. Found: ${JSON.stringify(requires)}`);

  // Network, with the `node:` prefix stripped before matching. A bare
  // `require('https')` and `require('node:https')` are the SAME MODULE and must
  // be the same finding.
  const NETWORK_MODULES = /^(https?|http2|net|tls|dgram|dns|child_process|worker_threads|inspector|axios|node-fetch|undici|got|superagent|request)$/;
  const forbidden = requires
    .map((r) => r.replace(/^node:/, ''))
    .filter((r) => NETWORK_MODULES.test(r));
  assert.deepStrictEqual(forbidden, [],
    `the page-tree module must not be able to reach a network: ${JSON.stringify(forbidden)}`);

  // Dynamic acquisition, which no enumeration of require ARGUMENTS can see.
  for (const [re, what] of [
    [/\bimport\s*\(/, 'a dynamic import()'],
    [/\bcreateRequire\b/, 'module.createRequire'],
    [/\bprocess\.binding\b/, 'process.binding'],
    [/\beval\s*\(|new\s+Function\s*\(/, 'eval / new Function'],
  ]) {
    assert.ok(!re.test(code),
      `the page-tree module must not be able to acquire a capability dynamically: found ${what}`);
  }

  // Disk writes. The previous list was SYNC-ONLY, so every `fs.promises` and
  // callback-style writer was invisible to it.
  const writers = [
    'writeFileSync', 'appendFileSync', 'mkdirSync', 'createWriteStream', 'copyFileSync',
    'writeSync', 'rmSync', 'renameSync', 'openSync', 'truncateSync', 'cpSync',
    // …and the async half of every one of them, plus the promises namespace.
    'writeFile', 'appendFile', 'mkdtemp', 'copyFile', 'fs.promises', 'promises.write',
    'fsPromises', 'fs/promises',
  ].filter((w) => code.includes(w));
  assert.deepStrictEqual(writers, [],
    `the page-tree module must not be able to write to disk — that is how it would become a ` +
    `mirror. Found: ${JSON.stringify(writers)}`);
});

test('AC7.7b [harness] the widened capability guard CATCHES the node:-prefix + async-fs bypass', () => {
  // The control for attack 3. This is the exact shape the reviewer planted and
  // the old guard passed: a `node:`-prefixed network require, which its
  // unanchored-to-prefix regex did not match, and an async write, which its
  // five sync writer names did not name.
  const planted = "const https = require('node:https');\nawait fs.promises.writeFile(dest, body);\n";

  // The BYPASS, demonstrated against the old assertions.
  const oldNetwork = /^(https?|net|tls|dgram|child_process|axios|node-fetch|undici)$/;
  const plantedRequires = [...planted.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
  assert.ok(plantedRequires.includes('node:https'), 'the plant must actually require a network module');
  assert.ok(!plantedRequires.some((r) => oldNetwork.test(r)),
    'the harness is pointless unless the OLD regex genuinely missed the node: prefix');
  const oldWriters = ['writeFileSync', 'appendFileSync', 'mkdirSync', 'createWriteStream', 'copyFileSync'];
  assert.ok(!oldWriters.some((w) => planted.includes(w)),
    'and unless the OLD writer list genuinely missed the async write');

  // The FIX: both halves are now findings.
  const NETWORK_MODULES = /^(https?|http2|net|tls|dgram|dns|child_process|worker_threads|inspector|axios|node-fetch|undici|got|superagent|request)$/;
  assert.ok(plantedRequires.map((r) => r.replace(/^node:/, '')).some((r) => NETWORK_MODULES.test(r)),
    'the widened network list must match node:https');
  assert.ok(['writeFile', 'fs.promises'].some((w) => planted.includes(w)),
    'and the widened writer list must match fs.promises.writeFile');
  // And the primary assertion — require NOTHING — catches it regardless of any list.
  assert.ok(plantedRequires.length > 0,
    'the require-nothing assertion catches this without needing either list to be complete');
});

test('AC7.8 no shipped file path suggests a mirror store (no mirror/cache dir is created anywhere)', () => {
  // Enumeration over the SHIPPED tree, by name. A `confluence-cache/` or
  // `.confluence-mirror/` directory would be caught here even if no code
  // referenced it in a way the vocabulary scan saw.
  const suspicious = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const abs = path.join(dir, e.name);
      if (/(mirror|confluence[-_]?cache|page[-_]?cache)/i.test(e.name)) {
        suspicious.push(path.relative(REPO_ROOT, abs).replace(/\\/g, '/'));
      }
      if (e.isDirectory()) walk(abs);
    }
  };
  for (const rel of ['bin', 'lib', 'skills', 'scripts']) {
    const d = path.join(REPO_ROOT, rel);
    if (fs.existsSync(d)) walk(d);
  }
  assert.deepStrictEqual(suspicious, [],
    `no shipped path may be named for a mirror or a page cache: ${JSON.stringify(suspicious)}`);
});

test('AC7.9 FR266 is recorded as RETIRED in the PRD, and no story claims to implement it', () => {
  // The outside authority. If FR266 were ever un-retired, this gate should stop
  // asserting its absence — so the absence check is bound to the PRD saying it
  // is retired, not merely to nobody having implemented it.
  const prd = fs.readFileSync(
    path.join(REPO_ROOT, '_bmad-output', 'planning-artifacts', 'prd', 'capabilities',
      'project-knowledge-and-repository-layout.md'),
    'utf-8'
  );
  assert.match(prd, /FR266:.*\[RETIRED 2026-08-01, before implementation\]/,
    'FR266 must still be recorded as retired in the PRD');
  assert.match(prd, /ID retired, never reused\./, 'and the ID must still be reserved');
});

// ═════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n' + '='.repeat(60));
console.log(`Story 31.14 release gate: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('Failures:');
  for (const e of errors) console.log(`  ${e.name}:\n    ${e.error}`);
}
summaryPrinted = true;

// ─── THE COUNT, PINNED IN BOTH DIRECTIONS ────────────────────────────────────
//
// Story 31.14 fix round. Six sibling suites in this epic pin their own test
// count (`global-install-scope`, `project-layout-artifact-routing`,
// `project-layout-bind` and others) and this one — the release gate itself —
// did not. That is the wrong suite to leave unpinned: a test that stops running
// reports nothing, and "0 failed" over a silently shrunken set is exactly the
// presence-rather-than-effect shape this epic produced six times. A DEFICIT
// catches an assertion lost to a rename, a merge or an early return; a SURPLUS
// catches one added without being recorded in the gate document, which is the
// artifact these assertions exist to support.
const EXPECTED_TEST_COUNT = 43;
const total = passed + failed;
if (total !== EXPECTED_TEST_COUNT) {
  console.error(`\n  FATAL: ran ${total} tests, expected exactly ${EXPECTED_TEST_COUNT}. ` +
    `If you added or removed a test, update EXPECTED_TEST_COUNT — and update ` +
    `_bmad-output/implementation-artifacts/31-14-release-gate.md, which cites this count.`);
  process.exit(1);
}
process.exit(failed > 0 ? 1 : 0);
