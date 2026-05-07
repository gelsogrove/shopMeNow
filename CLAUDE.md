# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**eChatbot** is a WhatsApp-based e-commerce platform with multi-agent AI chatbot integration. The system enables businesses to manage products, orders, and customer interactions through WhatsApp using OpenRouter/GPT-4-mini with a multi-workspace, multi-tenant architecture.

**Stack**: Node.js/Express + React/TypeScript + PostgreSQL + Prisma ORM + OpenRouter API

---

## 🚨 CRITICAL RULES - ALWAYS FOLLOW (Andrea's Requirements)

### 0. Address User by Name

- **ALWAYS** call the user "Andrea" in discussions and messages
- Example: "Andrea, I've completed the task" or "Andrea, what do you think?"

### 0.1. **NEVER Use Worktree - ALWAYS Work on Main Branch** (🚨 CRITICAL)

- **REPOSITORY PATH**: `/Users/gelso/workspace/shopME` (MAIN REPOSITORY)
- **WORKTREE PATH**: `/Users/gelso/workspace/shopME.worktrees/copilot-worktree-*` (❌ FORBIDDEN)
- **RULE**: At the START of EVERY session, IMMEDIATELY run:
  ```bash
  cd /Users/gelso/workspace/shopME
  git checkout main
  ```
- **BEFORE ANY COMMIT/PUSH**: Verify location:
  ```bash
  pwd  # MUST return: /Users/gelso/workspace/shopME
  git branch --show-current  # MUST return: main
  ```
- **NEVER** work in worktree directory - it causes merge issues
- **NEVER** commit/push from worktree - always from main repository
- **If accidentally in worktree**: STOP, cd to main repository, redo work there
- This is a **SACRED RULE** - breaking it causes deployment problems

## Development Commands

### Starting Services

```bash
# Start all services (backend + frontend + scheduler + backoffice)
npm run dev:all

# Or individually:
npm run dev:backend      # Backend API on port 3001
npm run dev:frontend     # Frontend on port 3000
npm run dev:scheduler    # Scheduler cron jobs
npm run dev:backoffice   # Admin panel on port 3002
```

**IMPORTANT**: Servers have hot-reload enabled (ts-node-dev, vite). Never manually restart or open new terminals - just save files and wait 1-2 seconds for auto-restart.

### Database Operations

```bash
# Generate Prisma client (after schema changes)
npm run prisma:generate

# Create and run migration
npm run prisma:migrate
# Or in apps/backend: npx prisma migrate dev --name description_of_change

# Seed test data
npm run prisma:seed

# Open Prisma Studio (database GUI)
npm run prisma:studio

# Update agent prompts from docs/ markdown to database
npm run update:prompts
```

### Testing

```bash
# Backend unit tests (ONLY unit tests - no integration tests)
npm run test:unit

# Backend with coverage
npm run test:coverage

# Security tests
npm run test:security

# All tests (backend + frontend + scheduler + backoffice + database)
npm run test
```

**CRITICAL**: Tests are the specification - they define expected behavior. Code must follow tests, not the other way around. Never change test logic without explicit approval. See Copilot instructions for full test policy.

### Building

```bash
# Build all workspaces
npm run build

# Build individual apps
npm run build:backend
npm run build:frontend
npm run build:scheduler
npm run build:backoffice
```

### Production (PM2)

```bash
npm run prod:backend     # Start backend with PM2
npm run prod:scheduler   # Start scheduler with PM2
npm run prod:all         # Start both
```

## Running a Single Test

```bash
# Backend unit test (from root)
cd apps/backend
npm run test:unit -- path/to/test.spec.ts

# Or with pattern matching
npm run test:unit -- --testNamePattern="should handle specific case"
```

## Architecture Overview

### Monorepo Structure

```
shopME/
├── apps/
│   ├── backend/         # Express API (port 3001)
│   ├── frontend/        # React + Vite (port 3000)
│   ├── scheduler/       # Cron jobs microservice
│   └── backoffice/      # Admin panel (port 3002)
├── packages/
│   └── database/        # Prisma schema & migrations
├── docs/                # Documentation
└── shared/              # Shared utilities
```

### Backend Architecture (Clean Architecture/DDD)

```
apps/backend/src/
├── application/
│   ├── services/        # Business logic orchestration
│   └── agents/          # Multi-agent LLM system (12+ agents)
├── domain/              # Core entities, value objects
├── repositories/        # Data access layer (Prisma)
├── interfaces/http/
│   ├── controllers/     # Request/response handling (45+ endpoints)
│   ├── routes/          # Express route definitions
│   └── middlewares/     # Auth, workspace validation, rate limiting
├── services/            # External integrations (LLM, email, WebSocket)
└── utils/               # Helpers, formatters, logger
```

**Key Services**:
- `ChatEngineService` - Main orchestrator (1000+ lines) coordinates agent pipeline
- `UnifiedChatRouter` - Intent routing and fallback handling
- `LLMRouterService` - OpenAI/OpenRouter API integration
- `ConversationStateService` - Context tracking & session management
- `WorkspaceAccessService` - Multi-tenant security gatekeeper
- `SecureTokenService` - Time-limited access tokens for public URLs
- `PromptProcessorService` - Variable replacement in agent prompts

### Multi-Agent LLM System

**Agent Pipeline**:
```
Customer Message → Router Agent → Specialized Agent → Response Builder → Queue → WhatsApp
```

