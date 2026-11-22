# PRD — `<feature title>`

> **Question this document answers:** why and what?
> The technical proposal is in the [RFC](RFC.md); the implementation, in the [FDD](FDD.md); the rationale for the decisions, in the [ADRs](adrs/).

| Field | Value |
|---|---|
| Version | |
| Date | `<date, or the deliberation reference>` |
| Owner | |
| Status | |

---

## 1. Summary and context

<what the feature is, in 2 paragraphs>

---

## 2. Problem and motivation

### 2.1 The problem

<concrete consequences of not having this today>

### 2.2 Why now

<urgency, opportunity, risk of not doing it>

### 2.3 What changes

<before and after, from the point of view of whoever uses it>

---

## 3. Target audience and scenarios

**Audiences:**

- <who> — <what they do with it>

**Key scenarios:**

1. **<name>**: <situation and expected outcome>
2. **<name>**: <...>

---

## 4. Objectives and success metrics

| Objective | Metric | Target |
|---|---|---|
| | | **<number>** |

> Only use numbers that are in the source. If the source did not define a target, write "to be defined" — do not invent.

---

## 5. Scope

### 5.1 Included

- <item>

### 5.2 Out of scope

**Three distinct categories. Label each item.**

1. **<item>** — **discarded**. <locator>
2. **<item>** — **deferred**. <locator>
3. **<item>** — **open**, not scoped. <locator>

> Discarded ≠ deferred ≠ open.
> No item in this section may appear as a requirement in the following sections.

---

## 6. Functional requirements

**Minimum 8.**

### RF-01 `<name>`

- **Main flow:** <...>
- **Alternatives/exceptions:** <...>
- **Expected errors:** <...>
- **Priority:** high / medium / low

### RF-02 `<name>`

<same format>

---

## 7. Non-functional requirements

**Performance**

- <...>

**Security**

- <...>

**Reliability**

- <...>

**Observability**

- <...>

**Known and accepted limitations**

- <...>

---

## 8. Decisions and trade-offs

| Decision | Accepted trade-off | ADR |
|---|---|---|
| | | [ADR-NNN](adrs/ADR-NNN-title.md) |

---

## 9. Dependencies

**Technical** · **Organizational** · **Commercial/business**

- <...>

---

## 10. Risks and mitigation

**Minimum 2, complete.**

### Risk 1 — `<name>`

- **Probability:** low / medium / high
- **Impact:** low / medium / high — <consequence>
- **Mitigation:** <concrete action>
- **Contingency:** <plan if it happens>

---

## 11. Acceptance criteria

- [ ] <criterion verifiable by the user>
- [ ] <...>

---

## 12. Testing and validation strategy

**Automated** — unit, integration, contract, security, reliability.

**Manual** — end-to-end script, validation with users.

**Exit criterion** — <what must be true to consider it done>

---

<!--
CHECKLIST
- [ ] ≥8 functional requirements
- [ ] ≥1 metric with a quantitative target taken from the source
- [ ] ≥2 out-of-scope items with the correct category
- [ ] ≥2 risks with probability, impact, mitigation
- [ ] No discarded/deferred item present as a requirement
-->
