# Campaigns (Push Messaging) – Design & Roadmap

Goal: enable promotional WhatsApp campaigns at $1 per attempted send, immediate or scheduled, with safety around credit, rate limits, opt-in, and billing integrity. This doc covers requirements, architecture, data model, API, FE, scheduling, WA limits, security, acceptance criteria, and task roadmap.

## Requirements
- Send promotional WhatsApp messages (templated) to a recipient set.
- Modes: send now or schedule at future datetime.
- Cost: $1 per attempted send (not per delivery).
- Respect credit balance and block when insufficient.
- Respect opt-in/opt-out, blacklist, blocked/fake customers.
- Handle volumes 100–200+ without hitting WA rate limits (throttling/backoff).
- Admin/dev users route to sandbox WA/payments; others to live.
- Manual trigger for processing (no auto-recharge).
- Full auditability and per-recipient status.

## Data Model (proposed)
- `campaigns`
  - `id`, `workspaceId`, `name`, `status` (DRAFT, SCHEDULED, RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED)
  - `channel` (enum: whatsapp for now)
  - `sendAt` (nullable), `createdByUserId`, `createdAt/updatedAt`
  - `templateId`, `templateLocale`, `bodyPreview`, `mediaUrl` (optional)
  - `expectedRecipients`, `actualSent`, `actualFailed`
  - `costPerMessage` (decimal, default 1.00 USD), `billingStatus` (PENDING, BILLED, FAILED)
  - `throttlePerSecond` (int), `batchSize` (int), `lastError`
  - `notes`, `metadata` (jsonb)
- `campaign_recipients`
  - `id`, `campaignId`, `customerId` (nullable), `phone`
  - `status` (PENDING, SENT, FAILED, SKIPPED)
  - `errorCode`, `errorMessage`, `sentAt`, `messageId` (WA)
  - `priceCharged` (decimal)
  - `isBlacklisted`, `isBlocked`, `isFake`, `optOutAt` (for auditing why skipped)
- Optional `campaign_jobs` if we need cursor tracking; otherwise reuse queue with payload `{ campaignId, cursor }`.

Indexes: campaigns by (workspaceId, status), recipients by (campaignId, status), unique (campaignId, phone) to avoid duplicates.

## API (backend)
- `POST /campaigns` – create draft, validate template and workspace credit estimate.
- `POST /campaigns/:id/schedule` – set sendAt, generate recipients, compute estimated cost.
- `POST /campaigns/:id/run-now` – start immediately.
- `POST /campaigns/:id/pause`, `/resume`, `/cancel`.
- `GET /campaigns` – list with filters (status, workspace).
- `GET /campaigns/:id` – detail and summary stats.
- `GET /campaigns/:id/recipients` – paginated recipients with filters (status).
- Admin/dev: always route WA sandbox when owner is dev/admin; otherwise live.

## Service Logic
- Recipient builder: from customers with filters (all, tags, created range) or CSV upload. Exclude `blacklisted`, `blocked`, `fake`, `opt-out`, invalid numbers. Deduplicate phone.
- Cost estimation: `count * costPerMessage`; block if `creditBalance < estimate` unless user confirms partial? (recommend block).
- Enqueue job: one job per campaign; worker processes in batches (e.g., 50–100) with delay (token bucket) to avoid WA 429/613.
- Status transitions:
  - DRAFT -> SCHEDULED | RUNNING
  - RUNNING -> COMPLETED | FAILED | PAUSED | CANCELLED
- Billing:
  - Charge at send attempt: decrement credit for each `SENT` (and possibly for WA submit even if delivery fails). If credit runs out mid-run: pause campaign and surface error.
  - Track `priceCharged` per recipient.
- Retry:
  - Retry only transient errors (rate limit, timeouts) with backoff; do not retry invalid number/template/opt-out.
- Idempotency:
  - Unique (campaignId, phone); skip duplicates; store messageId to avoid double send.

## WhatsApp Delivery Considerations
- Use approved template with correct locale; validate required variables before enqueue.
- Rate limiting: apply `throttlePerSecond` per workspace and global cap. On 429, backoff and resume.
- Batch size configurable via platform-config defaults.
- For 100–200 messages: chunk + delay ensures we do not saturate WA.
- If template not approved or media missing, block campaign creation.

## Frontend (Backoffice)
- New section “Campaigns”:
  - List: name, status, channel, scheduled time, expected recipients, sent/failed, cost estimate/current cost.
  - Actions: Create, Pause/Resume, Cancel, View.
- Wizard Create Campaign:
  1) Select workspace/channel (WA only).
  2) Pick template + locale, map variables (show preview).
  3) Recipients: filter (all/tag/date) or upload CSV; show count, invalid list.
  4) Schedule: send now or later; throttling defaults; time zone.
  5) Summary: cost estimate, credit check, confirmation.
- Detail view:
  - Progress bar, counts sent/failed/skipped, logs.
  - Recipients tab with statuses, errors, retry (if allowed), export.
  - Controls: Pause/Resume, Cancel.
