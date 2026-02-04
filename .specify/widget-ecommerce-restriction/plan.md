# Widget E-commerce Restriction - Implementation Plan

## 1. Architecture Overview

### System Changes
This refactor touches **4 main layers** following the constitution's 360-degree thinking principle:

```
┌─────────────────────────────────────────────────────┐
│  FRONTEND (UI Validation)                           │
│  - WorkspaceSelectionPage.tsx (Wizard)              │
│  - SettingsPage.tsx (Channel config)                │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP
┌──────────────────▼──────────────────────────────────┐
│  BACKEND API (Request Validation)                   │
│  - POST /api/v1/workspaces                          │
│  - PUT /api/v1/workspaces/:id                       │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  SERVICE LAYER (Business Logic)                     │
│  - WorkspaceService.create()                        │
│  - WorkspaceService.update()                        │
│  - Validation: Widget → Force sellsProducts=false   │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  DATABASE (Schema Migration)                        │
│  - Remove channelType enum (optional)               │
│  - Add validation constraints                       │
│  - Migrate existing workspaces                      │
└─────────────────────────────────────────────────────┘
```

### Technology Stack
- **Backend**: Node.js/Express + TypeScript + Prisma ORM
- **Frontend**: React + TypeScript + shadcn/ui
- **Database**: PostgreSQL
- **Testing**: Jest (backend), Vitest (frontend)
- **Scheduler**: Node.js (no changes needed)

---

## 2. Data Model Changes

### Current Schema (Problematic)
```prisma
model Workspace {
  channelType              ChannelType  @default(WHATSAPP)  // ❌ Confusing
  enableWhatsapp           Boolean      @default(true)
  enableWidget             Boolean      @default(false)
  sellsProductsAndServices Boolean      @default(true)
}

enum ChannelType {
  WHATSAPP
  WIDGET
}
```

### Proposed Schema (Simplified)
```prisma
model Workspace {
  // ❌ REMOVE: channelType (causes confusion)
  
  // ✅ KEEP: Clear boolean flags
  enableWhatsapp           Boolean      @default(true)
  enableWidget             Boolean      @default(false)
  sellsProductsAndServices Boolean      @default(true)
  
  // ✅ NEW: Database-level constraint (optional)
  // Constraint: IF enableWidget=true THEN sellsProductsAndServices=false
}
```

### Migration Strategy
```sql
-- Step 1: Convert existing channelType to flags
UPDATE "Workspace" 
SET 
  "enableWidget" = ("channelType" = 'WIDGET'),
  "enableWhatsapp" = ("channelType" = 'WHATSAPP'),
  "sellsProductsAndServices" = CASE 
    WHEN "channelType" = 'WIDGET' THEN false
    ELSE "sellsProductsAndServices"
  END
WHERE "channelType" IS NOT NULL;

-- Step 2: Drop enum column
ALTER TABLE "Workspace" DROP COLUMN "channelType";

-- Step 3: Drop enum type
DROP TYPE IF EXISTS "ChannelType";

-- Step 4: Add check constraint (optional - enforced in application layer)
ALTER TABLE "Workspace"
ADD CONSTRAINT check_widget_not_ecommerce 
CHECK (NOT ("enableWidget" = true AND "sellsProductsAndServices" = true));
```

---

## 3. Implementation Phases

### Phase 1: Backend Core Validation (Priority: CRITICAL)
**Goal**: Prevent invalid configurations at service layer

**Tasks**:
1. Update `WorkspaceService.create()`:
   - Add validation: `if (enableWidget && sellsProductsAndServices) throw Error`
   - Force: `if (enableWidget) data.sellsProductsAndServices = false`
   
2. Update `WorkspaceService.update()`:
   - Validate transitions: e-commerce → widget (block)
   - Show clear error message
   
3. Update API error responses:
   - Return structured error with field reference
   - Include actionable message

