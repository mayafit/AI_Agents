'use strict';

/**
 * Preloaded into the bmad-method child process (`node --require`, via
 * NODE_OPTIONS — see buildChildSpawnEnv in lib/bmad.js) to make its
 * recursive deletes survive transient Windows file locks.
 *
 * Why this exists: right after copying skills into the IDE directories,
 * bmad-method deletes the `_bmad/<module>/<skill>` copies
 * (`Installer._cleanupSkillDirs`, via fs-extra `remove` → `fs.rm`). On
 * Windows a just-written directory is routinely held for a moment by
 * Defender real-time scanning, the Search indexer or an editor's file
 * watcher, and `fs.rm` fails at once with EBUSY — aborting the whole
 * install ("EBUSY: resource busy or locked, rmdir
 * '...\_bmad\ma-skills\ma-agent-sqa'"). Node's `fs.rm` already retries
 * EBUSY/EPERM/ENOTEMPTY/EMFILE/ENFILE with a linear backoff, but only when
 * asked: `maxRetries` defaults to 0.
 *
 * This fills in `maxRetries`/`retryDelay` for recursive `rm` calls that did
 * not set them, leaving every other call untouched. It must load before
 * anything captures `fs.rm` — graceful-fs (used by fs-extra) clones the fs
 * module when first required — which `--require` guarantees.
 */

const fs = require('fs');

// Linear backoff: waits 100, 200, … 1500 ms — about 12 s in total before
// the original error is surfaced. Transient scanner/watcher locks clear in
// well under a second; a lock that outlives this is a real one.
const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 100;

/**
 * Return `options` with the retry defaults added when the call is a
 * recursive rm that did not choose its own retry policy.
 *
 * @param {object|undefined} options - Options passed to fs.rm / rmSync
 * @returns {object|undefined} Options to forward
 */
function withRetries(options) {
    if (!options || typeof options !== 'object' || !options.recursive) return options;
    if (options.maxRetries !== undefined) return options;
    return { ...options, maxRetries: MAX_RETRIES, retryDelay: options.retryDelay ?? RETRY_DELAY_MS };
}

// Each wrapper is installed only when the function exists, so an older Node
// without fs.rm is left exactly as it was.
if (typeof fs.rm === 'function') {
    const originalRm = fs.rm;
    fs.rm = function rm(target, options, callback) {
        if (typeof options === 'function') return originalRm.call(this, target, options);
        return originalRm.call(this, target, withRetries(options), callback);
    };
}

if (typeof fs.rmSync === 'function') {
    const originalRmSync = fs.rmSync;
    fs.rmSync = function rmSync(target, options) {
        return originalRmSync.call(this, target, withRetries(options));
    };
}

if (fs.promises && typeof fs.promises.rm === 'function') {
    const originalPromisesRm = fs.promises.rm;
    fs.promises.rm = function rm(target, options) {
        return originalPromisesRm.call(this, target, withRetries(options));
    };
}

module.exports = { withRetries, MAX_RETRIES, RETRY_DELAY_MS };
