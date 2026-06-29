"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// lib/knowledge-atlas/src/cli.ts
var path2 = __toESM(require("path"));

// lib/knowledge-atlas/src/generate.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var MAX_TIME_VALUE_MS = 864e13;
function resolveTimestamp(now) {
  if (now !== void 0 && now !== null) {
    let d;
    if (now instanceof Date) {
      d = now;
    } else if (typeof now === "number") {
      d = new Date(now * 1e3);
    } else if (/^\d+$/.test(now.trim())) {
      d = new Date(parseInt(now.trim(), 10) * 1e3);
    } else {
      d = new Date(now);
    }
    if (!isValidDate(d)) {
      throw new Error(
        `generate: invalid \`now\` value: ${JSON.stringify(now)} \u2014 provide a Date, an ISO-8601 string, or Unix seconds.`
      );
    }
    return isoSecond(d);
  }
  const epoch = process.env["SOURCE_DATE_EPOCH"];
  if (epoch) {
    const secs = parseInt(epoch, 10);
    if (!isNaN(secs) && secs >= 0 && secs * 1e3 <= MAX_TIME_VALUE_MS) {
      const d = new Date(secs * 1e3);
      if (isValidDate(d)) {
        return isoSecond(d);
      }
    }
  }
  return isoSecond(/* @__PURE__ */ new Date());
}
function isValidDate(d) {
  return d instanceof Date && !isNaN(d.getTime());
}
function isoSecond(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}
function deriveProjectTitle(projectRoot) {
  const pkgPath = path.join(projectRoot, "package.json");
  try {
    if (fs.existsSync(pkgPath)) {
      const raw = fs.readFileSync(pkgPath, "utf-8");
      const pkg = JSON.parse(raw);
      if (typeof pkg["name"] === "string" && pkg["name"].trim()) {
        return pkg["name"].trim();
      }
    }
  } catch {
  }
  const base = path.basename(projectRoot).trim();
  return base.length > 0 ? base : "Unknown Project";
}
function buildManifest(projectRoot, bmadOutputDir, generatedAt) {
  return {
    projectTitle: deriveProjectTitle(projectRoot),
    generatedAt,
    projectRoot,
    bmadOutputDir
  };
}
var CSS = `/* Knowledge Atlas \u2014 design system tokens (Story 29.1 seed) */
:root {
  --ink:         #1a1a2e;
  --paper:       #f8f9fb;
  --surface:     #ffffff;
  --surface-alt: #f1f4f8;
  --ok:          #2e7d32;
  --warn:        #e65100;
  --gap:         1rem;
  --ink-wash:    #5c6a7a;
  --accent:      #00897b;
  --accent-dk:   #00695c;
  --border:      #d0d9e4;
  --radius:      6px;
  --font:        system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font);
  background: var(--paper);
  color: var(--ink);
  line-height: 1.6;
  padding: var(--gap);
}

header {
  background: var(--accent);
  color: #fff;
  padding: calc(var(--gap) * 1.5) calc(var(--gap) * 2);
  border-radius: var(--radius);
  margin-bottom: calc(var(--gap) * 1.5);
}

header h1 {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

header .subtitle {
  font-size: 0.9rem;
  opacity: 0.85;
  margin-top: 0.25rem;
}

main {
  max-width: 900px;
  margin: 0 auto;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: calc(var(--gap) * 1.25);
  margin-bottom: var(--gap);
}

.card h2 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--accent-dk);
  margin-bottom: 0.5rem;
}

.meta {
  font-size: 0.85rem;
  color: var(--ink-wash);
}

footer {
  margin-top: calc(var(--gap) * 2);
  font-size: 0.8rem;
  color: var(--ink-wash);
  text-align: center;
  border-top: 1px solid var(--border);
  padding-top: var(--gap);
}
`;
function renderHtml(manifest) {
  const { projectTitle, generatedAt } = manifest;
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const title = esc(projectTitle);
  const lines = [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${title} \u2014 Knowledge Atlas</title>`,
    `<meta name="description" content="Knowledge Atlas for ${title}">`,
    "<style>",
    CSS.trimEnd(),
    "</style>",
    "</head>",
    "<body>",
    "<header>",
    `<h1>${title}</h1>`,
    `<p class="subtitle">Knowledge Atlas</p>`,
    "</header>",
    "<main>",
    '<div class="card">',
    "<h2>Project</h2>",
    `<p class="meta">Title: ${title}</p>`,
    "</div>",
    '<div class="card">',
    "<h2>Generation</h2>",
    `<p class="meta">Generated at: ${esc(generatedAt)}</p>`,
    "</div>",
    "</main>",
    "<footer>",
    `Knowledge Atlas &bull; generated at ${esc(generatedAt)}`,
    "</footer>",
    "</body>",
    "</html>",
    ""
    // trailing newline
  ];
  return lines.join("\n");
}
function generate(opts) {
  const { projectRoot, outDir: outDirOverride } = opts;
  if (!projectRoot || typeof projectRoot !== "string") {
    throw new Error("generate: projectRoot is required and must be a non-empty string");
  }
  if (!path.isAbsolute(projectRoot)) {
    throw new Error(`generate: projectRoot must be an absolute path (got: ${projectRoot})`);
  }
  const rootStat = fs.statSync(projectRoot, { throwIfNoEntry: false });
  if (!rootStat || !rootStat.isDirectory()) {
    throw new Error(`generate: projectRoot does not exist or is not a directory: ${projectRoot}`);
  }
  const bmadOutputDir = path.join(projectRoot, "_bmad-output");
  const outDir = outDirOverride ?? path.join(bmadOutputDir, "knowledge-site");
  const rel = path.relative(projectRoot, outDir);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`generate: outDir escapes projectRoot: ${outDir}`);
  }
  const generatedAt = resolveTimestamp(opts.now);
  const manifest = buildManifest(projectRoot, bmadOutputDir, generatedAt);
  const html = renderHtml(manifest);
  fs.mkdirSync(outDir, { recursive: true });
  const indexPath = path.join(outDir, "index.html");
  fs.writeFileSync(indexPath, html.replace(/\r\n/g, "\n"), { encoding: "utf-8" });
  return {
    outDir,
    indexPath,
    fileCount: 1
  };
}

// lib/knowledge-atlas/src/cli.ts
function usage() {
  process.stderr.write(
    "Usage: node atlas.cjs <projectRoot> [--out <outDir>]\n"
  );
}
function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    usage();
    process.exit(args.length === 0 ? 1 : 0);
  }
  const projectRoot = path2.resolve(args[0]);
  let outDir;
  const outIdx = args.indexOf("--out");
  if (outIdx !== -1) {
    if (outIdx + 1 >= args.length) {
      process.stderr.write("[atlas] ERROR: --out requires a directory argument\n");
      process.exit(1);
    }
    outDir = path2.resolve(args[outIdx + 1]);
  }
  try {
    const result = generate({ projectRoot, outDir });
    process.stdout.write(result.indexPath + "\n");
    process.stderr.write(`[atlas] generated: ${result.indexPath}
`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[atlas] ERROR: ${msg}
`);
    process.exit(1);
  }
}
main();
