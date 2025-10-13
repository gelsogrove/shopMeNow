# 📚 ShopME Documentation Index

> **Complete technical documentation for ShopME - WhatsApp E-Commerce Platform**
>
> Last Updated: October 14, 2025 | Branch: `01-layer-security`

---

## 🎯 Quick Navigation

| Category                                 | Description                                     | Key Topics                                          |
| ---------------------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| [🔒 Security](#-01-security)             | Authentication, authorization, OWASP compliance | JWT, SessionID, Rate Limiting, Translation Security |
| [⚡ Features](#-02-features)             | Core platform features                          | WhatsApp, Short Links, Scheduler, Billing, Messages |
| [🏗️ Architecture](#️-03-architecture)    | System design and patterns                      | LLM Flow, WebSockets, Endpoints, Style Guide        |
| [✨ Best Practices](#-04-best-practices) | Coding standards and conventions                | Backend DDD, Frontend Clean Code                    |
| [📖 Guides](#-05-guides)                 | Setup and integration guides                    | WhatsApp Setup, Testing, Scripts                    |

---

## 🔒 01. SECURITY

Critical security documentation covering authentication, authorization, and threat protection.

### 📄 Documents

### 📄 Security Documents

| File                                                                                           | Description                                    | Key Topics                                         |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| **[owasp.md](01-SECURITY/owasp.md)**                                                           | OWASP Top 10 compliance and security measures  | SQL Injection, XSS, CSRF, Auth, Rate Limiting      |
| **[translation-security-summary.md](01-SECURITY/translation-security-summary.md)**             | Multi-language content filtering system        | Profanity Detection, Spam Filtering, LLM Responses |
| **[prompt-spam-translation-security.md](01-SECURITY/prompt-spam-translation-security.md)**     | Prompt spam detection and translation security | Content Filtering, Multi-language Safety           |
| **[sessionid-admin-panel.md](01-SECURITY/sessionid-admin-panel.md)**                           | Admin panel session management implementation  | SessionID Creation, Storage, Validation            |
| **[sessionid-sessionstorage-migration.md](01-SECURITY/sessionid-sessionstorage-migration.md)** | Migration from localStorage to sessionStorage  | Tab Isolation, Security Improvements               |
| **[sessionid-storage-fix.md](01-SECURITY/sessionid-storage-fix.md)**                           | Session storage implementation and bugfixes    | SessionID Lifecycle, Frontend/Backend Coordination |

### 🎯 Security Features

#### Authentication & Authorization

- **JWT Tokens**: Short-lived access tokens (1h expiry)
- **SessionID**: Unique per-tab session tracking (sessionStorage)
- **2FA Ready**: Architecture supports multi-factor authentication
- **Workspace Isolation**: Multi-tenant security with `workspaceId` filtering

#### Threat Protection

- **Rate Limiting**:
  - Global: 100 req/15min per IP
  - WhatsApp: 10 messages/minute per customer
- **Input Validation**: Zod schemas on all endpoints
- **SQL Injection**: Prisma ORM parameterized queries
- **XSS Protection**: Content sanitization, CSP headers
- **CSRF Protection**: SameSite cookies, token validation

#### Content Security (Translation Layer)

- **Profanity Filtering**: Multi-language (IT, EN, ES, PT)
- **Spam Detection**: Keyword-based blocking
- **Phishing Protection**: URL validation, external link blocking
- **Adult Content Filter**: Pattern matching across languages

### 🔐 When Each Security Layer is Used

| Layer                    | Trigger                     | Location                            | Purpose                                      |
| ------------------------ | --------------------------- | ----------------------------------- | -------------------------------------------- |
| **JWT Auth**             | Every backoffice API call   | `auth.middleware.ts`                | User authentication                          |
| **SessionID**            | Every authenticated request | `session-validation.middleware.ts`  | Tab-specific session tracking                |
| **Rate Limiting**        | All API endpoints           | `hard-rate-limit.middleware.ts`     | DDoS prevention                              |
| **WhatsApp Rate Limit**  | WhatsApp webhook            | `whatsapp-rate-limit.middleware.ts` | Message flooding prevention                  |
| **Translation Security** | LLM responses               | `llm.service.ts`                    | Content filtering before sending to WhatsApp |
| **Workspace Validation** | Data access queries         | All repositories                    | Multi-tenant isolation                       |
| **Input Validation**     | Request body parsing        | Controllers + Zod schemas           | Data integrity                               |

---

## ⚡ 02. FEATURES

Core platform features and integrations.

### 📄 Documents

| File                                                                                         | Description                           | Key Topics                                        |
| -------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------- |
| **[short-links.md](02-FEATURES/short-links.md)**                                             | Time-limited secure public links      | Order Access, Customer Profiles, Token Generation |
| **[scheduler-service.md](02-FEATURES/scheduler-service.md)**                                 | Background job scheduling system      | Cron Jobs, Automated Tasks, Job Management        |
| **[whatsapp-setup-guide.md](02-FEATURES/whatsapp-setup-guide.md)**                           | WhatsApp Business API setup           | Meta Developer Console, Webhook Configuration     |
| **[whatsapp-integration-architecture.md](02-FEATURES/whatsapp-integration-architecture.md)** | WhatsApp integration architecture     | Message Flow, Webhook Handling, Media Support     |
| **[whatsapp-implementation-complete.md](02-FEATURES/whatsapp-implementation-complete.md)**   | Complete WhatsApp implementation docs | Message Types, Templates, Status Updates          |
| **[billing-system.md](02-FEATURES/billing-system.md)**                                       | Usage tracking and billing            | LLM Token Tracking, Cost Calculation              |
| **[message-sending-implementation.md](02-FEATURES/message-sending-implementation.md)**       | Message sending service architecture  | Queue Management, Retry Logic, Error Handling     |

### 🎯 Feature Overview

#### 🔗 Short Links

- **Purpose**: Public access to orders/profiles without login
- **Security**: Time-limited JWT tokens (24h default)
- **Use Cases**: Order confirmation, customer profile view
- **Token Format**: `/orders-public?token=xxx` or `/orders-public/ORDER_CODE?token=xxx`

#### 📅 Scheduler Service

- **Jobs**: Order status sync, billing calculations, cleanup tasks
- **Technology**: node-cron
- **Execution**: Background processes with error handling
- **Monitoring**: Logs all job executions

#### 💬 WhatsApp Integration

- **Message Types**: Text, images, documents, audio, video
- **Templates**: Pre-approved message templates for notifications
- **Webhooks**: Real-time message delivery and status updates
- **Rate Limiting**: 10 messages/min per customer
- **Media Handling**: Upload to backend, generate public URLs

#### 💰 Billing System

- **Tracking**: LLM token usage per workspace
- **Calculation**: Input + output tokens × model pricing
- **Storage**: `usage` table with aggregation views
- **Reporting**: Daily/monthly usage summaries

#### 📨 Message Sending

- **Architecture**: Async queue-based with retry logic
- **Providers**: WhatsApp, Email (planned)
- **Error Handling**: Exponential backoff, max 3 retries
- **Logging**: Full message lifecycle tracking

---

## 🏗️ 03. ARCHITECTURE

System architecture, design patterns, and technical specifications.

### 📄 Documents

| File                                                                                   | Description                                | Key Topics                                          |
| -------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------- |
| **[LLMSERVICE-ARCHITECTURE-FLOW.md](03-ARCHITECTURE/LLMSERVICE-ARCHITECTURE-FLOW.md)** | Complete LLM service flow                  | Chatbot Logic, Function Calling, Context Management |
| **[WEBSOCKET-IMPLEMENTATION.md](03-ARCHITECTURE/WEBSOCKET-IMPLEMENTATION.md)**         | Real-time WebSocket architecture           | Socket.IO, Event Handling, Authentication           |
| **[endpoints.md](03-ARCHITECTURE/endpoints.md)**                                       | API endpoints by authentication type       | Public, Token-Auth, Backoffice Routes               |
| **[style-guide.md](03-ARCHITECTURE/style-guide.md)**                                   | Frontend style guide and component library | Design System, UI Components, Theming               |

### 🎯 Architecture Overview

#### 🤖 LLM Service Flow

```
User Message (WhatsApp)
  → Webhook Validation
  → Customer Lookup (phone number)
  → Translation Security Layer ✅
  → LLM Processing (OpenRouter/GPT-4-mini)
    → System Prompt (from database)
    → Chat History (last 20 messages)
    → Function Calling (tool usage)
      → createOrder
      → searchProducts
      → getFAQs
      → updateCustomer
  → Response Generation
  → Translation Security Layer ✅
  → WhatsApp Send
  → Usage Tracking 💰
```

**Key Components:**

- **PromptProcessorService**: Variable replacement (`{{nome}}`, `{{email}}`)
- **CallingFunctionsService**: Maps LLM function calls to system actions
- **MessageRepository**: Stores conversation history
- **TranslationSecurityService**: Content filtering

#### 🔌 WebSocket Architecture

```
Client Connection
  → Authentication (JWT from localStorage)
  → Workspace Join (workspaceId room)
  → Event Listeners:
    - new-message (chat updates)
    - order-update (order status changes)
    - customer-update (profile changes)
  → Auto-reconnect on disconnect
```

**Security:**

- Socket authentication before join
- Workspace isolation (rooms)
- Rate limiting per socket
- Connection logging

#### 📡 Endpoint Categories

| Type           | Auth            | Use Case                    | Examples                       |
| -------------- | --------------- | --------------------------- | ------------------------------ |
| **Public**     | None            | Webhooks, health checks     | `/whatsapp/webhook`, `/health` |
| **Token-Auth** | Short-lived JWT | Public order/profile access | `/orders-public?token=xxx`     |
| **Backoffice** | JWT + SessionID | Admin panel operations      | `/api/workspaces/:id/products` |

#### 🎨 Frontend Style Guide

**Design System:**

- **Components**: shadcn/ui (Radix UI primitives)
- **Styling**: TailwindCSS utility-first
- **Icons**: Lucide React
- **Themes**: Light/Dark mode support
- **Typography**: Inter font family
- **Colors**: Consistent palette with semantic naming

**Structure:**

```
src/
├── components/
│   ├── shared/      # Cross-feature components
│   ├── layout/      # Sidebar, Header, Footer
│   └── ui/          # shadcn/ui primitives
├── pages/           # Route components
├── services/        # API clients
├── hooks/           # Custom React hooks
├── contexts/        # Global state (Auth, Workspace)
└── utils/           # Helpers, formatters
```

---

## ✨ 04. BEST PRACTICES

Coding standards, conventions, and architectural patterns.

### 📄 Documents

| File                                                                           | Description               | Key Topics                                      |
| ------------------------------------------------------------------------------ | ------------------------- | ----------------------------------------------- |
| **[backend-best-practices.md](04-BEST-PRACTICES/backend-best-practices.md)**   | Backend coding standards  | DDD, Clean Architecture, Error Handling         |
| **[frontend-best-practices.md](04-BEST-PRACTICES/frontend-best-practices.md)** | Frontend coding standards | Component Design, State Management, Performance |

### 🎯 Backend Best Practices

#### Clean Architecture / DDD Structure

```
backend/src/
├── application/services/    # Business logic, orchestration
├── domain/                  # Core entities, value objects
├── repositories/            # Database access layer (Prisma)
├── interfaces/http/         # Controllers, routes, middleware
│   ├── controllers/         # Request/response handling
│   ├── routes/              # Express route definitions
│   └── middlewares/         # Auth, validation, logging
├── services/                # External integrations (LLM, email)
└── utils/                   # Helpers, formatters, logger
```

#### Critical Rules

1. **Database-First Architecture**

   - NO hardcoded values, defaults, or fallbacks
   - ALL config from database (`agentConfig`, `workspace` tables)
   - Missing data = proper error, not invented defaults

2. **Workspace Isolation**

   - EVERY query filters by `workspaceId`
   - Pattern: `where: { workspaceId, ...filters }`
   - Multi-tenant security is non-negotiable

3. **Error Handling**

   ```typescript
   try {
     // operation
   } catch (error) {
     logger.error("Context message:", error) // Full stack trace
     return res.status(500).json({
       error: "User-friendly message",
       message: error.message,
     })
   }
   ```

4. **Naming Conventions**

   - Controllers: `getProducts`, `createOrder` (HTTP verb-based)
   - Services: `processPayment`, `sendWhatsAppMessage` (business action)
   - Routes: RESTful with workspace scoping

   ```typescript
   router.get("/workspaces/:workspaceId/products", controller.getProducts)
   ```

5. **Testing**
   - Unit tests for services/repositories
   - Integration tests for controllers
   - Security tests for authentication/authorization
   - Coverage target: 80%+

### 🎯 Frontend Best Practices

#### Component Design

```typescript
// ✅ GOOD: Single Responsibility
const ProductCard = ({ product }: { product: Product }) => {
  return (
    <Card>
      <CardHeader>{product.name}</CardHeader>
      <CardContent>€{product.price}</CardContent>
    </Card>
  )
}

// ❌ BAD: Multiple responsibilities
const ProductPage = () => {
  // Don't mix data fetching, UI, and business logic
}
```

#### State Management

1. **Local State**: `useState` for component-specific data
2. **Context**: `useAuth`, `useWorkspace` for global state
3. **Server State**: React Query for API data (planned)
4. **Form State**: React Hook Form for complex forms

#### Performance

- **Code Splitting**: Dynamic imports for large pages
- **Memoization**: `useMemo`, `useCallback` for expensive operations
- **Lazy Loading**: Images, components below the fold
- **Bundle Size**: Monitor with `npm run build` output

#### Error Boundaries

```typescript
<ErrorBoundary fallback={<ErrorPage />}>
  <Routes />
</ErrorBoundary>
```

#### API Integration

```typescript
// ✅ GOOD: Centralized API client
import { productsApi } from "@/services/productsApi"

const { data } = await productsApi.getAllForWorkspace(workspaceId)

// ❌ BAD: Direct axios calls in components
axios.get("/api/products")
```

---

## 📖 05. GUIDES

Step-by-step guides for setup, testing, and common tasks.

### 📄 Documents

| File                                                             | Description                         | Key Topics                         |
| ---------------------------------------------------------------- | ----------------------------------- | ---------------------------------- |
| **[whatsapp-setup-guide.md](05-GUIDES/whatsapp-setup-guide.md)** | Complete WhatsApp setup walkthrough | Meta App, Webhook, Phone Numbers   |
| **[MCP.md](05-GUIDES/MCP.md)**                                   | Model Context Protocol integration  | Testing Tools, Cursor Setup, Debug |
| **[unit-test-guide.md](05-GUIDES/unit-test-guide.md)**           | Unit testing guidelines             | Jest, Test Structure, Mocking      |
| **[scripts-guide.md](05-GUIDES/scripts-guide.md)**               | Available npm scripts and usage     | Build, Test, Seed, Deploy          |

### 🎯 Common Tasks

#### Running the Application

```bash
# Backend (port 3001)
cd backend && npm run dev

# Frontend (port 3000)
cd frontend && npm run dev

# Database (Docker)
docker-compose up -d
```

**Default Login**: `admin@shopme.com` / `venezia44`

#### Database Operations

```bash
# Seed database with test data
cd backend && npm run seed

# Create migration after schema change
npx prisma migrate dev --name description_of_change

# Generate Prisma client
npx prisma generate

# Update agent prompt from docs/prompt_agent.md
cd backend && npm run update-prompt
```

#### Testing

```bash
# Backend unit tests
cd backend && npm run test:unit

# Backend with coverage
npm run test:coverage

# Security tests
npm run test:unit -- --testPathPattern=security

# Frontend tests
cd frontend && npm test
```

---

## 🔍 Quick Reference

### Authentication Flow

1. **Login**: POST `/api/auth/login` → JWT token + SessionID
2. **Store**: `localStorage.setItem('token')` + `sessionStorage.setItem('sessionId')`
3. **Validate**: Every request → `authMiddleware` + `sessionValidationMiddleware`
4. **Refresh**: Token expires → redirect to login
5. **Logout**: Clear localStorage + sessionStorage

### WhatsApp Message Flow

```
Incoming Message
  → POST /whatsapp/webhook (no auth)
  → Rate Limit Check (10/min per customer)
  → Customer Lookup (phone → database)
  → LLM Processing (handleMessage)
    → Prompt from agentConfig table
    → Chat history (last 20 messages)
    → Function calling if needed
  → Translation Security Filter
  → Response Generation
  → WhatsApp Send API
  → Save conversation (both user + bot messages)
  → Usage Tracking (tokens counted)
```

### Public Link Flow

```
Generate Link
  → SecureTokenService.generateToken({
      customerId, workspaceId, type, expiry: 24h
    })
  → JWT token with claims
  → URL: /orders-public?token=xxx

Access Link
  → Extract token from query
  → Verify JWT signature
  → Check expiry
  → Extract customerId + workspaceId
  → Fetch data (filtered by workspace)
  → Render public page
```

### Workspace Isolation Pattern

```typescript
// ✅ EVERY query MUST include workspaceId
const products = await prisma.products.findMany({
  where: {
    workspaceId: workspaceId, // ← CRITICAL
    isActive: true,
    stock: { gt: 0 },
  },
})

// ❌ NEVER query without workspace filter
const products = await prisma.products.findMany({
  where: { isActive: true }, // ← SECURITY RISK
})
```

---

## 📊 Project Statistics

- **Total Endpoints**: 150+
- **Database Tables**: 35+
- **Test Coverage**: 83/83 tests passing (100%)
- **Code Quality**: TypeScript strict mode, ESLint, Prettier
- **Documentation**: 20+ detailed markdown files
- **Security**: OWASP Top 10 compliant

---

## 🚀 Next Steps

1. **Read Security Docs**: Start with [OWASP](01-SECURITY/owasp.md) and [Translation Security](01-SECURITY/translation-security-summary.md)
2. **Understand Architecture**: Review [LLM Flow](03-ARCHITECTURE/LLMSERVICE-ARCHITECTURE-FLOW.md) and [Endpoints](03-ARCHITECTURE/endpoints.md)
3. **Follow Best Practices**: Check [Backend](04-BEST-PRACTICES/backend-best-practices.md) and [Frontend](04-BEST-PRACTICES/frontend-best-practices.md) guides
4. **Set Up WhatsApp**: Follow [WhatsApp Setup Guide](05-GUIDES/whatsapp-setup-guide.md)

---

## 📝 Contributing

When updating documentation:

1. Keep this INDEX.md updated
2. Follow markdown formatting standards
3. Include code examples where relevant
4. Update "Last Updated" date
5. Cross-reference related documents

---

**Maintained by**: Andrea (gelsogrove)  
**Project**: ShopME - WhatsApp E-Commerce Platform  
**Repository**: https://github.com/shopmenow/shopME  
**Branch**: 01-layer-security  
**License**: Proprietary
