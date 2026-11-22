# Your AI Wrote a Great PRD. It Was About a System Nobody Agreed to Build.

*How to make AI-generated design docs trustworthy — introducing **Chain of Custody**, a method built on the Elephant-Goldfish Model and a provenance ledger.*

> **TL;DR** — AI documentation fails silently: it invents requirements, drops the discarded ones, and loses the trade-offs. The fix isn't a better prompt. It's (1) separating the session that writes from a context-free session that validates, and (2) a provenance ledger that makes every sentence traceable to a source or explicitly marks it as your own inference. I call it Chain of Custody. This post is the method, the mistakes that shaped it, and an open-source implementation.

---

I asked an AI to turn a 55-minute meeting transcript into a full design-docs package: PRD, RFC, FDD, ADRs, traceability tracker.

It delivered in forty minutes. Seven ADRs, sixteen functional requirements, five architectural alternatives with trade-offs, eleven risk entries. Well written. Well organized. Confident.

Then I checked it against the transcript and found this: two items the team had explicitly **decided not to build** had become functional requirements. Not invented out of nothing — that's the easy failure to spot. These were worse, because they were *reasonable*. They had been discussed. Someone had said "maybe later". The document sanded the "later" off and promoted them to scope.

That's the failure mode nobody warns you about. Hallucination sounds like the AI making things up. The real problem is subtler: **the AI makes things up in a register that is indistinguishable from things it read.**

---

## Why this is worse than a bad document

A design doc isn't a summary of a meeting. It's the artifact implementation follows when nobody remembers the meeting anymore — which is three months later.

So a wrong design doc doesn't stay wrong in the document. It becomes:
- a sprint spent building the thing the team discarded,
- an ADR that justifies a decision with a trade-off nobody accepted,
- a "confirmed" requirement that turns out to be one engineer's aside in minute 38.

And the price of *not* trusting AI-generated docs is also real: you go back to writing them by hand, at 6–8 hours per package, which is why you asked the AI in the first place.

I wanted both. Speed *and* something I could defend line by line.

---

## The insight: split the work in two

Most people treat "generate the docs" as one task. It isn't. It's two, and the second one requires **ignorance** to work.

Google's [Elephant-Goldfish Model](https://opensource.googleblog.com/2026/10/introducing-elephant-goldfish-model-plugin.html) names this split well:

> **The Elephant** is a context-rich, long-horizon session that holds the end-to-end architectural vision and project memory. No code is written here; it's purely dedicated to design, intent, and capturing micro-decisions.
>
> **The Goldfish** is a stateless, zero-context session used strictly to validate specifications. Without the designer's assumptions, they act as objective critics, probing for gaps and edge cases.

The Elephant writes. The Goldfish — who has never seen the conversation, the transcript, or the reasoning — reads only the finished document and tries to understand it.

**Why the ignorance is the point:** if the reviewer knows why you wrote something, they stop testing whether the text actually conveys it. They fill the gap from shared memory. The Goldfish can't. When the Goldfish gets confused, that confusion is a real defect — it's the same confusion the next engineer will hit.

I ran four of these checks in sequence, each in a fresh context:

| Check | The question | What it catches |
|---|---|---|
| **G1 Comprehension** | "Explain the architecture and intent back to me." | Ambiguity in the core |
| **G2 Antagonistic** | "You are a skeptical reviewer. Find what's wrong." | Contradictions, missing decisions, edge cases |
| **G3 Readiness** | "Could you start implementing? List every question." | Unresolved gaps |
| **G4 Provenance** | "Pick ten claims. Verify each against the source." | Fabrication |

The first three come from the EGM model. **The fourth I added**, because it closes a hole the original leaves open.

---

## The hole: clarity is not truth

Here's the thing G1–G3 can't detect.

A document can be *perfectly clear* about something nobody decided. It reads beautifully. A Goldfish reconstructs the intent flawlessly. It passes readiness. And it's describing a system that was never agreed to — because the clarity came from the AI's smooth writing, not from the source.

> Clarity is a property of the prose. Truth is a property of the provenance. You need a separate test for each.

So G4 doesn't read for sense. It picks ten concrete claims — numbers, decisions, named requirements — and goes back to the source to confirm each one exists and is attributed to the right person.

That's where the second pillar comes in.

---

## The provenance ledger

## The provenance ledger

The only mechanical defense against hallucination isn't "being careful". It's an artifact that, when consulted, shows where each line came from.

This is where the name comes from. In evidence handling, an object is admissible only if there's an unbroken record of every hand it passed through — who had it, when, what changed. Break the chain once and it's worthless, however convincing it looks. A design doc is the same: the transcript is the artifact, the ledger is the custody record, and every sentence must trace back to the exact line and speaker it came from.

So the chain has to be unbroken. That's why the method has a *forbidden* provenance value rather than a tolerance for it — a document that's 95% traceable isn't 95% trustworthy. It's unauditable, and you can't tell which 5% will become the bug.

Before writing a single sentence, you build a **fact table**: every decision, requirement, constraint, discard, deferral, and open question in the source, each with a locator (`[09:14] Diego`) and a classification.

Then every claim in the finished documents must be one of three things:

| Provenance | Meaning | Where it goes |
|---|---|---|
| `SOURCE` | Traceable to the transcript or the code | The traceability table, with locator |
| `DERIVED` | Your engineering elaboration | A **separate appendix** |
| `UNKNOWN` | No identifiable origin | **Deleted** |

