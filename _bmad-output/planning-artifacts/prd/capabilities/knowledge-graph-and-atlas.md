# Knowledge Graph & Knowledge Atlas

> **Shard** of the [PRD index](../../prd.md). Content is verbatim from the
> pre-split document; the index carries the front matter, registers and reading order.
>
> Capability F17, both tiers: the any-to-any knowledge graph and the Knowledge
> Atlas static-site visualization. Architecture: P3-1, P5-7.

---

## Functional Requirements

### BMAD Knowledge Graph

#### Graph Data Model

- FR141: Every addressable heading anchor in any registered document is a graph node. Node identity uses `file-id#heading-anchor` syntax, where `file-id` is a short identifier defined in the graph's `files` table (e.g., `prd#fr24`). The `files` table maps each `file-id` to a file pointer — which may be a relative path, absolute path, URL (e.g., Confluence page), or any other document reference. Nodes require no manual creation — they are derived from document structure at emit time and registered against the files table
- FR142: Each graph edge is a directed typed relationship from a source node to a target node. Edges are not constrained to hierarchical parent-child relationships — any node may reference any other node regardless of document type or position in the artifact chain. Edge fields: `from` (source node id), `to` (target node id), `type` (one of: `implements`, `derives-from`, `validates`, `traces-to`, `refines`, `informed-by`), `label` (optional human-readable description), `created_by` (user name from BMAD config), `agent` (AI agent identifier — e.g., `claude-code`, `cursor`, `copilot`), `created_at` (ISO 8601 timestamp). No edge field may be null except `label`
- FR143: The graph maintains a bidirectional index: for every node, both its outbound edges (what it references) and inbound backlinks (what references it) are queryable — enabling "what influenced this AC?" and "what was derived from this architecture decision?" without scanning all edges. A single node may have inbound edges from multiple unrelated documents simultaneously

#### JSON Format

- FR144: The knowledge graph is stored as a single JSON file at `_bmad-output/knowledge-graph.json`. The top-level structure is `{ "meta": {...}, "files": {...}, "nodes": [...], "edges": [...] }` — flat, no nesting beyond two levels, using string keys throughout. This structure is optimized for LLM read/write: any model can register a file, add a node, or add an edge by appending to the appropriate section without parsing complex schemas
- FR145: The `files` table is a JSON object mapping short file IDs to file pointer objects: `{ "prd": { "pointer": "_bmad-output/planning-artifacts/prd.md", "title": "PRD", "pointer_type": "relative_path" }, "arch": { "pointer": "_bmad-output/planning-artifacts/architecture.md", "title": "Architecture", "pointer_type": "relative_path" }, "ux-conf": { "pointer": "https://confluence.example.com/page/456", "title": "UX Design", "pointer_type": "url" } }`. `pointer_type` is one of: `relative_path`, `absolute_path`, `url`. This decouples node identity from file location — files can live anywhere
- FR146: Each node object: `{ "id": "file-id#anchor", "file": "file-id", "anchor": "anchor", "title": "Human readable heading text", "type": "requirement|architecture|epic|story|design|test" }`
- FR147: Each edge object: `{ "id": "unique-edge-id", "from": "file-id#anchor", "to": "file-id#anchor", "type": "implements|derives-from|validates|traces-to|refines|informed-by", "label": "optional", "created_by": "name", "agent": "agent-id", "created_at": "ISO8601" }`
- FR148: The `meta` object carries: `{ "schema_version": "1.0", "project": "project-name", "generated": "ISO8601", "last_updated": "ISO8601", "node_count": N, "edge_count": N, "file_count": N }`. All counts are updated on every write — enabling quick integrity checks without parsing the full arrays

#### Automatic Skill Emission

- FR149: BMAD skills that generate or update planning artifacts (create-prd, create-architecture, create-epics-and-stories, create-story, dev-story, bmad-create-ux-design) automatically append nodes and edges to `knowledge-graph.json` upon artifact completion — no user prompt required. If the file does not exist, the skill creates it with the correct schema
- FR150: Before emitting nodes, the skill registers the source document in the `files` table if not already present — assigning a short file ID and recording the pointer and pointer type. Skills may emit edges referencing any previously registered file, not only files in the project repository. This allows a story skill to reference a Confluence UX spec or an external architecture document as an edge target, as long as that file has been registered in the `files` table
- FR151: When a skill emits edges, it resolves source and target nodes from all artifacts that influenced the output — not only the direct parent in the artifact hierarchy. A story skill may emit `derives-from` edges to the epic, `informed-by` edges to architecture sections, and `informed-by` edges to UX design nodes simultaneously. Edge types are determined by the nature of the influence: architecture sections addressing PRD requirements emit `implements`; epics breaking down PRD features emit `derives-from`; stories implementing epics emit `traces-to`; external documents that shaped a decision emit `informed-by`; validation workflows emit `validates`
- FR152: Skills never create duplicate nodes or files entries. Before appending, the skill checks if a node with the same `id` already exists — if so, updates `title` only and skips insertion. Before appending an edge, the skill checks for an existing edge with matching `from`, `to`, and `type` — if found, updates `created_at` and `agent` only. Before adding a file, the skill checks if a file-id already exists — if so, updates `pointer` and `title` only

