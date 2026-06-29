/**
 * lib/knowledge-atlas/src/types.ts
 * ---------------------------------------------------------------------------
 * Story 29.1 — Shared type definitions for the Knowledge Atlas engine.
 *
 * Architecture invariant (Decision P5-7):
 *   Keep the discovery half (scan → manifest) and the rendering half
 *   (manifest → HTML) cleanly separable. The KnowledgeManifest is the
 *   contract between them. Story 29.1 seeds a stub; Story 29.2 fills the
 *   discovery fields. Later stories add sections without touching this
 *   seam as long as they extend (not replace) KnowledgeManifest.
 */

// ---------------------------------------------------------------------------
// Core options passed into generate()
// ---------------------------------------------------------------------------

/**
 * Options for the `generate()` function.
 *
 * - `projectRoot`  — absolute path to the consuming project root. Required.
 * - `outDir`       — override the default output directory
 *                    (`<projectRoot>/_bmad-output/knowledge-site`).
 * - `now`          — override the "generated at" timestamp for determinism.
 *                    Accept a Date, an ISO-8601 string, or a Unix-seconds
 *                    number (same domain as SOURCE_DATE_EPOCH).
 *
 * Determinism contract (NFR62):
 *   Identical inputs + pinned SOURCE_DATE_EPOCH ⇒ byte-identical output.
 *   Resolution order: opts.now > process.env.SOURCE_DATE_EPOCH > current time.
 *   Every later story must honor this chain.
 */
export interface GenerateOptions {
  projectRoot: string;
  outDir?: string;
  now?: Date | string | number;
}

// ---------------------------------------------------------------------------
// Result returned by generate()
// ---------------------------------------------------------------------------

export interface GenerateResult {
  /** Absolute path to the output directory (<projectRoot>/_bmad-output/knowledge-site). */
  outDir: string;
  /** Absolute path to the generated index.html. */
  indexPath: string;
  /** Number of files written (currently 1: index.html). */
  fileCount: number;
}

// ---------------------------------------------------------------------------
// KnowledgeManifest — the discovery ↔ rendering contract
//
// Story 29.1 keeps this minimal (stub). Story 29.2 adds scan-derived fields.
// Renderers in 29.3+ consume this manifest; they must never reach back into
// the filesystem themselves — all discovery is done before rendering begins.
// ---------------------------------------------------------------------------

/**
 * A stub manifest produced by the discovery phase and consumed by renderers.
 * Fields added by 29.2+ are annotated in their respective stories.
 */
export interface KnowledgeManifest {
  /** Human-readable project title (derived from package.json or folder name). */
  projectTitle: string;

  /**
   * ISO-8601 generation timestamp.
   * Pinned via opts.now / SOURCE_DATE_EPOCH for deterministic output.
   */
  generatedAt: string;

  /** Absolute path to the project root (used by renderers that write assets). */
  projectRoot: string;

  /** Absolute path to _bmad-output within the project. */
  bmadOutputDir: string;

  // Story 29.2 will add:
  //   planningArtifacts: PlanningArtifact[];
  //   implementationArtifacts: ImplementationArtifact[];
  //   sprintStatus: SprintStatusSummary | null;
  //   etc.
}
