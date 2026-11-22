# Evidence Base — `<initiative name>`

> Working artifact. **Not** part of the deliverable. It is the input for every document.
> Filled in before writing any prose.

**Source:** `<path or reference>`
**Existing system:** `<repository / version / commit>`
**Extraction date:** `<date>`

---

## 1. Evidence table

| # | Locator | Type | Fact (one line) | Goes to |
|---|---|---|---|---|
| 1 | `[hh:mm] Name` | Decision |  | ADR-NNN |
| 2 | `[hh:mm] Name` | Requirement |  | PRD FR-NN |
| 3 | `[hh:mm] Name` | Constraint |  | PRD NFR / FDD |
| 4 | `[hh:mm] Name` | Discard |  | PRD out of scope (discarded) |
| 5 | `[hh:mm] Name` | Defer |  | PRD out of scope (deferred) |
| 6 | `[hh:mm] Name` | Open |  | RFC open question |
| 7 | `[hh:mm] Name` | Code hook |  | FDD integration |
| 8 | `[hh:mm] Name` | Noise | — (does not enter) | — |

### `Type` values

`Decision` · `Requirement` · `Constraint` · `Discard` · `Defer` · `Open` · `Code hook` · `Noise`

> **Warning:** `Discard`, `Defer`, and `Open` are distinct categories and cannot be merged.
> No `Discard` or `Defer` may appear as a requirement in any document.

---

## 2. Integration-surface map

One block per coupling point. **The path must exist.**

### 2.1 `<path/to/file>`

**Real symbol:** `<Class.method(signature)>` or `<function(type): type>`

**Today:** `<what it does today, in one or two sentences>`

**How the feature couples:** `<extends | wraps | calls | replaces>`

**What that forces:** `<contract that cannot change, execution order, atomicity, compat>`

**Origin:** `<locator in the source>` or `DERIVED`

---

### 2.2 `<path/to/file>`

**Real symbol:**

**Today:**

**How the feature couples:**

**What that forces:**

**Origin:**

---

## 3. Decision candidates

Does each become an ADR? Test against three criteria: was there a real alternative · lasting consequence · will someone want to reopen it.

| # | Decision | Real alternative | Lasting consequence? | Becomes ADR? |
|---|---|---|---|---|
| 1 |  |  |  | yes / no |

---

## 4. What does NOT go in

Consolidation of discarded and deferred items. Serves as a final checklist: nothing from here may appear as a requirement.

| Item | Category | Locator | Why |
|---|---|---|---|
|  | discarded / deferred / open |  |  |

---

## 5. Gaps in the source

What you **expected** to find and isn't there. Each gap is a candidate for an open question — or for an explicit decision not to decide.

| Gap | Impact | Where to record it |
|---|---|---|
|  |  | RFC open question / declared assumption |

> **Never fill a gap with a plausible value.** Declare the absence.
> Real example: the source had no calendar date; filling in an invented date would have contaminated every metadata block.

---

## Exit criterion

- [ ] Every item has a valid locator, verified against the source
- [ ] Every item has an assigned type
- [ ] Every code hook has a path that exists
- [ ] Every decision candidate was evaluated against the three criteria
- [ ] Source gaps listed, none filled by invention
