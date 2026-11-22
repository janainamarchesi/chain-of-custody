# Chain of Custody

**A method for design docs that can be audited.**

> Every claim keeps its chain of custody: source → evidence → document, unbroken. Ask a sentence where it came from, and the ledger answers.

A method for turning **any source of deliberation** — a meeting transcript, a ticket thread, PR comments, discovery notes, a Slack thread — into a **traceable, implementable design-docs package**, using AI.

It works regardless of project, language, framework, or product type. The examples come from a backend service, but nothing here depends on HTTP, a relational database, or Node.

> **Who this is for:** engineers and tech leads who already convinced an AI to write a PRD in five minutes, then spent three weeks discovering that the PRD described a system nobody agreed to build.

---

## 1. The problem this solves

AI generates documentation fast. Too fast — and that is where the problem starts.

When you ask it to "generate a PRD from this transcript", the model produces something that *looks* like a PRD: right sections, right tone, right vocabulary. And it fails on three silent fronts:

1. **It invents** requirements nobody asked for, with the same confidence as the ones that were asked for.
2. **It drops the discard** — the meeting decided something was *out*, and the document treats it as a requirement.
3. **It loses the why** — it reproduces the decision without the trade-off that justified it, so nobody can reopen it with an argument.

The damage is worse than a bad doc. A wrong design doc becomes wrong code, because it is precisely the artifact implementation follows once nobody remembers the meeting.

**The central constraint:** a design doc is only trustworthy if every claim in it can be traced back to the source, or is explicitly marked as engineering derivation. Without that, you don't have documentation — you have the model's second opinion about its own first opinion.

---

## 2. The core idea

Two things hold the method up, and they come from different traditions.

**From the Elephant-Goldfish Model (Google):** separate the role that *holds context* from the role that *validates*. The Elephant is the long-lived session with full project memory, which debates intent and writes the design. The Goldfish is the stateless, zero-context session that reads the result as a stranger and points out what stayed ambiguous. Whoever wrote it cannot review it — they are contaminated by their own assumptions.

**From traceability work:** the only mechanical defense against hallucination is a **provenance ledger**. Not a promise that the AI was careful — an artifact that, when consulted, shows where each line came from. If it has no origin and isn't marked as a derivation, it isn't a claim: it's a hallucination waiting for review.

Together they give a method with a **context boundary** (Elephant/Goldfish) and an **evidence boundary** (provenance).

### Why "chain of custody"

The name is borrowed from evidence handling. In a legal or forensic process, an object is only admissible if there is an unbroken record of every hand it passed through — who had it, when, and what changed. Break the chain once and the object is worthless, regardless of how convincing it looks.

A design doc works the same way. The transcript is the artifact. The ledger is the custody record. Every sentence in the finished document is an item that must trace back through the ledger to the exact line and speaker it came from — and if the chain breaks, the sentence is not "probably fine": it is inadmissible, and it gets removed.

That is why the method has a *forbidden* provenance value (`UNKNOWN`) rather than a tolerance for it. A document that is 95% traceable is not 95% trustworthy. It is unauditable, and you cannot tell which 5% will become the bug.

```
┌─────────────────────────────────────────────────────────────┐
│  ELEPHANT — full context                                    │
│                                                             │
│  Raw sources  ──►  Evidence base  ──►  Documents            │
│  (transcript,      (fact table      (ADR, RFC,              │
│   code, tickets)    with provenance) FDD, PRD)              │
│                                    │                        │
│                                    ▼                        │
│                            Traceability ledger              │
└─────────────────────────────────────────────────────────────┘
                                     │
                     deliver only document, source, ledger
                                     ▼
┌─────────────────────────────────────────────────────────────┐
│  GOLDFISH — zero context                                    │
│  reconstructs intent · attacks contradictions · judges      │
│  readiness                                                  │
└─────────────────────────────────────────────────────────────┘
                                     │
                        critiques return to the Elephant
```

---

## 3. The two roles

### 3.1 Elephant

The session or subagent with access to **everything**: the entire raw source, the map of the existing system, the history of earlier decisions in this package.

Responsibilities:

- Read the source **in full**, not a summary. Summaries lose exactly the nuance that decides scope.
- Map the existing system by its **real symbols** — class name, function signature, file path. Do not paraphrase.
- Keep the ledger current on every claim.
- Write the documents.

Hard rule: **the Elephant does not validate its own work.** It may review for internal consistency, but independent judgment belongs to the Goldfish.

### 3.2 Goldfish