**12+ Agent Types** (in `application/agents/`):
1. **ROUTER** - Intent classification, FAQ matching, entry point
2. **PRODUCT_SEARCH** - Catalog queries with semantic search
3. **CART_MANAGEMENT** - Add/remove items, quantity adjustments
4. **ORDER_TRACKING** - View orders, shipment status
5. **CUSTOMER_SUPPORT** - Escalation, issue resolution (ecommerce) / **INFO_AGENT** for informational workspaces
6. **PROFILE_MANAGEMENT** - User data updates
7. **NOTIFICATIONS** - Push campaigns
8. **CONVERSATION_HISTORY** - Context enrichment
9. **SECURITY** - Content validation, jailbreak detection
10. **TRANSLATION** - Multi-language support (IT, ES, PT, EN)
11. **CUSTOM** - Workspace-configurable agents
12. **OPERATOR** - Manual human responses

**Configuration**: All agent prompts stored in `AgentConfig` table (never hardcoded). Use `npm run update:prompts` to sync from markdown files in `docs/prompts/`.

### Security Architecture

**3-Layer Middleware Stack** (all protected endpoints):
```typescript
router.post('/workspaces/:workspaceId/resource',
  authMiddleware,                    // JWT token validation
  sessionValidationMiddleware,       // x-session-id header check
  validateWorkspaceOperation,        // x-workspace-id + param validation
  controller.action
)
```

**Workspace Isolation**:
- Every database query MUST filter by `workspaceId`
- Pattern: `where: { workspaceId, ...otherFilters }`
- Critical for multi-tenant security

**Authentication**:
- JWT tokens with refresh cycle
- 2FA support (TOTP with recovery codes)
- OAuth (Google, Apple, Facebook)
- Rate limiting per customer/workspace

**Concurrency Control**:
- Customer-level locks prevent duplicate message processing
- Unique constraint on `ChatSession(customerId, status="active")` ensures 1 active session
- Webhook de-duplication via `WhatsappWebhookEvent` model

### Database Architecture

**PostgreSQL with 40+ Prisma Models** organized by domain:

**Core Entities**:
- `Workspace` - Tenant with multi-channel support (WhatsApp, Widget, Telegram)
- `User` - Platform users with roles (SUPER_ADMIN, ADMIN, MEMBER), billing at owner level
- `Customers` - Chat participants with registration status

**Chat & Messaging**:
- `ChatSession` - Conversation sessions (1 per customer)
- `Message` - Individual messages with WhatsApp status tracking
- `MessageArchive` - Messages >6 months auto-archived
- `ConversationMessage` - LLM context history (role, content, tokens)
- `WhatsAppQueue` - Outbound message delivery queue
- `AgentConversationLog` - Audit trail of each agent execution

**E-Commerce**:
- `Products`, `Categories`, `Services`, `Offers` - Catalog
- `Carts`, `Orders`, `OrderItems` - Shopping workflow
- `CreditNote` - Partial refunds

**Billing** (Feature 198 - Owner-based):
- `BillingTransaction` - Owner-based credit movement
- `MonthlyInvoice` - Subscription + usage charges
- `User.creditBalance` - Shared wallet across owner's workspaces
- `PayPalTransaction` - PayPal subscription tracking
- `PlanConfiguration` - Dynamic plan limits and pricing

**Key Indexing**: `(workspaceId)` everywhere for tenant isolation, `(workspaceId, deletedAt)` for soft-delete filtering

### Frontend Architecture

**React 18 + React Router v6 + TanStack Query + WebSocket**

```
apps/frontend/src/
├── pages/           # Route components (60+ pages)
├── components/      # Reusable UI components
│   ├── shared/      # Cross-feature components
│   ├── layout/      # Sidebar, Header, Footer
│   └── ui/          # shadcn/ui primitives
├── services/        # API clients (30+ SDK files)
├── hooks/           # Custom React hooks
├── contexts/        # React context providers (6 contexts)
└── utils/           # Client helpers
```

**State Management**:
- React Context for global state (ChatContext, WorkspaceContext, BillingContext)
- TanStack Query for server state
- Local Storage for session persistence

**Key Pages**: Auth, Dashboard, Chat (WebSocket), E-Commerce, Orders, Workspace Settings, Analytics, Support, Campaigns, Widget

### Scheduler Service

**Cron jobs** (apps/scheduler):
1. `whatsapp-channel-queue.job.ts` - Core delivery engine (6s cooldown between messages)
2. `monthly-billing.job.ts` - Closes invoices, applies charges, PayPal collections
3. `push-campaigns.job.ts` - Scheduled push notifications
4. `messages-archive.job.ts` - Moves messages >6 months to archive
5. `short-urls-cleanup.job.ts`, `soft-delete-cleanup.job.ts`, etc.

### Integration Points

**WhatsApp Providers**:
- `WhatsAppProviderFactory` - Abstraction for Meta/UltraMsg switching
- Webhooks: `/api/v1/whatsapp/webhook/:webhookId` (Meta), `/api/v1/whatsapp/ultramsg/:webhookId` (UltraMsg)
- Webhook security: HMAC SHA256 signature verification (Meta), instance ID validation (UltraMsg)

**Payment Processing**:
- PayPal OAuth connection flow
- Subscription plan setup
- Automatic monthly billing with retry logic
- Credit-based billing: €0.10/message, €1.00/push, €19-€99/month subscription

**External Services**: LLM APIs (OpenAI, OpenRouter), AWS S3 (storage), SMTP (email), optional Stripe/Twilio

