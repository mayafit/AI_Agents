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
 * FIX ROUND 2 (B1). `workflow` given a VALUE at root scope — `workflow = 1`,
 * `workflow = "off"`, `workflow = { prd_template = "…" }`.
 *
 * The predicate compared key paths for EQUALITY only, so a team-layer override
 * that spells `workflow` as a value rather than as a table was not seen to
 * collide with `workflow.on_complete` at all. Measured on the shipped code:
 * `scanForCollisions` returned `[]`, the AC4(a) post-write guard returned `[]`,
 * the generator reported five `wrote` outcomes and exit 0, `status` said nothing
 * — and real `tomllib` answered the file ma-agents had just written with
 * "Cannot overwrite a value", so `resolve_customization.py` warned to stderr,
 * returned `{}` and exited 0. AC12(a)'s end state verbatim, created by
 * ma-agents' own write, with every surface this story built to catch it silent.
 */
const COLLISION_TABLE_IS_VALUE = 'workflow-assigned-a-value';
/**
 * FIX ROUND 2 (B1, the other direction). Something declared UNDER
 * `workflow.on_complete`, which ma-agents defines as an array VALUE:
 * `workflow.on_complete.x = 1`, `[workflow.on_complete]`,
 * `[[workflow.on_complete]]`, `[workflow.on_complete.deep]`. `tomllib` answers
 * these with "Cannot mutate immutable namespace" or "Cannot declare … twice";
 * the equality-only predicate accepted every one of them too.
 */
const COLLISION_KEY_USED_AS_TABLE = 'on_complete-used-as-a-table';
/**
 * FIX ROUND 4 (R1, part 2). More than one `# BEGIN:ma-agents-confluence-publish`
 * COMMENT LINE in the file.
 *
 * `findPublishHookBlock` used to take the first one unconditionally and never
 * report that another existed, so a stray marker line above the user's settings
 * — a copy-paste, a merge conflict resolved by keeping both sides, a second
 * install into a file someone had hand-edited — made the span from that stray
 * marker to the genuine END "ma-agents' region", and `injectPublishHookBlock`
 * DELETED it. Measured: outcome `wrote`, `scanForCollisions` `[]`, `status`
 * silent, the file still parses, the team's settings gone.
 *
 * This is a BLOCKING kind on purpose. The two non-blocking kinds
 * (`BLOCK_NOT_AT_ROOT`, `HALF_BLOCK`) are non-blocking because generation HEALS
 * them; this one cannot be healed without deciding which marker was ours, and
 * that decision is the data loss.
 */
const COLLISION_AMBIGUOUS_MARKERS = 'more-than-one-begin-marker';

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
  /** Report an illegal escape and stop; `true` when one was found. */
  const escaped = (body, atLineEnd, i) => {
    const problem = basicStringEscapeProblem(body, atLineEnd);
    if (problem === null) return false;
    problems.push({ line: i + 1, message: problem });
    return true;
  };

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
        if (close === -1) {
          // FIX ROUND 4 (R2). This segment runs to the end of the physical line,
          // so a trailing `\` here is the LINE-ENDING BACKSLASH a multi-line
          // basic string is allowed (measured: `tomllib` accepts it, with or
          // without trailing whitespace after it).
          if (multi === '"""' && escaped(raw.slice(j), true, i)) return { statements, problems };
          out += raw.slice(j); j = raw.length; break;
        }
        if (multi === '"""' && escaped(raw.slice(j, close), false, i)) return { statements, problems };
        out += raw.slice(j, close + multi.length);
        j = close + multi.length;
        multi = null;
        continue;
      }
      const ch = raw[j];
      if (ch === '#') { j = raw.length; break; }               // comment to EOL
      // FIX ROUND 2. A byte-order mark in BARE position is not valid TOML —
      // `tomllib` answers a bare U+FEFF anywhere outside a string or a comment with
      // "Invalid statement", and that includes a BOM at offset 0. It matters
      // here because `injectPublishHookBlock` prepends ma-agents' region, so a
      // team file a Windows editor or a PowerShell `Out-File` wrote with a BOM
      // has that BOM MOVED into the middle of the file — and the whole team
      // layer is then discarded by the resolver at exit 0, which is AC12(a)'s
      // end state again. Measured, not reasoned about: a BOM inside a basic or
      // literal string, inside a quoted key, or inside a comment is ACCEPTED by
      // `tomllib`, so this fires only where `tomllib` fires.
      if (ch.charCodeAt(0) === 0xFEFF) {
        problems.push({
          line: i + 1,
          message: 'a byte-order mark (U+FEFF) outside a string or comment is not valid TOML',
        });
        return { statements, problems };
      }
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
        // FIX ROUND 4 (R2). A single-line basic string has no line-ending
        // backslash, so every `\` in it must open a real escape. This is also
        // where a QUOTED KEY is validated, because a quoted key IS a basic
        // string and the scanner walks it on the same pass.
        if (ch === '"' && escaped(raw.slice(j + 1, k), false, i)) return { statements, problems };
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

