/**
 * Story 31.15 — THE PUBLISH TRIGGER for the five BMAD authoring skills.
 * (Completes FR255/FR256/FR260 by supplying the trigger Story 31.10 built the
 * protocol for; consumes FR261/FR262, FR264, P5-9.6, P5-9.7.)
 *
 * ════════════════════════════════════════════════════════════════════════════
 * THE ENVIRONMENT LIMIT, STATED HERE AND NOT INHERITED SILENTLY (§2)
 * ════════════════════════════════════════════════════════════════════════════
 * The `claude.ai Atlassian Rovo` MCP server is unauthorised and cannot be
 * authorised from a non-interactive session. EVERY claim in this story about
 * what happens when a Confluence MCP is present is MOCK-VERIFIED, NOT LIVE. No
 * page is created in, updated in, or read from a Confluence instance by this
 * suite.
 *
 * What IS verified live, on this side of that boundary, and by this file:
 *   · the override files are written where they are claimed to be written;
 *   · they resolve THROUGH THE REAL `resolve_customization.py` — the byte-identical
 *     upstream script, run as a subprocess, never a re-implementation of the
 *     three-layer merge — to a non-empty `on_complete`;
 *   · their text carries the FR262 fail-loud and the FR266 no-mirror obligations;
 *   · a user's own overrides survive byte-identical;
 *   · the shipped invariants do not move.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * HOW THIS SUITE IS BUILT, AND WHY
 * ════════════════════════════════════════════════════════════════════════════
 * Epic 31 has produced six TAUTOLOGICAL tests — the expectation and the code
 * taken from one source, so both move together and a wrong value stays green.
 * One of them let the architecture document be reassigned to the wrong store
 * with a passing suite. This file is organised to make that shape unavailable:
 *
 *   · THE FIVE SKILLS AND THEIR STORES are not listed here and not imported from
 *     the implementation. They are DERIVED at test time from two authorities
 *     outside both: FR264's enumeration sentence in the PRD shard (which store
 *     each artifact resolves to) and the VENDORED upstream `bmad-method` skill
 *     tree (which skill produces each artifact). Flipping a row in
 *     `AUTHORING_SKILL_STORES` fails against the PRD; renaming a skill fails
 *     against upstream.
 *   · THE TOML READER is not asserted correct. It is measured against REAL
 *     `tomllib`, in a subprocess, over a corpus that includes every shipped
 *     `customize.toml` in the vendored tree. A disagreement is a failure, in
 *     either direction — a false REJECTION would refuse to write the hook on a
 *     real project, which is worse than a false acceptance.
 *   · THE MERGE SEMANTICS are not modelled. Every claim about what an override
 *     does is made by running the real resolver and reading its JSON.
 *   · THE FR266 VOCABULARY is not restated. It is EXTRACTED from
 *     `test/release-gate-epic-31.test.js`, so a vocabulary widened there
 *     tightens this check automatically instead of leaving it behind. The
 *     extraction is proved armed (it must detect FR266 restored verbatim) before
 *     anything relies on it.
 *
 * A PREREQUISITE, FAILED LOUD RATHER THAN SKIPPED. Several sections need a
 * Python 3.11+ interpreter, because the resolver is the thing under test and a
 * re-implementation of it would prove nothing. If none is found those tests
 * FAIL and say so. They are not skipped: a skipped test that reads as a pass is
 * precisely the defect shape this epic keeps producing, and Python 3.11+ is
 * already a hard prerequisite of every one of the five skills' activation steps.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawnSync, execFileSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const cli = require(path.join(PROJECT_ROOT, 'bin', 'cli.js'));
const hook = require(path.join(PROJECT_ROOT, 'lib', 'confluence-publish-hook.js'));
const tree = require(path.join(PROJECT_ROOT, 'lib', 'confluence-page-tree.js'));

const EXPECTED_TEST_COUNT = 80;

let passed = 0;
let failed = 0;
const errors = [];

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

const TMP_ROOTS = [];
function tmpProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-pubhook-'));
  TMP_ROOTS.push(root);
  return root;
}
process.on('exit', () => {
  for (const r of TMP_ROOTS) {
    try { fs.rmSync(r, { recursive: true, force: true }); } catch (_) { /* best effort */ }
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 0 — THE HARNESS AND ITS PREREQUISITES, PROVED BEFORE ANYTHING RELIES
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 0. The harness proves itself armed ===\n');

test('0.1 [harness] the runner records a FAILURE, so a green run means something', () => {
  let sawFailure = false;
  try {
    assert.strictEqual(1, 2, 'deliberate');
  } catch (e) {
    sawFailure = true;
  }
  assert.ok(sawFailure, 'assert.strictEqual did not throw on an unequal pair');
});

/**
 * A Python 3.11+ interpreter, or null. Probed once.
 *
 * `uv run` is deliberately NOT probed: `test/uv-transition-resilience.test.js`
 * AC3/NFR59c pins ma-agents control-plane Python to `python`/`python3`, and the
 * literal string would also plant `uv run` in a file that guard walks.
 */
const PYTHON = (() => {
  const candidates = [['python3', []], ['python', []], ['py', ['-3']]];
  for (const [exe, pre] of candidates) {
    const r = spawnSync(exe, [...pre, '-c', 'import tomllib; print("ok")'], { encoding: 'utf8' });
    if (r.status === 0 && String(r.stdout).includes('ok')) return { exe, pre };
  }
  return null;
})();

function python(args, opts) {
  assert.ok(PYTHON,
    'no Python 3.11+ interpreter with `tomllib` was found on PATH. This is a PREREQUISITE, ' +
    'not an optional extra: the resolver is the thing under test, a re-implementation of it ' +
    'would prove nothing, and every one of the five skills already requires this interpreter ' +
    'at activation. Install Python 3.11+ and re-run — do not weaken this to a skip.');
  return spawnSync(PYTHON.exe, [...PYTHON.pre, ...args], { encoding: 'utf8', ...(opts || {}) });
}

test('0.2 [harness] a Python 3.11+ interpreter with tomllib is available', () => {
  assert.ok(PYTHON, 'no python3/python/py -3 on PATH could `import tomllib` (needs Python 3.11+)');
});

/** The vendored upstream resolver — the same bytes a project gets installed. */
const RESOLVER_SRC = path.join(
  PROJECT_ROOT, 'node_modules', 'bmad-method', 'src', 'scripts', 'resolve_customization.py');

test('0.3 [authority] the vendored upstream resolver is present and is the one under test', () => {
  assert.ok(fs.existsSync(RESOLVER_SRC),
    `the real resolver must be readable at ${RESOLVER_SRC}; without it every merge claim in ` +
    `this suite would be a claim about a re-implementation`);
  const src = fs.readFileSync(RESOLVER_SRC, 'utf-8');
  // The two behaviours this whole story is built around, read out of the shipped
  // script rather than assumed of it.
  assert.ok(/level = "error" if required else "warning"/.test(src),
    'the resolver no longer downgrades a non-required layer parse failure to a warning; ' +
    'AC4 and AC12 are built on that behaviour and must be re-derived');
  assert.ok(/return override\n/.test(src),
    "the resolver's deep_merge no longer falls through to `return override`; AC7's scalar " +
    'residual must be re-derived');
});

// ═════════════════════════════════════════════════════════════════════════════
// THE ORACLE — BUILT FROM AUTHORITIES OUTSIDE THE IMPLEMENTATION
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 1. AC1/AC6 — the five, and their stores, derived from FR264 ===\n');

const PRD_REL = 'planning-artifacts/prd/capabilities/project-knowledge-and-repository-layout.md';
const PRD_ABS = path.join(PROJECT_ROOT, '_bmad-output', PRD_REL);

/**
 * FR264's enumeration sentence, parsed.
 *
 * The authority, verbatim from the PRD shard:
 *
 *   "Only the workflows FR119 enumerates as producing store-specific artifacts
 *    read the new fields — product brief and PRD resolve to the system store,
 *    architecture, UX and epics to the software store."
 *
 * This sentence, and no list in the implementation, is the definition of "the
 * five" and of which store each publishes to.
 *
 * @returns {Map<string, string>} lower-cased artifact noun -> store id
 */
function artifactStoresFromFR264() {
  const prd = fs.readFileSync(PRD_ABS, 'utf-8');
  const fr264 = prd.split(/\r?\n/).find((l) => l.startsWith('- FR264:'));
  assert.ok(fr264, `FR264 not found in ${PRD_REL}; the oracle has no source`);

  const m = /—\s*(.+?)\s+resolve to the (\w+) store,\s*(.+?)\s+to the (\w+) store\./.exec(fr264);
  assert.ok(m, `FR264's enumeration sentence did not parse: ${JSON.stringify(fr264.slice(0, 400))}`);

  // The store WORDS in the sentence are mapped to store IDS through the shipped
  // labels ("system requirements store" / "software requirements store"), and
  // the match is asserted unique — so a renamed store fails here rather than
  // silently routing to the other one.
  const storeIdForWord = (word) => {
    const hits = tree.PUBLISHING_STORES.filter((id) => tree.labelForStore(id).split(/\s+/)[0] === word);
    assert.strictEqual(hits.length, 1,
      `FR264 names the "${word} store"; the shipped store labels match it ${hits.length} times ` +
      `(${tree.PUBLISHING_STORES.map((id) => tree.labelForStore(id)).join(' | ')})`);
    return hits[0];
  };

  const out = new Map();
  for (const [list, word] of [[m[1], m[2]], [m[3], m[4]]]) {
    const storeId = storeIdForWord(word);
    for (const noun of list.split(/,\s*|\s+and\s+/).map((x) => x.trim().toLowerCase()).filter(Boolean)) {
      out.set(noun, storeId);
    }
  }
  return out;
}

const FR264_ARTIFACT_STORES = artifactStoresFromFR264();

test('1.1 [authority] FR264 parses into a NON-EMPTY set of exactly five artifacts over two stores', () => {
  // Task 3.1. A parse failure must fail the suite, never make it vacuously green.
  assert.strictEqual(FR264_ARTIFACT_STORES.size, 5,
    `FR264's sentence yielded ${FR264_ARTIFACT_STORES.size} artifacts ` +
    `(${[...FR264_ARTIFACT_STORES.keys()].join(', ')}); the story is about five`);
  assert.deepStrictEqual([...new Set(FR264_ARTIFACT_STORES.values())].sort(),
    [...tree.PUBLISHING_STORES].sort(),
    'FR264 must assign artifacts to BOTH publishing stores; a one-store oracle could not tell ' +
    'a routing defect from a correct routing');
});

test('1.2 [authority] FR255 and FR256 corroborate FR264 artifact by artifact', () => {
  // A SECOND PRD sentence for the same fact. FR264 could be edited alone; these
  // two could not be, without the disagreement showing up here.
  const prd = fs.readFileSync(PRD_ABS, 'utf-8').split(/\r?\n/);
  const fr255 = prd.find((l) => l.startsWith('- FR255:')) || '';
  const fr256 = prd.find((l) => l.startsWith('- FR256:')) || '';
  assert.ok(fr255 && fr256, 'FR255/FR256 not found; the corroboration has no source');
  const systemId = FR264_ARTIFACT_STORES.get('product brief');
  for (const [noun, storeId] of FR264_ARTIFACT_STORES) {
    const sentence = storeId === systemId ? fr255 : fr256;
    const needle = noun === 'prd' ? 'PRD' : noun === 'ux' ? 'UX' : noun;
    assert.ok(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(sentence),
      `FR264 assigns "${noun}" to ${tree.labelForStore(storeId)}, but that store's own ` +
      `requirement (${storeId === systemId ? 'FR255' : 'FR256'}) does not mention it`);
  }
});

/**
 * The artifact-noun -> deployed-skill-name correspondence, derived from the
 * VENDORED UPSTREAM TREE and not from ma-agents.
 *
 * The population is every `bmm-skills` workflow whose own `customize.toml`
 * exposes `on_complete` — i.e. every skill this channel could possibly reach —
 * minus those upstream itself marks DEPRECATED in their SKILL.md description
 * (`bmad-create-prd`, `bmad-edit-prd`, `bmad-validate-prd`,
 * `bmad-create-architecture` all say "DEPRECATED — consolidated into …").
 * The match must be UNIQUE, which is what makes it a derivation rather than a
 * choice: an upstream rename, or a deprecated skill un-deprecated, fails here.
 */
