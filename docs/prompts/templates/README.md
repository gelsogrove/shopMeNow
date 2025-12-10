# Agent Prompt Templates

## 📁 Template Structure

Templates are organized by workspace type:

```
docs/prompts/templates/
├── shared/                 # Used by ALL workspace types
│   ├── 06-security.template.md
│   ├── 07-translation.template.md
│   └── 08-summary.template.md
├── ecommerce/              # E-commerce workspaces (full sales)
│   ├── 01-router.template.md
│   ├── 02-product-search.template.md
│   ├── 03-order-tracking.template.md
│   ├── 04-customer-support.template.md
│   └── 05-profile-management.template.md
└── informational/          # Info-only workspaces (no sales)
    ├── 01-router.template.md
    ├── 04-customer-support.template.md
    └── 05-profile-management.template.md
```

The **runtime templates** used by the backend are in:
`apps/backend/src/templates/` (same structure)

---

## Workspace Types

### E-commerce (`sellsProductsAndServices = true`)

Full functionality for businesses that sell products/services:
- Product search and catalog browsing
- Shopping cart management
- Order tracking and checkout
- All support features

### Informational (`sellsProductsAndServices = false`)

Limited functionality for information-only channels:
- FAQ responses
- Customer support (questions, feedback)
- Profile management
- **NO** product search, cart, or orders

---

## Agent Overview

| # | Agent | E-commerce | Info-only | Description |
|---|-------|------------|-----------|-------------|
| 01 | Router | ✅ | ✅ | Routes requests to appropriate agents |
| 02 | Product Search | ✅ | ❌ | Searches products, shows details |
| 03 | Order Tracking | ✅ | ❌ | Tracks orders, handles checkout |
| 04 | Customer Support | ✅ | ✅ | Handles complaints, escalation |
| 05 | Profile Management | ✅ | ✅ | Manages profile, notifications |
| 06 | Security | ✅ | ✅ | Validates message safety |
| 07 | Translation | ✅ | ✅ | Formats and translates responses |
| 08 | Summary | ✅ | ✅ | Summarizes for operator emails |

---

## Template Variables

All variables use **lowercase** format:
- `{{products}}` - Product catalog
- `{{services}}` - Services list
- `{{categories}}` - Category list
- `{{offers}}` - Active promotions
- `{{faq}}` - FAQ content
- `{{lastOrder}}` - Last order details
- `{{url}}` - Workspace URL

### ⚠️ Variable Uniqueness Rule

Each large variable (`{{products}}`, `{{offers}}`, `{{services}}`, `{{categories}}`) can appear **at most ONCE** per prompt.

See: [PROMPT_VARIABLES.md](../../PROMPT_VARIABLES.md) for full variable reference.

---

## Architecture Documentation

- [TEMPLATE_SYSTEM.md](../../architecture/TEMPLATE_SYSTEM.md) - Full template system architecture
- [PROMPT_VARIABLES.md](../../PROMPT_VARIABLES.md) - All available variables
- [PRD.md](../../PRD.md) - Product Requirements Document