#### Visualization & Navigation

- FR153: The `open-graph` skill generates or refreshes `_bmad-output/knowledge-graph.html` from `knowledge-graph.json` and opens it. When a VSCode environment is detected, the skill opens the file inside the editor. In non-VSCode environments, the skill opens the file in the system default browser
- FR154: The rendered graph is an interactive visualization. Nodes are labeled with their `title`. Edge direction is shown with arrowheads. Node color encodes `type` (requirement, architecture, epic, story, design, test — 6 distinct colors with a legend). Clicking a node navigates to the source document at the exact heading anchor — using VSCode's native document navigation when available, or displaying a copyable document link otherwise. For nodes whose `files` entry has `pointer_type: url`, clicking opens the URL in the browser
- FR155: Hovering over an edge displays a tooltip showing: edge `type`, `label` (if set), `created_by`, `agent`, and `created_at` — full provenance visible without leaving the graph
- FR156: The graph supports filtering by node type and edge type via interactive controls in the visualization panel. Selecting a node highlights all its direct neighbors and their connecting edges, dimming everything else — isolating all influences on any artifact regardless of which documents they come from
- FR157: The `knowledge-graph.html` renderer functions without network access and without a local server — no external CDN, font, or script dependencies

#### Knowledge Atlas — Static Knowledge Site (Visualization Tier)

The Knowledge Atlas is the human-facing visualization tier of the Knowledge Graph: a scan-first, self-contained static knowledge *site* over all BMAD artifacts, generated on demand and pre-bundled in ma-agents. v1 is a deterministic core; model-assisted enrichment, auto-refresh hooks, Confluence output, timeline/diff views, and an agent-facing query API are explicitly deferred (see Future Directions).

- FR215: A `bmad-knowledge` skill, runnable at any point in any ma-agents + BMAD project, scans the project's `_bmad-output`, builds a knowledge manifest, and generates and opens a self-contained static knowledge site spanning all BMAD artifacts
- FR216: The site is produced by an authoritative full scan of on-disk artifacts — it reflects all knowledge regardless of how it arrived (pre-existing/brownfield content, knowledge created before the Atlas was installed, content introduced by a version upgrade, or edits made outside any BMAD skill). Correctness never depends on an event hook having fired
- FR217: The generator discovers all BMAD document types under `_bmad-output` — planning artifacts (product brief, PRD, architecture, epics), implementation artifacts (stories, bugs, retrospectives, sprint-status), project-context, and phase/stage reports — and tolerates missing document types without failing
- FR218: The generator deterministically extracts the BMAD entity vocabulary — `FR###`, `NFR##`, `F##` (capability areas), `Epic N`, `Story N.M` (and `NN-M-slug` story files), `bug-<slug>`, `P#-#` (architecture decisions), retrospectives, and lifecycle statuses — from both document frontmatter and body text
- FR219: Every occurrence of an entity token, anywhere in any document, is rendered as a hyperlink to that entity's canonical location
- FR220: Each entity displays its backlinks ("referenced by") — every location across all documents that references it — computed for every entity
- FR221: The generator builds a typed knowledge graph: nodes typed by entity kind (capability, requirement, non-functional requirement, epic, story, bug, architecture decision, retrospective) and edges typed by relationship (implements, derives-from/refines, blocks/depends-on, validates, addressed-by, shipped-in). Node identity uses the Knowledge Graph's `file-id#anchor` scheme (FR141, FR146), so the Atlas manifest is a superset of `knowledge-graph.json`
- FR222: An interactive force-directed graph is the site's primary navigation surface — distinct node shape/color per type with a legend, directional edges, zoom from whole-project scope down to a single entity's neighborhood, click-to-navigate to the source location, and filtering by node type and edge type
- FR223: Document reading views render each artifact with smooth scrolling, a table of contents, entity status badges, and rendered Mermaid diagrams
- FR224: Where artifacts contain no authored diagrams, the generator auto-produces them — the FR→Epic→Story→Bug→Retrospective traceability spine, epic→story trees, and a sprint/status board
- FR225: An orphan/gap view surfaces disconnected knowledge — requirements with no implementing story, stories with no requirement, bugs with no root-cause link, and epics with no retrospective
- FR226: A project knowledge home page summarizes the project with entry points and a health snapshot (entity counts, statuses, orphan counts)
- FR227: The site provides full-text search across all knowledge that functions offline
- FR228: The generator persists a knowledge manifest (per file: content hash, type, entities, edges) that drives incremental rebuilds — on re-run only added, changed, or removed files (detected by content-hash diff) are reprocessed, and deletions and renames are reconciled against the prior manifest
- FR229: The generated site is self-contained and viewable with no server and no network access — opened directly as a static file, with the graph renderer, diagram renderer, search index, and graph data all embedded locally (graph data embedded, not fetched)
- FR230: The Atlas engine ships pre-bundled within ma-agents (built at release time) and runs with no per-project dependency installation, including in fully air-gapped environments
- FR231: Generation is non-destructive — source artifacts are never modified, and all output is written to a dedicated, git-ignorable output folder (e.g., `_bmad-output/knowledge-site/`)
- FR232: When `knowledge-graph.json` is present, the Atlas reconciles with it on the shared `file-id#anchor` node identity rather than producing a divergent model; when it is absent, the scan produces an equivalent manifest — keeping a single knowledge-graph model across the Knowledge Graph and Atlas tiers
- FR233: The Atlas renders through a curated, professional design system — a consistent typography scale, semantic color tokens (including status colors for implemented/partial/gap), a uniform spacing rhythm, and a reusable component set (cards, status pills/badges, data tables, syntax-highlighted code blocks, callouts, section eyebrows). The quality bar is a hand-authored analyst report, not a default markdown render
- FR234: The Atlas degrades gracefully (progressive enhancement) — the curated reading and structural views (home, document pages, traceability spine, epic→story trees, sprint/status board, matrices) remain fully legible and navigable as static HTML/CSS even when interactive components (e.g., the force-directed graph) are unavailable or fail to initialize; the site never presents a blank screen due to a missing or failed script

