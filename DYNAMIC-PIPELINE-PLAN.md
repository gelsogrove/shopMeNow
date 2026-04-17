# Dynamic Agent Pipeline - Architecture Plan

## Objective

Make the Agent Pipeline **fully dynamic**: workspace settings control which agents/calling-functions exist, the pipeline graph reflects those settings visually, and the runtime algorithm matches the graph exactly.

**Principle: Settings -> Graph -> Algorithm (all 3 always aligned)**

---

## PHASE 1: Database Schema Changes

### 1.1 New Workspace boolean flags

Add to `packages/database/prisma/schema.prisma` in the `Workspace` model, near the existing `hasHumanSupport` field:

```prisma
// Dynamic Agent Pipeline flags
hasProductCatalog    Boolean @default(true)  // Shows productSearchAgent in pipeline
hasCart               Boolean @default(true)  // Shows cartManagementAgent in pipeline
hasOrderTracking      Boolean @default(true)  // Shows orderTrackingAgent in pipeline
needRegistration      Boolean @default(true)  // Shows profileManagementAgent in pipeline
// hasHumanSupport already exists            // Shows customerSupportAgent in pipeline
```

**Default values by channelMode** (applied in seed + workspace creation):

| Flag               | ECOMMERCE | INFORMATIONAL | FLOW  |
|---------------------|-----------|---------------|-------|
| hasHumanSupport     | true      | true          | false |
| hasProductCatalog   | true      | false         | false |
| hasCart             | true      | false         | false |
| hasOrderTracking    | true      | false         | false |
| needRegistration    | true      | true          | false |

### 1.2 Migration

```bash
cd packages/database
npx prisma migrate dev --name add_dynamic_pipeline_flags
```

Then:
```bash
npm run prisma:generate
cd packages/database && npm run build
```

### 1.3 Seed Update

File: `packages/database/prisma/seed.ts`

Update workspace creation to set defaults based on channelMode:

```typescript
// For ECOMMERCE workspaces:
hasProductCatalog: true,
hasCart: true,
hasOrderTracking: true,
needRegistration: true,
hasHumanSupport: true,

// For INFORMATIONAL workspaces:
hasProductCatalog: false,
hasCart: false,
hasOrderTracking: false,
needRegistration: true,
hasHumanSupport: true,

// For FLOW workspaces:
hasProductCatalog: false,
hasCart: false,
hasOrderTracking: false,
needRegistration: false,
hasHumanSupport: false,
```

---

## PHASE 2: Backend - Conditional Agent Wiring

### 2.1 `agent-functions.ts` - getFunctionsForRouter()

File: `apps/backend/src/config/agent-functions.ts` (line ~560)

**BEFORE**: Filters only by `channelMode` (ECOMMERCE vs not) and `channel` (widget vs whatsapp).

**AFTER**: Accept full workspace object and filter by individual flags:

```typescript
export function getFunctionsForRouter(options?: {
  workspace?: {
    channelMode: ChannelMode
    hasHumanSupport: boolean
    hasProductCatalog: boolean
    hasCart: boolean
    hasOrderTracking: boolean
    needRegistration: boolean
  }
  channel?: string
}) {
  const ws = options?.workspace
  const channel = (options?.channel || "whatsapp").toLowerCase()

  const routerFunctions = AGENT_FUNCTIONS.filter((fn) => {
    // Product Search - controlled by hasProductCatalog
    if (fn.name === "productSearchAgent" && !ws?.hasProductCatalog) return false

    // Cart Management - controlled by hasCart
    if (fn.name === "cartManagementAgent" && !ws?.hasCart) return false

    // Order Tracking - controlled by hasOrderTracking
    if (fn.name === "orderTrackingAgent" && !ws?.hasOrderTracking) return false

    // Customer Support - controlled by hasHumanSupport
    if (fn.name === "customerSupportAgent" && !ws?.hasHumanSupport) return false

    // Profile Management - controlled by needRegistration
    if (fn.name === "profileManagementAgent" && !ws?.needRegistration) return false

    // Widget channel still excludes profile management
    if (channel === "widget" && fn.name === "profileManagementAgent") return false

    return (
      fn.name.endsWith("Agent") ||
      fn.name === "manageNotifications" ||
      fn.name === "RESET_ACTIVE_AGENT"
    )
  })

  return routerFunctions.map((fn) => ({
    type: "function" as const,
    function: { name: fn.name, description: fn.description, parameters: fn.parameters },
  }))
}
```

