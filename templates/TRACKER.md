# Traceability Tracker

Cross-reference between each item recorded in the documents and its origin in the source or in the existing system.

**Legend**

- `Source = <SOURCE>` → `Location` in the format `<locator format>` — see `config.json`.
- `Source = <CODE>` → `Location` is the real file path.

> The allowed sources are declared in the package configuration. **Use only those.**
> Engineering derivations do not go in this table — they go in Appendix A.

---

## `<Document 1>`

| ID | Document | Type | Summary | Source | Location |
|---|---|---|---|---|---|
| `<PFX>`-01 | `docs/<Document>.md` | <type> | | `<SOURCE>` | `<locator>` |

---

## `<Document 2>`

| ID | Document | Type | Summary | Source | Location |
|---|---|---|---|---|---|
| `<PFX>`-01 | `docs/<Document>.md` | <type> | | `<SOURCE>` | `<locator>` |

---

## Coverage summary

| Metric | Value | Requirement |
|---|---|---|
| Total traceable rows | | — |
| Rows with `Source = <SOURCE>` | | — |
| Rows with `Source = <CODE>` | | ≥ `<minimum>` |
| Percentage of valid source locators | | ≥ `<minimum>%` |
| Percentage with verifiable location | | — |

---

## Appendix A — Engineering derivations

Items that are the author's elaboration: they were not in the source and have no direct anchor in the existing system. They stay here, **outside the traceability table**, so that no one confuses them with facts.

| ID | Document | Type | Summary | Note |
|---|---|---|---|---|
| | | | | <why it was derived, and from what> |

---

<!--
CHECKLIST
- [ ] Only the sources declared in the configuration appear in the Source column
- [ ] Every locator was verified against the source (not from memory)
- [ ] Every code path exists
- [ ] Minimum coverage reached
- [ ] Derivations are in the appendix, not in the table

COMMON MISTAKE
Attributing a statement to the wrong participant by scanning from memory.
Always confirm the locator+source pair against the original file.
-->
