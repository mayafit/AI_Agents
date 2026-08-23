'use strict';

/**
 * Story 31.10 — the Confluence page tree (P5-9.7; completes FR255, FR256, FR260).
 *
 * ONE Confluence page per markdown artifact, nested under the FR260 root page to
 * MATCH THE SOURCE FOLDER STRUCTURE. A sharded PRD becomes an index page with its
 * capability shards as child pages.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE IS NOT — read this before adding anything to it.
 * ────────────────────────────────────────────────────────────────────────────
 * FR266 (a local mirror of Confluence content) is RETIRED. P5-9.6 names an
 * accidental mirror as the single most likely way this epic reacquires the
 * subsystem it removed, and Story 31.14 AC7 runs a NEGATIVE traceability check
 * that no such code landed. So, stated as rules this module actually obeys and
 * `test/project-layout-confluence-page-tree.test.js` actually measures:
 *
 *   1. This module does not `require('fs')`, `require('path')`, `require('os')`,
 *      `require('http')`, `require('https')` or `require('net')`. It cannot read
 *      or write a local file and it cannot open a socket. Bodies are handed IN by
 *      the caller; page identities are handed OUT to the caller. (AC4.)
 *   2. `executePlan` never reads Confluence CONTENT. `resolve_page` is an
 *      IDENTITY lookup: exactly `{found, id}` is consumed from its response and
 *      nothing else, so there is no downloaded body to cache, diff or reconcile.
 *   3. There is no sync direction, no sync trigger, no authority call and no
 *      conflict resolution, because there are never two copies to reconcile.
 *      AC5's "update rather than duplicate" is an IDEMPOTENT WRITE — the same
 *      publication run twice lands on the same pages — not a synchronisation.
 *      The distinction is load-bearing: a sync compares two versions and decides
 *      which wins; this compares nothing and always writes the source.
 *   4. There is no delete and no archive operation. Publishing never removes a
 *      page, so a re-sharded artifact leaves its old page in place rather than
 *      destroying its history. (A deliberate consequence, reported not hidden.)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * OQ-4 — page identity. SETTLED at Story 31.8; not re-derived here.
 * ────────────────────────────────────────────────────────────────────────────
 * `project-layout.yaml` records a human-readable root page TITLE at configuration
 * time with `id: null`, because turning a title into a page id requires asking
 * Confluence and Story 31.8 must complete with no network. THIS is the layer that
 * asks, so this is the layer that can learn an id. A learned id is carried
 * forward ONLY while the title is unchanged and dropped on retitle — enforced on
 * the write half by `recordLearnedRootPageId` in `bin/cli.js`, which refuses a
 * write whose title no longer matches.
 *
 * Per-ARTIFACT pages are not given records in `project-layout.yaml`: NFR79 says
 * that file records "only the space key and root page identity", and a growing
 * per-artifact id table is exactly the record it was not designed to carry. An
 * artifact page is resolved on every run by (space, title, parent) — the same
 * three facts the tree mapping already determines from the source path — which is
 * why the mapping has to be deterministic and why duplicate titles are refused
 * rather than merged.
 */

// ═════════════════════════════════════════════════════════════════════════════
// THE OPERATION SET — closed, and closed on purpose.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Every Confluence operation this story performs, enumerated. THREE.
 *
 * `mcp-detection-pattern-spec.md` §3 enumerates the sprint operations catalog for
 * the same reason: an unenumerated operation set is how the Jira path nearly grew
 * a second convention. `executePlan` refuses to dispatch anything not in this
 * array — not by consulting a list of forbidden names (a denylist is walked past
 * by rewording; this epic has been bitten by that twice) but by requiring
 * membership, so a NEW operation is unreachable until it is added here in a
 * deliberate commit.
 *
 * There is no `delete_page`, no `archive_page`, no `get_page_body`, no
 * `list_children` and no `move_page`. Each absence is a decision:
 *   - no delete/archive: publishing must never destroy a page's history (P5-9.7's
 *     whole reason for one page per artifact);
 *   - no body read: nothing may be downloaded, so nothing can become a cache;
 *   - no list/move: any hierarchy beyond this tree mapping is deferred at P5-9
 *     and enforced as out of scope by Story 31.10 AC7.
 */
const CONFLUENCE_PAGE_OPERATIONS = Object.freeze([
  // Identity only. Answers "is there already a page with this title IN THIS
  // SPACE?" and returns `{found, id}`. Consumes NO content. The identity is
  // (space, title) and NOT (space, parent, title) — see PAGE IDENTITY below,
  // which states that semantics as a contract rather than leaving it to the
  // implementer of the MCP bridge to guess.
  'resolve_page',
  // Create a page that `resolve_page` said does not exist.
  'create_page',
  // Overwrite the body of a page that `resolve_page` found. This is what makes a
  // re-run update instead of duplicate (AC5).
  'update_page',
]);

