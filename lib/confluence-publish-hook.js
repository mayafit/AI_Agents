'use strict';

/**
 * Story 31.15 — THE PUBLISH TRIGGER for the five BMAD authoring skills.
 *
 * Epic 31 built the whole Confluence publish protocol (Story 31.10's page tree,
 * `ma-agents confluence-plan`, Story 31.9's fail-loud gate) and then had nothing
 * fire it for the five upstream authoring workflows. They are `bmad-method`
 * documents — ma-agents does not own them and cannot edit them — so the trigger
 * is delivered through the channel upstream sanctions for exactly this: the
 * three-layer customization override.
 *
 *   {skill-root}/customize.toml              (skill defaults)
 *   {project-root}/_bmad/custom/<skill>.toml       ← THIS MODULE writes here
 *   {project-root}/_bmad/custom/<skill>.user.toml  ← NEVER touched (AC2)
 *
 * All five skills resolve that merge at activation and refuse to begin until it
 * resolves; all five run `{workflow.on_complete}` as their terminal step. So an
 * `on_complete` in the TEAM layer is a publish trigger for a document this
 * package does not ship.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE IS NOT — read before adding anything to it.
 * ────────────────────────────────────────────────────────────────────────────
 * FR266 (a local mirror of a Confluence-backed store) is RETIRED, ID never
 * reused. P5-9.6 names an accidental mirror as the single most likely way this
 * epic reacquires the subsystem it removed, and the release gate runs a negative
 * check over shipped text that has already been defeated seven times. The hook
 * text this module emits is new shipped text. Rules it actually obeys, and that
 * `test/project-layout-confluence-publish-hook.test.js` actually measures:
 *
 *   1. The publish is ONE-WAY. Nothing here, and nothing the emitted text
 *      instructs, brings Confluence content back to disk under any name.
 *   2. The emitted text matches ZERO entries of the release gate's shipped
 *      mirror vocabulary. Not "matches and is adjudicated" — zero. The
 *      vocabulary is EXTRACTED from `test/release-gate-epic-31.test.js` at test
 *      time rather than restated, so a widened vocabulary upstream tightens this
 *      check automatically instead of leaving it behind.
 *   3. The hook ROUTES to the shipped protocol by naming
 *      `ma-agents confluence-plan --store <store>`. It is not a tenth copy of
 *      Story 31.9's gate block (pinned at nine copies / one sha256); a tenth
 *      copy in a TOML value would be a drift surface with no owner.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE THREE-WRITER COLLISION (§4.6 R5 / AC12) — the reason half this file
 * exists.
 * ────────────────────────────────────────────────────────────────────────────
 * After this story THREE parties write `_bmad/custom/<skill>.toml`:
 *
 *   (i)   this generator;
 *   (ii)  a human hand-editing the team layer;
 *   (iii) an AGENT running the upstream `bmad-customize` skill, which authors
 *         TOML into exactly this path at runtime, writes SPARSE overrides ("only
 *         the fields being changed"), and knows nothing of these markers. That
 *         skill is not ma-agents' — it ships from
 *         `node_modules/bmad-method/src/core-skills/bmad-customize/`.
 *
 * TOML forbids duplicate keys, and `_bmad/scripts/resolve_customization.py`
 * treats a `TOMLDecodeError` in a NON-REQUIRED layer as a warning: it prints
 * `warning:` to stderr, returns `{}`, and the process exits ZERO. So a second
 * `on_complete` — or a second `[workflow]` table — anywhere in this file
 * discards THE ENTIRE TEAM LAYER: the customizer's change and the publish hook
 * together, with nothing on the skill's path to notice. The publish silently
 * stops happening and the workflow still tells the user the artifact is ready.
 *
 * That failure lives UPSTREAM, in a file re-copied on every bmad-method install,
 * so nothing here can prevent it. Three defences are possible and all three are
 * implemented:
 *
 *   (b) `scanForCollisions` — the generator REFUSES over such a file, names it,
 *       names the construct and the line, and writes nothing (AC4b/AC12b).
 *   (c) `detectPublishHookCollisions` — a detection path INDEPENDENT of the
 *       generator, surfaced by `ma-agents status`, because a collision
 *       introduced BETWEEN two generations is otherwise a dead, silent publish
 *       for as long as it takes someone to re-install (AC12c).
 *   (d) the emitted block carries an in-file owner comment pointing a customizer
 *       at the one override form that appends rather than replaces (AC12d).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THE BLOCK IS A DOTTED KEY AT THE TOP OF THE FILE
 * ────────────────────────────────────────────────────────────────────────────
 * Measured against real `tomllib`, not reasoned about:
 *
 *   - A `[workflow]` table HEADER swallows everything that follows it at root
 *     level. `[workflow]\non_complete=[...]\nuser_key = 2` puts the USER's
 *     `user_key` inside `workflow`. A header form therefore silently captures
 *     content appended after our block — a corruption of user content, which is
 *     the one thing AC3(b) forbids.
 *   - A dotted key inherits the CURRENT table context: `[agent]\nname="a"\n
 *     workflow.on_complete=[...]` resolves to `agent.workflow.on_complete` and
 *     the publish silently never fires. Dotted is only safe at ROOT scope.
 *
 * So: dotted key, and ALWAYS re-anchored at the top of the file, where root
 * scope is guaranteed by position rather than assumed. `injectPublishHookBlock`
 * removes an existing block from wherever it sits and re-inserts at the top, so
 * a block a human moved under a table heals on the next generation instead of
 * resolving to the wrong key path forever; `detectPublishHookCollisions` reports
 * the state in the meantime.
 *
 * The rejected alternative, recorded so it is not re-proposed: appending
 * `on_complete` INSIDE a user's existing `[workflow]` section (no header of our
 * own, no duplicate-table error). It fails the same test — if the user later
 * removes their `[workflow]` header our bare `on_complete` migrates to root
 * scope, becomes the wrong key path, and the publish stops with no error
 * anywhere. A form whose correctness depends on someone else's line staying put
 * is not a form this story may ship.
 */

