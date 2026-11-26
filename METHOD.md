# METHOD — The phases in detail

Operational document. For the *why* behind the method, see [`README.md`](README.md).

---

## F0 — Package setup and scope

**Question:** what will be produced, from what, and what is off-limits?

### Inputs

- The source of the deliberation (transcript, thread, notes).
- The existing system (the repository, or access to it).
- The desired package format.

### Outputs

- List of documents to produce, with the boundary question for each one.
- List of valid source locators.
- Immutability rule: which parts of the system **may not** be changed.
- Isolated working directory for scripts and temporary artifacts.

### Rules

1. **The source is not modified.** If it is a file in the repository, it is read-only for the rest of the process.
2. **Scripts stay outside the repository.** Helper tools go into a working directory of their own and receive the repository as an argument. This prevents a helper from being committed by mistake and keeps the deliverable purely documentary.
3. **Verify the baseline before you start.** Record the state (commit hash, file list, what existed). Without it you cannot prove, at the end, that you only touched what you were supposed to.

### Package boundary

Not every deliberation needs every document. Choose by the size of the decision:

| Situation | Minimum package |
|---|---|
| Small, well-understood change | ADR + FDD |
| New feature with stakeholders | PRD + RFC + ADR + FDD |
| Full deliberation, with delivery to third parties | Full package + tracker + README |

The tracker and the README only make sense when the package will be **read or evaluated by someone** who did not take part in the deliberation.

---

## F1 — Evidence base

**Question:** what was actually said, by whom, and in which category?

This is the phase that determines the quality of all the others. Done well, the documents almost write themselves. Done badly, everything else is rework.

### Process

1. **Read the source in full.** Not a summary, not the excerpts that look important. Summaries discard exactly the nuance that decides scope — the passing remark that reveals something is out of bounds.
2. **Extract item by item**, with an exact locator.
3. **Classify** each item into one of the categories below.
4. **Confirm each locator** against the source before moving on.

### Extraction categories

| Type | What it is | Destination |
|---|---|---|
| `Decision` | Closed choice, with a discarded alternative | ADR |
| `Requirement` | Required behavior | PRD (FR) |
| `Constraint` | Imposed limit (technical, legal, commercial) | PRD (NFR), FDD |
| `Discard` | It was decided not to do it | "Out of scope", marked |
| `Deferral` | It will be done, just not now | "Out of scope", marked |
| `Open` | Not decided | RFC (open questions) |
| `Code hook` | Reference to the existing system | FDD (integration) |
| `Noise` | Social conversation, repetition, logistics | Nothing |

> **The distinction that matters most:** `Discard`, `Deferral` and `Open` are three different things. Merging all three into a "we won't do this" section hides the fact that one of them is still under debate, and someone will implement it.

### Integration surface map

In parallel, map what the feature touches in the existing system.

For each coupling point, record:

- **file path** (must exist)
- **real symbol** (class name, function signature, exported type)
- **how the new code couples to it** (extends, wraps, calls, replaces)
- **what that forces** (contract that cannot change, execution order, transaction)

Rule: if you cannot write the real signature, you do not know the coupling point — and the FDD will make one up.

### Artifacts

- Evidence table → [`templates/EVIDENCE.md`](templates/EVIDENCE.md)
- Surface map → final section of the same template

### Exit criteria

- Every decision, requirement and constraint item has a valid locator.
- Every discarded or deferred item is marked as such.
- Every code hook has a verified path.
- No item in the table is missing a category.

---

## F2 — Decisions (ADRs)

**Question:** why did we decide exactly this way?

### Selection

A decision becomes an ADR if it satisfies all three:

1. **It had a real alternative.** Someone argued for something else.
2. **It has a lasting consequence.** It will still be felt after the implementation is done.
3. **Someone will want to reopen it.** Without a record of the trade-off, the discussion starts from scratch.

Details that do not satisfy the three — a timeout chosen for convenience, a payload format — belong in the FDD, not in an ADR. Producing an ADR for everything dilutes the ones that matter.

### Structure (MADR)

```
# ADR-NNN — Short title

## Status
## Context          (the problem and the forces at play)
## Decision         (what was decided, affirmatively)
## Alternatives Considered   (≥1 real, with the reason it was discarded)
## Consequences     (positive AND negative, with the trade-off made explicit)
```

### Rules

