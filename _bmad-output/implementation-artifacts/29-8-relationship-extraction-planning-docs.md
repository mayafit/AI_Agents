# Story 29.8: Relationship (Reference) Extraction for Planning-Centric Projects

Status: ready-for-dev

## Story

As a **user whose knowledge is mostly planning docs** (PRD/architecture defining and relating FRs/Epics, with few or no story files),
I want the Atlas to derive **reference edges** between entities and documents from the prose that mentions them,
so the graph is connected, "Referenced by" backlinks populate, and I can travel from one item to another — even without implementation stories.

**Why:** on a real project (Prophesee: 116 nodes — 105 requirements, 9 epics — but **0 edges**), the graph is a cloud of disconnected dots and every "Referenced by" is empty. Root cause: edges are only derived from story/implementation patterns (`implements`, `Blocked by`, epic→story keys, `shipped v…`). A dense PRD where `FR26` is referenced 47× and epics relate FRs throughout produces **zero** edges. This is the user-reported "no references from one item to another." (Follow-up to Epic 29; found on a real install.)

## Acceptance Criteria

1. **Given** any scanned document
   **When** the graph is built
   **Then** the document has its own **file node** (not only story/bug/retro docs — ALL doc types incl. prd/architecture/epics/report/etc.), so it can be a link source/target and appear in the graph.
2. **Given** a document that mentions entity tokens (`FR###`, `NFR##`, `F##`, `Epic N`, `Story N.M`, `P#-#`, `bug-…`)
   **When** edges are derived
   **Then** a typed **`references`** edge is emitted from the document's file node to each **distinct** entity it mentions (deduped — one edge per (doc, entity), NOT per occurrence). The referenced entity's page/section shows the document under "Referenced by" (backlinks populate).
3. **Given** section structure (markdown headings), where a heading or its content establishes an **owner entity** (e.g. a heading `## Epic 2: Operational Map Shell`, or a `Story N.M` / `FR###` that titles a section)
   **When** entity tokens appear within that section
   **Then** a `references` edge is emitted from the **owner entity** to each distinct entity mentioned in its section (e.g. `Epic 2 → FR26`), giving entity→entity traceability. Scope to the section to avoid a full-mesh explosion; dedupe by (from, to).
4. **Given** these new edges
   **When** the graph/spine/orphan/backlinks render
   **Then** they are **bounded and deterministic**: deduped by `(from, to, kind)`, sorted, no per-occurrence duplication, no O(N²) full-mesh; identical inputs → byte-identical output. `references` edges are visually/semantically distinct from the strong semantic edges (implements/derives-from/…) — e.g. a distinct edge style/filter value — so they add navigation without falsely claiming `implements`.
5. **Given** the existing story-centric edges (implements/derives-from/blocks/depends-on/validates/addressed-by/shipped-in)
   **When** 29.8 runs
   **Then** they are **preserved** (additive). The ma-agents rich site keeps its semantic edges AND gains `references` edges; the orphan/gap view still reports genuine gaps (a `references`-only node is still "not implemented" if it has no `implements` edge — keep the orphan logic keyed on the SEMANTIC edges, not weakened by `references`).
6. **Given** hidden files (residual from 29.7): a `.gitignore`/`.gitattributes`/dotfile at a source root
   **When** scanning
   **Then** hidden **files** are skipped too (29.7 skipped hidden dirs; extend to files) so they don't appear as `unknown` docs. (Small fold-in; keep backward-compat byte-identical for no-dotfile fixtures.)
7. **Given** the suite
   **When** `npm test` runs (Linux/CI + Windows)
   **Then** green; new tests assert: every doc has a file node; doc→entity `references` edges (deduped, backlinks symmetric); section-owner→entity edges (e.g. Epic→FR from a fixture); bounded/deterministic (byte-identical two runs); orphan logic unaffected by `references`. All prior atlas suites stay green (update edge/node-count assertions that legitimately change; do NOT weaken them). Determinism + backward-compat (no-config, story-based fixtures still meaningful) hold.

