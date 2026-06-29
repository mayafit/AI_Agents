/**
 * lib/knowledge-atlas/src/cli.ts
 * ---------------------------------------------------------------------------
 * Story 29.1 — CLI entrypoint for the Knowledge Atlas engine.
 *
 * Usage:
 *   node atlas.cjs <projectRoot> [--out <outDir>]
 *
 * Exit codes:
 *   0 — success (prints the index.html path to stdout)
 *   1 — any error (message on stderr)
 */

import * as path from 'path';
import { generate } from './generate';

function usage(): void {
  process.stderr.write(
    'Usage: node atlas.cjs <projectRoot> [--out <outDir>]\n'
  );
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    usage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const projectRoot = path.resolve(args[0]);

  let outDir: string | undefined;
  const outIdx = args.indexOf('--out');
  if (outIdx !== -1) {
    if (outIdx + 1 >= args.length) {
      process.stderr.write('[atlas] ERROR: --out requires a directory argument\n');
      process.exit(1);
    }
    outDir = path.resolve(args[outIdx + 1]);
  }

  try {
    const result = generate({ projectRoot, outDir });
    // Print the index path to stdout for callers to pick up
    process.stdout.write(result.indexPath + '\n');
    process.stderr.write(`[atlas] generated: ${result.indexPath}\n`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[atlas] ERROR: ${msg}\n`);
    process.exit(1);
  }
}

main();
