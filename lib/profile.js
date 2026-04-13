'use strict';

/**
 * Story 21.1 — Install-time profile persistence and resolution.
 *
 * Public API (exactly three functions):
 *   getProfile(projectRoot)                        -> "on-prem" | "standard" | undefined
 *   setProfile(projectRoot, value)                 -> void (persists to .ma-agents.json)
 *   resolveProfile({ flag, persisted, yesMode })   -> resolved value | null (pure, no I/O)
 *
 * NFR44: setProfile is the ONLY mutator of the "profile" field.
 * Back-compat: manifests at 1.1.0 without "profile" are read without error;
 *              getProfile returns undefined for missing field.
 */

const fs = require('fs');
const path = require('path');

const MANIFEST_FILE = '.ma-agents.json';
const VALID_PROFILES = ['on-prem', 'standard'];

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
    // Bootstrap via the standard schema (mirrors lib/installer.js ensureManifest shape).
    // Require lazily to avoid potential circular-import pitfalls at module load.
    const { ensureManifest } = require('./installer');
    manifest = ensureManifest(projectRoot, null, 'project');
  }

  manifest.profile = value;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

/**
 * Pure resolver — performs NO I/O.
 * Precedence: flag > persisted > (yesMode ? 'standard' : null).
 * Returns null when nothing is set and yesMode is false (caller must prompt).
 */
function resolveProfile({ flag, persisted, yesMode } = {}) {
  if (flag) return flag;
  if (persisted) return persisted;
  if (yesMode === true) return 'standard';
  return null;
}

module.exports = { getProfile, setProfile, resolveProfile };