**Deliverables**:
- [ ] `apps/backend/src/application/services/workspace.service.ts` updated
- [ ] `apps/backend/src/services/workspace.service.ts` updated
- [ ] Error messages standardized

**Dependencies**: None

---

### Phase 2: Frontend Wizard Validation (Priority: HIGH)
**Goal**: Prevent users from selecting invalid combinations in UI

**Tasks**:
1. Update workspace creation wizard:
   - Step 1 (Channel Type): Auto-disable e-commerce if Widget selected
   - Step 2 (E-commerce): Gray out widget if e-commerce enabled
   - Add info messages explaining restrictions

2. Add visual feedback:
   - Disabled toggle styling (opacity: 0.5)
   - Tooltips explaining why option is disabled
   - Alert component showing restriction rules

**Deliverables**:
- [ ] `apps/frontend/src/pages/WorkspaceSelectionPage.tsx` updated
- [ ] Info messages added with clear explanations
- [ ] Visual states (disabled, tooltips) implemented

**Dependencies**: Phase 1 (backend validation)

---

### Phase 3: Settings Page Updates (Priority: HIGH)
**Goal**: Prevent enabling widget for existing e-commerce workspaces

**Tasks**:
1. Update Settings → Channels section:
   - Disable "Enable Widget" toggle if `sellsProductsAndServices: true`
   - Show info text: "Widget not available for e-commerce channels"
   - Add link to documentation

2. Add confirmation dialog:
   - If disabling e-commerce → confirm widget will stay disabled
   - If enabling e-commerce → confirm widget will be auto-disabled

**Deliverables**:
- [ ] `apps/frontend/src/pages/SettingsPage.tsx` updated
- [ ] Confirmation dialogs implemented
- [ ] Info text and documentation link added

**Dependencies**: Phase 1 (backend validation)

---

### Phase 4: Database Migration (Priority: MEDIUM)
**Goal**: Clean up schema by removing `channelType` enum

**Tasks**:
1. Create Prisma migration:
   - Convert `channelType` → `enableWhatsapp`/`enableWidget` flags
   - Drop `channelType` column
   - Drop `ChannelType` enum

2. Test migration on staging:
   - Verify all workspaces converted correctly
   - Check no data loss
   - Test rollback script

3. Run migration on production:
   - Schedule maintenance window
   - Monitor for errors
   - Verify success

**Deliverables**:
- [ ] Migration script: `packages/database/prisma/migrations/YYYYMMDD_remove_channel_type/`
- [ ] Rollback script documented
- [ ] Production migration executed

**Dependencies**: Phase 1, 2, 3 (ensure application handles both schemas)

---

### Phase 5: Test Coverage (Priority: CRITICAL)
**Goal**: Achieve >80% coverage for all modified files

**Tasks**:

**Backend Unit Tests** (`apps/backend/__tests__/unit/`):
- [ ] `workspace.service.spec.ts`:
  - Test: Creating widget forces `sellsProductsAndServices: false`
  - Test: Updating e-commerce workspace → `enableWidget: true` throws error
  - Test: Error messages are clear and actionable

**Backend Integration Tests** (`apps/backend/__tests__/integration/`):
- [ ] `workspace-creation.integration.spec.ts`:
  - Test: POST `/workspaces` with invalid config → 400 error
  - Test: PUT `/workspaces/:id` enabling widget on e-commerce → 400 error
  - Test: Valid configurations pass without errors

**Frontend Component Tests** (`apps/frontend/__tests__/`):
- [ ] `WorkspaceSelectionPage.spec.tsx`:
  - Test: Selecting Widget disables e-commerce toggle
  - Test: Info message appears when widget selected
  - Test: Cannot create workspace with invalid combination
  
- [ ] `SettingsPage.spec.tsx`:
  - Test: E-commerce workspace shows disabled widget toggle
  - Test: Info text appears correctly
  - Test: Tooltip explains restriction

**Deliverables**:
- [ ] All test files created/updated
- [ ] Coverage report shows >80% for modified files
- [ ] All tests passing in CI/CD

