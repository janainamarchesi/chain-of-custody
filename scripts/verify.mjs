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
 *   1. Required files exist; optional documents are checked when present
 *   2. ADRs: count, naming, MADR sections
 *   3. Encoding: no invalid UTF-8 or mojibake
 *   4. PRD: requirements, out-of-scope categories, risks
 *   5. RFC: alternatives, open questions, ADR links
 *   6. FDD: contracts, error codes, observability, integration, origin column
 *   7. Tracker: header, sources, locators, code rows, ambiguous minutes
 *   8. Code paths cited anywhere exist
 *   9. README: code blocks
 *  10. Immutability: nothing outside the allowed areas (if git is available)
 *  11. Section references resolve; stated coverage numbers match the computed ones
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
    // A package does not always need every document. RFC and FDD are optional
    // by default: when present they are checked in full; when absent the
    // validator says so instead of failing. Move a document to `required` to
    // make its absence a problem.
    required: ['docs/PRD.md', 'docs/TRACKER.md'],
    optional: ['docs/RFC.md', 'docs/FDD.md'],
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
    // How a locator appears in a tracker cell or an origin cell. Unanchored,
    // so it can sit after a justification. Group 1 is the time, group 2 the
    // speaker; the key is "time speaker", the same key source.locatorPattern
    // builds. Change both patterns together when the format differs.
    locatorPattern: '\\[(\\d{2}:\\d{2})\\]\\s*([^;()\\n]+)',
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
  // A table column that declares where each row came from. When set, every row
  // must carry one of the two values, and a SOURCE row must point at a locator
  // or a code path that resolves. Off by default: a package without such a
  // column is valid, and inventing one would only add ceremony.
  origin: { column: null, sourceValue: 'SOURCE', derivedValue: 'DERIVED' },
  immutable: { allowOnly: ['docs/', 'README.md'], baseRef: null },
};

const cliArgs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const showSummary = process.argv.includes('--summary');
const repoArg = cliArgs[0];
const configArg = cliArgs[1];

if (!repoArg) {
  console.error('usage: node verify.mjs <repo> [config.json] [--summary]');
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
    origin: { ...DEFAULTS.origin, ...(raw.origin || {}) },
    immutable: { ...DEFAULTS.immutable, ...(raw.immutable || {}) },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A locator pattern needs two capture groups: time and speaker. A pattern with
 * only one group crashes the validator mid-run with an opaque TypeError; fail
 * at startup instead and say what to fix.
 */
function assertLocatorPattern(name, pattern) {
  let groups = 0;
  let escaped = false;
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (inClass) {
      if (ch === ']') inClass = false;
      continue;
    }
    if (ch === '[') {
      inClass = true;
      continue;
    }
    if (ch === '(' && pattern[i + 1] !== '?') groups++;
  }
  if (groups < 2) {
    console.error(
      `${name} needs two capture groups (time and speaker); found ${groups}: ${pattern}`
    );
    process.exit(2);
  }
}

assertLocatorPattern('source.locatorPattern', cfg.source.locatorPattern);
assertLocatorPattern('tracker.locatorPattern', cfg.tracker.locatorPattern);

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

/**
 * Parses the source file once. Two products:
 *   valid     — every "[hh:mm] Speaker" pair that appears in the source
 *   byLocator — pair -> number of lines, used to flag ambiguous locators
 * Returns null when the source file is missing (reported by the tracker check).
 */
let sourceCache;
function sourceLocators() {
  if (sourceCache !== undefined) return sourceCache;
  const text = readSafe(cfg.source.file);
  if (!text) return (sourceCache = null);
  const locRe = new RegExp(cfg.source.locatorPattern, 'm');
  const valid = new Set();
  const byLocator = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(locRe);
    if (!m) continue;
    const key = `${m[1]} ${m[2].trim()}`;
    valid.add(key);
    byLocator.set(key, (byLocator.get(key) || 0) + 1);
  }
  return (sourceCache = { valid, byLocator });
}

/** "time speaker" key from a locator match. Group 1 is time, group 2 speaker. */
function locatorKey(m) {
  return `${m[1]} ${m[2].trim()}`;
}