### 2.2 Update callers of getFunctionsForRouter

Search for all callers and pass the full workspace object instead of just channelMode:

- `apps/backend/src/services/llm-router.service.ts` - where Router LLM is built
- `apps/backend/src/application/chat-engine/chat-engine.service.ts` - if it calls getFunctionsForRouter
- `apps/backend/src/strategies/ecommerce-workspace.strategy.ts` - routing strategy
- `apps/backend/src/config/agent-functions.config.ts` - if it has similar filtering

**Key**: The workspace object is already loaded in each strategy's `route()` method, so passing it is straightforward.

### 2.3 CallingFunctions Controller - Filter by flags

File: `apps/backend/src/interfaces/http/controllers/calling-functions.controller.ts`

Already filters `customerSupportAgent` by `hasHumanSupport` (line 108). Extend:

```typescript
// Line ~101-110: list() method filtering
const workspace = await this.prisma.workspace.findUnique({
  where: { id: workspaceId },
  select: {
    enableCalendarBooking: true,
    hasHumanSupport: true,
    hasProductCatalog: true,
    hasCart: true,
    hasOrderTracking: true,
    needRegistration: true,
    channelMode: true,
  }
})

// Filter based on workspace flags
functions = functions.filter(f => {
  if (f.functionName === "customerSupportAgent" && !workspace?.hasHumanSupport) return false
  if (f.functionName === "productSearchAgent" && !workspace?.hasProductCatalog) return false
  if (f.functionName === "cartManagementAgent" && !workspace?.hasCart) return false
  if (f.functionName === "orderTrackingAgent" && !workspace?.hasOrderTracking) return false
  if (f.functionName === "profileManagementAgent" && !workspace?.needRegistration) return false
  return true
})
```

Same for `getSystemMissing()` method (~line 227-244).

### 2.4 Workspace API - Expose new fields

File: `apps/backend/src/interfaces/http/controllers/workspace.controller.ts`