### 1. Database-First Architecture

- **NEVER** use hardcoded fallbacks, default values, or mock data
- **ALL** configuration (prompts, agent configs, prices) comes from database
- If data is missing: return proper error, don't invent defaults
- Example: Agent prompts MUST come from `agentConfig` table, never from constants
- **NO STATIC PROMPTS**: everything must be dynamic from database
- **NO HARDCODED TRANSLATIONS**: Categories, offers, products SEMPRE in italiano (lingua base) dal database
  - Methods like `getActiveCategories()` and `getActiveOffers()` return Italian text from DB
  - Translation Layer (with LLM) handles final translation to customer's language
  - NEVER create translation mappings (it/es/pt/en) - let LLM translate dynamically

### 2. Workspace Isolation

- **EVERY** database query MUST filter by `workspaceId`
- Pattern: `where: { workspaceId, ...otherFilters }`
- This is critical for multi-tenant security

### 3. Server Auto-Restart

- Backend/frontend have **hot-reload enabled** via `ts-node-dev` and `vite`
- **NEVER** manually restart servers or open new terminals
- **Servers auto-restart on file changes** - just save and wait 1-2 seconds
- Watch for compilation errors in existing terminal output
- Only restart manually if process crashes or hangs

### 4. Environment Protection (🚨 CRITICAL - NEVER TOUCH .env)

- **ABSOLUTELY FORBIDDEN**: NEVER read, modify, delete, or interact with `.env` file
- **NEVER** run commands like `cat .env`, `vim .env`, `rm .env`, etc.
- **NEVER** suggest changes to `.env` file
- **NEVER** backup `.env` file (Andrea manages this manually)
- If configuration is needed: ASK Andrea, don't touch `.env`
- `.env` is SACRED - any interaction will break production
- Exception: ONLY if Andrea explicitly says "modify .env" with exact content

### 5. PDF File Protection

- **NEVER** delete, modify, or touch `backend/prisma/temp/international-transportation-law.pdf`
- This file is CRITICAL for system operation
- Never remove files from `backend/prisma/temp/` directory
- Never modify seed script to remove PDF file creation

### 6. Swagger Documentation

- Update `backend/src/swagger.yaml` immediately after API changes
- All endpoints must have JSDoc comments with `@swagger` tags
- Run `npm run build` to regenerate swagger.json
- **AFTER EVERY API CHANGE**: verify swagger is updated and working

### 7. Test Before "Done"

- Never say task is completed without verifying it works
- Run tests: `npm run test:unit` or `npm run test:coverage`
- Integration tests require backend running (`npm run dev`)
- If tests fail: verify backend (port 3001), database, seed

### 7A. Test Policy - Tests Are The Bible (🚨 SACRED)

- **TESTS ARE THE BIBLE - TESTS DEFINE TRUTH**
- **Tests define expected behavior. Code must follow tests, not the other way around.**
- **Unit tests are the specification - they document what the system MUST do**
- **Tests are MORE IMPORTANT than documentation** - if there's a conflict between tests and docs, ASK Andrea
- **DO NOT change test LOGIC without explicit approval from Andrea.**
- **Mocks CAN be updated** if they don't work (e.g., wrong mock data, missing mock), but the test assertions/logic CANNOT change
- If behavior must change, ask first, then update tests and docs together.
- If a test fails, fix the implementation first. Only change test logic if it's wrong and approved.
- When test logic is changed with approval, include the approval note in the PR description.
- **Before ANY implementation**: Check if tests exist. Tests come FIRST.
- **ALWAYS add comprehensive comments in tests explaining the WHAT and WHY**:
  - ✅ GOOD: `// SCENARIO: User selects Spanish in widget, but has Italian phone number`
  - ✅ GOOD: `// RULE: Explicit language WINS over phone prefix`
  - ❌ BAD: `it("should work", () => { ... })` - no context!
- **Test comments are documentation** - they explain business logic to future developers
- **Every test logic change = business logic change** - treat test modifications as critical as code changes
- **If implementation contradicts test**: Implementation is WRONG, not the test
- **CONFLICT RESOLUTION**: If documentation says X but test expects Y → ASK Andrea which is correct

### 7B. NO Integration Tests (🚨 ANDREA'S RULE)

- **NEVER** create or run integration tests (`test:integration`)
- **ONLY** unit tests are allowed (`test:unit`)
- Integration tests are too slow and flaky - Andrea does NOT want them
- **If code needs testing**: Write unit tests with proper mocks
- **DO NOT** create files in `__tests__/integration/` directory
- **DO NOT** suggest running `npm run test:integration`
- Exception: Only if Andrea explicitly requests integration test for specific case

### 8. WhatsApp Testing Policy

- **NEVER** test features directly via WhatsApp during development
- WhatsApp testing is a FUTURE feature - not available yet
- For now: ALL WhatsApp messages go to a queue system (not processed)
- When implementing features that mention "WhatsApp test" or "manual WhatsApp flow":
  - ✅ DO: Implement the backend logic, calling functions, and database operations
  - ✅ DO: Create unit tests and integration tests
  - ❌ DON'T: Attempt to send real WhatsApp messages
  - ❌ DON'T: Test via WhatsApp UI
  - 📝 NOTE: Mark as "WhatsApp integration pending" in test documentation
- Exception: Only test WhatsApp when Andrea explicitly asks for it

### 9. 360-Degree Thinking

