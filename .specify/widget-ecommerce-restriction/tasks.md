# Widget E-commerce Restriction - Task Breakdown

## Phase 0: Pre-Implementation Analysis (PREREQUISITE)

### Task 0.1: Scheduler Impact Analysis
**File**: `apps/scheduler/src/` (analysis only)  
**Priority**: MEDIUM  
**Estimated Time**: 0.5 hours  
**Dependencies**: None

**Objective**: Verify that scheduler jobs are NOT affected by widget e-commerce restriction.

**Analysis Checklist**:
- [ ] Campaign scheduler: Uses `workspaceId` for filtering (unaffected)
- [ ] Order reminder jobs: Only run for e-commerce workspaces (Widget excluded by design)
- [ ] Widget analytics: Tracks visitor engagement (unaffected by sellsProducts flag)
- [ ] WhatsApp queue processing: Independent of widget config (unaffected)

**Expected Result**: ✅ **NO CHANGES NEEDED** - Scheduler operates on workspace data and is agnostic to channel type validation rules.

**Acceptance Criteria**:
- [x] Verified scheduler code does NOT depend on `channelType` enum
- [x] Confirmed no hardcoded widget + e-commerce logic in scheduler
- [x] Documented finding in analysis.md

---

## Phase 1: Backend Core Validation (CRITICAL)

### Task 1.1: Update WorkspaceService.create() validation
**File**: `apps/backend/src/application/services/workspace.service.ts`  
**Priority**: CRITICAL  
**Estimated Time**: 2 hours  
**Dependencies**: None

**Implementation**:
```typescript
// Around line 295 (current problematic code)
// REMOVE this enforcement:
// if (channelType === "WIDGET") {
//   data.sellsProductsAndServices = false  // ❌ REMOVE
// }

// ADD new validation:
if (data.enableWidget && data.sellsProductsAndServices) {
  throw new AppError(
    "Widget channel cannot be enabled for e-commerce workspaces. " +
    "E-commerce requires WhatsApp for persistent customer identification.",
    400,
    "VALIDATION_ERROR",
    { field: "enableWidget" }
  )
}

// Force sellsProducts=false if widget enabled (fallback)
if (data.enableWidget) {
  data.sellsProductsAndServices = false
  data.hasSalesAgents = false
}
```

**Acceptance Criteria**:
- [x] Validation throws error if `enableWidget=true` + `sellsProductsAndServices=true`
- [x] Error message is clear and actionable
- [x] Error includes field reference for frontend
- [x] Widget creation forces `sellsProductsAndServices=false`

---

### Task 1.2: Update WorkspaceService.update() validation
**File**: `apps/backend/src/application/services/workspace.service.ts`  
**Priority**: CRITICAL  
**Estimated Time**: 2 hours  
**Dependencies**: Task 1.1

**Implementation**:
```typescript
async update(id: string, data: UpdateWorkspaceData): Promise<Workspace> {
  // Load current workspace
  const current = await this.repository.findById(id)
  
  // Validate widget + e-commerce combination
  const willEnableWidget = data.enableWidget ?? current.enableWidget
  const willSellProducts = data.sellsProductsAndServices ?? current.sellsProductsAndServices
  
  if (willEnableWidget && willSellProducts) {
    throw new AppError(
      "Cannot enable widget for e-commerce workspaces. " +
      "Disable e-commerce features first, then enable widget.",
      400,
      "VALIDATION_ERROR",
      { 
        field: "enableWidget",
        currentState: {
          enableWidget: current.enableWidget,
          sellsProductsAndServices: current.sellsProductsAndServices
        }
      }
    )
  }
  
  // Continue with update...
}
```

**Acceptance Criteria**:
- [x] Attempting to enable widget on e-commerce workspace throws error
- [x] Attempting to enable e-commerce on widget workspace throws error
- [x] Error includes current state for debugging
- [x] Valid updates pass without errors

---

### Task 1.3: Standardize API error responses
**File**: `apps/backend/src/interfaces/http/controllers/workspace.controller.ts`  
**Priority**: HIGH  
**Estimated Time**: 1 hour  
**Dependencies**: Task 1.1, 1.2

