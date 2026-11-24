#!/usr/bin/env node
/**
 * mutate.mjs — mutation test for verify.mjs.
 *
 * The validator is only worth trusting if it fails when it should. This script
 * takes a known-good package, injects ONE defect at a time, and asserts that
 * the validator reports it. A mutation that survives is a hole in the check.
 *
 * Usage:
 *   node tests/mutate.mjs <package-dir> <config.json> [--keep]
 *
 *   <package-dir>  a clean design-docs package (the reference case)
 *   <config.json>  the validator config for that package
 *   --keep         keep the mutated copies on disk for inspection
 *
 * Exit code 0 = every expected detection happened.
 * Exit code 1 = at least one mutation survived (the validator has a hole).
 *
 * Each mutation is a pure text transform on one file. Nothing here writes to
 * the source package: every run copies it to a temp directory first.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const verifyScript = path.join(here, '..', 'scripts', 'verify.mjs');

const [pkgArg, cfgArg, ...flags] = process.argv.slice(2);
const keep = flags.includes('--keep');

if (!pkgArg || !cfgArg) {
  console.error('usage: node tests/mutate.mjs <package-dir> <config.json> [--keep]');
  process.exit(2);
}

const pkg = path.resolve(pkgArg);
const cfg = path.resolve(cfgArg);

// ---------------------------------------------------------------------------
// Mutations. Each one is a single defect that a correct validator must catch.
// `expect` is a substring of the problem the validator should print, or an
// array of substrings where any one counts as a detection.
// ---------------------------------------------------------------------------

const MUTATIONS = [
  {
    name: 'broken transcript locator',
    file: 'docs/TRACKER.md',
    expect: 'locator does not resolve',
    apply: (text) => {
      // Move one transcript row's timestamp to a time that does not exist.
      const m = text.match(/^(\|[^|]*\|[^|]*\|[^|]*\|[^|]*\| TRANSCRICAO \| )(\[\d{2}:\d{2}\])(.*)$/m);
      if (!m) throw new Error('no transcript row to mutate');
      return text.replace(m[0], `${m[1]}[23:59]${m[3]}`);
    },
  },
  {
    name: 'nonexistent code path',
    file: 'docs/TRACKER.md',
    expect: 'code path does not exist',
    apply: (text) => {
      const m = text.match(/^(\|[^|]*\|[^|]*\|[^|]*\|[^|]*\| CODIGO \| )(src\/[^\s|]+)(.*)$/m);
      if (!m) throw new Error('no code row to mutate');
      return text.replace(m[0], `${m[1]}src/does/not/exist.ts${m[3]}`);
    },
  },
  {
    name: 'disallowed source in the tracker',
    file: 'docs/TRACKER.md',
    expect: 'source not allowed',
    apply: (text) => text.replace(/^(\|[^|]*\|[^|]*\|[^|]*\|[^|]*\| )TRANSCRICAO( \|)/m, '$1DERIVED$2'),
  },
  {
    name: 'tracker header renamed',
    file: 'docs/TRACKER.md',
    expect: ['exact header not found', 'table header does not match'],
    apply: (text) => text.replace('| ID | Documento | Tipo |', '| ID | Doc | Tipo |'),
  },
  {
    name: 'FDD output example removed',
    file: 'docs/FDD.md',
    expect: 'output examples',
    apply: (text) => text.replace(/\*\*Response[^*]*\*\*/gi, '**Result**'),
  },
  {
    name: 'FDD observability loses metrics',
    file: 'docs/FDD.md',
    expect: 'does not mention metrics',
    apply: (text) => text.replace(/m[eé]tricas?/gi, 'numbers'),
  },
  {
    name: 'PRD loses an out-of-scope category marker',
    file: 'docs/PRD.md',
    expect: 'without discarded/deferred/open marking',
    apply: (text) => {
      const start = text.indexOf('### 5.2 Fora de escopo');
      if (start === -1) throw new Error('out-of-scope section not found');
      const head = text.slice(0, start);
      const tail = text.slice(start)
        .replace(/descartad[oa]s?/gi, 'removed')
        .replace(/adiad[oa]s?/gi, 'postponed')
        .replace(/em aberto/gi, 'pending');
      return head + tail;
    },
  },
  {
    name: 'RFC loses its open questions',
    file: 'docs/RFC.md',
    expect: 'open questions',
    apply: (text) => {
      const start = text.indexOf('## 6. Quest');
      if (start === -1) throw new Error('open-questions section not found');
      const end = text.indexOf('\n## ', start + 1);
      const body = text.slice(start, end === -1 ? undefined : end);
      const stripped = body.replace(/^\s*\d+\.\s+/gm, '   ');
      return text.slice(0, start) + stripped + (end === -1 ? '' : text.slice(end));
    },
  },
  {
    name: 'broken ADR link in the RFC',
    file: 'docs/RFC.md',
    expect: 'broken ADR link',
    apply: (text) => text.replace(/\]\(adrs\/[^)]+\.md\)/, '](adrs/ADR-999-does-not-exist.md)'),
  },
  {
    name: 'mojibake in a document',
    file: 'docs/PRD.md',
    expect: 'mojibake',
    apply: (text) => text.replace('ção', 'Ã§Ã£o'),
  },
  {
    name: 'ADR missing a MADR section',
    file: 'docs/adrs/ADR-001-outbox-no-mysql.md',
    expect: 'missing section',
    apply: (text) => text.replace(/^#+.*Consequ[^\n]*$/m, ''),
  },
  {
    name: 'README loses its code blocks',
    file: 'README.md',
    expect: 'code blocks',
    apply: (text) => text.replace(/```[a-z]*\n/g, '').replace(/```/g, ''),
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/** Copy the package to a temp dir. Skips .git and node_modules. */
function copyPackage(dest) {
  fs.cpSync(pkg, dest, {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      return base !== '.git' && base !== 'node_modules';
    },
  });
}

/** Run the validator against a directory. Returns {ok, problems}. */
function runVerify(dir) {
  let out = '';
  try {
    out = execFileSync(process.execPath, [verifyScript, dir, cfg], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
  }
  const problems = [];
  const section = out.split('=== PROBLEMS');
  if (section.length > 1) {
    for (const line of section[1].split(/\r?\n/)) {
      const t = line.trim();
      if (t.startsWith('- ')) problems.push(t.slice(2));
    }
  }
  return { problems, raw: out };
}

const results = [];

// Baseline: the unmutated copy must be clean. If it is not, every result below
// is meaningless — the validator is already complaining about something else.
const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coc-base-'));
copyPackage(baseDir);
const base = runVerify(baseDir);
const baseOk = base.problems.length === 0;
results.push({
  name: 'BASELINE (no mutation)',
  expected: '0 problems',
  got: baseOk ? '0 problems' : `${base.problems.length} problems`,
  pass: baseOk,
  problems: base.problems,
});
if (!keep) fs.rmSync(baseDir, { recursive: true, force: true });

for (const mut of MUTATIONS) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coc-mut-'));
  copyPackage(dir);

  const target = path.join(dir, mut.file);
  let applyError = null;
  try {
    const before = fs.readFileSync(target, 'utf8');
    const after = mut.apply(before);
    if (after === before) throw new Error('mutation produced no change');
    fs.writeFileSync(target, after, 'utf8');
  } catch (e) {
    applyError = e.message;
  }

  if (applyError) {
    results.push({
      name: mut.name,
      expected: mut.expect,
      got: `MUTATION FAILED TO APPLY: ${applyError}`,
      pass: false,
      problems: [],
    });
    if (!keep) fs.rmSync(dir, { recursive: true, force: true });
    continue;
  }

  const { problems } = runVerify(dir);
  const wanted = Array.isArray(mut.expect) ? mut.expect : [mut.expect];
  const caught = problems.some((p) => wanted.some((w) => p.includes(w)));
  results.push({
    name: mut.name,
    expected: mut.expect,
    got: caught ? 'caught' : problems.length ? `other problems: ${problems.join(' | ')}` : 'NOT CAUGHT',
    pass: caught,
    problems,
  });
  if (!keep) fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const width = Math.max(...results.map((r) => r.name.length));
console.log('\n=== MUTATION TEST ===\n');
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name.padEnd(width)}  -> ${r.got}`);
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} mutations detected.`);
if (failed.length) {
  console.log('\nSurviving mutations (the validator has holes here):');
  for (const f of failed) console.log(`  - ${f.name} (expected to see "${f.expected}")`);
}
if (keep) console.log(`\nMutated copies kept in ${os.tmpdir()}`);
process.exit(failed.length ? 1 : 0);