const OPERATION_SET = new Set(CONFLUENCE_PAGE_OPERATIONS);

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * PAGE IDENTITY — `resolve_page` is SPACE-SCOPED. Stated, not implied.
 * ═════════════════════════════════════════════════════════════════════════════
 * A page's identity is the pair (space, title). The parent is PLACEMENT, not
 * identity: it decides where a page hangs, never which page it is.
 *
 * This was previously left unstated, and the module held two contradictory
 * models at once — the operation catalogue described a parent-scoped lookup
 * while the title-collision guard justified itself by space-scoped uniqueness.
 * The outcome of the central write path depended on which one an MCP bridge
 * happened to implement, and a mock cannot arbitrate that. So it is decided
 * here, in the contract, and the guard, the payloads and the test double are
 * all built from this sentence.
 *
 * WHY SPACE-SCOPED, and not parent-scoped:
 *   1. It is what Confluence itself enforces. Page titles are unique within a
 *      space; a create that duplicates a title in one space is rejected by the
 *      product. A parent-scoped model would describe a Confluence that does not
 *      exist, and the first real publish would find that out.
 *   2. It makes the collision guard TOTAL and the failure a REFUSAL. Under
 *      space-scoped identity every title clash in a plan is knowable before any
 *      operation runs, so the publish is refused with both sources named and
 *      nothing is written. Under parent-scoped identity the same clash is
 *      invisible to the planner and surfaces mid-publish, after some pages have
 *      already been created — a half-published tree with orphans, which is
 *      strictly worse than a refusal.
 *   3. It is the assumption the rest of this module was already built on. The
 *      guard below, and AC5's "a re-run updates rather than duplicates", are
 *      only sound if a title names one page per space.
 *
 * CONSEQUENCES, all of which this module now honours:
 *   - `resolve_page` is called with `{space, title}` and NOTHING else. It is not
 *     given a parent, because passing one would suggest to whoever implements
 *     the bridge that it narrows the lookup — the exact ambiguity being closed.
 *   - The ROOT PAGE IS NOT EXEMPT from the collision guard. It lives in the same
 *     space as every other page in the plan and competes for the same titles.
 *   - Two pages in one space that would carry one title are refused BEFORE the
 *     first operation, whether the pair is artifact/artifact, artifact/root, or
 *     one store's page against the other store's when both share a space.
 */

// ═════════════════════════════════════════════════════════════════════════════
// THE STORES, AND WHICH ARTIFACTS BELONG TO EACH (AC6)
// ═════════════════════════════════════════════════════════════════════════════

const SYSTEM_REQUIREMENTS = 'system_requirements';
const SOFTWARE_REQUIREMENTS = 'software_requirements';
const SPRINT_MANAGEMENT = 'sprint_management';

/**
 * The two destinations that are STORES. `sprint_management` is a destination but
 * not a store (FR267): story files, `sprint-status.yaml`, bugs and retrospectives
 * belong to NEITHER knowledge store, so they are never published to Confluence by
 * any store's plan.
 */
const PUBLISHING_STORES = Object.freeze([SYSTEM_REQUIREMENTS, SOFTWARE_REQUIREMENTS]);

/**
 * Artifact kind → owning destination. Sixteen kinds, one per row of Story 31.6's
 * artifact-to-store routing table, which is that story's AC6 deliverable and the
 * outside authority `test/project-layout-confluence-page-tree.test.js` measures
 * this map against, together with the PRD's own FR255/FR256/FR267 sentences. The
 * map is NOT generated from either: production code must not depend on a document
 * this package does not ship, and a generated expectation would make the check
 * tautological — the defect class that let this epic reassign the architecture
 * document to the wrong store with a green suite.
 *
 * Ownership here is a statement about the ARTIFACT, not about where its file
 * happens to sit. Changing any value below contradicts FR255/FR256/FR267 and
 * fails against both the routing table and the PRD's own requirement lines.
 */
const ARTIFACT_KIND_OWNER = Object.freeze({
  // Rows 1-4 — FR255. What the system must do.
  'product-brief': SYSTEM_REQUIREMENTS,
  'prd': SYSTEM_REQUIREMENTS,
  'sharded-prd-index': SYSTEM_REQUIREMENTS,
  'sharded-prd-shard': SYSTEM_REQUIREMENTS,
  // Rows 5-11 — FR256 and OQ-5. How the system is built.
  'architecture': SOFTWARE_REQUIREMENTS,
  'sharded-architecture': SOFTWARE_REQUIREMENTS,
  'ux-design-specification': SOFTWARE_REQUIREMENTS,
  'epics': SOFTWARE_REQUIREMENTS,
  'domain-research-report': SOFTWARE_REQUIREMENTS,
  'market-research-report': SOFTWARE_REQUIREMENTS,
  'technical-research-report': SOFTWARE_REQUIREMENTS,
  // Rows 12-16 — FR120/FR267. Sprint execution state; NOT a knowledge store.
  // Present so that "a system store does not publish story files or
  // sprint-status.yaml" (AC6) is answered by a POSITIVE ownership statement
  // rather than by the artifact failing to be recognised. An unrecognised path
  // and a path that belongs somewhere else are different facts and this module
  // reports them differently.
  'story-file': SPRINT_MANAGEMENT,
  'sprint-status': SPRINT_MANAGEMENT,
  'bug-file': SPRINT_MANAGEMENT,
  'retrospective': SPRINT_MANAGEMENT,
  'other-implementation-artifact': SPRINT_MANAGEMENT,
});

/** Why a candidate was left out. A closed set — see `artifactsForStore`. */
const EXCLUDED_HIDDEN = 'hidden-path';
const EXCLUDED_NOT_MARKDOWN = 'not-markdown';
const EXCLUDED_UNCLASSIFIED = 'unclassified';
const EXCLUDED_OTHER_STORE = 'belongs-to-another-destination';

// ═════════════════════════════════════════════════════════════════════════════
// CLASSIFICATION
// ═════════════════════════════════════════════════════════════════════════════