/**
 * The escapes a TOML 1.0.0 BASIC string may contain, as a closed set. Measured
 * against `tomllib`, not read off a blog post: `\e` and `\xHH` (TOML 1.1 drafts)
 * and `\0` and `\/` (habits from C and JSON) are all REJECTED by it.
 */
const BASIC_ESCAPE_CHARS = 'btnfr"\\';

/**
 * The first illegal escape in the BODY of a basic string, or `null`.
 *
 * FIX ROUND 4 (R2) — ESCAPE SEQUENCES WERE NEVER VALIDATED AT ALL, and the
 * shape that walks into it is the one a careful user writes:
 *
 *   prd_template = "C:\team\templates\prd.md"
 *
 * A Windows path in a BASIC string with single backslashes. Round 3's corpus has
 * the UNQUOTED Windows path and stops there, so this — the half written by
 * someone who DID remember the quotes — went straight through. Measured end to
 * end against the real `resolve_customization.py`, beside a literal-string
 * control (`'C:\team\prd.md'`) that behaves correctly throughout:
 *
 *                  control        attack
 *   generator      wrote          wrote        (refused=false both)
 *   status         []             []
 *   resolver exit  0              0            (a stderr warning only)
 *   on_complete    array, len 1   ""           — NO PUBLISH
 *   prd_template   correct        undefined    — the whole team layer, gone
 *
 * The check is a CLOSED SET and therefore carries no false-refusal exposure: a
 * backslash must be followed by one of `btnfr"\`, or `u` and four hex digits, or
 * `U` and eight. The one addition is the LINE-ENDING BACKSLASH, which is legal
 * only inside a multi-line basic string and only when nothing but whitespace
 * follows it on the line — `atLineEnd` is true exactly there.
 *
 * LITERAL strings (`'…'`, `'''…'''`) are deliberately not touched: they have no
 * escapes at all, so every backslash in one is a backslash, and validating them
 * would be the false refusal this module names as the worse direction.
 *
 * @param {string} body the string's contents, delimiters excluded
 * @param {boolean} atLineEnd the body runs to the end of a physical line inside
 *   a multi-line basic string
 * @returns {string|null}
 */
function basicStringEscapeProblem(body, atLineEnd) {
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '\\') continue;
    const c = body[i + 1];
    if (c !== undefined && BASIC_ESCAPE_CHARS.includes(c)) { i++; continue; }
    if (c === 'u' || c === 'U') {
      const n = c === 'u' ? 4 : 8;
      const hex = body.slice(i + 2, i + 2 + n);
      if (hex.length === n && /^[0-9a-fA-F]+$/.test(hex)) { i += 1 + n; continue; }
      return `\`\\${c}\` must be followed by ${n} hexadecimal digits, and here it is followed by ` +
        `${JSON.stringify(hex)}`;
    }
    if (atLineEnd && /^[ \t]*$/.test(body.slice(i + 1))) return null;
    return `\`\\${c === undefined ? '' : c}\` is not a TOML escape sequence — inside a "…" string a ` +
      `backslash may only begin \\b \\t \\n \\f \\r \\" \\\\ \\uXXXX or \\UXXXXXXXX. A Windows ` +
      `path needs '…' (literal) quotes or doubled backslashes: "C:\\\\team\\\\prd.md"`;
  }
  return null;
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

/**
 * Split a dotted key into its parts, honouring quoted segments.
 *
 * FIX ROUND 3. An EMPTY QUOTED segment is a real key. `"" = 1` and `[""]` are
 * both legal TOML — measured against `tomllib`, not reasoned about — and the old
 * blanket `.filter(p => p !== '')` erased them, so the path came back empty and
 * `readTomlStructure` reported "empty key" / "empty table header". That is a
 * FALSE REFUSAL, and a false refusal writes no hook for ANY of the five skills
 * and takes the install non-zero on a project whose file is perfectly valid —
 * the direction this module names as the worse one (`:221-223`).
 *
 * An empty BARE segment (`a..b`, a leading or trailing dot) is still dropped
 * here; it is a real malformation and is reported by `bareKeyProblem` instead,
 * where it can be named.
 *
 * @param {string} key raw key text, quotes included
 * @returns {string[]} the resolved segments, quotes stripped
 */
function splitDottedKey(key) {
  const parts = [];
  let cur = '';
  let quoted = false;
  let inStr = null;
  for (let i = 0; i < key.length; i++) {
    const c = key[i];
    if (inStr) {
      if (inStr === '"' && c === '\\') { cur += key[i + 1] || ''; i++; continue; }
      if (c === inStr) { inStr = null; continue; }
      cur += c;
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; quoted = true; continue; }
    if (c === '.') { parts.push({ text: cur.trim(), quoted }); cur = ''; quoted = false; continue; }
    cur += c;
  }
  parts.push({ text: cur.trim(), quoted });
  return parts.filter((p) => p.quoted || p.text !== '').map((p) => p.text);
}