function skillForArtifactNoun(noun) {
  const bmm = path.join(PROJECT_ROOT, 'node_modules', 'bmad-method', 'src', 'bmm-skills');
  const candidates = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const p = path.join(dir, e.name);
      const ct = path.join(p, 'customize.toml');
      if (fs.existsSync(ct)) {
        const toml = fs.readFileSync(ct, 'utf-8');
        const skillMd = path.join(p, 'SKILL.md');
        const md = fs.existsSync(skillMd) ? fs.readFileSync(skillMd, 'utf-8') : '';
        if (/^on_complete\s*=/m.test(toml) && !/DEPRECATED/.test(md.slice(0, 1200))) {
          candidates.push(e.name);
        }
      }
      walk(p);
    }
  };
  walk(bmm);
  const tokens = noun.split(/\s+/).map((t) => t.toLowerCase());
  const hits = candidates.filter((name) => tokens.every((t) => name.toLowerCase().includes(t)));
  assert.strictEqual(hits.length, 1,
    `FR264's artifact "${noun}" matches ${hits.length} live upstream workflow skill(s) ` +
    `(${hits.join(', ') || 'none'}) among ${candidates.length} candidates. The correspondence ` +
    `must be unique, or the oracle is a choice rather than a derivation.`);
  return hits[0];
}

/** skill name -> store id, built entirely from outside authorities. */
const ORACLE = (() => {
  const out = new Map();
  for (const [noun, storeId] of FR264_ARTIFACT_STORES) out.set(skillForArtifactNoun(noun), storeId);
  return out;
})();

test('1.3 [authority] the oracle names exactly five distinct upstream skills', () => {
  assert.strictEqual(ORACLE.size, 5,
    `the noun->skill derivation produced ${ORACLE.size} skills (${[...ORACLE.keys()].join(', ')})`);
});

test('1.4 AC1 the implementation covers EXACTLY the five the PRD enumerates', () => {
  assert.deepStrictEqual([...hook.AUTHORING_SKILLS].sort(), [...ORACLE.keys()].sort(),
    `AUTHORING_SKILL_STORES names ${JSON.stringify([...hook.AUTHORING_SKILLS].sort())}, ` +
    `FR264 + the upstream tree name ${JSON.stringify([...ORACLE.keys()].sort())}. A skill ` +
    `silently dropped from the implementation fails here; a hard-coded list of five would not.`);
});

test('1.5 AC6 each skill is routed to the store the PRD assigns its artifact to', () => {
  for (const [skill, storeId] of ORACLE) {
    assert.strictEqual(hook.AUTHORING_SKILL_STORES[skill], storeId,
      `${skill} is routed to ${JSON.stringify(hook.AUTHORING_SKILL_STORES[skill])}; FR264 ` +
      `assigns its artifact to ${JSON.stringify(storeId)} (${tree.labelForStore(storeId)})`);
  }
  // And the partition is real in BOTH directions, so a table that put all five in
  // one store could not pass by accident.
  const bySt = {};
  for (const [, s] of ORACLE) bySt[s] = (bySt[s] || 0) + 1;
  assert.deepStrictEqual(Object.values(bySt).sort(), [2, 3],
    `FR264 splits the five 2/3 across the two stores; the oracle split is ` +
    `${JSON.stringify(bySt)}`);
});

test('1.6 AC6 [cross-check] Story 31.6\'s shipped routing table agrees — as a SECOND opinion', () => {
  // Explicitly not the oracle (it is downstream of the same PRD sentences). It is
  // checked because two independent statements disagreeing is information.
  const kindForNoun = { 'product brief': 'product-brief', prd: 'prd', architecture: 'architecture', ux: 'ux-design-specification', epics: 'epics' };
  for (const [noun, storeId] of FR264_ARTIFACT_STORES) {
    const kind = kindForNoun[noun];
    assert.ok(kind, `no artifact kind is known for FR264's "${noun}"`);
    assert.strictEqual(tree.ARTIFACT_KIND_OWNER[kind], storeId,
      `Story 31.6's ARTIFACT_KIND_OWNER routes ${kind} to ` +
      `${JSON.stringify(tree.ARTIFACT_KIND_OWNER[kind])} while FR264 assigns "${noun}" to ` +
      `${JSON.stringify(storeId)}`);
  }
});

test('1.7 AC1 [secondary authority] all five expose `on_complete` in their SHIPPED customize.toml', () => {
  for (const skill of hook.AUTHORING_SKILLS) {
    const ct = findUpstreamSkillFile(skill, 'customize.toml');
    assert.ok(ct, `${skill}: no upstream customize.toml found; the channel does not exist for it`);
    assert.ok(/^on_complete\s*=/m.test(fs.readFileSync(ct, 'utf-8')),
      `${skill}'s customize.toml does not define on_complete, so an override of it would ` +
      `resolve to nothing`);
  }
});

test('1.8 AC1 [secondary authority] all five RESOLVE customization at activation', () => {
  // `.claude/skills/<skill>/SKILL.md:18` — the contract that makes a team-layer
  // override reach the workflow at all. Without it this whole channel is inert.
  for (const skill of hook.AUTHORING_SKILLS) {
    const md = findUpstreamSkillFile(skill, 'SKILL.md');
    assert.ok(md, `${skill}: no upstream SKILL.md`);
    const text = fs.readFileSync(md, 'utf-8');
    assert.ok(/resolve_customization\.py/.test(text),
      `${skill}'s SKILL.md never invokes resolve_customization.py, so a team-layer override ` +
      `would never be read`);
    assert.ok(/## On Activation/.test(text),
      `${skill}: the resolution must be an ACTIVATION step, not something buried mid-workflow`);
  }
});

test('1.9 AC1 [secondary authority] all five CONSUME `{workflow.on_complete}` somewhere in their tree', () => {
  // The genuinely load-bearing fact, and the one the story's channel argument
  // actually rests on. TWO shapes exist upstream and both count, which is why
  // this is a line-level DIRECTIVE search and not a substring search for one
  // spelling:
  //   · four skills interpolate it — "Run `{workflow.on_complete}`";
  //   · `bmad-create-epics-and-stories` resolves it BY NAME in
  //     `steps/step-04-final-validation.md` — "If the resolved
  //     `workflow.on_complete` is non-empty, follow it as the final terminal
  //     instruction" — in a STEP FILE, not in its SKILL.md.
  // A SKILL.md-only search, or a search for the braced form alone, misses it.
  const RUN_THEN_KEY = /\b(run|follow|execute)\b.*\{?workflow\.on_complete\}?/i;
  const KEY_THEN_RUN = /\{?workflow\.on_complete\}?.*\b(follow it|execute it)\b/i;
  const DIRECTIVE = (line) => RUN_THEN_KEY.test(line) || KEY_THEN_RUN.test(line);
  for (const skill of hook.AUTHORING_SKILLS) {
    const dir = path.dirname(findUpstreamSkillFile(skill, 'SKILL.md'));
    let found = false;
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!e.name.endsWith('.md')) continue;
        for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
          if (DIRECTIVE(line)) found = true;
        }
      }
    };
    walk(dir);
    assert.ok(found,
      `${skill} never runs {workflow.on_complete}, so an override of it would be written and ` +
      `never executed — the trigger would be present without being effective`);
  }
});

test('1.10 AC1 [correction] the "all five refuse to begin" claim is TRUE OF FOUR — bmad-architecture excepted', () => {
  // §4.1 of the story states that all five "refuse to begin" until customization
  // resolves, citing `.claude/skills/bmad-prd/SKILL.md:26`. Measured against the
  // vendored upstream tree, FOUR carry that sentence and `bmad-architecture` does
  // not. It is not a blocker — 1.8 and 1.9 above are the facts the channel needs,
  // and architecture satisfies both — but the story's claim is over-stated and is
  // recorded here rather than repeated.
  //
  // Pinned as a FLOOR plus a named exception rather than as a list, so a SECOND
  // skill losing the sentence fails here instead of being absorbed.
  const without = hook.AUTHORING_SKILLS.filter((skill) => !(
    /Do not begin the main workflow until all activation steps have been completed/i
      .test(fs.readFileSync(findUpstreamSkillFile(skill, 'SKILL.md'), 'utf-8'))));
  assert.deepStrictEqual(without, ['bmad-architecture'],
    `the set of authoring skills lacking the explicit activation refusal is ` +
    `${JSON.stringify(without)}. It was exactly ["bmad-architecture"] when this story landed. ` +
    `A skill LEAVING the set is upstream fixing it; a skill JOINING it weakens the channel and ` +
    `must be looked at.`);
});

test('1.11 AC5(c) [ordering fact] the "artifact is ready" message precedes `on_complete` upstream', () => {
  // This is why AC5(c) exists and is not boilerplate: by the time the hook runs,
  // the user has ALREADY been told the artifact is finished.
  let checked = 0;
  for (const skill of hook.AUTHORING_SKILLS) {
    const md = findUpstreamSkillFile(skill, 'SKILL.md');
    const text = fs.readFileSync(md, 'utf-8');
    const share = text.search(/Share (artifact )?paths|surface URLs|Share paths/i);
    const run = text.search(/Run `\{workflow\.on_complete\}`/);
    if (share === -1 || run === -1) continue;
    checked++;
    assert.ok(share < run,
      `${skill}: \`on_complete\` no longer runs AFTER the artifact paths are shared, so AC5(c)'s ` +
      `"correct the message you already gave" clause would describe a message that has not been ` +
      `given yet`);
  }
  assert.ok(checked >= 3,
    `only ${checked} of the five skills could be checked for the ordering fact; AC5(c) cites ` +
    `three by name (bmad-prd, bmad-architecture, bmad-product-brief) so at least three must be ` +
    `measurable`);
});

/** Locate a file inside a vendored upstream skill, wherever its phase folder is. */
function findUpstreamSkillFile(skill, file) {
  const bmm = path.join(PROJECT_ROOT, 'node_modules', 'bmad-method', 'src');
  let found = null;
  const walk = (dir) => {
    if (found) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (found) return;
      if (!e.isDirectory()) continue;
      if (e.name === skill && fs.existsSync(path.join(dir, e.name, file))) {
        found = path.join(dir, e.name, file);
        return;
      }
      walk(path.join(dir, e.name));
    }
  };
  walk(bmm);
  return found;
}

// ═════════════════════════════════════════════════════════════════════════════
// THE FIXTURE — a project the generator and the real resolver both understand
// ═════════════════════════════════════════════════════════════════════════════

const SYSTEM = tree.SYSTEM_REQUIREMENTS;
const SOFTWARE = tree.SOFTWARE_REQUIREMENTS;

function storesFor(systemBackend, softwareBackend) {
  return {
    [SYSTEM]: { backend: systemBackend, cliName: 'system', label: tree.labelForStore(SYSTEM) },
    [SOFTWARE]: { backend: softwareBackend, cliName: 'software', label: tree.labelForStore(SOFTWARE) },
  };
}

/** A project root with the REAL resolver and real upstream `customize.toml`s. */
function fixture() {
  const root = tmpProject();
  fs.mkdirSync(path.join(root, '_bmad', 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, '_bmad', 'custom'), { recursive: true });
  fs.writeFileSync(path.join(root, '_bmad', 'custom', '.gitignore'), '*.user.toml\n', 'utf-8');
  fs.copyFileSync(RESOLVER_SRC, path.join(root, '_bmad', 'scripts', 'resolve_customization.py'));
  const skillDirs = {};
  for (const skill of hook.AUTHORING_SKILLS) {
    const dir = path.join(root, '.claude', 'skills', skill);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(findUpstreamSkillFile(skill, 'customize.toml'), path.join(dir, 'customize.toml'));
    skillDirs[skill] = dir;
  }
  return { root, skillDirs };
}

