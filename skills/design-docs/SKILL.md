---
name: design-docs
description: Transforms a deliberation source (meeting transcript, ticket/PR/Slack thread, discovery document) into a complete design docs package — PRD, RFC, FDD, ADRs, and a traceability tracker — without inventing a requirement, a decision, or a file path. Use when the user asks to "document from the transcript", "generate PRD/RFC/FDD/ADR", "produce the design docs package", or mentions the Chain of Custody method. Orchestrates the design-docs-evidence, design-docs-write, and design-docs-validate skills.
---

# design-docs — F0: orchestration

You are in the role of **Elephant**: the long-context session that carries the end-to-end view. No document is written before you have read the entire source.

The full method is in `../../` (read `README.md` and `METHOD.md` before starting). This skill is the entry point and the conduct contract.

## Non-negotiables

These five rules apply to the whole package. If you break one of them, the delivery is invalid even if it looks good.

1. **Source before prose.** Nothing enters a document without a locator that resolves in the source, or a real path in the existing system.
2. **One altitude per document.** PRD = why and what. RFC = what we propose and what is open. ADR = why exactly this way. FDD = how, in detail. Tracker = where it came from.
3. **Provenance or exclusion.** Every statement is `SOURCE` (it has a locator), `DERIVED` (it is your elaboration, it goes to the tracker appendix), or `UNKNOWN` (it has no origin → **remove it**).
4. **What is left out is also content.** Discarded ≠ deferred ≠ open. All three must appear, and none may reappear as a requirement.
5. **The author does not judge their own work.** Validation runs in a zero-context subagent, never in you.

## F0 — what to do before any writing

### 0.1 Locate the deliberation source

Ask yourself (or the user, if it is not clear): where were the decisions made and **not** recorded?

| Format | Typical locator |
|---|---|
| Meeting transcript | `[hh:mm] Name` |
| Ticket thread | `#comment-<id>` |
| PR comments | `review:<id>` |
| Slack thread | `<channel>/<timestamp>` |
| Discovery document | `§<section>` |

The locator must be **unique and script-verifiable**. If you cannot write a regex that finds it in the source, it is not usable for the tracker.

Read the **entire** source. Do not sample. A sampled transcript produces a generic package with plausible and wrong citations.

### 0.2 Map the integration surface

Survey what already exists and what the feature will couple to. Name the real symbol, path, and signature — do not paraphrase. The result goes into the `EVIDENCE.md` map and feeds the "Integration with the existing system" section of the FDD.

### 0.3 Decide the package

Confirm with the user what will be delivered. The default is:

```
docs/PRD.md
docs/RFC.md
docs/FDD.md
docs/adrs/ADR-NNN-title-in-kebab-case.md   (5 to 8)
docs/TRACKER.md
README.md
```

Adjust if the source cannot support that — for example, if there are no closed architectural decisions, ADRs are the wrong piece and you say so instead of inventing decisions.

### 0.4 Declare the writing boundary

**Before writing anything**, establish and record:

- Which paths you may touch (`docs/**`, `README.md` in the typical case).
- Which are **immutable** (source code, schema, tests, configuration, the source itself).

If the user said "do not change the code", that is absolute. It is not a style preference; it is the difference between documenting a system and modifying it without authorization. Record the git `baseRef` so the immutability check can prove it later.

### 0.5 Write the configuration

Copy `../../config.example.json` into the project and adjust it: source file, locator regex, code path patterns, sources allowed in the tracker, minimums per document, immutable area.

Pay attention to `code.newPathAllowlist`: these are the **new** files the feature proposes to create. They legitimately do not exist yet. Everything not in that list must exist — and you check it.

## The phases

| Phase | What happens | Skill |
|---|---|---|
| F0 | Source, surface, package, boundary, config | **this one** |
| F1 | Evidence base and surface map | `design-docs-evidence` |
| F2 | ADRs | `design-docs-write` |
| F3 | RFC | `design-docs-write` |
| F4 | FDD | `design-docs-write` |
| F5 | PRD | `design-docs-write` |
| F6 | Tracker | `design-docs-write` |
| F7 | Process README | `design-docs-write` |
| F8 | Goldfish + mechanical check | `design-docs-validate` |
| F9 | Commit and publication | you |

**Why ADRs come before everything:** decision is the skeleton. With decisions closed, the RFC becomes consolidation instead of prose, and the FDD references concrete decisions instead of reopening them. **PRD last** among the large documents because, sitting at a higher altitude, it benefits from everything decided below it.

The order is not optional when there are ADRs. Without it, the RFC proposes what the ADR later contradicts.

## How to conduct

1. Do all of F0. Do not skip to writing.
2. Invoke `design-docs-evidence` and produce the **entire** `EVIDENCE.md` before opening a delivery document.
3. Invoke `design-docs-write` phase by phase, checking the tracker at each one.
4. Invoke `design-docs-validate`. If it comes back with a critical finding, fix it and resubmit.
5. Publish only with G1 clean and G3 on go.

## The mistake you will make

The default mistake is **writing well about what was not decided**. The text reads fluently, coherently, and describes a system nobody approved. That is why rule 3 exists and why check G4 runs afterwards: fluency is the most effective disguise for invention.

If at any point you catch yourself writing "the system should" without knowing where it came from — stop, go back to `EVIDENCE.md`, and look for the line. If it is not there, the sentence does not go in.