// ───────────────────────────────────────────────────────────────────────────
// FIX ROUND 3 (BLOCKING-1, step 2) — THE READER VALIDATED KEY *STRUCTURE* AND
// NEVER LOOKED AT A RIGHT-HAND SIDE AT ALL.
//
// Measured on the shipped code, end to end through `generatePublishHooks`,
// `detectPublishHookCollisions` and the real `_bmad/scripts/resolve_customization.py`:
// twenty-one of twenty-two ordinary malformations produced `wrote`, a SILENT
// `status`, resolver exit 0 — and a dead publish, because `tomllib` rejected the
// file ma-agents had just written and the resolver discards a non-required layer
// it cannot parse. Four of the twenty-one are mistakes a person makes in an
// afternoon:
//
//   prd_template = “assets/house-prd.md”     curly quotes, pasted from Confluence
//   prd_template = C:\team\templates\prd.md  an unquoted Windows path
//   tone = house-style                       forgot the quotes
//   prd template = "…"                       a space in a key
//
// Two checks close them, and both are written to be CONSERVATIVE ABOUT
// REFUSING, because a false refusal blocks the install for all five skills:
//
//   (1) BARE KEYS have a closed charset — `A-Za-z0-9_-` — and segments are
//       separated by exactly one dot. Quoted segments are skipped entirely, so
//       `"a b"`, `'a b'`, `""` and `a."b c"` stay legal.
//   (2) A VALUE's FIRST TOKEN is checked against the closed set of things a TOML
//       value can begin with, and nothing beyond it. TOML has exactly ten value
//       types and their initial characters are `" ' [ {`, a sign, a digit, or one
//       of the four bare words `true`/`false`/`inf`/`nan`. A first character
//       outside that set cannot begin any TOML value at all, whatever follows.
//       The check deliberately says NOTHING about the rest of the value: `a = 1x`
//       is still accepted here, because deciding it would mean writing the number
//       and date grammars and every one of those is a chance to refuse a valid
//       file.
//
// Both directions are measured in
// `test/project-layout-confluence-publish-hook.test.js` §5 against real
// `tomllib`, over the malformation corpus AND over every shipped upstream
// `customize.toml`.
// ───────────────────────────────────────────────────────────────────────────

/** A bare key segment is exactly this, per the TOML grammar. */
const BARE_KEY = /^[A-Za-z0-9_-]+$/;

/**
 * The first offending thing in a raw dotted-key text, or `null` when the key is
 * structurally well formed.
 *
 * @param {string} raw key text as it appears in the file, quotes included
 * @returns {string|null} a human-readable description of the problem
 */
function bareKeyProblem(raw) {
  const n = raw.length;
  let i = 0;
  let expectSeparator = false;
  let sawSegment = false;

  while (i < n) {
    while (i < n && (raw[i] === ' ' || raw[i] === '\t')) i++;
    if (i >= n) break;

    if (expectSeparator) {
      if (raw[i] !== '.') {
        return `${JSON.stringify(raw.slice(i).trim())} follows a key with no \`.\` between them ` +
          `(a bare key may not contain a space; quote it if the space is wanted)`;
      }
      i++;
      expectSeparator = false;
      continue;
    }

    const c = raw[i];
    if (c === '"' || c === "'") {
      let k = i + 1;
      let closed = false;
      while (k < n) {
        if (c === '"' && raw[k] === '\\') { k += 2; continue; }
        if (raw[k] === c) { closed = true; break; }
        k++;
      }
      // An unterminated string is `tomlStatements`' report, not this one.
      if (!closed) return null;
      i = k + 1;
    } else {
      let k = i;
      while (k < n && raw[k] !== '.' && raw[k] !== ' ' && raw[k] !== '\t') k++;
      const seg = raw.slice(i, k);
      if (seg === '') {
        return 'an empty key segment (a `.` with no key beside it)';
      }
      if (!BARE_KEY.test(seg)) {
        return `${JSON.stringify(seg)} is not a valid bare key — a bare key may hold only ` +
          `letters, digits, \`_\` and \`-\`; anything else must be quoted`;
      }
      i = k;
    }
    sawSegment = true;
    expectSeparator = true;
  }

  if (!sawSegment) return 'an empty key';
  if (!expectSeparator) return 'a dotted key that ends with a `.`';
  return null;
}

/**
 * The offending first token of a right-hand side, or `null` when the value
 * begins the way some TOML value can begin.
 *
 * @param {string} rhs raw value text, already comment-stripped and trimmed
 * @returns {string|null}
 */