const POSIX = /\\/g;

/** Normalise a caller-supplied relative path to POSIX, with no leading `./`. */
function normalizeRelPath(relPath) {
  const s = String(relPath == null ? '' : relPath).replace(POSIX, '/').trim();
  return s.replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/+$/, '');
}

function segmentsOf(relPath) {
  return normalizeRelPath(relPath).split('/').filter((s) => s !== '');
}

/**
 * Classify ONE artifact path into a kind, or `null` when the path is not an
 * artifact this table routes.
 *
 * Ordered rules. Order matters exactly where a later rule's substring appears in
 * an earlier rule's filename — `epic-product-brief.md` must be a product brief,
 * not epics, and `validation-report-prd-*.md` must not be the PRD (it is a
 * document ABOUT the requirements, and treating it as the PRD gives the store a
 * second, rival definition site). This ordering, and the derivative-document
 * guard, follow the precedent already shipped in
 * `lib/knowledge-atlas/src/scan/scanner.ts` rather than inventing a second
 * convention for the same question.
 *
 * `null` is NOT a failure and NOT a silent drop: `artifactsForStore` reports every
 * unclassified path back to its caller, and `ma-agents confluence-plan` prints
 * them. A store publishes what this table routes; everything else stays where it
 * is, visibly.
 */
function classifyArtifactPath(relPath) {
  const rel = normalizeRelPath(relPath);
  if (rel === '') return null;
  const segs = rel.split('/');
  const basename = segs[segs.length - 1].toLowerCase();
  const lower = '/' + rel.toLowerCase();

  // Rows 12-16 first. These are recognised so they can be REFUSED by ownership.
  if (basename === 'sprint-status.yaml') return 'sprint-status';
  if (/^bug-[a-z0-9][a-z0-9-]*\.md$/.test(basename)) return 'bug-file';
  if (/^epic-\d+-retrospective\.md$/.test(basename)) return 'retrospective';
  if (/^\d+-\d+[a-z]?-[a-z0-9][a-z0-9-]*\.md$/.test(basename)) return 'story-file';
  if (lower.includes('/implementation-artifacts/')) return 'other-implementation-artifact';

  // Row 1. Both spellings of a product brief: the named file, and anything the
  // brief workflow writes inside its own `briefs/` folder.
  if (basename.includes('product-brief')) return 'product-brief';
  if (lower.startsWith('/briefs/') || lower.includes('/briefs/')) return 'product-brief';

  // Rows 3-4 before row 2: a path UNDER `prd/` is a shard, whatever it is called.
  if (segs.length > 1 && segs[0].toLowerCase() === 'prd') return 'sharded-prd-shard';
  // Row 2. Guarded against derivative documents (see the doc comment).
  if (
    (basename.includes('prd') || basename.includes('product-requirements')) &&
    !/(validation|report|checklist|review|cohesion|assessment)/.test(basename)
  ) {
    return 'prd';
  }

  // Rows 5-6, same shape one store over.
  if (segs.length > 1 && segs[0].toLowerCase() === 'architecture') return 'sharded-architecture';
  if (basename.includes('architecture')) return 'architecture';

  // Row 7. A word-boundary match, not a substring: `ux` inside `flux-report.md`
  // is not a UX specification.
  if (/(^|[-_.])ux([-_.]|$)/.test(basename.replace(/\.md$/, '') + '.')) {
    return 'ux-design-specification';
  }

  // Row 8.
  if (basename.includes('epic')) return 'epics';

  // Rows 9-11 — OQ-5, decided 2026-08-12: all three go to the software store.
  if (basename.startsWith('domain-research')) return 'domain-research-report';
  if (basename.startsWith('market-research')) return 'market-research-report';
  if (basename.startsWith('technical-research')) return 'technical-research-report';

  return null;
}

/**
 * Set-aware classification. Rows 3 and 6 are properties of the SET, not of one
 * path: `prd.md` is the PRD when it stands alone and the sharded PRD INDEX when
 * `prd/` shards exist beside it. Same for `architecture.md`.
 *
 * This changes no routing — rows 2 and 3 are both system requirements, rows 5 and
 * 6 both software — so it cannot move an artifact between stores. It exists so
 * the plan can say, truthfully, that a sharded PRD's index page is the parent of
 * its shards.
 */
function classifyArtifactPaths(relPaths) {
  const first = (relPaths || []).map((p) => ({
    path: normalizeRelPath(p),
    kind: classifyArtifactPath(p),
  }));
  const hasPrdShards = first.some((e) => e.kind === 'sharded-prd-shard');
  const hasArchShards = first.some((e) => e.kind === 'sharded-architecture');
  return first.map((e) => {
    if (e.kind === 'prd' && hasPrdShards) return { path: e.path, kind: 'sharded-prd-index' };
    if (e.kind === 'architecture' && hasArchShards) return { path: e.path, kind: 'sharded-architecture' };
    return e;
  });
}

/**
 * AC6. Select, from a set of candidates, exactly the artifacts that belong to
 * `storeId` — and report every exclusion with the reason it was excluded.
 *
 * `candidates` is `[{ path, body }]`. `body` is the artifact's markdown, read by
 * the CALLER; this module never opens a file.
 *
 * Refuses an unknown `storeId` rather than defaulting to one. A default store here
 * would be a value indistinguishable from a real answer, which is the first defect
 * shape this epic produced.
 */