/** Run the REAL resolver. Returns `{status, stderr, value}`. */
function resolveKey(fx, skill, key) {
  const r = python([
    path.join(fx.root, '_bmad', 'scripts', 'resolve_customization.py'),
    '--skill', fx.skillDirs[skill], '--key', key,
  ]);
  let value;
  try { value = JSON.parse(r.stdout)[key]; } catch (_) { value = undefined; }
  return { status: r.status, stderr: r.stderr || '', value, stdout: r.stdout };
}

function generate(fx, stores) {
  return hook.generatePublishHooks({ projectRoot: fx.root, stores });
}

function teamFile(fx, skill) { return hook.customOverridePath(fx.root, skill); }
function userFile(fx, skill) { return hook.userOverridePath(fx.root, skill); }
function readIf(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null; }

const BOTH_CONFLUENCE = storesFor('confluence', 'confluence');
const NEITHER = storesFor('file-system', 'file-system');

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 2. AC1 — end to end, through the REAL resolver ===\n');

test('2.1 AC1 a confluence-backed project resolves a NON-EMPTY on_complete for all five', () => {
  const fx = fixture();
  const out = generate(fx, BOTH_CONFLUENCE);
  assert.deepStrictEqual(out.results.map((r) => r.outcome), Array(5).fill(hook.HOOK_WROTE),
    `not every skill got a hook: ${JSON.stringify(out.results.map((r) => [r.skill, r.outcome]))}`);
  for (const skill of hook.AUTHORING_SKILLS) {
    const got = resolveKey(fx, skill, 'workflow.on_complete');
    assert.strictEqual(got.status, 0, `${skill}: resolver exited ${got.status} — ${got.stderr}`);
    assert.ok(Array.isArray(got.value) && got.value.length === 1,
      `${skill}: on_complete resolved to ${JSON.stringify(got.value)}; expected a one-element array`);
    assert.ok(got.value[0].includes('ma-agents confluence-plan'),
      `${skill}: the resolved instruction does not name the shipped publish command`);
    assert.strictEqual(got.stderr.trim(), '',
      `${skill}: the resolver warned while reading a file this generator wrote: ${got.stderr}`);
  }
});

test('2.2 AC6 each skill\'s resolved instruction names ITS OWN store on the command line', () => {
  const fx = fixture();
  generate(fx, BOTH_CONFLUENCE);
  for (const [skill, storeId] of ORACLE) {
    const cliName = storeId === SYSTEM ? 'system' : 'software';
    const other = cliName === 'system' ? 'software' : 'system';
    const value = resolveKey(fx, skill, 'workflow.on_complete').value[0];
    assert.ok(value.includes(`--store ${cliName}`),
      `${skill} must publish to --store ${cliName} (FR264); its instruction says ` +
      `${JSON.stringify(value.slice(0, 200))}`);
    assert.ok(!value.includes(`--store ${other}`),
      `${skill}'s instruction also names --store ${other}; a project whose two stores differ ` +
      `would publish this artifact into the wrong space`);
  }
});

test('2.3 AC1 the hook is emitted as a TOML ARRAY, not a scalar (AC7 precondition)', () => {
  const fx = fixture();
  generate(fx, BOTH_CONFLUENCE);
  for (const skill of hook.AUTHORING_SKILLS) {
    assert.ok(Array.isArray(resolveKey(fx, skill, 'workflow.on_complete').value),
      `${skill}: a scalar is silently REPLACED by any user override (deep_merge's ` +
      `\`return override\` fallthrough); only an array appends`);
  }
});