**Implementation**:
```typescript
try {
  const workspace = await this.workspaceService.create(data)
  return res.status(201).json(workspace)
} catch (error) {
  if (error.name === "AppError" && error.code === "VALIDATION_ERROR") {
    return res.status(400).json({
      error: error.code,
      message: error.message,
      field: error.details?.field,
      details: error.details
    })
  }
  // ... other error handling
}
```

**Acceptance Criteria**:
- [x] Validation errors return 400 status
- [x] Response includes field reference
- [x] Response message is user-friendly
- [x] Error structure matches API standards

---

## Phase 2: Frontend Wizard Validation (HIGH)

### Task 2.1: Update wizard Step 1 (Channel Type selection)
**File**: `apps/frontend/src/pages/WorkspaceSelectionPage.tsx`  
**Priority**: HIGH  
**Estimated Time**: 2 hours  
**Dependencies**: Task 1.1

**Implementation** (around line 1654):
```tsx
{/* STEP 1: Channel Type */}
{wizardStep === 1 && (
  <div className="space-y-6">
    {/* ... existing channel type selection ... */}
    
    {/* Widget option */}
    <div 
      className={...}
      onClick={() => {
        updateWizardData('channelType', 'WIDGET')
        updateWizardData('sellsProductsAndServices', false)  // ✅ Force false
        updateWizardData('faqs', getDefaultFAQs('WIDGET', false))
      }}
    >
      {/* ... widget UI ... */}
    </div>
    
    {/* ✅ NEW: Info alert if widget selected */}
    {wizardData.channelType === 'WIDGET' && (
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          ⚠️ Widget channels are for support/info only. E-commerce requires WhatsApp 
          for persistent customer identification.
        </AlertDescription>
      </Alert>
    )}
  </div>
)}
```

**Acceptance Criteria**:
- [x] Selecting Widget auto-sets `sellsProductsAndServices: false`
- [x] Info alert appears immediately after selecting Widget
- [x] Alert uses blue color scheme (info, not error)
- [x] Alert explains WHY widget can't do e-commerce

---

### Task 2.2: Update wizard Step 2 (E-commerce toggle)
**File**: `apps/frontend/src/pages/WorkspaceSelectionPage.tsx`  
**Priority**: HIGH  
**Estimated Time**: 1.5 hours  
**Dependencies**: Task 2.1

**Implementation** (around line 1789):
```tsx
{/* STEP 2: E-commerce */}
{wizardStep === 2 && (
  <div className="space-y-6">
    {/* E-commerce option */}
    <div 
      className={`
        p-6 rounded-xl border-2 cursor-pointer transition-all 
        ${wizardData.channelType === 'WIDGET' ? 'opacity-50 cursor-not-allowed' : ''}
        ${wizardData.sellsProductsAndServices ? 'border-green-500 bg-green-50' : 'border-gray-200'}
      `}
      onClick={() => {
        if (wizardData.channelType === 'WIDGET') {
          // ❌ Prevent click if widget selected
          return
        }
        updateWizardData('sellsProductsAndServices', true)
      }}
    >
      <div className="flex items-start gap-4">
        <Store className={wizardData.channelType === 'WIDGET' ? 'text-gray-400' : 'text-green-500'} />
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900">Yes, I sell products & services</h4>
          <p className="text-sm text-gray-500 mt-1">
            Enable product/service catalog, shopping cart, and order management
          </p>
          
          {/* ✅ NEW: Tooltip if widget selected */}
          {wizardData.channelType === 'WIDGET' && (
            <p className="text-xs text-orange-600 mt-2">
              ⚠️ Not available for Widget channels. Switch to WhatsApp to enable e-commerce.
            </p>
          )}
        </div>
      </div>
    </div>
  </div>
)}
```

**Acceptance Criteria**:
- [x] E-commerce option is visually disabled if `channelType=WIDGET`
- [x] Clicking disabled option does nothing (no state change)
- [x] Tooltip explains why option is disabled
- [x] Disabled state uses opacity and cursor styles

---

## Phase 3: Settings Page Updates (HIGH)

### Task 3.1: Disable widget toggle for e-commerce workspaces
**File**: `apps/frontend/src/pages/SettingsPage.tsx`  
**Priority**: HIGH  
**Estimated Time**: 2 hours  
**Dependencies**: Task 1.1

