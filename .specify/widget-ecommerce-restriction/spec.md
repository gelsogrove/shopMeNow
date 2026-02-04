# Widget E-commerce Restriction - Technical Specification

## 1. Overview

### Context
Currently, the system incorrectly allows `channelType: "WIDGET"` to be used with e-commerce workspaces (`sellsProductsAndServices: true`). However, widget visitors use temporary localStorage-based `visitorId` that expire after 24 hours, making them unsuitable for persistent e-commerce operations (cart, orders, customer accounts).

### Problem Statement
**Widget with anonymous visitorId cannot guarantee cart/order persistence** because:
- `visitorId` expires after 24 hours
- User clearing localStorage loses all data
- No cross-device support (different visitorId per browser)
- Customer abandons cart → returns next day → cart is empty

### Solution
**Enforce strict separation**: Widget available ONLY for informational/support channels (`sellsProductsAndServices: false`). E-commerce channels must use WhatsApp (permanent phone number identification).

### Acceptance Criteria (Andrea's Requirements)
1. ✅ Widget available ONLY for channels with `sellsProductsAndServices: false`
2. ✅ UI must work without surprises (clear error messages, proper validation)
3. ✅ Complete coverage: Backend, Frontend, Scheduler, Documentation
4. ✅ High test coverage (>80% for modified files)
5. ✅ No ambiguity in workspace creation wizard
6. ✅ Settings page prevents enabling widget for e-commerce workspaces

---

## 2. Functional Requirements

### FR-1: Backend Validation (MUST)
**Description**: Backend MUST enforce that widget can only be enabled for non-e-commerce workspaces.

**Implementation**:
- `WorkspaceService.create()`: If `enableWidget: true` → force `sellsProductsAndServices: false`
- `WorkspaceService.update()`: If attempting to enable widget on e-commerce workspace → throw validation error
- Validation error message: "Widget channel cannot be enabled for e-commerce workspaces. E-commerce requires WhatsApp for persistent customer identification."

**Affected Files**:
- `apps/backend/src/application/services/workspace.service.ts`
- `apps/backend/src/services/workspace.service.ts`

### FR-2: Wizard UI Validation (MUST)
**Description**: Workspace creation wizard MUST prevent selecting widget for e-commerce channels.

**Implementation**:
- Step 1: Channel Type selection
  - If user selects "Widget" → auto-set `sellsProductsAndServices: false` (disabled toggle)
  - Show info message: "⚠️ Widget channels are for support/info only. E-commerce requires WhatsApp."
- Step 2: E-commerce toggle
  - If `channelType: "WIDGET"` → disable "Sell products/services" option (grayed out)
  - If user tries to enable → show tooltip: "Switch to WhatsApp channel to enable e-commerce"

**Affected Files**:
- `apps/frontend/src/pages/WorkspaceSelectionPage.tsx` (wizard logic)

### FR-3: Settings Page Validation (MUST)
**Description**: Settings page MUST prevent enabling widget for existing e-commerce workspaces.

**Implementation**:
- Settings → Channels section
- If `sellsProductsAndServices: true`:
  - "Enable Widget" toggle is DISABLED (grayed out)
  - Show info text below: "⚠️ Widget not available for e-commerce channels. Disable e-commerce features first to enable widget."
- If `sellsProductsAndServices: false`:
  - "Enable Widget" toggle is ENABLED

**Affected Files**:
- `apps/frontend/src/pages/SettingsPage.tsx`

### FR-4: API Error Handling (MUST)
**Description**: API endpoints MUST return clear error messages when validation fails.

**Error Responses**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Widget channel cannot be enabled for e-commerce workspaces",
  "field": "enableWidget",
  "reason": "E-commerce requires persistent customer identification (WhatsApp phone number)"
}
```

**Affected Endpoints**:
- `POST /api/v1/workspaces`
- `PUT /api/v1/workspaces/:id`

### FR-5: Remove channelType Enum (SHOULD)
**Description**: Remove `channelType` enum from database schema since it creates confusion. Use `enableWhatsapp`/`enableWidget` booleans directly.

**Migration Path**:
```sql
-- Existing workspaces with channelType=WIDGET
UPDATE workspace 
SET enableWidget = true, 
    enableWhatsapp = false,
    sellsProductsAndServices = false
WHERE channelType = 'WIDGET';

-- Existing workspaces with channelType=WHATSAPP  
UPDATE workspace
SET enableWhatsapp = true,
    enableWidget = false
WHERE channelType = 'WHATSAPP';

