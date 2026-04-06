#!/usr/bin/env node
/**
 * migrate-sprint-status.js
 *
 * One-time migration utility: converts old flat `development_status` sprint-status.yaml
 * (plus optional backlog.yaml and sprints/sprint-N.yaml / sprint-plan-*.yaml files) into
 * the unified three-section schema defined in Story 17.9.
 *
 * Usage:
 *   node scripts/migrate-sprint-status.js [--artifacts-path <path>]
 *
 * Default artifacts path: _bmad-output/implementation-artifacts
 *
 * This script is a ONE-TIME utility. It lives in scripts/ (not skills/ or lib/) and is
 * NOT deployed as an agent skill. Run it once per project, then review the output.
 *
 * Story: 17.23 — Migration & Deprecation of Old File Formats
 * Schema reference: _bmad-output/planning-artifacts/sprint-status-schema.md
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs () {
  const args    = process.argv.slice(2);
  let artPath   = '_bmad-output/implementation-artifacts';
  let projectRoot = process.cwd();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--artifacts-path' && args[i + 1]) {
      artPath = args[++i];
    } else if (args[i] === '--project-root' && args[i + 1]) {
      projectRoot = args[++i];
    }
  }

  return { projectRoot, artPath: path.resolve(projectRoot, artPath) };
}

// ---------------------------------------------------------------------------
// Minimal YAML helpers — avoids requiring yaml/js-yaml dependency
// ---------------------------------------------------------------------------

/**
 * Extremely minimal YAML reader — handles only the flat key: value structure
 * used in the old development_status section and simple sprint-plan files.
 * Delegates complex parsing to a structured approach.
 *
 * For the actual sprint-status.yaml we do a line-by-line parse because the
 * file has a very predictable structure.
 */

function parseSimpleYaml (text) {
  const result = {};
  let currentSection = null;

  const lines = text.split('\n');
  for (const raw of lines) {
    const line = raw; // keep original for indentation detection
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    // Top-level key detection (no leading spaces)
    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      const key   = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();

      if (value === '' || value === null) {
        // Section start
        result[key] = {};
        currentSection = key;
      } else {
        result[key] = stripQuotes(value);
        currentSection = null;
      }
    } else {
      // Indented key under a section
      if (!currentSection) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      const key   = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();
      if (typeof result[currentSection] !== 'object') {
        result[currentSection] = {};
      }
      result[currentSection][key] = stripQuotes(value);
    }
  }
  return result;
}

