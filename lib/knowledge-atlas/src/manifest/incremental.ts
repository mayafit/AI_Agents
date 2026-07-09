/**
 * lib/knowledge-atlas/src/manifest/incremental.ts
 * ---------------------------------------------------------------------------
 * Story 29.2 — Incremental manifest rebuild.
 *
 * Change detection is by content hash (CRLF-normalized SHA-256), not mtime.
 * mtime is used ONLY as a cheap pre-filter — never as identity.
 *
 * Incremental strategy:
 *   1. Build the new file list with hashes (from scanner).
 *   2. For files with same path+hash as the prior manifest: reuse prior FileRecord.
 *   3. For added/changed files: re-extract.
 *   4. For removed files (in prior but not in new scan): drop.
 *   5. Detect renames (same contentHash, different path): treat as changed (new path).
 *
 * Invariant: incremental ≡ full (byte-identical manifest for same inputs).
 *
 * This module does NOT perform extraction itself — it provides the decision
 * logic (which files to reuse, which to reprocess). The caller orchestrates.
 */

import { FileRecord } from '../types.js';

/** A scanned file's identity for incremental comparison. */
export interface ScannedFileInfo {
  fileId: string;
  contentHash: string;
}

/** Result of incremental diff analysis. */
export interface IncrementalDiff {
  /** Files that can be reused from the prior manifest (same path + hash). */
  unchanged: FileRecord[];
  /** File-ids that must be re-extracted (new or changed content). */
  toReprocess: string[];
  /** File-ids that were in the prior manifest but are no longer on disk (removed). */
  removed: string[];
  /**
   * Rename detections: maps new fileId → old fileId (same hash, different path).
   * The new fileId will be in `toReprocess` (since it needs fresh extraction at
   * the new path). The old fileId will be in `removed`.
   */
  renames: Map<string, string>;
}

/**
 * Compute the incremental diff between the prior manifest's file records and
 * the current scan result.
 *
 * @param priorRecords  FileRecords from the prior manifest (or [] for a fresh build).
 * @param currentScan   Current scanned files (fileId + contentHash).
 * @returns IncrementalDiff describing what changed.
 */
export function computeDiff(
  priorRecords: FileRecord[],
  currentScan: ScannedFileInfo[],
): IncrementalDiff {
  // Build lookup maps
  const priorByPath = new Map<string, FileRecord>();
  // For rename detection, keep a LIST of prior records per hash (item 18) so two
  // same-content files that both rename are each matched to a distinct prior
  // record rather than both colliding on the first one.
  const priorByHash = new Map<string, FileRecord[]>();

  for (const rec of priorRecords) {
    priorByPath.set(rec.path, rec);
    let arr = priorByHash.get(rec.contentHash);
    if (!arr) { arr = []; priorByHash.set(rec.contentHash, arr); }
    arr.push(rec);
  }

  const currentByPath = new Map<string, ScannedFileInfo>();
  for (const f of currentScan) {
    currentByPath.set(f.fileId, f);
  }

  const unchanged: FileRecord[] = [];
  const toReprocess: string[] = [];
  const renames = new Map<string, string>();
  // Track prior paths already claimed as a rename source so two same-hash
  // renames don't both claim the same old path.
  const claimedRenameSources = new Set<string>();

  // Classify each current file (iterate in sorted order for deterministic
  // rename pairing when multiple same-hash candidates exist).
  const sortedCurrent = [...currentScan].sort((a, b) =>
    a.fileId < b.fileId ? -1 : a.fileId > b.fileId ? 1 : 0);

  for (const curr of sortedCurrent) {
    const prior = priorByPath.get(curr.fileId);

    if (prior && prior.contentHash === curr.contentHash) {
      // Same path, same hash → unchanged
      unchanged.push(prior);
    } else if (prior) {
      // Same path, different hash → changed
      toReprocess.push(curr.fileId);
    } else {
      // New path → check for rename: a prior record with the same hash whose
      // path is GONE from the current scan and not already claimed.
      const candidates = priorByHash.get(curr.contentHash) ?? [];
      const match = candidates.find(c =>
        !currentByPath.has(c.path) && !claimedRenameSources.has(c.path));
      if (match) {
        renames.set(curr.fileId, match.path);
        claimedRenameSources.add(match.path);
      }
      // Either way, the new path must be (re)processed
      toReprocess.push(curr.fileId);
    }
  }

  // Find removed files (in prior but no longer in current scan)
  const removed: string[] = [];
  for (const rec of priorRecords) {
    if (!currentByPath.has(rec.path)) {
      removed.push(rec.path);
    }
  }

  return { unchanged, toReprocess, removed, renames };
}

/**
 * Merge the reused (unchanged) records with freshly extracted records,
 * filtering out removed paths. Returns a sorted FileRecord array.
 *
 * @param unchanged   Records reused from prior manifest.
 * @param reprocessed Freshly extracted records for changed/added files.
 * @param removed     File-ids to exclude (no longer exist on disk).
 * @returns Sorted merged FileRecord array (sorted by path, POSIX).
 */
export function mergeRecords(
  unchanged: FileRecord[],
  reprocessed: FileRecord[],
  removed: string[],
): FileRecord[] {
  const removedSet = new Set(removed);
  const merged: FileRecord[] = [
    ...unchanged.filter(r => !removedSet.has(r.path)),
    ...reprocessed,
  ];
  // Sort by path for determinism
  merged.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return merged;
}
