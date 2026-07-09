/**
 * lib/knowledge-atlas/src/index.ts
 * ---------------------------------------------------------------------------
 * Story 29.1 — Public API re-exports for the Knowledge Atlas engine.
 *
 * Consumers that import the engine as a library (rather than invoking the CLI)
 * use this entry point.
 */

export { generate } from './generate';
export type { GenerateOptions, GenerateResult, KnowledgeManifest } from './types';
