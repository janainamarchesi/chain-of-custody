#!/usr/bin/env node
/**
 * verify.mjs — mechanical validation of a design-docs package.
 *
 * Usage:
 *   node verify.mjs <repo> [config.json]
 *
 * Without a config, the built-in defaults are used.
 * Output: exit 0 = clean, exit 1 = problems found.
 *
 * Checks (all configurable):
 *   1. Required files exist
 *   2. ADRs: count, naming, MADR sections
 *   3. PRD/RFC/FDD/README: minimum counts and sections
 *   4. Every code reference exists in the repository
 *   5. Every source locator resolves in the source file
 *   6. The tracker table uses only allowed sources
 *   7. Nothing was modified outside the allowed areas (if git is available)
 *
 * Requires Node 18+. Installs nothing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULTS = {
  docs: {
    required: ['docs/PRD.md', 'docs/RFC.md', 'docs/FDD.md', 'docs/TRACKER.md'],
    adrDir: 'docs/adrs',
    adrPattern: '^ADR-\\d{3}-[a-z0-9-]+\\.md$',
    adrMin: 5,
    adrMax: 8,
    adrRequiredSections: ['Status', 'Context', 'Decis', 'Alternatives', 'Consequ'],
    readme: 'README.md',
    // Section headings, as regex fragments. Override these to run against a
    // package written in another language — see config.example.pt-br.json.
    sections: {
      outOfScope: 'Out of scope',
      openQuestions: 'Open [Qq]uestions',
      observability: 'Observability',
      integration: 'Integrat',
    },
    // Inline markers, as regex fragments.
    markers: {
      scopeCategories: 'discarded|deferred|open',
      risk: 'Likelihood|Probability',
      tradeoff: 'Trade-off|Tradeoff',
      request: 'Request|Input',
      response: 'Response|Output',
      obsLogs: 'log',
      obsMetrics: 'metric',
      obsTracing: 'trac(e|ing)',
    },
  },
  source: {
    file: 'TRANSCRIPT.md',
    locatorPattern: '^\\[(\\d{2}:\\d{2})\\]\\s+([^:]+):',
    locatorFormat: '[hh:mm] Name',
  },
  tracker: {
    header: '| ID | Document | Type | Summary | Source | Location |',
    allowedSources: ['TRANSCRIPT', 'CODE'],
    codeSourceLabel: 'CODE',
    minCodeRows: 5,
    minTranscriptPct: 70,
  },
  code: {
    pathPatterns: ['src/[A-Za-z0-9_/.-]+\\.(ts|tsx|js|jsx)', 'prisma/[A-Za-z0-9_/.-]+\\.prisma'],
    newPathAllowlist: [],
  },
  minimums: {
    prd: { functionalRequirements: 8, outOfScope: 2, risks: 2 },
    rfc: { alternatives: 2, openQuestions: 2, adrLinks: 2 },
    fdd: { requestExamples: 4, responseExamples: 4, errorPrefix: 'WEBHOOK_' },
    readme: { codeBlocks: 2 },
  },
  immutable: { allowOnly: ['docs/', 'README.md'], baseRef: null },
};

const repoArg = process.argv[2];
const configArg = process.argv[3];

if (!repoArg) {
  console.error('usage: node verify.mjs <repo> [config.json]');
  process.exit(2);
}

const repo = path.resolve(repoArg);
if (!fs.existsSync(repo)) {
  console.error(`repository not found: ${repo}`);
  process.exit(2);
}

let cfg = DEFAULTS;
if (configArg) {
  const cfgPath = path.resolve(configArg);
  if (!fs.existsSync(cfgPath)) {
    console.error(`config not found: ${cfgPath}`);
    process.exit(2);
  }
  // PowerShell 5.1 writes configs with a BOM; JSON.parse does not tolerate it.
  const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^﻿/, ''));
  cfg = {
    docs: {
      ...DEFAULTS.docs,
      ...(raw.docs || {}),
      // Nested groups merge key by key, so a config may override one heading
      // without losing the other defaults.
      sections: { ...DEFAULTS.docs.sections, ...(raw.docs?.sections || {}) },
      markers: { ...DEFAULTS.docs.markers, ...(raw.docs?.markers || {}) },
    },
    source: { ...DEFAULTS.source, ...(raw.source || {}) },
    tracker: { ...DEFAULTS.tracker, ...(raw.tracker || {}) },
    code: { ...DEFAULTS.code, ...(raw.code || {}) },
    minimums: {
      prd: { ...DEFAULTS.minimums.prd, ...(raw.minimums?.prd || {}) },
      rfc: { ...DEFAULTS.minimums.rfc, ...(raw.minimums?.rfc || {}) },
      fdd: { ...DEFAULTS.minimums.fdd, ...(raw.minimums?.fdd || {}) },
      readme: { ...DEFAULTS.minimums.readme, ...(raw.minimums?.readme || {}) },
    },
    immutable: { ...DEFAULTS.immutable, ...(raw.immutable || {}) },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const problems = [];
const notes = [];

const abs = (p) => path.join(repo, p);
const exists = (p) => fs.existsSync(abs(p));
const read = (p) => fs.readFileSync(abs(p), 'utf8');
const readSafe = (p) => (exists(p) ? read(p) : null);

/** Returns a description if the text holds invalid UTF-8 or obvious mojibake. */
function encodingIssue(text) {
  if (text.includes(String.fromCharCode(0xfffd))) return 'contains U+FFFD (invalid bytes)';
  // Typical sequence from UTF-8 read as cp1252 and written back.
  if (/Ã[\u0080-¿]/.test(text)) return 'contains mojibake (Ã followed by a control char)';
  return null;
}

