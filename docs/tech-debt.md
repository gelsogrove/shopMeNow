# Tech Debt Log

Backlog of architectural cleanups that are too risky to do ad-hoc and need a dedicated planning + staging-test cycle. Each entry includes scope, blast radius, and a suggested approach.

---

## TD-001 — Unify `Message` and `ConversationMessage` into a single source of truth

**Added:** 2026-05-29
**Owner:** Andrea
**Status:** Open

### Context

The backend has two parallel tables for chat history:

- **`Message`** (legacy) — written by WhatsApp send/receive, widget, billing, rate limiter, customer-delete cascade, soft-delete scheduler. 27 call sites across the backend, mostly in critical paths. 18 columns including WhatsApp delivery tracking (`whatsappStatus`, `whatsappMessageId`, `sentBy`), debug fields (`functionCallsDebug`, `processedPrompt`, `translatedQuery`, `processingSource`, `debugInfo`), and a free-form `metadata` JSON used by the rate limiter.

- **`ConversationMessage`** (newer) — written by ChatEngine / MessagePersistenceService and read by the main `/chat` app and (after the 2026-05-29 fix) the playground. 10 columns: `role` instead of `direction`, `conversationId` as a plain string instead of `chatSessionId` FK, no `metadata`, no soft delete, no WhatsApp delivery columns.

### Symptom that surfaced this

The playground was writing to `Message` but the main `/chat` app reads from `ConversationMessage`. So playground sessions appeared in the chat list with the phone number but **no messages** when clicked. Fixed locally for the playground only (5 call sites migrated). The 27 remaining call sites still use `Message`.

### Why it wasn't done in the same pass

A real unification is **not a rename**. It requires:

- Adding 8+ columns to `ConversationMessage` (`direction` or rely on `role`; `type`, `status`, `aiGenerated`, `read`, `metadata`, `deletedAt`, `updatedAt`, plus WhatsApp delivery fields, plus debug fields). Once added, `ConversationMessage` is effectively a superset of `Message` with a different name — the architectural win shrinks.
- Migrating 27 call sites with column-by-column mapping (`chatSessionId` → `conversationId`, `direction: INBOUND/OUTBOUND` → `role: user/assistant`, etc.).
- A **data migration script** that copies the existing `messages` rows into `conversation_messages` with full mapping, plus verification of row counts and integrity. This is the irreversible step in production.
- Dealing with `MessageArchive` (parallel archived model for messages older than 6 months — same shape as `Message`).

### Critical call sites that block trivial migration

| File | What it does | Risk if migration is wrong |
|---|---|---|
| `interfaces/http/middlewares/hard-rate-limit.middleware.ts` (10 sites) | Anti-spam rate limiter, filters by `metadata.customerId/workspaceId` JSON path | Legit users blocked or spam not blocked |
| `application/services/analytics.service.ts` | Dashboard message counts | Wrong charts |
| `interfaces/http/routes/admin/admin-invoice-revenue.routes.ts` | Per-customer invoice revenue based on message counts | Wrong invoices to customers |
| `services/message-sending.service.ts`, `interfaces/http/controllers/whatsapp-send.controller.ts`, `interfaces/http/controllers/chat.controller.ts` | WhatsApp send tracking via `whatsappStatus`, `whatsappMessageId`, `sentBy` | Lost delivery state |
| `repositories/message.repository.ts` (12 sites) | Main chat repository (de-dup, soft delete, mark-read, archive) | Duplicate messages, lost read state |
| `services/deletion-scheduler.service.ts` | GDPR scheduled hard-delete relying on `Message.deletedAt` | Records that should be deleted survive |
| `repositories/customer.repository.ts` | Cascade delete on customer deletion | Orphan messages |
| `interfaces/http/controllers/workspace.controller.ts` | Unread message count for the workspace badge | Wrong badge |

### Suggested approach when this gets prioritized

1. **Design** the final shape of `ConversationMessage` — decide which `Message` columns become first-class columns and which collapse into the existing `metadata` JSON.
2. **Schema change** (non-destructive): add the missing columns to `ConversationMessage` with sensible defaults. Apply via `prisma migrate dev` in a feature branch.
3. **Data migration script** (`scripts/migrate-messages-to-conversation-messages.ts`):
   - Copy each `Message` row to `ConversationMessage` with full column mapping.
   - For the rate limiter: lift `metadata.customerId/workspaceId` from the JSON into the first-class columns.
   - Verify per-workspace row counts match before and after.
   - Idempotent (safe to run twice — use a unique constraint or skip-if-exists).
