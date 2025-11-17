# Agent Responsibility Separation - Implementation Plan

## Goals

1. Strip Router to pure orchestration
2. Use existing agents (PROFILE_MANAGEMENT already in DB)
3. Context Interpretation Pattern - Router interprets short responses (SI/NO/numbers)
4. Zero database changes

## Architecture

### Router
- Pure orchestration + context interpretation
- Temperature 0.2
- Keeps {{FAQ}} variable
- Delegation functions only

### Profile Management Agent
- Handles profile/preferences
- Calling Functions: manageNotifications, getProfileLink


### 7 Agents Total

| Agent                       | AgentType            | Variables                            | Calling Functions                   |
| --------------------------- | -------------------- | ------------------------------------ | ----------------------------------- |
| Router                      | ROUTER               | {{FAQ}}                              | Delegation functions                |
| Product & Services Search   | PRODUCT_SEARCH       | {{PRODUCTS}}, {{CATEGORIES}}         | searchProducts, getCategoryDetails  |
| Cart Management             | CART_MANAGEMENT      | {{CART_ITEMS}}                       | addToCart, removeFromCart, viewCart |
| Order Tracking              | ORDER_TRACKING       | {{RECENT_ORDERS}}                    | getOrderStatus, getOrderTracking    |
| Customer Support            | CUSTOMER_SUPPORT     | -                                    | escalateToHuman                     |
| Profile Management          | PROFILE_MANAGEMENT   | {{pushNotificationsConsent}}         | manageNotifications, getProfileLink |
| Safety & Translation        | SAFETY_TRANSLATION   | -                                    | -                                   |

## Implementation Phases

### Phase 1: Constitution Update
- Add Principle XIV: Context Interpretation Pattern
- Version bump: v2.0.0 → v2.1.0

### Phase 2: Router Agent Refactoring
- Create `router-agent-CLEAN.md`
- Target: < 2.5k tokens
- Temperature: 0.2
- Keep {{FAQ}} variable
- Add context interpretation logic
- Delegation functions: productSearchAgent, cartManagementAgent, orderTrackingAgent, customerSupportAgent, profileManagementAgent

### Phase 3: Profile Management Agent
- Update prompt: `profile-management-agent.md`
- Add variables: {{pushNotificationsConsent}}, {{pushNotificationsConsentAt}}
- Calling Functions:
  - manageNotifications(action: "SUBSCRIBE" | "UNSUBSCRIBE")
  - getProfileLink()

### Phase 4: Variable Replacement
- Add {{pushNotificationsConsent}} to PromptProcessorService
- Add {{pushNotificationsConsentAt}} to PromptProcessorService
- Use existing DB fields: push_notifications_consent, push_notifications_consent_at

### Phase 5: Testing
- Unit tests: Router context interpretation
- Integration tests: Profile Management CF
- Security tests: Workspace isolation

## Database Changes

**ZERO** - Everything exists:
- push_notifications_consent (Customer model)
- push_notifications_consent_at (Customer model)
- All AgentTypes exist in enum