function stripQuotes (s) {
  if (!s) return s;
  if ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Simple YAML writer — produces the unified sprint-status.yaml format
// ---------------------------------------------------------------------------

function indent (str, n) {
  const pad = ' '.repeat(n);
  return str.split('\n').map(l => pad + l).join('\n');
}

function dumpMetadata (meta) {
  const lines = [
    `# Unified sprint-status.yaml — single source of truth for sprint and backlog state`,
    `# Schema version: 1.0 (Story 17.9)`,
    `# Migrated by: scripts/migrate-sprint-status.js`,
    ``,
    `generated: "${meta.generated}"`,
    `last_updated: "${meta.last_updated}"`,
    `project: ${meta.project}`,
    `project_key: ${meta.project_key}`,
    `tracking_system: ${meta.tracking_system}`,
    `story_location: ${meta.story_location}`,
  ];
  return lines.join('\n');
}

function dumpEpics (epics) {
  const lines = [``, `# ── Epics ────────────────────────────────────────────────────────────────────`, `epics:`];
  const keys = Object.keys(epics).sort((a, b) => {
    const na = parseInt(a.replace('epic-', ''), 10);
    const nb = parseInt(b.replace('epic-', ''), 10);
    return na - nb;
  });
  if (keys.length === 0) {
    lines.push(`  {}`);
    return lines.join('\n');
  }
  for (const k of keys) {
    const e = epics[k];
    const retro = e.retrospective === null ? 'null' : e.retrospective;
    lines.push(`  ${k}:`);
    lines.push(`    status: ${e.status}`);
    lines.push(`    retrospective: ${retro}`);
  }
  return lines.join('\n');
}

function dumpBacklog (items) {
  const lines = [``, `# ── Backlog ──────────────────────────────────────────────────────────────────`, `# Ordered by priority (position 0 = highest priority)`, `backlog:`];
  if (items.length === 0) {
    lines.push(`  []`);
    return lines.join('\n');
  }
  for (const item of items) {
    const sev  = item.severity === null || item.severity === undefined ? 'null' : item.severity;
    const epic = item.epic === null || item.epic === undefined ? 'null' : item.epic;
    lines.push(`  - id: "${item.id}"`);
    lines.push(`    type: ${item.type}`);
    lines.push(`    epic: ${epic}`);
    lines.push(`    title: "${item.title.replace(/"/g, '\\"')}"`);
    lines.push(`    priority: ${item.priority}`);
    lines.push(`    status: ${item.status}`);
    lines.push(`    severity: ${sev}`);
  }
  return lines.join('\n');
}

function dumpSprints (sprints) {
  const lines = [``, `# ── Sprints ──────────────────────────────────────────────────────────────────`, `sprints:`];
  const keys = Object.keys(sprints).sort((a, b) => {
    const na = parseInt(a.replace('sprint-', ''), 10);
    const nb = parseInt(b.replace('sprint-', ''), 10);
    return na - nb;
  });
  if (keys.length === 0) {
    lines.push(`  {}`);
    return lines.join('\n');
  }
  for (const k of keys) {
    const s = sprints[k];
    lines.push(`  ${k}:`);
    lines.push(`    name: "${s.name.replace(/"/g, '\\"')}"`);
    lines.push(`    status: ${s.status}`);
    lines.push(`    capacity: ${s.capacity}`);
    lines.push(`    start: "${s.start || ''}"`);
    lines.push(`    end: "${s.end || ''}"`);
    if (s.items.length === 0) {
      lines.push(`    items: []`);
    } else {
      lines.push(`    items:`);
      for (const item of s.items) {
        const sev  = item.severity === null || item.severity === undefined ? 'null' : item.severity;
        const epic = item.epic === null || item.epic === undefined ? 'null' : item.epic;
        lines.push(`      - id: "${item.id}"`);
        lines.push(`        type: ${item.type}`);
        lines.push(`        epic: ${epic}`);
        lines.push(`        title: "${item.title.replace(/"/g, '\\"')}"`);
        lines.push(`        status: ${item.status}`);
        lines.push(`        severity: ${sev}`);
      }
    }
  }
  return lines.join('\n');
}

function buildUnifiedYaml (meta, epics, backlog, sprints) {
  return [
    dumpMetadata(meta),
    dumpEpics(epics),
    dumpBacklog(backlog),
    dumpSprints(sprints),
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Key classification
// ---------------------------------------------------------------------------

function classifyKey (key) {
  // epic-N (where N is digits only)
  if (/^epic-\d+$/.test(key)) return 'epic';
  // epic-N-retrospective
  if (/^epic-\d+-retrospective$/.test(key)) return 'retrospective';
  // everything else is a story/bug
  return 'item';
}

function epicNumFromKey (key) {
  const m = key.match(/^epic-(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function epicFromItemId (id) {
  // story IDs follow: N-M-slug (epic = N)
  const m = id.match(/^(\d+)-\d+-.+/);
  return m ? parseInt(m[1], 10) : null;
}

function titleFromId (id) {
  // Convert kebab-case slug to title case (last segment after N-M-)
  const parts = id.split('-');
  // Strip leading numeric parts
  let start = 0;
  while (start < parts.length && /^\d+$/.test(parts[start])) start++;
  return parts.slice(start).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function itemTypeFromId (id) {
  if (id.startsWith('bug-') || id.startsWith('BUG-')) return 'bug';
  return 'story';
}

// ---------------------------------------------------------------------------
// Schema detection
// ---------------------------------------------------------------------------

function detectSchema (parsed) {
  if (parsed.development_status && typeof parsed.development_status === 'object') {
    return 'old';
  }
  if (parsed.epics !== undefined || parsed.backlog !== undefined || parsed.sprints !== undefined) {
    return 'new';
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Report helpers
// ---------------------------------------------------------------------------

class MigrationReport {
  constructor () {
    this.sections = [];
    this.conflicts = [];
    this.warnings  = [];
    this.filesRelocated = [];
    this.itemsMigrated  = [];
    this.epicsMigrated  = [];
    this.sprintsMigrated = [];
  }

  addSection (title, lines) {
    this.sections.push({ title, lines });
  }

  log (msg) {
    process.stdout.write(msg + '\n');
  }

  toMarkdown () {
    const now = new Date().toISOString();
    const md  = [`# Migration Report`, ``, `**Generated:** ${now}`, ``];

    for (const sec of this.sections) {
      md.push(`## ${sec.title}`, ``);
      for (const l of sec.lines) md.push(l);
      md.push('');
    }

    if (this.conflicts.length > 0) {
      md.push(`## Conflicts Detected`, ``);
      for (const c of this.conflicts) {
        md.push(`- **${c.id}**: ${c.description} → Resolution: ${c.resolution}`);
      }
      md.push('');
    } else {
      md.push(`## Conflicts`, ``, `No conflicts detected.`, ``);
    }

    if (this.warnings.length > 0) {
      md.push(`## Warnings`, ``);
      for (const w of this.warnings) md.push(`- ${w}`);
      md.push('');
    }

    if (this.filesRelocated.length > 0) {
      md.push(`## Files Relocated`, ``);
      for (const f of this.filesRelocated) md.push(`- \`${f.from}\` → \`${f.to}\``);
      md.push('');
    }

    return md.join('\n');
  }
}

// ---------------------------------------------------------------------------
// Core migration
// ---------------------------------------------------------------------------

function migrate (artPath, report) {
  const ssFile     = path.join(artPath, 'sprint-status.yaml');
  const ssOldFile  = path.join(artPath, 'sprint-status.yaml.old');
  const backlogFile = path.join(artPath, 'backlog.yaml');
  const sprintsDir  = path.join(artPath, 'sprints');
  const depDir      = path.join(artPath, 'deprecated');

  // ── 1. Read and detect schema ───────────────────────────────────────────

  if (!fs.existsSync(ssFile)) {
    report.log('❌ sprint-status.yaml not found at: ' + ssFile);
    report.log('   Please run this script from the project root or pass --artifacts-path.');
    process.exit(1);
  }

  const rawSS = fs.readFileSync(ssFile, 'utf8');
  const parsed = parseSimpleYaml(rawSS);
  const schema = detectSchema(parsed);

  const legacyBacklogExists  = fs.existsSync(backlogFile);
  const legacySprintsDirExists = fs.existsSync(sprintsDir) && fs.statSync(sprintsDir).isDirectory();
  const legacySprintPlans  = fs.existsSync(artPath)
    ? fs.readdirSync(artPath).filter(f => /^sprint-plan-.*\.yaml$/.test(f)).map(f => path.join(artPath, f))
    : [];
  const hasLegacyFiles = legacyBacklogExists || legacySprintsDirExists || legacySprintPlans.length > 0;

  // ── 2. Idempotency check ────────────────────────────────────────────────

  if (schema === 'new' && !hasLegacyFiles) {
    report.log('✅ No migration needed — unified schema already in use and no legacy files detected.');
    report.addSection('Result', ['No migration performed — file already uses the unified three-section schema.']);
    return false; // nothing to do
  }

  if (schema === 'new' && hasLegacyFiles) {
    report.log('ℹ️  Unified schema detected but legacy files still present — relocating legacy files only (no data re-import).');
    relocateLegacyFiles(artPath, depDir, backlogFile, sprintsDir, legacySprintPlans, report);
    return true;
  }

  if (schema !== 'old') {
    report.log('⚠️  sprint-status.yaml has an unrecognised schema. Cannot migrate automatically.');
    report.log('   Expected: `development_status` key (old) or `epics`/`backlog`/`sprints` keys (new).');
    process.exit(1);
  }

  // ── 3. Backup ────────────────────────────────────────────────────────────

  const now = new Date().toISOString();
  fs.copyFileSync(ssFile, ssOldFile);
  report.log(`📁 Backup created: sprint-status.yaml.old (timestamp: ${now})`);

  // ── 4. Preserve metadata ─────────────────────────────────────────────────

  const meta = {
    generated:       parsed.generated       || now,
    last_updated:    now,
    project:         parsed.project         || 'agents',
    project_key:     parsed.project_key     || 'NOKEY',
    tracking_system: parsed.tracking_system || 'file-system',
    story_location:  parsed.story_location  || '_bmad-output/implementation-artifacts',
  };

  // ── 5. Extract epics, retrospectives, and item statuses from development_status ──

  const devStatus = parsed.development_status || {};
  const epicsMap  = {};   // epic-N -> { status, retrospective }
  const itemStatuses = {}; // id -> status

  for (const [key, value] of Object.entries(devStatus)) {
    const kind = classifyKey(key);
    if (kind === 'epic') {
      const num = epicNumFromKey(key);
      if (!epicsMap[key]) epicsMap[key] = { status: 'backlog', retrospective: 'optional' };
      epicsMap[key].status = value || 'backlog';
      report.epicsMigrated.push({ key, status: value });
    } else if (kind === 'retrospective') {
      const epicKey = key.replace('-retrospective', '');
      if (!epicsMap[epicKey]) epicsMap[epicKey] = { status: 'backlog', retrospective: 'optional' };
      epicsMap[epicKey].retrospective = value || 'optional';
    } else {
      // story / bug item
      itemStatuses[key] = value || 'backlog';
    }
  }

  report.addSection('Epics Extracted', report.epicsMigrated.map(e => `- \`${e.key}\`: ${e.status}`));

  // ── 6. Import backlog.yaml (if exists) ──────────────────────────────────

  const importedItems = {}; // id -> item object

  if (legacyBacklogExists) {
    report.log(`📋 Importing backlog.yaml...`);
    const rawBacklog = fs.readFileSync(backlogFile, 'utf8');
    // backlog.yaml is typically a simple list: just id and optional fields
    // We parse the known format: top-level 'backlog' array or flat list
    const parsedBL  = parseSimpleYaml(rawBacklog);
    // Try to extract items — format varies; we handle both a flat map and structured list
    // For this project: backlog.yaml didn't exist, so this is defensive code
    let blItems = [];
    if (Array.isArray(parsedBL.backlog)) {
      blItems = parsedBL.backlog;
    } else if (typeof parsedBL.backlog === 'object') {
      blItems = Object.values(parsedBL.backlog);
    } else {
      // treat entire parsed object as items map
      for (const [k, v] of Object.entries(parsedBL)) {
        if (k.startsWith('#') || k === 'generated' || k === 'project') continue;
        blItems.push({ id: k, status: v });
      }
    }

    let priority = 1;
    for (const raw of blItems) {
      const id = raw.id || raw.key || String(raw);
      if (!id || id.startsWith('#')) continue;
      const item = {
        id,
        type:     raw.type     || itemTypeFromId(id),
        epic:     raw.epic     !== undefined ? raw.epic : epicFromItemId(id),
        title:    raw.title    || titleFromId(id),
        priority: priority++,
        status:   raw.status   || 'backlog',
        severity: raw.severity || null,
      };
      importedItems[id] = item;
      report.itemsMigrated.push({ id, source: 'backlog.yaml', section: 'backlog' });
    }
    report.log(`   → Imported ${Object.keys(importedItems).length} items from backlog.yaml`);
  }

  // ── 7. Import sprint plan files ──────────────────────────────────────────

  const sprintsMap = {};

  const sprintFiles = [
    ...(legacySprintsDirExists
      ? fs.readdirSync(sprintsDir)
          .filter(f => /\.yaml$/.test(f))
          .map(f => path.join(sprintsDir, f))
      : []),
    ...legacySprintPlans,
  ];

  for (const sf of sprintFiles) {
    report.log(`🏃 Importing sprint file: ${path.basename(sf)}`);
    const rawSprint = fs.readFileSync(sf, 'utf8');
    const ps = parseSimpleYaml(rawSprint);

    const num   = ps.sprint_number || extractSprintNumber(path.basename(sf));
    const key   = `sprint-${num}`;
    const items = [];

    // Parse assigned_items list — this is stored as a YAML sequence in old format
    const assignedLines = extractYamlSequence(rawSprint, 'assigned_items');
    for (const itemId of assignedLines) {
      // Find in importedItems or create a stub
      let item = importedItems[itemId];
      if (!item) {
        item = {
          id:       itemId,
          type:     itemTypeFromId(itemId),
          epic:     epicFromItemId(itemId),
          title:    titleFromId(itemId),
          status:   'ready-for-dev',
          severity: null,
        };
        report.warnings.push(`Item \`${itemId}\` found in sprint file but not in backlog.yaml — created stub entry`);
      }
      // Sprint items do NOT have priority
      const sprintItem = {
        id:       item.id,
        type:     item.type,
        epic:     item.epic,
        title:    item.title,
        status:   item.status,
        severity: item.severity,
      };
      items.push(sprintItem);

      // Remove from importedItems (single-location: in sprint, not backlog)
      if (importedItems[itemId]) {
        delete importedItems[itemId];
      }
    }

    sprintsMap[key] = {
      name:     ps.sprint_name || `Sprint ${num}`,
      status:   normalizeSprintStatus(ps.status || 'planning'),
      capacity: parseInt(ps.capacity, 10) || 8,
      start:    ps.start_context || ps.start || '',
      end:      ps.end_context   || ps.end   || '',
      items,
    };

    report.sprintsMigrated.push({ key, itemCount: items.length });
    report.log(`   → ${key}: ${items.length} items`);
  }

  // ── 8. Apply status from development_status (authoritative) ─────────────

  let orphanCount = 0;
  for (const [id, status] of Object.entries(itemStatuses)) {
    let found = false;

    // Check backlog
    if (importedItems[id]) {
      if (importedItems[id].status !== status) {
        report.conflicts.push({ id, description: `backlog.yaml status: ${importedItems[id].status}, development_status: ${status}`, resolution: `Using development_status: ${status}` });
      }
      importedItems[id].status = status;
      found = true;
    }

    // Check sprint items
    for (const sprint of Object.values(sprintsMap)) {
      for (const item of sprint.items) {
        if (item.id === id) {
          if (item.status !== status) {
            report.conflicts.push({ id, description: `sprint item status: ${item.status}, development_status: ${status}`, resolution: `Using development_status: ${status}` });
          }
          item.status = status;
          found = true;
        }
      }
    }

    if (!found) {
      // Item in development_status but not in backlog or any sprint
      // Create a backlog entry
      const item = {
        id,
        type:     itemTypeFromId(id),
        epic:     epicFromItemId(id),
        title:    titleFromId(id),
        priority: 0, // will be renumbered
        status,
        severity: null,
      };
      importedItems[id] = item;
      orphanCount++;
      report.warnings.push(`Item \`${id}\` found only in development_status (not in backlog.yaml or sprint files) — created backlog entry with status: ${status}`);
    }
  }

  if (orphanCount > 0) {
    report.log(`⚠️  ${orphanCount} orphaned status entries created as backlog items (see warnings in report)`);
  }

  // ── 9. Build final backlog array (sorted by original priority, then by id) ──

  const backlogArray = Object.values(importedItems);
  // Sort: items with explicit priority first, then alphabetically
  backlogArray.sort((a, b) => {
    if (a.priority && b.priority) return a.priority - b.priority;
    if (a.priority) return -1;
    if (b.priority) return  1;
    return a.id.localeCompare(b.id);
  });
  // Renumber priorities
  backlogArray.forEach((item, idx) => { item.priority = idx + 1; });

  // ── 10. Write unified sprint-status.yaml ────────────────────────────────

  const yaml = buildUnifiedYaml(meta, epicsMap, backlogArray, sprintsMap);

  // Atomic write: write to temp file, then rename
  const tmpFile = ssFile + '.tmp';
  fs.writeFileSync(tmpFile, yaml, 'utf8');
  fs.renameSync(tmpFile, ssFile);

  report.log(`✅ Written: sprint-status.yaml (unified three-section schema)`);
  report.log(`   Epics: ${Object.keys(epicsMap).length}, Backlog items: ${backlogArray.length}, Sprints: ${Object.keys(sprintsMap).length}`);

  // ── 11. Relocate legacy files ─────────────────────────────────────────────

  if (hasLegacyFiles) {
    relocateLegacyFiles(artPath, depDir, backlogFile, sprintsDir, legacySprintPlans, report);
  }

  return true;
}

// ---------------------------------------------------------------------------
// Legacy file relocation
// ---------------------------------------------------------------------------

function relocateLegacyFiles (artPath, depDir, backlogFile, sprintsDir, legacySprintPlans, report) {
  if (!fs.existsSync(depDir)) {
    fs.mkdirSync(depDir, { recursive: true });
    report.log(`📁 Created deprecated/ directory: ${depDir}`);
  }

  if (fs.existsSync(backlogFile)) {
    const dest = path.join(depDir, 'backlog.yaml');
    fs.renameSync(backlogFile, dest);
    report.log(`📦 Relocated: backlog.yaml → deprecated/backlog.yaml`);
    report.filesRelocated.push({ from: 'backlog.yaml', to: 'deprecated/backlog.yaml' });
  }

  if (fs.existsSync(sprintsDir)) {
    const destDir = path.join(depDir, 'sprints');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const files = fs.readdirSync(sprintsDir);
    for (const f of files) {
      fs.renameSync(path.join(sprintsDir, f), path.join(destDir, f));
      report.filesRelocated.push({ from: `sprints/${f}`, to: `deprecated/sprints/${f}` });
    }
    fs.rmdirSync(sprintsDir);
    report.log(`📦 Relocated: sprints/ → deprecated/sprints/`);
  }

  for (const spFile of legacySprintPlans) {
    const basename = path.basename(spFile);
    const dest = path.join(depDir, basename);
    fs.renameSync(spFile, dest);
    report.log(`📦 Relocated: ${basename} → deprecated/${basename}`);
    report.filesRelocated.push({ from: basename, to: `deprecated/${basename}` });
  }
}

// ---------------------------------------------------------------------------
// Helpers for parsing old YAML sequences
// ---------------------------------------------------------------------------

function extractYamlSequence (text, key) {
  const lines  = text.split('\n');
  const items  = [];
  let inSeq    = false;
  const keyRe  = new RegExp('^\\s*' + key + '\\s*:');

  for (const line of lines) {
    if (!inSeq) {
      if (keyRe.test(line)) {
        // Check if inline: assigned_items: [a, b]
        const inline = line.replace(keyRe, '').trim();
        if (inline.startsWith('[') && inline.endsWith(']')) {
          const inner = inline.slice(1, -1);
          for (const item of inner.split(',')) {
            const t = item.trim().replace(/^['"]|['"]$/g, '');
            if (t) items.push(t);
          }
          break;
        }
        inSeq = true;
      }
    } else {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        items.push(trimmed.slice(2).trim().replace(/^['"]|['"]$/g, ''));
      } else if (trimmed && !trimmed.startsWith('#')) {
        break; // end of sequence
      }
    }
  }
  return items;
}

function extractSprintNumber (filename) {
  // sprint-plan-1.yaml or sprint-1.yaml
  const m = filename.match(/(\d+)/);
  return m ? m[1] : '0';
}

function normalizeSprintStatus (status) {
  if (!status) return 'planning';
  const s = status.toLowerCase();
  if (s === 'active' || s === 'in-progress') return 'active';
  if (s === 'closed' || s === 'completed' || s === 'done') return 'closed';
  return 'planning';
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validate (ssFile) {
  const raw = fs.readFileSync(ssFile, 'utf8');
  const errors = [];

  // Check three-section schema markers
  if (!raw.includes('\nepics:') && !raw.includes('\nepics: {}')) {
    errors.push('Missing `epics` section');
  }
  if (!raw.includes('\nbacklog:') && !raw.includes('\nbacklog: []')) {
    errors.push('Missing `backlog` section');
  }
  if (!raw.includes('\nsprints:') && !raw.includes('\nsprints: {}')) {
    errors.push('Missing `sprints` section');
  }
  if (raw.includes('\ndevelopment_status:')) {
    errors.push('Old `development_status` key still present — migration did not fully overwrite the file');
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main () {
  const { projectRoot, artPath } = parseArgs();

  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  sprint-status.yaml Migration (Story 17.23)            ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Project root:    ${projectRoot}`);
  console.log(`Artifacts path:  ${artPath}`);
  console.log('');

  const report = new MigrationReport();

  try {
    const changed = migrate(artPath, report);

    // Validate result
    const ssFile = path.join(artPath, 'sprint-status.yaml');
    const errors = validate(ssFile);
    if (errors.length > 0) {
      report.log('');
      report.log('❌ Validation FAILED:');
      for (const e of errors) report.log(`   - ${e}`);
      report.addSection('Validation', errors.map(e => `- ❌ ${e}`));
    } else {
      report.log('');
      report.log('✅ Validation passed — unified schema confirmed.');
      report.addSection('Validation', ['✅ All three sections present. No legacy `development_status` key found.']);
    }

    // Write migration report
    if (changed) {
      const depDir  = path.join(artPath, 'deprecated');
      if (!fs.existsSync(depDir)) fs.mkdirSync(depDir, { recursive: true });
      const reportFile = path.join(depDir, 'migration-report.md');
      fs.writeFileSync(reportFile, report.toMarkdown(), 'utf8');
      report.log('');
      report.log(`📄 Migration report written to: ${reportFile}`);
    }

    report.log('');
    report.log('Done.');

    if (errors.length > 0) process.exit(1);

  } catch (err) {
    console.error('');
    console.error('❌ Migration failed with error:');
    console.error('  ', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