A **fresh session with no history**, receiving only:

- the document to validate,
- the raw source,
- the ledger.

Nothing else. Not the Elephant's reasoning, not the earlier decisions the Elephant made, not the conversation that led there.

Why the context restriction is the whole point: if the Goldfish knows *why* the Elephant wrote something, it stops testing it. The value is in reconstructing intent from the artifact — and if it can't, the artifact is ambiguous, which is exactly what a team member will feel when they try to implement it.

---

## 4. The five invariants

These are the rules that don't depend on stack. Breaking any one degrades the result in a way superficial review won't catch.

### I1 — Source before prose

No sentence of a document is written before the evidence table exists. The table is the input; the documents are its projection at different altitudes.

*Why:* writing first and "finding justification later" is how AI produces text that is plausible and unfounded. The order forces the model to confront the source before it has a narrative to defend.

### I2 — One altitude per document

Each document answers **exactly one** question, and declares it at the top.

| Document | Question | Altitude |
|---|---|---|
| PRD | Why and what? | Product |
| RFC | What do we propose, and what is still open? | Architecture |
| ADR | Why exactly this way? | Decision |
| FDD | How to build it, in detail? | Implementation |
| Tracker | Where did each thing come from? | Cross-cutting |

*Why:* duplication between documents isn't harmless redundancy — it signals something is at the wrong altitude and will diverge on the first revision. When the same fact appears in the RFC and the FDD with slightly different details, nobody knows which one holds.

### I3 — Provenance or exclusion

Every claim has **one** of three provenances, and the third is forbidden.

| Provenance | Meaning | Destination |
|---|---|---|
| `SOURCE` | Traceable to the raw source or the existing system | Traceability table, with locator |
| `DERIVED` | Engineering elaboration by the author | Separate appendix, never in the table |
| `UNKNOWN` | No identifiable origin | **Remove** |

*Why:* the AI's temptation is to present inference in the same tone as a fact it read. Separating `DERIVED` from `SOURCE` isn't pedantry — it's what lets a reader tell what was decided in the meeting from what the document's author added. A design doc that mixes the two is impossible to audit.

### I4 — What stays out is also content

Discarded, deferred, and open are **three different categories**, and all three need a home:

- **Discarded** — decided not to do it. Goes to "Out of scope", marked as discarded.
- **Deferred** — will be done, not now. Goes to "Out of scope", marked as deferred.
- **Open** — not decided. Goes to "Open questions" in the RFC.

None of the three may appear as a requirement.

*Why:* it is the most common error and the hardest to spot while reading. An invented requirement jumps out at anyone who attended the meeting; a discarded item promoted to a requirement slips by, because it *looks* reasonable — it was discussed, after all. Except implementing it means doing work the team decided not to do.

### I5 — Separate context validates

The author does not judge their own work. Validation happens in a context-free session, with the document as the only bridge.

*Why:* without it, review becomes "the model agrees with the model". The AI that wrote it holds a mental model of what it meant and reads the text through that model — filling gaps the real reader won't fill.

---

## 5. The phases

```
F0  Setup             scope, package format, rule not to modify the system
F1  Evidence base     full source → fact table with provenance
F2  Decisions         ADRs — the skeleton of "how to implement"
F3  Proposal          RFC — consolidates decisions, alternatives, open questions
F4  Implementation    FDD — flows, contracts, errors, integration
F5  Product           PRD — high-level consolidation
F6  Traceability      tracker — sweep of the finished documents
F7  Process           README — account of how it was done
F8  Validation        Goldfish protocol + mechanical check
F9  Publication       thematic commits and push
```

The order is not arbitrary. **ADRs before everything** because decisions are the skeleton: with decisions closed, the RFC becomes consolidation instead of prose, and the FDD can reference concrete decisions instead of reopening them. **PRD last** among the big ones because, sitting at the highest altitude, it benefits from everything already decided below.

Phase-by-phase detail in [`METHOD.md`](METHOD.md).

---

## 6. The Goldfish protocol

The part the Elephant-Goldfish Model contributes. Four checks, in order, each in a clean session.

### G1 — Comprehension

> "Read only this document. Explain the architecture and the intent back to me."

If the Goldfish gets it wrong, it isn't the Goldfish being dumb — it's the document being ambiguous. What it failed to reconstruct is exactly what will stop the first engineer who picks up the task.

### G2 — Antagonistic review

> "You are a skeptical reviewer. Find contradictions, missing decisions, unhandled edge cases, and claims without support."