function sectionBody(text, pattern) {
  // 'm' is mandatory: section patterns are anchored on ^.
  const re = new RegExp(pattern, 'im');
  const m = text.search(re);
  if (m === -1) return '';
  const rest = text.slice(m);
  // A section ends at the next heading of equal or higher level.
  const level = (rest.match(/^#+/) || ['#'])[0].length;
  const heading = new RegExp(`\\n#{1,${level}}\\s`);
  const next = rest.slice(1).search(heading);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

const codeRegex = new RegExp(cfg.code.pathPatterns.join('|'), 'g');
const newPaths = new Set(cfg.code.newPathAllowlist);

// ---------------------------------------------------------------------------
// 1. Required files
// ---------------------------------------------------------------------------

const requiredDocs = [...cfg.docs.required];
if (cfg.docs.readme) requiredDocs.push(cfg.docs.readme);

for (const f of requiredDocs) {
  if (!exists(f)) problems.push(`required file missing: ${f}`);
}

// ---------------------------------------------------------------------------
// 2. ADRs
// ---------------------------------------------------------------------------

const adrDir = cfg.docs.adrDir;
let adrFiles = [];
if (exists(adrDir)) {
  const re = new RegExp(cfg.docs.adrPattern);
  adrFiles = fs.readdirSync(abs(adrDir)).filter((f) => re.test(f)).sort();
} else {
  problems.push(`ADR directory missing: ${adrDir}`);
}

if (adrFiles.length < cfg.docs.adrMin || adrFiles.length > cfg.docs.adrMax) {
  problems.push(
    `ADR count = ${adrFiles.length} (expected between ${cfg.docs.adrMin} and ${cfg.docs.adrMax})`
  );
}
notes.push(`ADRs: ${adrFiles.length}`);

const allDocs = {};

for (const f of requiredDocs) {
  const t = readSafe(f);
  if (t) allDocs[f] = t;
}

for (const f of adrFiles) {
  const p = path.join(adrDir, f);
  const t = read(p);
  allDocs[p.replace(/\\/g, '/')] = t;
  for (const s of cfg.docs.adrRequiredSections) {
    const re = new RegExp(`^#{1,4}\\s*.*${s}`, 'im');
    if (!re.test(t)) problems.push(`ADR ${f}: missing section "${s}"`);
  }
}

const adrsWithCode = adrFiles.filter((f) => {
  const t = read(path.join(adrDir, f));
  return new RegExp(cfg.code.pathPatterns[0]).test(t);
});
notes.push(`ADRs citing code: ${adrsWithCode.length}`);

// ---------------------------------------------------------------------------
// 3. Encoding
// ---------------------------------------------------------------------------

for (const [p, t] of Object.entries(allDocs)) {
  const issue = encodingIssue(t);
  if (issue) problems.push(`${p}: ${issue}`);
}

// ---------------------------------------------------------------------------
// 4. PRD
// ---------------------------------------------------------------------------

const prd = allDocs['docs/PRD.md'];
if (prd) {
  const rf = (prd.match(/^#{2,4}\s*RF-?\d+/gim) || []).length;
  notes.push(`PRD: ${rf} functional requirements`);
  if (rf < cfg.minimums.prd.functionalRequirements) {
    problems.push(
      `PRD: ${rf} functional requirements (minimum ${cfg.minimums.prd.functionalRequirements})`
    );
  }

  const oosBody = sectionBody(prd, `^#{1,4}\\s*[\\d.]*\\s*${cfg.docs.sections.outOfScope}`);
  if (!oosBody) {
    problems.push('PRD: "Out of scope" section missing');
  } else {
    const items = (oosBody.match(/^\s*\d+\.\s+/gm) || []).length;
    notes.push(`PRD: ${items} out-of-scope items`);
    if (items < cfg.minimums.prd.outOfScope) {
      problems.push(`PRD: ${items} out-of-scope items (minimum ${cfg.minimums.prd.outOfScope})`);
    }
    // Discarded / deferred / open must be distinguishable.
    const marked = (oosBody.match(new RegExp(`\\b(${cfg.docs.markers.scopeCategories})\\b`, 'gi')) || []).length;
    if (items > 0 && marked === 0) {
      problems.push('PRD: out-of-scope items without discarded/deferred/open marking');
    }
  }

  const risks = (prd.match(new RegExp(`\\*\\*(${cfg.docs.markers.risk}):\\*\\*`, 'gi')) || []).length;
  if (risks < cfg.minimums.prd.risks) {
    problems.push(`PRD: ${risks} risks with likelihood (minimum ${cfg.minimums.prd.risks})`);
  }
}

// ---------------------------------------------------------------------------
// 5. RFC
// ---------------------------------------------------------------------------

const rfc = allDocs['docs/RFC.md'];
if (rfc) {
  const alts = (rfc.match(/^#{3,4}\s*\d+(\.\d+)?\s+/gm) || []).length;
  const tradeoffs = (rfc.match(new RegExp(`\\*\\*(${cfg.docs.markers.tradeoff}):?\\*\\*`, 'gi')) || []).length;
  notes.push(`RFC: ${alts} subsections, ${tradeoffs} trade-offs`);
  if (tradeoffs < cfg.minimums.rfc.alternatives) {
    problems.push(
      `RFC: ${tradeoffs} alternatives with a trade-off (minimum ${cfg.minimums.rfc.alternatives})`
    );
  }

  const qaBody = sectionBody(rfc, `^#{1,4}\\s*[\\d.]*\\s*${cfg.docs.sections.openQuestions}`);
  const qa = qaBody ? (qaBody.match(/^\s*\d+\.\s+/gm) || []).length : 0;
  notes.push(`RFC: ${qa} open questions`);
  if (qa < cfg.minimums.rfc.openQuestions) {
    problems.push(`RFC: ${qa} open questions (minimum ${cfg.minimums.rfc.openQuestions})`);
  }

  const links = [...rfc.matchAll(/\]\((adrs?\/[^)]+\.md)\)/g)].map((m) => m[1]);
  let resolved = 0;
  for (const l of links) {
    const target = path.join('docs', l).replace(/\\/g, '/');
    if (exists(target)) resolved++;
    else problems.push(`RFC: broken ADR link -> ${l}`);
  }
  notes.push(`RFC: ${resolved}/${links.length} ADR links resolve`);
  if (resolved < cfg.minimums.rfc.adrLinks) {
    problems.push(`RFC: ${resolved} valid ADR links (minimum ${cfg.minimums.rfc.adrLinks})`);
  }
}

// ---------------------------------------------------------------------------
// 6. FDD
// ---------------------------------------------------------------------------

const fdd = allDocs['docs/FDD.md'];
if (fdd) {
  const reqs = (fdd.match(new RegExp(`\\*\\*(${cfg.docs.markers.request})[^:*]*:?\\*\\*`, 'gi')) || []).length;
  const ress = (fdd.match(new RegExp(`\\*\\*(${cfg.docs.markers.response})[^*]*\\*\\*`, 'gi')) || []).length;
  notes.push(`FDD: ${reqs} inputs, ${ress} outputs`);
  if (reqs < cfg.minimums.fdd.requestExamples) {
    problems.push(`FDD: ${reqs} input examples (minimum ${cfg.minimums.fdd.requestExamples})`);
  }
  if (ress < cfg.minimums.fdd.responseExamples) {
    problems.push(`FDD: ${ress} output examples (minimum ${cfg.minimums.fdd.responseExamples})`);
  }

  const prefix = cfg.minimums.fdd.errorPrefix;
  const codes = new Set([...fdd.matchAll(new RegExp(`${prefix}[A-Z_]+`, 'g'))].map((m) => m[0]));
  notes.push(`FDD: ${codes.size} ${prefix}* codes`);
  if (codes.size < 3) {
    problems.push(`FDD: ${codes.size} error codes ${prefix}* (minimum 3)`);
  }

  const obsBody = sectionBody(fdd, `^#{1,4}\\s*[\\d.]*\\s*${cfg.docs.sections.observability}`);
  if (obsBody) {
    for (const [label, re] of [
      ['logs', new RegExp(cfg.docs.markers.obsLogs, 'i')],
      ['metrics', new RegExp(cfg.docs.markers.obsMetrics, 'i')],
      ['tracing', new RegExp(cfg.docs.markers.obsTracing, 'i')],
    ]) {
      if (!re.test(obsBody)) problems.push(`FDD: Observability does not mention ${label}`);
    }
  }

  const intBody = sectionBody(fdd, `^#{1,4}\\s*[\\d.]*\\s*${cfg.docs.sections.integration}`);
  if (intBody) {
    const paths = new Set(
      [...intBody.matchAll(codeRegex)].map((m) => m[0].replace(/[.,;:)]+$/, ''))
    );
    notes.push(`FDD: ${paths.size} paths in the integration section`);
    if (paths.size < 4) {
      problems.push(`FDD: ${paths.size} real paths in integration (minimum 4)`);
    }
  } else {
    problems.push('FDD: "Integration with the existing system" section missing');
  }
}

// ---------------------------------------------------------------------------
// 7. Tracker
// ---------------------------------------------------------------------------

const tracker = allDocs['docs/TRACKER.md'];
let trackerRows = [];
if (tracker) {
  if (!tracker.includes(cfg.tracker.header)) {
    problems.push('TRACKER: exact header not found');
  }

  // A tracker usually holds one table per document. Every table must carry the
  // same header: one corrupted header among correct ones is a real defect and
  // is easy to miss when the check only asks whether the header appears at all.
  const headerRows = tracker.split(/\r?\n/).filter((line) => {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    return cells.length === 6 && cells[0] === 'ID';
  });
  for (const row of headerRows) {
    if (row.trim() !== cfg.tracker.header.trim()) {
      problems.push(`TRACKER: table header does not match the expected header: ${row.trim()}`);
    }
  }

  const allowed = cfg.tracker.allowedSources;

  for (const line of tracker.split(/\r?\n/)) {
    if (!/^\|\s*[A-Z][A-Z0-9-]*\s*\|/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length !== 6) continue;
    // Table header: | ID | Document | ... | Source | Location |
    if (cells[0] === 'ID' || cells.every((c) => /^[-: ]*$/.test(c))) continue;
    const source = cells[4];
    if (!allowed.includes(source)) {
      problems.push(`TRACKER: source not allowed "${source}" on row ${cells[0]}`);
    }
    trackerRows.push({ id: cells[0], source, locator: cells[5] });
  }

  notes.push(`TRACKER: ${trackerRows.length} rows`);

  // Source locators
  const srcText = readSafe(cfg.source.file);
  if (!srcText) {
    problems.push(`TRACKER: source file missing: ${cfg.source.file}`);
  } else {
    const locRe = new RegExp(cfg.source.locatorPattern, 'm');
    const valid = new Set();
    for (const line of srcText.split(/\r?\n/)) {
      const m = line.match(locRe);
      if (m) valid.add(`${m[1]} ${m[2].trim()}`);
    }
    notes.push(`source: ${valid.size} valid locators`);

    const srcRows = trackerRows.filter((r) => r.source !== cfg.tracker.codeSourceLabel);
    let ok = 0;
    for (const r of srcRows) {
      const m = r.locator.match(/^\[(\d{2}:\d{2})\]\s*(.+)$/);
      if (m && valid.has(`${m[1]} ${m[2].trim()}`)) ok++;
      else problems.push(`TRACKER: locator does not resolve (${r.id}) -> ${r.locator}`);
    }

    const pct = trackerRows.length ? (ok / trackerRows.length) * 100 : 0;
    notes.push(`TRACKER: valid locators ${ok}/${trackerRows.length} = ${pct.toFixed(1)}%`);
    if (pct < cfg.tracker.minTranscriptPct) {
      problems.push(
        `TRACKER: ${pct.toFixed(1)}% valid locators (minimum ${cfg.tracker.minTranscriptPct}%)`
      );
    }
  }

  // Code rows
  const codeRows = trackerRows.filter((r) => r.source === cfg.tracker.codeSourceLabel);
  notes.push(`TRACKER: ${codeRows.length} code rows`);
  if (codeRows.length < cfg.tracker.minCodeRows) {
    problems.push(`TRACKER: ${codeRows.length} code rows (minimum ${cfg.tracker.minCodeRows})`);
  }
  for (const r of codeRows) {
    if (!exists(r.locator) && !newPaths.has(r.locator)) {
      problems.push(`TRACKER: code path does not exist (${r.id}) -> ${r.locator}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 8. Code paths cited in any document
// ---------------------------------------------------------------------------

const cited = new Set();
for (const t of Object.values(allDocs)) {
  for (const m of t.match(codeRegex) || []) {
    cited.add(m.replace(/[.,;:)]+$/, ''));
  }
}
const broken = [...cited].filter((p) => !exists(p) && !newPaths.has(p));
notes.push(`cited paths: ${cited.size}, missing: ${broken.length}`);
for (const p of broken) problems.push(`code path does not exist: ${p}`);

// ---------------------------------------------------------------------------
// 9. README
// ---------------------------------------------------------------------------

const readme = allDocs[cfg.docs.readme];
if (readme) {
  const blocks = Math.floor((readme.match(/```/g) || []).length / 2);
  notes.push(`README: ${blocks} code blocks`);
  if (blocks < cfg.minimums.readme.codeBlocks) {
    problems.push(`README: ${blocks} code blocks (minimum ${cfg.minimums.readme.codeBlocks})`);
  }
}

// ---------------------------------------------------------------------------
// 10. Immutability: nothing outside the allowed areas
// ---------------------------------------------------------------------------

function changedSinceGit(baseRef) {
  // Resolution order: environment variable, then config, then plain 'git'.
  // The env var exists because a config file cannot portably hold an absolute
  // path — it differs per machine, and committing one is a broken default.
  const git = process.env.COC_GIT_BINARY || cfg.immutable.gitBinary || 'git';
  const out = execFileSync(git, ['-C', repo, 'diff', '--name-only', baseRef], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return out.split(/\r?\n/).filter(Boolean);
}

if (cfg.immutable.baseRef) {
  try {
    const changed = changedSinceGit(cfg.immutable.baseRef);
    const allow = cfg.immutable.allowOnly;
    const outside = changed.filter((f) => !allow.some((a) => f === a || f.startsWith(a)));
    notes.push(`git: ${changed.length} files changed since ${cfg.immutable.baseRef}`);
    if (outside.length) {
      problems.push(`files changed outside the allowed areas: ${outside.join(', ')}`);
    }
  } catch (e) {
    // No git available or unknown ref: not a failure of the package, but of the environment.
    notes.push(`git: immutability check did not run (${e.code || e.message})`);
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log('=== NOTES ===');
for (const n of notes) console.log('  ' + n);

console.log(`\n=== PROBLEMS (${problems.length}) ===`);
if (problems.length === 0) console.log('  none');
else for (const p of problems) console.log('  - ' + p);

process.exit(problems.length ? 1 : 0);