const fs = require('fs');
const path = require('path');

const confluencePageTree = require('./confluence-page-tree');

// ───────────────────────────────────────────────────────────────────────────
// THE FIVE, AND THEIR STORES.
//
// FR264's enumeration sentence is the authority
// (`_bmad-output/planning-artifacts/prd/capabilities/
//   project-knowledge-and-repository-layout.md:60`):
//
//   "Only the workflows FR119 enumerates as producing store-specific artifacts
//    read the new fields — PRODUCT BRIEF AND PRD RESOLVE TO THE SYSTEM STORE,
//    ARCHITECTURE, UX AND EPICS TO THE SOFTWARE STORE."
//
// corroborated by FR255 (`:50`, the system store holds the product brief and the
// PRD) and FR256 (`:51`, the software store holds the architecture document, UX
// designs, and epics).
//
// The suite builds its oracle by PARSING that PRD sentence and compares it to
// this table. The two are therefore independent statements of the same fact and
// cannot agree by construction — which is the whole point, because this epic has
// already produced six tautological tests whose expectation came from the same
// source as the code.
//
// The keys are the deployed skill-directory names, which is what
// `resolve_customization.py` derives `<skill>.toml` from
// (`skill_name = skill_dir.name`).
// ───────────────────────────────────────────────────────────────────────────
const AUTHORING_SKILL_STORES = Object.freeze({
  'bmad-product-brief': confluencePageTree.SYSTEM_REQUIREMENTS,
  'bmad-prd': confluencePageTree.SYSTEM_REQUIREMENTS,
  'bmad-architecture': confluencePageTree.SOFTWARE_REQUIREMENTS,
  'bmad-ux': confluencePageTree.SOFTWARE_REQUIREMENTS,
  'bmad-create-epics-and-stories': confluencePageTree.SOFTWARE_REQUIREMENTS,
});

/** The skills, in a stable order, so generation output is deterministic. */
const AUTHORING_SKILLS = Object.freeze(Object.keys(AUTHORING_SKILL_STORES).sort());

// Every store an authoring skill names must be a store that actually publishes,
// or the hook would route to a `--store` value `confluence-plan` rejects. Fails
// at load rather than at the moment a user runs an install.
for (const [skill, storeId] of Object.entries(AUTHORING_SKILL_STORES)) {
  if (!confluencePageTree.PUBLISHING_STORES.includes(storeId)) {
    throw new Error(
      `lib/confluence-publish-hook.js: ${skill} is mapped to store ${JSON.stringify(storeId)}, ` +
      `which is not one of the publishing stores ` +
      `(${confluencePageTree.PUBLISHING_STORES.map((s) => JSON.stringify(s)).join(', ')}).`
    );
  }
}

// ───────────────────────────────────────────────────────────────────────────
// MARKERS. Same discipline as `injectOnPremPrefixBlock` (`lib/bmad.js:1324`):
// fresh insert, in-place replace, trailing-newline swallow, malformed half-block
// treated as a fresh insert rather than as licence to corrupt the file further.
// TOML comment syntax, because that is what this file is.
// ───────────────────────────────────────────────────────────────────────────
const PUBLISH_HOOK_MARKER_BEGIN = '# BEGIN:ma-agents-confluence-publish';
const PUBLISH_HOOK_MARKER_END = '# END:ma-agents-confluence-publish';

/** The key this module owns, fully qualified. Exported so tests name it once. */
const PUBLISH_HOOK_KEY = 'workflow.on_complete';
/**
 * The SAME key as a resolved path, which is the only form a collision test may
 * use.
 *
 * FIX ROUND 1 (independent review, ALSO-FIX). `scanForCollisions` used to flag
 * any key whose LAST dotted segment was `on_complete`, without asking whether it
 * resolved to the key this module owns. `agent.on_complete`, a bare root
 * `on_complete`, `[[items]]` … `on_complete` and `[agent]` … `workflow.on_complete`
 * are all DIFFERENT key paths that TOML is perfectly happy to hold beside
 * `workflow.on_complete` — measured against real `tomllib` on the COMBINED file,
 * not reasoned about. The old predicate refused over every one of them, and a
 * refusal is not a warning: `ma-agents install` wrote no hook for ANY of the five
 * skills, printed a remedy that did not apply, and exited non-zero on a healthy
 * project — on every subsequent install and `bind`, so it did not self-heal.
 *
 * The module's own stated principle (`:221-223`) is that a FALSE REJECTION is
 * the worse direction because it blocks an install. That principle now has a
 * test behind it: the collision predicate is measured against `tomllib`'s
 * verdict on the combined file, in both directions.
 */
const PUBLISH_HOOK_KEY_PATH = Object.freeze(PUBLISH_HOOK_KEY.split('.'));
/** The table a competing writer would declare. Exported for the same reason. */
const PUBLISH_HOOK_TABLE = 'workflow';

// ───────────────────────────────────────────────────────────────────────────
// GENERATION OUTCOMES, AS VALUES.
//
// Same reason the `LAYOUT_WRITE_*` and `ROOT_ID_*` reasons are values in
// `bin/cli.js`: a test must be able to branch on the outcome BY NAME, so
// "no hook because the store is file-system" and "no hook because we refused
// over a collision" can never be collapsed into one silent falsy.
// ───────────────────────────────────────────────────────────────────────────
const HOOK_WROTE = 'wrote';
const HOOK_UNCHANGED = 'unchanged';
const HOOK_REMOVED = 'removed';
const HOOK_NOT_APPLICABLE = 'not-applicable';
const HOOK_REFUSED_COLLISION = 'refused-collision';
const HOOK_REFUSED_INVALID_TOML = 'refused-invalid-toml';
const HOOK_WRITE_FAILED = 'write-failed';

