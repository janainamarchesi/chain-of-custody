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
//
// `file` is either a path relative to the package root, or a function
// (dir) => relativePath. Use the function form when the filename is not known
// in advance — otherwise the mutation only works on the reference fixture and
// silently "fails to apply" on any package that names its files differently.
// ---------------------------------------------------------------------------

/** First ADR file in a package, so the ADR mutation is not tied to one name. */
function firstAdr(dir) {
  const adrDir = path.join(dir, 'docs', 'adrs');
  const name = fs.readdirSync(adrDir).filter((f) => /^ADR-.*\.md$/i.test(f)).sort()[0];
  if (!name) throw new Error('no ADR file found in docs/adrs');
  return path.join('docs', 'adrs', name);
}

const MUTATIONS = [
  {
    name: 'broken transcript locator',
    file: 'docs/TRACKER.md',
    expect: ['locator does not resolve', 'localizador não resolve'],
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
    expect: ['code path does not exist', 'caminho de código inexistente'],
    apply: (text) => {
      const m = text.match(/^(\|[^|]*\|[^|]*\|[^|]*\|[^|]*\| CODIGO \| )(src\/[^\s|]+)(.*)$/m);
      if (!m) throw new Error('no code row to mutate');
      return text.replace(m[0], `${m[1]}src/does/not/exist.ts${m[3]}`);
    },
  },
  {
    name: 'disallowed source in the tracker',
    file: 'docs/TRACKER.md',
    expect: ['source not allowed', 'fonte não permitida'],
    apply: (text) => text.replace(/^(\|[^|]*\|[^|]*\|[^|]*\|[^|]*\| )TRANSCRICAO( \|)/m, '$1DERIVED$2'),
  },
  {
    name: 'tracker header renamed',
    file: 'docs/TRACKER.md',
    expect: [
      'exact header not found',
      'table header does not match',
      'cabeçalho exato não encontrado',
      'cabeçalho de tabela diferente do esperado',
    ],
    apply: (text) => text.replace('| ID | Documento | Tipo |', '| ID | Doc | Tipo |'),
  },
  {
    name: 'FDD output example removed',
    file: 'docs/FDD.md',
    expect: ['output examples', 'exemplos de saída'],
    apply: (text) => text.replace(/\*\*Response[^*]*\*\*/gi, '**Result**'),
  },
  {
    name: 'FDD observability loses metrics',
    file: 'docs/FDD.md',
    expect: ['does not mention metrics', 'Observabilidade não cita métricas'],
    apply: (text) => text.replace(/m[eé]tricas?/gi, 'numbers'),
  },
  {
    name: 'one out-of-scope item loses its category marker',
    file: 'docs/PRD.md',
    expect: [
      'out-of-scope item(s) without discarded/deferred/open marking',
      'sem marcação de descartado/adiado/em aberto',
    ],
    apply: (text) => {
      // Strip the marker from the FIRST numbered item only. The section still
      // carries markers on the other items, so a section-level check would pass
      // and only a per-item check catches this.
      const start = text.indexOf('### 5.2 Fora de escopo');
      if (start === -1) throw new Error('out-of-scope section not found');
      const end = text.indexOf('\n## ', start + 1);
      const body = text.slice(start, end === -1 ? undefined : end);
      const first = body.search(/^[ \t]*\d+\.\s+/m);
      if (first === -1) throw new Error('no numbered out-of-scope item found');
      const lineEnd = body.indexOf('\n', first);
      const item = body.slice(first, lineEnd === -1 ? undefined : lineEnd);
      const stripped = item.replace(/\*\*(descartad[oa]s?|adiad[oa]s?|em aberto)\*\*/gi, '**?**');
      if (stripped === item) throw new Error('first item had no category marker');
      const next = body.slice(0, first) + stripped + (lineEnd === -1 ? '' : body.slice(lineEnd));
      return text.slice(0, start) + next + (end === -1 ? '' : text.slice(end));
    },
  },
  {
    name: 'PRD loses all out-of-scope category markers',
    file: 'docs/PRD.md',
    expect: ['without discarded/deferred/open marking', 'sem marcação de descartado/adiado/em aberto'],
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
    expect: ['open questions', 'questões em aberto'],
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
    expect: ['broken ADR link', 'link de ADR quebrado'],
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
    file: firstAdr,
    expect: ['missing section', 'seção ausente'],
    apply: (text) => text.replace(/^#+.*Consequ[^\n]*$/m, ''),
  },
  {
    name: 'README loses its code blocks',
    file: 'README.md',
    expect: ['code blocks', 'blocos de código'],
    apply: (text) => text.replace(/```[a-z]*\n/g, '').replace(/```/g, ''),
  },
  {
    name: 'section reference points to a heading that does not exist',
    file: 'docs/PRD.md',
    expect: ['section reference', 'referência de seção'],
    apply: (text) => `${text}\n\nVer o contrato no FDD §99.9.\n`,
  },
  {
    name: 'tracker states a coverage number the data contradicts',
    file: 'docs/TRACKER.md',
    expect: ['declared coverage', 'cobertura declarada'],
    apply: (text) => {
      const den = (text.match(/^\|.*\| TRANSCRICAO \|/gm) || []).length;
      if (!den) throw new Error('no transcript rows');
      return `${text}\n\nLocalizações de transcrição que resolvem: 1 de ${den} (100%).\n`;
    },
  },
  {
    name: 'origin column carries an unknown value',
    file: 'docs/FDD.md',
    expect: ['invalid Origem value', 'valor inválido em Origem'],
    apply: (text) =>
      `${text}\n\n| Código | Origem |\n|---|---|\n| \`WEBHOOK_MUTATION\` | ? |\n`,
  },
  {
    name: 'SOURCE row carries no locator',
    file: 'docs/FDD.md',
    expect: ['SOURCE row', 'linha SOURCE', 'sem localizador nem caminho de código'],
    apply: (text) =>
      `${text}\n\n| Código | Origem |\n|---|---|\n| \`WEBHOOK_MUTATION\` | \`SOURCE\` |\n`,
  },
  {
    name: 'transcript row points at an ambiguous locator',
    file: 'docs/TRACKER.md',
    expectNote: 'ambiguous locators: 1 row|localizadores ambíguos: 1 linha',
    apply: (text, dir) => {
      const srcName = fs.readdirSync(dir).find((f) => /^TRANSCRI.*\.md$/i.test(f));
      if (!srcName) throw new Error('source transcript not found');
      const counts = new Map();
      for (const line of fs.readFileSync(path.join(dir, srcName), 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\[(\d{2}:\d{2})\]\s*([^:]+):/);
        if (!m) continue;
        const key = `${m[1]} ${m[2].trim()}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const once = [...counts].find(([, c]) => c === 1);
      const twice = [...counts].find(([, c]) => c > 1);
      if (!once || !twice) throw new Error('no unique and repeated locators');
      const fmt = (key) => {
        const i = key.indexOf(' ');
        return `[${key.slice(0, i)}] ${key.slice(i + 1)}`;
      };
      // Move every transcript row to a locator that appears once in the source,
      // then put the first row on one that appears twice. Exactly one
      // ambiguous row results, independent of the package's baseline count.
      let n = 0;
      return text
        .split(/\r?\n/)
        .map((line) => {
          if (!/^\|.*\| TRANSCRICAO \|/.test(line)) return line;
          n++;
          return line.replace(/\[[^\]]*\] [^|]+/, `${fmt(n === 1 ? twice[0] : once[0])} `);
        })
        .join('\n');
    },
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

/** Run the validator against a directory. Returns {ok, problems, notes}. */
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
  // The validator prints its report in English or Portuguese; the split must
  // accept either so the suite runs against both copies of the framework.
  const [notesBlock, problemsBlock = ''] = out.split(/=== (?:PROBLEMS|PROBLEMAS)/);
  // Problems are printed as "  - text"; notes as "  text". Collect each shape.
  const collectProblems = (text) =>
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- '))
      .map((l) => l.slice(2));
  const collectNotes = (text) =>
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  return {
    problems: collectProblems(problemsBlock),
    notes: collectNotes((notesBlock.split(/=== (?:NOTES|NOTAS)/)[1] || '')),
    raw: out,
  };
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

  const relFile = typeof mut.file === 'function' ? mut.file(dir) : mut.file;
  const target = path.join(dir, relFile);
  let applyError = null;
  try {
    const before = fs.readFileSync(target, 'utf8');
    const after = mut.apply(before, dir);
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
      applied: false,
      problems: [],
    });
    if (!keep) fs.rmSync(dir, { recursive: true, force: true });
    continue;
  }

  const { problems, notes } = runVerify(dir);
  const wanted = Array.isArray(mut.expect) ? mut.expect : mut.expect ? [mut.expect] : [];
  const caughtByProblem = wanted.some((w) => problems.some((p) => p.includes(w)));
  // A warning is a check that fires without failing the package. It is proven
  // the same way, by matching the note it prints.
  const caughtByNote = mut.expectNote
    ? notes.some((n) => new RegExp(mut.expectNote).test(n))
    : false;
  const caught = caughtByProblem || caughtByNote;
  results.push({
    name: mut.name,
    expected: mut.expect || mut.expectNote,
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
// The baseline is a control, not a mutation: it must pass, but it does not
// count toward the mutation score.
const mutations = results.filter((r) => r.name !== 'BASELINE (no mutation)');
const failedMutations = mutations.filter((r) => !r.pass);
const survived = failedMutations.filter((r) => r.applied !== false);
const notApplied = failedMutations.filter((r) => r.applied === false);
console.log(`\n${mutations.length - failedMutations.length}/${mutations.length} mutations detected.`);
if (survived.length) {
  console.log('\nSurviving mutations (the validator has holes here):');
  for (const f of survived) console.log(`  - ${f.name} (expected to see "${f.expected}")`);
}
if (notApplied.length) {
  console.log('\nMutations that could not be applied (the suite is broken, not the validator):');
  for (const f of notApplied) console.log(`  - ${f.name}: ${f.got}`);
}
if (keep) console.log(`\nMutated copies kept in ${os.tmpdir()}`);
process.exit(failed.length ? 1 : 0);
