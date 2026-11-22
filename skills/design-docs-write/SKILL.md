---
name: design-docs-write
description: Generates the design docs from a transcript in the Chain of Custody method — ADRs (MADR with a mandatory negative consequence), RFC, FDD, PRD, traceability tracker and process README — writing each document at the right altitude from the evidence base of phase F1. Use after design-docs-evidence and before design-docs-validate. Each document has a declared boundary; violating it produces duplication and, worse, contradiction between documents.
---

# design-docs-write — F2 to F7: writing at the right altitudes

The templates are in `../../templates/`. Use them. They encode the boundary decisions you would otherwise have to rediscover by making mistakes.

## The altitude table

Each document declares at the top the question it answers. If a paragraph does not answer that question, it belongs in another document — or in none.

| Document | Question | Contains | **Does not** contain |
|---|---|---|---|
| **ADR** | Why exactly this way? | One decision, real alternatives, consequences | Requirements, flows, contracts |
| **RFC** | What do we propose, and what is still open? | Architecture vision, alternatives, open questions (2–4 pages) | Implementation detail, error matrix |
| **FDD** | How to build it, in detail? | Flows, contracts with input and output, errors, observability, integration | Reopening a decision, product rationale |
| **PRD** | Why and what? | Problem, metrics, scope, FR/NFR, risks | How to implement |
| **Tracker** | Where did it come from? | One row per item, with locator | Analysis, prose |
| **README** | How was it done? | Real process, tools, corrections, iterations | Technical content of the feature |

Duplication is not the worst defect — it only inflates. The worst is **contradiction**: the RFC proposes something an ADR has already decided differently. That happens when you write out of order. ADRs first, always.

## F2 — ADRs

MADR format. One file per decision, `ADR-NNN-title-in-kebab-case.md`.

**Every ADR must have:**

- **Status** — proposed, accepted, superseded.
- **Context** — the situation that forced the decision, with a locator.
- **Decision** — what was chosen, in one clear sentence.
- **Considered Alternatives** — at least one, real, with the reason it was discarded. "We didn't consider anything" is a sign this is not a decision.
- **Consequences** — positive **and negative**.

**The negative consequence is mandatory.** Every real decision costs something. An ADR with no cost is an ADR that did not weigh the trade-off — it is probably selling the decision instead of documenting it. Use the sentence:

> We accept **\<specific cost\>** in exchange for **\<specific benefit\>**.

Do not write "more complex". Write which complexity, where it shows up, and who pays for it.

**At least one ADR must cite real paths from the existing code**, showing what is reuse and what is new. That is what separates "we decided X" from "we decided X *in this system*".

## F3 — RFC

2 to 4 pages. More than that is a disguised FDD; less is a summary.

Structure: metadata → TL;DR → context and problem → technical proposal (architecture vision, without descending into detail) → **considered alternatives with trade-off** → **open questions** → impact and risks → links to ADRs.

**Do not invent a date.** If the source does not have one, write "to be defined" or reference the deliberation. A plausible date in a metadata field is a hallucination that looks like rigor, and it contaminates the credibility of everything else.

Every alternative needs the trade-off that motivated discarding it — an alternative without a trade-off is decoration. Every open question needs a locator showing the source recognized it and did **not** decide it.

## F4 — FDD

The easiest document to falsify and the easiest to verify. It cites real paths, so a mistake is detectable by script.

**Contracts** — each with **input and output**. Input only, or output only, is not a contract. Use real examples, with plausible values and field names consistent with the rest of the document.

**Error matrix split by plane.** An error returned to the caller and an error persisted internally are different things, with different handling. Mixing them produces code that returns to the user an error that was meant for the log. Use the error prefix declared in the configuration.

**Observability on three axes: logs, metrics and tracing.** All three, with concrete fields. "Monitor the system" is not observability.

**Integration with the existing system** — the section that proves the document is about *this* system. At least four real paths, each with:

- **Today:** the real symbol and what it does (verified by opening the file).
- **How the feature fits in:** the exact coupling point.
- **Why it matters:** what it guarantees or what can break.

When citing a **new** file the feature proposes to create, say it is new — `` `src/server.ts` → **new** `src/worker.ts` ``. And register it in the configuration's `newPathAllowlist`. A nonexistent path presented as existing is the classic hallucination.

## F5 — PRD

Summary → problem and motivation → audience and scenarios → goals and metrics → scope → **FR (minimum 8)** → NFR → decisions → dependencies → **risks (minimum 2)** → acceptance criteria → tests.

**A metric without a number is not a metric.** If the source defined "under 10 seconds", write 10 s. If the source did not define it, write "to be defined" — and record the gap. Do not invent a target.

**Out of scope with the three categories marked.** Each item says whether it is discarded, deferred or open, with a locator. And — critical — **no item in that section may appear as a requirement later**. If rate limiting was left open, it does not become an FR.

**Risk with probability, impact, mitigation and contingency.** "Monitor the problem" is not mitigation. Mitigation changes behavior: index, limit, isolation, retry, fallback, feature flag.

## F6 — Tracker

Scan the **already finished** documents, not the evidence base. The tracker describes what is written, and what is written may have changed since F1.

One row per traceable item:

```
| ID | Document | Type | Summary | Source | Location |
```

- `Source` uses **only** the values from the configuration (`tracker.allowedSources` — e.g. `TRANSCRIPT`/`CODE`, or whatever the project defines).
- A transcript row → locator in the source's format (`[hh:mm] Name`).
- A code row → real file path.

**Three provenance values, and the third is forbidden:**

| Value | Meaning | Destination |
|---|---|---|
| `SOURCE` | Traceable to the raw source or the existing system | The traceability table, with a locator |
| `DERIVED` | Your engineering elaboration | **Appendix A**, never the table |
| `UNKNOWN` | No identifiable origin | **Delete it** |

If you inferred something the source did not say, it is not a fact: it is elaboration. Mixing the two destroys the tracker's value — it stops distinguishing what was said from what was thought, and starts giving both the same authority.

Verify every locator against the original file. Never from memory. The typical mistake is attributing a line to the wrong participant.

## F7 — README

It replaces the prompt statement with an account of the real process. Order: about the challenge → AI tools used → workflow adopted → custom prompts (in code blocks) → **iterations and adjustments** → how to navigate.

**The iterations section is the one that demands honesty.** List concrete corrections, with what was wrong and how it was discovered. A README that says "the process went well" documents no process at all. If you corrupted a file and fixed it, that is content.

## Before F8

- [ ] No discarded/deferred item appears as a requirement anywhere.
- [ ] No code path is presented as existing without existing (new ones are marked and in the allowlist).
- [ ] Every date, number and speaker name came from the source.
- [ ] Each document answers its boundary question and does not invade another.
- [ ] The tracker scans the final documents, not memory.
- [ ] The encoding is clean: no `U+FFFD`, and no two-character sequence that appears when UTF-8 is read as cp1252 and rewritten (the accent becomes two characters).