Add the new fields to the workspace response (they're already in the DB model, Prisma will return them). Verify they are included in:
- `getWorkspace()` response
- `updateWorkspace()` accepted fields

File: `apps/backend/src/repositories/workspace.repository.ts`
- Add new fields to `update()` method's accepted data

### 2.5 Agent-functions.config.ts

File: `apps/backend/src/config/agent-functions.config.ts` (line ~619-660)

Update `getAgentFunctionsForWorkspace()` to accept and use the new flags, same pattern as 2.1.

---

## PHASE 3: Frontend - Business Config Toggles

### 3.1 BusinessConfigSection - Add toggles

File: `apps/frontend/src/components/settings/sections/BusinessConfigSection.tsx`

Add a new section "Agent Pipeline Features" with Switch toggles:

```tsx
// Add to interface
formData: {
  // ... existing fields ...
  hasHumanSupport: boolean
  hasProductCatalog: boolean
  hasCart: boolean
  hasOrderTracking: boolean
  needRegistration: boolean
}

// Add UI section after "Require Manual Approval":
<div className="space-y-4 pt-4 border-t">
  <Label className="text-base font-semibold">Agent Pipeline Features</Label>
  <p className="text-sm text-muted-foreground">
    Enable or disable agent capabilities. The pipeline graph and AI behavior update accordingly.
  </p>

  <div className="space-y-3">
    <SwitchField label="Product Catalog" field="hasProductCatalog"
      description="Enable product search agent" />
    <SwitchField label="Shopping Cart" field="hasCart"
      description="Enable cart management agent" />
    <SwitchField label="Order Tracking" field="hasOrderTracking"
      description="Enable order tracking agent" />
    <SwitchField label="Customer Registration" field="needRegistration"
      description="Enable profile management agent" />
    <SwitchField label="Human Support" field="hasHumanSupport"
      description="Enable customer support agent with human escalation" />
  </div>
</div>
```

### 3.2 SettingsPage - Pass new fields

File: `apps/frontend/src/pages/SettingsPage.tsx`

- Add new fields to `FormData` interface (~line 82)
- Add to initial state from workspace data
- Pass to `BusinessConfigSection`
- Include in `handleSave()` payload

### 3.3 WorkspaceApi - Include new fields

File: `apps/frontend/src/services/workspaceApi.ts`

Verify the workspace type includes the new boolean fields.

---

## PHASE 4: Frontend - Dynamic Pipeline Graph

### 4.1 AgentSettingsPage - Dynamic child nodes

File: `apps/frontend/src/pages/AgentSettingsPage.tsx`

**BEFORE** (line 451-453):
```typescript
const pipelineSubAgents = agents.filter(
  (a) => a.agentType !== 'ROUTER' && a.agentType !== 'SECURITY' && a.agentType !== 'TRANSLATION'
)
```

**AFTER**: Filter sub-agents based on workspace flags:
```typescript
const pipelineSubAgents = agents.filter((a) => {
  // Always exclude infrastructure agents
  if (['ROUTER', 'SECURITY', 'TRANSLATION', 'SUMMARY_AGENT', 'CONVERSATION_HISTORY'].includes(a.agentType || '')) {
    return false
  }

  // Filter by workspace feature flags
  if (a.agentType === 'PRODUCT_SEARCH' && !workspace?.hasProductCatalog) return false
  if (a.agentType === 'CART_MANAGEMENT' && !workspace?.hasCart) return false
  if (a.agentType === 'ORDER_TRACKING' && !workspace?.hasOrderTracking) return false
  if (a.agentType === 'CUSTOMER_SUPPORT' && !workspace?.hasHumanSupport) return false
  if (a.agentType === 'PROFILE_MANAGEMENT' && !workspace?.needRegistration) return false

  return true
})
```

This automatically:
- Shows/hides nodes in the graph based on settings
- Adjusts fan-out/fan-in SVG lines
- Works for all channelModes (ECOMMERCE shows all, INFORMATIONAL shows fewer, FLOW shows Sub-LLMs only)

### 4.2 Workspace hook/context - Expose flags

File: `apps/frontend/src/hooks/use-workspace.ts` or `apps/frontend/src/contexts/WorkspaceContext.tsx`

Verify the workspace object returned by `useWorkspace()` includes the new boolean fields. If the workspace is fetched from API, it should already include them once the backend exposes them.

---

## PHASE 5: Cleanup

### 5.1 FlowConfigSheet - Remove "Flow JSON" tab from Router

File: `apps/frontend/src/components/shared/FlowConfigSheet.tsx`

The Router (flowKey="router") already hides the Flow JSON tab (line 271: `{!isRouter && ...}`). This is already correct.

### 5.2 CallingFunctionsSection - Already done

- Badge "SYSTEM" removed (done in this session)
- Execution type badge (Agent/Calling Function/Webhook) shown (done in this session)

### 5.3 FlowConfigSheet Tools tab - Already done

- Badge shows execution type instead of "system" (done in this session)

---

## PHASE 6: SQL for Production (Heroku)

### 6.1 Add columns (run AFTER deploying the migration)

```sql
-- Check if columns already exist first
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS "hasProductCatalog" BOOLEAN DEFAULT true;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS "hasCart" BOOLEAN DEFAULT true;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS "hasOrderTracking" BOOLEAN DEFAULT true;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS "needRegistration" BOOLEAN DEFAULT true;
-- hasHumanSupport already exists
```

### 6.2 Set correct defaults for existing workspaces

```sql
-- INFORMATIONAL workspaces: disable ecommerce features
UPDATE workspaces
SET "hasProductCatalog" = false,
    "hasCart" = false,
    "hasOrderTracking" = false,
    "needRegistration" = true
WHERE "channelMode" = 'INFORMATIONAL';

-- FLOW workspaces: disable everything
UPDATE workspaces
SET "hasProductCatalog" = false,
    "hasCart" = false,
    "hasOrderTracking" = false,
    "needRegistration" = false,
    "hasHumanSupport" = false
WHERE "channelMode" = 'FLOW';

-- ECOMMERCE workspaces: keep all true (already default)
-- No action needed
```

### 6.3 Verify

```sql
SELECT id, name, "channelMode",
       "hasHumanSupport", "hasProductCatalog", "hasCart",
       "hasOrderTracking", "needRegistration"
FROM workspaces
ORDER BY "channelMode";
```

---

## Files to Modify (Complete List)

### Database (Phase 1)
1. `packages/database/prisma/schema.prisma` - Add 4 new fields to Workspace
2. `packages/database/prisma/migrations/YYYYMMDD_add_dynamic_pipeline_flags/` - Migration
3. `packages/database/prisma/seed.ts` - Set defaults per channelMode

### Backend (Phase 2)
4. `apps/backend/src/config/agent-functions.ts` - getFunctionsForRouter() accepts workspace flags
5. `apps/backend/src/config/agent-functions.config.ts` - getAgentFunctionsForWorkspace() same
6. `apps/backend/src/services/llm-router.service.ts` - Pass workspace to getFunctionsForRouter
7. `apps/backend/src/strategies/ecommerce-workspace.strategy.ts` - Pass workspace flags
8. `apps/backend/src/interfaces/http/controllers/calling-functions.controller.ts` - Filter by all flags
9. `apps/backend/src/interfaces/http/controllers/workspace.controller.ts` - Expose new fields
10. `apps/backend/src/repositories/workspace.repository.ts` - Accept new fields in update
11. `apps/backend/src/domain/entities/workspace.entity.ts` - Add new properties

### Frontend (Phase 3-4)
12. `apps/frontend/src/components/settings/sections/BusinessConfigSection.tsx` - Add toggles
13. `apps/frontend/src/pages/SettingsPage.tsx` - FormData + pass fields
14. `apps/frontend/src/pages/AgentSettingsPage.tsx` - Dynamic pipeline graph filtering
15. `apps/frontend/src/services/workspaceApi.ts` - Type update (if needed)

### Already Done (this session)
16. `apps/frontend/src/components/shared/FlowConfigSheet.tsx` - Badge type instead of "system"
17. `apps/frontend/src/components/settings/sections/CallingFunctionsSection.tsx` - Removed SYSTEM badge

---

## Testing

### Unit Tests to Update
- `apps/backend/__tests__/unit/services/ecommerce-variable-filtering.spec.ts` - New flags
- Any test that calls `getFunctionsForRouter()` - Pass workspace flags

### Manual Verification
1. Create/edit ECOMMERCE workspace -> all toggles ON -> graph shows all agents
2. Turn off "Shopping Cart" -> cartManagementAgent disappears from graph + Router doesn't have it
3. Create FLOW workspace -> all toggles OFF by default -> graph shows only Sub-LLMs
4. Turn on "Human Support" in FLOW -> customerSupportAgent appears in graph
5. Verify Custom Tools page reflects the same filtering
6. Send a WhatsApp message -> verify Router only has tools matching enabled flags

---

## Risk Assessment

- **LOW RISK**: Adding boolean columns with defaults is backward-compatible
- **MEDIUM RISK**: Changing `getFunctionsForRouter()` signature - must update all callers
- **LOW RISK**: Frontend changes are additive (new toggles, filtering)
- **IMPORTANT**: Existing workspaces must get correct defaults via SQL migration (Phase 6.2)
