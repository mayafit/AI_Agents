'use strict';

/**
 * Story 21.1 — Install-time profile persistence and resolution.
 *
 * Public API (four functions):
 *   getProfile(projectRoot)                  -> "on-prem" | "standard" | undefined
 *   setProfile(projectRoot, value)           -> void (persists to .ma-agents.json)
 *   resolveProfile({ persisted, yesMode })   -> resolved value | null (pure, no I/O)
 *   clearProfile(projectRoot)               -> void (deletes the 'profile' key from .ma-agents.json)
 *
 * NFR44: setProfile is the ONLY mutator of the "profile" field.
 * Story 21.11: clearProfile is the ONLY remover of the "profile" field.
 * Back-compat: manifests at 1.1.0 without "profile" are read without error;
 *              getProfile returns undefined for missing field.
 *              setProfile migrates 1.1.0 → 1.2.0 on write (profile field is
 *              1.2.0-only; writing it onto a 1.1.0 manifest would be schema drift).
 */

const fs = require('fs');
const path = require('path');

const MANIFEST_FILE = '.ma-agents.json';
const VALID_PROFILES = ['on-prem', 'standard'];

// Bug 27.12 — the project-root .ma-agents.json is a PROFILE/settings store, not
// a skill inventory. Per-agent skills dirs (e.g. .claude/skills/.ma-agents.json)
// own the installed-skill inventory and remain the authoritative source read by
// getStatus/uninstall/reconcile. The root bootstrap therefore emits ONLY the
// fields it owns (manifestVersion + a scope discriminator) and NOT a `skills`/
// `agents` shape it would never back-fill — so the root file can no longer
// masquerade as an empty skill inventory (`skills: {}`).
const ROOT_MANIFEST_VERSION = '1.2.0';
const ROOT_SCOPE = 'project-root';

/**
 * Bootstrap a fresh PROFILE-ONLY root manifest object (not persisted here).
 * Intentionally omits `skills` and `agents`: those belong to per-agent skills
 * manifests. The `scope: 'project-root'` discriminator makes the file's role
 * explicit for any reader.
 */
function bootstrapRootManifest() {
  return {
    manifestVersion: ROOT_MANIFEST_VERSION,
    scope: ROOT_SCOPE,
  };
}

/**
 * Reads the persisted profile from .ma-agents.json at the given project root.
 * Returns undefined if the file does not exist, is malformed, or the "profile"
 * field is absent. Does NOT throw on missing file.
 */
function getProfile(projectRoot) {
  const manifestPath = path.join(projectRoot, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    return undefined;
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return undefined;
  }
  if (!manifest || typeof manifest !== 'object') return undefined;
  if (!Object.prototype.hasOwnProperty.call(manifest, 'profile')) return undefined;
  return manifest.profile;
}

/**
 * Persists the profile value into .ma-agents.json, preserving all other fields.
 * Creates the file via the standard ensureManifest bootstrap path if absent.
 * Throws an Error naming the bad value if `value` is not "on-prem" or "standard".
 *
 * Migration: If the loaded manifest is at manifestVersion 1.1.0 (or missing the
 * version field entirely), setProfile bumps it to 1.2.0 before writing, because
 * the "profile" field is 1.2.0-only. A one-time log line is emitted to stdout
 * describing the migration. Manifests already at 1.2.0 or higher are left alone.
 */