- **ALWAYS** think full-stack when making changes: FE → API → Middleware → Controller → Service → Repository → Database
- **Before committing**, verify the complete change checklist:
  - ✅ **Frontend**: Component, API service, error handling, loading states
  - ✅ **Backend API**: Route, middleware stack (auth/session/workspace), controller, Swagger docs
  - ✅ **Service Layer**: Business logic, workspace isolation, error handling
  - ✅ **Repository**: Database queries with `workspaceId` filter
  - ✅ **Database**: Migration, seed update, Prisma generate
  - ✅ **Security**: 3-layer middleware (authMiddleware → sessionValidationMiddleware → validateWorkspaceOperation)
  - ✅ **Tests**: Unit tests, security tests (workspace isolation), integration tests
- **NEVER** partial implementations: Cannot merge FE without BE, or API without security
- **Database Trigger**: When touching schema → migration → seed → repository → entity → service → API → frontend → tests
- See `.specify/memory/constitution.md` Principle V for complete checklist

### 10. Chat Isolation & Concurrency Safety

- **ALWAYS** prevent race conditions when multiple customers write simultaneously
- **Critical Operations Requiring Protection**:
  - ✅ **Session Creation**: Use Prisma transactions with unique constraint `(customerId, status="active")`
  - ✅ **Cart Operations**: Transaction-based updates with optimistic locking
  - ✅ **LLM Processing**: In-memory async lock per `sessionId` — IMPLEMENTED in `apps/backend/custom-client-0/index.ts:withSessionLock`
- **Current Implementation** (custom-client-0):
  - `withSessionLock(sessionId, fn)` chains turns of the SAME session sequentially via promise queue
  - Different sessions still run in parallel (lock keyed by `sessionId`)
  - Failed turns do NOT poison the queue (errors are absorbed in the tracking promise but propagated to the caller)
  - Lock entry self-evicts when the chain settles (bounded memory)
  - Tested in `__tests__/unit/session-concurrency.test.ts`
- **Cache Bounds** (custom-client-0):
  - `sessionCache` capped at `MAX_CACHED_SESSIONS` (default 10000, override via `AGENT_SESSION_CACHE_MAX` env)
  - LRU eviction by `lastUsedAt` when over cap
  - Idle TTL eviction unchanged (default 30 min)
- **Database Schema**: Unique constraint `@@unique([customerId, status])` on ChatSession (enforced by Prisma)
- **Testing**: Concurrent request tests live in `__tests__/unit/session-concurrency.test.ts` (pure unit, no LLM)
- **NO global locks**: Only per-customer or per-session isolation
- See `.specify/memory/constitution.md` Principle VI for complete details

### 11. Variable Uniqueness Constraint

- **ALWAYS** ensure `{{products}}`, `{{offers}}`, `{{services}}`, `{{categories}}` appear at most ONCE per prompt
- **Critical Reason**: Each variable can inject 50k+ tokens → duplicate usage causes 100k+ token prompts → LLM API failure
- **Implementation Requirements**:
  - ✅ **Validation on Save**: Admin UI MUST validate prompts before saving to `agentConfig` table
  - ✅ **Runtime Detection**: `PromptProcessorService.replaceAllVariables()` SHOULD log warnings if duplicates detected
  - ✅ **Seed Validation**: `npm run validate-prompts` checks all default prompts comply
  - ❌ **NO duplicate usage**: Never use same large variable twice in one prompt template
- **Implementation Pattern**:

  ```typescript
  // Validation function in PromptProcessorService
  private validatePromptVariables(prompt: string): void {
    const largeVariables = ["products", "offers", "services", "categories"]

    for (const variable of largeVariables) {
      const regex = new RegExp(`\\{\\{${variable}\\}\\}`, "g")
      const matches = prompt.match(regex)

      if (matches && matches.length > 1) {
        throw new ValidationError(
          `Variable {{${variable}}} can only appear once per prompt. Found ${matches.length} occurrences.`
        )
      }
    }
  }

  // Call before replacement
  public async replaceAllVariables(promptContent: string, ...) {
    this.validatePromptVariables(promptContent) // Validate FIRST
    // ... continue with replacement
  }
  ```

- **Examples**:
  - ❌ **WRONG**: `"Prodotti: {{products}} ... Vedi anche: {{products}}"` → 100k+ tokens
  - ✅ **CORRECT**: `"Prodotti: {{products}}"` → ~50k tokens
  - ✅ **CORRECT**: `"Categorie: {{categories}}\nOfferte: {{offers}}\nProdotti: {{products}}"` → Multiple different variables OK
- See `.specify/memory/constitution.md` Principle III (Variable Uniqueness Constraint) for complete details

### 12. Repository Cleanliness - Keep Solution Clean (🚨 MANDATORY)

- **ALWAYS** maintain clean repository free of obsolete files, temporary scripts, and unused artifacts
- **PROACTIVE CLEANUP**: Regularly identify and remove files that no longer serve a purpose
- **Critical Requirements**:
  - ❌ **NO temporary scripts**: Never commit `test.js`, `temp.ts`, `backup-old.sql` files
  - ❌ **NO backup files**: Never commit `.backup`, `.old`, `.tmp`, `.bak` files (use git history)
  - ❌ **NO unused code**: Remove commented-out code, unused imports, dead functions
  - ❌ **NO code duplication**: Extract shared logic to utilities, services, or base classes
  - ❌ **NO obsolete dependencies**: Remove unused packages from package.json
  - ❌ **NO duplicate directories**: Remove redundant folder structures (e.g., duplicate .husky)
  - ❌ **NO unused media files**: Remove videos, images, PDFs not referenced in code
  - ✅ **Immediate cleanup**: Delete temporary files before commit
  - ✅ **File size limits**: Keep files under 500 lines (extract if larger)
  - ✅ **Periodic audits**: Regularly check for obsolete files and remove them
  - ✅ **Ask before cleaning**: If unsure whether file is needed, ASK Andrea