function artifactsForStore(storeId, candidates) {
  if (!PUBLISHING_STORES.includes(storeId)) {
    throw new Error(
      `confluence-page-tree: ${JSON.stringify(storeId)} is not a knowledge store. ` +
      `The stores that publish are ${PUBLISHING_STORES.map((s) => JSON.stringify(s)).join(' and ')}. ` +
      `${JSON.stringify(SPRINT_MANAGEMENT)} is a routing destination but NOT a store (FR267), ` +
      `so its artifacts are never published to Confluence.`
    );
  }
  const list = Array.isArray(candidates) ? candidates : [];
  const paths = list.map((c) => (c && typeof c === 'object' ? c.path : c));
  const classified = classifyArtifactPaths(paths);

  const selected = [];
  const excluded = [];
  for (let i = 0; i < list.length; i++) {
    const cand = list[i] && typeof list[i] === 'object' ? list[i] : { path: list[i] };
    const rel = classified[i].path;
    const kind = classified[i].kind;
    const segs = rel === '' ? [] : rel.split('/');

    if (segs.some((s) => s.startsWith('.'))) {
      excluded.push({ path: rel, kind: null, owner: null, reason: EXCLUDED_HIDDEN });
      continue;
    }
    if (!/\.md$/i.test(rel)) {
      // AC1 is "one page per MARKDOWN artifact". `sprint-status.yaml` reaches
      // here and is refused on this rule before ownership is even consulted —
      // and is refused on ownership too, which is why AC6's claim about it is
      // asserted twice from two different directions.
      excluded.push({ path: rel, kind, owner: kind ? ARTIFACT_KIND_OWNER[kind] : null, reason: EXCLUDED_NOT_MARKDOWN });
      continue;
    }
    if (!kind) {
      excluded.push({ path: rel, kind: null, owner: null, reason: EXCLUDED_UNCLASSIFIED });
      continue;
    }
    const owner = ARTIFACT_KIND_OWNER[kind];
    if (owner === undefined) {
      // Unreachable unless a kind is added to the classifier and not to the
      // ownership map. Fail loud: the alternative is an artifact with no stated
      // destination silently landing in whichever store asked first.
      throw new Error(
        `confluence-page-tree: artifact kind ${JSON.stringify(kind)} has no entry in ` +
        `ARTIFACT_KIND_OWNER. Every kind the classifier can return must state its owning ` +
        `destination; refusing to guess one for ${JSON.stringify(rel)}.`
      );
    }
    if (owner !== storeId) {
      excluded.push({ path: rel, kind, owner, reason: EXCLUDED_OTHER_STORE });
      continue;
    }
    selected.push({ path: rel, kind, owner, body: cand.body });
  }
  selected.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  excluded.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { storeId, selected, excluded };
}

// ═════════════════════════════════════════════════════════════════════════════
// THE TREE (AC1, AC2, AC3, AC7)
// ═════════════════════════════════════════════════════════════════════════════

/** A page's title is its source name with the `.md` extension removed. Nothing else. */
function titleForSegment(segment, isLeafFile) {
  return isLeafFile ? String(segment).replace(/\.md$/i, '') : String(segment);
}

const ROLE_ROOT = 'root';
const ROLE_INDEX = 'index';
const ROLE_ARTIFACT = 'artifact';

/**
 * Build the page tree for one store.
 *
 * AC1/AC2 — the mapping is the source folder structure, literally. For an
 * artifact at `prd/capabilities/skills-platform.md` the page keys are
 * `prd`, `prd/capabilities`, `prd/capabilities/skills-platform`, and each is the
 * child of the one before it, with the first a child of the root page. That is
 * why the mapping is neither flattened (a nested artifact's parent is a folder
 * page, never the root) nor collapsed (there is one page per artifact, never one
 * per store).
 *
 * THE INDEX RULE — how a sharded PRD becomes an index page with its shards as
 * children. A file `prd.md` and a folder `prd/` produce the SAME page key,
 * `prd`. So they are the same page: the file supplies its body, the folder
 * supplies its children. This is not a special case for the PRD; it falls out of
 * mapping the source tree literally, which is why it also works for a sharded
 * architecture and for anything sharded later.
 *
 * AC7 — nothing else is created. No category pages, no per-artifact template, no
 * grouping level. The set of pages is exactly {root} ∪ {every folder on a
 * selected artifact's path} ∪ {every selected artifact}, and a container page
 * with no `.md` beside it carries NO body at all rather than a generated one.
 *
 * @param {object}   spec
 * @param {string}   spec.storeId
 * @param {string}   spec.spaceKey
 * @param {object}   spec.rootPage      `{title, id}` exactly as project-layout.yaml records it
 * @param {Array}    spec.artifacts     the OUTPUT of `artifactsForStore(...).selected`
 */