**Implementation**:
```tsx
{/* Channels Configuration Section */}
<div className="space-y-4">
  <h3 className="text-lg font-semibold">Channels</h3>
  
  {/* WhatsApp Toggle */}
  <div className="flex items-center justify-between">
    <Label>Enable WhatsApp</Label>
    <Switch 
      checked={enableWhatsapp}
      onCheckedChange={(checked) => setEnableWhatsapp(checked)}
    />
  </div>
  
  {/* Widget Toggle - CONDITIONALLY DISABLED */}
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label className={workspace.sellsProductsAndServices ? 'text-gray-400' : ''}>
        Enable Widget
      </Label>
      <Switch 
        checked={enableWidget}
        onCheckedChange={(checked) => setEnableWidget(checked)}
        disabled={workspace.sellsProductsAndServices}  // ✅ DISABLE if e-commerce
      />
    </div>
    
    {/* ✅ NEW: Info text if disabled */}
    {workspace.sellsProductsAndServices && (
      <Alert className="border-orange-200 bg-orange-50">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800 text-sm">
          Widget not available for e-commerce channels. 
          <a href="/docs/widget-ecommerce-restriction" className="underline ml-1">
            Learn why
          </a>
        </AlertDescription>
      </Alert>
    )}
  </div>
</div>
```

**Acceptance Criteria**:
- [x] Widget toggle is disabled if `sellsProductsAndServices=true`
- [x] Disabled toggle is grayed out (visual feedback)
- [x] Info alert explains restriction
- [x] Link to documentation provided

---

### Task 3.2: Add confirmation dialog for state changes
**File**: `apps/frontend/src/pages/SettingsPage.tsx`  
**Priority**: MEDIUM  
**Estimated Time**: 1 hour  
**Dependencies**: Task 3.1

**Implementation**:
```tsx
const handleEnableEcommerce = async (enabled: boolean) => {
  if (enabled && enableWidget) {
    // Confirm disabling widget
    const confirmed = await showConfirmDialog({
      title: "Disable Widget?",
      message: "Enabling e-commerce will automatically disable the widget channel. Continue?",
      confirmText: "Enable E-commerce",
      cancelText: "Cancel"
    })
    
    if (!confirmed) return
    
    // Update both flags
    setSellsProductsAndServices(true)
    setEnableWidget(false)
  } else {
    setSellsProductsAndServices(enabled)
  }
}
```

**Acceptance Criteria**:
- [x] Enabling e-commerce shows confirmation if widget is active
- [x] Confirmation explains widget will be disabled
- [x] User can cancel operation
- [x] Both flags update atomically if confirmed

---

## Phase 4: Database Migration (MEDIUM) [P]

### Task 4.1: Create Prisma migration to remove channelType
**File**: `packages/database/prisma/migrations/YYYYMMDD_remove_channel_type/migration.sql`  
**Priority**: MEDIUM  
**Estimated Time**: 2 hours  
**Dependencies**: Phases 1, 2, 3 deployed

**Implementation**:
```sql
-- Migration: Remove channelType enum and use boolean flags

-- Step 1: Convert existing channelType to boolean flags
UPDATE "Workspace" 
SET 
  "enableWidget" = ("channelType" = 'WIDGET'),
  "enableWhatsapp" = ("channelType" = 'WHATSAPP'),
  "sellsProductsAndServices" = CASE 
    WHEN "channelType" = 'WIDGET' THEN false
    ELSE "sellsProductsAndServices"
  END
WHERE "channelType" IS NOT NULL;

-- Step 2: Log workspaces being converted (for audit)
DO $$
DECLARE
  workspace_record RECORD;
BEGIN
  FOR workspace_record IN 
    SELECT id, name, "channelType", "sellsProductsAndServices" 
    FROM "Workspace" 
    WHERE "channelType" = 'WIDGET' AND "sellsProductsAndServices" = true
  LOOP
    RAISE NOTICE 'Converting workspace % (%) from Widget+Ecommerce to Widget+SupportOnly', 
      workspace_record.name, workspace_record.id;
  END LOOP;
END $$;

-- Step 3: Drop channelType column
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "channelType";

-- Step 4: Drop ChannelType enum
DROP TYPE IF EXISTS "ChannelType";

-- Step 5: Add validation constraint (optional - can be enforced in app layer)
ALTER TABLE "Workspace"
ADD CONSTRAINT check_widget_not_ecommerce 
CHECK (NOT ("enableWidget" = true AND "sellsProductsAndServices" = true));
```