/**
 * Whether a locator found in a cell resolves against the source. Exact match
 * first; a cell may carry a justification after the speaker ("Sofia; the ADMIN
 * rule is ours"), so a prefix match counts only when the next character is a
 * delimiter — "Sofia" must not match "Sofia Marcos".
 */
function locatorResolves(m, validSet) {
  const key = locatorKey(m);
  if (validSet.has(key)) return true;
  const i = key.indexOf(' ');
  if (i === -1) return false;
  const time = key.slice(0, i);
  const speaker = key.slice(i + 1);
  for (const k of validSet) {
    const j = k.indexOf(' ');
    if (j === -1 || k.slice(0, j) !== time) continue;
    const ks = k.slice(j + 1);
    if (!speaker.startsWith(ks)) continue;
    const next = speaker.charAt(ks.length);
    if (next === '' || /[;,:)\]—-]/.test(next)) return true;
  }
  return false;
}

/** Section numbers used in a document's headings ("## 6." or "### 6.3"). */
function headingNumbers(text) {
  const set = new Set();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^#{1,6}\s+(\d+(?:\.\d+)*)[.)]?(?:\s|$)/);
    if (m) set.add(m[1]);
  }
  return set;
}

/**
 * Every data row of every table whose header contains `column`.
 * Returns [{ cells, index }] — `index` is the column's position in `cells`.
 */
function rowsOfColumn(text, column) {
  const rows = [];
  let index = -1;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      index = -1;
      continue;
    }
    const cells = trimmed.split('|').slice(1, -1).map((c) => c.trim());
    if (index === -1) {
      const found = cells.findIndex((c) => c.toLowerCase().includes(column.toLowerCase()));
      if (found !== -1) index = found;
      continue;
    }
    if (cells.every((c) => /^[-: ]*$/.test(c))) continue;
    if (cells.length <= index) continue;
    rows.push({ cells, index });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 1. Required files
// ---------------------------------------------------------------------------

const requiredDocs = [...cfg.docs.required];
if (cfg.docs.readme) requiredDocs.push(cfg.docs.readme);
const optionalDocs = [...(cfg.docs.optional || [])].filter((f) => !requiredDocs.includes(f));

