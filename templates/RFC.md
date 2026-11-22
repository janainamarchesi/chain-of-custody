# RFC — `<initiative title>`

> **Question this document answers:** what do we propose, and what is still open?
> Implementation detail lives in the [FDD](FDD.md). Settled decisions live in the [ADRs](adrs/).

**Target length: 2 to 4 pages.** If you went past that, you are descending to the FDD level.

---

## 1. Metadata

| Field | Value |
|---|---|
| Title | |
| Author | |
| Status | `Draft` / `In review` / `Accepted` / `Rejected` |
| Date | `<date, or the deliberation reference if there is no date>` |
| Reviewers | |

> **Do not invent a date.** If the source does not have one, write "not stated in the source" and refer to the deliberation by another identifier.

---

## 2. TL;DR

The whole proposal in one paragraph. Someone who reads only this should understand what will be done and how.

<write>

---

## 3. Context and problem

The problem in business or user terms — not in solution terms.

Why now. What happens if nothing is done.

<write>

---

## 4. Technical proposal (overview)

The chosen approach, at a high level. The general shape, not the details.

**Golden rule:** <the invariant that sustains the design — the thing that, if broken, invalidates everything>

1. **<component or step 1>** — <what it does and why>
2. **<component or step 2>** — <what it does and why>
3. **<component or step 3>** — <what it does and why>

### Design boundaries

What this design **accepts not having**. Eventual consistency, limited scale, partial coverage — stating what it does not cover is part of the proposal.

- **<limitation 1>**: <consequence>
- **<limitation 2>**: <consequence>

---

## 5. Alternatives considered and discarded

**Minimum 2.** Each one with the trade-off that motivated discarding it.

### 5.1 `<alternative>`

**What it was:** <description>

**Why it was discarded:** <concrete reason>

**Trade-off:** we would gain <benefit>, but at the cost of <cost>.

### 5.2 `<alternative>`

**What it was:**

**Why it was discarded:**

**Trade-off:**

---

## 6. Open questions

**Minimum 2.** Points that were not decided. Listing them is a sign of rigor, not weakness.

1. **<question>** — <what is undefined, and what depends on that decision>
2. **<question>** — <...>

> If the deliberation left points open and this RFC has none, the RFC is hiding a problem.

---

## 7. Impact and risks

| Area | Impact |
|---|---|
| <system component> | <what changes> |
| <operations> | <what changes> |
| <other teams> | <what changes> |

**Main risks:**

- **<risk>** — <mitigation>
- **<risk>** — <mitigation>

---

## 8. Related decisions

- [ADR-NNN — <title>](adrs/ADR-NNN-title.md)
- [ADR-NNN — <title>](adrs/ADR-NNN-title.md)

---

<!--
CHECKLIST
- [ ] 2 to 4 pages
- [ ] ≥2 alternatives with an explicit trade-off
- [ ] ≥2 open questions
- [ ] ≥2 resolving ADR links
- [ ] No function signature / schema / example payload detail
-->

<!--
COMMON MISTAKES IN THIS DOCUMENT
- Explaining the contract in detail  → that is the FDD
- Repeating the consequences of each ADR  → link, do not copy
- Alternative with no trade-off  → teaches nothing and the discussion comes back
-->