function planStorePublication(spec) {
  const opts = spec || {};
  const storeId = opts.storeId;
  if (!PUBLISHING_STORES.includes(storeId)) {
    throw new Error(
      `confluence-page-tree: cannot plan a publication for ${JSON.stringify(storeId)}; ` +
      `the stores that publish are ${PUBLISHING_STORES.map((s) => JSON.stringify(s)).join(' and ')}.`
    );
  }
  const spaceKey = String(opts.spaceKey == null ? '' : opts.spaceKey).trim();
  if (!spaceKey) {
    throw new Error(
      `confluence-page-tree: no Confluence space key for the ${labelForStore(storeId)}. ` +
      `A store's space is its location; refusing to plan a publication with none.`
    );
  }
  const rootPage = opts.rootPage || {};
  const rootTitle = String(rootPage.title == null ? '' : rootPage.title).trim();
  if (!rootTitle) {
    // Story 31.8 guarantees a title is always recorded — it substitutes the
    // generated `{project_name}` when the answer is blank. Reaching here means
    // the binding was hand-edited. Inventing a name at THIS layer would create a
    // page the user never chose, in a space their team reads.
    throw new Error(
      `confluence-page-tree: the ${labelForStore(storeId)} has no root page title in ` +
      `_bmad-output/project-layout.yaml. Re-run \`ma-agents bind\` (or the installer) to ` +
      `answer the root-page question; refusing to invent a page name.`
    );
  }
  const rootId = String(rootPage.id == null ? '' : rootPage.id).trim() || null;

  const artifacts = Array.isArray(opts.artifacts) ? opts.artifacts : [];

  /** key → node. Key `''` is the root. */
  const byKey = new Map();
  const rootNode = {
    key: '',
    title: rootTitle,
    parentKey: null,
    role: ROLE_ROOT,
    sourcePath: null,
    body: null,
    id: rootId,
  };
  byKey.set('', rootNode);

  const claimedBySource = new Map(); // key → source path that claimed it as an artifact

  for (const artifact of artifacts) {
    const rel = normalizeRelPath(artifact && artifact.path);
    const segs = segmentsOf(rel);
    if (segs.length === 0) continue;

    let parentKey = '';
    for (let i = 0; i < segs.length; i++) {
      const isLeaf = i === segs.length - 1;
      const title = titleForSegment(segs[i], isLeaf);
      const key = parentKey === '' ? title : `${parentKey}/${title}`;
      let node = byKey.get(key);
      if (!node) {
        node = {
          key,
          title,
          parentKey,
          role: ROLE_INDEX,
          sourcePath: null,
          body: null,
          id: null,
        };
        byKey.set(key, node);
      }
      if (isLeaf) {
        const prior = claimedBySource.get(key);
        if (prior !== undefined && prior !== rel) {
          // Two different source files map to one page. Confluence would give
          // them one page between them and each run would overwrite the other's
          // body — the exact duplication/loss AC5 exists to prevent, arriving
          // through the front door.
          throw new Error(
            `confluence-page-tree: ${JSON.stringify(prior)} and ${JSON.stringify(rel)} both map to ` +
            `the page "${title}" under the ${labelForStore(storeId)}'s root page "${rootTitle}". ` +
            `One page per artifact means one artifact per page; rename one of them.`
          );
        }
        claimedBySource.set(key, rel);
        node.role = ROLE_ARTIFACT;
        node.sourcePath = rel;
        // AC7 — the body is the artifact's markdown, verbatim. No template, no
        // header, no front-matter injection, no footer. A `undefined` body is
        // normalised to `''` only for a CONTAINER page; an artifact page with no
        // body is a caller bug and is refused at execution time.
        node.body = artifact && artifact.body !== undefined ? artifact.body : null;
      }
      parentKey = key;
    }
  }

  // Page identity is (space, title) — see PAGE IDENTITY at the top of this file.
  // Two artifacts in different folders can share a basename (`prd/changelog.md`
  // and `architecture/changelog.md` do, in this very repository) — in one store's
  // plan that would resolve BOTH to the same page and silently interleave two
  // documents into one page's history. Refuse, naming both, rather than corrupt.
  //
  // THE ROOT PAGE IS INCLUDED. It was exempt, and that exemption was a hole
  // straight through the guard: with a root page titled "prd" and an artifact
  // `prd.md`, the artifact page and the root page are one page. The planner did
  // not refuse, the artifact's body overwrote the root, the page became its own
  // parent, and `executePlan` returned `ok: true, published: true` over the top
  // of it — success reported over a corrupting write. The guard's own stated
  // justification (titles are unique within a space) never had an exception for
  // the root; the root lives in that space like everything else.
  const titleOwners = new Map();
  for (const node of byKey.values()) {
    const clash = titleOwners.get(node.title);
    if (clash !== undefined) {
      const nameOf = (key) => (key === '' ? 'the root page' : JSON.stringify(key));
      throw new Error(
        `confluence-page-tree: two pages in this plan would be titled "${node.title}" ` +
        `(${nameOf(clash)} and ${nameOf(node.key)}). Confluence page titles are ` +
        `unique within a space "${spaceKey}", so publishing both would overwrite one with the ` +
        `other on every run. Rename one of the sources` +
        (clash === '' || node.key === ''
          ? `, or give the ${labelForStore(storeId)} a root page title that no artifact shares.`
          : `.`)
      );
    }
    titleOwners.set(node.title, node.key);
  }

  // Deterministic order, parents strictly before children: depth first, then key.
  const nodes = Array.from(byKey.values()).sort((a, b) => {
    const da = a.key === '' ? 0 : a.key.split('/').length;
    const db = b.key === '' ? 0 : b.key.split('/').length;
    if (da !== db) return da - db;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });

  return {
    storeId,
    spaceKey,
    rootKey: '',
    nodes,
    // The catalogue travels WITH the plan so a consumer (`ma-agents confluence-plan`
    // prints it; `executePlan` enforces it) reads the operation set from one place.
    operations: CONFLUENCE_PAGE_OPERATIONS,
  };
}

