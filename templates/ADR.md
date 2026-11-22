# ADR-NNN — `<short title, in kebab-case in the file name>`

> **Question this document answers:** why did we decide exactly this way?
> One ADR, one decision.

---

## Status

`Proposed` | `Accepted` | `Superseded by ADR-NNN` | `Discarded`

**Date:** `<date or reference to the deliberation>`

---

## Context

The problem and the forces at play. What made the decision necessary, and which constraints narrowed the space of options.

Without this section, the ADR becomes a personal preference. With it, someone in the future can judge whether the context still holds — and whether the decision should be reopened.

<write 2–4 paragraphs>

---

## Decision

What was decided, **affirmatively**, in the present.

> "We adopted X, because Y."

Not "we could adopt X". An ADR records what **is**, not what is being considered.

<write the decision so that someone can implement it without asking>

---

## Alternatives Considered

**At least one real alternative.** Someone actually advocated for it or considered it.

### `<alternative name>`

**What it was:** <description in one or two sentences>

**Why it was discarded:** <the concrete reason — not "it was worse">

**Trade-off:** we would gain <benefit>, but at the cost of <cost>.

---

### `<second alternative>` (if any)

**What it was:**

**Why it was discarded:**

**Trade-off:** we would gain <benefit>, but at the cost of <cost>.

---

## Consequences

### Positive

- <concrete, verifiable benefit>

### Negative

**At least one is mandatory.** An ADR with no accepted cost is advertising, not a record.

- <accepted cost, with the nature of the cost: complexity, latency, operations, debt>

### Explicit trade-off

> We accept **<cost>** in exchange for **<benefit>**.

If you cannot write this sentence, the decision was not understood — or there was no decision, only chance.

---

## References

- Source: `<locator — e.g. [09:06] Diego>`
- Code: `<real/path/to/file.ts>` — `<symbol>`
- Related: `<ADR-NNN>`, `<ADR-NNN>`

---

<!--
CHECKLIST
- [ ] A single decision
- [ ] ≥1 real alternative with a reason for discarding it
- [ ] ≥1 negative consequence
- [ ] Trade-off written in one sentence
- [ ] Every path / symbol cited exists
-->
