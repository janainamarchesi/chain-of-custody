# Reference case — order webhooks OMS

This is the case Chain of Custody was extracted from. It is here so you can see the method applied end to end, and so you can check the claims in the README against a real artifact.

**The exercise:** an Order Management System (Node.js + TypeScript + Express + Prisma + MySQL) had no events, no queue, and no webhooks. A ~55-minute technical meeting decided to add **outbound webhooks on order status changes**. Nothing was written down except a transcript. The deliverable was a complete design-docs package — with an absolute rule that **not one line of application code could change**.

## What was delivered

| Artifact | Location |
|---|---|
| Package | **[janainamarchesi/mba-ia-desafio-design-docs-com-ia](https://github.com/janainamarchesi/mba-ia-desafio-design-docs-com-ia)** |
| Transcript | `TRANSCRICAO.md` in that repo (read-only throughout) |
| Commits | 6 thematic commits, tree `d8bf616` |

Final numbers, from the mechanical check:

```
ADRs                       7
PRD functional reqs       16
RFC open questions         7
FDD error codes           13
Tracker rows             111   (92 transcript + 19 code)
Locators valid       92/111 = 82.9%
Code paths cited          25   (0 nonexistent)
Files changed outside docs/ and README.md: 0
```

## The decisions that became ADRs

| ADR | Decision | The trade-off it accepted |
|---|---|---|
| 001 | Transactional outbox in MySQL | One more writer in the hot path, in exchange for atomicity between status and event |
| 002 | Exponential backoff + DLQ | Up to ~14h36m to give up, in exchange for surviving long outages |
| 003 | HMAC-SHA256, per-endpoint secret | Key rotation complexity, in exchange for blast-radius containment |
| 004 | At-least-once with `X-Event-Id` | Duplicates reach the client, in exchange for never dropping an event |
| 005 | Separate worker process with 2s polling | Up to 2s of latency, in exchange for isolation from the API |
| 006 | Reuse of existing project patterns | Less flexibility, in exchange for not inventing a second architecture |
| 007 | Payload snapshot in the outbox | Storage cost, in exchange for replay determinism |

## What went wrong (and stayed in the history)

Three real failures, all documented rather than hidden:

1. **`DERIVED` in the traceability table.** Nineteen rows had engineering derivations mixed into the fact table. The spec allowed only two source values. Fixed by moving all nineteen to Appendix A — the table now holds only `TRANSCRICAO` and `CODIGO`.

2. **UTF-8 corruption.** A bulk `Get-Content -Raw` / `Set-Content` edit in PowerShell 5.1 decoded UTF-8 as cp1252 and wrote it back double-encoded: every accented character became two characters (an uppercase A with a tilde, followed by a continuation byte rendered as a printable symbol). The first repair attempt (`Buffer.from(text,'latin1')`) was wrong and produced U+FFFD, because cp1252 bytes 0x80–0x9F are not Latin-1. Fixed with an explicit reverse map.

3. **The validator blamed the documents.** On its first run it reported twelve problems; every one was a bug in the validator. See the README §11.

## Applying the method here

The generic config for this project is [`config.example.pt-br.json`](../../config.example.pt-br.json) — the transcript locator is `[hh:mm] Name`, the allowed sources are `TRANSCRICAO`/`CODIGO`, and the two files the feature *proposes* to create are in `newPathAllowlist`.

To re-run the check against the published package:

```bash
node scripts/verify.mjs <path-to-clone-of-the-package> config.example.pt-br.json
```

That config reproduces the published result exactly: **0 problems**, 111 tracker rows, 92/111 valid locators. The English `config.example.json` is the template for a new project, not for this one.

## Why this case is worth reading

Not because it ended clean, but because the failure modes Chain of Custody now guards against are the ones that actually occurred here. Every anti-pattern in the README's §8 table has a timestamp in this project's history.
