# Widget + Chat UI Unification Plan

## Goal
Unify the website widget chat UI and the internal debug/chat-history UI into one shared component so rendering (Markdown, links, images), behavior, and error handling are consistent while preserving distinct data sources and permissions.

## Scope
- Frontend: shared UI component + source adapters (widget vs debug/history).
- Backend: widget routing remains public, debug/history remains authenticated.
- Backoffice: keep widget configuration/embedding; enforce workspace correctness.
- Tests: add isolation, routing, and rendering coverage.

## Current Issues
- Widget UI is separate (no Markdown/images/links).
- Widget can point to wrong workspace (global widget code).
- Storage not namespaced → cross-workspace message mix.
- Missing tests for widget workspace correctness and isolation.

## Target Architecture
### Shared UI Component
Create `ChatSurface` (name TBD) that:
- Renders Markdown, links, images (reuse existing chat history renderer).
- Supports “source” prop: `widget | debug`.
- Accepts a message list and send handler.
- Handles scroll-to-bottom and unread state.

### Source Adapters
- `WidgetAdapter`: uses `visitorId`, `sessionId`, public widget API.
- `DebugAdapter`: uses `customerId`, authenticated APIs, debug metadata.
- Both map messages into a shared `ChatMessage` shape.

### Storage Isolation
Namespace widget storage by workspace:
- `echatbot-messages:<workspaceId>`
- `echatbot-session-id:<workspaceId>`
- `echatbot-visitor-id:<workspaceId>`

## Backoffice/Platform Controls
- Keep `widgetChatbotCode` stored in platform config.
- Enforce widget code correctness on save:
  - workspaceId required
  - workspace exists and active
  - `sellsProductsAndServices=false`
- Provide admin UX hint: “Homepage widget must target informational workspace only.”

## Tasks (Ordered)

### Task 01 — Lock widget to informational workspace
**Scope:** Backend + Backoffice  
**Why:** Prevent widget from pointing to ecommerce workspaces.  
**Work:**
- Enforce workspace validation on widget code save (require workspaceId, active, `sellsProductsAndServices=false`).
- Backoffice: warn or block saving when workspace is ecommerce.
**Tests:**
- Unit: widget code save rejects missing/invalid/ecommerce workspace.
- Integration: widget message to ecommerce workspace returns 400.
**Status:** partially done (backend validation done, backoffice warning pending).

### Task 02 — Namespace widget storage by workspace
**Scope:** Frontend widget.js  
**Why:** Avoid cross‑workspace message bleed.  
**Work:**
- Storage keys include workspaceId for visitorId/sessionId/messages.
**Tests:**
- Unit: storage key uses workspaceId.
**Status:** pending.

### Task 03 — Shared chat renderer extraction
**Scope:** Frontend  
**Why:** Consistent Markdown/images/links between widget and debug UI.  
**Work:**
- Extract chat bubble renderer from debug/chat history into `ChatSurface`.
- Use in debug UI.
**Tests:**
- Unit: Markdown, links, images render consistently.
**Status:** pending.

### Task 04 — Widget adapter + debug adapter
**Scope:** Frontend  
**Why:** Single UI, multiple data sources.  
**Work:**
- WidgetAdapter uses `visitorId` + public API.
- DebugAdapter uses `customerId` + auth API.
**Tests:**
- Unit: message mapping for both sources.
**Status:** pending.

### Task 05 — Widget UI unification
**Scope:** Frontend  
**Why:** Single UI for widget and debug.  
**Work:**
- Replace widget.js UI with shared renderer or embed minimal React bundle.
**Tests:**
- Integration: widget UI renders Markdown and images.
**Status:** pending.

### Task 06 — Scroll behavior + UX polish
**Scope:** Frontend widget  
**Why:** Keep latest messages visible.  
**Work:**
- Force scroll to bottom on new messages + on open.
**Tests:**
- Unit: scroll function called on append/open.
**Status:** pending.

## Tests (Unit + Integration)
### Backend Unit
- `platform-config.controller`: reject widget code without workspaceId.
- Reject widget code if workspace is ecommerce.
- Accept widget code if workspace is informational + active.

### Frontend Unit
- Widget storage namespacing uses workspaceId.
- Adapter mapping: widget vs debug message mapping.
- Shared renderer shows Markdown, links, images consistently.

### Integration
- Widget message to informational workspace returns FAQ/infos, not catalog.
- Widget message to ecommerce workspace is rejected (400).
- Debug UI uses same renderer, same markdown output.

## Acceptance Criteria
- Homepage widget always targets `eChatbot HQ` (informational).
- Widget cannot be configured to ecommerce workspace.
- Widget and debug UI render identical message styles (Markdown, images, links).
- Messages don’t leak across workspaces.
- Unit and integration tests green for widget path and platform config.

## Risks
- Widget.js is standalone (non-React) → may require partial duplicate renderer or a lightweight shared bundle.
- Overfitting widget to debug UI may increase bundle size.

## Next Steps
1. Lock widget code to `eChatbot HQ` in platform config and add validation tests.
2. Namespace widget storage.
3. Plan UI unification (decide on shared renderer extraction or embedding React in widget).

## New Requirement: Widget message cost = $0.005
### Impact Summary
- **FE**: Pricing card on homepage and any billing UI must show widget cost.
- **BE**: Billing/usage calculation must distinguish widget messages vs WhatsApp messages.
- **Queue**: Message records must carry channel/source for cost calculation.
- **Docs/Terms**: T&C and pricing docs must mention widget rate.
- **Tests**: Unit + integration for pricing split.

### Risk
If widget and WhatsApp share the same price key, usage is misbilled. We need a distinct price key and cost path.

### Proposed Approach
- Add new price key: `WIDGET_MESSAGE = 0.005`.
- Track channel on messages (widget vs whatsapp) for billing aggregation.
- Update pricing UI and homepage to show both (WhatsApp $0.10, Widget $0.005).
