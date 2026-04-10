# Widget vs WhatsApp Profile Orchestration

## Goal
Define a strict channel policy so the LLM never gives inconsistent answers about registration/profile access.

## Channel Rules

`whatsapp`
- Profile management is allowed.
- Profile tools can be used (`profileManagementAgent`, `getProfileLink`, `handlePushNotifications`).
- Registration checks still apply where required.

`widget`
- Profile management is not available in chat (privacy boundary).
- Router must not expose profile tools.
- If profile intent is detected, response must explain privacy/channel limitation.
- Response must not say "you are not registered" as a fallback for this case.

## Implementation Points

1. `apps/backend/src/services/llm-router.service.ts`
- Filters out profile tools when `params.channel === "widget"`.
- Keeps a widget-specific profile fallback response (language-aware, no registration wording).
- Passes `channel` into Router LLM fallback tools path.

2. `apps/backend/src/services/function-executor.service.ts`
- Adds a hard guard for widget profile functions:
`profileManagementAgent`, `getProfileLink`, `handlePushNotifications`.
- Returns `WIDGET_PROFILE_UNAVAILABLE`.

3. `apps/backend/src/application/agents/CustomerSupportAgentLLM.ts`
- On widget channel, does not include profile functions in support-agent callable tools.

4. `apps/backend/src/templates/informational/01-info-agent.template.md`
- Adds explicit prompt rule for widget profile privacy behavior.

## Regression Tests

- `apps/backend/__tests__/unit/services/widget-profile-management-fallback.spec.ts`
- `apps/backend/__tests__/unit/function-executor-sells-products.spec.ts`
