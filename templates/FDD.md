# FDD — `<initiative title>`

> **Question this document answers:** how to build it, in detail?
> The high-level proposal is in the [RFC](RFC.md). The rationale for the decisions is in the [ADRs](adrs/).
> This document takes the decisions as settled and descends to the implementation level.

---

## 1. Context and technical motivation

The current state of the system and what makes the change necessary. Name the real components.

<write>

---

## 2. Technical objectives

- <concrete and verifiable objective>
- <concrete and verifiable objective>

---

## 3. Scope and exclusions

**Included:**

- <component, file, contract>

**Excluded:**

- <item> — <reason>

---

## 4. Detailed flows

One sub-block per flow. Including the failure paths — that is where the design proves itself.

### 4.1 `<flow name>`

```
<ASCII diagram or numbered list of the path>
```

**Step by step:**

1. <step, with the responsible component>
2. <step>

**Failure points:**

| Failure | Expected behavior |
|---|---|
| <failure> | <what happens> |

---

### 4.2 `<failure / retry / degradation flow>`

<same format>

---

## 5. Public contracts

**Minimum 4.** Each one with input **and** output.

### 5.1 `<contract name>`

<one-sentence description>

**Authorization / precondition:** <...>

**Request:**

```<language>
<real example>
```

**Success response:**

```<language>
<real example>
```

**Error responses:**

| Condition | Code | Status |
|---|---|---|
| <condition> | `<CODE>` | <status> |

---

### 5.2 `<contract name>`

<same format>

---

## 6. Error matrix

Separate the distinct planes. An error returned to the caller and an error persisted internally are different things.

### 6.1 Errors on the `<name>` plane

| Code | Status / Class | Cause | Behavior |
|---|---|---|---|
| `<PREFIX>_<NAME>` | | | |

### 6.2 Errors on the `<name>` plane

| Code | Where it is persisted | Cause | Behavior |
|---|---|---|---|
| `<PREFIX>_<NAME>` | | | |

---

## 7. Resilience strategies

| Situation | Strategy | Parameters |
|---|---|---|
| Timeout | | |
| Transient failure | | |
| Permanent failure | | |
| Recovery | | |

---

## 8. Observability

**The three axes are mandatory.**

### 8.1 Logs

| Event | Level | Fields |
|---|---|---|
| | | |

### 8.2 Metrics

| Metric | Type | What it indicates |
|---|---|---|
| | | |

### 8.3 Tracing

Correlation between requests and asynchronous processing.

- <correlation identifier>
- <how to propagate it>

---

## 9. Dependencies and compatibility

| Dependency | Type | Impact if missing |
|---|---|---|
| | | |

**Compatibility:** <what breaks, what is additive, migration needed>

---

## 10. Integration with the existing system

**Real paths. Each one with the symbol and the coupling point.**

### 10.1 `<real/path/to/file>`

**Today:** <real symbol and what it does>

**How the feature fits in:** <precisely where — call, extension, wrapper, injection>

**Why it matters:** <what it guarantees or what may break>

---

### 10.2 `<real/path/to/file>`

<same format>

---

## 11. Technical acceptance criteria

- [ ] <verifiable criterion>
- [ ] <verifiable criterion>

---

## 12. Risks and mitigation

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R-1 | | | |
| R-2 | | | |

---

<!--
CHECKLIST
- [ ] ≥4 contracts, each with input AND output
- [ ] Error matrix with the prefix declared in the configuration
- [ ] ≥4 real paths in the integration section
- [ ] Observability across the three axes (log, metric, tracing)
- [ ] Each risk with actionable mitigation

ANTI-PATTERN
"Monitor the problem" is not mitigation. Mitigation is what changes the behavior:
index, limit, isolation, retry, fallback, feature flag.
-->