**Dependencies**: Phase 1, 2, 3 (implementation complete)

---

### Phase 6: Documentation Updates (Priority: MEDIUM)
**Goal**: Update all documentation to reflect widget restriction

**Tasks**:
1. Update API documentation:
   - [ ] `docs/architecture/api-changelog-wizard.md`: Update examples
   - [ ] Add new doc: `docs/architecture/widget-ecommerce-restriction.md`

2. Update main documentation:
   - [ ] `docs/PRD.md`: Update channel types section
   - [ ] `README.md`: Update feature list (if applicable)

3. Update inline documentation:
   - [ ] Add JSDoc comments explaining validation logic
   - [ ] Update Swagger schema for affected endpoints

**Deliverables**:
- [ ] All documentation files updated
- [ ] New documentation explaining widget limitations
- [ ] Swagger/OpenAPI spec updated

**Dependencies**: Phase 1-5 (implementation complete)

---

## 4. File Inventory

### Backend Files to Modify
```
apps/backend/
├── src/
│   ├── application/services/
│   │   └── workspace.service.ts          [MODIFY - Add validation]
│   ├── services/
│   │   └── workspace.service.ts          [MODIFY - Add validation]
│   ├── interfaces/http/controllers/
│   │   └── workspace.controller.ts       [MODIFY - Error handling]
│   └── __tests__/
│       ├── unit/
│       │   └── workspace.service.spec.ts [MODIFY - Add tests]
│       └── integration/
│           └── workspace-creation.integration.spec.ts [CREATE]
```

### Frontend Files to Modify
```
apps/frontend/
├── src/
│   ├── pages/
│   │   ├── WorkspaceSelectionPage.tsx    [MODIFY - Wizard validation]
│   │   └── SettingsPage.tsx              [MODIFY - Channel settings]
│   └── __tests__/
│       ├── pages/
│       │   ├── WorkspaceSelectionPage.spec.tsx [CREATE]
│       │   └── SettingsPage.spec.tsx     [CREATE]
```

### Database Files
```
packages/database/
├── prisma/
│   ├── schema.prisma                     [MODIFY - Remove channelType]
│   └── migrations/
│       └── YYYYMMDD_remove_channel_type/ [CREATE]
```

### Documentation Files
```
docs/
├── architecture/
│   ├── api-changelog-wizard.md           [MODIFY - Update examples]
│   └── widget-ecommerce-restriction.md   [CREATE - New doc]
├── PRD.md                                [MODIFY - Update channels]
└── README.md                             [MODIFY - Update features]
```

---

## 5. Testing Strategy

### Unit Test Coverage Targets
| File | Current Coverage | Target Coverage | Critical Paths |
|------|-----------------|-----------------|----------------|
| `workspace.service.ts` (backend) | Unknown | >80% | Validation logic |
| `WorkspaceSelectionPage.tsx` | Unknown | >75% | Wizard state machine |
| `SettingsPage.tsx` | Unknown | >75% | Toggle disable logic |

### Integration Test Scenarios
1. **Create Workspace - Invalid Config**:
   ```bash
   POST /api/v1/workspaces
   {
     "name": "Test",
     "enableWidget": true,
     "sellsProductsAndServices": true  # ❌ Invalid
   }
   Expected: 400 Bad Request
   ```

2. **Update Workspace - Enable Widget on E-commerce**:
   ```bash
   PUT /api/v1/workspaces/:id
   { "enableWidget": true }
   
   WHERE workspace.sellsProductsAndServices = true
   Expected: 400 Bad Request
   ```

3. **Valid Configurations**:
   - Widget + Support-only → ✅ 200 OK
   - WhatsApp + E-commerce → ✅ 200 OK
   - WhatsApp + Widget + Support-only → ✅ 200 OK

### Manual Testing Checklist
- [ ] Create new workspace with Widget → e-commerce toggle disabled
- [ ] Create new workspace with E-commerce → widget option grayed out
- [ ] Open Settings for e-commerce workspace → widget toggle disabled
- [ ] Try API call with invalid config → receives clear error
- [ ] Database migration succeeds without data loss

