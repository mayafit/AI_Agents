# Story 31.10 — Confluence Page Tree: One Page Per Artifact, Mirroring the Source Tree

Status: review

**Decision inputs:** P5-9.7 (page structure), P5-9.6 (no mirror, no cache, no sync).
**FR:** completes FR255, FR256, FR260. **Related:** FR261/FR262 (Story 31.9's gate), FR267.
**Settled inputs consumed, not re-derived:** OQ-4 (Story 31.8), OQ-5 (Story 31.6 §4).

---

## 1. THE ENVIRONMENT LIMIT — stated, not papered over

**The `claude.ai Atlassian Rovo` MCP server is unauthorised and cannot be authorised from a
non-interactive session.** AC8 sanctions a mocked MCP surface and that is the path taken.

> **Every claim in this story about what happens when a Confluence MCP is present is
> MOCK-VERIFIED, NOT LIVE.** No page was created in, updated in, or read from a Confluence
> instance. What is verified live is everything on this side of the boundary: the artifact
> selection, the tree mapping, the operation sequence, the response validation, the write-back,
> and the absence of any local write.

The mock is made honest the way Story 31.9's air-gap harness was made honest — it proves itself
armed before anything relies on it. See §7.

---

## 2. WHAT WAS BUILT, AND WHY IT IS SHAPED THIS WAY

Three surfaces, and one deliberate non-surface.

| Surface | File | What it is |
| --- | --- | --- |
| The mapping and the protocol | `lib/confluence-page-tree.js` | Pure. **Requires nothing** — no `fs`, no `path`, no `net`. |
| The on-disk half | `bin/cli.js` (new section near the end) | Directory derivation, artifact enumeration, `ma-agents confluence-plan`, OQ-4's write-back. |
| The suite | `test/project-layout-confluence-page-tree.test.js` | 130 tests. |
| **NOT built** | any skill document | See §8. |

### 2.1 Why the mapping module requires nothing

AC4's negative — *no local copy is written* — is proved **structurally** rather than
behaviourally. A module with no `fs` cannot write a file; a module with no `net` cannot reach a
network. `test/project-layout-confluence-page-tree.test.js` asserts the module's `require(` count
is **zero**, and separately asserts that loading it adds exactly one entry to `require.cache`.
Bodies are handed IN by the caller; page identities are handed OUT to the caller. There is no
second path.

### 2.2 The tree mapping, stated as a rule

For an artifact at `prd/capabilities/skills-platform.md` the page keys are `prd`,
`prd/capabilities`, `prd/capabilities/skills-platform`, and each is the child of the one before,
with the first a child of the FR260 root page. A page's **title is its source name with `.md`
removed**; a folder page's title is the folder name.

**THE INDEX RULE — and why it is not a special case.** A file `prd.md` and a folder `prd/`
produce the **same page key**, `prd`. So they are the same page: the file supplies its body, the
folder supplies its children. That is how *"a sharded PRD becomes an index page with its
capability shards as child pages"* (AC1) falls out of mapping the source tree literally, rather
than being hard-coded for the PRD. It works identically for a sharded architecture.

**What is refused rather than corrupted.** Confluence page titles are unique within a space. Two
artifacts in different folders can share a basename — `prd/changelog.md` and
`architecture/changelog.md` do, in this repository. Within one store's plan that would resolve
both to whichever page Confluence returns first and interleave two documents into one page's
history on every run. `planStorePublication` **throws, naming both source paths**.

---

## 3. THE OPERATION SET — enumerated, and closed

**THREE.** `resolve_page`, `create_page`, `update_page`.

| Operation | What it does | What it does NOT do |
| --- | --- | --- |
| `resolve_page` | Answers *"is there already a page with this title under this parent in this space?"* → `{found, id}` | Consumes **no content**. Exactly two fields are read off its response. |
| `create_page` | Creates a page `resolve_page` said does not exist | — |
| `update_page` | Overwrites the body of a page `resolve_page` found | — |

**Why it is closed, mechanically and not by convention.** `executePlan`'s dispatcher gate is a
**membership test** against `CONFLUENCE_PAGE_OPERATIONS` — `if (!OPERATION_SET.has(operation))
throw` — not a list of forbidden names. A denylist is walked past by rewording, and this epic has
been bitten by that twice (Story 31.12's M11, and Story 31.9's round-1 blockquote carve-out). A
new operation is therefore **unreachable** until it is added to the frozen array in a deliberate
commit, and the suite asserts the array by **set equality**, so adding one turns a suite red.

**Every absence is a decision, not an omission:**

- **no `delete_page` / `archive_page`** — publishing must never destroy a page's history, which is
  the entire reason P5-9.7 chose one page per artifact. *Consequence, disclosed:* a re-sharded or
  renamed artifact leaves its old page in place rather than removing it. Reported in §9.
- **no `get_page_body` / any content read** — nothing is downloaded, so nothing can become a
  cache. This is the mechanical form of the FR266 negative.
- **no `list_children` / `move_page`** — any enforced hierarchy beyond this tree mapping is
  deferred at P5-9 and is AC7's out-of-scope clause.

This is the shape `mcp-detection-pattern-spec.md` §3 uses for the sprint operations catalog, for
the reason the story's technical note gives: *an unenumerated operation set is how the Jira path
nearly grew a second convention.*

---

## 4. AC-BY-AC

| AC | Where | How it is measured |
| --- | --- | --- |
| **1** one page per markdown artifact, nested to match the source folders | `lib/confluence-page-tree.js` `planStorePublication` | Plan edge set compared with an edge set derived from the **fixture directory** by `fs` recursion + `path.dirname`. Ancestor-title chain of every artifact page compared with its path segments. |
| **2** not flattened, not collapsed | same | Two oracles written from first principles in the test, each **probed against a deliberately flattened and a deliberately collapsed plan** before use. |
| **3** blank root page created here, named `{project_name}`, reported | `executePlan` report `rootPage.created`; `handleConfluencePlan` prints it | Name taken from the **shipped** `cli.generatedRootPageTitle`, not restated. Assert `created:true` on a first run, `false` on a second, and the name present in the command's actual stdout. |
| **4** MCP only; no local copy | `executePlan` gate; module has zero requires | Zero-`require` scan; `require.cache` delta; **full byte snapshot** of the project root before/after; all twelve `fs` write primitives poisoned (each probed individually); no-MCP → `ConfluencePublishError` carrying FR262's four facts. |
| **5** update, not duplicate | `executePlan` resolve→update/create | Second and third runs create **nothing** and land on the **same page ids**; a blind-resolver probe proves the harness *could* have shown duplication. Ten shapes of unsuccessful write each required to throw. |
| **6** only that store's artifacts | `ARTIFACT_KIND_OWNER` + `artifactsForStore` | Bound to **two outside authorities** — see §5. |
| **7** no templates, no extra hierarchy | `executePlan` body selection; plan key set | Artifact body compared **byte for byte** with the source file; container body asserted `''`; plan key set asserted equal to the source-derived key set. |
| **8** mocked MCP surface; tree shape, update-not-duplicate, store scoping | the suite | 130 tests, exit 0. Section 0 proves the harness first. |

---

## 5. AC6 — BOUND TO TWO AUTHORITIES OUTSIDE THE CODE

This is the AC most exposed to the epic's tautology class (six instances, one of which let the
architecture document be reassigned to the wrong store with a green suite). Ownership is therefore
never compared against anything derived from `ARTIFACT_KIND_OWNER`.