- **One decision per file.** "We use outbox and retry and HMAC" is not one ADR; it is three.
- **The alternative must be real.** "Use worse technology" is not an alternative.
- **Negative consequences are mandatory.** An ADR with no accepted cost is advertising, not a record. If you cannot name the cost, the decision was not understood.
- **Name the trade-off**, not just the benefit: "we gain X at the cost of Y".
- **At least one ADR must cite the existing system** by real symbol, if the feature couples to anything.

### Exit criteria

- Every major decision in the source has an ADR.
- Every ADR has ≥1 real alternative and ≥1 negative consequence.
- The cited paths/symbols exist.

---

## F3 — Proposal (RFC)

**Question:** what do we propose, and what is still open?

The RFC is the **proposal submitted for review**. It is not the manual. It should fit in 2–4 pages.

### Structure

```
Metadata       (author, status, date, reviewers)
TL;DR          (the proposal in one paragraph)
Context        (the problem, in business terms)
Proposal       (overview — without descending to the FDD level)
Alternatives   (≥2 real, each with the trade-off that motivated discarding it)
Open questions (≥2 undecided points)
Impact and risks
Related decisions  (links to the ADRs)
```

### Rules

- **Talk in decisions, not implementation.** If you are explaining a function signature, you are in the wrong document.
- **Each alternative carries its trade-off.** "It was discarded" with no reason teaches nothing and does not stop the discussion from coming back.
- **Open questions are content, not failure.** They are where the undecided points become visible. An RFC with no open questions, when the deliberation had some, is hiding a problem.
- **Honest metadata.** If the source has no date, state the absence — do not fill it in.

### Exit criteria

- ≥2 real alternatives with trade-off.
- ≥2 open questions, traceable.
- ≥2 ADR links resolving to existing files.
- Fits in 4 pages.

---

## F4 — Implementation (FDD)

**Question:** how to build it, in detail?

### Structure

```
Technical context and motivation
Technical objectives
Scope and exclusions
Detailed flows            (the happy path and the failure paths)
Public contracts           (≥4, with example input and output)
Error matrix              (codes, cause, behavior)
Resilience                (timeout, retry, degradation)
Observability             (metrics, logs, tracing)
Dependencies and compatibility
Integration with the existing system   (real paths + coupling point)
Technical acceptance criteria
Risks and mitigation
```

### Rules

- **The contract is the product.** Every contract needs an example input **and** output, including the error cases. A contract with no output example is not a contract, it is an intention.
- **The error matrix separates planes.** An error returned to the caller and an error persisted internally are different things; mixing them produces confusing semantics.
- **Observability is mandatory on all three axes:** metric, log and tracing. An FDD that only talks about logs does not give you a way to operate the system.
- **Integration names real symbols.** Every coupling brings path + signature + what the change forces.
- **Risks have actionable mitigation.** "Monitor" is not mitigation; "query indexed by (a,b), no network I/O" is.

### Exit criteria

- ≥4 contracts with input and output.
- Error matrix with codes following the pattern declared in the configuration.
- ≥4 real paths in the integration section.
- Observability on all three axes.
- Every risk with concrete mitigation.

---

## F5 — Product (PRD)

**Question:** why and what?

Written **last** among the big ones: at a higher altitude, it consolidates what has already been decided.

### Structure

```
Summary and context
Problem and motivation
Target audience and scenarios
Objectives and metrics        (≥1 quantitative)
Scope                       (in scope + out of scope)
Functional requirements       (≥8)
Non-functional requirements
Decisions and trade-offs       (table linking to the ADRs)
Dependencies
Risks                      (≥2 with probability, impact, mitigation)
Acceptance criteria
Test strategy
```

### Rules

- **A metric needs a number.** "Fast" is not a metric. If the source said "under 10 seconds", that is the number — and if it said none, do not invent one.
- **"Out of scope" separates the three categories** (discarded, deferred, open) and marks each one. None of them may reappear as a requirement.
- **Complete risks:** probability, impact, mitigation, and preferably contingency. A risk with no mitigation is just fear.
- **The PRD does not descend to the technical level.** Architectural trade-offs stay as links to the ADR.

### Exit criteria

- ≥8 functional requirements.
- ≥1 metric with a quantitative target taken from the source.
- ≥2 out-of-scope items, with the correct category.
- ≥2 complete risks.
- No discarded/deferred item present as a requirement.

---

## F6 — Traceability (Tracker)

**Question:** where did each thing come from?

A sweep of the already finished documents — assembled at the end, not in parallel.

### Process