- **Pre-Commit Checklist**:
  - [ ] No temporary/backup files in `git status`
  - [ ] All imports are used (no IDE warnings)
  - [ ] No commented-out code (use git history instead)
  - [ ] No duplicate logic across files
  - [ ] All files under 500 lines (extract if larger)
  - [ ] No obsolete files accumulating in repository
- **Examples**:
  - ❌ **WRONG**: Unused imports, commented code, backup files, duplicate .husky directories, 31MB video.mp4 not used
  - ✅ **CORRECT**: Clean imports, no dead code, extracted utilities, single source of config, removed obsolete files
- **Enforcement**:
  - Pre-commit hook rejects `*.backup`, `*.old`, `*.tmp`, `temp.*`, `test-*.js`
  - ESLint catches unused imports/variables
  - Code reviews verify no duplication or dead code
  - Regular cleanup sessions to remove obsolete files
- **RATIONALE**: Clean repository = faster builds, smaller slugs, easier maintenance
- See `.specify/memory/constitution.md` Principle VII for complete details

### 13. NEVER Touch Working Code (🚨 CRITICAL)

- **RULE**: If a file/import/export pattern is working correctly, **NEVER** modify it without explicit user request
- **EXAMPLES OF VIOLATIONS**:
  - ❌ Changing `export function MyComponent()` to `export default function MyComponent()` when it works
  - ❌ Changing `import { Component }` to `import Component` when it works
  - ❌ Refactoring working code structure "for consistency" without being asked
  - ❌ Moving files or renaming exports that are already functioning
- **WHEN TO MODIFY**:
  - ✅ User explicitly asks to change export/import pattern
  - ✅ There's an actual runtime error that needs fixing
  - ✅ Code is broken and needs repair
- **ANDREA'S WORDS**: "ma cosa devo fare mi fai impazzire cosi" - when agent breaks working code
- **CONSEQUENCE**: Breaking working code wastes Andrea's time and creates frustration
- **VERIFICATION**: Before touching ANY export/import, ask: "Is this currently working? If YES → DON'T TOUCH IT!"

### 14. User Context Freedom - NO Hardcoded Phrase Detection (🚨 CRITICAL)

- **PRINCIPLE**: Users can switch conversation context at **ANY** moment
- **RULE**: Detect input TYPE, not content:
  - `NUMBER` input (e.g., "2") → Use previous context (list selection)
  - `TEXT` input (anything else) → Reset state to IDLE, clear optionsMapping
- **FORBIDDEN** (❌ VIOLATIONS):
  - ❌ `if (message.includes("ordine"))` - NO keyword detection
  - ❌ `if (/mostra.*prodotti/.test(message))` - NO phrase regex
  - ❌ `const keywords = ["ordine", "order"]` - NO keyword arrays
  - ❌ Any language-specific pattern matching for phrases
- **ALLOWED** (✅ ONLY these):
  - ✅ Numeric selection: `/^(\d+)$/` for "1", "2", "3"
  - ✅ Yes/No confirmation: `/^(s[iì]|no|ok|yes)$/i`
  - ✅ Quantity patterns: "sì 3", "2 pezzi"
- **WHY**:
  - Users switch context constantly ("mostra prodotti" → "mostrami l'ordine" → "come pago?")
  - Hardcoded patterns break with typos, synonyms, other languages
  - LLM (Intent Parser) handles ALL phrase-based intent detection
- **IMPLEMENTATION**: `chat-engine.service.ts` STEP 0.55 resets state for TEXT input
- **ANDREA'S WORDS**: "non devi harcodeare nulla nessun riconoscimento di frase"
- See `.specify/memory/constitution.md` Principle XV for complete details

### 15. English-Only UI (🚨 MANDATORY)

- **ALL UI text MUST be in English** - no Italian, Spanish, or other languages in the codebase
- **This includes**:
  - ✅ Button labels, form labels, placeholders
  - ✅ Toast messages (success, error, warning)
  - ✅ Dialog titles and descriptions
  - ✅ Validation error messages
  - ✅ Help text and tooltips
  - ✅ Code comments in components
- **FORBIDDEN** (❌ VIOLATIONS):
  - ❌ `toast.error("Salvataggio fallito")` → Must be `toast.error("Save failed")`
  - ❌ `<Label>Nome Canale</Label>` → Must be `<Label>Channel Name</Label>`
  - ❌ `placeholder="Inserisci..."` → Must be `placeholder="Enter..."`
  - ❌ Italian comments in UI components
- **RATIONALE**: The platform is international. User-facing data (products, categories) comes from database in the customer's language, but UI chrome must be English.
- **EXCEPTION**: LLM-generated responses to customers are dynamic and multilingual

### 16. NO Patches — Architecture Layers Are Sacred (🚨 IRON RULE)