- UI guardrails:
  - Warn about cost; require confirmation.
  - Show credit remaining and block if insufficient.
  - Read-only environment info (sandbox/live) chosen by backend.

## Scheduling / Jobs
- Scheduler picks campaigns with status SCHEDULED and sendAt <= now -> set RUNNING and enqueue worker.
- Worker processes recipients in batches with rate limit and updates status; if error fatal, set FAILED with lastError.
- If credit exhausted: pause campaign and emit event/notification.

## Security / Compliance
- Opt-in/opt-out enforcement: exclude opt-out; store optOutAt and reason.
- Access control: only workspace owners/admin; dev routes to sandbox.
- Audit log: creation, schedule, pause/resume/cancel, cost estimation, billing deductions.
- Input validation: template variables, phone formatting, CSV sanitation.
- Billing integrity: deduct credit atomically with send; prevent negative balance; transaction wrapper for per-batch billing.
- Idempotency: unique recipient constraint; single worker per campaign at a time (lock).

## Acceptance Criteria (initial)
1) Create campaign with template + recipients list and see cost estimate = recipients * $1.
2) Schedule campaign for future; worker starts at sendAt and status moves to RUNNING then COMPLETED.
3) Credit check: campaign with insufficient credit is blocked before scheduling; if credit depletes mid-run, campaign pauses with error.
4) Opt-out/blocked/blacklist recipients are skipped and not charged.
5) Rate limiting: sending 100–200 recipients respects configured throttle and does not hit WA 429; on 429, campaign backs off and resumes.
6) Per-recipient status visible (PENDING/SENT/FAILED/SKIPPED) and exportable.
7) Billing log per recipient shows $1 charge and total cost reflected in workspace credit.
8) Cancel/ pause/resume works and no duplicate sends occur.
9) Dev/admin users force sandbox WA; others use live.
10) Audit log captures creation/schedule/pause/resume/cancel and billing deductions.

## Roadmap (tasks)
- T1: DB migrations for `campaigns`, `campaign_recipients` (indexes, unique constraint).
- T2: Platform config: default costPerMessage (1.00 USD), default throttle and batch size.
- T3: Backend services: CampaignService (create, schedule, run-now, pause/resume/cancel, recipient builder, cost estimation, credit check).
- T4: API endpoints per above with RBAC; validation (template, recipients).
- T5: Job worker + scheduler integration; throttling/backoff; billing hook.
- T6: WhatsApp send integration: template validation, per-recipient send, error mapping, idempotency.
- T7: Frontend Backoffice: Campaigns list, create wizard, detail view, progress, recipient table, actions.
- T8: Analytics/exports: CSV export of recipients and status; cost summary.
- T9: Security/compliance: opt-out enforcement, audit log, input validation, access control tests.
- T10: Testing: unit (service, billing, throttling), integration (API + worker), e2e mock WA, performance for 200+ recipients.
- T11: Docs: update README/deploy and add user-facing guide for campaigns.

## Example flow (v1)
1) Admin opens Backoffice → Campaigns → “New Campaign”.
2) Step 1: name “Spring Promo”, optional future `sendAt`.
3) Step 2: paste customer IDs (`cust-1 cust-2 cust-3`). Only WhatsApp-enabled workspaces allowed; opt-out/blacklist will be auto-skipped.
4) Step 3: summary shows recipients count and cost estimate (recipients × $1.00). Confirm.
5) Worker picks the campaign when `sendAt <= now`, debits $1 per send attempt, enqueues into `whatsapp_queue`, updates recipient statuses. If credit runs out, campaign pauses with “Insufficient credit”.
6) When all recipients processed, campaign → COMPLETED with sent/failed/skipped counts.

## Code Sketches (high level)

Recipient builder:
```ts
const recipients = await recipientBuilder.build({
  workspaceId,
  filters,
  includeCsvPhones,
  exclude: { blacklisted: true, blocked: true, fake: true, optOut: true },
})
const unique = dedupePhones(recipients)
const estimate = unique.length * COST_PER_MESSAGE
if (credit < estimate) throw new InsufficientCreditError()
```

Worker loop with throttle:
```ts
for (const batch of chunk(recipients, batchSize)) {
  await rateLimiter.wait(batch.length) // token bucket
  for (const r of batch) {
    const res = await whatsappSender.sendTemplate({ to: r.phone, templateId, locale, vars })
    markSent(r, res.messageId)
    bill(r, costPerMessage)
  }
}
```

Status transitions:
```ts
await campaigns.updateStatus(id, 'RUNNING')
// on completion
await campaigns.updateStatus(id, 'COMPLETED')
// on error
await campaigns.updateStatus(id, 'FAILED', { lastError })
```

Billing per recipient:
```ts
await billing.charge({
  workspaceId,
  amount: costPerMessage,
  currency: 'USD',
  reason: 'campaign_send',
  referenceId: campaignId,
})
```
