# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**eChatbot** is a WhatsApp-based e-commerce platform with multi-agent AI chatbot integration. Multi-workspace, multi-tenant architecture.

**Stack**: Node.js/Express + React/TypeScript + PostgreSQL + Prisma ORM + OpenRouter API

**Commands**: see `package.json` scripts (`dev:all`, `test:unit`, `prisma:migrate`, `build`, etc.)  
**Architecture & specs**: see `docs/PRD.md` (single source of truth)

---

## 🚨 CRITICAL RULES - ALWAYS FOLLOW (Andrea's Requirements)

### 0. Address User by Name

- **ALWAYS** call the user "Andrea"

### 0.1. NEVER Use Worktree - ALWAYS Work on Main Branch (🚨 CRITICAL)

- **REPOSITORY PATH**: `/Users/gelso/workspace/shopME` (MAIN REPOSITORY)
- **WORKTREE PATH**: `/Users/gelso/workspace/shopME.worktrees/copilot-worktree-*` (❌ FORBIDDEN)
- **NEVER** commit/push from worktree — always from main repository
- **If accidentally in worktree**: STOP, cd to main repository, redo work there

### 1. Database-First Architecture

- **NEVER** use hardcoded fallbacks, default values, or mock data
- **ALL** configuration (prompts, agent configs, prices) comes from database
- If data is missing: return proper error, don't invent defaults
- **NO STATIC PROMPTS**: everything must be dynamic from database
- **NO HARDCODED TRANSLATIONS**: data is stored in Italian (base language) in DB; LLM handles translation dynamically

### 2. Workspace Isolation

- **EVERY** database query MUST filter by `workspaceId`
- Pattern: `where: { workspaceId, ...otherFilters }`
- Critical for multi-tenant security

### 3. Server Auto-Restart

- Hot-reload enabled via `ts-node-dev` and `vite`
- **NEVER** manually restart servers or open new terminals — just save and wait 1-2 seconds

### 4. Environment Protection (🚨 CRITICAL - NEVER TOUCH .env)

- **ABSOLUTELY FORBIDDEN**: NEVER read, modify, delete, or interact with `.env` file
- **NEVER** run `cat .env`, `vim .env`, etc.
- If configuration is needed: ASK Andrea
- Exception: ONLY if Andrea explicitly says "modify .env" with exact content

### 5. PDF File Protection

- **NEVER** delete, modify, or touch `backend/prisma/temp/international-transportation-law.pdf`
- Never remove files from `backend/prisma/temp/` directory

### 6. Swagger Documentation

- Update `backend/src/swagger.yaml` immediately after API changes
- **AFTER EVERY API CHANGE**: verify swagger is updated and working

### 7. Test Before "Done"

- Never say task is completed without verifying it works
- Run `npm run test:unit` to verify

### 7A. Test Policy - Tests Are The Bible (🚨 SACRED)

- **Tests define expected behavior. Code must follow tests, not the other way around.**
- **DO NOT change test LOGIC without explicit approval from Andrea.**
- Mocks CAN be updated if they don't work, but test assertions/logic CANNOT change
- If a test fails, fix the implementation first
- **ALWAYS add comprehensive comments in tests explaining the WHAT and WHY**
- **CONFLICT RESOLUTION**: If documentation says X but test expects Y → ASK Andrea

### 7B. NO Integration Tests (🚨 ANDREA'S RULE)

- **NEVER** create or run integration tests (`test:integration`)
- **ONLY** unit tests are allowed (`test:unit`)
- **DO NOT** create files in `__tests__/integration/` directory

### 8. WhatsApp Testing Policy

- **NEVER** test features directly via WhatsApp during development
- ✅ DO: Implement backend logic, calling functions, database operations
- ✅ DO: Create unit tests with mocks
- ❌ DON'T: Attempt to send real WhatsApp messages

### 9. 360-Degree Thinking

- **ALWAYS** think full-stack: FE → API → Middleware → Controller → Service → Repository → DB
- Complete checklist before finishing:
  - ✅ Frontend: Component, API service, error handling, loading states
  - ✅ Backend API: Route, middleware stack, controller, Swagger docs
  - ✅ Service Layer: Business logic, workspace isolation, error handling
  - ✅ Repository: DB queries with `workspaceId` filter
  - ✅ Database: Migration, seed update, Prisma generate
  - ✅ Security: 3-layer middleware (authMiddleware → sessionValidationMiddleware → validateWorkspaceOperation)
  - ✅ Tests: Unit tests, security tests
- **NEVER** partial implementations