- **PRINCIPLE**: when an LLM-driven feature behaves wrong, the fix is **deterministic code**, never another rule glued onto the system prompt
- **APPLIES TO**: `apps/backend/custom-ecolaundry/` (and any future custom chatbot in this repo). The architectural contract is documented in [`apps/backend/custom-ecolaundry/docs/architecture.md`](apps/backend/custom-ecolaundry/docs/architecture.md)
- **THE 8 IRON RULES** (full text in `docs/architecture.md`):
  1. **No patches in the prompt** — prompt rules are NOT a control surface. Fix it in code (guard, tool validator, post-processor invariant).
  2. **Tool refuses, LLM corrects** — tools validate args + semantics; rejection messages guide the LLM.
  3. **One file = one responsibility** — files >150 lines mixing concerns must be split (cassette structure: `tool-handlers/`, `guards/`, detectors, transitions).
  4. **State transitions are named & atomic** — go through `utils/state-transitions.ts` (`escalate`, `markResolved`, `requireCustomerName`, …). Inline mutations of `pendingClosure`, `operatorRequested`, `pendingEscalation` are forbidden outside that module.
  5. **Each detector ships with tests** — pure helpers in `utils/` MUST have a sibling unit test file with happy + edge cases. 100% coverage on the detector itself.
  6. **No hardcoded phrase detection for INTENT** — phrase routing belongs in the LLM. Phrase detection is allowed only for boundary signals (greeting, mixed-signal, contrast connectors).
  7. **Settings are law** — `json/settings.json` is the source of truth for tenant config. `runtime.ts:validateSettings` fails fast on misconfiguration.
  8. **Multi-language by design** — every detector covers all 6 supported languages (es, it, en, ca, pt, fr) with tests.
- **HOW TO ADD A USE CASE**: see [`apps/backend/custom-ecolaundry/docs/adding-use-cases.md`](apps/backend/custom-ecolaundry/docs/adding-use-cases.md). Pick the matching recipe.
- **HOW EACH TOOL VALIDATES**: see [`apps/backend/custom-ecolaundry/docs/contracts.md`](apps/backend/custom-ecolaundry/docs/contracts.md).
- **ENFORCEMENT**: PRs that add `DO NOT DO X` lines to `prompts/agent.txt`, mutate state outside `state-transitions.ts`, or add a detector without tests must be rejected and rewritten following the recipes.

---

## 🎨 Code Conventions & Design Patterns

### 📚 PRIMARY DOCUMENTATION SOURCE

**CRITICAL**: The `docs/memory-bank/` directory is the **SINGLE SOURCE OF TRUTH** for all project knowledge:

- **ALWAYS** consult `docs/memory-bank/PRD.md` (9933 lines - comprehensive spec) BEFORE making changes
- **Architecture patterns**: Check `docs/memory-bank/03-architecture/` for system design
- **Feature specs**: Check `docs/memory-bank/02-features/` for requirements
- **Best practices**: Check `docs/memory-bank/04-best-practices/` for coding standards
- **Guides**: Check `docs/memory-bank/05-guides/` for how-to documentation

**When in doubt**: Ask Andrea questions BEFORE assuming or inventing features!

### Naming & Structure

- **TypeScript**: Use PascalCase for classes/interfaces, camelCase for functions/variables
- **Controllers**: Methods named after HTTP verb: `getProducts`, `createOrder`, `updateCustomer`
- **Services**: Methods describe business action: `processPayment`, `sendWhatsAppMessage`
- **Routes**: RESTful patterns with workspace scoping
  ```typescript
  router.get("/workspaces/:workspaceId/products", controller.getProducts)
  ```

### Backend Design Patterns

#### 1. Clean Architecture / DDD Pattern

```
backend/src/
├── application/services/    # Business logic orchestration
├── domain/                  # Core entities, value objects
├── repositories/            # Data access layer (Prisma)
├── interfaces/http/         # Controllers, routes, middleware
├── services/                # External integrations (LLM, email)
└── utils/                   # Helpers, formatters, logger
```

#### 2. Dependency Injection

Controllers ALWAYS use constructor injection:

```typescript
export class ProductController {
  constructor(
    private productService: ProductService,
    private prisma: PrismaClient
  ) {}
}
```

#### 3. Repository Pattern

Database access ONLY through repositories:

```typescript
export class ProductRepository {
  async findByWorkspace(workspaceId: string) {
    return prisma.products.findMany({
      where: { workspaceId, isActive: true },
    })
  }
}
```

#### 4. Import Organization (MANDATORY)

ALL files MUST have imports organized at the top:

```typescript
// 1. External dependencies (node_modules)
import { PrismaClient } from "@prisma/client"
import { Router } from "express"

// 2. Internal core (config, types)
import { config } from "../config"
import logger from "../utils/logger"

// 3. Middleware
import { authMiddleware } from "../middlewares/auth.middleware"

// 4. Services
import { UserService } from "../services/user.service"

// 5. Controllers
import { ProductController } from "../controllers/product.controller"

// 6. Routes
import { productRoutes } from "../routes/product.routes"
```

#### 5. Security Pattern (3-Layer)

ALL protected endpoints MUST use this middleware stack:

```typescript
router.post(
  "/workspaces/:workspaceId/resource",
  authMiddleware, // JWT token validation
  sessionValidationMiddleware, // x-session-id header
  validateWorkspaceOperation, // x-workspace-id + param validation
  controller.action
)
```

### Frontend Design Patterns

#### 1. Component Structure

