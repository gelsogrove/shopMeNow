# Implementation Plan: E2E Language, Billing, Campaigns & Escalation

**Branch**: `main` | **Date**: 2026-02-13 | **Spec**: `.specify/e2e-language-billing-campaigns/spec.md`
**Input**: minrequirement.md + codebase analysis

## Summary

Orchestrate end-to-end fixes across Backend, Frontend, Scheduler, DB for language defaults, WIP translation, contactOperator translation, billing costs, and scheduler language fallbacks. Goal: all 9 minrequirement scenarios pass.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 18+
**Primary Dependencies**: Express, Prisma ORM, OpenRouter API, React 18
**Storage**: PostgreSQL via Prisma ORM
**Testing**: Jest (backend/scheduler), Vitest (frontend)
**Target Platform**: Heroku (production), Docker (local dev)
**Project Type**: Monorepo (apps/backend, apps/frontend, apps/scheduler, packages/database)
**Constraints**: Hot-reload (no server restarts), main branch only, tests = bible

## Constitution Check

**Principle I - Database-First**:

- [x] No hardcoded prompts — TranslationAgent uses agentConfig.systemPrompt from DB
- [x] WIP message comes from workspace.wipMessage (DB) — but currently NOT translated via LLM → FIXING
- [ ] contactOperator uses humanSupportInstructions from DB — but NOT translated via LLM → FIXING
- [x] Billing costs from PlatformConfig table (DB-first)

**Principle II - Workspace Isolation**:

- [x] All affected queries already filter by workspaceId
- [x] TranslationAgent receives workspaceId, loads workspace-specific config

**Principle III - Variable Replacement**:

- [x] Agent prompts use {{variable}} syntax, replaced at runtime
- [ ] contactOperator replaces {{nameUser}} but doesn't run through TranslationAgent → FIXING
- [x] Variable uniqueness: no duplicate large variables in prompts

**Principle IV - No Static Translations**:

- [ ] WIP message uses JSON object lookup (static!) → FIXING to use TranslationAgent (LLM)
- [ ] contactOperator returns raw English/Italian text → FIXING to translate via LLM
- [ ] Scheduler defaults to 'it' instead of 'en' → FIXING

**Principle VII - Code Cleanliness**:

- [x] No temp files will be created
- [ ] widget-chat.controller.ts is 749 lines — within limit but dense
- [ ] contactOperator.ts is 504 lines — slightly over 500 line limit, consider refactoring progressively

**Multi-Agent Architecture**:

- [x] TranslationAgent flow preserved (Router → Specialist → Translation → Security)
- [x] WIP translation will use same TranslationAgent.process() method

**Testing Standards**:

- [ ] Update tests asserting widget cost $0.005 → $0.05
- [ ] Update tests asserting default language 'it' → 'en'
- [ ] Add tests for WIP translation via TranslationAgent
- [ ] Add tests for contactOperator translated response

## Research Summary

### Decision 1: WIP Translation Approach
- **Decision**: Call TranslationAgent.process() for WIP messages
- **Rationale**: Consistent with all other customer-facing messages; WIP is customer-facing
- **Alternative rejected**: Extend JSON lookup with more languages — doesn't scale, violates Principle IV

### Decision 2: contactOperator Translation
- **Decision**: After variable replacement, pass message through TranslationAgent.process()
- **Rationale**: humanSupportInstructions is customer-facing; must be in customer's language
- **Alternative rejected**: Store pre-translated versions in DB — violates Principle IV (no static translations)

### Decision 3: Default Language
- **Decision**: Change all defaults from "it" to "en"
- **Rationale**: minrequirement.md spec says default = "en"; English is universal fallback
- **Files affected**: Prisma schema (customer.language, workspace.defaultLanguage, workspace.widgetLanguage), scheduler normalizeLanguage, translation service default

### Decision 4: Widget Cost
- **Decision**: $0.05 per widget message (currently $0.005)
- **Rationale**: Andrea confirmed $0.05 as correct spec value
- **Note**: billing-rates.security.spec.ts already asserts $0.05 — other tests have wrong mock data

## Project Structure

### Source Code (files to modify)

```text
packages/database/prisma/
└── schema.prisma                    # Default language changes

apps/backend/
├── prisma/data/
│   ├── platformConfig.ts            # Widget cost $0.05 ✅ DONE
│   └── pricingConfig.ts             # Widget cost $0.05 ✅ DONE
├── src/
│   ├── interfaces/http/controllers/
│   │   └── widget-chat.controller.ts  # WIP → TranslationAgent, fallback message
│   ├── domain/calling-functions/
│   │   └── contactOperator.ts         # Add TranslationAgent call
│   └── application/agents/
│       └── TranslationAgent.ts        # Reference (no changes needed)
└── __tests__/unit/
    ├── widget/
    │   ├── widget-billing.spec.ts       # Update cost mock
    │   └── widget-language-priority.spec.ts  # Update default assertions
    ├── services/
    │   ├── platform-config.service.spec.ts      # Update WIDGET_MESSAGE value
    │   ├── pricing-configuration.spec.ts        # Update widget cost assertion
    │   └── subscription-billing.service.spec.ts # Update cost mock
    └── widget-wip-translation.spec.ts   # NEW: WIP TranslationAgent test
    └── contactOperator-translation.spec.ts # NEW: Escalation translation test

apps/scheduler/
├── src/
│   ├── services/
│   │   └── translation.service.ts     # Default language 'IT' → handle null without defaulting to 'it'
│   └── jobs/
│       ├── push-campaigns.job.ts      # normalizeLanguage default 'it' → 'en'
│       └── whatsapp-channel-queue.job.ts  # Language fallback 'it' → 'en'
└── __tests__/
    └── translation.service.spec.ts    # Update null default assertion
```

## Complexity Tracking

| Change | Complexity | Risk |
|--------|-----------|------|
| Prisma schema defaults | LOW | Migration needed but no data change (existing records keep current values) |
| Widget cost seed data | LOW | Already done. Tests need updating |
| WIP → TranslationAgent | MEDIUM | Async LLM call in status endpoint; need error handling for API failure fallback |
| contactOperator translation | MEDIUM | Must import/instantiate TranslationAgent; handle when customer language unknown |
| Scheduler defaults | LOW | Simple string replacement |
| Test updates | LOW-MEDIUM | 5+ test files to update mock data |