## Tasks / Subtasks

### Task 1: `references` edge kind + file nodes for all docs (AC: 1, 4) — `types.ts`, `graph/build.ts`
- [ ] 1.1 Add `'references'` to `EdgeKind` (types.ts) with a comment: weak/structural — "doc or section mentions entity"; NOT a semantic implements/derives claim.
- [ ] 1.2 `buildNodes` (build.ts): create a file-level node for EVERY scanned document (all `DocType`s), not just story/bug/retro. Node id = fileId; kind = a suitable node kind for the doc (e.g. keep story/bug/retro/epic as today; for prd/architecture/brief/report/etc. use a `document` node kind — ADD `'document'` to `NodeKind` in types.ts if needed, or map to the closest existing kind — pick one, keep it typed and consistent). Ensure this does not duplicate entity nodes (an FR node is still its own node; the doc node is separate). Preserve existing story/bug/retro file-node behavior (status, etc.) for backward-compat.

### Task 2: Reference-edge extraction (AC: 2, 3) — `extract/entities.ts` + `graph/build.ts`
- [ ] 2.1 During body extraction (entities.ts, already code-span-stripped), track **section context**: as headings are encountered, maintain the current heading path and detect a **section owner entity** when a heading text contains a single dominant entity token (`Epic N`, `Story N.M`, `FR###`, `NFR##`, `P#-#`) — that entity owns the section until the next heading of equal/higher level. Record, per file: the set of `(ownerEntityId | null, referencedEntityToken)` observations (deduped).
- [ ] 2.2 `buildEdges` (build.ts): from those observations emit `references` edges: (a) **doc→entity**: from the document's file node to each distinct entity token it mentions (resolve token→node id via the existing entity-node resolution); (b) **owner→entity**: from a section's owner entity node to each distinct entity mentioned in that section (skip self-edges, skip when owner==referenced). Resolve tokens to existing node ids (the entity's definition-site node); if a referenced token has no node (undefined target), record it as `dangling` (consistent with existing edge handling) — do NOT drop silently. Dedupe all by `(from, to, kind)`; sort.
- [ ] 2.3 Keep it bounded: per (doc/owner, entity) at most ONE edge; no entity×entity full mesh. A doc referencing 105 FRs yields ≤105 doc→FR edges (fine), not 105² .

### Task 3: Preserve semantics + orphan integrity (AC: 5) — `graph/build.ts`, `render/orphan.ts`
- [ ] 3.1 All existing semantic edge derivation stays. `references` is purely additive.
- [ ] 3.2 Orphan/gap view (orphan.ts): its "requirement with no implementing story", "story with no requirement", "bug with no root-cause", "epic with no retro" computations must remain keyed on the SEMANTIC edges (implements/derives-from/validates/addressed-by), NOT on `references` — otherwise a merely-referenced FR would look "implemented" and hide a real gap. Verify/adjust so `references` edges don't mask gaps. (Dangling-reference listing may still include `references`-dangling if useful, but the core gap categories stay semantic.)

### Task 4: Rendering surfaces (AC: 4) — graph.ts, diagrams.ts, backlinks.ts, document.ts
- [ ] 4.1 Graph: `references` edges render with a distinct style (e.g. lighter/dashed) and are covered by the edge-kind filter (so users can toggle them). Node/edge counts in `__ATLAS_GRAPH__` include them.
- [ ] 4.2 Backlinks ("Referenced by"): now populate from `references` edges (edges where `to === node.id`) — this is the primary payoff. Ensure symmetric + links resolve (link-integrity).
- [ ] 4.3 Traceability spine / trees: may use `references` edges where semantic ones are absent, but keep the spine legible (don't flood). Reasonable: prefer semantic edges; fall back to `references` for connectivity.

### Task 5: Hidden-file skip (AC: 6) — `scan/scanner.ts`
- [ ] 5.1 In `walkDir`/file collection, skip files whose basename starts with `.` (e.g. `.gitignore`, `.gitattributes`, `.DS_Store`). Keep the 29.7 hidden-DIR exclusion. Re-verify the 4 no-config fixtures are still byte-identical (they have no dotfiles → no change).

### Task 6: Tests (AC: 7) — extend/add suites + fixtures
- [ ] 6.1 Extend the `rich-project` (or a new `planning-project`) fixture with a planning doc that has an `## Epic N: …` section containing `FR###` references (to exercise section-owner→FR edges) and a PRD referencing FRs across sections. Assert: every doc has a file node; doc→entity `references` edges (deduped, count = distinct entities in doc); a section-owner→entity edge (`Epic N → FRxxx`); backlinks on an FR list the referencing docs/epics; graph filter includes `references`; determinism (two runs byte-identical); orphan categories unchanged by `references` (seed a requirement with a `references` but no `implements` → still flagged as gap). Update any prior edge/node-count assertions that legitimately shift (justify each in the test comment).
- [ ] 6.2 Backward-compat: no-config, story-based fixtures still produce their semantic edges; determinism holds. Hidden-file skip test (`.gitignore` at a source root → not a doc).
- [ ] 6.3 Append any new test file to `package.json` test chain. Rebuild `atlas.cjs`; ALL atlas suites + full `npm test` green.

## Dev Notes
### Current state
- `EdgeKind` (types.ts) has only semantic kinds. `buildNodes`/`buildEdges` (build.ts): file nodes only for story/bug/retro; edges only from story/impl prose patterns (entities.ts emits per-file edges for implements/blocked-by/addressed-by/shipped-in; build.ts wires epic→story etc.). Planning docs → nodes for the FRs/Epics they DEFINE, but **no edges** connecting them → the Prophesee 0-edge result.
- entities.ts already strips code spans and tracks tokens; extend it to also track heading/section context for owner detection.
- 29.7 added multi-source scan + hidden-DIR exclusion (extend to hidden files here).

### Design intent (keep it bounded + honest)
- `references` = "mentioned in the same document/section" — a NAVIGATION aid + backlink source, explicitly weaker than `implements`/`derives-from`. Do not relabel it as a semantic claim. Keep gap-detection on semantic edges.
- Determinism: dedupe (from,to,kind), sort; per-distinct-pair (never per-occurrence); no full mesh. Section-owner scoping keeps entity↔entity edges meaningful and bounded.
- This is the "connections are the product" payoff for planning-heavy projects — verify on Prophesee: after this, edges > 0, FR26 shows many backlinks, the graph connects.

### Invariants (do NOT regress)
- Backward-compat: no-config + story fixtures keep semantic edges; determinism byte-identical; sealed/offline; discovery↔rendering seam; link-integrity (all new edges' endpoints resolve to real pages or are marked dangling/non-clickable). Windows/CRLF gotcha; no pollution staged; rebuild+commit dist/atlas.cjs (drift test).

### Files expected
```
lib/knowledge-atlas/src/types.ts            (EdgeKind += references; NodeKind += document if used)
lib/knowledge-atlas/src/extract/entities.ts (section-owner + reference observations)
lib/knowledge-atlas/src/graph/build.ts      (file nodes for all docs; references edges)
lib/knowledge-atlas/src/render/{graph,diagrams,backlinks,document,orphan}.ts (surface references; keep orphan semantic)
lib/knowledge-atlas/src/scan/scanner.ts     (skip hidden files)
lib/knowledge-atlas/dist/atlas.cjs          (rebuild)
test/… + fixtures                            (new/updated)
package.json                                 (test chain if new file)
```

### References
- Real project: `D:/Code/Prophesys` (`prophesee-knowledge/planning/prd.md`, `architecture.md`). Epic 29 P5-7 ("connections are the product"; FR221 typed graph, FR223 backlinks, FR224 traceability). Story 29.2 edge model (build.ts/entities.ts). Story 29.7 scan.

## Dev Agent Record
### Agent Model Used
_to be filled by dev agent_
### Completion Notes List
### File List
