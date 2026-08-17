# Security — custom-demoam (audit 2026-08-17, fixes applied same day)

Security map for the two channels the demoam chatbot runs on: **widget** and
**WhatsApp (wasender)**. Every claim below was verified against the code on the
date above; file references are the enforcement points. Contract rules
referenced: 25 (blacklist = total silence), 26 (channel off = nothing sent),
27 (no credit = WIP message).

Status legend: ✅ enforced in code · ⚠️ partial / caveat · ❌ missing.

The audit found gaps in blacklist, channel-off, outbound LLM screening,
profanity and queue dedup; all were **fixed on 2026-08-17** (see per-section
notes). Full unit suite green after the fixes: 288/288 suites.

---

## 1. QR code (WhatsApp session pairing) — ✅

All wasender session endpoints (`initialize`, `disconnect`, `delete`,
`regenerate-qr`, `restart`, `sync-status`) require **JWT + workspace
validation**:

- `apps/backend/src/interfaces/http/routes/wasender.routes.ts` — every route
  goes through `authMiddleware` + `workspaceValidationMiddleware`.

The public webhook (`POST /wasender/webhook/:workspaceId`) that receives QR
updates is:

- rate-limited: 30 req/min per workspaceId (express-rate-limit in the same
  routes file);
- signature-verified: `verifyWasenderSignature` against the per-session
  `wasenderWebhookSecret` stored on the workspace
  (`wasender-webhook.controller.ts`).

⚠️ One soft spot: **legacy sessions saved before the secret existed fall
through with only the sessionId check**. Re-pairing the session stores a
secret and closes this.

## 2. API rate limits — ✅

Three independent layers, all DB-backed (no in-memory bypass):

| Layer | Limits | Where |
|---|---|---|
| Hard limits (outbound) | 5 msg/10s per customer · 30/min, 200/h, 1000/day per workspace | `hard-rate-limit.middleware.ts` — fail-safe: on error the request is **denied** |
| Inbound 5-step check, step 1 + step 5 (flood) | 5+ msg/10s → blocked | `security-check.service.ts` (`checkRateLimit`, `checkAntiSpam`) — runs on widget **and** WhatsApp inbound |
| Demo kill switch | burst on a demo workspace (`customChatbotId` set) → whole channel disabled (`channelStatus=false`) until an admin re-enables | `widget-chat.controller.ts` (`demoRateLimitExceeded`) |

The demo kill switch matters for demoam: this module IS a `customChatbotId`
workspace, so widget abuse turns the channel off entirely.

## 3. Final security LLM before sending — ✅ (fixed 2026-08-17)

The SECURITY agent (prompt from DB, `agent_configs type='SECURITY'`, called
via OpenRouter) now runs on every outbound path that carries LLM-generated
content:

- **WhatsApp queue** (push campaigns): `whatsapp-queue.service.ts`
  `validateAndSend()` → `SecurityAgent.process()`.
- **WhatsApp direct send**: `whatsapp-direct-send.service.ts` `send()`.
- **WhatsApp bot replies** (custom-chatbot path): `whatsapp-inbound.pipeline.ts`
  now passes `skipSecurityCheck: welcome !== null` — only the turn-1 welcome
  (admin-configured content) skips; every LLM reply is screened. *(was:
  always skipped)*
- **Widget replies** (all three exits: custom main path, registration path,
  generic chat-engine path): `widget-chat.controller.ts`
  `screenOutboundReply()` — reply is saved to history for admin review but
  **not delivered and not billed** when blocked. *(was: no outbound check)*

Still legitimately skipped: WIP messages, welcome messages, operator
notifications — admin/system-configured content, not LLM output.

⚠️ Every LLM security check is **fail-open** — missing API key, HTTP error,
or unparseable JSON all return safe (`SecurityAgent.ts`). Deliberate
availability trade-off; documented so nobody mistakes it for a guarantee.
Note the cost: one extra LLM call (gpt-4o-mini) per screened reply.

## 4. Sender validates all IDs before sending — ⚠️ (improved, not unified)

Checks at send time after the 2026-08-17 fixes:

| Check | Queue (`validateAndSend`) | Direct send (`send`) |
|---|---|---|
| Phone present + format | ✅ | present only |
| Content non-empty | ✅ | ❌ (callers validate) |
| Workspace exists + provider configured | ✅ | ✅ |
| `enableWhatsapp` | ✅ (workspace loop) | ❌ |
| `channelStatus` | ✅ (fixed — see §8) | ❌ (callers check) |
| Blacklist / customer↔workspace | via security agent | via security agent (when not skipped) |

A single shared pre-send gate (workspace ↔ customer ↔ phone + blacklist +
channel + handoff in one deterministic validator) remains the clean target
design — open item, needs Andrea's go-ahead since it touches working code.

## 5. Same message never sent twice — ✅ (fixed 2026-08-17)

