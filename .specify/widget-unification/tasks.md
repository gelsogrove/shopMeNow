---
description: "Task list for Widget + Debug Chat UI Unification"
---

# Tasks: Widget + Debug Chat UI Unification

**Input**: `docs/analysis/widget-unification-plan.md`  
**Goal**: Single shared chat UI for widget + debug/history, with strict workspace isolation.  
**Tests**: Add unit + integration coverage before/with changes.  

## Format: `[ID] [P?] [Phase] Description`

- **[P]**: Can run in parallel.
- Include exact file paths.
- Note impacts: **FE/BE/DB/Security/Tests**.

---

## Phase 0 — Guardrails (CRITICAL)

- [x] T001 **[BE/Security/Tests]** Validate widget code on save: workspaceId required, active, `sellsProductsAndServices=false`  
  - File: `apps/backend/src/interfaces/http/controllers/platform-config.controller.ts`  
  - Tests: `apps/backend/__tests__/unit/controllers/widget-chatbot-config.spec.ts`

- [x] T002 **[Backoffice/FE]** Add warning/validation on widget code UI when ecommerce workspace selected  
  - File: `apps/backoffice/src/pages/PlatformsPage.tsx`  
  - Note: prevents saving wrong widget workspace.

---

## Phase 1 — Widget Storage Isolation

- [x] T003 **[FE/Security/Tests]** Namespace widget localStorage keys by workspaceId  
  - File: `apps/frontend/public/widget.js`  
  - Keys: `echatbot-messages:<workspaceId>`, `echatbot-session-id:<workspaceId>`, `echatbot-visitor-id:<workspaceId>`  
  - Tests: add unit test to ensure key composition (where test infra exists).

- [x] T004 **[FE]** Reset stored session/messages when workspaceId changes  
  - File: `apps/frontend/public/widget.js`

---

## Phase 2 — Shared Chat UI (Renderer Extraction)

- [x] T005 **[FE]** Extract shared chat renderer from debug/history UI  
  - File(s): `apps/frontend/src/components/ChatWidget.tsx` (or current chat history component)  
  - New shared: `apps/frontend/src/components/chat/ChatSurface.tsx`

- [x] T006 **[FE/Tests]** Shared renderer supports Markdown, images, and links  
  - Tests: `apps/frontend/__tests__/components/ChatSurface.spec.tsx`

---

## Phase 3 — Source Adapters (Widget vs Debug)

- [x] T007 **[FE]** WidgetAdapter: visitorId/sessionId + public widget API  
  - File: `apps/frontend/src/components/chat/adapters/widgetAdapter.ts`

- [x] T008 **[FE]** DebugAdapter: customerId + authenticated API  
  - File: `apps/frontend/src/components/chat/adapters/debugAdapter.ts`

- [x] T009 **[FE/Tests]** Adapter mapping unit tests  
  - Tests: `apps/frontend/__tests__/unit/chat/adapters.spec.ts`

---

## Phase 4 — Widget UI Unification

- [x] T010 **[FE]** Replace widget.js UI with shared renderer (embed mini app or shared bundle)  
  - If keeping widget.js: render via a lightweight shared renderer API.  
  - If using React: add widget entry and mount shared component.

- [ ] T011 **[FE/Tests]** Widget shows Markdown/images/links like debug UI  
  - Tests: integration or E2E (as available).

---

## Phase 5 — Scroll + UX Rules

- [ ] T012 **[FE]** Always scroll to bottom on new message and on open  
  - File: `apps/frontend/public/widget.js` or `ChatSurface`  
  - Tests: unit (spy on scroll helper).

- [ ] T013 **[FE]** Remove debug toggles from widget view  
  - File: shared UI (`ChatSurface`) using `source="widget"` gate  
  - Tests: ensure toggles not rendered for widget source.

---

## Phase 6 — Data Rules / Safety

- [x] T014 **[BE/Tests]** Widget cannot show ecommerce catalog when `sellsProductsAndServices=false`  
  - Tests: integration coverage for widget route using informational workspace.

- [ ] T015 **[Docs]** Update docs to reflect shared UI + widget guardrails  
  - Files: `docs/analysis/widget-unification-plan.md`, `docs/architecture/widget-llm-flow.md`

---

## Phase 7 — Pricing: Widget $0.05

- [x] T016 **[DB/Config]** Add `WIDGET_MESSAGE` price key = 0.05  
  - File: `packages/database/prisma/data/platformConfig.ts`

- [ ] T017 **[BE]** Split billing calculation by channel (widget vs whatsapp)  
  - Files: billing/usage services + repository aggregation
  - Ensure queue/channel field used for cost.

- [x] T018 **[FE]** Update pricing UI to show widget message cost  
  - Files: homepage pricing cards + any billing UI text.

- [x] T019 **[Docs]** Update Terms & Pricing docs to mention widget cost  
  - Files: `docs/` (terms, pricing, billing).

- [ ] T020 **[Tests]** Add unit + integration tests for widget vs whatsapp pricing  
  - Verify widget messages billed at $0.05, whatsapp at $0.10.

---

## Acceptance Criteria

- Widget always targets informational workspace.
- Widget and debug UI render the same message formats (Markdown, links, images).
- No cross-workspace message bleed in widget.
- Debug-only controls never appear in widget.
- All tests green for new paths.