Run **more than one** Goldfish in parallel, with different attack briefs. Independent critics fail in different places; the intersection of the critiques is what matters, the union is what teaches.

### G3 — Implementation readiness

> "Based only on this document, could you start implementing without asking questions? If not, list every question."

Go/no-go. A question with no answer in the document is a gap, not a detail.

### G4 — Provenance

> "Pick ten claims at random. For each, find its locator in the ledger and confirm it resolves in the source. Flag any that don't."

This check is Chain of Custody's contribution to the original protocol. The first three test **clarity**; this one tests **truth**. A document can be perfectly clear about something nobody decided.

Critiques return to the Elephant, who fixes and resubmits. The cycle ends when G1 passes without correction and G3 gives a go.

---

## 7. Adapting to any stack

The framework doesn't know "endpoint", "table", or "component". It knows three generic things.

### 7.1 The source of deliberation

Any artifact where decisions were made and not recorded:

| Format | Typical locator |
|---|---|
| Meeting transcript | `[hh:mm] Speaker` |
| Ticket thread | `#comment-<id>` |
| PR comments | `review:<id>` |
| Slack thread | `<channel>/<timestamp>` |
| Discovery doc | `§<section>` |

What matters is that the locator is **unique and verifiable** — something a script can confirm exists in the source.

### 7.2 The existing-system surface

Generalizes to "integration surface": everything that already exists and that the feature will couple to.

| Project | Surface |
|---|---|
| Backend service | routes, services, repositories, models, middlewares |
| Mobile app | screens, navigation, state, network layer |
| Data pipeline | DAGs, schemas, contracts, jobs |
| Infra change | modules, roles, policies, manifests |
| Library | public API, exported types, extension points |

The rule is always the same: **name the real symbol, with path and signature**. "The order service" is not a coupling; `OrderService.changeStatus(id, input, userId)` is.

### 7.3 The contract

Generalizes to "what the system exposes to the world" — the part that must be precise enough for someone to code without asking.

| Project | Contract |
|---|---|
| HTTP API | route, method, request, response, status codes |
| CLI | command, flags, stdout, exit codes |
| Events | topic, schema, headers, delivery semantics |
| UI | props, states, events |
| Data schema | table, columns, indexes, constraints |

---

## 8. Anti-patterns

Each of these appeared in real use and cost time to detect.

| Anti-pattern | Why it happens | Antidote |
|---|---|---|
| **Generic document** | Vague request; the AI produces what would fit any system | Require every paragraph to have a matching item in the ledger |
| **Path hallucination** | The AI writes the path that *should* exist | Mechanical existence check before publishing |
| **Invented date/author** | Empty metadata field; the AI fills it with something plausible | Declare the absence explicitly instead of filling it |
| **Duplication across altitudes** | Each document re-explains the previous one | Each document declares its question at the top; review against it |
| **Discard becoming requirement** | "What stays out" filtering done by a generic prompt | F1 with explicit `Discard`/`Defer` types and a promotion ban |
| **Derivation disguised as fact** | Inference presented in the same tone as citation | Third provenance category, in a separate appendix |
| **Narcissistic validation** | The author reviews their own text | Goldfish protocol, mandatory before publishing |

---

## 9. How to use it

### With the skills

Four skills implement the method. Each is self-contained: it can be invoked in a new session, without this conversation.

| Skill | Phase | What it does |
|---|---|---|
| [`design-docs`](skills/design-docs/SKILL.md) | F0 | Orchestrates: understands the source, decides the package, drives the phases |
| [`design-docs-evidence`](skills/design-docs-evidence/SKILL.md) | F1 | Builds the evidence base and the integration-surface map |
| [`design-docs-write`](skills/design-docs-write/SKILL.md) | F2–F7 | Writes the documents at the right altitudes |
| [`design-docs-validate`](skills/design-docs-validate/SKILL.md) | F8 | Goldfish protocol + mechanical check |

The normal path is to invoke `design-docs` and let it drive. The other three exist separately because each has its own exit criterion — and because F8 must run in a different context from the rest.

**Install:** copy the four directories under [`skills/`](skills/) into your project's `.claude/skills/`. They reference the framework files by relative path, so keep `frameworks/chain-of-custody/` (or this repo) alongside — or adjust the paths at the top of each skill.

### Manually