- **Inbound webhook dedup**: both wasender and ultramsg record every webhook
  event in `WhatsappWebhookEvent` (unique constraint) — a redelivered webhook
  is detected as duplicate and never re-processed. One inbound message → at
  most one reply.
- **Queue atomic claim** *(new)*: `claimMessage()` in
  `whatsapp-queue.service.ts` flips `pending → sending` with a conditional
  `updateMany`; a second worker (second dyno, overlapping cycle) gets
  `count: 0` and skips. **At-most-once by design** (Andrea 2026-08-17): a
  crash mid-send leaves the row in `sending`, which is deliberately never
  auto-retried — the same message can never be delivered twice; stuck
  `sending` rows surface in queue stats for manual review. Genuine send
  *failures* still retry with backoff (`recordFailure` → `pending`), which is
  safe because failure means not delivered.
- **Reminders**: `ReminderLock` dedup locks (24h/1h) prevent duplicate
  appointment reminders.

## 6. Profanity blocked — ✅ (fixed 2026-08-17)

Mechanism in code, content in DB (rule 1A):

- The **AmRobot SECURITY prompt** (`agent_configs`, type `SECURITY`) now
  lists profanity under HARMFUL CONTENT: *"Profanity, swear words or vulgar
  language, in ANY language"* — reported as `HARMFUL_CONTENT`, so no code
  enum changed.
- With §3 in place, that prompt now screens **every LLM-generated reply** on
  both channels before delivery.

Boundaries to know:

- *Inbound* customer profanity is not blocked deterministically (inbound
  content-safety covers XSS/SQLi/prompt-injection only) — by design: no word
  lists in code, the bot's tone rules handle it.
- Workspaces without a SECURITY agent row get no screening (fail-open). As of
  the audit: DemoWash and DemoRealEstate have **no** SECURITY agent;
  eChatbot HQ has an **empty** prompt. Decision pending from Andrea.

## 7. WhatsApp best practices — ✅ (with the §1 legacy caveat)

- Webhook authenticity: per-session secret + signature verification (§1).
- Webhook idempotency: `WhatsappWebhookEvent` unique-constraint dedup (§5).
- Webhook rate limit: 30/min per workspace (§1).
- Outbound formatting: `mdToWhatsApp` deterministic converter — no raw
  Markdown leaks to customers, HTML stripped defensively.
- Session endpoints never exposed publicly; QR strings only behind JWT +
  workspace validation.
- Message length capped at the WhatsApp 4096-char limit on inbound.
- Billing is deliver-then-bill with a `BILLING_RECONCILE` error alert if
  deduction fails after delivery.

## 8. Channel disabled blocks sends — ✅ (fixed 2026-08-17)

- **Widget**: `channelStatus=false` → blocked before any processing
  (403 or WIP message, `widget-chat.controller.ts`).
- **WhatsApp inbound → reply**: `channelStatus=false` → WIP path, no LLM,
  no normal reply (`whatsapp-inbound.pipeline.ts`).
- **WhatsApp queue** *(new)*: `processPendingMessages` now tests
  `channelStatus === false` before anything else (even before the debug-WIP
  branch) — nothing goes out, messages stay `pending` and are delivered when
  the channel is re-enabled. *(was: field selected but never tested)*
- **Direct send**: no channel check inside `send()` — callers are trusted;
  covered by the inbound-side checks above on every current call path.

## Blacklist / blocked customer (contract rule 25) — ✅ (fixed 2026-08-17)

Rule 25 demands **total silence**: no reply, no history save, no LLM call.

| Path | Enforcement |
|---|---|
| Ultramsg inbound | ✅ 410 right after customer lookup (pre-existing) |
| Wasender inbound *(new)* | ✅ 410 guard in `wasender-webhook.controller.ts` after customer resolution — before history save, LLM, and operator relay |
| Widget inbound *(new)* | ✅ 410 guard in `widget-chat.controller.ts` after customer resolution, before the operator-handoff guard |
| Push campaigns (enqueue) | ✅ blacklisted/inactive/no-consent recipients filtered with per-recipient error codes (pre-existing) |
| Queue (send time) | ⚠️ only via security agent (does not query blacklist) — a customer blacklisted *after* enqueue still receives already-queued messages; acceptable residual, fix belongs in the shared sender gate (§4) |
| Chat engine (internal) | ✅ helper (pre-existing) |

---

## Remaining open items (decision needed from Andrea)

1. **Shared sender gate** (§4) — one deterministic pre-send validator for
   queue + direct send; also closes the §Blacklist queue residual.
2. **SECURITY agent missing/empty on other workspaces** (§6) — DemoWash,
   DemoRealEstate (none), eChatbot HQ (empty prompt).
3. **Legacy wasender sessions without webhook secret** (§1) — re-pair to
   enforce signatures everywhere.
