# Template System Architecture

## Overview

The eChatbot uses a **template-based prompt system** that loads different prompts based on the workspace type:

- **E-commerce workspaces**: Full sales functionality (products, cart, orders)
- **Informational workspaces**: Information-only channels (no sales)

## Directory Structure

```
apps/backend/src/templates/
├── shared/                      # Used by ALL workspace types
│   ├── 06-security.template.md     # Security validation
│   ├── 07-translation.template.md  # Format & translate
│   └── 08-summary.template.md      # Conversation summary
│
├── ecommerce/                   # E-commerce workspaces only
│   ├── 01-router.template.md       # Full routing with sales
│   ├── 02-product-search.template.md
│   ├── 03-order-tracking.template.md
│   ├── 04-customer-support.template.md
│   └── 05-profile-management.template.md
│
├── informational/               # Info-only workspaces
│   ├── 01-router.template.md       # Simplified routing (no sales)
│   ├── 04-customer-support.template.md
│   └── 05-profile-management.template.md
│
└── *.template.md               # Legacy fallbacks (root level)
```

## Workspace Types

### E-commerce (hasEcommerce = true)

Full functionality for businesses that sell products/services:

| Agent | Description |
|-------|-------------|
| Router | Routes to all agents including sales |
| Product Search | Search catalog, show details, prices |
| Cart Management | Add/remove items, view cart |
| Order Tracking | Order history, tracking, checkout |
| Customer Support | Complaints, escalation |
| Profile Management | Profile updates, notifications |
| Security | Message validation |
| Translation | Format for WhatsApp, translate |
| Summary | Summarize for operator emails |

### Informational (hasEcommerce = false)

Limited functionality for info-only channels:

| Agent | Description |
|-------|-------------|
| Router | Routes to support/profile only |
| Customer Support | Questions, feedback, escalation |
| Profile Management | Profile updates, notifications |
| Security | Message validation |
| Translation | Format for WhatsApp, translate |
| Summary | Summarize for operator emails |

**NOT available**: Product Search, Cart Management, Order Tracking

## How It Works

### 1. Template Loading (TemplateLoaderService)

```typescript
// Load template based on workspace type
const template = await templateLoader.load("ROUTER", hasEcommerce)

// For e-commerce: loads from ecommerce/01-router.template.md
// For info-only: loads from informational/01-router.template.md
// For shared agents: always loads from shared/
```

### 2. Variable Resolution (VariableResolverService)

Variables are resolved from the database:
- Workspace config (name, language, settings)
- Customer context (name, email, discount)
- Dynamic data (products, FAQs, orders)

### 3. Template Processing (TemplateEngineService)

Handlebars-like syntax:
- `{{variableName}}` - Simple replacement
- `{{#if condition}}...{{/if}}` - Conditional blocks
- `{{#unless condition}}...{{/unless}}` - Inverse conditionals
- `{{else}}` - Alternative content

## Template Variables

### Workspace Variables

| Variable | Type | Description |
|----------|------|-------------|
| `{{workspaceName}}` | string | Company name |
| `{{hasEcommerce}}` | boolean | Sells products/services |
| `{{hasRole}}` | string | Bot identity response |
| `{{hasAddress}}` | string | Physical address |
| `{{hasHumanSupport}}` | boolean | Human escalation available |
| `{{customAiRules}}` | string | Custom instructions |

### Customer Variables

| Variable | Type | Description |
|----------|------|-------------|
| `{{customerName}}` | string | Customer name |
| `{{customerEmail}}` | string | Customer email |
| `{{languageUser}}` | string | Preferred language |
| `{{customerDiscount}}` | number | Discount percentage |

### Dynamic Data (E-commerce only)

| Variable | Type | Description |
|----------|------|-------------|
| `{{products}}` | markdown | Product catalog (~50k tokens) |
| `{{services}}` | markdown | Services list |
| `{{categories}}` | markdown | Category list |
| `{{offers}}` | markdown | Active promotions |
| `{{faq}}` | markdown | FAQ content |
| `{{lastOrder}}` | markdown | Last order details |

## Creating New Templates

### For E-commerce Workspace

1. Create template in `ecommerce/` folder
2. Use full variable set including products, cart, orders
3. Include sales-related routing logic

### For Informational Workspace

1. Create template in `informational/` folder
2. Use limited variable set (no products, cart, orders)
3. Explicitly state "no sales functionality"
4. Handle purchase attempts gracefully

### For Shared Functionality

1. Create template in `shared/` folder
2. Ensure it works for both workspace types
3. Use conditional blocks if behavior differs

## Seed Script Usage

The seed script uses `dynamicAgents()` function:

```typescript
import { dynamicAgents } from "./data/dynamicAgents"

// For e-commerce workspace
const ecomAgents = dynamicAgents(workspaceId, true)

// For informational workspace  
const infoAgents = dynamicAgents(workspaceId, false)
```

## Best Practices

1. **Variable Uniqueness**: Each large variable (`{{products}}`, `{{offers}}`, etc.) can appear **at most ONCE** per prompt
2. **No Hardcoded Data**: All content comes from database
3. **Graceful Degradation**: Handle missing data gracefully
4. **Clear Boundaries**: E-commerce templates should NOT be used for info-only workspaces
5. **Test Both Types**: Always test changes for both workspace types