1. Go through each document and assign a **stable ID** to every identifiable item (FR, NFR, risk, alternative, open question, contract, error, decision).
2. For each item, look for its origin in the source or in the system.
3. Items with no origin go into the **derivations appendix**, outside the table.
4. Confirm that every locator resolves.

### Rules

- **The table only uses the sources the configuration declares.** If the process accepts only `TRANSCRIPT`/`CODE`, do not invent a third value column — use a separate appendix.
- **A locator has an exact format.** Verify it against the source, not from memory. It is common for the first pass to attribute lines to the wrong participant.
- **Minimum coverage** defined in the configuration (typically 80% of identifiable items).
- **The derivations appendix is part of the package's honesty.** It shows what was added; omitting it is worse than having it.

### Exit criteria

- Minimum coverage reached.
- Minimum percentage of valid source locators.
- Code paths resolving.
- Derivations outside the main table.

---

## F7 — Process (README)

**Question:** how was this done?

It only makes sense when the package will be evaluated or read by someone external.

### Structure

```
About the challenge/work
AI tools used
Workflow adopted
Custom prompts      (≥2, in code blocks)
Iterations and adjustments       (≥2 concrete corrections, with what was wrong)
How to navigate the deliverable
```

### Rules

- **Iterations are real corrections**, not "I refined the document". What was wrong, why it got through, how it was caught.
- **Prompts are the ones that were used**, not idealized versions written afterwards.
- **Tools with a specific role.** "I used AI" tells you nothing.

---

## F8 — Validation

Two layers, both mandatory.

### 8.1 Mechanical check

```bash
node frameworks/chain-of-custody/scripts/verify.mjs <repo> <config.json>
```

Checks, without judgment:

- required files exist; optional documents are checked when present and reported when absent;
- every cited code path exists;
- every locator resolves in the source;
- the table only uses permitted sources;
- minimum counts per document;
- section references (`FDD §6.3`) resolve to a real heading;
- any coverage number the tracker states matches the computed one;
- a declared origin column has a value on every row, and each `SOURCE` row points at a locator or a code path;
- nothing outside the permitted areas was changed.

The locator format is not fixed: `source.locatorPattern` and `tracker.locatorPattern` describe how a locator appears in the source and in a cell, each capturing time and speaker. The default is `[hh:mm] Name`; a different format is a configuration change, not a code change.

It also warns — without failing — about locators that cannot distinguish two lines by the same speaker, and about an immutability `baseRef` that only sees uncommitted work.

The mechanical check reads **form, not meaning**. It proves the package is well-formed, not that it is right: a paragraph can sit next to a valid locator and still say the opposite of the source. What reads meaning is the Goldfish protocol (§8.2). Green here is a floor, not a ceiling.

Output: exit 0 if clean, exit 1 with the list of problems.

### 8.2 Goldfish protocol

Detailed in [`README.md §6`](README.md#6-the-goldfish-protocol). Four checks in a clean session: comprehension, antagonism, readiness, provenance.

### Exit criteria

- Mechanical check with no problems.
- G1 passes without correction.
- G3 gives a go.
- G2 and G4 addressed or accepted with justification.

---

## F9 — Publication

### Before publishing

- [ ] Clean mechanical check
- [ ] Goldfish protocol completed
- [ ] Nothing changed outside the permitted areas
- [ ] Thematic commits (one per document or stage)
- [ ] Verified that the destination is the correct one

### Order

1. Confirm the permitted area with `git diff --name-only` against the base commit.
2. Separate commits per document — it makes review and rollback easier.
3. Publish.
4. **Verify what arrived**: does the remote commit match the local one? Are all the files there?

---

## Appendix — Environment pitfalls

Stack-independent, but they cost real time.

| Pitfall | Symptom | Antidote |
|---|---|---|
| Tool not on the PATH | "is not recognized as a command" | Absolute path, or prefix the PATH in the session |
| Corrupted encoding in bulk edits | An accented character turns into two meaningless characters (a `c` cedilla becomes an `A` with a tilde plus a section sign) | Edit with a file tool or with a script using explicit UTF-8 IO; validate afterwards |
| Interactive installer | The process hangs waiting for input | Prefer non-interactive installation; check the final artifact, not the log |
| Bulk write wiping out what existed | Unexpected diff | Read the target before overwriting; prefer creating to overwriting |

General rule: **validate the artifact, not the log**. A process can report success and have done nothing, or report an error and have done it.