function valueStartProblem(rhs) {
  const s = String(rhs).trim();
  if (s === '') return null;                      // reported separately as "has no value"
  const c = s[0];
  if (c === '"' || c === "'" || c === '[' || c === '{') return null;   // string, array, inline table
  if (c === '+' || c === '-' || (c >= '0' && c <= '9')) return null;   // number, date, time, ±inf/nan
  if (/^(true|false|inf|nan)$/.test(s)) return null;                   // the four bare-word values
  const token = s.split(/\s/)[0];
  return `${JSON.stringify(token.slice(0, 40))} cannot begin a TOML value — a value is a quoted ` +
    `string, a number, a date, \`true\`/\`false\`, an array or an inline table`;
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

  // FIX ROUND 3. A path is serialised UNAMBIGUOUSLY, not joined with a space.
  // A quoted key may contain any character, so `parts.join(' ')` made
  // `"a b" = 1` and `a.b = 2` — two entirely different key paths that `tomllib`
  // is perfectly happy to hold in one file — collide as "cannot define a.b
  // twice", which is a FALSE REFUSAL: no hook for any of the five skills, and a
  // non-zero exit on a healthy project. Found by the corpus added for the empty-
  // quoted-key fix, which is the same family of defect.
  const pathKey = (parts) => JSON.stringify(parts);

  /** Qualify a path with the array-of-tables element it currently belongs to. */
  const nsKey = (parts) => {
    for (let n = parts.length; n >= 1; n--) {
      const p = pathKey(parts.slice(0, n));
      if (arrayTableCount.has(p)) return `${p}#${arrayTableCount.get(p)}|${pathKey(parts)}`;
    }
    return pathKey(parts);
  };

  for (const st of statements) {
    const first = st.text.split('\n')[0].trim();

    const arrayTable = /^\[\[(.+?)\]\]\s*$/.exec(first);
    const table = arrayTable ? null : /^\[(.+?)\]\s*$/.exec(first);

    if (arrayTable || table) {
      const raw = (arrayTable || table)[1];
      const headerProblem = bareKeyProblem(raw);
      if (headerProblem !== null) {
        problems.push({ line: st.line, message: `table header [${raw}]: ${headerProblem}` });
        continue;
      }
      const parts = splitDottedKey(raw);
      if (parts.length === 0) {
        problems.push({ line: st.line, message: 'empty table header' });
        continue;
      }
      if (arrayTable) {
        const p = pathKey(parts);
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
    // FIX ROUND 3 (BLOCKING-1 step 2). The key's CHARSET and the value's opening
    // token, neither of which the reader used to look at.
    const keyProblem = bareKeyProblem(lhs);
    if (keyProblem !== null) {
      problems.push({ line: st.line, message: `key ${JSON.stringify(lhs)}: ${keyProblem}` });
      continue;
    }
    const valueProblem = valueStartProblem(rhs);
    if (valueProblem !== null) {
      problems.push({
        line: st.line,
        message: `the value assigned to ${JSON.stringify(lhs)}: ${valueProblem}`,
      });
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

/**
 * The value a statement assigns at `target`, or `null` when it assigns nothing
 * there.
 *
 * FIX ROUND 2 (B2). `readTomlStructure` records `workflow = { on_complete = "x" }`
 * as ONE key at path `['workflow']` whose value is the raw inline-table text; it
 * does not descend. That is fine for the collision predicate — a root
 * `workflow = …` collides whatever is inside it — but it is not fine for R10,
 * which has to know whether the PERSONAL layer put an ARRAY or a SCALAR at
 * `workflow.on_complete`, because that is the only distinction upstream's
 * `deep_merge` makes.
 *
 * Descent is deliberately limited to INLINE TABLES (`{ … }`), which is the only
 * construct that can hide a deeper key path inside a single statement's value.
 *
 * @param {{path: string[], value: string}} k
 * @param {string[]} target
 * @returns {string|null} the RAW value text at `target`
 */
function valueAtKeyPath(k, target) {
  if (k.path.length > target.length) return null;
  for (let i = 0; i < k.path.length; i++) if (k.path[i] !== target[i]) return null;
  let value = k.value;
  for (let i = k.path.length; i < target.length; i++) {
    const entries = inlineTableEntries(value);
    if (entries === null) return null;
    const hit = entries.find((e) => e.key === target[i]);
    if (!hit) return null;
    value = hit.value;
  }
  return value;
}

/**
 * The top-level `key = value` pairs of an inline-table literal, or `null` when
 * `raw` is not an inline table. Quoted keys are unquoted through
 * `splitDottedKey`, so `{ "on_complete" = "x" }` and `{ on_complete = "x" }`
 * are the same entry; a DOTTED key inside the table (`{ a.b = 1 }`) keeps only
 * its first segment as this function's key, which is enough for the one path
 * this module walks.
 *
 * @param {string} raw
 * @returns {Array<{key: string, value: string}>|null}
 */
function inlineTableEntries(raw) {
  const s = String(raw).trim();
  if (!s.startsWith('{') || !s.endsWith('}')) return null;
  const body = s.slice(1, -1);
  const parts = [];
  let cur = '';
  let depth = 0;
  let inStr = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (inStr === '"' && c === '\\') { cur += c + (body[i + 1] || ''); i++; continue; }
      if (c === inStr) inStr = null;
      cur += c;
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; cur += c; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);

  const out = [];
  for (const part of parts) {
    if (part.trim() === '') continue;
    const eq = indexOfTopLevelEquals(part);
    if (eq === -1) continue;
    const segments = splitDottedKey(part.slice(0, eq).trim());
    if (segments.length === 0) continue;
    out.push({ key: segments[0], value: part.slice(eq + 1).trim() });
  }
  return out;
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
    '# nothing reports it. `ma-agents status` names the collisions it can detect,',
    '# and the next install or bind refuses to regenerate over those. That check is',
    '# a partial scanner, not a full TOML parser: it can miss a malformation here',
    '# and stay silent. This warning is the guarantee; the check is not.',
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
 * Offsets at which `marker` begins a GENUINE TOML COMMENT LINE.
 *
 * FIX ROUND 3 (the data-loss finding). `findPublishHookBlock` used to be a raw
 * `indexOf` with no line-start, string or comment awareness, and
 * `injectPublishHookBlock` DELETES the span between what it finds. So a user
 * comment that merely NAMES both markers:
 *
 *   # house policy: never edit between # BEGIN:… and # END:…
 *   prd_template = "assets/house.md"
 *
 * was mistaken for ma-agents' own region, and the team's only setting was
 * swallowed into the middle of that comment. `scanForCollisions` then returned
 * `[]`, the outcome was `wrote`, the file still parsed and `status` said nothing
 * — silent destruction of user content, under a block whose own shipped text
 * promises "Anything OUTSIDE them is yours and is kept exactly as you left it".
 *
 * FIX ROUND 4 (R1, part 1) — "BEGINS a line" IS NOT "IS the line", and the gap
 * between the two is the same data loss one spelling over. Round 3 anchored the
 * marker with `line.startsWith(marker, k)` and justified it with "a marker at
 * the start of a line IS a genuine comment line by TOML's own rules". True, and
 * INSUFFICIENT: a comment line that starts with the marker AND CONTINUES is also
 * a genuine comment line, and it is not ma-agents' region.
 *
 *   # BEGIN:ma-agents-confluence-publish — our house note about this region
 *   prd_template = "assets/house-prd.md"
 *
 *   <the genuine ma-agents block>
 *
 * Measured end to end on the round-3 code: `findPublishHookBlock` answered
 * `{begin: 0, end: 2298}`, `scanForCollisions` returned `[]`, the outcome was
 * `wrote`, `status` was silent, the resulting file PARSED CLEANLY — and
 * `prd_template` was gone. Identical mechanism, identical end state, and it
 * falsifies the same promise the emitted block makes at `:893`.
 *
 * So the test is EQUALITY, not prefix: a marker counts only when the line, with
 * surrounding whitespace removed, IS the marker and nothing else, and that line
 * is not inside a multi-line string. Leading whitespace is allowed because TOML
 * permits it before a comment; trailing whitespace is allowed because an editor
 * may add or strip it without the user meaning anything by it.
 *
 * FIX ROUND 5 (B1) — READ THE RETURN VALUE CAREFULLY. What comes back is NOT
 * "the offset of the marker text". It is the offset at which the marker's LINE
 * stops being ASCII indentation, which is the same thing only when every
 * whitespace character on the line is a space or a tab. `trim()` strips the FULL
 * Unicode WhiteSpace set, so `<U+00A0># BEGIN:…` is recognised here with `k === 0`
 * and the returned offset points at the NBSP, one character BEFORE the marker.
 *
 * That asymmetry is deliberate and it is the safe direction: whatever leading
 * whitespace `trim()` forgave is INSIDE the returned span, so it leaves with the
 * block. Only space and tab can ever be left behind on the leading side, and
 * both are legal TOML on a line of their own.
 *
 * The TRAILING side had no such guarantee until round 5 — see
 * `endOfMarkerLine`, which is now the only thing allowed to close the span.
 *
 * @param {string} content
 * @param {string} marker
 * @returns {number[]} offsets at or before the marker text, in document order
 */
function markerCommentOffsets(content, marker) {
  const out = [];
  const lines = content.split('\n');
  let offset = 0;
  let multi = null;                 // '"""' or "'''" when inside a multi-line string

  for (const rawLine of lines) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

    if (multi === null) {
      let k = 0;
      while (k < line.length && (line[k] === ' ' || line[k] === '\t')) k++;
      if (line.trim() === marker) out.push(offset + k);
    }

    // Carry the string state across the line, so a marker quoted inside a
    // multi-line value is not mistaken for our region.
    let j = 0;
    while (j < line.length) {
      if (multi) {
        const close = line.indexOf(multi, j);
        if (close === -1) { j = line.length; break; }
        j = close + multi.length;
        multi = null;
        continue;
      }
      const ch = line[j];
      if (ch === '#') break;                                   // comment to end of line
      if (ch === '"' || ch === "'") {
        if (line.startsWith(ch.repeat(3), j)) { multi = ch.repeat(3); j += 3; continue; }
        let k = j + 1;
        let closed = false;
        while (k < line.length) {
          if (ch === '"' && line[k] === '\\') { k += 2; continue; }
          if (line[k] === ch) { closed = true; break; }
          k++;
        }
        if (!closed) break;
        j = k + 1;
        continue;
      }
      j++;
    }

    offset += rawLine.length + 1;   // the '\n' the split consumed
  }
  return out;
}

/**
 * The offset one past the LAST character of the line that `markerStart` sits on
 * — the newline itself, or the end of the document.
 *
 * FIX ROUND 5 (B1) — THIS EXISTS BECAUSE `+ marker.length` WAS A LIE. The old
 * arithmetic closed the region at `end + PUBLISH_HOOK_MARKER_END.length`, which
 * assumes two things that `markerCommentOffsets` never promised: that the offset
 * it handed back is the marker's first character, and that the marker is the
 * line's last character. Neither holds. `line.trim() === marker` accepts the
 * whole Unicode WhiteSpace set on BOTH sides, so
 *
 *   # END:ma-agents-confluence-publish
 *
 * is recognised as ma-agents' own END marker — and the region then stopped
 * BEFORE the NBSP that `trim()` had just forgiven. `removePublishHookBlock` saw
 * `content[end]` was not `\n`, swallowed no newline, and spliced, leaving A LINE
 * CONTAINING ONLY U+00A0. That line parses in a comment and does NOT parse as a
 * statement: `tomllib` answers `Invalid statement (at line 1, column 1)`, the
 * resolver discards the entire team layer at exit 0 with a warning, and the
 * publish is dead. Measured on the write path AND the removal path, against the
 * real `resolve_customization.py`, for U+00A0, U+2007 and U+3000:
 *
 *                     input   generator      status   after      on_complete
 *   trailing SPACE    OK      wrote/removed  []       OK         array / gone-as-asked
 *   trailing TAB      OK      wrote/removed  []       OK         array / gone-as-asked
 *   trailing U+00A0   OK      wrote/removed  []       INVALID    "" — layer dead
 *
 * The write path's own proof-before-disk (`tomlProblems(next)` in
 * `generatePublishHooks`) did not catch it either, because a bare NBSP line is a
 * FALSE ACCEPT in the bundled reader — `buf.trim()` reduces it to the empty
 * string and it is dropped as a blank line. U+FEFF is the one member of the
 * family that reader does catch, which is why the round-2 BOM work closed one
 * spelling of this and left the rest.
 *
 * The fix is here rather than in the reader on purpose. A reader rule would only
 * cover the WRITE path — the removal path (`ma-agents install` after a store
 * stops being Confluence) writes `stripped` with no validation at all, measured
 * — and it would answer a file ma-agents itself just mangled with a REFUSAL
 * rather than with the correct bytes. Closing the span at the end of the line
 * makes both paths round-trip exactly instead, and it needs no new rejection, so
 * it carries no false-refusal exposure.
 *
 * Only the trailing side needed this. The leading side is already safe by the
 * asymmetry documented on `markerCommentOffsets`, which is also why the region's
 * start is NOT moved to `line.indexOf(marker)`: that would push the span PAST
 * any leading NBSP and strand it on a line of its own — the same defect, mirrored.
 *
 * Safe by construction: the line was accepted only because `line.trim()` IS the
 * marker, so everything between the marker and the newline is whitespace.
 *
 * @param {string} content
 * @param {number} markerStart an offset on the marker's line
 * @returns {number} offset of that line's `\n`, or `content.length`
 */
function endOfMarkerLine(content, markerStart) {
  const nl = content.indexOf('\n', markerStart);
  return nl === -1 ? content.length : nl;
}

/**
 * Locate the marker block. Returns `null` when there is no BEGIN marker, and
 * `{begin, end: null}` for a malformed half-block (BEGIN without END) — the
 * caller decides, exactly as `injectOnPremPrefixBlock` does.
 *
 * FIX ROUND 4 (R1, part 2) — MORE THAN ONE BEGIN IS NOT A REGION, IT IS AN
 * AMBIGUITY, AND PICKING ONE DESTROYS WHATEVER LIES BETWEEN THEM. This used to
 * take `begins[0]` unconditionally and never report that a second BEGIN existed,
 * so an exact orphan marker line above user content, with the genuine block
 * below it, spanned `{begin: 0, end: <the genuine END>}` — and
 * `injectPublishHookBlock` deleted the user's settings out of the middle. Same
 * silent `wrote`, same clean parse, same lost content as the prefix case.
 *
 * Ambiguity is answered by REFUSING TO NAME A REGION AT ALL — `end` stays
 * `null`, so `removePublishHookBlock` is a byte-for-byte no-op and the removal
 * path (`ma-agents install` after the store stops being Confluence) cannot
 * destroy anything either — and by a collision kind of its own,
 * `COLLISION_AMBIGUOUS_MARKERS`, which BLOCKS the write and is named on `status`.
 * Guessing which of two identical markers was ours is not a decision this module
 * is entitled to make on a user's file.
 *
 * @returns {{begin:number, end:number|null, ambiguous:boolean, begins:number[],
 *            candidateEnd:number|null}|null}
 */
function findPublishHookBlock(content) {
  const begins = markerCommentOffsets(content, PUBLISH_HOOK_MARKER_BEGIN);
  if (begins.length === 0) return null;
  const ends = markerCommentOffsets(content, PUBLISH_HOOK_MARKER_END);

  if (begins.length > 1) {
    // The widest span any of the candidate regions could cover. Used ONLY to
    // keep the collision report about the ambiguity itself rather than about
    // whatever ma-agents' own block contributes to the scan; nothing is written
    // or deleted on this path.
    const trailing = ends.filter((o) => o >= begins[0]);
    const last = trailing.length === 0 ? null : trailing[trailing.length - 1];
    return {
      begin: begins[0],
      end: null,
      ambiguous: true,
      begins,
      candidateEnd: last === null ? null : endOfMarkerLine(content, last),
    };
  }

  const begin = begins[0];
  const end = ends.find((o) => o >= begin);
  if (end === undefined) return { begin, end: null, ambiguous: false, begins, candidateEnd: null };
  // FIX ROUND 5 (B1). END OF LINE, not `+ marker.length` — see `endOfMarkerLine`.
  const stop = endOfMarkerLine(content, end);
  return { begin, end: stop, ambiguous: false, begins, candidateEnd: stop };
}

/**
 * Content with the marker block excised, swallowing one trailing newline.
 *
 * FIX ROUND 5 (B1). `found.end` is now the END marker's LINE ending, so a CRLF
 * file's `\r` is already INSIDE the span and only the `\n` is left to swallow.
 * The `\r\n` arm is kept as a guard, not as live arithmetic: it fires only if
 * `endOfMarkerLine` is ever changed to stop short of the newline again, and it
 * fails loudly-by-symmetry rather than silently leaving a bare `\r` behind.
 */
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

  if (found && found.ambiguous) {
    // FIX ROUND 4 (R1, part 2). Reported INSTEAD of the half-block kind: with
    // two BEGIN markers "the BEGIN has no END" is not what is wrong, and the
    // half-block kind does not block.
    out.push({
      kind: COLLISION_AMBIGUOUS_MARKERS,
      line: lineOfOffset(content, found.begins[1]),
      detail:
        `${found.begins.length} \`${PUBLISH_HOOK_MARKER_BEGIN}\` comment lines are present (also at ` +
        `line ${lineOfOffset(content, found.begins[0])}), so which region is ma-agents' cannot be ` +
        `decided — and everything between the wrong pair would be DELETED by the next write`,
    });
  } else if (found && found.end === null) {
    out.push({
      kind: COLLISION_HALF_BLOCK,
      line: lineOfOffset(content, found.begin),
      detail:
        `${PUBLISH_HOOK_MARKER_BEGIN} is present with no matching ${PUBLISH_HOOK_MARKER_END}`,
    });
  }

  // Everything OUTSIDE our region. Blanked rather than deleted so reported line
  // numbers still match the real file.
  //
  // When the markers are AMBIGUOUS there is no "our region", so the widest span
  // the candidates could cover is blanked instead. Nothing is written on that
  // path — the kind above blocks it — and blanking keeps the report about the
  // ambiguity rather than about ma-agents' own `workflow.on_complete` being
  // read as a competing definition, which would be a true statement about the
  // wrong thing.
  const outside = found && found.end !== null
    ? blankRange(content, found.begin, found.end)
    : found && found.ambiguous && found.candidateEnd !== null
      ? blankRange(content, found.begin, found.candidateEnd)
      : content;

  const structure = readTomlStructure(outside);
  for (const p of structure.problems) {
    out.push({ kind: COLLISION_UNPARSEABLE, line: p.line, detail: p.message });
  }
  for (const t of structure.tables) {
    // A table HEADER at `workflow` re-declares the table our dotted key creates.
    // A table header AT or UNDER `workflow.on_complete` tries to make a table out
    // of the array our block assigns there. Both are `tomllib` errors; a header
    // ELSEWHERE under `workflow` (`[workflow.sub]`, `[[workflow.sub]]`) is valid
    // TOML and must not be refused.
    const rel = keyPathRelation(t.path);
    if (rel === PATH_REL_PREFIX) {
      out.push({
        kind: COLLISION_DUPLICATE_TABLE,
        line: t.line,
        detail: `a \`[${PUBLISH_HOOK_TABLE}]\` table is declared outside ma-agents' markers`,
      });
    } else if (rel === PATH_REL_SAME || rel === PATH_REL_UNDER) {
      out.push({
        kind: COLLISION_KEY_USED_AS_TABLE,
        line: t.line,
        detail:
          `\`[${t.path.join('.')}]\` declares a table at or under \`${PUBLISH_HOOK_KEY}\`, which ` +
          `ma-agents defines as an ARRAY of instructions`,
      });
    }
  }
  for (const k of structure.keys) {
    // RESOLVED KEY PATH, not "the last segment looks like ours". See
    // PUBLISH_HOOK_KEY_PATH above for what the old predicate cost.
    //
    // FIX ROUND 2 (B1): EQUALITY is not the whole relation. `workflow = …` is a
    // STRICT PREFIX of our key path — a value where our block needs a table —
    // and `workflow.on_complete.x = …` extends it — a table where our block put
    // a value. `tomllib` rejects both, and the equality-only predicate saw
    // neither.
    const rel = keyPathRelation(k.path);
    if (rel === PATH_REL_SAME) {
      out.push({
        kind: COLLISION_DUPLICATE_KEY,
        line: k.line,
        detail: `\`${k.path.join('.')}\` is defined outside ma-agents' markers`,
      });
    } else if (rel === PATH_REL_PREFIX) {
      out.push({
        kind: COLLISION_TABLE_IS_VALUE,
        line: k.line,
        detail:
          `\`${k.path.join('.')}\` is assigned a VALUE at root scope outside ma-agents' markers, ` +
          `so \`${PUBLISH_HOOK_KEY}\` has no table to live in`,
      });
    } else if (rel === PATH_REL_UNDER) {
      out.push({
        kind: COLLISION_KEY_USED_AS_TABLE,
        line: k.line,
        detail:
          `\`${k.path.join('.')}\` nests a key under \`${PUBLISH_HOOK_KEY}\`, which ma-agents ` +
          `defines as an ARRAY of instructions`,
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

/** `p` IS `workflow.on_complete`. */
const PATH_REL_SAME = 'same';
/** `p` is a STRICT PREFIX of it — in practice the bare `workflow`. */
const PATH_REL_PREFIX = 'prefix';
/** `workflow.on_complete` is a strict prefix of `p` — something nested under it. */
const PATH_REL_UNDER = 'under';

/**
 * How a resolved key or table path relates to `PUBLISH_HOOK_KEY_PATH`.
 *
 * FIX ROUND 2 (B1). THE WHOLE POINT: a path that merely SHARES A PREFIX with
 * ours is not unrelated to it. TOML has one namespace per file, so
 * `workflow.on_complete = [ … ]` fixes `workflow` as a table AND `on_complete`
 * as a value, and any other statement that contradicts either of those two
 * facts makes the file invalid. Equality catches one of the three ways to
 * contradict them; this catches all three.
 *
 * `null` for everything else — `workflow.other`, `[workflow.sub]`,
 * `agent.on_complete`, `[agent]` … `workflow.on_complete`, a bare root
 * `on_complete`, the whole-quoted `"workflow.on_complete"` (ONE key literally
 * containing a dot, which is a different key path). All of those are valid
 * beside our block, measured against `tomllib`, and refusing over one blocks an
 * install.
 *
 * @param {string[]} p a RESOLVED (scope-qualified) path
 * @returns {string|null}
 */
function keyPathRelation(p) {
  const k = PUBLISH_HOOK_KEY_PATH;
  const n = Math.min(p.length, k.length);
  for (let i = 0; i < n; i++) if (p[i] !== k[i]) return null;
  if (p.length === k.length) return PATH_REL_SAME;
  return p.length < k.length ? PATH_REL_PREFIX : PATH_REL_UNDER;
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
      // FIX ROUND 2 (B2). The detector compared key paths for EQUALITY, so the
      // `[workflow]`-header and dotted spellings were reported and the third
      // legal spelling of the identical thing — `workflow = { on_complete =
      // "MINE" }`, an INLINE TABLE — was not. Measured: the resolver returns
      // "MINE", the publish is dead, exit 0, and `detectUserLayerScalarOverrides`
      // returned `[]`. The single state R10 exists to name went unnamed.
      //
      // So: resolve `workflow.on_complete` THROUGH inline-table values as well
      // as through table scope and dotted keys, and judge the value found at the
      // end of that path.
      const found = valueAtKeyPath(k, PUBLISH_HOOK_KEY_PATH);
      if (found === null) continue;
      // ARRAY vs anything else — the only distinction `deep_merge` makes.
      if (/^\[/.test(String(found).trim())) continue;
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
  COLLISION_TABLE_IS_VALUE, COLLISION_KEY_USED_AS_TABLE, COLLISION_AMBIGUOUS_MARKERS,
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