That third category is doing most of the work. It forces the question "where did this come from?" on every sentence — and the answer is either a locator or a deletion.

The middle category is what most people get wrong. Not everything in a good design doc came from the meeting; some of it is your engineering judgment, and that's valuable. But presenting judgment in the same register as a cited decision makes the whole document unauditable. A reader can't tell what was decided from what was added. So derivations get their own appendix, clearly marked.

---

## The distinction that stopped the bug

Remember the two discarded items that became requirements?

The fix was insisting on **four** categories of "out", not two:

- **Discarded** — we decided not to do this.
- **Deferred** — we'll do it, not now.
- **Open** — nobody decided.
- **Out by definition** — never in scope.

All four get recorded. None may appear as a requirement. And they are *not interchangeable*: a deferred item is a promise; an open item is a question. Conflating them is how "maybe later" becomes "in scope".

This sounds bureaucratic until you watch a requirement survive a review because the reviewer remembered discussing it. The category is what makes it fall.

---

## Does it generalize beyond one meeting?

This was my real worry. A method tuned to one Node/TypeScript webhook feature could be a very elaborate one-off.

It generalizes through three abstractions — none of which mention HTTP, databases, or any language:

| Generic | What it is | Examples |
|---|---|---|
| **Source of deliberation** | Where decisions were made and not recorded | Meeting transcript, PR thread, Slack thread, discovery doc |
| **Integration surface** | What already exists and the feature couples to | Routes/services, screens/navigation, DAGs/schemas, modules/policies |
| **Contract** | What the system exposes to the world | HTTP route, CLI flags, event schema, UI props, table schema |

The only requirement on a source is that its locators be **unique and script-verifiable**. If you can write a regex that finds it in the original file, it works as a locator.

The only requirement on the integration surface is **real symbols**: `OrderService.changeStatus(id, input, userId)`, not "the order service".

That's it. Those three, plus the ledger, are the entire stack-independence argument.

---

## Making it mechanical

Philosophy is cheap. Two things made this actually usable:

**1. Templates that encode the boundaries.** Each document answers exactly one question, declared at the top. The ADR template *requires* a negative consequence — because a decision with no cost is a decision that didn't evaluate its trade-off. The PRD template has an out-of-scope section that forces the discarded/deferred/open marking.

**2. A verifier that checks facts, not vibes.** A Node script (`verify.mjs`, ~450 lines, zero dependencies) that:

- confirms every locator in the tracker resolves in the transcript,
- confirms every cited code path exists in the repo (or is explicitly allow-listed as *new*),
- checks the ADR count, naming convention, and required MADR sections,
- verifies contracts have both input *and* output examples,
- checks observability covers logs, metrics, *and* tracing — all three,
- confirms nothing was modified outside `docs/` and `README.md`.

And here's the honest part, which I think matters more than the success:

> **On the first run, it reported twelve problems. None of them were in the documents.**

They were all bugs in the validator: a regex missing the `m` flag (so it searched for `^`-anchored headings that existed on line 96 and found nothing), the table header row being parsed as data (`source "Fonte" is not allowed`), and a section that ended at the wrong heading level.

The temptation was obvious: tweak the prose until the regex passed. A green checkmark.

I opened every reported line instead. The documents were right. I fixed the script. Tuning the text to satisfy a buggy check would have converted the entire validation step into theater — and theater is worse than no check, because it produces false confidence.

The lesson generalizes: **when a validator and an artifact disagree, open both.** Assume neither is correct.

---

## The result

On the reference case — 55 minutes of transcript, a real Node/TypeScript service, and an absolute constraint against touching application code:

```
ADRs                       7
PRD functional reqs       16
RFC open questions         7
FDD error codes           13
Tracker rows             111   (92 transcript + 19 code)
Locators valid       92/111 = 82.9%
Code paths cited          25   (0 nonexistent)
Mechanical check           0 problems
Files changed outside docs/ and README.md: 0
```

The package is defensible line by line. Every requirement has a timestamp. Every code path exists. The discarded items are still discarded. And the "0 files changed outside docs/" isn't a promise — it's a `git diff` the script ran.

---

## What I'd tell you to steal

Even if you never build the whole thing, three ideas transfer to any AI documentation workflow:

**1. Read the whole source before writing anything.** Not a summary. Summaries lose exactly the nuance that decides scope. This is the cheapest intervention and the highest-leverage.

**2. Make the AI distinguish what it read from what it inferred.** One extra column, one extra appendix. It's the difference between a document you can audit and one you can only trust.

**3. Validate in a context that doesn't know your reasoning.** Whether it's a fresh model session or a colleague who wasn't in the room — the test is: can they reconstruct what you meant from the document alone? If not, the document isn't done.

The AI is genuinely good at the writing. What it can't do is know which sentences it should not have written. The ledger is how you find out.

---

*Chain of Custody — the method, the templates, the verifier, and the four skills — is open source: [**github.com/janainamarchesi/chain-of-custody**](https://github.com/janainamarchesi/chain-of-custody). MIT licensed. It includes a worked reference case with the full transcript, the finished package, and the git history, so you can check the claims above against a real artifact.*

*If you've fought this problem, I'd like to hear which failure bit you first: invented requirements, lost trade-offs, or the discard that quietly came back.*
