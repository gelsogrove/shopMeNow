# Calling Functions Architecture

> Last updated: 2026-04-14

## Overview

Calling Functions are the bridge between LLM agents and system capabilities. Each workspace has a registry of functions (`WorkspaceCallingFunction`) that agents can invoke during conversations. Functions can delegate to specialist agents, call external webhooks, or execute internal service methods.

## Schema

```prisma
model WorkspaceCallingFunction {
  id                   String   @id @default(uuid())
  workspaceId          String
  functionName         String
  description          String   // Tells the LLM WHEN to call this function
  parameters           Json     // OpenAI function calling format
  executionType        String   // DELEGATE_TO_AGENT | WEBHOOK | INTERNAL
  isActive             Boolean  @default(true)
  isSystemFunction     Boolean  @default(false)
  webhookUrl           String?  // Per-function webhook URL override
  responseInstructions String?  // Tells the LLM HOW to present the result
  credentialsMapping   Json?    // Key-value mapping for webhook auth headers
  attachedLlm          String?  // Agent type for DELEGATE_TO_AGENT (e.g. "PRODUCT_SEARCH")
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  workspace            Workspace @relation(...)
  @@unique([workspaceId, functionName])
}
```

## Execution Types

### DELEGATE_TO_AGENT
Routes to a specialist LLM agent identified by the `attachedLlm` field.

| Function Name | attachedLlm | Purpose |
|---|---|---|
| `productSearchAgent` | `PRODUCT_SEARCH` | Catalog search, product details |
| `cartManagementAgent` | `CART_MANAGEMENT` | Add/remove items, view cart |
| `orderTrackingAgent` | `ORDER_TRACKING` | Order status, history |
| `customerSupportAgent` | `CUSTOMER_SUPPORT` | Escalation, tickets, FAQ |
| `profileManagementAgent` | `PROFILE_MANAGEMENT` | User data updates |

### WEBHOOK
Calls an external URL with HMAC-SHA256 signature verification. Custom functions created by workspace admins.

### INTERNAL
Executes built-in service methods directly. No external calls.

| Function Name | Purpose |
|---|---|
| `changeLanguage` | Switch customer's preferred language |
| `manageNotifications` | Push notification preferences |
| `bookAppointment` | Calendar booking (if enabled) |
| `cancelAppointment` | Cancel booking |
| `rescheduleAppointment` | Reschedule booking |
| `listAvailableSlots` | Show available time slots |
| `getCustomerAppointments` | View customer's bookings |

## System Functions vs Custom Functions

| Aspect | System | Custom |
|---|---|---|
| `isSystemFunction` | `true` | `false` |
| Created by | `seedSystemFunctions()` at workspace creation | Admin via CRUD API |
| Deletable | Yes (hard delete), but restorable via `/reinstall` | Yes (hard delete, permanent) |
| `functionName` editable | No (immutable) | No (immutable — identity key) |
| Constants source | `apps/backend/src/constants/system-functions.ts` | N/A |

## Immutable Fields

These fields cannot be changed after creation (enforced by `IMMUTABLE_KEYS` in controller):

- `functionName` — identity key, part of composite unique constraint
- `isSystemFunction` — security boundary
- `workspaceId` — tenant isolation
- `id` — primary key
- `createdAt` — audit trail

## channelMode Gating

Functions are conditionally visible in the UI based on workspace configuration:

| Functions | Visible When |
|---|---|
| `productSearchAgent`, `cartManagementAgent`, `orderTrackingAgent` | `channelMode === 'ECOMMERCE'` |
| `bookAppointment`, `cancelAppointment`, etc. | `enableCalendarBooking === true` |
| `customerSupportAgent` | `hasHumanSupport === true` |
| All custom functions | Always visible |

## channelMode Immutability

**Since 2026-04, channelMode is IMMUTABLE after workspace creation.**

- Backend: `workspace.service.ts update()` throws `400 CHANNEL_MODE_IMMUTABLE` if `data.channelMode !== currentWorkspace.channelMode`
- Frontend: channelMode dropdown is `disabled={true}` with amber warning text
- Rationale: Changing mode requires syncing calling functions, resetting agent prompts, and handling many edge cases. Blocking is simpler and safer.
- User flow: Delete workspace → Create new workspace with desired channelMode

### What was removed
- `syncSystemCallingFunctions()` — enabled/disabled ecommerce functions on mode switch (deleted)
- `resetDefaultAgentPrompts()` — upserted agent configs for new mode (deleted)
- Frontend confirmation dialog — asked user to confirm mode change (deleted)

## CRUD API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/workspaces/:wid/functions` | List all functions (with gating filters) |
| `POST` | `/workspaces/:wid/functions` | Create custom function |
| `PATCH` | `/workspaces/:wid/functions/:name` | Update function (respects immutable keys) |
| `DELETE` | `/workspaces/:wid/functions/:name` | Hard delete |
| `POST` | `/workspaces/:wid/functions/:name/reinstall` | Restore deleted system function from constants |
| `GET` | `/workspaces/:wid/functions/system-missing` | List restorable system functions |
| `GET` | `/workspaces/:wid/functions/agent-types` | Valid agent types for current channelMode |
| `POST` | `/workspaces/:wid/functions/test-webhook` | Test webhook URL connectivity |

All endpoints protected by 3-layer middleware: `authMiddleware` → `sessionValidationMiddleware` → `validateWorkspaceOperation`.

## Agent Type Filtering

The `agent-types` endpoint returns valid agent types based on channelMode, excluding non-dispatchable agents:

**Non-dispatchable agents** (never valid as `attachedLlm`):
- `ROUTER` — orchestrator, not a target
- `SECURITY` — content validation, runs automatically
- `TRANSLATION` — language layer, runs automatically
- `SUMMARY_AGENT` — summarization, runs automatically
- `CONVERSATION_HISTORY` — context enrichment, runs automatically

## File Map

| File | Purpose |
|---|---|
| `apps/backend/src/constants/system-functions.ts` | System function definitions (source of truth) |
| `apps/backend/src/interfaces/http/controllers/calling-functions.controller.ts` | CRUD controller |
| `apps/backend/src/repositories/workspace-calling-function.repository.ts` | Data access layer |
| `apps/backend/src/interfaces/http/routes/calling-functions.routes.ts` | Route definitions |
| `apps/frontend/src/services/callingFunctionApi.ts` | Frontend API client |
| `apps/frontend/src/components/settings/sections/CallingFunctionsSection.tsx` | UI component |
| `apps/backend/__tests__/unit/controllers/calling-functions.controller.spec.ts` | 19 unit tests |
| `apps/backend/__tests__/unit/services/workspace-type-change.service.spec.ts` | 5 channelMode immutability tests |
