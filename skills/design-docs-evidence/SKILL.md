---
name: design-docs-evidence
description: Builds the evidence base of a design docs package — the table of classified facts (Decision, Requirement, Constraint, Discard, Defer, Open, Code hook, Noise) with a locator for each, plus the integration surface map with real symbols from the existing system. Use in phase F1 of the transcript-to-design-docs framework, after reading the entire deliberation source and before writing any delivery document. Without this base, the tracker does not close and the document turns into generic prose.
---

# design-docs-evidence — F1: the evidence base

This is the phase that decides the quality of the entire package. Everything else is consolidation of what you produce here.

Your final product is **one file**: `docs/EVIDENCE.md` (template at `../../templates/EVIDENCE.md`). It is not a client deliverable — it is your ballast. But it is what prevents invention.

## Golden rule

**Read the entire source. Once, from beginning to end, before classifying anything.**

A sampled transcript produces two failures that only show up at the end: a plausible citation of a statement that never existed, and omission of a decision made in the final minute. Both are irreversible once the document is written, because the text becomes coherent around the error.

If the source is large, split the **reading** into blocks, but produce the table **a single time**, at the end.

## Step 1 — Scan the source

For each turn, paragraph, or comment, decide whether it contains something classifiable. Mark the type:

| Type | What it is | Goes to |
|---|---|---|
| **Decision** | A closed choice among alternatives | ADR (+ RFC) |
| **Requirement** | What the system must do | PRD (FR/NFR) |
| **Constraint** | A technical, organizational, or deadline limit | PRD (NFR), FDD |
| **Discard** | Explicitly rejected | PRD §out of scope — *never* as a requirement |
| **Defer** | Accepted for later | PRD §out of scope — marked as deferred |
| **Open** | Acknowledged, not decided | RFC §open questions — *never* as a requirement |
| **Code hook** | Mentions an existing component/symbol | Surface map |
| **Noise** | Social talk, digression, repetition | Nothing |

Record the locator **at the moment of reading**, copied, not typed from memory. Wrong speaker names are the most common defect and the hardest to detect later.

## Step 2 — Separate the four categories of negative scope

This is the distinction that is most often lost and causes the most damage.

- **Discarded** — it was considered and rejected. "We are not doing this."
- **Deferred** — it was accepted as an idea, but not in this phase. "Later."
- **Open** — it was acknowledged and nobody decided. "Watch it and decide later."
- **Out of scope by definition** — it was never a subject of this feature.

> An "open" item promoted to a requirement is the most subtle invention there is: you did not invent the subject, you invented the **decision**. The requirement looks legitimate because the topic is in the source.

Write the "What does NOT go in" list in `EVIDENCE.md` with each item's category. It is consulted later in every document.

## Step 3 — Build the integration surface map

For each existing component the feature couples to, record four fields:

| Field | What goes in |
|---|---|
| **Real symbol** | Exact name: class, function, route, table, component. With signature if it is callable. |
| **Today** | What that symbol does in the current system — verified by reading the file, not inferred from the name. |
| **How it couples** | The exact point: call, extension, wrapper, injection, event, migration. |
| **What it obliges** | The design consequence: what it guarantees, what can break, what the feature now owes this component. |
| **Origin** | The real file path. |

The **"What it obliges"** field is what separates a map from a list. `OrderService.changeStatus` runs inside a Prisma transaction — this *obliges* the event record to happen in the same transaction, and that obligation is the central technical argument of an ADR. Without that field, you have an inventory, not an analysis.

Open the files. Do not trust the file name or your memory of what it does.

## Step 4 — Raise the ADR candidates

A decision deserves an ADR when: it was **closed** in the source, it had a **real alternative** considered, and it has a **negative consequence** worth recording.

List the candidates with a locator and the alternative that was discarded. If a candidate has no real alternative considered, it is not a decision — it is a requirement, and it goes to the PRD.

## Step 5 — Record the source gaps

List what the package will need and the source does **not** provide: dates, author, numeric target, retention policy, edge-case behavior.

This list is a valuable deliverable. It becomes the RFC's open questions and prevents you from filling the gap with what seems reasonable.

## Step 6 — Verify before moving on

Check mechanically, not from memory:

- [ ] Every locator in this table exists literally in the source, with that speaker.
- [ ] Every code path cited exists in the repository.
- [ ] Every item marked Discard/Defer is in the "does not go in" list, with a category.
- [ ] No "open" item is described as if it were a requirement.
- [ ] The engineering derivations (what is yours, not from the source) are in a separate list — they go to the tracker appendix.

A verification script can be written now for the first two items. It is worth it: fixing things here is cheaper than in seven documents.

## Before moving on to F2

You must be able to answer, without consulting anything:

- What the 5–8 closed decisions are and why each was chosen.
- What was discarded, deferred, and left open — and the difference between the three.
- Which real symbols of the system the feature touches and what each one obliges.
- What the source does not answer.

If any of these answers does not come immediately, the base is incomplete. Do not move on.