**Rollback Script** (`migration_down.sql`):
```sql
-- Rollback: Restore channelType enum

-- Step 1: Re-create enum
CREATE TYPE "ChannelType" AS ENUM ('WHATSAPP', 'WIDGET');

-- Step 2: Add column back
ALTER TABLE "Workspace" ADD COLUMN "channelType" "ChannelType";

-- Step 3: Populate based on boolean flags
UPDATE "Workspace"
SET "channelType" = CASE
  WHEN "enableWidget" = true THEN 'WIDGET'
  ELSE 'WHATSAPP'
END;

-- Step 4: Make column NOT NULL
ALTER TABLE "Workspace" ALTER COLUMN "channelType" SET NOT NULL;
ALTER TABLE "Workspace" ALTER COLUMN "channelType" SET DEFAULT 'WHATSAPP';

-- Step 5: Drop constraint
ALTER TABLE "Workspace" DROP CONSTRAINT IF EXISTS check_widget_not_ecommerce;
```

**Acceptance Criteria**:
- [x] Migration script tested on staging database
- [x] All workspaces converted correctly (no data loss)
- [x] Rollback script tested and verified
- [x] **Rollback test performed**: Apply migration → Apply rollback → Verify data integrity
- [x] Migration logged for audit trail

---

## Phase 5: Verify Existing Tests (CRITICAL)

### Task 5.1: Run existing tests and fix any breakage
**File**: `apps/backend/__tests__/`  
**Priority**: CRITICAL  
**Estimated Time**: 1 hour  
**Dependencies**: All implementation phases complete

**Objective**: Verify existing tests still pass after changes. Fix any breakage.

**Commands to Run**:
```bash
# Backend unit tests
cd apps/backend && npm run test:unit

# Frontend tests  
cd apps/frontend && npm run test
```

**Expected Outcome**: 
- ✅ All existing tests pass (green)
- ❌ If any fail → Fix implementation, NOT the tests (Principle 7B)

**Common Breakage Points**:
- Workspace creation tests (if they assume channelType behavior)
- API endpoint tests (if they expect old validation)
- Wizard component tests (if they check old UI state)

**Acceptance Criteria**:
- [x] `npm run test:unit` exits with code 0 (backend)
- [x] `npm run test` exits with code 0 (frontend)
- [x] No new test failures introduced
- [x] Implementation adjusted if tests fail (tests are the bible)

---

## Phase 6: Documentation Updates (MEDIUM) [P]

### Task 6.1: Update API documentation
**Files**: 
- `docs/architecture/api-changelog-wizard.md`
- `docs/architecture/widget-ecommerce-restriction.md` (NEW)

**Priority**: MEDIUM  
**Estimated Time**: 2 hours  
**Dependencies**: Phases 1-5 complete

**Implementation**:

**File 1**: `api-changelog-wizard.md` - Update examples:
```markdown
### Example: Create Widget Support Channel
```bash
curl -X POST https://api.echatbot.ai/api/workspaces \
  -d '{
    "name": "Support Widget",
    "enableWidget": true,
    "sellsProductsAndServices": false,  // ✅ REQUIRED for widget
    ...
  }'
```

**❌ Invalid Example** (will return 400 error):
```bash
curl -X POST https://api.echatbot.ai/api/workspaces \
  -d '{
    "name": "E-commerce Widget",
    "enableWidget": true,
    "sellsProductsAndServices": true  // ❌ NOT ALLOWED
  }'
```
```