1. Read the whole source and produce the evidence table ([template](templates/EVIDENCE.md)).
2. Write the ADRs ([template](templates/ADR.md)).
3. Write the RFC ([template](templates/RFC.md)).
4. Write the FDD ([template](templates/FDD.md)).
5. Write the PRD ([template](templates/PRD.md)).
6. Assemble the tracker ([template](templates/TRACKER.md)).
7. Run [`scripts/verify.mjs`](scripts/verify.mjs) with your [`config.json`](config.example.json).
8. Submit to the Goldfish protocol.

### Configuration

```bash
node scripts/verify.mjs <repo-path> config.example.json
```

The mechanical check validates: required files exist, every locator resolves in the source, every code path exists, the table uses only allowed sources, the minimums are met, and nothing was changed outside the allowed area. It runs on any project — the config describes the sources. Requires Node 18+; installs nothing.

Two keys deserve attention:

- **`code.newPathAllowlist`** — the **new** files the feature proposes to create. They legitimately don't exist yet; without being listed here, check 8 flags them (correctly) as missing.
- **`immutable.gitBinary`** — path to the git executable, for environments where it isn't on `PATH`. If it can't be found, check 10 only records that it didn't run; it never fails the package because of that.

**The validator is language-independent too.** Section headings and inline markers are regex fragments in `docs.sections` and `docs.markers`, not hardcoded English. [`config.example.pt-br.json`](config.example.pt-br.json) is the same package validated in Portuguese — it is what runs against the reference case:

```bash
node scripts/verify.mjs ../mba-ia-desafio-design-docs-com-ia config.example.pt-br.json
```

```
ADRs: 7 · PRD: 16 functional requirements · PRD: 6 out-of-scope items
RFC: 7 open questions · FDD: 13 WEBHOOK_* codes · FDD: 17 paths in the integration section
TRACKER: 111 rows · valid locators 92/111 = 82.9% · 19 code rows
cited paths: 25, missing: 0 · git: 13 files changed since HEAD~6

=== PROBLEMS (0) ===
  none
```

---

## 10. Quality criteria

A package is ready when **all** of these hold.

**Traceability**
- [ ] 100% of cited code paths exist in the repository
- [ ] 100% of locators resolve in the source
- [ ] The traceability table uses only sources declared in the config
- [ ] Derivations sit in a separate appendix, never mixed with facts

**Scope**
- [ ] Every discarded or deferred item is marked as such, and none became a requirement
- [ ] Every open point is declared as such, and none was implemented ahead of time

**Consistency**
- [ ] No document contradicts another about the same fact
- [ ] No document duplicates another's level of detail

**Readiness** (Goldfish protocol)
- [ ] G1: a reader without context reconstructs the intent
- [ ] G2: antagonistic critiques were addressed or accepted with justification
- [ ] G3: implementation can start without open questions
- [ ] G4: ten sampled claims resolve in the source

---

## 11. The reference case

This method was extracted from a real exercise: turning the transcript of a ~55-minute technical meeting about a webhook system into a complete design-docs package for an existing Node/TypeScript service, without touching a single line of application code.

Final result on that case:

```
ADRs                     7
PRD functional reqs     16
RFC open questions       7
FDD error codes          13
Tracker rows            111   (92 transcript + 19 code)
Locators valid       92/111 = 82.9%
Code paths cited         25   (0 nonexistent)
Mechanical check          0 problems
Files changed outside docs/ and README.md: 0
```

What that case taught, and what is codified here:

- **The evidence base first** kept the documents from becoming generic prose.
- **Separating discarded from deferred from open** caught a real error, where two types were fused in the same section.
- **The mechanical check** caught a nonexistent file path and nineteen rows with provenance outside the required format.

One lesson came from the validator itself: on its first run it reported twelve problems, and **none were in the documents** — they were regex bugs in the validator (a missing `m` flag, the table header line being read as data, and a section ending at the wrong heading). The antidote was to open the file at the reported line before "fixing" the text. Tuning the prose until the regex passed would have turned the check into theater.

A generalized method is only worth it if the case that produced it would have been harder without it. This one was.

---

## References

- [Elephant-Goldfish Model — Google Open Source Blog](https://opensource.googleblog.com/2026/10/introducing-elephant-goldfish-model-plugin.html) — the split between context session and validation session
- [*Your AI Wrote a Great PRD. It Was About a System Nobody Agreed to Build.*](https://medium.com/@janainamarchesi) — the long-form write-up of this method: the failures that shaped it, the four-check protocol, and the result
- [`METHOD.md`](METHOD.md) — phase-by-phase detail
- [`examples/webhooks-oms/`](examples/webhooks-oms/README.md) — the reference case, end to end

## License

MIT — see [LICENSE](LICENSE).
