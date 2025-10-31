# ShopME AI Coding Agent Instructions

## 🎯 Project Overview

ShopME is a **WhatsApp-based e-commerce platform** with AI chatbot integration. The system enables businesses to manage products, orders, and customer interactions through WhatsApp using a simplified LLM architecture with OpenRouter/GPT-4-mini.

**Stack**: Node.js/Express + React/TypeScript + PostgreSQL + Prisma ORM + OpenRouter API

---

## 🚨 CRITICAL RULES - ALWAYS FOLLOW (Andrea's Requirements)

### 0. **Address User by Name**

- **ALWAYS** call the user "Andrea" in discussions and messages
- Example: "Andrea, I've completed the task" or "Andrea, what do you think?"

### 1. **Database-First Architecture**

- **NEVER** use hardcoded fallbacks, default values, or mock data
- **ALL** configuration (prompts, agent configs, prices) comes from database
- If data is missing: return proper error, don't invent defaults
- Example: Agent prompts MUST come from `agentConfig` table, never from constants
- **NO STATIC PROMPTS**: everything must be dynamic from database
- **NO HARDCODED TRANSLATIONS**: Categories, offers, products SEMPRE in italiano (lingua base) dal database
  - Methods like `getActiveCategories()` and `getActiveOffers()` return Italian text from DB
  - Translation Layer (with LLM) handles final translation to customer's language
  - NEVER create translation mappings (it/es/pt/en) - let LLM translate dynamically

### 2. **Workspace Isolation**

- **EVERY** database query MUST filter by `workspaceId`
- Pattern: `where: { workspaceId, ...otherFilters }`
- This is critical for multi-tenant security

### 3. **Server Auto-Restart**

- Backend/frontend have hot-reload enabled via `ts-node-dev` and `vite`
- **NEVER** manually restart servers or open new terminals
- Watch for compilation errors in existing terminal output

### 4. **Environment Protection**

- **MANDATORY**: Before ANY `.env` interaction: `cp .env .env.backup.$(date +%Y%m%d_%H%M%S)`
- Always inform Andrea when creating backups
- Never commit `.env` files to git
- If `.env` is lost: restore from most recent `.env.backup.*` file

### 5. **PDF File Protection**

- **NEVER** delete, modify, or touch `backend/prisma/temp/international-transportation-law.pdf`
- This file is CRITICAL for system operation
- Never remove files from `backend/prisma/temp/` directory
- Never modify seed script to remove PDF file creation

### 6. **Swagger Documentation**

- Update `backend/src/swagger.yaml` immediately after API changes
- All endpoints must have JSDoc comments with `@swagger` tags
- Run `npm run build` to regenerate swagger.json
- **AFTER EVERY API CHANGE**: verify swagger is updated and working

### 7. **Test Before "Done"**

- Never say task is completed without verifying it works
- Run tests: `npm run test:unit` or `npm run test:coverage`
- Integration tests require backend running (`npm run dev`)
- If tests fail: verify backend (port 3001), database, seed

---

## 🏗️ Architecture Patterns

### Backend Structure (Clean Architecture/DDD)

```
backend/src/
├── application/services/    # Business logic, orchestration
├── domain/                  # Core entities, value objects
├── repositories/            # Database access layer (Prisma)
├── interfaces/http/         # Controllers, routes, middleware
│   ├── controllers/         # Request/response handling
│   ├── routes/              # Express route definitions
│   └── middlewares/         # Auth, workspace validation, etc.
├── services/                # External integrations (LLM, email, etc.)
└── utils/                   # Helpers, formatters, logger
```

**Key Services**:

- `LLMService`: Direct OpenRouter integration, handles chat logic
- `CallingFunctionsService`: Maps LLM responses to system actions
- `SecureTokenService`: Generates time-limited access tokens for public URLs
- `PromptProcessorService`: Replaces variables in prompts with real data

### Frontend Structure

```
frontend/src/
├── pages/              # Route components (one per URL)
├── components/         # Reusable UI components
│   ├── shared/         # Cross-feature components
│   ├── layout/         # Layout wrappers (Sidebar, Header)
│   └── ui/             # shadcn/ui primitives
├── services/           # API clients (axios-based)
├── hooks/              # Custom React hooks
├── contexts/           # React context providers
└── utils/              # Client-side helpers
```