---

## 6. Deployment Plan

### Pre-Deployment
1. **Staging Environment**:
   - Deploy backend changes
   - Run database migration
   - Test all scenarios manually
   - Verify test coverage reports

2. **Production Preparation**:
   - Schedule maintenance window (if needed for migration)
   - Prepare rollback scripts
   - Notify users of upcoming changes (if breaking)

### Deployment Steps
1. **Backend Deployment**:
   ```bash
   git push origin main
   heroku run --app echatbot-backend "npx prisma migrate deploy"
   heroku restart --app echatbot-backend
   ```

2. **Frontend Deployment**:
   ```bash
   # Auto-deploys via CI/CD after backend is stable
   ```

3. **Database Migration**:
   ```bash
   heroku run --app echatbot-backend "npx prisma migrate deploy"
   # Runs migration: remove_channel_type
   ```

### Post-Deployment
1. **Verification**:
   - Check production logs for errors
   - Test workspace creation flow
   - Verify no regression in existing workspaces

2. **Monitoring**:
   - Watch error rate in Sentry/logs
   - Monitor API response times
   - Check user feedback channels

---

## 7. Risk Assessment

### High Risk Areas
| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Database migration fails** | CRITICAL | Test on staging first, have rollback script ready |
| **Existing widgets break** | HIGH | Graceful degradation, show error message to users |
| **Wizard state bugs** | MEDIUM | Comprehensive unit tests, manual QA testing |

### Rollback Plan
If deployment fails:
1. Revert backend deployment: `heroku rollback --app echatbot-backend`
2. Rollback database migration: Run `migration_down.sql` script
3. Revert frontend deployment: `git revert <commit-hash> && git push`
4. Notify users of temporary unavailability

---

## 8. Success Criteria

### Phase Completion Gates
- [ ] Phase 1: Backend validation passes all unit tests
- [ ] Phase 2: Wizard UI validated by manual testing
- [ ] Phase 3: Settings page changes reviewed
- [ ] Phase 4: Database migration tested on staging
- [ ] Phase 5: Test coverage >80% achieved
- [ ] Phase 6: Documentation review complete

### Production Acceptance
- [ ] Zero workspaces with `enableWidget=true` + `sellsProductsAndServices=true`
- [ ] All existing workspaces functional after migration
- [ ] No increase in error rate post-deployment
- [ ] User feedback: No confusion about widget limitations

---

## 9. Timeline Estimate

| Phase | Duration | Dependencies | Owner |
|-------|----------|--------------|-------|
| Phase 1: Backend Core | 4 hours | None | Copilot |
| Phase 2: Wizard UI | 3 hours | Phase 1 | Copilot |
| Phase 3: Settings UI | 2 hours | Phase 1 | Copilot |
| Phase 4: DB Migration | 2 hours | Phases 1-3 | Copilot |
| Phase 5: Test Coverage | 6 hours | Phases 1-4 | Copilot |
| Phase 6: Documentation | 2 hours | Phases 1-5 | Copilot |
| **Total** | **~19 hours** | Sequential | |

**Parallel Work Opportunities**:
- Phases 2 and 3 can run in parallel (both depend only on Phase 1)
- Documentation can start during Phase 5

---

## 10. References

### Related Architecture Docs
- `.specify/memory/constitution.md`: Coding principles
- `docs/architecture/api-changelog-wizard.md`: Workspace creation flow
- `apps/frontend/src/components/chat/adapters/widgetAdapter.ts`: VisitorId logic

### External Dependencies
- Prisma migrations: https://www.prisma.io/docs/orm/prisma-migrate
- shadcn/ui components: https://ui.shadcn.com/docs

---

**Document Version**: 1.0  
**Author**: GitHub Copilot  
**Date**: 2026-02-03  
**Status**: DRAFT - Awaiting Andrea's approval
