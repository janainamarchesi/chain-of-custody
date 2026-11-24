#!/usr/bin/env node
/**
 * G4 hard-fixture scorer.
 *
 * Parses `FLAG: <quoted sentence> | <reason>` lines from one or more zero-context
 * run outputs and classifies each against the ground truth:
 *
 *   fabrication  -> a true positive if flagged
 *   derived      -> neither caught nor false alarm; reported separately
 *   supported    -> a false alarm if flagged
 *   unclassified -> flagged but matching nothing in the ground truth
 *
 * Usage: node tests/g4/score-hard.mjs <run1.md> [run2.md ...]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const gt = JSON.parse(
  fs.readFileSync(path.join(here, 'ground-truth-hard.json'), 'utf8').replace(/^﻿/, ''),
);

const runs = process.argv.slice(2);
if (runs.length === 0) {
  console.error('usage: node tests/g4/score-hard.mjs <run1.md> [run2.md ...]');
  process.exit(2);
}

function flagsOf(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = /^[-*]?\s*FLAG\s*:\s*(.+)$/i.exec(line);
    if (!m) continue;
    const body = m[1].trim();
    if (/^none$/i.test(body) || /^nenhum/i.test(body)) continue;
    out.push(body);
  }
  return out;
}

const norm = (s) => s.toLowerCase().replace(/[`*_]/g, '').replace(/\s+/g, ' ');

/**
 * A single flag may quote a whole paragraph and match several claims at once.
 * Return every match, not just the first, so a bundled quote still gets credit.
 * `match` may be a string or a list of alternatives (e.g. "4 horas" and "4h").
 */
const matchesAny = (haystack, match) =>
  (Array.isArray(match) ? match : [match]).some((m) => haystack.includes(norm(m)));

function classify(flag, gt) {
  const f = norm(flag);
  const hits = (list, kind) =>
    list.filter((x) => matchesAny(f, x.match)).map((x) => ({ kind, id: x.id }));
  const fab = hits(gt.fabrications, 'fabrication');
  const der = hits(gt.derived_claims, 'derived');
  const sup = hits(gt.supported_spot_check, 'supported');
  // A flag quoting a whole paragraph may contain both a fabrication and a
  // genuinely supported clause. Flagging that paragraph is a correct catch, not
  // a false alarm on the supported clause inside it — so supported hits only
  // count when the flag matches nothing else.
  if (fab.length) return { kind: 'fabrication', ids: fab.map((x) => x.id), all: [...fab, ...der] };
  if (der.length) return { kind: 'derived', ids: der.map((x) => x.id), all: der };
  if (sup.length) return { kind: 'supported', ids: sup.map((x) => x.id), all: sup };
  return { kind: 'unclassified', ids: [], all: [] };
}

const results = [];
for (const file of runs) {
  const flags = flagsOf(file);
  const seen = new Set();
  const caught = new Set();
  const derivedHit = new Set();
  const falseAlarms = new Set();
  const unclassified = [];

  for (const flag of flags) {
    const c = classify(flag, gt);
    for (const h of c.all) {
      if (h.kind === 'fabrication') caught.add(h.id);
      else if (h.kind === 'derived') derivedHit.add(h.id);
      else falseAlarms.add(h.id);
      seen.add(h.id);
    }
    if (c.kind === 'unclassified') unclassified.push(flag);
  }

  const totalFab = gt.fabrications.length;
  const missed = gt.fabrications.filter((x) => !caught.has(x.id)).map((x) => x.id);
  // Precision is "of everything you flagged, how much was actually a fabrication".
  // A flag that matches nothing in the ground truth is still a flag — counting it
  // as harmless would reward an agent that flags every sentence in the document.
  const wrongFlags = falseAlarms.size + unclassified.length;
  const precision = caught.size + wrongFlags > 0
    ? caught.size / (caught.size + wrongFlags)
    : 0;
  // Strict precision counts every flag against the agent. Lenient precision
  // excludes flags that land on a derived/ambiguous claim, since those are a
  // defensible reading of the document rather than a mistake. Report both: a
  // gap between them means the document itself is ambiguous, which is a finding.
  const lenient = caught.size + falseAlarms.size > 0
    ? caught.size / (caught.size + falseAlarms.size)
    : 0;
  const recall = caught.size / totalFab;

  results.push({
    file: path.basename(file),
    flags: flags.length,
    caught: [...caught],
    missed,
    derivedHit: [...derivedHit],
    falseAlarms: [...falseAlarms],
    unclassified,
    precision,
    lenient,
    recall,
  });
}

console.log('=== G4 HARD PROVENANCE SCORE ===');
console.log(`Ground truth: ${gt.fabrications.length} fabrications, ${gt.derived_claims.length} derived, ${gt.supported_spot_check.length} supported spot-checks.\n`);

for (const r of results) {
  console.log(`[${r.file}]`);
  console.log(`  flags:        ${r.flags}`);
  console.log(`  caught:       ${r.caught.length}/${gt.fabrications.length}  ${r.caught.join(', ')}`);
  if (r.missed.length) console.log(`  MISSED:       ${r.missed.join(', ')}`);
  if (r.derivedHit.length) console.log(`  derived hit:  ${r.derivedHit.join(', ')}  (neither caught nor false alarm)`);
  if (r.falseAlarms.length) console.log(`  false alarms: ${r.falseAlarms.join(', ')}  (supported claims flagged)`);
  if (r.unclassified.length) {
    console.log(`  unclassified: ${r.unclassified.length}`);
    for (const u of r.unclassified) console.log(`      - ${u.slice(0, 140)}`);
  }
  console.log(`  precision:    ${(r.precision * 100).toFixed(1)}% strict   ${(r.lenient * 100).toFixed(1)}% lenient   recall: ${(r.recall * 100).toFixed(1)}%`);
  console.log('');
}

if (results.length > 1) {
  const mean = (k) => results.reduce((a, r) => a + r[k], 0) / results.length;
  const mode = (k) => {
    const counts = new Map();
    for (const r of results) {
      const key = r[k].slice().sort().join(',');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  };
  console.log('=== AGGREGATE ===');
  console.log(`runs: ${results.length}   mean precision: ${(mean('precision') * 100).toFixed(1)}%   mean recall: ${(mean('recall') * 100).toFixed(1)}%`);
  const [key, n] = mode('caught');
  console.log(`identical caught-set across ${n}/${results.length} runs: ${key || '(none)'}`);
  const allSame = results.every((r) => r.caught.slice().sort().join(',') === key);
  console.log(`variance in caught-set: ${allSame ? 'none — suspiciously stable' : 'present'}`);
}

const anyMiss = results.some((r) => r.missed.length > 0);
process.exit(anyMiss ? 1 : 0);