**Authority 1 — Story 31.6's routing table** (`31-6-artifact-to-store-routing.md` §3). That
story's own AC6 states the document *is the specification the code is checked against*. The suite
**parses its sixteen rows** and, for each of the sixteen artifact kinds, reads the destination out
of the table. The test carries only the kind→row-**number** mapping; the destination itself comes
from the table. Flipping any value in `ARTIFACT_KIND_OWNER` fails.

**Authority 2 — the PRD's own sentences.** `prd/capabilities/project-knowledge-and-repository-layout.md`
FR255, FR256 and FR267 are parsed directly and required to still name the artifacts they assign.
A table row and a code value could only agree wrongly if the PRD were changed too.

**Authority 3 (corpus) — this repository's real planning artifacts.** The classifier is run over
`_bmad-output/planning-artifacts/**` — files no test wrote — and required to put the real PRD and
its real shards in the system store and the real architecture document and epics outside it.

Every one of AC6's own named negatives is asserted individually: architecture, a sharded
architecture decision record, the UX specification, epics, story files, and `sprint-status.yaml`
(the last refused on **two independent grounds** — it is not markdown, and it is owned by sprint
management).

**Exclusions are reported, never dropped.** Every candidate appears in exactly one of `selected`
or `excluded`, and an excluded artifact carries the destination it *does* belong to.
`ma-agents confluence-plan` prints them under *"Not published by this store"*.