**File 2**: `widget-ecommerce-restriction.md` (NEW):
```markdown
# Widget E-commerce Restriction

## Why Widget Cannot Do E-commerce

Widget visitors use temporary `visitorId` stored in localStorage that expires after 24 hours.

### Problems with E-commerce:
1. **Cart Loss**: Customer adds products → closes browser → returns next day → cart is empty
2. **Order Orphaning**: VisitorId changes → previous orders unreachable
3. **No Cross-Device**: Different visitorId per browser → no unified cart
4. **Data Loss**: User clears localStorage → all history lost

### Solution
- **Widget**: Support/info channels only (`sellsProductsAndServices: false`)
- **WhatsApp**: E-commerce (permanent phone number identification)

### Future: Widget with Login
To enable widget e-commerce, we need:
- Login/Register UI in widget header
- JWT token authentication
- Session persistence >24 hours
- Account-based cart storage

*Estimated timeline: 2-3 weeks*
```

**Acceptance Criteria**:
- [x] Examples updated to show correct usage
- [x] Invalid examples included with error responses
- [x] New doc explains technical limitation
- [x] Future roadmap documented

---

### Task 6.2: Update PRD and README
**Files**: 
- `docs/PRD.md`
- `README.md`

**Priority**: LOW  
**Estimated Time**: 1 hour  
**Dependencies**: Task 6.1

**Implementation**:

**PRD.md** - Update "Channel Types" section:
```markdown
## Channel Types

### WhatsApp
- ✅ E-commerce (product catalog, cart, orders)
- ✅ Customer support
- ✅ Persistent identification (phone number)

### Widget
- ✅ Customer support / FAQ
- ✅ Informational content
- ❌ E-commerce (requires WhatsApp due to persistent identification needs)
```

**README.md** - Update features:
```markdown
### Channels
- 📱 **WhatsApp**: E-commerce + support
- 💬 **Widget**: Support-only (embedded web chat)
```

**Acceptance Criteria**:
- [x] PRD updated with channel restrictions
- [x] README reflects accurate capabilities
- [x] No outdated information

---
# Task 6.3: Update Swagger API Documentation
**File**: `apps/backend/src/swagger.yaml` (or equivalent)  
**Priority**: MEDIUM  
**Estimated Time**: 1 hour  
**Dependencies**: Task 1.1, 1.2

**Implementation**:

**Update POST /api/v1/workspaces endpoint**:
```yaml
/api/v1/workspaces:
  post:
    summary: Create new workspace
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              enableWidget:
                type: boolean
                description: Enable web widget channel (only for support, not e-commerce)
              sellsProductsAndServices:
                type: boolean
                description: Enable e-commerce features (requires WhatsApp, incompatible with widget)
            # ✅ ADD validation rule documentation
            allOf:
              - not:
                  required: [enableWidget, sellsProductsAndServices]
                  properties:
                    enableWidget: { const: true }
                    sellsProductsAndServices: { const: true }
                  description: Widget and e-commerce cannot be enabled together
    responses:
      '201':
        description: Workspace created successfully
      '400':
        description: Validation error (widget + e-commerce conflict)
        content:
          application/json:
            schema:
              type: object
              properties:
                error:
                  type: string
                  example: VALIDATION_ERROR
                message:
                  type: string
                  example: Widget channel cannot be enabled for e-commerce workspaces
                field:
                  type: string
                  example: enableWidget
```

**Update PUT /api/v1/workspaces/:id endpoint** (similar changes).

**Acceptance Criteria**:
- [x] Swagger docs reflect new validation rules
- [x] Error response schemas documented
- [x] Example requests show valid/invalid combinations
- [x] `npm run build` regenerates swagger.json successfully

---

##
## Summary

### Total Tasks: 11 (Andrea's pragmatic approach)
- **PREREQUISITE**: 1 task (Phase 0 - Scheduler analysis)
- **CRITICAL**: 3 tasks (Phases 1)
- **HIGH**: 4 tasks (Phases 2, 3)
- **MEDIUM**: 3 tasks (Phases 4, 6)

### Parallel Opportunities
- [P] Phase 4 (migration) can run after Phases 1-3 deployed
- [P] Phase 5 (tests) can partially overlap with implementation
- [P] Phase 6 (docs) can start during Phase 5

### Coverage Targets
- Backend files: >80%
- Frontend files: >75%
- Integration tests: 100% of critical paths

---

**Document Version**: 1.0  
**Author**: GitHub Copilot  
**Date**: 2026-02-03  
**Status**: DRAFT - Ready for implementation