4. **Migrate the 27 call sites** in one PR, file by file, running `npm run test:unit` after each.
5. **Test in staging** for at least 48 h: rate limiter, billing, WhatsApp delivery, deletion scheduler.
6. **Production deploy**: run data migration script first (manual), verify, then deploy code that reads from the unified table.
7. **Drop** `Message` and `MessageArchive` from the Prisma schema in a follow-up release once the new table has been verified in production for at least one billing cycle.

### Do NOT do

- Don't try to do this as part of a feature task. It needs its own slot.
- Don't drop `Message` from the schema until the data migration has run in production and at least one full billing cycle has confirmed the counts are right.
- Don't change the rate-limiter behavior without re-testing the anti-spam rules Andrea defined ("max 5 messaggi ogni 10 secondi").

---

## TD-002 — Persist message translations on the DB (shared, durable cache)

**Added:** 2026-05-29
**Owner:** Andrea
**Status:** Open

### Context

The operator-side translation feature (global "Translate to…" combo on the Chat page) currently caches translations **only in the browser's `sessionStorage`** under `chat-translations-cache`, keyed by `${messageId}|${lang}`. Implementation lives in `apps/frontend/src/pages/ChatPage.tsx` around the `translations` state and the batch effect that POSTs missing entries to `/api/chat/translate-messages`.

This works for a single operator on a single browser, but has three real problems:

1. **No sharing across operators.** Operator A translates 100 messages into Italian → operator B opens the same chat and re-pays OpenRouter for the exact same translations.
2. **Cache dies with the tab.** Close the browser, lose every translation. Re-opens cost money again.
3. **Scaling risk.** With ~50 chats × ~30 messages × 2 languages we're already at ~360 KB in `sessionStorage` (Andrea raised this concern). Far from the 5 MB limit today but cache grows monotonically as long as the tab stays open — no eviction.

Translations are **deterministic** (same input text + same target language ⇒ same output) so a DB cache is semantically correct, not just an optimization.

### Suggested approach

1. **Schema** — new table `MessageTranslation`:
   ```
   id            String  @id @default(cuid())
   messageId     String  // FK to whichever table wins TD-001 (Message / ConversationMessage)
   language      String  // ISO 639-1, lowercase: "it", "en", "ar", ...
   content       String  // the translated text
   createdAt     DateTime @default(now())

   @@unique([messageId, language])
   @@index([messageId])
   ```
   Keep `language` lowercase by convention; enforce at the service layer.

2. **Backend** — refactor `chat.controller.translateMessages` (current batch endpoint):
   - Receive `{ targetLanguage, messages: [{id, content}] }` as today.
   - `findMany` on `MessageTranslation` where `messageId IN (ids) AND language = targetLanguage`.
   - Compute the subset NOT yet translated.
   - Call OpenRouter **only** for the missing ones (preserve current parallel `Promise.all`).
   - `createMany` the new rows (skipDuplicates: true to absorb the race where two operators trigger the same batch simultaneously).
   - Return the union (DB hits + new) in the same response shape the frontend expects today.

3. **Frontend** — simplify `ChatPage.tsx`:
   - Remove the `sessionStorage` cache + the persistence effect.
   - Keep the in-memory `translations` state for the lifetime of the page, but stop persisting it.
   - Every batch call now relies on the backend cache → instant for cache hits, no double translation across operators.
   - Resetting `translateTo` on chat switch (already in place) stays as-is.

4. **Invalidation** — message edit is the only case that would stale the cache. Today messages are immutable after creation in our model, so no invalidation needed at v1. If/when we add message editing, add a `MessageTranslation.deleteMany({ where: { messageId } })` to the edit path.

5. **Migration** — no data migration needed: the cache starts empty and warms up as operators use the feature. Pre-translating historical messages is not worth the OpenRouter spend.

### Blockers

- Decide AFTER **TD-001** unification, OR pick the table to FK against now (`Message`) and accept a follow-up rename when TD-001 lands.
- Ensure workspace isolation: even though `messageId` is globally unique, add a defensive filter or include `workspaceId` denormalized on `MessageTranslation` if we ever expose this table to admin tools.

### Why not do it now

It's a perfectly working feature on the demo today (single operator, single browser). The persistence + sharing win is real for multi-operator production tenants, but doesn't move the needle for the DemoWash demo where one operator drives the chat. Plan it alongside (or right after) TD-001 so we don't FK-rewrite twice.

---