function setProfile(projectRoot, value) {
  if (!VALID_PROFILES.includes(value)) {
    throw new Error(
      `Invalid profile value: ${JSON.stringify(value)}. Expected one of: ${VALID_PROFILES.join(', ')}`
    );
  }

  const manifestPath = path.join(projectRoot, MANIFEST_FILE);

  let manifest;
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
      manifest = null;
    }
  }

  if (!manifest || typeof manifest !== 'object') {
    // Bug 27.12 — bootstrap a PROFILE-ONLY root manifest. Previously this used
    // ensureManifest(root, null, 'project'), which stamped an empty `skills: {}`
    // / `agents: []` shape the root file never owns or back-fills, making it
    // look like an (empty) skill inventory. The per-agent skills manifests are
    // the authoritative inventory; the root file stores profile/settings only.
    manifest = bootstrapRootManifest();
  }

  // Migrate 1.1.0 (or missing version) → 1.2.0, since the "profile" field is 1.2.0-only.
  // Writing it onto a 1.1.0 manifest would be schema drift. Do not downgrade manifests
  // that are already at 1.2.0 or higher.
  const currentVersion = manifest.manifestVersion;
  if (currentVersion === '1.1.0') {
    manifest.manifestVersion = '1.2.0';
    console.log('Migrated .ma-agents.json manifestVersion 1.1.0 → 1.2.0');
  } else if (!currentVersion) {
    manifest.manifestVersion = '1.2.0';
    console.log('Migrated .ma-agents.json manifestVersion (none) → 1.2.0');
  }

  manifest.profile = value;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

/**
 * Pure resolver — performs NO I/O.
 * Precedence: persisted > (yesMode ? 'standard' : null).
 * Returns null when nothing is set and yesMode is false (caller must prompt).
 */
function resolveProfile({ persisted, yesMode } = {}) {
  if (persisted) return persisted;
  if (yesMode === true) return 'standard';
  return null;
}

/**
 * Story 21.11 — Removes the 'profile' key from .ma-agents.json entirely.
 * Does NOT set to null or empty string — the key is deleted so getProfile
 * returns undefined after this call.
 * If .ma-agents.json does not exist, this is a no-op.
 * Preserves all other fields (profileHistory, roomodesOverwriteLog, etc.).
 */
function clearProfile(projectRoot) {
  const manifestPath = path.join(projectRoot, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) return;
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return;
  }
  if (!manifest || typeof manifest !== 'object') return;
  delete manifest.profile;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

/**
 * Bug 27.13 — durable BMAD-module selection.
 *
 * Reads the persisted BMAD module set from .ma-agents.json (the `bmadModules`
 * field). Returns undefined when the file is absent/malformed or the field is
 * missing, so callers can distinguish "never persisted" (→ install default set)
 * from an explicit empty selection. A persisted value is always returned as an
 * array of strings.
 */
function getBmadModules(projectRoot) {
  const manifestPath = path.join(projectRoot, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) return undefined;
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return undefined;
  }
  if (!manifest || typeof manifest !== 'object') return undefined;
  if (!Object.prototype.hasOwnProperty.call(manifest, 'bmadModules')) return undefined;
  const value = manifest.bmadModules;
  if (!Array.isArray(value)) return undefined;
  // Normalize to a clean, de-duplicated array of non-empty strings.
  return [...new Set(value.filter(m => typeof m === 'string' && m.length > 0))];
}

/**
 * Bug 27.13 — persists the selected BMAD module set into .ma-agents.json,
 * preserving all other fields. Creates the file via the standard ensureManifest
 * bootstrap path if absent (mirroring setProfile). The choice then survives
 * subsequent installs/reconfigures that do not re-pass --bmad-modules.
 *
 * @param {string} projectRoot
 * @param {string[]} modules - module ids to persist (e.g. ['bmm','tea','bmb'])
 */
function setBmadModules(projectRoot, modules) {
  if (!Array.isArray(modules)) {
    throw new Error(`setBmadModules expects an array of module ids (got ${JSON.stringify(modules)})`);
  }
  const cleaned = [...new Set(modules.filter(m => typeof m === 'string' && m.length > 0))];

  const manifestPath = path.join(projectRoot, MANIFEST_FILE);
  let manifest;
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
      manifest = null;
    }
  }
  if (!manifest || typeof manifest !== 'object') {
    // Bug 27.12 — profile-only root bootstrap (see setProfile / bootstrapRootManifest).
    manifest = bootstrapRootManifest();
  }

  manifest.bmadModules = cleaned;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

module.exports = {
  getProfile,
  setProfile,
  resolveProfile,
  clearProfile,
  getBmadModules,
  setBmadModules,
};