## Quality Attributes (Non-Functional Requirements)

### BMAD Knowledge Graph

- NFR38: The `open-graph` skill shall render a graph of up to 500 nodes and 1000 edges in under 3 seconds from file load to interactive display — measured from skill invocation to first interactive frame in the renderer
- NFR39: `knowledge-graph.json` must remain parseable and writable by any LLM without schema documentation. Validated by requiring that a model with no prior knowledge of the format can correctly register a file, add a node, and add an edge given only the existing file content as context — no external schema reference required
- NFR40: Skill emission of files, nodes, and edges must be additive-only — skills never delete or overwrite existing entries, only append or update non-provenance fields. Existing provenance data (creator, agent, date) on an edge is never modified by subsequent runs
- NFR41: The `knowledge-graph.html` renderer must function in air-gapped environments with no network access and without a local server — verified by loading the file with network access blocked and confirming full interactive functionality

#### Knowledge Atlas

- NFR60: Knowledge Atlas generation and viewing must function end-to-end in air-gapped environments — no network, CDN, font, or script fetch at generate-time or view-time, and graph data embedded rather than fetched so the site functions under a `file://` origin. Verified by generating and viewing with network access blocked
- NFR61: The Atlas requires no per-project dependency installation — the engine is pre-bundled in the ma-agents package and generates a site on a fresh project checkout with no `npm install` (or equivalent) in the consuming project
- NFR62: Atlas generation is non-destructive and isolated — it never writes outside its dedicated output folder and never mutates source artifacts; the output folder is git-ignorable by default
- NFR63: A full Atlas build of a typical project (hundreds of entities) completes in seconds, and re-run cost scales with the number of changed files rather than total project size (incremental rebuild via the manifest content-hash diff)
- NFR64: Atlas generation is cross-platform, including correct Windows path handling and CRLF safety, and produces deterministic output across platforms on unchanged inputs
- NFR65: The Atlas degrades gracefully against document-format drift — unknown, malformed, or missing document types are skipped with a surfaced note and never crash generation
- NFR66: Atlas output is safe — rendered HTML is sanitized, no document content is executed, and the static site exposes no server-side surface
- NFR67: Sealed offline packaging (end to end) — the Atlas engine AND every dependency it needs to generate and to view a site (graph renderer, diagram renderer, search, markdown/parse libraries, build/bundling tooling, and any fonts/icons/styles) ship inside the ma-agents distribution as pre-built or vendored assets. Installing ma-agents and generating/viewing an Atlas on a fully disconnected on-prem network must require no access to npm, git, a CDN, or any other external host. Re-asserts and extends the air-gapped self-containment guarantee (NFR2/NFR50/NFR54/NFR57/NFR60/NFR61) and is verified by the existing offline-install gate extended to exercise Atlas generation and viewing with all egress blocked
- NFR68: Visual-quality and accessibility bar — generated output uses a coherent typography/color/spacing design system, is responsive down to mobile widths, uses a system font stack (no web-font fetch), exposes semantic landmarks and ARIA labels on generated diagrams, and honors `prefers-reduced-motion`. The reference quality bar is a hand-authored analyst report
- NFR69: Zero-dependency-first footprint — curated views (home/health, reading, traceability spine, epic→story trees, sprint/status board, matrices) are rendered as self-contained HTML/CSS/SVG with no runtime JavaScript library; heavier bundled libraries (interactive force-graph, Mermaid for authored diagrams) are included only where interactivity or authored-diagram rendering genuinely requires them — minimizing the air-gapped footprint and maximizing baseline render quality