/** Outcomes that mean "this project will not publish from this skill". */
const HOOK_NO_PUBLISH_OUTCOMES = Object.freeze([
  HOOK_REMOVED, HOOK_NOT_APPLICABLE, HOOK_REFUSED_COLLISION,
  HOOK_REFUSED_INVALID_TOML, HOOK_WRITE_FAILED,
]);

/** Collision kinds, also values. */
const COLLISION_DUPLICATE_KEY = 'on_complete-outside-markers';
const COLLISION_DUPLICATE_TABLE = 'workflow-table-outside-markers';
const COLLISION_UNPARSEABLE = 'file-does-not-parse';
const COLLISION_BLOCK_NOT_AT_ROOT = 'block-not-at-root-scope';
const COLLISION_HALF_BLOCK = 'begin-marker-without-end';

/**
 * R10, no longer only a disclosure — the PERSONAL layer silently replacing the
 * publish.
 *
 * NOT a collision kind: it is never returned by `scanForCollisions`, never
 * blocks a write, and never reaches the installer's refusal. A user is entitled
 * to replace the hook in their own layer, and refusing to install over it would
 * be exactly the false rejection this module forbids itself. It is a READ-ONLY
 * observation on the `status` surface and nothing else.
 *
 * The fact it reports is AC7(b)'s residual, which the story disclosed and shipped
 * no detector for: `deep_merge` appends array+array and falls through to
 * `return override` for everything else, so
 * `workflow.on_complete = "…"` (a SCALAR) in `_bmad/custom/<skill>.user.toml`
 * replaces the publish outright, at exit 0, with no warning anywhere. That is
 * the same end state as a collision — the publish stops happening and the
 * workflow still tells the user the artifact is ready — reached by a different
 * route, and `status` is the one place that can say so.
 */
const USER_LAYER_SCALAR_OVERRIDE = 'user-layer-scalar-on_complete';

// ═══════════════════════════════════════════════════════════════════════════
// A TOML READER, SCOPED TO WHAT THIS STORY MUST PROVE.
//
// Node ships no TOML parser and this package carries no TOML dependency, so
// AC4(a)'s "the resulting file parses" needs a check that runs at install time
// on a machine that may have no Python at all. What follows is that check.
//
// STATED PLAINLY, BECAUSE IT IS A DEVIATION FROM AC4(a)'s LETTER: this is not
// `tomllib`. It is a scanner that recognises the constructs a BMAD customization
// file is made of and reports the two failures that can actually arise here — a
// duplicate key path and a re-declared table — plus gross malformation. Its
// equivalence to real `tomllib` is not asserted here; it is PROVED in the suite,
// which runs both over the same corpus and fails on any disagreement. The
// corpus, not this comment, is the warrant.
//
// It is deliberately conservative about REJECTING: a false rejection blocks an
// install, so a construct it does not understand is reported only when the line
// cannot be a table header or a key/value at all.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Split `text` into logical TOML statements, tracking string and bracket state
 * so a value spanning several physical lines is one statement and a `#` inside
 * a string is not a comment.
 *
 * @param {string} text
 * @returns {{statements: Array<{text: string, line: number}>, problems: Array<{line: number, message: string}>}}
 */
function tomlStatements(text) {
  const problems = [];
  const statements = [];
  const lines = text.split(/\r?\n/);

  let buf = '';
  let bufLine = 0;
  let multi = null;           // '"""' or "'''" when inside a multi-line string
  let multiLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    let j = 0;
    let out = '';

    while (j < raw.length) {
      if (multi) {
        const close = raw.indexOf(multi, j);
        if (close === -1) { out += raw.slice(j); j = raw.length; break; }
        out += raw.slice(j, close + multi.length);
        j = close + multi.length;
        multi = null;
        continue;
      }
      const ch = raw[j];
      if (ch === '#') { j = raw.length; break; }               // comment to EOL
      if (ch === '"' || ch === "'") {
        // Multi-line opener?
        if (raw.startsWith(ch.repeat(3), j)) {
          multi = ch.repeat(3);
          multiLine = i + 1;
          out += multi;
          j += 3;
          continue;
        }
        // Single-line string. Literal strings ('') have no escapes.
        let k = j + 1;
        let closed = false;
        while (k < raw.length) {
          if (ch === '"' && raw[k] === '\\') { k += 2; continue; }
          if (raw[k] === ch) { closed = true; break; }
          k++;
        }
        if (!closed) {
          problems.push({
            line: i + 1,
            message: `unterminated ${ch === '"' ? 'basic' : 'literal'} string`,
          });
          return { statements, problems };
        }
        out += raw.slice(j, k + 1);
        j = k + 1;
        continue;
      }
      out += ch;
      j++;
    }

    if (buf === '') bufLine = i + 1;
    buf += (buf === '' ? '' : '\n') + out;

    const stillOpen = multi !== null || openBrackets(buf) > 0;
    if (!stillOpen) {
      const t = buf.trim();
      if (t !== '') statements.push({ text: t, line: bufLine });
      buf = '';
    }
  }

  if (multi) problems.push({ line: multiLine, message: 'unterminated multi-line string at end of file' });
  else if (buf.trim() !== '') problems.push({ line: bufLine, message: 'unterminated value at end of file' });

  return { statements, problems };
}

