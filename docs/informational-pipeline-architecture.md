# Informational Pipeline Architecture

## Overview

The informational workspace pipeline was unified to use the same orchestration layer as the ecommerce path: `UnifiedChatRouter → LLMRouterService`.

## Flow (Post-Rewire)

```
Customer Message
  → ChatEngine.routeMessage()
    → processMessageInternal()
      → !sellsProductsAndServices → handleInformationalMessage()
        → 4 deterministic intercepts (REQUEST_HUMAN, UPDATE_PROFILE, VIEW_PROFILE, CHANGE_LANGUAGE)
        → this.unifiedChatRouter.routeMessage({
            workspaceId, customerId, conversationId,
            message, customerName, customerLanguage,
            channel, messageId, registrationPromptLevel
          })
          → LLMRouterService (INFO_AGENT template)
            → ConversationManager loads 20min history
            → Functions from WorkspaceCallingFunction DB (filtered by settings)
            → Function calling loop (max 8 iterations)
            → Sub-agent delegation (customerSupportAgent → CustomerSupportAgentLLM)
            → Booking functions available (if enableCalendarBooking=true)
          ← response
        → linkReplacementService.replaceTokens()
        → saveMessages()
      ← ChatEngineOutput
    → appendRegistrationReminder()
    → applyTranslation() (SINGLE pass, skipped when customer language = workspace catalogBaseLanguage)
    → security check (widget only, SINGLE pass)
```

## Function Architecture: 2 Levels

### Level 1 — Router Functions (from DB: WorkspaceCallingFunction)

| Function | Type | Gating |
|---|---|---|
| `customerSupportAgent` | DELEGATE → CustomerSupportAgentLLM | Always |
| `profileManagementAgent` | DELEGATE → ProfileManagementAgentLLM | !widget |
| `changeLanguage` | INTERNAL | Always |
| `listAvailableSlots` | INTERNAL | enableCalendarBooking=true |
| `bookAppointment` | INTERNAL | enableCalendarBooking=true |
| `cancelAppointment` | INTERNAL | enableCalendarBooking=true |
| `rescheduleAppointment` | INTERNAL | enableCalendarBooking=true |
| `getCustomerAppointments` | INTERNAL | enableCalendarBooking=true |

### Level 2 — Sub-Agent Functions (hardcoded inside each agent)

| Sub-Agent | Internal Functions |
|---|---|
| CustomerSupportAgentLLM | `searchFAQ`, `getFAQByCategory`, `createSupportTicket`, `contactOperator` (if hasHumanSupport), `getProfileLink`, `handlePushNotifications` |

## Translation Skip Logic

```
shouldSkipTranslation = normalizeLanguageCode(customerLanguage) === normalizeLanguageCode(workspace.catalogBaseLanguage || "it")
```

| Customer Language | Workspace catalogBaseLanguage | Translation |
|---|---|---|
| IT | IT (default) | Skipped |
| ES | IT | IT → ES |
| EN | IT | IT → EN |
| IT | EN | EN → IT |
| EN | EN | Skipped |

## History Window

ConversationManager uses a 20-minute window to cover:
- Booking flows (2-5 min)
- FAQ follow-ups (5-10 min)
- Brief pauses (10-15 min)

## Key Decisions

- Reuse LLMRouterService: already has history, functions, loop, delegation, safety
- Keep 4 deterministic intercepts: fast-path avoiding unnecessary LLM calls
- catalogBaseLanguage for translation skip: dynamic per workspace (schema default "it")
- Extra LLM call for complex FAQs is acceptable (+1 for delegation, -1 from removing double-translation)
