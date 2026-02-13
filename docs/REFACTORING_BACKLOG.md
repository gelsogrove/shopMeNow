# Refactoring Backlog — Large File Splits

**Created**: 2025-02-13  
**Priority**: P3 — Progressive, non-blocking  
**Rule**: Files > 400 lines should be split into focused modules

## Priority Order (by size and change frequency)

| # | File | Lines | Suggested Split | Status |
|---|------|-------|-----------------|--------|
| 1 | `chat-engine.service.ts` | 6,134 | → message-preprocessor, state-machine, agent-delegation, response-assembler | 🔴 TODO |
| 2 | `llm-router.service.ts` | 4,090 | → agent-router, prompt-builder, response-parser, fallback-handler | 🔴 TODO |
| 3 | `user-admin.routes.ts` | 3,698 | → user-routes, admin-routes, workspace-admin-routes, subscription-admin-routes | 🔴 TODO |
| 4 | `message.repository.ts` | 3,156 | → message-read.repo, message-write.repo, message-search.repo, message-archive.repo | 🔴 TODO |
| 5 | `data-loader.service.ts` | 2,707 | → product-loader, category-loader, offer-loader, faq-loader | 🔴 TODO |
| 6 | `whatsapp-webhook.controller.ts` | 2,451 | → message-handler, status-handler, webhook-validator | 🔴 TODO |
| 7 | `subscription-billing.controller.ts` | 1,914 | → billing-controller, payment-controller, subscription-controller | 🔴 TODO |
| 8 | `llm-formatter.service.ts` | 1,850 | → format-products, format-orders, format-cart, format-services | 🔴 TODO |

## Split Guidelines

1. **Keep re-exports**: Original file re-exports from sub-modules for backward compatibility
2. **Preserve tests**: Move tests to match new file structure
3. **Single responsibility**: Each module = one clear concern
4. **No functional changes**: Refactoring ONLY — behavior must be identical
5. **Incremental**: One file at a time, run tests after each split

## Split Template

```
original-service.ts (6000 lines)
↓ Extract into:
├── original-service/
│   ├── index.ts              (re-exports everything)
│   ├── message-handler.ts    (500 lines)
│   ├── state-machine.ts      (400 lines)
│   ├── agent-router.ts       (300 lines)
│   └── types.ts              (shared interfaces)
```

## When to Split

- Before any major feature addition to that file
- When a file keeps causing merge conflicts 
- When Andrea explicitly requests it
- As part of sprint cleanup tasks