---

## 🔑 Critical Workflows

### Running the Application

```bash
# Backend (port 3001)
cd backend && npm run dev

# Frontend (port 3000)
cd frontend && npm run dev

# Database (Docker)
docker-compose up -d
```

**Default Login**: `admin@shopme.com` / `venezia44`

### Database Operations

```bash
# Seed database with test data
cd backend && npm run seed

# Create migration after schema change
npx prisma migrate dev --name description_of_change

# Generate Prisma client after schema update
npx prisma generate

# Update agent prompt from docs/prompt_agent.md to database
cd backend && npm run update-prompt

# Workspace Backup/Restore (ALWAYS workspace-isolated)
# Export current workspace data
npx ts-node scripts/export-workspace-backup.ts {workspaceId}

# Restore workspace from latest backup
npx ts-node scripts/restore-workspace-backup.ts {workspaceId}

# Note: Backups stored in prisma/backups/{workspaceId}/
# Only ONE backup per workspace (latest overwrites previous)
```

### Testing

```bash
# Backend unit tests
cd backend && npm run test:unit

# Backend with coverage
npm run test:coverage

# Frontend tests
cd frontend && npm test
```

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

#### 1. **Clean Architecture / DDD Pattern**
```
backend/src/
├── application/services/    # Business logic orchestration
├── domain/                  # Core entities, value objects
├── repositories/            # Data access layer (Prisma)
├── interfaces/http/         # Controllers, routes, middleware
├── services/                # External integrations (LLM, email)
└── utils/                   # Helpers, formatters, logger
```

#### 2. **Dependency Injection**
Controllers ALWAYS use constructor injection:
```typescript
export class ProductController {
  constructor(
    private productService: ProductService,
    private prisma: PrismaClient
  ) {}
}
```

#### 3. **Repository Pattern**
Database access ONLY through repositories:
```typescript
export class ProductRepository {
  async findByWorkspace(workspaceId: string) {
    return prisma.products.findMany({
      where: { workspaceId, isActive: true }
    })
  }
}
```

#### 4. **Import Organization (MANDATORY)**
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

#### 5. **Security Pattern (3-Layer)**
ALL protected endpoints MUST use this middleware stack:
```typescript
router.post(
  "/workspaces/:workspaceId/resource",
  authMiddleware,              // JWT token validation
  sessionValidationMiddleware, // x-session-id header
  validateWorkspaceOperation,  // x-workspace-id + param validation
  controller.action
)
```

### Frontend Design Patterns

#### 1. **Component Structure**
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

#### 2. **shadcn/ui Pattern**
ALWAYS use shadcn/ui components for consistency:
```typescript
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
```

#### 3. **Slide Panel Pattern (NEW)**
For edit forms, use slide panel from right:
```typescript
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

<Sheet open={isOpen} onOpenChange={setIsOpen}>
  <SheetContent side="right" className="w-[600px]">
    {/* Edit form here */}
  </SheetContent>
</Sheet>
```

#### 4. **API Client Pattern**
```typescript
// services/productApi.ts
export const productApi = {
  async getAll(workspaceId: string) {
    const { data } = await api.get(`/workspaces/${workspaceId}/products`)
    return data
  }
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
- ✅ **Integration tests**: `npm run test:integration` for API endpoints
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
❌ Running `git push` (Andrea does this manually)  
❌ Creating test/placeholder pages marked "WIP"  
❌ Duplicating components instead of reusing existing ones  
❌ Using OpenAI directly (use OpenRouter instead)  
❌ Creating fake/mock functions outside test environments  
❌ Inventing features not documented in PRD  
❌ Touching `.env` without backup

✅ Always pull from database  
✅ Always filter by workspace  
✅ Always log full error stack  
✅ Always respect existing design system  
✅ Always create git commits for Andrea to push  
✅ Always build production-ready features  
✅ Always check for existing implementations first  
✅ Always ask Andrea before inventing new features  
✅ Always update database seed if schema changes

IMPORTANTE !!!
NON DEVI FARE COMMIT CI PENSa L'UTENTE !!!!

USA SEMPRE COME CONTESTO 
docs/memory-bank/PRD.md