```
frontend/src/
├── pages/           # Route components (one per URL)
├── components/      # Reusable components
│   ├── shared/      # Cross-feature components
│   ├── layout/      # Sidebar, Header, Footer
│   └── ui/          # shadcn/ui primitives
├── services/        # API clients (axios)
├── hooks/           # Custom React hooks
├── contexts/        # React context providers
└── utils/           # Client helpers
```

#### 2. shadcn/ui Pattern

ALWAYS use shadcn/ui components for consistency:

```typescript
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
```

#### 3. Slide Panel Pattern (NEW)

For edit forms, use slide panel from right:

```typescript
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
;<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetContent side="right" className="w-[600px]">
    {/* Edit form here */}
  </SheetContent>
</Sheet>
```

#### 4. API Client Pattern

```typescript
// services/productApi.ts
export const productApi = {
  async getAll(workspaceId: string) {
    const { data } = await api.get(`/workspaces/${workspaceId}/products`)
    return data
  },
}
```

### Code Quality Standards

#### Cleanliness Rules

- ✅ **Imports at top**: ALWAYS organize imports in logical sections
- ✅ **No duplicates**: Check for duplicate imports/functions
- ✅ **Delete unused**: Remove commented code and unused imports
- ✅ **Consistent naming**: Follow project conventions
- ✅ **File size**: Keep files under 500 lines (extract if larger)

#### Testing Requirements

- ✅ **Unit tests**: `npm run test:unit` for business logic
- ✅ **Security tests**: `npm run test:security` for auth/access control
- ✅ **NO integration tests**: Andrea does NOT want integration tests (too slow and flaky)
- ✅ **Coverage target**: Aim for >80% on critical paths

### Error Handling

**Backend**: Always include full error details in logs

```typescript
try {
  // ... operation
} catch (error) {
  logger.error("Failed to create order:", error) // Full stack trace
  return res.status(500).json({
    error: "Failed to create order",
    message: error.message,
  })
}
```

**Frontend**: Use toast notifications for user feedback

```typescript
import { toast } from "@/lib/toast"

try {
  await api.post("/orders", orderData)
  toast.success("Order created successfully")
} catch (error) {
  toast.error("Failed to create order")
}
```

### Authentication Flow

1. **JWT Tokens**: Stored in localStorage as `token`
2. **Auth Middleware**: `authMiddleware` validates JWT on protected routes
3. **Workspace Context**: `workspaceValidationMiddleware` extracts `workspaceId` from token
4. **Public Access**: `SecureTokenService` generates time-limited tokens for external links

Pattern in controllers:

```typescript
const workspaceId = (req as any).workspaceId // Set by middleware
const userId = (req as any).user.id // Set by authMiddleware
```

---

## 🔌 Key Integration Points

### WhatsApp Flow

1. Message received → `/api/whatsapp/webhook` (no auth)
2. `LLMService.handleMessage()` processes with OpenRouter
3. `CallingFunctionsService` executes system actions
4. Response sent back through WhatsApp API

### LLM System

- **Provider**: OpenRouter with GPT-4-mini
- **Prompt Source**: Database `agentConfig` table (never hardcoded)
- **Variable Replacement**: `{{nome}}`, `{{email}}`, etc. replaced by `replaceAllVariables()`
- **Function Calling**: LLM can trigger actions like `createOrder`, `searchProducts`

### Public Order Links

- Generated via `SecureTokenService.generateToken()`
- Format: `/orders-public?token=xxx` or `/orders-public/ORDER_CODE?token=xxx`
- Token contains: `customerId`, `workspaceId`, `type`, `expiry`
- Validates without requiring login

---

## 📋 Common Tasks

### Adding a New API Endpoint

1. **Create Controller Method** in `backend/src/interfaces/http/controllers/`

   ```typescript
   async getResource(req: Request, res: Response) {
     const workspaceId = (req as any).workspaceId
     const resources = await this.service.findAll(workspaceId)
     return res.json(resources)
   }
   ```

2. **Add Route** in `backend/src/interfaces/http/routes/`

   ```typescript
   router.get(
     "/",
     authMiddleware,
     workspaceValidationMiddleware,
     controller.getResource.bind(controller)
   )
   ```

3. **Update Swagger** with JSDoc comment

   ```typescript
   /**
    * @swagger
    * /api/workspaces/{workspaceId}/resources:
    *   get:
    *     summary: Get all resources
    *     tags: [Resources]
    *     parameters:
    *       - in: path
    *         name: workspaceId
    *         required: true
    */
   ```

4. **Create Frontend Service** in `frontend/src/services/`
   ```typescript
   export const resourceApi = {
     async getAll(workspaceId: string) {
       const { data } = await api.get(`/workspaces/${workspaceId}/resources`)
       return data
     },
   }
   ```

### Updating Database Schema

1. Edit `backend/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name add_new_field`
3. Update seed file if needed: `backend/prisma/seed.ts`
4. Run `npm run seed` to populate test data

### Updating Agent Prompts

**Multi-Agent System**: eChatbot uses 6 specialized agents (ROUTER, PRODUCT_SEARCH, CART_MANAGEMENT, ORDER_TRACKING, CUSTOMER_SUPPORT, SAFETY_TRANSLATION) for ecommerce, and INFO_AGENT for informational workspaces.

```bash
# Export prompts from database to markdown files
cd backend && npm run export:prompts

# Update database from markdown files
cd backend && npm run update:prompts
```

**Workflow**:

