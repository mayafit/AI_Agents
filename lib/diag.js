'use strict';

/**
 * Log-file-only diagnostics.
 *
 * When `--log` is active, bin/cli.js#setupLogging installs a sink that writes
 * to the log file descriptor. `diag()`/`diagError()` then emit structured
 * breadcrumbs to the LOG FILE ONLY — never to the user's console (the wizard's
 * user-facing output intentionally stays clean; e.g. a failed custom-marketplace
 * source shows a one-line message, not a raw stack — NFR71). Without a sink
 * (no `--log`), every call is a cheap no-op.
 *
 * This is how the swallowed root cause of a custom-marketplace failure (the
 * git/clone/resolve error behind a clean CustomMarketplaceError, the per-entry
 * module_definition that was missing, the FR238 zero-module trigger, etc.)
 * reaches the log for post-hoc diagnosis without leaking to the terminal.
 */

let sink = null;

/**
 * @param {((text: string) => void)|null} fn - writer for log-file output, or null to disable.
 */
function setLogSink(fn) {
  sink = typeof fn === 'function' ? fn : null;
}

/** @returns {boolean} whether diagnostics are being captured. */
function isActive() {
  return sink !== null;
}

function stamp() {
  // new Date() is available in the CLI runtime (this is not a workflow script).
  return new Date().toISOString();
}

function stringify(detail) {
  if (typeof detail === 'string') return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

/**
 * Emit one diagnostic breadcrumb to the log file (no-op without a sink).
 * @param {string} label
 * @param {*} [detail] - string or JSON-serializable value.
 */
function diag(label, detail) {
  if (!sink) return;
  let line = `[diag ${stamp()}] ${label}`;
  if (detail !== undefined) line += `: ${stringify(detail)}`;
  try {
    sink(line + '\n');
  } catch {
    /* never let diagnostics break the install */
  }
}

/**
 * Emit an error — including its `stack` AND any wrapped `cause` (message +
 * stack) — to the log file. This is the crucial bit for custom-marketplace
 * failures, whose user-facing message deliberately hides the upstream cause.
 * @param {string} label
 * @param {Error|*} err
 */
function diagError(label, err) {
  if (!sink || !err) return;
  const parts = [`[diag ${stamp()}] ${label}: ${err.message || String(err)}`];
  if (err.stack) parts.push(`  stack: ${err.stack}`);
  if (err.cause) {
    const c = err.cause;
    parts.push(`  cause: ${(c && c.message) || String(c)}`);
    if (c && c.stack) parts.push(`  cause.stack: ${c.stack}`);
  }
  try {
    sink(parts.join('\n') + '\n');
  } catch {
    /* never let diagnostics break the install */
  }
}

module.exports = { setLogSink, isActive, diag, diagError };