/** Net unclosed `[`/`{` in an already comment- and string-stripped fragment. */
function openBrackets(fragment) {
  let depth = 0;
  let inStr = null;
  for (let i = 0; i < fragment.length; i++) {
    const c = fragment[i];
    if (inStr) {
      if (inStr === '"' && c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
  }
  // A leading table header `[a]` balances itself; a value's `[` does not.
  return depth > 0 ? depth : 0;
}

/** Split a dotted key into its parts, honouring quoted segments. */
function splitDottedKey(key) {
  const parts = [];
  let cur = '';
  let inStr = null;
  for (let i = 0; i < key.length; i++) {
    const c = key[i];
    if (inStr) {
      if (inStr === '"' && c === '\\') { cur += key[i + 1] || ''; i++; continue; }
      if (c === inStr) { inStr = null; continue; }
      cur += c;
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '.') { parts.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur.trim());
  return parts.filter((p) => p !== '');
}

/**
 * Parse `text` into the structural facts this story reasons about.
 *
 * @param {string} text
 * @returns {{
 *   problems: Array<{line:number,message:string}>,
 *   keys: Array<{path: string[], line: number, dotted: boolean, scope: string[], value: string}>,
 *   tables: Array<{path: string[], line: number, array: boolean}>
 * }}
 */
function readTomlStructure(text) {
  const { statements, problems } = tomlStatements(text);
  const keys = [];
  const tables = [];

  // Declared table paths, and table paths brought into existence by a dotted key.
  //
  // ARRAY-OF-TABLES NAMESPACING. `[[x]]` starts a NEW element, so `a = 1` in the
  // second `[[x]]` is not a redefinition of `a = 1` in the first, and `[x.y]`
  // under each element is not a re-declaration either. Without this every real
  // `bmad-*/customize.toml` in the tree — they all use `[[agent.menu]]` — was
  // reported as invalid, which would have refused to write the hook on every
  // project. Measured against `tomllib` on the shipped corpus, not reasoned about.
  const declaredTables = new Set();
  const dottedTables = new Set();
  const definedKeys = new Set();
  const arrayTableCount = new Map();
  let scope = [];

  /** Qualify a path with the array-of-tables element it currently belongs to. */
  const nsKey = (parts) => {
    for (let n = parts.length; n >= 1; n--) {
      const p = parts.slice(0, n).join(' ');
      if (arrayTableCount.has(p)) return `${p}#${arrayTableCount.get(p)}|${parts.join(' ')}`;
    }
    return parts.join(' ');
  };

  for (const st of statements) {
    const first = st.text.split('\n')[0].trim();

    const arrayTable = /^\[\[(.+?)\]\]\s*$/.exec(first);
    const table = arrayTable ? null : /^\[(.+?)\]\s*$/.exec(first);

    if (arrayTable || table) {
      const raw = (arrayTable || table)[1];
      const parts = splitDottedKey(raw);
      if (parts.length === 0) {
        problems.push({ line: st.line, message: 'empty table header' });
        continue;
      }
      if (arrayTable) {
        const p = parts.join(' ');
        arrayTableCount.set(p, (arrayTableCount.get(p) || 0) + 1);
      } else {
        const key = nsKey(parts);
        if (declaredTables.has(key)) {
          problems.push({ line: st.line, message: `cannot declare [${parts.join('.')}] twice` });
        } else if (dottedTables.has(key)) {
          problems.push({
            line: st.line,
            message: `cannot declare [${parts.join('.')}] — it was already created by a dotted key`,
          });
        }
        declaredTables.add(key);
      }
      tables.push({ path: parts, line: st.line, array: !!arrayTable });
      scope = parts;
      continue;
    }

    const eq = indexOfTopLevelEquals(first);
    if (eq === -1) {
      problems.push({
        line: st.line,
        message: `line is neither a table header nor a key/value assignment: ${JSON.stringify(first.slice(0, 60))}`,
      });
      continue;
    }
    // `first` is a prefix of `st.text`, so an index into it is an index into it.
    const lhs = first.slice(0, eq).trim();
    const rhs = st.text.slice(eq + 1).trim();
    if (lhs === '') {
      problems.push({ line: st.line, message: 'key/value assignment with an empty key' });
      continue;
    }
    if (rhs === '') {
      problems.push({ line: st.line, message: `key ${JSON.stringify(lhs)} has no value` });
      continue;
    }
    const parts = splitDottedKey(lhs);
    if (parts.length === 0) {
      problems.push({ line: st.line, message: 'key/value assignment with an empty key' });
      continue;
    }
    const abs = scope.concat(parts);
    const key = nsKey(abs);
    if (definedKeys.has(key)) {
      problems.push({ line: st.line, message: `cannot define ${abs.join('.')} twice` });
    }
    // A DOTTED key brings its own intermediate tables into existence, and a later
    // explicit header over one of those is the "cannot declare twice" error
    // `tomllib` raises (measured, not assumed). Only the intermediates the dotted
    // key itself introduces count: a table declared by `[a.b]` creates `a` as a
    // SUPER-table, which TOML explicitly permits `[a]` to declare afterwards, so
    // walking the whole absolute path here would reject `[a.b]` … `[a]` — valid
    // TOML that appears in the shipped corpus.
    for (let n = 1; n < parts.length; n++) {
      dottedTables.add(nsKey(scope.concat(parts.slice(0, n))));
    }
    definedKeys.add(key);
    // `value` is the RAW right-hand side, comment- and string-normalised by
    // `tomlStatements`. It is carried so a caller can tell an ARRAY value from a
    // SCALAR one without a second parser — the single distinction AC7's residual
    // turns on (`deep_merge` appends array+array and REPLACES on anything else).
    keys.push({ path: abs, line: st.line, dotted: parts.length > 1, scope: scope.slice(), value: rhs });
  }

  return { problems, keys, tables };
}

/** Index of the `=` that separates key from value, ignoring quoted segments. */
function indexOfTopLevelEquals(line) {
  let inStr = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (inStr === '"' && c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '=') return i;
    if (c === '[' || c === '{') return -1;
  }
  return -1;
}

/**
 * Every syntactic problem in `text`, as `tomllib` would see it — to the extent
 * this scanner sees it. Empty array means "we found nothing wrong".
 */
function tomlProblems(text) {
  return readTomlStructure(text).problems;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE BLOCK.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The one-instruction publish directive, as it appears inside the TOML array.
 *
 * Every clause here is load-bearing and named:
 *
 *   - It ROUTES rather than restates (§4.5). `ma-agents confluence-plan` already
 *     prints the operation catalogue, the parents-first order, the
 *     resolve→update/create rule, the root-page write-back command and the
 *     terminal STOP. Repeating them here would make a tenth copy of a block
 *     pinned at nine.
 *   - It carries FR262's fail-loud obligation for the one case the plan output
 *     cannot state: no Confluence MCP at all.
 *   - AC5(c). `on_complete` runs AFTER the workflow has already told the user
 *     the artifact is ready — `bmad-prd/SKILL.md:91` ("Share artifact paths")
 *     precedes `:92` ("Run `{workflow.on_complete}`"), and the same ordering
 *     holds in `bmad-architecture` and `bmad-product-brief`. Without an explicit
 *     instruction to go back and correct that message, this story would ship
 *     "success reported over a failed write" as a STRUCTURAL property. That is
 *     the epic's signature defect and the reason this clause is not boilerplate.
 *   - It contains NO word of the release gate's mirror vocabulary. Not by
 *     accident: "write" and "copy" are both IN that vocabulary, so the failure
 *     clause says "operation" and the prohibition says "on disk" rather than
 *     "local copy". Asserted, not hoped for.
 */
function publishHookInstruction(storeCliName, storeLabel) {
  return (
    `Publish this workflow's artifacts to the ${storeLabel}, which this project binds to Confluence. ` +
    `Run \`ma-agents confluence-plan --store ${storeCliName}\` and carry out every operation it prints, ` +
    `in the order it prints them, following its own stated instructions exactly; do not perform any ` +
    `operation it does not list. ` +
    `If no Confluence MCP server is reachable, or any operation does not report success, STOP: name ` +
    `what failed, state that NO publish happened, and go back and correct the artifact-ready message ` +
    `you already gave the user — that message was given in the previous step, before this one ran, so ` +
    `the user has been told the artifact is finished when it is not in Confluence. ` +
    `Do not proceed and do not offer anything on disk as a stand-in.`
  );
}

/**
 * The full marker-delimited block for one skill.
 *
 * The owner comment is AC12(d): the only channel this story has into the human
 * decision `bmad-customize` puts in front of its author ("If the file exists,
 * show a diff. Never silently overwrite … Wait for explicit yes",
 * `.claude/skills/bmad-customize/SKILL.md:85-86`). It is a mitigation and never
 * a guarantee — (a), (b) and (c) must stand without it.
 *
 * @param {object} opts
 * @param {string} opts.skillName        deployed skill-directory name
 * @param {string} opts.storeCliName     `system` | `software`
 * @param {string} opts.storeLabel       human label for the store
 * @returns {string} block text, ending WITHOUT a trailing newline
 */
function buildPublishHookBlock(opts) {
  const { skillName, storeCliName, storeLabel } = opts;
  const instruction = publishHookInstruction(storeCliName, storeLabel);
  return [
    PUBLISH_HOOK_MARKER_BEGIN,
    '#',
    '# GENERATED AND OWNED BY ma-agents. This region is regenerated from',
    '# _bmad-output/project-layout.yaml on every `ma-agents install` and every',
    '# `ma-agents bind`. Anything you put BETWEEN the two markers is replaced.',
    '# Anything OUTSIDE them is yours and is kept exactly as you left it.',
    '# Keep this region at the top of the file: it uses a dotted key, which binds',
    '# to whatever table precedes it, and only the top of the file is guaranteed',
    '# to be the root table.',
    '#',
    '# TO ADD YOUR OWN on_complete, put it in',
    `#     _bmad/custom/${skillName}.user.toml`,
    '# as a TOML ARRAY:',
    '#     workflow.on_complete = [ "your instruction" ]',
    '# An array APPENDS to the one below and both run. A string scalar REPLACES',
    '# it, and this publish then stops happening.',
    '#',
    '# DO NOT add a second `on_complete`, and DO NOT add a `[workflow]` table, to',
    '# THIS file. TOML forbids both. _bmad/scripts/resolve_customization.py treats',
    '# a parse failure in this layer as a warning: it returns an empty table and',
    '# exits 0, so YOUR customization and this publish are discarded together and',
    '# nothing reports it. `ma-agents status` names that state if it happens, and',
    '# the next install or bind refuses to regenerate over it.',
    '#',
    `${PUBLISH_HOOK_KEY} = [`,
    `  ${tomlBasicString(instruction)},`,
    ']',
    PUBLISH_HOOK_MARKER_END,
  ].join('\n');
}

/** Encode `s` as a TOML basic string. */
function tomlBasicString(s) {
  return '"' + String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t') + '"';
}

/**
 * Locate the marker block. Returns `null` when there is no BEGIN marker, and
 * `{begin, end: null}` for a malformed half-block (BEGIN without END) — the
 * caller decides, exactly as `injectOnPremPrefixBlock` does.
 */
function findPublishHookBlock(content) {
  const begin = content.indexOf(PUBLISH_HOOK_MARKER_BEGIN);
  if (begin === -1) return null;
  const endMarker = content.indexOf(PUBLISH_HOOK_MARKER_END, begin);
  if (endMarker === -1) return { begin, end: null };
  return { begin, end: endMarker + PUBLISH_HOOK_MARKER_END.length };
}

/** Content with the marker block excised, swallowing one trailing newline. */
function removePublishHookBlock(content) {
  const found = findPublishHookBlock(content);
  if (!found || found.end === null) return content;
  const after = content[found.end] === '\r' && content[found.end + 1] === '\n'
    ? found.end + 2
    : content[found.end] === '\n' ? found.end + 1 : found.end;
  return content.slice(0, found.begin) + content.slice(after);
}

/**
 * Insert-or-replace the block, ALWAYS at the top of the file.
 *
 * Idempotent by construction: the block is removed from wherever it is and
 * re-inserted at offset 0, so a second call with the same block returns
 * byte-identical content, no blank line accumulates, and a block a human moved
 * under a table heading is re-anchored to root scope rather than left resolving
 * to `<thattable>.workflow.on_complete`.
 *
 * A malformed half-block (BEGIN without END) is left where it is and treated as
 * a fresh insert — it is not ours to reason about, and silently deleting to the
 * end of the file would be exactly the corruption AC3(c) forbids. The half-block
 * is reported separately by `detectPublishHookCollisions`.
 */
function injectPublishHookBlock(content, block) {
  const rest = removePublishHookBlock(content);
  // EXACTLY ONE newline, and no cosmetic blank separator. The separator is what
  // breaks the round trip: `removePublishHookBlock` swallows one trailing
  // newline, so a block written with two leaves a stray leading blank line
  // behind on removal and the user's file is no longer byte-identical. AC3(b)
  // and AC3(d) both turn on that byte, so readability loses to symmetry here.
  return block + '\n' + rest;
}

// ═══════════════════════════════════════════════════════════════════════════
// COLLISION DETECTION — shared by the write-side refusal (AC4b) and the
// read-side detection surface (AC12c), so the two can never disagree about
// what a collision is.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Every construct in `content` that, combined with ma-agents' block, makes the
 * file invalid TOML — or makes the block resolve to the wrong key.
 *
 * Measured against `tomllib`, all four are real:
 *   - a second `on_complete` under `workflow`  → "cannot overwrite a value"
 *   - a `[workflow]` header outside the block  → "cannot declare ('workflow',) twice"
 *   - a file that already does not parse       → the whole layer is discarded
 *   - the block below a table heading          → wrong key path, silent no-publish
 *
 * @param {string} content
 * @returns {Array<{kind: string, line: number|null, detail: string}>}
 */
function scanForCollisions(content) {
  const out = [];
  const found = findPublishHookBlock(content);

  if (found && found.end === null) {
    out.push({
      kind: COLLISION_HALF_BLOCK,
      line: lineOfOffset(content, found.begin),
      detail:
        `${PUBLISH_HOOK_MARKER_BEGIN} is present with no matching ${PUBLISH_HOOK_MARKER_END}`,
    });
  }

  // Everything OUTSIDE our region. Blanked rather than deleted so reported line
  // numbers still match the real file.
  const outside = found && found.end !== null
    ? blankRange(content, found.begin, found.end)
    : content;

  const structure = readTomlStructure(outside);
  for (const p of structure.problems) {
    out.push({ kind: COLLISION_UNPARSEABLE, line: p.line, detail: p.message });
  }
  for (const t of structure.tables) {
    if (t.path.length === 1 && t.path[0] === PUBLISH_HOOK_TABLE) {
      out.push({
        kind: COLLISION_DUPLICATE_TABLE,
        line: t.line,
        detail: `a \`[${PUBLISH_HOOK_TABLE}]\` table is declared outside ma-agents' markers`,
      });
    }
  }
  for (const k of structure.keys) {
    // RESOLVED KEY PATH, not "the last segment looks like ours". See
    // PUBLISH_HOOK_KEY_PATH above for what the old predicate cost.
    if (samePath(k.path, PUBLISH_HOOK_KEY_PATH)) {
      out.push({
        kind: COLLISION_DUPLICATE_KEY,
        line: k.line,
        detail: `\`${k.path.join('.')}\` is defined outside ma-agents' markers`,
      });
    }
  }

  // The block's own scope. Only meaningful when the block is intact.
  if (found && found.end !== null && found.begin > 0) {
    const before = readTomlStructure(content.slice(0, found.begin));
    if (before.tables.length > 0) {
      const last = before.tables[before.tables.length - 1];
      out.push({
        kind: COLLISION_BLOCK_NOT_AT_ROOT,
        line: lineOfOffset(content, found.begin),
        detail:
          `ma-agents' block sits under \`[${last.path.join('.')}]\`, so its dotted key resolves to ` +
          `\`${last.path.join('.')}.${PUBLISH_HOOK_KEY}\` and the publish never fires`,
      });
    }
  }

  return out;
}

/** Two resolved key paths, segment by segment. */
function samePath(a, b) {
  return a.length === b.length && a.every((seg, i) => seg === b[i]);
}

/** 1-based line number of a character offset. */
function lineOfOffset(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

/** `text` with `[from, to)` replaced by newline-preserving blanks. */
function blankRange(text, from, to) {
  const middle = text.slice(from, to).replace(/[^\n\r]/g, ' ');
  return text.slice(0, from) + middle + text.slice(to);
}

// ═══════════════════════════════════════════════════════════════════════════
// THE GENERATOR.
// ═══════════════════════════════════════════════════════════════════════════

/** `_bmad/custom/<skill>.toml` for a project. */
function customOverridePath(projectRoot, skillName) {
  return path.join(projectRoot, '_bmad', 'custom', `${skillName}.toml`);
}

/**
 * `_bmad/custom/<skill>.user.toml`.
 *
 * Exported ONLY so the suite can assert it is never touched (AC2). Nothing in
 * this module opens it — the never-touch rule already kept for
 * `config.user.toml` (`bin/cli.js:1006-1008`, `:4854-4856`, P5-9.4) extends here
 * unchanged, and `_bmad/custom/.gitignore` (`*.user.toml`) is the project's own
 * statement that the layer is not shared.
 */
function userOverridePath(projectRoot, skillName) {
  return path.join(projectRoot, '_bmad', 'custom', `${skillName}.user.toml`);
}

/**
 * Generate (or remove) the publish hook for every authoring skill.
 *
 * INSTALL-TIME GATING, NOT RUNTIME GATING (§4.3). The hook exists only for a
 * store whose backend is `confluence` at generation time, and is REMOVED when
 * the backend changes away. Writing it unconditionally and letting
 * `confluence-plan`'s own gateway check decide was rejected: on a `file-system`
 * store that prints a message, and Step B1 is explicit that such a project gets
 * "no message from this section, no prompt, and no offer"
 * (`skills/generate-backlog/SKILL.md:139`).
 *
 * FR262 / AC5(a): every outcome is NAMED. There is no path on which this returns
 * a bare falsy and lets the caller guess.
 *
 * @param {object} opts
 * @param {string} opts.projectRoot
 * @param {object} opts.stores  `{ [storeId]: { backend, cliName, label } }`
 * @returns {{results: Array<{skill,storeId,outcome,file,collisions,error}>, refused: boolean}}
 */
function generatePublishHooks(opts) {
  const projectRoot = opts.projectRoot;
  const stores = opts.stores || {};
  const results = [];

  for (const skill of AUTHORING_SKILLS) {
    const storeId = AUTHORING_SKILL_STORES[skill];
    const store = stores[storeId] || {};
    const file = customOverridePath(projectRoot, skill);
    const wantsHook = store.backend === 'confluence';

    let existing = null;
    if (fs.existsSync(file)) {
      try {
        existing = fs.readFileSync(file, 'utf-8');
      } catch (e) {
        results.push({ skill, storeId, outcome: HOOK_WRITE_FAILED, file, collisions: [], error: e.message });
        continue;
      }
    }

    if (!wantsHook) {
      // AC3(d). The block goes; everything else in the file stays.
      if (existing === null || findPublishHookBlock(existing) === null) {
        results.push({ skill, storeId, outcome: HOOK_NOT_APPLICABLE, file, collisions: [], error: null });
        continue;
      }
      const stripped = removePublishHookBlock(existing);
      if (stripped === existing) {
        // A half-block: nothing removable, and not ours to guess at.
        results.push({
          skill, storeId, outcome: HOOK_NOT_APPLICABLE, file,
          collisions: scanForCollisions(existing), error: null,
        });
        continue;
      }
      try {
        if (stripped.trim() === '') fs.unlinkSync(file);
        else fs.writeFileSync(file, stripped, 'utf-8');
      } catch (e) {
        results.push({ skill, storeId, outcome: HOOK_WRITE_FAILED, file, collisions: [], error: e.message });
        continue;
      }
      results.push({ skill, storeId, outcome: HOOK_REMOVED, file, collisions: [], error: null });
      continue;
    }

    // ── AC4(b) / AC12(b). The refusal is checked over the file AS AN INPUT, so
    // it holds against a state a THIRD writer left behind and not only against
    // one this generator declined to create.
    const collisions = existing === null ? [] : scanForCollisions(existing);
    // Two collision kinds are REPORTED but do not block, because generation
    // HEALS them and refusing would leave the project in the broken state:
    //   - BLOCK_NOT_AT_ROOT — the block is re-anchored at the top of the file;
    //   - HALF_BLOCK — AC3(c): a BEGIN with no END is treated as a fresh insert,
    //     exactly as `injectOnPremPrefixBlock` treats it, rather than as licence
    //     to delete to the end of the file.
    // Anything the half-block leaves behind that is genuinely a collision (a
    // stray `on_complete`, unparseable text) is still caught by its own kind and
    // still blocks, so this is not a hole.
    const blocking = collisions.filter((c) =>
      c.kind !== COLLISION_BLOCK_NOT_AT_ROOT && c.kind !== COLLISION_HALF_BLOCK);
    if (blocking.length > 0) {
      const unparseable = blocking.every((c) => c.kind === COLLISION_UNPARSEABLE);
      results.push({
        skill,
        storeId,
        outcome: unparseable ? HOOK_REFUSED_INVALID_TOML : HOOK_REFUSED_COLLISION,
        file,
        collisions: blocking,
        error: null,
      });
      continue;
    }

    const block = buildPublishHookBlock({
      skillName: skill,
      storeCliName: store.cliName,
      storeLabel: store.label,
    });
    const next = injectPublishHookBlock(existing === null ? '' : existing, block);

    // AC4(a). Prove the RESULT parses before it reaches disk, rather than
    // writing it and hoping. A failure here is a defect in this module, not in
    // the user's file, so it is reported as loudly as a collision.
    const problems = tomlProblems(next);
    if (problems.length > 0) {
      results.push({
        skill,
        storeId,
        outcome: HOOK_REFUSED_INVALID_TOML,
        file,
        collisions: problems.map((p) => ({ kind: COLLISION_UNPARSEABLE, line: p.line, detail: p.message })),
        error: null,
      });
      continue;
    }

    if (existing !== null && next === existing) {
      results.push({ skill, storeId, outcome: HOOK_UNCHANGED, file, collisions: [], error: null });
      continue;
    }

    try {
      // §4.6 R2 — the directory's lifecycle belongs to bmad-method's installer
      // (`tools/installer/core/install-paths.js:24`). Create it if absent rather
      // than assuming an upstream run has already been there.
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, next, 'utf-8');
    } catch (e) {
      results.push({ skill, storeId, outcome: HOOK_WRITE_FAILED, file, collisions: [], error: e.message });
      continue;
    }
    results.push({ skill, storeId, outcome: HOOK_WROTE, file, collisions: [], error: null });
  }

  return {
    results,
    refused: results.some((r) =>
      r.outcome === HOOK_REFUSED_COLLISION ||
      r.outcome === HOOK_REFUSED_INVALID_TOML ||
      r.outcome === HOOK_WRITE_FAILED),
  };
}

/**
 * AC12(c) — THE DETECTION PATH, INDEPENDENT OF THE GENERATOR.
 *
 * The generator's refusal is a WRITE-side guard against a READ-side failure. An
 * agent running `bmad-customize` can produce the read-side failure without ever
 * calling the generator, and the window between that run and the next install is
 * a window in which the publish is dead and nothing says so. This is the only
 * guard that fires inside that window, which is why an implementation with the
 * refusal and the owner comment but WITHOUT this is incomplete.
 *
 * It re-derives nothing: it reports exactly what `scanForCollisions` reports, so
 * "what the installer will refuse over" and "what status warns about" are the
 * same predicate by construction.
 *
 * @param {string} projectRoot
 * @returns {Array<{skill: string, file: string, collisions: Array}>}
 */
function detectPublishHookCollisions(projectRoot) {
  const out = [];
  for (const skill of AUTHORING_SKILLS) {
    const file = customOverridePath(projectRoot, skill);
    if (!fs.existsSync(file)) continue;
    let content;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch (e) {
      out.push({
        skill,
        file,
        collisions: [{ kind: COLLISION_UNPARSEABLE, line: null, detail: `could not be read: ${e.message}` }],
      });
      continue;
    }
    const collisions = scanForCollisions(content);
    if (collisions.length > 0) out.push({ skill, file, collisions });
  }
  return out;
}

/**
 * R10 — the PERSONAL layer's scalar `on_complete`, reported and never touched.
 *
 * READ-ONLY BY CONSTRUCTION. This function opens `<skill>.user.toml` for reading
 * and nothing else; AC2's never-touch rule is about MUTATION, and the suite's
 * fs-interception test measures exactly that. Nothing here writes, creates,
 * renames, truncates or unlinks anything under any circumstances.
 *
 * WHY IT IS SEPARATE FROM `scanForCollisions`. The two must never merge: the
 * collision predicate is the INSTALLER'S REFUSAL predicate, and refusing to
 * install because a user exercised their own layer would be a false rejection
 * that blocks the install — the one failure mode this module names as worse than
 * a false acceptance. Keeping them apart is also what keeps "detection and
 * refusal use the SAME predicate" (AC12c) exactly true rather than nearly true.
 *
 * @param {string} projectRoot
 * @returns {Array<{skill: string, file: string, kind: string, line: number|null, detail: string}>}
 */
function detectUserLayerScalarOverrides(projectRoot) {
  const out = [];
  for (const skill of AUTHORING_SKILLS) {
    const file = userOverridePath(projectRoot, skill);
    if (!fs.existsSync(file)) continue;
    let content;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch (_) {
      // Unreadable is not this detector's business: the resolver treats a layer
      // it cannot read as absent, which leaves the publish intact. Silence here
      // is the correct report, not a swallowed failure.
      continue;
    }
    const structure = readTomlStructure(content);
    if (structure.problems.length > 0) continue; // a layer that does not parse is discarded, not overriding
    for (const k of structure.keys) {
      if (!samePath(k.path, PUBLISH_HOOK_KEY_PATH)) continue;
      // ARRAY vs anything else — the only distinction `deep_merge` makes.
      if (/^\[/.test(String(k.value).trim())) continue;
      out.push({
        skill,
        file,
        kind: USER_LAYER_SCALAR_OVERRIDE,
        line: k.line,
        detail:
          `\`${PUBLISH_HOOK_KEY}\` is set to a NON-ARRAY value here, which REPLACES ma-agents' ` +
          `publish instruction outright instead of appending to it`,
      });
    }
  }
  return out;
}

module.exports = {
  AUTHORING_SKILL_STORES,
  AUTHORING_SKILLS,
  PUBLISH_HOOK_MARKER_BEGIN,
  PUBLISH_HOOK_MARKER_END,
  PUBLISH_HOOK_KEY,
  PUBLISH_HOOK_KEY_PATH,
  PUBLISH_HOOK_TABLE,
  HOOK_WROTE, HOOK_UNCHANGED, HOOK_REMOVED, HOOK_NOT_APPLICABLE,
  HOOK_REFUSED_COLLISION, HOOK_REFUSED_INVALID_TOML, HOOK_WRITE_FAILED,
  HOOK_NO_PUBLISH_OUTCOMES,
  COLLISION_DUPLICATE_KEY, COLLISION_DUPLICATE_TABLE, COLLISION_UNPARSEABLE,
  COLLISION_BLOCK_NOT_AT_ROOT, COLLISION_HALF_BLOCK,
  USER_LAYER_SCALAR_OVERRIDE,
  publishHookInstruction,
  buildPublishHookBlock,
  findPublishHookBlock,
  injectPublishHookBlock,
  removePublishHookBlock,
  scanForCollisions,
  tomlProblems,
  readTomlStructure,
  customOverridePath,
  userOverridePath,
  generatePublishHooks,
  detectPublishHookCollisions,
  detectUserLayerScalarOverrides,
};