/**
 * CROSS-STORE PRE-FLIGHT. The collision guard inside `planStorePublication` is
 * scoped to ONE plan, but page identity is (space, title) and a space is not
 * owned by a store. Nothing prevents both knowledge stores from being bound to
 * the same Confluence space — there is no distinctness check anywhere in the
 * binding — and when they are, one store's page and the other's compete for one
 * title exactly as two pages within a single plan do.
 *
 * This is not an exotic corner. In THIS repository the two plans collide TEN
 * times: `changelog` (a `prd/changelog.md` and an `architecture/changelog.md`)
 * and nine of the eleven PRD capability shards, each of which shares its name
 * with an architecture decision record — `prd/capabilities/skills-platform.md`
 * against `architecture/decisions/skills-platform.md`, and so on. Naming a
 * capability's requirements and its decision record after the capability is the
 * dominant documentation convention here, not a mistake someone made once.
 *
 * TWO ROOT PAGES WITH ONE TITLE ARE NOT A CLASH. If both stores record the same
 * root page title in one space they are describing ONE shared root page with
 * both trees beneath it, which is a coherent layout and the likely one — AC3
 * names the root page `{project_name}` for both stores, so sharing is the
 * default outcome, not an accident. A root page carries no body, so nothing is
 * overwritten. Every other pairing IS a clash: an artifact page that collides
 * with the other store's root would overwrite a page that has children, leaving
 * them parented to an artifact.
 *
 * Returns the clashes; it does not throw. `assertNoCrossStoreTitleClashes`
 * is the refusing form, and is what a caller planning both stores should use.
 */
function crossStoreTitleClashes(plans) {
  const list = (Array.isArray(plans) ? plans : []).filter(
    (p) => p && Array.isArray(p.nodes) && String(p.spaceKey || '').trim() !== ''
  );
  const clashes = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      // Different spaces cannot collide: identity is scoped to a space.
      if (a.spaceKey !== b.spaceKey) continue;
      const byTitle = new Map(a.nodes.map((n) => [n.title, n]));
      for (const nb of b.nodes) {
        const na = byTitle.get(nb.title);
        if (!na) continue;
        if (na.role === ROLE_ROOT && nb.role === ROLE_ROOT) continue; // shared root, not a clash
        clashes.push({
          spaceKey: a.spaceKey,
          title: nb.title,
          a: { storeId: a.storeId, key: na.key, role: na.role, sourcePath: na.sourcePath },
          b: { storeId: b.storeId, key: nb.key, role: nb.role, sourcePath: nb.sourcePath },
        });
      }
    }
  }
  clashes.sort((x, y) => (x.title < y.title ? -1 : x.title > y.title ? 1 : 0));
  return clashes;
}

/** The refusing form of `crossStoreTitleClashes`. Names every clash and both sides. */
function assertNoCrossStoreTitleClashes(plans) {
  const clashes = crossStoreTitleClashes(plans);
  if (clashes.length === 0) return;
  const where = (side) =>
    side.sourcePath ? side.sourcePath : `${side.key === '' ? 'the root page' : side.key} (container page)`;
  throw new Error(
    `confluence-page-tree: the two knowledge stores are bound to the same Confluence space ` +
    `"${clashes[0].spaceKey}", and ${clashes.length} page title${clashes.length === 1 ? ' is' : 's are'} ` +
    `claimed by both of them. Page titles are unique within a space, so each of these pairs would ` +
    `resolve to ONE page and overwrite the other on every run:\n` +
    clashes.map((c) =>
      `  - "${c.title}": ${labelForStore(c.a.storeId)} ${where(c.a)}` +
      ` vs ${labelForStore(c.b.storeId)} ${where(c.b)}`).join('\n') +
    `\nGive the two stores different spaces, or rename one side of each pair. ` +
    `Refusing to publish rather than interleave two documents into one page's history.`
  );
}

function labelForStore(storeId) {
  if (storeId === SYSTEM_REQUIREMENTS) return 'system requirements store';
  if (storeId === SOFTWARE_REQUIREMENTS) return 'software requirements store';
  return String(storeId);
}

// ═════════════════════════════════════════════════════════════════════════════
// EXECUTION (AC4, AC5)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * A publication that did not complete. Carries the store, the space, the page and
 * the operation, so a caller cannot report "published" over it by accident and a
 * user is not left guessing which page failed.
 */
class ConfluencePublishError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'ConfluencePublishError';
    Object.assign(this, detail || {});
  }
}

/**
 * The FR262 fail-loud message, as a value. Four facts: the affected store, its
 * configured space, that no Confluence MCP was detected, and how to configure one.
 *
 * This is a SEPARATE surface from Story 31.9's shipped gate block — that block is
 * embedded instruction text in nine byte-identical skill documents under one
 * sha256, and its message region is a closed set that a fifth line would break.
 * Nothing here edits it. The four facts agree because FR262 states them, not
 * because either copy was transcribed from the other.
 */
function noMcpMessage(storeId, spaceKey) {
  const space = String(spaceKey == null ? '' : spaceKey).trim() || 'not recorded';
  return (
    `ma-agents — stopping: this knowledge store is Confluence-backed and no Confluence MCP was detected.\n` +
    `Store: the ${labelForStore(storeId)}. Space: ${space}.\n` +
    `No Confluence MCP server is available in this agent's tool context, so that store cannot be read or written.\n` +
    `To configure one, add a Confluence-capable MCP server to your agent's MCP configuration, pointed at the ` +
    `Confluence instance that hosts that space, and authorise it; then run this skill again. ` +
    `Alternatively, re-run the installer (or \`ma-agents bind\`) to bind that store to the file system instead.\n` +
    `Nothing has been read or written on your behalf, and nothing has been written locally. Stopping rather than guessing.`
  );
}