### 10. Chat Isolation & Concurrency Safety

- Use Prisma transactions with unique constraint `(customerId, status="active")` for session creation
- LLM Processing: in-memory async lock per `sessionId` via `withSessionLock` in `custom-client-0/index.ts`
- `sessionCache` capped at `MAX_CACHED_SESSIONS` (default 10000), LRU eviction
- **NO global locks**: only per-customer or per-session isolation

### 11. Variable Uniqueness Constraint

- `{{products}}`, `{{offers}}`, `{{services}}`, `{{categories}}` must appear at most ONCE per prompt
- Each variable can inject 50k+ tokens → duplicate usage → LLM API failure
- `PromptProcessorService.replaceAllVariables()` must validate before replacement

### 12. Repository Cleanliness (🚨 MANDATORY)

- ❌ NO temporary scripts, backup files, commented-out code, unused imports, dead functions
- ✅ Keep files under 500 lines
- ✅ Ask before cleaning if unsure whether file is needed

### 13. NEVER Touch Working Code (🚨 CRITICAL)

- If a file/import/export pattern is working correctly, **NEVER** modify it without explicit request
- ❌ No refactoring "for consistency" without being asked
- Before touching ANY export/import: "Is this currently working? If YES → DON'T TOUCH IT!"

### 14. User Context Freedom - NO Hardcoded Phrase Detection (🚨 CRITICAL)

- Detect input TYPE, not content:
  - `NUMBER` input → use previous context (list selection)
  - `TEXT` input → reset state to IDLE
- **FORBIDDEN**:
  - ❌ `if (message.includes("ordine"))` — NO keyword detection
  - ❌ Any language-specific pattern matching for phrases
- **ALLOWED**:
  - ✅ Numeric selection: `/^(\d+)$/`
  - ✅ Yes/No confirmation: `/^(s[iì]|no|ok|yes)$/i`
- LLM handles ALL phrase-based intent detection

### 15. English-Only UI (🚨 MANDATORY)

- ALL UI text MUST be in English — no Italian, Spanish, or other languages
- Applies to: button labels, form labels, placeholders, toast messages, dialog titles, validation errors, tooltips, code comments in components
- Exception: LLM-generated responses to customers are dynamic and multilingual

### 16. NO Patches — Architecture Layers Are Sacred (🚨 IRON RULE)

- When an LLM-driven feature behaves wrong, the fix is **deterministic code**, never a rule in the prompt
- Applies to `apps/backend/custom-ecolaundry/` and any future custom chatbot
- **THE 8 IRON RULES** (full text in `apps/backend/custom-ecolaundry/docs/architecture.md`):
  1. No patches in the prompt — fix in code (guard, tool validator, post-processor invariant)
  2. Tool refuses, LLM corrects — tools validate args + semantics
  3. One file = one responsibility — files >150 lines mixing concerns must be split
  4. State transitions are named & atomic — go through `utils/state-transitions.ts`
  5. Each detector ships with tests — 100% coverage on the detector itself
  6. No hardcoded phrase detection for INTENT — phrase routing belongs in the LLM
  7. Settings are law — `json/settings.json` is source of truth for tenant config
  8. Multi-language by design — every detector covers all 6 languages (es, it, en, ca, fr, de)
- **BUG INTAKE PROTOCOL** (🚨 MANDATORY): see `apps/backend/custom-ecolaundry/CLAUDE.md → 🐛 Bug intake protocol` — 7-step checklist BEFORE writing any fix code
- **FEATURE INTAKE PROTOCOL** (🚨 MANDATORY): see `apps/backend/custom-ecolaundry/CLAUDE.md → ✨ Feature intake protocol` — 8-step checklist BEFORE implementing

### 17. F50 — Visual Flow Builder DEPRECATED (2026-05-13)

- ❌ `FlowAgentLLM`, `FlowWorkspaceStrategy`, `AgentConfigRepository`, `agent-config.controller` — marked `@deprecated`, do NOT extend
- ❌ DB tables `AgentConfig` / `FlowConfig` — pending cleanup
- ✅ New paradigm: `workspace.customChatbotId` → code-based module at `apps/backend/custom-<name>/`

---

## 🔧 Token-Saving Tooling (installed 2026-07-31)

Two tools are installed to cut context usage. They solve **different** problems — use both.

### CodeGraph — semantic code navigation (replaces blind grep/read)

Full graph of the monorepo: 1,426 files, 16k nodes, 50k edges. Rebuilt automatically on every file change (auto-sync daemon), so it is never stale.

**Use it INSTEAD of scattershot Grep/Read when the question is structural:**