---

## 6. AC5 — AN IDEMPOTENT WRITE, WHICH IS NOT A SYNC

**The distinction, kept explicit in the code and in the tests, because Story 31.14 AC7 runs a
negative traceability check that no FR266 code landed:**

> A **sync** compares two versions and decides which wins. This compares nothing and always writes
> the source. There is no direction, no trigger, no authority call and no conflict resolution,
> because there are never two copies to reconcile.

`resolve_page` is an **identity** lookup. `executePlan` picks exactly `{found, id}` off its
response. The mock deliberately rides a **poison body** and a version number on every resolve
answer, and the suite asserts that string appears in **no later operation payload and in no part
of the report**. That is a measurement of "no content is consumed", not a claim about it.

**A failed write cannot report success (defect shape 6 — Story 31.13 printed "Bound." after its
authoritative write failed).** `executePlan` has **exactly one success exit**, reached only after
every node in the plan has a confirmed page id. Every response must **positively prove** success;
`undefined`, `null`, `{}`, `{ok:false}`, `{ok:'true'}`, `{ok:1}`, `{ok:true}` with no id, with an
empty id, with a whitespace id, and a bare string are each driven through and each required to
throw a `ConfluencePublishError` carrying `published:false`. The test also asserts that **nothing
was returned** on the failing path, not merely that something was thrown.

**No permissive default on the identity half (defect shape 1).** An inconclusive `resolve_page`
— `found` absent, `null`, `0`, or the string `'no'` — **halts**. Reading it as "not found" would
duplicate a page that already exists and destroy the history AC5 exists to preserve.

---

## 7. HOW THE MOCK PROVES ITSELF ARMED

Section 0 of the suite runs **before every other section**, and nothing later is trusted until it
passes. Story 31.8's reviewer left an open residual against that story's offline harness — *a
self-test proving the harness is not WHOLLY inert does not prove each of its primitives is armed* —
and this is the closure of that residual for this harness.

1. **The mock records** — an operation asked for appears in `.calls`, with its payload.
2. **The mock does not invent** — an operation nobody asked for does not appear.
3. **The mock rejects** — an operation outside the catalogue throws.
4. **The mock remembers** — a page it created is `found` on the next resolve, with the same id.
   (Without this, the idempotence result would pass against a mock incapable of showing a
   duplicate.)
5. **The mock actually fails** — `failOn` is shown to produce `ok:false`.
6. **`snapshotTree` detects** a new, a changed, a nested-new and a deleted file.
7. **The fs poison arms each of twelve primitives**, probed **one at a time** — `writeFileSync`,
   `appendFileSync`, `mkdirSync`, `createWriteStream`, `openSync`, `renameSync`, `copyFileSync`,
   `rmSync`, `unlinkSync`, `writeSync`, `truncateSync`, `rmdirSync` — plus `fs.promises.writeFile`,
   and is then shown to **release**, so later tests are not testing a corpse.
8. **Both AC2 oracles fire** against a hand-built flattened plan and a hand-built collapsed plan,
   and then **pass** the real mapping — so neither is an always-throw stub nor a never-throw one.
9. **The idempotence claim is falsifiable** — a blind resolver that always answers "not found" is
   shown to produce a second set of pages with different ids.

---

## 8. WHAT THIS STORY DELIBERATELY DID NOT TOUCH

