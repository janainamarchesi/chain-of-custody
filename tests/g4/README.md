# G4 sensitivity experiment

G4 is the provenance check: *pick claims and confirm each one resolves in the source.* It is the only check in the protocol that tests truth rather than clarity — a document can be perfectly clear about something nobody decided.

The problem: G4 is a **protocol**, not a script. You cannot unit-test "an agent reading carefully." So this experiment measures the protocol the way you measure a detector — with a fixture that contains known fabrications and a scorer that reports precision and recall.

## The question this answers

If you hand a zero-context agent a design document and a transcript, does it actually find the sentences that have no support? Or does it produce a plausible review that misses them?

A method that claims traceability should be able to show its own check works. That is the point of this directory.

## Files

| File | Role |
|---|---|
| `fixture-hard.md` | The document under test. An unnumbered, realistic FDD with 7 subtle fabrications. |
| `ground-truth-hard.json` | The answer key, including derived claims that should not count as fabrications. |
| `score-hard.mjs` | Scores runs against the answer key. |

**Never give the ground-truth file to the agent under test.** It is the answer key. An agent that reads it is not being measured; it is copying.

## Protocol

For each run:

1. Copy only `TRANSCRICAO.md` and the fixture into an isolated directory. Nothing else — no codebase, no ground truth, no README.
2. Launch a **zero-context** agent with a prompt that does not reveal how many errors exist or what kinds they are. Telling the agent "there are 7 fabrications" converts the experiment into a spot-the-difference game.
3. The agent writes its analysis to a file and prints one `FLAG: "<sentence>" | <reason>` line per unsupported claim.
4. Score the output against the ground truth.

Run at least three prompts with **different framings** — a generic validator, a skeptical reviewer, an audit — because a single prompt measures the prompt, not the protocol. If all three find the same set, the finding is the protocol's; if they diverge, the divergence is the interesting result.

## Scoring

```bash
node tests/g4/score-hard.mjs <run1.md> <run2.md> ...
```

The scorer reports, per run:

- **caught** — fabrications that were flagged
- **MISSED** — fabrications that were not
- **false alarms** — genuinely supported claims that were flagged
- **derived hit** — claims that are engineering derivation rather than fabrication; neither caught nor false alarm
- **precision** — caught ÷ (caught + false alarms + unclassified)
- **recall** — caught ÷ total fabrications

Unclassified flags count against precision. Otherwise an agent that flags every sentence would score 100% precision, which is exactly backwards. The script exits 1 if any fabrication was missed.

## The easy variant, and why it is not here

The first fixture had 20 numbered claims, 8 of them fabricated. Three zero-context runs returned the same flag set and scored **100% precision and 100% recall with zero variance**.

That result is not evidence that the protocol is reliable — it is evidence that the fixture was too easy. Three things gave it away:

- The claims were **numbered**, so the agent could work line by line instead of reading for meaning.
- The source is short enough to hold in view, so "find the passage" was exhaustive rather than selective.
- The fabrications were the ones the author designed, and the author knew where they were.

The easy fixture and its scorer were removed when the hard variant replaced them. The result is recorded here so the starting point is not lost — but shipping a test whose own documentation calls it meaningless would be the opposite of credibility.

The hard variant removes all three advantages: the document is unnumbered and realistic, the fabrications are subtle (single-value swaps that keep the document internally coherent, plausible engineering additions presented as decisions, and scope conflations that sit next to genuine scope statements), and the answer key distinguishes fabrication from derivation so that a correct flag on a derivation is not scored as a false alarm.

A test that cannot fail measures nothing.

## The limitation to report honestly

Even on the hard variant, this measures **one transcript, one document, one author's fabrications**. A perfect score proves the protocol can work on this fixture; it does not prove it works on yours. If you run it and it fails, that failure is more useful than another success — open an issue with the source type and the fabrication that got through.

### A divergence from the protocol as written

The G4 prompt in `README.md §6` and in `skills/design-docs-validate/SKILL.md` says: *pick ten claims at random, confirm each resolves.* This experiment asks for **every** claim in the document, not a sample of ten.

That is deliberate, and it is also a limitation. Sampling ten claims from a 20-claim document detects a fabrication only if the sample happens to include it; with 8 of 20 fabricated, a ten-claim sample misses everything with probability ≈ 0.0004 — but with 7 of ~40 claims fabricated in the hard variant, a ten-claim sample misses all seven with probability ≈ 0.11. Exhaustive auditing measures the protocol's **ceiling**, not its deployed behavior.

So the score here answers "can the protocol find these when it looks?" — not "will it find them when it samples?". If you want to measure the deployed protocol, run G4 as written: ten claims, three times, and score the union. That is a different experiment and it has not been run here.

The honest framing for the result: this is an upper bound on detection quality, measured on a fixture the author designed. It is evidence that the protocol's *instructions* are sufficient to find subtle fabrications when followed exhaustively — not evidence that the protocol catches them in normal use.

### An operational finding: exhaustive auditing does not fit in one response

Two of the first three hard-variant runs died with `response exceeded the 32000 output token maximum`. Both had been asked to audit the whole document and report every unsupported claim. Neither produced a partial file — the run failed before writing.

That is worth recording, because it is a property of the method rather than of the harness. An exhaustive provenance audit of a 40-claim document generates more analysis than one response can hold. In practice the protocol avoids this by *sampling* ten claims — which is exactly why G4 is written as a sample and not a sweep. A team that tries to sweep the whole document will hit the same ceiling.

The bounded brief used for the runs that did complete caps the output at 25 flags and forbids prose. That is a workaround, not a fix: it changes the measurement from "audit everything" to "audit until the budget runs out," which is closer to how the protocol actually behaves.