```bash
codegraph query <symbol>            # Where is this defined? (all workspaces at once)
codegraph callers <symbol>          # Who calls this?
codegraph callees <symbol>          # What does this call?
codegraph impact <symbol>           # 🚨 Blast radius BEFORE changing anything
codegraph explore "<question>"      # Source + call paths in one shot
codegraph affected <files...>       # Which tests cover these changed files
```

**When this matters most in shopME:**

- **Rule 13 (NEVER touch working code)** → run `codegraph impact <symbol>` BEFORE editing any shared export. If the blast radius crosses `custom-*` modules, stop and ask Andrea.
- **Rule 9 (360° thinking)** → `codegraph explore` traces FE → API → controller → service → repository in one call instead of ten Greps.
- **Rule 7 (test before done)** → `git diff --name-only HEAD | codegraph affected --stdin --quiet` gives the exact unit tests to run, instead of the full suite.
- **Duplicated logic across chatbots** → the four `custom-demo*/agent.ts` modules share near-identical functions (`withSessionLock`, `agentTurn`, `chatbotFn`). `codegraph query` surfaces all copies at once, so a fix is never applied to only one.

The MCP tool `codegraph_explore` is wired into Claude Code globally and answers most "how does X work" questions in a single call.

⚠️ `.codegraph/` (~94MB SQLite) is **gitignored** — local index, never commit it. Rebuild with `codegraph init`.

### RTK — bash output compression

Filters verbose command output (git, npm test, tsc, docker, prisma) before it reaches the LLM. Installed via Homebrew.

```bash
rtk tsc                  # TypeScript errors grouped by file
rtk jest / rtk vitest    # failures only, passing collapsed to a count
rtk git status / diff    # compact
rtk lint                 # ESLint grouped by rule
rtk prisma generate      # no ASCII art
```

⚠️ **Scope limit**: the auto-rewrite hook only intercepts **Bash** calls. Claude Code's built-in `Read`, `Grep`, and `Glob` tools bypass it entirely — for structural questions prefer CodeGraph, which is purpose-built for that.

⚠️ Telemetry is **disabled** on both tools. Keep it that way (this is a client codebase).

### Discarded — do NOT install

| Tool | Why rejected |
|------|--------------|
| **caveman** | Shortens the agent's *replies*. Adds ~1–1.5k input tokens/turn and conflicts with the rules requiring detailed test comments and full-stack reasoning. |
| **headroom** | Local **proxy that rewrites API requests** — overlaps RTK's job with far more interception. Rejected for a client codebase. |

---

## Security Pattern (3-Layer — ALL protected endpoints)

```typescript
router.post('/workspaces/:workspaceId/resource',
  authMiddleware,               // JWT token validation
  sessionValidationMiddleware,  // x-session-id header check
  validateWorkspaceOperation,   // x-workspace-id + param validation
  controller.action
)
```

Controller access pattern:
```typescript
const workspaceId = (req as any).workspaceId  // set by middleware
const userId = (req as any).user.id            // set by authMiddleware
```

---

## Access Points

- **Frontend**: http://localhost:3000
- **Backoffice**: http://localhost:3002
- **API**: http://localhost:3001
- **API Docs**: http://localhost:3001/api-docs (Swagger)
- **Database**: localhost:5434 (PostgreSQL)
- **Default Login**: `admin@echatbot.ai` / `venezia44`

---

## 🚫 Avoid These Patterns

❌ Hardcoded data or fallback values  
❌ Queries without `workspaceId` filter  
❌ Generic catch blocks without full error details  
❌ Modifying layout/graphics without Andrea's explicit approval  
❌ Running `git commit` or `git push` (Andrea does this manually)  
❌ Running `git add` (Andrea does this manually)  
❌ Touching `.env` file (ABSOLUTELY FORBIDDEN)  
❌ Hardcoded phrase/keyword detection (`includes`, regex on user text)  
❌ Using OpenAI directly (use OpenRouter)  
❌ Inventing features not in PRD  
❌ Integration tests  

✅ Always pull from database  
✅ Always filter by workspace  
✅ Always log full error stack  
✅ Always update Swagger after API changes  
✅ Always run `npm run test:unit` before saying "done"  
✅ Always ask Andrea before inventing new features  

---

## 🚨 CRITICAL GIT WORKFLOW

- ✅ Make code changes
- ✅ Run tests to verify changes
- ❌ **NEVER** run `git add` — Andrea does this
- ❌ **NEVER** run `git commit` — Andrea does this
- ❌ **NEVER** run `git push` — Andrea does this