- **No skill document was edited.** Story 31.9's gate is nine shipped copies under one sha256 and
  its Step B2 message region is a closed set; Story 31.4's preflight is 41 copies under one sha256.
  Both invariants are re-asserted **inside this story's own suite** — nine copies one digest, 41
  copies one digest — together with a scan proving no skill document carries this story's
  vocabulary. Consequently no `npm run build:plugin`, no mirror regeneration, and no fifth
  `story-15-5` failure is possible from this story.
- **Story 31.2's schema was not reopened.** `root_page: {title, id}` was already reserved; this
  story fills the `id` in.
- **AC7's deferred items were not implemented** — no per-artifact page template, no hierarchy
  beyond the tree mapping. Both are *enforced*, not merely omitted: the artifact body is asserted
  byte-identical to its source, the container body is asserted empty, and the plan's key set is
  asserted equal to the source-derived key set.
- **`bug-bmad-knowledge-atlas-renders-a-confluence-backed-store-from-stale-local-files.md` is
  neither adopted nor contradicted.** Its reviewer established by reading all eight ACs that none
  covers it, and gave a structural reason it cannot be fixed here (the Atlas scan is compiled
  code, not embedded instruction text). Nothing in this story makes `bmad-knowledge` gate on a
  backend, and nothing in this story asserts that it does or should not. It stays OPEN and
  unassigned.

---

## 9. LIMITATIONS AND GAPS, REPORTED RATHER THAN HIDDEN

1. **`executePlan` has no production JS caller.** The Confluence MCP lives in the agent's tool
   context, not in this Node process, so the operations must be performed by the agent.
   `ma-agents confluence-plan` is the production call site for the catalogue, the classifier, the
   directory rule, the gateway check, the planner and the title-collision refusal — it prints the
   tree and the enumerated operations. `executePlan` itself is the **executable definition of the
   protocol**, exercised by the suite and by any future in-agent bridge. This is a genuine weak
   spot and is named as one, not dressed up.
2. **Cross-store title collision is not detected.** Titles are unique per Confluence *space*, and
   a plan is per store. If both stores are bound to the **same** space, `prd/capabilities/x.md`
   and `architecture/decisions/x.md` would collide — and this repository has exactly such pairs.
   Within one store's plan the collision is refused; across two stores sharing a space it is not.
   Worth a follow-up story.
3. **No orphan cleanup.** With no delete operation, a renamed or re-sharded artifact leaves its
   old page in place. That is the safe direction (history is never destroyed), but a store
   published over a long period accumulates stale pages.
4. **Page titles are filenames.** `product-brief-agents-2026-03-08` is faithful to the source tree
   and deterministic, but it is not a nicely-worded page title. Deriving a title from the
   document's H1 was rejected: H1s collide far more often than filenames, and re-titling on an H1
   edit would orphan the page — exactly the OQ-4 failure mode.
5. **Per-artifact page identity is resolved on every run**, not recorded. NFR79 says
   `project-layout.yaml` records *only* the space key and root page identity, and a growing
   per-artifact id table is the record it was not designed to carry. The consequence is that
   renaming an artifact file orphans its page (a new page is created under the new title). This is
   the OQ-4 trade-off applied one level down; it is why the mapping must be deterministic.
6. **A defect this story found in its own first draft** is pinned by test:
   `recordLearnedRootPageId` initially passed the **outcome string** to
   `projectLayoutWriteIsBound`, which takes the **result object** — so every successful write
   reported as failed. Story 31.13's defect, pointing the other way. Pinned in both directions.

---

## 10. CONTRADICTIONS FOUND

None between this story's ACs and P5-9.7, P5-9.6, FR255, FR256, FR260 or FR267.

One observation, reported and **not acted on** (the PRD, Decision P5-9 and `epics.md` are outside
this story's boundary): `epics.md:5493` gives Story 31.10's **Size** as `Large` in the story
heading, while the same file's Story 31.9 block immediately above it is the one whose ACs the
sprint-status key describes. No action needed — the ACs at `epics.md:5499-5509` are unambiguous and
are what was implemented.