test('2.4 AC1 the file is written to the TEAM layer path the resolver reads', () => {
  const fx = fixture();
  generate(fx, BOTH_CONFLUENCE);
  for (const skill of hook.AUTHORING_SKILLS) {
    const p = teamFile(fx, skill);
    assert.strictEqual(path.basename(p), `${skill}.toml`, 'wrong file name');
    assert.strictEqual(path.basename(path.dirname(p)), 'custom');
    assert.ok(fs.existsSync(p), `${skill}: ${p} was not created`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 3. AC2 — the personal layer is never touched ===\n');

test('3.1 AC2 a pre-seeded `.user.toml` is BYTE-IDENTICAL after a generation', () => {
  const fx = fixture();
  const seeded = {};
  for (const skill of hook.AUTHORING_SKILLS) {
    const body = `# personal, gitignored\nworkflow.on_complete = [ "${skill} personal" ]\n`;
    fs.writeFileSync(userFile(fx, skill), body, 'utf-8');
    seeded[skill] = fs.readFileSync(userFile(fx, skill));
  }
  generate(fx, BOTH_CONFLUENCE);
  for (const skill of hook.AUTHORING_SKILLS) {
    assert.ok(seeded[skill].equals(fs.readFileSync(userFile(fx, skill))),
      `${skill}.user.toml changed. P5-9.4's never-touch rule for config.user.toml extends here ` +
      `unchanged, and _bmad/custom/.gitignore (*.user.toml) is the project's own statement that ` +
      `this layer is not shared.`);
  }
});

test('3.2 AC2 no `.user.toml` is CREATED when none existed — on the write path or the removal path', () => {
  const fx = fixture();
  generate(fx, BOTH_CONFLUENCE);
  for (const skill of hook.AUTHORING_SKILLS) {
    assert.ok(!fs.existsSync(userFile(fx, skill)), `${skill}.user.toml was created by generation`);
  }
  generate(fx, NEITHER); // the removal path
  for (const skill of hook.AUTHORING_SKILLS) {
    assert.ok(!fs.existsSync(userFile(fx, skill)), `${skill}.user.toml was created by removal`);
  }
});

test('3.3 AC2 no fs mutation call anywhere in a full run names a `.user.toml` path', () => {
  // Stronger than an after-the-fact comparison: an open-truncate-restore would
  // leave the bytes identical and still be a touch. Every mutating fs entry point
  // is intercepted, over BOTH the write and the removal path.
  const fx = fixture();
  for (const skill of hook.AUTHORING_SKILLS) {
    fs.writeFileSync(userFile(fx, skill), '# mine\n', 'utf-8');
  }
  const touched = [];
  const MUTATORS = ['writeFileSync', 'appendFileSync', 'unlinkSync', 'openSync', 'rmSync',
    'truncateSync', 'copyFileSync', 'renameSync', 'createWriteStream', 'writeSync'];
  const originals = {};
  for (const m of MUTATORS) {
    if (typeof fs[m] !== 'function') continue;
    originals[m] = fs[m];
    fs[m] = function (...args) {
      const first = typeof args[0] === 'string' ? args[0] : '';
      if (first.includes('.user.toml')) touched.push(`${m}(${first})`);
      return originals[m].apply(fs, args);
    };
  }
  try {
    generate(fx, BOTH_CONFLUENCE);
    generate(fx, NEITHER);
    hook.detectPublishHookCollisions(fx.root);
  } finally {
    for (const m of Object.keys(originals)) fs[m] = originals[m];
  }
  assert.deepStrictEqual(touched, [],
    `a mutating fs call named the personal layer: ${touched.join(', ')}`);
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 4. AC3 — marker-delimited, idempotent, non-destructive ===\n');

const USER_CONTENT =
  '# my own team policy\n' +
  '[agent]\n' +
  'name = "House Style"\n' +
  '\n' +
  'workflow.prd_template = "assets/house-prd.md"\n';

test('4.1 AC3(a) two consecutive generations produce a BYTE-IDENTICAL file', () => {
  const fx = fixture();
  generate(fx, BOTH_CONFLUENCE);
  const first = {};
  for (const s of hook.AUTHORING_SKILLS) first[s] = fs.readFileSync(teamFile(fx, s));
  const second = generate(fx, BOTH_CONFLUENCE);
  assert.deepStrictEqual(second.results.map((r) => r.outcome), Array(5).fill(hook.HOOK_UNCHANGED),
    'a second generation must be a no-op and must SAY it was a no-op');
  for (const s of hook.AUTHORING_SKILLS) {
    assert.ok(first[s].equals(fs.readFileSync(teamFile(fx, s))),
      `${s}.toml changed on a second identical generation — a blank line accumulating or a ` +
      `reordering is exactly what the trailing-newline swallow exists to prevent`);
  }
});

test('4.2 AC3(b) user content outside the markers survives a regeneration BYTE-IDENTICAL', () => {
  const fx = fixture();
  for (const s of hook.AUTHORING_SKILLS) fs.writeFileSync(teamFile(fx, s), USER_CONTENT, 'utf-8');
  generate(fx, BOTH_CONFLUENCE);
  generate(fx, BOTH_CONFLUENCE);
  for (const s of hook.AUTHORING_SKILLS) {
    const after = fs.readFileSync(teamFile(fx, s), 'utf-8');
    assert.strictEqual(hook.removePublishHookBlock(after), USER_CONTENT,
      `${s}.toml: the user's content did not survive verbatim. This is the story's main hazard.`);
  }
});

test('4.3 AC3(d) a backend flip AWAY from confluence removes the block and nothing else', () => {
  const fx = fixture();
  for (const s of hook.AUTHORING_SKILLS) fs.writeFileSync(teamFile(fx, s), USER_CONTENT, 'utf-8');
  generate(fx, BOTH_CONFLUENCE);
  const out = generate(fx, NEITHER);
  assert.deepStrictEqual(out.results.map((r) => r.outcome), Array(5).fill(hook.HOOK_REMOVED),
    'a flip away from confluence must REMOVE the block, and must say so by name');
  for (const s of hook.AUTHORING_SKILLS) {
    assert.strictEqual(fs.readFileSync(teamFile(fx, s), 'utf-8'), USER_CONTENT,
      `${s}.toml is not byte-identical to what the user wrote before the hook existed`);
    assert.strictEqual(hook.findPublishHookBlock(fs.readFileSync(teamFile(fx, s), 'utf-8')), null,
      `${s}.toml still carries a marker block after the flip`);
  }
});

test('4.4 AC3(d) a flip away from confluence deletes a file that was ONLY the hook', () => {
  const fx = fixture();
  generate(fx, BOTH_CONFLUENCE);
  generate(fx, NEITHER);
  for (const s of hook.AUTHORING_SKILLS) {
    assert.ok(!fs.existsSync(teamFile(fx, s)),
      `${s}.toml was left behind as an empty husk; the resolver would keep reading it forever`);
  }
});

test('4.5 AC3(c) a malformed half-block is a FRESH INSERT, not a truncation', () => {
  const fx = fixture();
  const half = `${hook.PUBLISH_HOOK_MARKER_BEGIN}\n# a stale beginning with no end\n` + USER_CONTENT;
  for (const s of hook.AUTHORING_SKILLS) fs.writeFileSync(teamFile(fx, s), half, 'utf-8');
  const out = generate(fx, BOTH_CONFLUENCE);
  assert.deepStrictEqual(out.results.map((r) => r.outcome), Array(5).fill(hook.HOOK_WROTE),
    'a half-block must not stop the generation — AC3(c) calls for a fresh insert');
  for (const s of hook.AUTHORING_SKILLS) {
    const after = fs.readFileSync(teamFile(fx, s), 'utf-8');
    assert.ok(after.includes('# a stale beginning with no end'),
      `${s}.toml: the half-block's own line was destroyed; "do not silently corrupt the file ` +
      `further" means the bytes stay`);
    assert.ok(after.includes(USER_CONTENT),
      `${s}.toml: user content after the half-block was destroyed`);
    assert.ok(after.startsWith(hook.PUBLISH_HOOK_MARKER_BEGIN),
      `${s}.toml: the fresh block was not inserted at the top`);
  }
});

test('4.6 AC3 exactly ONE complete delimited region exists after generation', () => {
  const fx = fixture();
  for (const s of hook.AUTHORING_SKILLS) fs.writeFileSync(teamFile(fx, s), USER_CONTENT, 'utf-8');
  generate(fx, BOTH_CONFLUENCE);
  generate(fx, BOTH_CONFLUENCE);
  for (const s of hook.AUTHORING_SKILLS) {
    const t = fs.readFileSync(teamFile(fx, s), 'utf-8');
    const b = t.split(hook.PUBLISH_HOOK_MARKER_BEGIN).length - 1;
    const e = t.split(hook.PUBLISH_HOOK_MARKER_END).length - 1;
    assert.deepStrictEqual([b, e], [1, 1], `${s}.toml has ${b} BEGIN and ${e} END markers`);
  }
});

test('4.7 AC3 a block a human MOVED under a table is re-anchored to root scope', () => {
  // The silent failure this heals: a dotted key inherits the preceding table's
  // context, so `[agent]` … `workflow.on_complete` resolves to
  // `agent.workflow.on_complete` and the publish never fires, with no error.
  const fx = fixture();
  generate(fx, BOTH_CONFLUENCE);
  const skill = hook.AUTHORING_SKILLS[0];
  const t = fs.readFileSync(teamFile(fx, skill), 'utf-8');
  const block = t.slice(0, t.indexOf(hook.PUBLISH_HOOK_MARKER_END) + hook.PUBLISH_HOOK_MARKER_END.length);
  fs.writeFileSync(teamFile(fx, skill), '[agent]\nname = "x"\n' + block + '\n', 'utf-8');

  // First: prove the moved state really IS broken, through the real resolver.
  const broken = resolveKey(fx, skill, 'workflow.on_complete');
  assert.strictEqual(broken.status, 0, 'the moved file must still parse — this is a silent defect, not a loud one');
  assert.strictEqual(broken.value, '',
    `a block under a table must resolve to the DEFAULT, proving the publish is dead; it ` +
    `resolved to ${JSON.stringify(broken.value)}`);
  const misplaced = resolveKey(fx, skill, 'agent.workflow.on_complete');
  assert.ok(Array.isArray(misplaced.value),
    'and the instruction must be provably sitting at the wrong key path');

  // Then: generation heals it.
  generate(fx, BOTH_CONFLUENCE);
  const healed = resolveKey(fx, skill, 'workflow.on_complete');
  assert.ok(Array.isArray(healed.value) && healed.value.length === 1,
    `after regeneration the hook must resolve at workflow.on_complete again; got ` +
    `${JSON.stringify(healed.value)}`);
  assert.ok(fs.readFileSync(teamFile(fx, skill), 'utf-8').includes('[agent]'),
    "and the user's own table must still be there");
});

test('4.8 AC3(b) root-level content written AFTER the block stays at ROOT — the block captures nothing', () => {
  // THE REASON THE BLOCK IS A DOTTED KEY AND NOT A `[workflow]` TABLE HEADER.
  //
  // A header form is equally valid TOML, equally idempotent, and survives every
  // other test in this section — `removePublishHookBlock` still round-trips, the
  // file still parses, the hook still resolves. What it does NOT survive is a
  // user appending a root-level key after it: a table header captures everything
  // that follows it, so `user_key = 2` silently becomes `workflow.user_key`.
  // Measured against the real resolver, because a silent capture is invisible to
  // every syntactic check.
  const fx = fixture();
  generate(fx, BOTH_CONFLUENCE);
  const skill = hook.AUTHORING_SKILLS[0];
  fs.appendFileSync(teamFile(fx, skill), 'a_root_level_user_key = "MINE"\n', 'utf-8');

  const atRoot = resolveKey(fx, skill, 'a_root_level_user_key');
  assert.strictEqual(atRoot.status, 0, `the file must still parse: ${atRoot.stderr}`);
  assert.strictEqual(atRoot.value, 'MINE',
    "the user's key resolved to " + JSON.stringify(atRoot.value) + ' at the root. If it is ' +
    'undefined, ma-agents\' block has captured it into its own table — a silent corruption of ' +
    'user content, which is exactly what AC3(b) forbids.');
  const captured = resolveKey(fx, skill, 'workflow.a_root_level_user_key');
  assert.strictEqual(captured.value, undefined,
    "and it must NOT also appear inside ma-agents' table");
  // The hook itself is unaffected by the append.
  assert.ok(Array.isArray(resolveKey(fx, skill, 'workflow.on_complete').value),
    'and the publish hook must still resolve alongside it');
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 5. AC4 — TOML validity, measured against real tomllib ===\n');

/** Ask real `tomllib` whether each of `texts` parses. Returns array of error|null. */
function tomllibVerdicts(texts) {
  const dir = tmpProject();
  texts.forEach((t, i) => fs.writeFileSync(path.join(dir, `c${i}.toml`), t, 'utf-8'));
  const script = path.join(dir, 'check.py');
  fs.writeFileSync(script,
    'import tomllib, sys, json, pathlib\n' +
    'out = {}\n' +
    'd = pathlib.Path(sys.argv[1])\n' +
    "for f in d.glob('c*.toml'):\n" +
    '    try:\n' +
    "        with f.open('rb') as fh: tomllib.load(fh)\n" +
    '        out[f.stem] = None\n' +
    '    except Exception as e:\n' +
    '        out[f.stem] = str(e)\n' +
    'print(json.dumps(out))\n', 'utf-8');
  const r = python([script, dir]);
  assert.strictEqual(r.status, 0, `tomllib probe failed: ${r.stderr}`);
  const map = JSON.parse(r.stdout);
  return texts.map((_, i) => map[`c${i}`]);
}

/** The differential corpus: hand-built edge cases plus every shipped customize.toml. */
function differentialCorpus() {
  const block = hook.buildPublishHookBlock({
    skillName: 'bmad-prd', storeCliName: 'system', storeLabel: tree.labelForStore(SYSTEM),
  });
  const cases = new Map([
    ['empty', ''],
    ['block alone', hook.injectPublishHookBlock('', block)],
    ['block + root key', hook.injectPublishHookBlock('foo = 1\n', block)],
    ['block + user table', hook.injectPublishHookBlock(USER_CONTENT, block)],
    ['block + [workflow] (invalid)', hook.injectPublishHookBlock('', block) + '\n[workflow]\nfoo = 1\n'],
    ['block + duplicate on_complete (invalid)', hook.injectPublishHookBlock('', block) + 'workflow.on_complete = "x"\n'],
    ['comment only', '# nothing here\n'],
    ['multi-line basic string', 'a = """\nl1\nl2\n"""\n'],
    ['multi-line literal string', "a = '''\nx\n'''\n"],
    ['array over lines', 'a = [\n 1,\n 2,\n]\n'],
    ['inline table', 'a = { b = 1, c = "x" }\n'],
    ['array of tables', '[[x]]\na = 1\n[[x]]\na = 2\n'],
    ['duplicate key (invalid)', '[t]\na = 1\na = 2\n'],
    ['duplicate table (invalid)', '[t]\na = 1\n[t]\nb = 2\n'],
    ['dotted then table (invalid)', 'w.on = ["x"]\n[w]\nfoo = 1\n'],
    ['subtable before parent (valid)', '[a.b]\ny = 2\n[a]\nx = 1\n'],
    ['hash inside a string', 'a = "not # a comment"\n'],
    ['bracket inside a string', 'a = "[not a table]"\n'],
    ['quoted key with a dot', '"a.b" = 1\n'],
    ['dotted quoted segment', 'a."b c" = 1\n'],
    ['unterminated string (invalid)', 'a = "oops\n'],
    ['unterminated array (invalid)', 'a = [1,\n'],
    ['garbage line (invalid)', 'this is not toml\n'],
    ['scalars of every kind', 'a = true\nb = 1\nc = 1.5\nd = 1979-05-27T07:32:00Z\n'],
    ['nested tables', '[a]\nx = 1\n[a.b]\ny = 2\n'],
    ['CRLF throughout', hook.injectPublishHookBlock('foo = 1\n', block).replace(/\n/g, '\r\n')],
  ]);
  // Every shipped upstream customize.toml, raw and with the block prepended.
  const bmm = path.join(PROJECT_ROOT, 'node_modules', 'bmad-method', 'src');
  const found = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.toml')) found.push(p);
    }
  };
  walk(bmm);
  for (const f of found) {
    const rel = path.relative(bmm, f);
    const raw = fs.readFileSync(f, 'utf-8');
    cases.set(`shipped:${rel}`, raw);
    cases.set(`shipped+block:${rel}`, hook.injectPublishHookBlock(raw, block));
  }
  return cases;
}

const CORPUS = differentialCorpus();

test('5.1 AC4(a) [equivalence] the bundled TOML reader agrees with real `tomllib` on the whole corpus', () => {
  // The warrant for the deviation from AC4(a)'s letter. Node ships no TOML
  // parser and this package carries no TOML dependency, so the install-time
  // check cannot BE tomllib. It is proved EQUIVALENT to tomllib here instead,
  // over a corpus that includes every shipped customize.toml in the vendored
  // tree — the population a real project's file actually resembles.
  const names = [...CORPUS.keys()];
  assert.ok(names.length >= 60,
    `the corpus is ${names.length} entries; too small to be evidence of anything`);
  const verdicts = tomllibVerdicts(names.map((n) => CORPUS.get(n)));
  const disagreements = [];
  names.forEach((n, i) => {
    const pythonRejects = verdicts[i] !== null;
    const oursRejects = hook.tomlProblems(CORPUS.get(n)).length > 0;
    if (pythonRejects !== oursRejects) {
      disagreements.push(`${n}: tomllib ${pythonRejects ? 'REJECTS' : 'accepts'} / ` +
        `ours ${oursRejects ? 'REJECTS' : 'accepts'}` +
        (pythonRejects ? ` (${verdicts[i]})` : ` (${JSON.stringify(hook.tomlProblems(CORPUS.get(n))[0])})`));
    }
  });
  assert.deepStrictEqual(disagreements, [],
    `the reader disagrees with tomllib on ${disagreements.length} of ${names.length} corpus ` +
    `entries. A FALSE REJECTION is the worse direction: it refuses to write the hook on a ` +
    `project whose file is perfectly valid.\n  ${disagreements.join('\n  ')}`);
});

test('5.2 AC4(a) [harness] the corpus really does contain both verdicts', () => {
  // Guards against the equivalence test above passing vacuously because
  // everything in the corpus happens to be valid.
  const names = [...CORPUS.keys()];
  const verdicts = tomllibVerdicts(names.map((n) => CORPUS.get(n)));
  const rejected = verdicts.filter((v) => v !== null).length;
  assert.ok(rejected >= 6,
    `tomllib rejects only ${rejected} corpus entries; the equivalence claim needs real ` +
    `negatives to mean anything`);
  assert.ok(verdicts.filter((v) => v === null).length >= 40, 'and real positives');
});

test('5.3 AC4(a) every file this generator writes PARSES under real tomllib', () => {
  const fx = fixture();
  for (const s of hook.AUTHORING_SKILLS) fs.writeFileSync(teamFile(fx, s), USER_CONTENT, 'utf-8');
  generate(fx, BOTH_CONFLUENCE);
  const texts = hook.AUTHORING_SKILLS.map((s) => fs.readFileSync(teamFile(fx, s), 'utf-8'));
  const verdicts = tomllibVerdicts(texts);
  hook.AUTHORING_SKILLS.forEach((s, i) => {
    assert.strictEqual(verdicts[i], null, `${s}.toml does not parse under tomllib: ${verdicts[i]}`);
  });
});

test('5.4 AC4(b) a pre-existing `on_complete` outside the markers REFUSES, loudly, writing nothing', () => {
  const fx = fixture();
  const theirs = '# ours\nworkflow.on_complete = "do our own thing"\n';
  const skill = hook.AUTHORING_SKILLS[0];
  fs.writeFileSync(teamFile(fx, skill), theirs, 'utf-8');
  const out = generate(fx, BOTH_CONFLUENCE);
  const r = out.results.find((x) => x.skill === skill);
  assert.strictEqual(r.outcome, hook.HOOK_REFUSED_COLLISION,
    `expected a named refusal, got ${r.outcome}`);
  assert.strictEqual(fs.readFileSync(teamFile(fx, skill), 'utf-8'), theirs,
    'the file was modified despite the refusal');
  assert.ok(out.refused, 'the aggregate outcome must report that something was refused');
  const detail = r.collisions.map((c) => c.detail).join(' | ');
  assert.ok(/on_complete/.test(detail), `the refusal must name the KEY; it said ${detail}`);
  assert.ok(r.collisions.every((c) => Number.isInteger(c.line) && c.line > 0),
    `and must name the line; got ${JSON.stringify(r.collisions)}`);
  assert.ok(r.file.endsWith(`${skill}.toml`), 'and must name the FILE');
  // The other four are unaffected — a refusal is per-file, not a global abort.
  assert.deepStrictEqual(
    out.results.filter((x) => x.skill !== skill).map((x) => x.outcome), Array(4).fill(hook.HOOK_WROTE),
    'one colliding file must not stop the other four from being generated');
});

test('5.5 AC4(b) a pre-existing `[workflow]` TABLE outside the markers refuses too', () => {
  // Measured, not assumed: `[workflow]` beside our dotted key is
  // "Cannot declare ('workflow',) twice" — the same whole-layer discard.
  const fx = fixture();
  const skill = hook.AUTHORING_SKILLS[0];
  const theirs = '[workflow]\nprd_template = "assets/house.md"\n';
  fs.writeFileSync(teamFile(fx, skill), theirs, 'utf-8');
  const r = generate(fx, BOTH_CONFLUENCE).results.find((x) => x.skill === skill);
  assert.strictEqual(r.outcome, hook.HOOK_REFUSED_COLLISION);
  assert.strictEqual(fs.readFileSync(teamFile(fx, skill), 'utf-8'), theirs, 'nothing may be written');
  assert.ok(r.collisions.some((c) => c.kind === hook.COLLISION_DUPLICATE_TABLE),
    `the refusal must name the table collision by KIND; got ${JSON.stringify(r.collisions)}`);
});

test('5.6 AC4(b) a file that already does not parse refuses under its OWN named outcome', () => {
  const fx = fixture();
  const skill = hook.AUTHORING_SKILLS[0];
  fs.writeFileSync(teamFile(fx, skill), 'this is not toml at all\n', 'utf-8');
  const r = generate(fx, BOTH_CONFLUENCE).results.find((x) => x.skill === skill);
  assert.strictEqual(r.outcome, hook.HOOK_REFUSED_INVALID_TOML,
    '"already broken" and "would collide" are different facts and must not collapse into one');
});

test('5.7 AC4 [rationale, DEMONSTRATED] a duplicate key discards the ENTIRE team layer at exit 0', () => {
  // Why the refusal exists, shown rather than asserted. This is the failure the
  // writer is guarding against, and it is the RESOLVER's, not the writer's.
  const fx = fixture();
  const skill = hook.AUTHORING_SKILLS[0];
  const block = hook.buildPublishHookBlock({
    skillName: skill, storeCliName: 'system', storeLabel: tree.labelForStore(SYSTEM),
  });
  const marker = 'a-team-key-that-has-nothing-to-do-with-publishing';

  // Control: the same team layer WITHOUT the duplicate resolves fine.
  fs.writeFileSync(teamFile(fx, skill),
    hook.injectPublishHookBlock(`${marker} = "PRESENT"\n`, block), 'utf-8');
  const control = resolveKey(fx, skill, marker);
  assert.strictEqual(control.status, 0);
  assert.strictEqual(control.value, 'PRESENT',
    'the control must resolve, or the experiment below proves nothing');

  // Experiment: add the duplicate a second writer would add.
  fs.writeFileSync(teamFile(fx, skill),
    hook.injectPublishHookBlock(`${marker} = "PRESENT"\n`, block) + '\nworkflow.on_complete = "theirs"\n',
    'utf-8');
  const collided = resolveKey(fx, skill, marker);
  assert.strictEqual(collided.status, 0,
    'THE POINT: the resolver EXITS ZERO. Nothing on the skill\'s path can see this.');
  assert.strictEqual(collided.value, undefined,
    `the unrelated team key ${marker} survived; the discard is supposed to take the WHOLE layer`);
  assert.ok(/^warning:/m.test(collided.stderr),
    `the only trace is a stderr warning; got ${JSON.stringify(collided.stderr)}`);
  const hookValue = resolveKey(fx, skill, 'workflow.on_complete');
  assert.strictEqual(hookValue.value, '',
    'and the publish hook is gone with it, resolving to the skill default');
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 6. AC5 — no silent skip, and the ready message is corrected ===\n');

const HOOK_TEXT = hook.publishHookInstruction('system', tree.labelForStore(SYSTEM));
const HOOK_BLOCK = hook.buildPublishHookBlock({
  skillName: 'bmad-prd', storeCliName: 'system', storeLabel: tree.labelForStore(SYSTEM),
});

test('6.1 AC5(b) the hook text carries the terminal STOP and reports NO publish', () => {
  assert.ok(/\bSTOP\b/.test(HOOK_TEXT), 'the halt must be unmissable');
  assert.ok(/NO publish happened/i.test(HOOK_TEXT),
    'the agent must be told to report that no publish happened, not merely to stop');
  assert.ok(/name what failed/i.test(HOOK_TEXT),
    'FR262 requires the failure be NAMED, not merely signalled');
});

test('6.2 AC5(b) the hook text fails loud when no Confluence MCP is reachable', () => {
  assert.ok(/no Confluence MCP server is reachable/i.test(HOOK_TEXT),
    'FR262: a Confluence-backed store with no Confluence MCP has no degraded mode, and the ' +
    'plan output cannot state this case because the plan never runs');
});

test('6.3 AC5(c) the hook text instructs the agent to CORRECT the already-emitted ready message', () => {
  // Without this clause the story ships the epic's signature defect — success
  // reported over a failed write — as a structural property, because
  // `on_complete` runs after the artifact paths have been shared (proved at 1.9).
  assert.ok(/correct the artifact-ready message/i.test(HOOK_TEXT),
    'the halt must retract or correct the message the workflow already gave');
  assert.ok(/already gave the user/i.test(HOOK_TEXT) && /previous step/i.test(HOOK_TEXT),
    'and must say WHICH message and WHEN it was given, or an agent cannot act on it');
});

test('6.4 AC5(b) the hook text forbids substituting anything on disk', () => {
  assert.ok(/do not offer anything on disk as a stand-in/i.test(HOOK_TEXT),
    'FR262 forbids falling back to a local copy; the halt message is where that is lost');
});

test('6.5 AC5(a) every no-publish outcome is a NAMED value, never a bare falsy', () => {
  for (const v of hook.HOOK_NO_PUBLISH_OUTCOMES) {
    assert.strictEqual(typeof v, 'string', 'outcomes must be inspectable values');
    assert.ok(v.length > 0, 'and must not be the empty string standing in for a decision');
  }
  assert.strictEqual(new Set(hook.HOOK_NO_PUBLISH_OUTCOMES).size, hook.HOOK_NO_PUBLISH_OUTCOMES.length,
    'two distinct reasons must not share one value');
  assert.ok(!hook.HOOK_NO_PUBLISH_OUTCOMES.includes(hook.HOOK_WROTE) &&
    !hook.HOOK_NO_PUBLISH_OUTCOMES.includes(hook.HOOK_UNCHANGED),
    'a publishing outcome must not be in the no-publish set');
});

test('6.6 AC5(a) a file-system project gets NO hook, and the reason is stated to the operator', () => {
  const fx = fixture();
  const out = generate(fx, NEITHER);
  assert.deepStrictEqual(out.results.map((r) => r.outcome), Array(5).fill(hook.HOOK_NOT_APPLICABLE),
    'a file-system store must produce a NAMED not-applicable, not an unexplained no-op');
  for (const s of hook.AUTHORING_SKILLS) {
    assert.ok(!fs.existsSync(teamFile(fx, s)), `${s}.toml was created for a file-system store`);
  }
  // §4.3 / Step B1: the named reason goes to the OPERATOR at install time, never
  // to the user at workflow time. So it is checked on the CLI reporter's output.
  const lines = captureLog(() => cli.generateConfluencePublishHooks({
    projectRoot: fx.root, fallbackLayout: { knowledgebase: { mode: 'same', path: '.' }, sprintManagement: { mode: 'same', path: '.' } },
  }));
  assert.ok(/No Confluence publish trigger generated/i.test(lines.join('\n')),
    `the no-publish decision must be stated by name; the run said:\n${lines.join('\n')}`);
});

/** Capture console.log while `fn` runs. */
function captureLog(fn) {
  const lines = [];
  const orig = console.log;
  console.log = (...a) => lines.push(a.join(' '));
  try { fn(); } finally { console.log = orig; }
  return lines;
}

test('6.7 AC5(a) a refusal is reported by FILE, LINE and REMEDY on the operator surface', () => {
  const fx = fixture();
  const skill = hook.AUTHORING_SKILLS[0];
  fs.writeFileSync(teamFile(fx, skill), 'workflow.on_complete = "theirs"\n', 'utf-8');
  const priorExitCode = process.exitCode;
  const lines = captureLog(() => cli.generateConfluencePublishHooks({
    projectRoot: fx.root,
    fallbackLayout: { knowledgebase: { mode: 'same', path: '.', backend: 'confluence', spaceKey: 'X' }, sprintManagement: { mode: 'same', path: '.' } },
  }));
  process.exitCode = priorExitCode; // do not leak the deliberate failure signal
  const text = lines.join('\n');
  assert.ok(text.includes(`${skill}.toml`), `the report must name the file:\n${text}`);
  assert.ok(/Line \d+:/.test(text), `the report must name the line:\n${text}`);
  assert.ok(/user\.toml/.test(text) && /array/i.test(text),
    `the report must name the remedy (an array override in the personal layer):\n${text}`);
  assert.ok(new RegExp(`${skill} will NOT publish`).test(text),
    `the report must say the consequence out loud:\n${text}`);
});

test('6.8 AC4(b)/AC12(b) a refusal makes the process exit NON-ZERO', () => {
  const fx = fixture();
  fs.writeFileSync(teamFile(fx, hook.AUTHORING_SKILLS[0]), 'workflow.on_complete = "theirs"\n', 'utf-8');
  const prior = process.exitCode;
  process.exitCode = 0;
  captureLog(() => cli.generateConfluencePublishHooks({
    projectRoot: fx.root,
    fallbackLayout: { knowledgebase: { mode: 'same', path: '.', backend: 'confluence', spaceKey: 'X' }, sprintManagement: { mode: 'same', path: '.' } },
  }));
  const observed = process.exitCode;
  process.exitCode = prior;
  assert.strictEqual(observed, 1,
    'AC4(b) says the generator exits non-zero, so the collision surfaces at install/bind time ' +
    'rather than as a publish that quietly stopped happening');
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 7. AC6 — per-store routing, both directions ===\n');

test('7.1 AC6 with only the SYSTEM store on confluence, only its skills get a hook', () => {
  const fx = fixture();
  const out = generate(fx, storesFor('confluence', 'file-system'));
  for (const r of out.results) {
    const expected = ORACLE.get(r.skill) === SYSTEM ? hook.HOOK_WROTE : hook.HOOK_NOT_APPLICABLE;
    assert.strictEqual(r.outcome, expected,
      `${r.skill} belongs to ${tree.labelForStore(ORACLE.get(r.skill))} and got ${r.outcome}`);
  }
});

test('7.2 AC6 with only the SOFTWARE store on confluence, the partition is the exact complement', () => {
  const fx = fixture();
  const out = generate(fx, storesFor('file-system', 'confluence'));
  for (const r of out.results) {
    const expected = ORACLE.get(r.skill) === SOFTWARE ? hook.HOOK_WROTE : hook.HOOK_NOT_APPLICABLE;
    assert.strictEqual(r.outcome, expected,
      `${r.skill} belongs to ${tree.labelForStore(ORACLE.get(r.skill))} and got ${r.outcome}`);
  }
});

test('7.3 FR257 the two runs above are COMPLEMENTARY, so neither could pass by routing everything one way', () => {
  const a = fixture();
  const b = fixture();
  const sysOnly = generate(a, storesFor('confluence', 'file-system')).results
    .filter((r) => r.outcome === hook.HOOK_WROTE).map((r) => r.skill).sort();
  const swOnly = generate(b, storesFor('file-system', 'confluence')).results
    .filter((r) => r.outcome === hook.HOOK_WROTE).map((r) => r.skill).sort();
  assert.deepStrictEqual([...sysOnly, ...swOnly].sort(), [...hook.AUTHORING_SKILLS].sort(),
    'the two store-scoped runs must partition the five exactly once each');
  assert.deepStrictEqual(sysOnly.filter((s) => swOnly.includes(s)), [],
    'no skill may publish to both stores — FR257 makes them independent');
  assert.ok(sysOnly.length > 0 && swOnly.length > 0, 'and neither side may be empty');
});

test('7.4 AC6 a project with neither store on confluence creates no file and no directory', () => {
  const fx = tmpProject();
  const out = hook.generatePublishHooks({ projectRoot: fx, stores: NEITHER });
  assert.deepStrictEqual(out.results.map((r) => r.outcome), Array(5).fill(hook.HOOK_NOT_APPLICABLE));
  assert.ok(!fs.existsSync(path.join(fx, '_bmad')),
    '§4.6 R2: another package owns `_bmad/custom/`; nothing may be conjured there when there ' +
    'is nothing to put in it');
});

test('7.5 §4.6 R2 the generator CREATES `_bmad/custom/` when it is absent but needed', () => {
  const root = tmpProject();
  const out = hook.generatePublishHooks({ projectRoot: root, stores: BOTH_CONFLUENCE });
  assert.deepStrictEqual(out.results.map((r) => r.outcome), Array(5).fill(hook.HOOK_WROTE),
    'the directory belongs to bmad-method\'s installer and may simply not be there yet');
  assert.ok(fs.existsSync(path.join(root, '_bmad', 'custom')));
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 8. AC7 — the merge residual, demonstrated not asserted ===\n');

test('8.1 AC7(a) an ARRAY override in `.user.toml` APPENDS — both instructions run', () => {
  const fx = fixture();
  generate(fx, BOTH_CONFLUENCE);
  const skill = hook.AUTHORING_SKILLS[0];
  fs.writeFileSync(userFile(fx, skill), 'workflow.on_complete = [ "MY OWN STEP" ]\n', 'utf-8');
  const got = resolveKey(fx, skill, 'workflow.on_complete');
  assert.ok(Array.isArray(got.value) && got.value.length === 2,
    `expected two instructions, got ${JSON.stringify(got.value)}`);
  assert.ok(got.value[0].includes('ma-agents confluence-plan'), 'the publish must still be there');
  assert.strictEqual(got.value[1], 'MY OWN STEP', "and the user's must be appended after it");
});

test('8.2 AC7(b) a SCALAR override in `.user.toml` REPLACES the hook — the publish does NOT happen', () => {
  // The residual, demonstrated rather than hidden. It is IRREDUCIBLE in this
  // merge model: `deep_merge`'s fallthrough is `return override`, so anything
  // that is not array+array replaces outright. ma-agents cannot change that —
  // the resolver ships from bmad-method and is re-copied on every install. The
  // remedy is the one the block's own comment states: write the override as an
  // array.
  const fx = fixture();
  generate(fx, BOTH_CONFLUENCE);
  const skill = hook.AUTHORING_SKILLS[0];
  fs.writeFileSync(userFile(fx, skill), 'workflow.on_complete = "MY OWN STEP"\n', 'utf-8');
  const got = resolveKey(fx, skill, 'workflow.on_complete');
  assert.strictEqual(got.value, 'MY OWN STEP',
    'the documented residual is that a scalar wins outright; if this no longer holds, the ' +
    'limitation has been fixed upstream and the disclosure should be withdrawn');
  assert.strictEqual(got.status, 0, 'and it happens silently, at exit 0');
});

test('8.3 AC7 the block\'s own comment names the array form as the remedy', () => {
  assert.ok(HOOK_BLOCK.includes('as a TOML ARRAY'),
    'the one form that appends must be named in the file the customizer is looking at');
  assert.ok(/An array APPENDS[\s\S]*A string scalar REPLACES/.test(HOOK_BLOCK),
    'and the consequence of getting it wrong must be stated beside it');
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 9. AC8 — FR266 stays retired ===\n');

/**
 * The release gate's mirror vocabulary, EXTRACTED from the shipped suite.
 *
 * Not restated: restating it would leave this check behind the moment the gate's
 * vocabulary is widened, and "a fresh, weaker analysis" is exactly what AC8
 * forbids. The extraction is asserted non-empty and proved armed below.
 */
function extractedMirrorVocabulary() {
  const src = fs.readFileSync(path.join(PROJECT_ROOT, 'test', 'release-gate-epic-31.test.js'), 'utf-8');
  const start = src.indexOf('const MIRROR_VOCABULARY = [');
  assert.notStrictEqual(start, -1,
    'MIRROR_VOCABULARY could not be found in test/release-gate-epic-31.test.js; this check ' +
    'must bind to the shipped analysis, so a failed extraction is a FAILURE, not a fallback');
  const open = src.indexOf('[', start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  assert.notStrictEqual(end, -1, 'MIRROR_VOCABULARY array literal is unbalanced');
  // eslint-disable-next-line no-eval
  const arr = eval(src.slice(open, end + 1));
  assert.ok(Array.isArray(arr) && arr.length >= 15,
    `extracted ${Array.isArray(arr) ? arr.length : 'nothing'} vocabulary entries; too few to be ` +
    `the shipped list`);
  assert.ok(arr.every((r) => r instanceof RegExp), 'every entry must be a RegExp');
  return arr;
}

const MIRROR_VOCABULARY = extractedMirrorVocabulary();

test('9.1 AC8 [harness] the extracted vocabulary DETECTS FR266 restored verbatim', () => {
  const restored = 'Every `confluence`-backed store has a local mirror kept in sync on each read.';
  assert.ok(MIRROR_VOCABULARY.some((re) => re.test(restored)),
    'the extraction produced a vocabulary that cannot even see FR266 itself');
  const alsoCaught = [
    'Download each page and cache it under _bmad-output/.',
    'Reconcile the local files with the space and bring the two into agreement.',
    'Export the space and save a snapshot to disk.',
  ];
  for (const s of alsoCaught) {
    assert.ok(MIRROR_VOCABULARY.some((re) => re.test(s)), `vocabulary missed: ${s}`);
  }
});

test('9.2 AC8 the hook INSTRUCTION matches ZERO entries of the shipped mirror vocabulary', () => {
  // Not "matches and is adjudicated" — zero. The shipped gate needs adjudication
  // because it must say "do NOT write a local copy"; this text does not, so the
  // strictest available result is the one that is claimed.
  for (const cliName of ['system', 'software']) {
    const text = hook.publishHookInstruction(cliName, tree.labelForStore(
      cliName === 'system' ? SYSTEM : SOFTWARE));
    const hits = MIRROR_VOCABULARY.filter((re) => re.test(text)).map(String);
    assert.deepStrictEqual(hits, [],
      `the --store ${cliName} instruction matches mirror vocabulary ${hits.join(', ')}. ` +
      `P5-9.6 names an accidental mirror as the single most likely way this epic reacquires ` +
      `the subsystem it removed.`);
  }
});

test('9.3 AC8 the WHOLE emitted block — comments included — matches ZERO entries', () => {
  for (const skill of hook.AUTHORING_SKILLS) {
    const block = hook.buildPublishHookBlock({
      skillName: skill, storeCliName: 'system', storeLabel: tree.labelForStore(SYSTEM),
    });
    const hits = MIRROR_VOCABULARY.filter((re) => re.test(block)).map(String);
    assert.deepStrictEqual(hits, [],
      `${skill}'s block matches ${hits.join(', ')}. The comment ships in a user's project and ` +
      `is read by agents; it is text, not decoration.`);
  }
});

test('9.4 AC8 the permissive-degradation denylist finds nothing either', () => {
  // The SECONDARY check the routing suite applies to Steps B1/B2, applied here.
  const PERMISSIVE = [
    [/carry on/i, 'offers to carry on'],
    [/continue against/i, 'offers to continue against something local'],
    [/local cop(y|ies)/i, 'offers a local copy as an alternative to halting'],
    [/for this run/i, 'makes the disposition conditional on convenience'],
    [/ask the user whether/i, 'reintroduces FR266 as a user prompt'],
    [/if the user (chooses|prefers|says)/i, 'makes degradation a user choice'],
    [/you may instead/i, 'grants an alternative to the stated disposition'],
  ];
  for (const [re, why] of PERMISSIVE) {
    assert.ok(!re.test(HOOK_BLOCK), `the block ${why} (${re})`);
  }
});

test('9.5 AC8 the hook names no Confluence page operation at all — it ROUTES to the catalogue', () => {
  // §4.5: the hook must not become a tenth copy of the gate, and it must not
  // widen the closed operation catalogue by naming an operation of its own.
  const outside = ['delete_page', 'archive_page', 'move_page', 'get_page_children', 'export_page'];
  for (const op of outside) {
    assert.ok(!HOOK_BLOCK.includes(op),
      `the block names ${op}, which is outside the closed catalogue ` +
      `(${tree.CONFLUENCE_PAGE_OPERATIONS.join(', ')})`);
  }
  for (const op of tree.CONFLUENCE_PAGE_OPERATIONS) {
    assert.ok(!HOOK_BLOCK.includes(op),
      `the block restates the catalogue operation ${op}. It must route to ` +
      `\`ma-agents confluence-plan\`, which already prints the catalogue, rather than carry a ` +
      `second copy that can drift from it.`);
  }
  assert.ok(HOOK_TEXT.includes('ma-agents confluence-plan --store '),
    'and it must actually name the command it routes to');
});

test('9.6 §4.5 the hook is not a tenth copy of the shipped Story 31.9 gate block', () => {
  const gate = fs.readFileSync(
    path.join(PROJECT_ROOT, 'skills', 'generate-backlog', 'SKILL.md'), 'utf-8');
  const start = gate.indexOf('## Knowledge Store Backend Routing');
  assert.notStrictEqual(start, -1, 'the shipped gate block could not be located to compare against');
  const gateBlock = gate.slice(start, gate.indexOf('\n## ', start + 4) === -1 ? undefined : gate.indexOf('\n## ', start + 4));
  const words = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  const gateWords = words(gateBlock);
  const grams = new Set();
  for (let i = 0; i + 10 <= gateWords.length; i++) grams.add(gateWords.slice(i, i + 10).join(' '));
  const hookWords = words(HOOK_BLOCK);
  const shared = [];
  for (let i = 0; i + 10 <= hookWords.length; i++) {
    const g = hookWords.slice(i, i + 10).join(' ');
    if (grams.has(g)) shared.push(g);
  }
  assert.deepStrictEqual(shared, [],
    `the hook shares a 10-word span with the shipped gate: ${JSON.stringify(shared.slice(0, 2))}. ` +
    `The gate is pinned at nine byte-identical copies with one sha256; a tenth copy inside a ` +
    `TOML value is a drift surface with no owner.`);
});

test('9.7 AC8 the module opens no network and no Confluence-sourced read path', () => {
  const src = fs.readFileSync(path.join(PROJECT_ROOT, 'lib', 'confluence-publish-hook.js'), 'utf-8');
  for (const m of ['http', 'https', 'net', 'child_process', 'dns', 'tls']) {
    assert.ok(!new RegExp(`require\\((['"\`])${m}\\1\\)`).test(src),
      `the module requires ${m}; a publish trigger has no business reaching a network`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 10. AC12 — the three-writer collision ===\n');

/** The end state a `bmad-customize` run leaves: a SPARSE `[workflow]` override. */
function bmadCustomizeEndState(skill) {
  const block = hook.buildPublishHookBlock({
    skillName: skill,
    storeCliName: ORACLE.get(skill) === SYSTEM ? 'system' : 'software',
    storeLabel: tree.labelForStore(ORACLE.get(skill)),
  });
  // `bmad-customize` writes "only the fields being changed" (SKILL.md:71) under a
  // `[workflow]` table (its scope statement, SKILL.md:10), into exactly this path
  // (SKILL.md:87), knowing nothing of these markers.
  return hook.injectPublishHookBlock('', block) +
    '\n[workflow]\non_complete = "Post a summary to the team channel."\n';
}

test('10.1 AC12(a) the collision makes the REAL resolver discard the whole team layer AT EXIT 0', () => {
  const fx = fixture();
  const skill = hook.AUTHORING_SKILLS[0];
  generate(fx, BOTH_CONFLUENCE);
  // The publish resolves before the third writer runs.
  const before = resolveKey(fx, skill, 'workflow.on_complete');
  assert.ok(Array.isArray(before.value), 'precondition: the publish hook must resolve first');

  fs.writeFileSync(teamFile(fx, skill), bmadCustomizeEndState(skill), 'utf-8');
  const after = resolveKey(fx, skill, 'workflow.on_complete');

  assert.strictEqual(after.status, 0,
    'THE POINT OF THIS AC: the resolver exits ZERO. There is no failure for the skill to see.');
  assert.strictEqual(after.value, '',
    `the merged on_complete is ${JSON.stringify(after.value)}; it must be the skill DEFAULT, ` +
    `proving that neither the customizer's instruction nor the publish hook survived`);
  assert.ok(/^warning: failed to parse/m.test(after.stderr),
    `the only trace anywhere is a stderr warning; got ${JSON.stringify(after.stderr)}`);
  assert.ok(/Cannot declare/.test(after.stderr),
    `and the reason must be the duplicate declaration: ${after.stderr}`);
});

test('10.2 AC12(a) [control] the same file WITHOUT the collision resolves both layers fine', () => {
  // Without this the test above could pass because the fixture never worked.
  const fx = fixture();
  const skill = hook.AUTHORING_SKILLS[0];
  generate(fx, BOTH_CONFLUENCE);
  const got = resolveKey(fx, skill, 'workflow.on_complete');
  assert.ok(Array.isArray(got.value) && got.value.length === 1);
  assert.strictEqual(got.stderr.trim(), '', 'a clean team layer produces no warning at all');
});

test('10.3 AC12(b) the generator refuses over that end state as an INPUT and writes nothing', () => {
  const fx = fixture();
  const skill = hook.AUTHORING_SKILLS[0];
  const collided = bmadCustomizeEndState(skill);
  fs.writeFileSync(teamFile(fx, skill), collided, 'utf-8');
  const r = generate(fx, BOTH_CONFLUENCE).results.find((x) => x.skill === skill);
  assert.strictEqual(r.outcome, hook.HOOK_REFUSED_COLLISION,
    'AC4(b) must hold against a state a THIRD writer produced, not only against one the ' +
    'generator declined to create');
  assert.strictEqual(fs.readFileSync(teamFile(fx, skill), 'utf-8'), collided,
    "the customizer's file must not be touched by the refusal");
  assert.ok(r.collisions.some((c) => c.kind === hook.COLLISION_DUPLICATE_TABLE) &&
    r.collisions.some((c) => c.kind === hook.COLLISION_DUPLICATE_KEY),
    `both halves of the end state must be named: ${JSON.stringify(r.collisions)}`);
});

test('10.4 AC12(c) the detection path fires on that end state WITHOUT the generator running', () => {
  // The whole point: this must work in the window between a `bmad-customize` run
  // and the next install, when the generator has not run and cannot run.
  const fx = fixture();
  const skill = hook.AUTHORING_SKILLS[0];
  fs.writeFileSync(teamFile(fx, skill), bmadCustomizeEndState(skill), 'utf-8');
  const found = hook.detectPublishHookCollisions(fx.root);
  assert.strictEqual(found.length, 1, `expected exactly one flagged file, got ${found.length}`);
  assert.strictEqual(found[0].skill, skill);
  assert.ok(found[0].collisions.length > 0, 'and it must say what is wrong');
});

test('10.5 AC12(c) detection and refusal use the SAME predicate, so they cannot disagree', () => {
  const fx = fixture();
  const skill = hook.AUTHORING_SKILLS[0];
  const collided = bmadCustomizeEndState(skill);
  fs.writeFileSync(teamFile(fx, skill), collided, 'utf-8');
  const detected = hook.detectPublishHookCollisions(fx.root)[0].collisions;
  const refused = generate(fx, BOTH_CONFLUENCE).results.find((x) => x.skill === skill).collisions;
  assert.deepStrictEqual(
    detected.filter((c) => c.kind !== hook.COLLISION_BLOCK_NOT_AT_ROOT && c.kind !== hook.COLLISION_HALF_BLOCK),
    refused,
    'a collision the installer refuses over but status does not report — or the reverse — is ' +
    'a window in which the publish is dead and nothing says so');
});

test('10.6 AC12(c) detection also fires on a file that simply does not parse', () => {
  const fx = fixture();
  fs.writeFileSync(teamFile(fx, hook.AUTHORING_SKILLS[1]), 'this is not toml\n', 'utf-8');
  const found = hook.detectPublishHookCollisions(fx.root);
  assert.strictEqual(found.length, 1);
  assert.ok(found[0].collisions.some((c) => c.kind === hook.COLLISION_UNPARSEABLE));
});

test('10.7 AC12(c) detection is SILENT on a healthy project — no false positive', () => {
  const fx = fixture();
  for (const s of hook.AUTHORING_SKILLS) fs.writeFileSync(teamFile(fx, s), USER_CONTENT, 'utf-8');
  generate(fx, BOTH_CONFLUENCE);
  assert.deepStrictEqual(hook.detectPublishHookCollisions(fx.root), [],
    'a project the generator just wrote must not be reported as broken');
  assert.deepStrictEqual(hook.detectPublishHookCollisions(tmpProject()), [],
    'and a project with no override files at all must be silent');
});

test('10.8 AC12(c) the detection path is reachable from the SHIPPED `status` surface', () => {
  // An exported function nothing calls is the "presence, not effect" shape this
  // epic keeps producing. Bound to the shipped call site, not to the export.
  assert.strictEqual(typeof cli.printPublishHookCollisionReport, 'function',
    'the detection surface must be exported so it can be exercised directly');
  const src = fs.readFileSync(path.join(PROJECT_ROOT, 'bin', 'cli.js'), 'utf-8');
  const showStatus = src.slice(src.indexOf('async function showStatus('));
  const body = showStatus.slice(0, showStatus.indexOf('\n}'));
  assert.ok(body.includes('printPublishHookCollisionReport('),
    '`ma-agents status` does not call the detection path, so nothing fires between two installs');

  const fx = fixture();
  const skill = hook.AUTHORING_SKILLS[0];
  fs.writeFileSync(teamFile(fx, skill), bmadCustomizeEndState(skill), 'utf-8');
  const lines = captureLog(() => cli.printPublishHookCollisionReport(fx.root));
  const text = lines.join('\n');
  assert.ok(text.includes(`${skill}.toml`), `the report must name the file:\n${text}`);
  assert.ok(/does not publish to Confluence while this stands/.test(text),
    `the report must state the CONSEQUENCE, not merely the syntax error:\n${text}`);
  assert.ok(/user\.toml/.test(text) && /array/i.test(text),
    `and must name the remedy:\n${text}`);
  assert.deepStrictEqual(captureLog(() => cli.printPublishHookCollisionReport(tmpProject())), [],
    'and must print nothing at all on a healthy project');
});

test('10.9 AC12(d) the emitted block names ma-agents as the owner of the delimited region', () => {
  assert.ok(/GENERATED AND OWNED BY ma-agents/.test(HOOK_BLOCK),
    'the customizer sees a diff before writing; this comment is the only channel this story ' +
    'has into that human decision');
  assert.ok(/Anything OUTSIDE them is yours/.test(HOOK_BLOCK),
    'and must make clear the region is bounded, or it reads as a claim on the whole file');
  assert.ok(/DO NOT add a second `on_complete`/.test(HOOK_BLOCK) &&
    /DO NOT add a `\[workflow\]` table/.test(HOOK_BLOCK),
    'both halves of the collision must be named — the key AND the table');
  assert.ok(/exits 0/.test(HOOK_BLOCK) && /discarded together/.test(HOOK_BLOCK),
    'and the silent-discard consequence must be spelled out, since that is what makes the ' +
    'warning worth heeding');
});

test('10.10 AC12 [authority] the third writer is genuinely upstream, not ma-agents\'', () => {
  for (const rel of ['skills', path.join('lib', 'bmad-extension'),
    path.join('lib', 'bmad-extension-plugin'), path.join('lib', 'bmad-cache')]) {
    const dir = path.join(PROJECT_ROOT, rel);
    if (!fs.existsSync(dir)) continue;
    const hits = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) {
          if (e.name === 'bmad-customize') hits.push(path.join(d, e.name));
          else walk(path.join(d, e.name));
        }
      }
    };
    walk(dir);
    assert.deepStrictEqual(hits, [],
      `bmad-customize source found under ${rel}; AC12's whole premise is that the third writer ` +
      `is not ma-agents' and cannot be changed here`);
  }
  const upstream = path.join(PROJECT_ROOT, 'node_modules', 'bmad-method', 'src',
    'core-skills', 'bmad-customize', 'SKILL.md');
  assert.ok(fs.existsSync(upstream), 'and it must actually ship from bmad-method');
  const text = fs.readFileSync(upstream, 'utf-8');
  assert.ok(/_bmad\/custom\//.test(text),
    'the third writer must actually write into the directory this story writes into');
  assert.ok(/only the fields being changed/.test(text),
    "the sparse-override rule is what produces a bare `on_complete` next to ma-agents' block");
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 11. AC9 — the pinned invariants, re-derived here ===\n');

/** Files changed on this branch relative to its merge base with the epic branch. */
function changedFiles() {
  const base = execFileSync('git', ['merge-base', 'HEAD', 'feature/epic-31'],
    { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
  return execFileSync('git', ['diff', '--name-only', `${base}..HEAD`],
    { cwd: PROJECT_ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })
    .split('\n').map((s) => s.trim()).filter(Boolean);
}

test('11.1 AC9(c) this story modifies NO file under skills/, lib/bmad-extension/skills/ or the plugin mirror', () => {
  const guarded = ['skills/', 'lib/bmad-extension/skills/', 'lib/bmad-extension-plugin/'];
  const offenders = changedFiles().filter((f) => guarded.some((g) => f.startsWith(g)));
  assert.deepStrictEqual(offenders, [],
    `this story touches no skill document by design; it changed ${JSON.stringify(offenders)}. ` +
    `Every one of the shipped-copy invariants is measured over those trees.`);
});

/** Extract a marker-delimited or heading-delimited block, as the pinning suites do. */
function collectHeadingBlocks(roots, heading) {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) {
        const text = fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n');
        const i = text.indexOf(heading);
        if (i === -1) continue;
        const nextH2 = text.indexOf('\n## ', i + heading.length);
        out.push({ file: path.relative(PROJECT_ROOT, p), block: text.slice(i, nextH2 === -1 ? undefined : nextH2).trimEnd() });
      }
    }
  };
  for (const r of roots) walk(path.join(PROJECT_ROOT, r));
  return out;
}

test('11.2 AC9(b) I2 — Story 31.9\'s gate is still NINE shipped copies with ONE sha256', () => {
  const copies = collectHeadingBlocks(
    ['skills', 'lib/bmad-extension/skills', 'lib/bmad-extension-plugin'],
    '## Knowledge Store Backend Routing');
  assert.strictEqual(copies.length, 9,
    `I2 says 9 copies (6 in the two source trees + 3 in the plugin mirror); found ` +
    `${copies.length}: ${copies.map((c) => c.file).join(', ')}. An unexplained count move is a ` +
    `DEFECT, not a rebaseline.`);
  const digests = new Set(copies.map((c) => crypto.createHash('sha256').update(c.block).digest('hex')));
  assert.strictEqual(digests.size, 1,
    `the nine copies are no longer byte-identical: ${digests.size} distinct sha256`);
});

test('11.3 AC9(a) I1 — Story 31.4\'s preflight is still FORTY-ONE shipped copies with ONE sha256', () => {
  const copies = collectHeadingBlocks(
    ['skills', 'lib/bmad-extension/skills', 'lib/bmad-extension-plugin'],
    '## Knowledge Store Binding Preflight');
  assert.strictEqual(copies.length, 41,
    `I1 says 41 copies (27 GUARDED + 14 plugin mirror); found ${copies.length}. An unexplained ` +
    `count move is a DEFECT, not a rebaseline.`);
  const digests = new Set(copies.map((c) => crypto.createHash('sha256').update(c.block).digest('hex')));
  assert.strictEqual(digests.size, 1,
    `the forty-one copies are no longer byte-identical: ${digests.size} distinct sha256`);
});

test('11.4 AC10 Story 31.10\'s epics.md definition is BYTE-UNCHANGED by this story', () => {
  const changed = changedFiles();
  if (!changed.includes('_bmad-output/planning-artifacts/epics.md')) return; // untouched entirely
  const base = execFileSync('git', ['merge-base', 'HEAD', 'feature/epic-31'],
    { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
  const sliceStory10 = (text) => {
    const i = text.indexOf('### Story 31.10:');
    assert.notStrictEqual(i, -1, "Story 31.10's definition could not be located");
    const j = text.indexOf('\n### Story 31.11', i);
    return text.slice(i, j === -1 ? undefined : j);
  };
  const before = execFileSync('git', ['show', `${base}:_bmad-output/planning-artifacts/epics.md`],
    { cwd: PROJECT_ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  const after = fs.readFileSync(path.join(PROJECT_ROOT, '_bmad-output', 'planning-artifacts', 'epics.md'), 'utf-8');
  assert.strictEqual(sliceStory10(after), sliceStory10(before),
    'completed work stays as history: the correction lives in Story 31.15, and 31.10 is not edited');
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 12. The call sites, and the ordering that is load-bearing ===\n');

const CLI_SRC = fs.readFileSync(path.join(PROJECT_ROOT, 'bin', 'cli.js'), 'utf-8');

test('12.1 the generator is called from EXACTLY the three sites `generateBmmConfig` is', () => {
  const lineNumbers = (needle) => CLI_SRC.split(/\r?\n/)
    .map((l, i) => ({ l, n: i + 1 }))
    .filter(({ l }) => l.includes(needle) && !l.trimStart().startsWith('*') &&
      !l.trimStart().startsWith('//') && !l.includes('function ') && !l.includes('module.exports'))
    .map(({ n }) => n);
  const config = lineNumbers('generateBmmConfig({');
  const hooks = lineNumbers('generateConfluencePublishHooks({');
  assert.strictEqual(config.length, 4,
    `expected generateBmmConfig's three production sites plus the writeRepoLayoutConfig ` +
    `adapter; found ${config.length} at lines ${config.join(', ')}`);
  assert.strictEqual(hooks.length, 3,
    `the publish generator must be called from the same three generation sites and NO fourth; ` +
    `found ${hooks.length} at lines ${hooks.join(', ')}`);
});

test('12.2 §4.6 R3 [ordering is load-bearing] generation runs AFTER installBmad()', () => {
  const lines = CLI_SRC.split(/\r?\n/);
  const installAt = lines.map((l, i) => (l.includes('bmad.installBmad(') ? i + 1 : 0)).filter(Boolean);
  const genAt = lines.map((l, i) => (l.includes('generateConfluencePublishHooks({ projectRoot: process.cwd(), fallbackLayout: repoLayout })') ? i + 1 : 0)).filter(Boolean);
  assert.ok(installAt.length > 0, 'installBmad() call sites not found');
  assert.strictEqual(genAt.length, 1, 'the install-path generation site was not found exactly once');
  assert.ok(genAt[0] > Math.max(...installAt),
    `generation is at line ${genAt[0]} and the last installBmad() is at line ${Math.max(...installAt)}. ` +
    `bmad-method's updater restores an unmanifested \`_bmad/custom/*.toml\` VERBATIM from its ` +
    `pre-update backup and exempts only \`config.yaml\` from that restore, so a stale hook comes ` +
    `back. Running after installBmad() is what overwrites it. This ordering is a defect to ` +
    `reverse, not a refactor.`);
});

test('12.3 the install-path generation is inside the project-scope gate, as config.yaml\'s is', () => {
  // FR251 forbids a global install doing project-scoped work. Measured by
  // proximity to the sibling that is already correctly gated.
  const lines = CLI_SRC.split(/\r?\n/);
  const cfg = lines.findIndex((l) => l.includes('generateBmmConfig({ projectRoot: process.cwd(), fallbackLayout: repoLayout })'));
  const gen = lines.findIndex((l) => l.includes('generateConfluencePublishHooks({ projectRoot: process.cwd(), fallbackLayout: repoLayout })'));
  assert.ok(cfg !== -1 && gen !== -1, 'both install-path generation calls must exist');
  assert.ok(gen > cfg && gen - cfg < 20,
    `the publish generation (line ${gen + 1}) must sit with config.yaml's generation ` +
    `(line ${cfg + 1}) inside the same installScope gate; they are ${gen - cfg} lines apart`);
});

test('12.4 a binding the system refuses to trust generates NOTHING, and says so', () => {
  // The same disposition `generateBmmConfig` takes (2B nit 4): a derived artifact
  // is never built from a binding we would not read.
  const root = tmpProject();
  fs.mkdirSync(path.join(root, '_bmad-output'), { recursive: true });
  fs.writeFileSync(path.join(root, '_bmad-output', 'project-layout.yaml'), ':\n: not: yaml: [\n', 'utf-8');
  const lines = captureLog(() => {
    const out = cli.generateConfluencePublishHooks({ projectRoot: root });
    assert.deepStrictEqual(out.results, [], 'nothing may be generated from a binding we refuse to read');
  });
  assert.ok(/Refusing to regenerate/.test(lines.join('\n')),
    `the refusal must be stated by name:\n${lines.join('\n')}`);
  assert.ok(!fs.existsSync(path.join(root, '_bmad', 'custom')), 'and nothing may be created');
});

test('12.5 an UNBOUND project with no fallback layout generates nothing, by a NAMED reason', () => {
  const root = tmpProject();
  const lines = captureLog(() => {
    const out = cli.generateConfluencePublishHooks({ projectRoot: root });
    assert.deepStrictEqual(out.results, []);
    assert.strictEqual(out.reason, 'unbound', 'the reason must be a named value, not a bare false');
  });
  assert.ok(/No Confluence publish overrides generated/.test(lines.join('\n')),
    `no silent skip: ${lines.join('\n')}`);
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n=== 13. AC3(b) / §4.6 R3 — proved against a REAL bmad-method install ===\n');

/**
 * A REAL install, not a simulated one, because AC3(b) is a claim about what
 * ANOTHER PACKAGE's installer does to this file and a simulation of it would be
 * a claim about the simulation.
 *
 * It is affordable: `bmad-cli.js` is already in `node_modules`, the run is
 * offline, and each install takes under two seconds. This is NOT the four-real-
 * `npm install` shape that makes `project-layout-two-store-round-trip` expensive
 * — no package manager is invoked here at all.
 */
const BMAD_CLI = path.join(PROJECT_ROOT, 'node_modules', 'bmad-method',
  'tools', 'installer', 'bmad-cli.js');

function realBmadInstall(projectRoot) {
  const r = spawnSync(process.execPath, [BMAD_CLI, 'install',
    '--directory', projectRoot, '--modules', 'bmm', '--tools', 'claude-code', '--yes'],
  { encoding: 'utf8', cwd: PROJECT_ROOT, timeout: 480000 });
  assert.strictEqual(r.status, 0,
    `the bmad-method installer failed (${r.status}):\n${String(r.stdout).slice(-1200)}\n` +
    `${String(r.stderr).slice(-600)}`);
}

test('13.1 §4.6 R2 a REAL fresh install creates `_bmad/custom/`, and the generator writes into it', () => {
  assert.ok(fs.existsSync(BMAD_CLI), `bmad-method's installer entry point is missing at ${BMAD_CLI}`);
  const root = tmpProject();
  realBmadInstall(root);
  assert.ok(fs.existsSync(path.join(root, '_bmad', 'custom')),
    'the directory is created by ANOTHER PACKAGE (install-paths.js:24) — ma-agents contributes ' +
    'no path segment and no content to it today');
  assert.ok(fs.existsSync(path.join(root, '_bmad', 'scripts', 'resolve_customization.py')),
    'and the resolver must land, or the channel does not exist in a real project');
  const out = hook.generatePublishHooks({ projectRoot: root, stores: BOTH_CONFLUENCE });
  assert.deepStrictEqual(out.results.map((r) => r.outcome), Array(5).fill(hook.HOOK_WROTE),
    `generation over a real install: ${JSON.stringify(out.results.map((r) => [r.skill, r.outcome]))}`);
});

test('13.2 §4.6 R3 an UPDATE restores the file verbatim — including a STALE block — and generation after it wins', () => {
  // Three separate facts, all measured on the same real update:
  //
  //  (1) AC3(b) IS UPHELD UPSTREAM. An unmanifested `_bmad/custom/*.toml` is
  //      classified `customFiles`, backed up and restored verbatim, so a user's
  //      hand-written content survives an install it never asked for.
  //  (2) THE INVERSE IS THE HAZARD, AND IT IS REAL. `config.yaml` is EXEMPTED
  //      from that restore (installer.js:915-917) and this file is not, so a
  //      STALE block comes back rather than being regenerated. This asserts the
  //      hazard EXISTS rather than assuming it, because the ordering rule in
  //      `bin/cli.js` is justified by it and an ordering rule with no hazard
  //      behind it is cargo cult.
  //  (3) THE ORDERING IS WHAT MAKES IT SAFE. Generation running AFTER the
  //      install overwrites what the install restored. That is why the call site
  //      is at bin/cli.js's install Step 3.6 and not earlier (pinned by 12.2).
  const root = tmpProject();
  realBmadInstall(root);

  const skill = 'bmad-prd';
  fs.writeFileSync(hook.customOverridePath(root, skill), USER_CONTENT, 'utf-8');
  hook.generatePublishHooks({ projectRoot: root, stores: BOTH_CONFLUENCE });

  // Age the block into something a later build would not produce, and stamp
  // config.yaml so the exemption can be observed in the same run.
  const fresh = fs.readFileSync(hook.customOverridePath(root, skill), 'utf-8');
  const STALE = 'confluence-plan --store A-STORE-THAT-NO-LONGER-EXISTS';
  fs.writeFileSync(hook.customOverridePath(root, skill),
    fresh.replace('confluence-plan --store system', STALE), 'utf-8');
  const cfgPath = path.join(root, '_bmad', 'bmm', 'config.yaml');
  const PROBE = 'ma_agents_r3_probe: "before-update"';
  fs.writeFileSync(cfgPath, fs.readFileSync(cfgPath, 'utf-8') + `\n${PROBE}\n`, 'utf-8');

  realBmadInstall(root); // the UPDATE — an existing `_bmad/` is present

  const restored = readIf(hook.customOverridePath(root, skill));
  assert.notStrictEqual(restored, null,
    '(1) the override file did not survive the update at all; AC3(b) fails outright');
  assert.strictEqual(hook.removePublishHookBlock(restored), USER_CONTENT,
    "(1) the user's own content did not survive the update byte-identical");
  assert.ok(restored.includes(STALE),
    '(2) the STALE block was NOT restored. If upstream has started exempting ' +
    '`_bmad/custom/*.toml` the way it exempts config.yaml, §4.6 R3 no longer holds and the ' +
    'ordering rule in bin/cli.js should be re-justified — do not simply delete this assertion.');
  assert.ok(!fs.readFileSync(cfgPath, 'utf-8').includes(PROBE),
    '(2) config.yaml kept a hand-added key across an update, so it is no longer the EXEMPTED ' +
    'file the hazard is defined against and the asymmetry has gone');

  const out = hook.generatePublishHooks({ projectRoot: root, stores: BOTH_CONFLUENCE });
  assert.strictEqual(out.results.find((r) => r.skill === skill).outcome, hook.HOOK_WROTE,
    '(3) generation after the install must actually rewrite the restored block');
  const final = fs.readFileSync(hook.customOverridePath(root, skill), 'utf-8');
  assert.ok(!final.includes(STALE), '(3) the stale block survived a post-install generation');
  assert.ok(final.includes('confluence-plan --store system'), '(3) and the current one is back');
  assert.strictEqual(hook.removePublishHookBlock(final), USER_CONTENT,
    "(3) and the user's content is STILL byte-identical after all of it");
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