-- Drop column
ALTER TABLE workspace DROP COLUMN channelType;
```

**Affected Files**:
- `packages/database/prisma/schema.prisma`
- Database migration script

### FR-6: Scheduler Compatibility (MUST)
**Description**: Verify scheduler jobs are NOT affected by widget e-commerce restriction.

**Analysis Required**:
- Campaign scheduler: Uses `workspaceId` (unaffected)
- Order reminder jobs: Only for e-commerce workspaces (Widget excluded by design)
- Widget analytics: Tracks visitor engagement (unaffected)
- WhatsApp queue: Independent of widget config (unaffected)

**Expected Result**: ✅ **NO CHANGES NEEDED** - Scheduler is agnostic to channel validation rules.

**Affected Files**:
- `apps/scheduler/src/` (analysis only, no code changes)

### FR-7: Documentation Updates (MUST)
**Description**: Update all documentation to reflect widget restriction.

**Files to Update**:
- `docs/architecture/api-changelog-wizard.md`: Update examples
- `docs/architecture/widget-ecommerce-restriction.md`: New doc explaining why
- `README.md`: Update feature list
- `docs/PRD.md`: Update channel types section
- `apps/backend/src/swagger.yaml`: Update API documentation

---

## 3. Non-Functional Requirements

### NFR-1: Test Coverage (MUST)
**Target**: >80% coverage for all modified files

**Test Requirements**:
- **Backend Unit Tests**:
  - `workspace.service.spec.ts`: Test validation logic
    - ✅ Creating widget channel forces `sellsProductsAndServices: false`
    - ✅ Updating widget channel to e-commerce throws error
    - ✅ Creating e-commerce channel prevents `enableWidget: true`
  - `workspace-wizard.service.spec.ts`: Test wizard creation logic

- **Backend Integration Tests**:
  - `workspace-creation.integration.spec.ts`:
    - ✅ POST /workspaces with `enableWidget: true` + `sellsProductsAndServices: true` → 400 error
    - ✅ PUT /workspaces/:id enabling widget on e-commerce workspace → 400 error

- **Frontend Component Tests**:
  - `WorkspaceSelectionPage.spec.tsx`:
    - ✅ Selecting widget disables e-commerce toggle
    - ✅ Selecting e-commerce grays out widget option
  - `SettingsPage.spec.tsx`:
    - ✅ E-commerce workspace shows disabled widget toggle
    - ✅ Info message displays correctly

### NFR-2: Backward Compatibility (MUST)
**Description**: Existing workspaces must continue working without manual intervention.

**Migration Strategy**:
- Run database migration to convert `channelType` → `enableWhatsapp`/`enableWidget` flags
- Existing widget workspaces (`channelType=WIDGET`) automatically get `sellsProductsAndServices: false`
- NO breaking changes to API (graceful degradation)

### NFR-3: Error Messages (MUST)
**Description**: All error messages must be clear, actionable, and user-friendly.

**Language**: English only (as per constitution Rule #15)

**Examples**:
- ✅ "Widget channel cannot be enabled for e-commerce workspaces. E-commerce requires WhatsApp for persistent customer identification."
- ❌ "Invalid configuration" (too vague)

### NFR-4: UI/UX Consistency (MUST)
**Description**: UI changes must follow existing design system (shadcn/ui).

**Requirements**:
- Use existing `<Alert>` component for info messages
- Use `disabled` state for grayed-out toggles
- Use `<Tooltip>` for explaining why option is disabled
- Follow existing color scheme (blue for info, orange for warnings)

---

## 4. User Stories

### US-1: As a workspace creator, I want clear guidance when choosing widget vs WhatsApp
**Scenario**: User creating new workspace in wizard

**Given**: User is on workspace creation wizard Step 1 (Channel Type)  
**When**: User selects "Widget" option  
**Then**:
- E-commerce toggle in Step 2 becomes disabled (grayed out)
- Info message appears: "⚠️ Widget channels are for support/info only. E-commerce requires WhatsApp."
- User cannot proceed with e-commerce enabled

**Acceptance Criteria**:
- Info message is visible immediately after selecting Widget
- E-commerce toggle is visually disabled (opacity: 0.5, cursor: not-allowed)
- Tooltip explains why when hovering over disabled toggle

### US-2: As a workspace admin, I want to understand why I can't enable widget for my e-commerce channel
**Scenario**: Admin trying to enable widget in Settings

**Given**: Workspace has `sellsProductsAndServices: true`  
**When**: Admin navigates to Settings → Channels section  
**Then**:
- "Enable Widget" toggle is disabled (grayed out)
- Info text appears below: "⚠️ Widget not available for e-commerce channels. Disable e-commerce features first to enable widget."
- Admin understands the limitation

**Acceptance Criteria**:
- Info text is always visible (not just on hover)
- Link to documentation explaining widget limitations
- Clear path forward: "Disable e-commerce" → "Enable widget"

### US-3: As a developer, I want backend validation to prevent inconsistent workspace configurations
**Scenario**: API call attempting invalid configuration

**Given**: API request to create/update workspace  
**When**: Request has `enableWidget: true` AND `sellsProductsAndServices: true`  
**Then**:
- API returns 400 Bad Request
- Error response includes clear message and field reference
- No workspace is created/updated

**Acceptance Criteria**:
- Error message explains WHY configuration is invalid
- Error includes field name for frontend to highlight
- Transaction is rolled back (no partial state)

---

## 5. Edge Cases

### EC-1: Existing Widget E-commerce Workspaces
**Problem**: Some workspaces may have been created with `channelType: WIDGET` + `sellsProductsAndServices: true` before this fix.

**Solution**:
- Database migration detects these workspaces
- Auto-converts to `sellsProductsAndServices: false`
- Logs warning for manual review
- Sends email notification to workspace admin

### EC-2: User Disables E-commerce After Enabling Widget
**Scenario**: Workspace starts as support-only (widget enabled) → Admin enables e-commerce later

**Current Behavior**: Widget stays enabled (inconsistent state)

**Expected Behavior**:
- When enabling `sellsProductsAndServices: true` → auto-disable `enableWidget`
- Show confirmation dialog: "Enabling e-commerce will disable widget channel. Continue?"
- Update workspace settings atomically

### EC-3: Widget Already Embedded on Client Website
**Problem**: Client has widget script embedded, then we disable widget due to e-commerce migration.

**Solution**:
- Widget script shows graceful error: "This channel is no longer available. Please contact support."
- Admin sees warning in Settings: "⚠️ Widget is currently embedded on your website. Disabling will break existing installations."
- Require explicit confirmation before disabling

### EC-4: Dual-Channel Workspace (WhatsApp + Widget)
**Current State**: User wants both WhatsApp AND Widget enabled

**Business Rule**:
- If `sellsProductsAndServices: true` → WhatsApp only
- If `sellsProductsAndServices: false` → WhatsApp + Widget allowed

**Implementation**:
- Settings page allows both toggles IF support-only
- If e-commerce enabled → widget toggle disabled

---

## 6. Technical Constraints

### TC-1: Database Migration Complexity
**Challenge**: Converting `channelType` enum to boolean flags requires careful migration.

**Risk Mitigation**:
- Test migration on staging database first
- Create rollback script
- Log all conversions for audit trail

### TC-2: Frontend State Management
**Challenge**: Wizard has complex state interactions (channel type affects e-commerce, which affects FAQs).

**Solution**:
- Use React state reducer for wizard steps
- Validate state transitions (prevent invalid combinations)
- Add unit tests for state machine

### TC-3: API Versioning
**Challenge**: Changing validation rules may break existing API clients.

**Solution**:
- Keep API version stable (`/api/v1`)
- Add `X-API-Version` header for future compatibility
- Document breaking changes in changelog

---

## 7. Out of Scope (Future Features)

### Future: Widget with Login/Register
**Description**: Allow widget to support e-commerce IF user logs in.

**Requirements** (NOT in this spec):
- Widget header with "Login" / "Register" buttons
- JWT token authentication for widget users
- Session persistence beyond 24h
- Cross-device support via account login

**Timeline**: Separate feature (estimated 2-3 weeks of work)

### Future: Hybrid Identification
**Description**: Allow visitor to start anonymous, then upgrade to customer.

**NOT in this scope** - requires:
- convertVisitor API enhancements
- Merge logic for duplicate customers
- Phone number collection flow in widget

---

## 8. Success Metrics

### Validation Metrics
- ✅ Zero workspaces with `enableWidget: true` + `sellsProductsAndServices: true` in production
- ✅ API validation catches 100% of invalid configurations
- ✅ Test coverage >80% for all modified files

### User Experience Metrics
- ✅ Zero confusion in user feedback (no support tickets about "widget not working for e-commerce")
- ✅ Wizard completion rate unchanged (validation doesn't block legitimate use cases)
- ✅ Settings page tooltip interaction: <5% users try to enable disabled widget toggle

### Code Quality Metrics
- ✅ No regression bugs in existing functionality
- ✅ Documentation updated (100% coverage of changed features)
- ✅ All tests passing in CI/CD pipeline

---

## 9. References

### Constitution Principles
- **Principle I**: Database-First Architecture (all config from DB, no hardcoded defaults)
- **Principle V**: 360-Degree Thinking (FE → API → Service → Repository → Database)
- **Principle VII**: Repository Cleanliness (remove obsolete `channelType` enum)
- **Principle XIII**: Never Touch Working Code (careful migration of existing workspaces)
- **Principle XV**: English-Only UI (all error messages in English)

### Related Documentation
- `docs/architecture/api-changelog-wizard.md`: Channel type documentation
- `docs/architecture/registration-flow.md`: Customer identification flow
- `apps/backend/src/application/services/customer.service.ts`: Customer/visitor logic
- `apps/frontend/src/components/chat/adapters/widgetAdapter.ts`: VisitorId expiry logic

---

**Document Version**: 1.0  
**Author**: GitHub Copilot (Andrea's requirements)  
**Date**: 2026-02-03  
**Status**: DRAFT - Awaiting Andrea's approval
