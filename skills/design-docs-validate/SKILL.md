---
name: design-docs-validate
description: Validates a design docs package from a transcript using the Goldfish protocol in the Chain of Custody method — four checks in zero-context subagents (comprehension, adversarial review, implementation readiness, provenance) plus the mechanical check of locators, code paths, allowed sources and immutability. Use in phase F8 of the method, after the PRD/RFC/FDD/ADR documents are written and before publishing. The author never validates their own work.
---

# design-docs-validate — F8: Goldfish + mechanical verification

Two distinct things, and both are mandatory:

1. **Mechanical check** — runs as a script, is deterministic, catches wrong facts.
2. **Goldfish protocol** — runs in zero-context subagents, is probabilistic, catches **ambiguity**.

A document can pass every mechanical check and still be useless: nothing in it is false, but nothing in it is clear. That is exactly the void Goldfish fills.

## Why zero context

Whoever wrote it understands what they meant. That is the curse: the author fills the gaps in their own text without realizing they exist.

Goldfish is a reviewer who **does not know what you meant**. It has only the document. When it gets something wrong, the mistake belongs to the document — and it is the same mistake the first engineer will make.

That is why each check runs in a new subagent, with **only the document**. Do not pass your own context in the prompt, do not explain the decision, do not defend it. If you need to explain for the reviewer to understand, the document has already failed.

## Part 1 — Mechanical check

```bash
node <framework-root>/scripts/verify.mjs <repo> <config.json>
```

(`<framework-root>` is the `chain-of-custody` checkout — `../../` when this skill sits inside that repo, the absolute path otherwise.)

No git on the PATH? Set `COC_GIT_BINARY` to the absolute path of the binary, or pass `immutable.gitBinary` in the config. The environment variable is preferred because it keeps the config portable.

The script verifies:

| # | Check |
|---|---|
| 1 | Required files exist; optional documents are checked when present and reported when absent |
| 2 | ADRs: count, name `ADR-NNN-kebab.md`, MADR sections |
| 3 | Encoding: no `U+FFFD`, no cp1252 mojibake (accents turned into two-character sequences) |
| 4 | PRD: FRs, out of scope with category marked, risks with probability |
| 5 | RFC (when present): alternatives with trade-off, open questions, ADR links resolve |
| 6 | FDD (when present): input **and** output per contract, error prefix, observability on three axes, real paths in the integration |
| 7 | Tracker: exact header, allowed sources, each locator resolves in the source, minimum coverage |
| 8 | Every cited code path exists (or is in `newPathAllowlist`) |
| 9 | README with code blocks |
| 10 | Nothing changed outside the allowed area (`git diff --name-only <baseRef>`) |

The locator format is configuration, not code: `source.locatorPattern` and `tracker.locatorPattern` each capture the time (group 1) and the speaker (group 2). The default is `[hh:mm] Name`; a different format is a config change. RFC and FDD are optional by default — `docs.required` and `docs.optional` decide what must exist.

**When the script complains, the document is almost always wrong — but not always.** A validator has bugs too. Before "fixing" the document, confirm the problem is real: open the file at the line it points to. If the document is right and the script is wrong, fix the script; do not work around the document to please a regex.

The reverse is more dangerous: adjusting the text until the regex passes. That turns the check into theater.

## Part 2 — Goldfish protocol

Four checks. Launch a **fresh** agent for each one — never `fork`, which inherits the author's full context. The zero-context condition is not a suggestion; it is what makes the check valid.

### Enforcing zero context

A fresh agent starts with only what you put in the prompt. It is not literally empty: the host may inject project instructions and memory. The framework cannot control that, so remove the contamination you can:

- **Never `fork`.** A fork carries the conversation — the author's reasoning, the decisions, the earlier drafts. The critique then measures the author's intent, not the document.
- **Put only the document in the prompt** — inline text, or a path to a copy in an isolated directory. No history, no justification, no other documents, no transcript.
- **Restrict the tools.** If the document is inline, the agent needs no tools. If it is a path, give it `Read` on that copy only — not the repository, where the transcript and the other documents sit.
- **One agent per check.** No shared memory between checks; a critique that builds on the previous one is no longer independent.

**G4 is the exception.** Provenance cannot be checked without the source: the agent needs the document **and** the source (or the relevant excerpt), plus the ledger. It still gets no author reasoning.

**Contamination test.** If the critique cites the author's intent ("you meant X") instead of the document's text ("the document says X, but does not define Y"), the run is contaminated. Discard it and run again with a cleaner prompt. The first engineer who picks up the document will not have the author's intent either.

### G1 — Comprehension

Prompt:

> Read only this document. Then, without consulting anything else: (a) describe the proposed architecture; (b) explain the intent of each main decision; (c) list what you could not determine and why.

**Pass criterion:** the subagent reconstructs the intent without inventing, and what it lists as undetermined is detail — not the backbone.

If it gets the architecture wrong, that is not its failure. The document is ambiguous exactly there.

### G2 — Adversarial review

Prompt:

> You are a skeptical reviewer hired to reject this document. It must be rejected. Find: internal contradictions, missing decisions, unhandled edge cases, claims without verifiable support. Quote the passage and explain why it fails.

**Run two or three instances in parallel, with different attacks** — one focused on contradiction, one on edge cases, one on unsupported claims.

Independent critics fail in different places. The **intersection** of the critiques is what must be fixed; the **union** is what teaches you where the text is weak.

### G3 — Implementation readiness

Prompt:

> Based only on this document, could you start implementing without asking any questions? List every question you would need to ask before writing the first line.

**Go/no-go.** A question with no answer in the document is a gap, not a detail. But not every question blocks: separate the ones that prevent starting from the ones that can be resolved along the way.

### G4 — Provenance

Prompt:

> Pick ten concrete claims at random in this document (requirements, decisions, numbers, names). For each one, is there a locator in the source or a code path that supports it? Go to the source and confirm. Point out any that do not resolve or that were attributed to the wrong speaker.

**This is Chain of Custody's contribution to the original protocol.** The first three test **clarity**; this one tests **truth**. A document can be perfectly clear about something nobody decided.

Run G4 on all four documents, not only on the tracker. The tracker can be correct while an FR in the PRD describes something nobody approved.

## The cycle

```
      ┌─── writer (Elephant) ───┐
      │                           │
      ▼                           │
  [document] ──► G1 ─ G2 ─ G3 ─ G4
                    │    │    │    │
                    └────┴────┴────┘
                           │
                    critiques come back
```

Fix and resubmit. **The cycle ends when G1 passes without correction and G3 gives go.**

Do not stop at the first clean pass of G3 if G4 has not run yet. And do not accept a G2 with no rejections at all: an adversarial critic that found nothing was almost certainly not adversarial enough.

## Before publishing

- [ ] Mechanical check: 0 problems.
- [ ] G1: reconstructed the architecture correctly.
- [ ] G2: the intersection's critiques were fixed or explicitly rejected with a reason.
- [ ] G3: go, with the remaining questions classified as non-blocking.
- [ ] G4: 10/10 claims resolve in the source; no speaker swapped.
- [ ] Every check ran in a fresh agent (never `fork`), and no critique cited the author's intent instead of the document's text.
- [ ] `git diff` shows changes only in the allowed area.

If any item fails, do not publish. A published package with a known problem is worth less than a delayed one.