1. Edit prompts in UI (`/agent` page) or modify `.md` files in `docs/prompts/`
2. Export changes: `npm run export:prompts` (Database → .md files)
3. Review exported files in `docs/prompts/`
4. Commit changes to Git
5. To restore: `npm run update:prompts` (.md files → Database)

**Files**: `docs/prompts/router-agent.md`, `product-search.md`, `cart-management.md`, `order-tracking.md`, `customer-support.md`, `safety-translation.md`

### Workspace Backup/Restore

**ALWAYS workspace-isolated**:

```bash
# Export current workspace data
npx ts-node scripts/export-workspace-backup.ts {workspaceId}

# Restore workspace from latest backup
npx ts-node scripts/restore-workspace-backup.ts {workspaceId}

# Note: Backups stored in prisma/backups/{workspaceId}/
# Only ONE backup per workspace (latest overwrites previous)
```

## Access Points

- **Frontend (Customer)**: http://localhost:3000
- **Backoffice (Admin)**: http://localhost:3002
- **API**: http://localhost:3001
- **API Docs**: http://localhost:3001/api-docs (Swagger)
- **Database**: localhost:5434 (PostgreSQL)

**Default Login**: `admin@echatbot.ai` / `venezia44`

## Documentation

- **Primary Source**: `docs/memory-bank/PRD.md` (comprehensive spec)
- **Architecture**: `docs/memory-bank/03-architecture/`
- **Features**: `docs/memory-bank/02-features/`
- **Best Practices**: `docs/memory-bank/04-best-practices/`
- **Guides**: `docs/memory-bank/05-guides/`
- **Copilot Instructions**: `.github/copilot-instructions.md` (full ruleset)

**ALWAYS** consult PRD BEFORE making changes. When in doubt, ask questions instead of assuming features.

---

## 🔍 Debugging Tips

### Backend Logs

- Logger outputs to console and file: `backend/logs/`
- Use `logger.info()`, `logger.error()` for structured logging
- Set `DEBUG_MODE=true` in workspace for verbose LLM logs

### Frontend Debugging

- DevTools → Network tab shows API calls
- React DevTools for component state
- Check localStorage for `token`, `currentWorkspace`

### Common Issues

- **"Workspace ID required"**: Middleware not applied or token missing workspace claim
- **"Customer not found"**: Phone number formatting issue (remove spaces)
- **LLM not responding**: Check OPENROUTER_API_KEY in `.env`, verify workspace `agentConfig`

---

## 📚 Reference Files

- **Architecture**: `docs/PRD.md` (9933 lines, comprehensive spec)
- **Cleanup History**: `docs/other/FRONTEND_CLEANUP_SUMMARY.md`, `docs/other/BACKEND_CLEANUP_SUMMARY.md`
- **API Routes**: `backend/src/routes/index.ts` (main router setup)
- **Database Schema**: `backend/prisma/schema.prisma`
- **Frontend Routes**: `frontend/src/App.tsx`

---

## 🚫 Avoid These Patterns

❌ Hardcoded data or fallback values
❌ Queries without `workspaceId` filter
❌ Generic catch blocks without error details (always show full stack)
❌ Modifying layout/graphics without Andrea's explicit approval
❌ Running `git commit` (Andrea does this manually)
❌ Running `git push` (Andrea does this manually)
❌ Creating test/placeholder pages marked "WIP"
❌ Duplicating components instead of reusing existing ones
❌ Using OpenAI directly (use OpenRouter instead)
❌ Creating fake/mock functions outside test environments
❌ Inventing features not documented in PRD
❌ Touching `.env` file (ABSOLUTELY FORBIDDEN)

✅ Always pull from database
✅ Always filter by workspace
✅ Always log full error stack
✅ Always respect existing design system
✅ Always prepare changes with `git add -A` but NEVER commit
✅ Always build production-ready features
✅ Always check for existing implementations first
✅ Always ask Andrea before inventing new features
✅ Always update database seed if schema changes

---

## 🚨 CRITICAL GIT WORKFLOW

**AGENT RESPONSIBILITIES**:
- ✅ Make code changes
- ✅ Run tests to verify changes
- ✅ Stage files with `git add -A`
- ✅ Show git status/diff if needed
- ❌ **NEVER** run `git commit` - Andrea does this
- ❌ **NEVER** run `git push` - Andrea does this

**RATIONALE**: Andrea reviews and commits changes manually to maintain control over git history and deployment workflow.

---

## 📝 Final Notes

**Always consult** `docs/memory-bank/PRD.md` as the single source of truth for project requirements and specifications.

**Active Technologies**:
- TypeScript 5.x, Node.js 18+
- PostgreSQL with Prisma ORM
- React 18 + Vite
- OpenRouter/GPT-4-mini

**When in doubt**: ASK Andrea before making assumptions or inventing features!



## RULES
- salutami con il mio nome Andrea
- non fare mai il git add 
- non toccare ma il fil .env
- non harcodeare mai codice con stringe includes("string) o altre cose visto che e' LLM multilignua e se hai dubbi chiedi all'utente
- **niente pezze**: per i custom chatbot (`apps/backend/custom-ecolaundry/` e simili) i bug NON si risolvono aggiungendo regole nel prompt. Si risolvono nel codice — guard deterministico, tool validator, o invariant nel post-processor. Vedi le 8 regole ferree nella sezione "16. NO Patches — Architecture Layers Are Sacred" sopra, e il playbook in [`apps/backend/custom-ecolaundry/docs/adding-use-cases.md`](apps/backend/custom-ecolaundry/docs/adding-use-cases.md).