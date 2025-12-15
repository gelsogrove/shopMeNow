# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Principle I - Database-First**:

- [ ] No hardcoded prompts, configurations, or translations
- [ ] All dynamic content from database (agentConfig, products, categories)
- [ ] Proper error handling if database data missing (no fallback defaults)

**Principle II - Workspace Isolation**:

- [ ] All database queries filter by `workspaceId`
- [ ] Middleware stack extracts workspace from JWT token
- [ ] No cross-workspace data access (security tests required)

**Principle III - Variable Replacement**:

- [ ] Agent prompts use template syntax: `{{variable}}`
- [ ] Runtime replacement via `replaceAllVariables()` before LLM calls
- [ ] Base language Italian, LLM handles translation
- [ ] **Variable Uniqueness**: `{{PRODUCTS}}`, `{{OFFERS}}`, `{{SERVICES}}`, `{{CATEGORIES}}` appear at most ONCE per prompt
- [ ] Prompt validation prevents duplicate large variables (token explosion prevention)

**Principle IV - No Static Translations**:

- [ ] Product/category names in Italian only (database)
- [ ] LLM Translation Layer for customer language
- [ ] No translation mapping dictionaries

**Principle V - 360-Degree Thinking**:

- [ ] Frontend-backend contract validated (parameter names, types)
- [ ] Security middleware stack complete (auth → session → workspace)
- [ ] Database migration + seed + repository + tests all updated
- [ ] HTTP methods consistent (GET/POST/PUT/DELETE)
- [ ] Full-stack implementation (no partial FE-only or BE-only changes)

**Principle VI - Chat Isolation & Concurrency Safety**:

- [ ] Session creation uses transactions (prevent duplicate sessions)
- [ ] Message processing has customer-level locking (prevent race conditions)
- [ ] Database unique constraint on `(customerId, status="active")`
- [ ] Integration tests verify concurrent request handling
- [ ] NO global locks (only per-customer or per-session isolation)

**Principle VII - Code Cleanliness & Technical Debt Prevention**:

- [ ] No temporary scripts or backup files in repository (*.backup, *.old, *.tmp)
- [ ] No unused code (commented-out functions, unused imports, dead code)
- [ ] No code duplication (extract shared logic to utilities/services)
- [ ] Pre-commit hook validates cleanliness (rejects temp files, unused imports)
- [ ] Files under 500 lines (extract if larger)

**Multi-Agent Architecture**:

- [ ] Router → Specialist → Router → Safety flow preserved
- [ ] Router maintains full conversation history (10 minutes)
- [ ] Specialists use limited context (last 3 messages)

**Security Requirements**:

- [ ] Protected endpoints use 3-layer middleware
- [ ] Public access via SecureTokenService with time-limited tokens
- [ ] HMAC signature verification for webhooks

**Testing Standards**:

- [ ] Unit tests for business logic (>80% coverage on critical paths)
- [ ] Security tests for auth and workspace isolation
- [ ] Integration tests for API endpoints

**Operational Configuration**:

- [ ] Workspace `debugMode` flag controls usage tracking
- [ ] Debug mode skips billing, enhances logging
- [ ] Production mode enables full tracking and rate limiting

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