/**
 * Execute a plan against the Confluence MCP.
 *
 * `dispatch(operation, args)` is the ONLY way out of this function. It is the
 * caller's bridge to the MCP server detected in Story 31.9; this module has no
 * network module and no file-system module, so there is no second path.
 *
 * AC5 — update, do not duplicate. Every node is `resolve_page`d first. Found ⇒
 * `update_page`. Not found ⇒ `create_page`. Run the same plan twice against the
 * same space and the second run creates nothing: the pages are the same pages,
 * with their history and their comments.
 *
 * DEFECT SHAPE 6 — a failed write must NEVER report success. Story 31.13 printed
 * "Bound." after its authoritative write failed because the callee swallowed the
 * failure and returned void. So: every response is validated before it is
 * believed; a response that does not POSITIVELY prove success throws; and this
 * function has exactly one success exit, reached only after every node in the
 * plan has a confirmed page id. There is no partial report.
 */
function executePlan(plan, dispatch) {
  if (!plan || !Array.isArray(plan.nodes)) {
    throw new Error('confluence-page-tree: executePlan requires a plan from planStorePublication().');
  }
  // AC4 — the gate applies to EVERY operation in this story, so it is checked
  // before the first one rather than at each call site.
  if (typeof dispatch !== 'function') {
    throw new ConfluencePublishError(noMcpMessage(plan.storeId, plan.spaceKey), {
      reason: 'no-confluence-mcp',
      storeId: plan.storeId,
      spaceKey: plan.spaceKey,
      published: false,
    });
  }

  const performed = [];
  const idByKey = new Map();
  const pages = [];
  /** Pages taken from a recorded id instead of being resolved. OQ-4. */
  const reusedIds = [];

  const call = (operation, args) => {
    if (!OPERATION_SET.has(operation)) {
      // Membership, not absence. A new operation is unreachable until it is added
      // to CONFLUENCE_PAGE_OPERATIONS in a deliberate commit.
      throw new ConfluencePublishError(
        `confluence-page-tree: ${JSON.stringify(operation)} is not one of the ` +
        `${CONFLUENCE_PAGE_OPERATIONS.length} operations this story performs ` +
        `(${CONFLUENCE_PAGE_OPERATIONS.join(', ')}).`,
        { reason: 'operation-not-in-catalogue', operation, storeId: plan.storeId, published: false }
      );
    }
    performed.push(operation);
    return dispatch(operation, args);
  };

  for (const node of plan.nodes) {
    const parentId = node.parentKey === null ? null : idByKey.get(node.parentKey);
    if (node.parentKey !== null && !parentId) {
      throw new ConfluencePublishError(
        `confluence-page-tree: the parent page of "${node.title}" has no id, so it cannot be ` +
        `nested under it. This is a plan-ordering fault, not a Confluence failure.`,
        { reason: 'parent-unresolved', storeId: plan.storeId, page: node.title, published: false }
      );
    }

    // OQ-4 — A KNOWN PAGE ID IS USED, NOT RE-ASKED FOR.
    //
    // `project-layout.yaml` records the root page as `{title, id}`, and
    // `planStorePublication` carries a learned id onto the root node. When it is
    // present the page is ALREADY IDENTIFIED, and `resolve_page` would only ask
    // Confluence to tell us what we recorded on the last run. So the resolve is
    // SKIPPED and the recorded id is used directly.
    //
    // This is what makes the learned id do work. Without it the field was
    // written by `recordLearnedRootPageId`, displayed by `ma-agents status` and
    // by `confluence-plan`, and consumed by nothing — a value that could be set
    // to null with no observable effect anywhere, which is what a mutation run
    // demonstrated.
    //
    // Only the ROOT page can carry an id: per-artifact pages are deliberately
    // not recorded (NFR79 — the binding holds the space key and the root page
    // identity, not a growing per-artifact id table), so they resolve by title
    // on every run as before.
    const knownId = String(node.id == null ? '' : node.id).trim();
    let found;
    let existingId;
    if (knownId) {
      found = true;
      existingId = knownId;
      reusedIds.push({ key: node.key, title: node.title, id: knownId });
    } else {
      // (space, title) and nothing else — PAGE IDENTITY, above. No parent is
      // sent: the parent is placement, and including it here would tell whoever
      // implements the bridge that it narrows the lookup.
      const resolveArgs = { space: plan.spaceKey, title: node.title };
      const resolved = call('resolve_page', resolveArgs);

      // IDENTITY ONLY. Exactly two fields are read off this response. Whatever
      // else the server sends — a body, a version, a rendered export — is not
      // touched here and therefore cannot become a cache (P5-9.6, FR266 retired).
      found = resolved && typeof resolved === 'object' ? resolved.found : undefined;
      if (found !== true && found !== false) {
        // No permissive default. "I could not tell" must not read as "not found",
        // which would create a duplicate of a page that already exists.
        throw new ConfluencePublishError(
          `confluence-page-tree: resolve_page for "${node.title}" in space "${plan.spaceKey}" did not ` +
          `answer whether the page exists (\`found\` was ${JSON.stringify(found)}). Refusing to guess: ` +
          `guessing "not found" duplicates a page and destroys the history AC5 exists to preserve.`,
          { reason: 'resolve-inconclusive', storeId: plan.storeId, page: node.title, published: false }
        );
      }
      existingId = found ? String(resolved.id == null ? '' : resolved.id).trim() : '';
      if (found && !existingId) {
        throw new ConfluencePublishError(
          `confluence-page-tree: resolve_page reported that "${node.title}" exists in space ` +
          `"${plan.spaceKey}" but returned no page id, so it cannot be updated.`,
          { reason: 'resolve-missing-id', storeId: plan.storeId, page: node.title, published: false }
        );
      }
    }

    if (node.role === ROLE_ARTIFACT && (node.body === null || node.body === undefined)) {
      throw new ConfluencePublishError(
        `confluence-page-tree: no body was supplied for the artifact page "${node.title}" ` +
        `(${node.sourcePath}). An artifact page is the artifact; refusing to publish it empty.`,
        { reason: 'artifact-body-missing', storeId: plan.storeId, page: node.title, published: false }
      );
    }
    // A container page carries no content (AC7 — no templates, no generated body).
    const body = node.role === ROLE_ARTIFACT ? node.body : '';

    const writeOp = found ? 'update_page' : 'create_page';
    const writeArgs = found
      ? { id: existingId, title: node.title, parentId: parentId || null, body }
      : { space: plan.spaceKey, title: node.title, parentId: parentId || null, body };
    const written = call(writeOp, writeArgs);

    // POSITIVE proof, not the absence of an error. `undefined`, `null`, `{}`,
    // `{ok:false}`, `{ok:'true'}` and a thrown-away id all fail here.
    const ok = written && typeof written === 'object' ? written.ok : undefined;
    const newId = written && typeof written === 'object'
      ? String(written.id == null ? '' : written.id).trim() : '';
    if (ok !== true || !newId) {
      throw new ConfluencePublishError(
        `ma-agents — stopping: publishing "${node.title}" to the "${plan.spaceKey}" space FAILED ` +
        `(${writeOp}). The ${labelForStore(plan.storeId)} has NOT been published. ` +
        `Nothing was written locally. ` +
        `Confluence answered ok=${JSON.stringify(ok)}, id=${JSON.stringify(newId || null)}` +
        (written && written.error ? `, error=${JSON.stringify(String(written.error))}` : '') + '.' +
        (knownId
          // A recorded id that no longer names a page is the one failure this
          // path can produce that the user can act on directly, so say so
          // rather than leaving them to guess why a re-run started failing.
          ? `\nThis page was addressed by the id recorded in _bmad-output/project-layout.yaml ` +
            `(${knownId}) rather than resolved by title. If that page was deleted or moved to ` +
            `another space, clear the \`id:\` under this store's \`rootPage:\` (set it to null) ` +
            `and run again — the title will then be resolved afresh.`
          : ''),
        {
          reason: 'write-failed',
          storeId: plan.storeId,
          spaceKey: plan.spaceKey,
          page: node.title,
          sourcePath: node.sourcePath,
          operation: writeOp,
          published: false,
        }
      );
    }

    idByKey.set(node.key, newId);
    pages.push({
      key: node.key,
      title: node.title,
      id: newId,
      parentId: parentId || null,
      role: node.role,
      sourcePath: node.sourcePath,
      created: !found,
      updated: found,
    });
  }

  const rootPageRecord = pages.find((p) => p.key === '') || null;

  // THE ONLY SUCCESS EXIT. Reached only after every node has a confirmed id.
  return {
    ok: true,
    published: true,
    storeId: plan.storeId,
    spaceKey: plan.spaceKey,
    // AC3 — the root page, and whether THIS run created it. `ma-agents
    // confluence-plan` and any caller report the name from here, so the name
    // reported and the name written are one value.
    rootPage: rootPageRecord
      ? { title: rootPageRecord.title, id: rootPageRecord.id, created: rootPageRecord.created }
      : null,
    pages,
    created: pages.filter((p) => p.created).map((p) => p.title),
    updated: pages.filter((p) => p.updated).map((p) => p.title),
    // OQ-4 — which pages were addressed by a RECORDED id instead of being
    // resolved by title. Empty on the first publish; the root page on every
    // publish after `recordLearnedRootPageId` has run. This is the observable
    // effect of the learned id, and it is what a test measures to prove the
    // recorded value is consumed rather than merely stored.
    reusedIds,
    operationsPerformed: performed,
  };
}

module.exports = {
  CONFLUENCE_PAGE_OPERATIONS,
  ARTIFACT_KIND_OWNER,
  PUBLISHING_STORES,
  SYSTEM_REQUIREMENTS,
  SOFTWARE_REQUIREMENTS,
  SPRINT_MANAGEMENT,
  EXCLUDED_HIDDEN,
  EXCLUDED_NOT_MARKDOWN,
  EXCLUDED_UNCLASSIFIED,
  EXCLUDED_OTHER_STORE,
  ROLE_ROOT,
  ROLE_INDEX,
  ROLE_ARTIFACT,
  classifyArtifactPath,
  classifyArtifactPaths,
  artifactsForStore,
  planStorePublication,
  crossStoreTitleClashes,
  assertNoCrossStoreTitleClashes,
  executePlan,
  ConfluencePublishError,
  noMcpMessage,
  labelForStore,
  normalizeRelPath,
};