for (const f of requiredDocs) {
  if (!exists(f)) problems.push(`required file missing: ${f}`);
}
// An optional document is not a problem when absent, but it is a fact the
// report should state: a silent skip looks identical to a passing check.
for (const f of optionalDocs) {
  if (!exists(f)) notes.push(`${f}: optional document not present`);
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

for (const f of [...requiredDocs, ...optionalDocs]) {
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
    // Discarded / deferred / open must be distinguishable — and every item must
    // carry its own category, not just the section as a whole. A single marker
    // somewhere in the section does not tell you which item is which.
    const markerRe = new RegExp(`\\b(${cfg.docs.markers.scopeCategories})\\b`, 'i');
    const oosItems = oosBody.split(/^[ \t]*\d+\.\s+/m).slice(1);
    const unmarked = oosItems.filter((it) => !markerRe.test(it));
    if (unmarked.length) {
      problems.push(
        `PRD: ${unmarked.length} out-of-scope item(s) without discarded/deferred/open marking`
      );
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

  // A declared origin column turns "is this from the source?" into a
  // mechanical question. Every row must answer it, and a SOURCE row must point
  // at something a reader can follow: a locator that resolves, or a code path.
  if (cfg.origin.column) {
    const rows = rowsOfColumn(fdd, cfg.origin.column);
    const src = sourceLocators();
    let invalid = 0;
    for (const { cells, index } of rows) {
      const cell = cells[index] || '';
      const label = cells[0].replace(/`/g, '');
      // The declared value is the first of the two tokens to appear. A cell
      // like "`DERIVED` — the rule is `SOURCE` [09:36] Sofia" names both; the
      // leading token is the classification, the rest is justification.
      const srcAt = cell.indexOf(cfg.origin.sourceValue);
      const derAt = cell.indexOf(cfg.origin.derivedValue);
      const isSource = srcAt !== -1 && (derAt === -1 || srcAt < derAt);
      const isDerived = derAt !== -1 && (srcAt === -1 || derAt < srcAt);
      if (!isSource && !isDerived) {
        problems.push(
          `FDD: invalid ${cfg.origin.column} value on row "${label}" (expected ${cfg.origin.sourceValue} or ${cfg.origin.derivedValue})`
        );
        invalid++;
        continue;
      }
      if (!isSource) continue;
      const loc = cell.match(new RegExp(cfg.tracker.locatorPattern, 'i'));
      const code = [...cell.matchAll(codeRegex)].map((m) => m[0]);
      if (!loc && !code.length) {
        problems.push(
          `FDD: ${cfg.origin.sourceValue} row "${label}" carries no locator or code path`
        );
        invalid++;
      } else if (loc && src) {
        if (!locatorResolves(loc, src.valid)) {
          problems.push(
            `FDD: ${cfg.origin.sourceValue} locator does not resolve on row "${label}" -> ${loc[0].trim()}`
          );
          invalid++;
        }
      }
    }
    if (rows.length) {
      notes.push(`FDD: ${rows.length} rows with ${cfg.origin.column}, ${invalid} invalid`);
    }
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
let transcriptOk = 0;
let transcriptTotal = 0;
let codeRows = [];
let codeOk = 0;
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
    // Allow lowercase suffixes (ADR-001b, PRD-RF-01b). A row that is silently
    // skipped is worse than a row that fails a check: it disappears from the
    // coverage numbers without anyone noticing.
    if (!/^\|\s*[A-Za-z][A-Za-z0-9_-]*\s*\|/.test(line)) continue;
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
  const src = sourceLocators();
  if (!src) {
    problems.push(`TRACKER: source file missing: ${cfg.source.file}`);
  } else {
    notes.push(`source: ${src.valid.size} valid locators`);

    const locRe = new RegExp(cfg.tracker.locatorPattern, 'i');
    const srcRows = trackerRows.filter((r) => r.source !== cfg.tracker.codeSourceLabel);
    let ok = 0;
    for (const r of srcRows) {
      const m = r.locator.match(locRe);
      if (m && locatorResolves(m, src.valid)) ok++;
      else problems.push(`TRACKER: locator does not resolve (${r.id}) -> ${r.locator}`);
    }
    transcriptOk = ok;
    transcriptTotal = srcRows.length;

    // Percent is over transcript rows only: code rows have no [hh:mm] locator.
    const pct = srcRows.length ? (ok / srcRows.length) * 100 : 0;
    notes.push(`TRACKER: valid locators ${ok}/${srcRows.length} = ${pct.toFixed(1)}%`);
    if (pct < cfg.tracker.minTranscriptPct) {
      problems.push(
        `TRACKER: ${pct.toFixed(1)}% valid locators (minimum ${cfg.tracker.minTranscriptPct}%)`
      );
    }

    // A locator is ambiguous when the same speaker has more than one line in
    // that minute: the pair then proves the person spoke then, but not which
    // sentence the claim came from. Warn, do not fail — the row may still be
    // correct. A literal quote in the row disambiguates.
    const ambiguous = srcRows.filter((r) => {
      const m = r.locator.match(locRe);
      if (!m) return false;
      return (src.byLocator.get(locatorKey(m)) || 0) > 1;
    });
    const sample = ambiguous.slice(0, 5).map((r) => r.id).join(', ');
    notes.push(
      `TRACKER: ambiguous locators: ${ambiguous.length} row(s)` +
        (ambiguous.length ? ` (${sample}${ambiguous.length > 5 ? ', …' : ''})` : '')
    );
  }

  // Code rows
  codeRows = trackerRows.filter((r) => r.source === cfg.tracker.codeSourceLabel);
  notes.push(`TRACKER: ${codeRows.length} code rows`);
  if (codeRows.length < cfg.tracker.minCodeRows) {
    problems.push(`TRACKER: ${codeRows.length} code rows (minimum ${cfg.tracker.minCodeRows})`);
  }
  for (const r of codeRows) {
    if (exists(r.locator) || newPaths.has(r.locator)) codeOk++;
    else problems.push(`TRACKER: code path does not exist (${r.id}) -> ${r.locator}`);
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
  const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
  // `git diff` only sees tracked files. A new file added outside the allowed
  // areas (e.g. src/evil.ts) is untracked and would pass unseen, so union in
  // `git ls-files --others` (respects .gitignore).
  const tracked = execFileSync(git, ['-C', repo, 'diff', '--name-only', baseRef], opts);
  const untracked = execFileSync(git, ['-C', repo, 'ls-files', '--others', '--exclude-standard'], opts);
  return [...new Set([...tracked.split(/\r?\n/), ...untracked.split(/\r?\n/)].filter(Boolean))];
}

if (!cfg.immutable.baseRef) {
  notes.push(
    'git: immutability check disabled (immutable.baseRef is null); set it to the baseline commit'
  );
} else {
  // `git diff <ref>` compares the working tree to <ref>. With HEAD, a violation
  // that was committed is invisible: the diff is empty. Pin the ref to the
  // commit the package started from.
  if (/^HEAD(~\d+)?$/i.test(cfg.immutable.baseRef)) {
    notes.push(
      `git: baseRef is ${cfg.immutable.baseRef} — only uncommitted changes are visible; pin it to the baseline commit to also catch committed changes`
    );
  }
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
// 11. Cross-references and declared metrics
// ---------------------------------------------------------------------------

// "FDD §6.3" is a promise that the heading exists. File links are checked
// above; a dangling section number reads as authoritative while pointing
// nowhere — and it survives every check that only looks at files.
const docByName = { PRD: 'docs/PRD.md', RFC: 'docs/RFC.md', FDD: 'docs/FDD.md', TRACKER: 'docs/TRACKER.md' };
const headingCache = new Map();
function headingsOf(docPath) {
  if (!headingCache.has(docPath)) headingCache.set(docPath, headingNumbers(allDocs[docPath] || ''));
  return headingCache.get(docPath);
}
let refs = 0;
let brokenRefs = 0;
for (const [docPath, text] of Object.entries(allDocs)) {
  for (const m of text.matchAll(/\b(PRD|RFC|FDD|TRACKER)\s*,?\s*§\s*(\d+(?:\.\d+)*)/g)) {
    const target = docByName[m[1]];
    if (!allDocs[target]) continue;
    refs++;
    if (!headingsOf(target).has(m[2])) {
      brokenRefs++;
      problems.push(
        `${docPath}: section reference "${m[0]}" does not resolve (no heading ${m[2]} in ${target})`
      );
    }
  }
}
if (refs) notes.push(`section references: ${refs - brokenRefs}/${refs} resolve`);

// The tracker states its own coverage. If the stated number and the computed
// number disagree, the document is lying about its own evidence — and that lie
// is invisible to every other check.
if (tracker) {
  const computed = [
    { name: 'transcript locators', ok: transcriptOk, total: transcriptTotal },
    { name: 'code paths', ok: codeOk, total: codeRows.length },
  ];
  const claimRe = /(\d+)\s*(?:de|\/)\s*(\d+)\s*(?:\(|=|\s)*\s*(\d+(?:[.,]\d+)?)\s*%/gi;
  let claims = 0;
  let checked = 0;
  for (const m of tracker.matchAll(claimRe)) {
    const num = Number(m[1]);
    const den = Number(m[2]);
    const pct = Number(m[3].replace(',', '.'));
    claims++;
    const metric = computed.find((c) => c.total === den);
    // Only claims whose denominator matches a metric this validator computes
    // can be judged. A "9 de 9 RFs" claim is left alone, with a note.
    if (!metric) continue;
    checked++;
    const expected = den ? (metric.ok / den) * 100 : 0;
    if (num !== metric.ok || Math.abs(pct - expected) > 0.5) {
      problems.push(
        `TRACKER: declared coverage ${num}/${den} (${m[3]}%) contradicts computed ${metric.ok}/${den} (${expected.toFixed(1)}%) [${metric.name}]`
      );
    }
  }
  if (claims) {
    notes.push(`TRACKER: coverage claims ${checked}/${claims} checked against computed values`);
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

// The numbers the tracker is supposed to state. Printed on demand so the
// summary block is copied from the computation instead of counted by hand.
if (showSummary) {
  console.log('\n=== SUMMARY ===');
  console.log(`  TRACKER rows: ${trackerRows.length}`);
  console.log(`  transcript rows: ${transcriptTotal}`);
  console.log(`  transcript locators: ${transcriptOk}/${transcriptTotal}`);
  console.log(`  code rows: ${codeRows.length}`);
  console.log(`  code paths: ${codeOk}/${codeRows.length}`);
}

process.exit(problems.length ? 1 : 0);
