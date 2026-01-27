# System Audit & Hardening Tasks

## 1) Pricing + Billing Consistency
- [ ] Verify DB values for `WIDGET_MESSAGE=0.005` (platform_config + pricing_config) in all envs. (needs manual DB check/seed)
- [x] Update docs/pricing copy (frontend + docs) still referencing 0.05.
- [x] Confirm WhatsApp queue billing uses owner-based billing consistently.

## 2) Free Plan Channel Guard (Server + UI)
- [x] Enforce single active channel for FREE_TRIAL in **create/update** flow (wizard / workspace creation) and prevent dual-channel enable.
- [x] Add clear API error message + UI feedback (reuse CHANNEL_LIMIT_EXCEEDED).
- [x] Unit tests aligned for wizard create + update guard behavior.

## 3) WhatsApp Queue Pre-send Guard
- [x] Ensure pre-send credit/subscription guard covers all send paths.
- [x] Confirm queue item status uses `failed` consistently & reason logged (stats include failed).
- [x] Add unit test for insufficient credit + inactive subscription.

## 4) Widget Playground Flag
- [ ] Decide default behavior (billing skipped only when `isPlayground=true`).
- [ ] Add FE toggle or ensure backend enforces only for explicit playground calls.
- [ ] Add unit test (already added for widget billing), verify integration if needed.

## 5) Campaign Scheduler Funds Guard
- [x] Verify daily schedule at 11:30 and auto-deactivation on insufficient funds.
- [x] Add unit/integration test or mocked scheduler test.

## 6) CORS Hardening
- [x] Audit `app.ts` + `websocket.service.ts` for permissive origins.
- [x] Implement whitelist from env (multiple origins, credentials safe).
- [x] Add doc snippet for env config.

## 7) Config Read Paths
- [x] Billing services read MESSAGE/WIDGET_MESSAGE from PlatformConfigService (no pricing_config fallbacks).
- [ ] Decide whether to migrate `/pricing/config` endpoint + frontend to PlatformConfigService shape.
- [x] Ensure new webhook fields are always present in workspace responses.

## 8) WhatsApp Webhook + Send Flow
- [x] Validate webhook verification + signature handling (hub.challenge, raw-body HMAC with app secret).
- [ ] Cross-check payload mapping vs Meta docs (from/to, metadata, timestamps) and document expectations.
- [ ] Verify message send path uses queue and security check, and avoids billing in playground.

## 9) Dead Code / Old Tables
- [ ] Identify unused tables/fields in Prisma schema & migrations (safe deprecation plan).
- [ ] Remove dead code paths after confirmation.

## 10) Docs Freshness
- [ ] Update docs under `docs/` for pricing, webhook, widget billing, and schedule times.

## 11) Frontend Text Review
- [ ] Home + Workspace selection: copy/labels consistent with business rules (free plan limits, channel types).
- [ ] Settings UI: verify webhook instructions, pricing labels, and debug/WIP messaging.

---

### Proposed test set (unit-first)
- [ ] Backend unit: whatsapp-queue.service, subscription-billing, platform-config, pricing-configuration, widget-billing
- [ ] Add new tests for free-plan guard + queue pre-send guard
