# 🏗️ eChatbot - Architettura Tecnica Dettagliata

## 📋 Panoramica Architetturale

eChatbot è una piattaforma e-commerce WhatsApp enterprise con architettura **microservizi** e **multi-tenant**, progettata per scalabilità, sicurezza e performance.

---

## 🎯 Principi Architetturali

### 1. **Microservizi Separati**
- **Backend API**: Gestione dati e business logic
- **Frontend SPA**: Interfaccia amministrativa
- **Scheduler**: Jobs asincroni e cron tasks
- **Backoffice**: Pannello super-admin

### 2. **Multi-Tenancy Completo**
- Isolamento workspace a livello database
- Sicurezza per-tenant
- Billing owner-based
- Configurazioni indipendenti

### 3. **AI-First Design**
- Architettura multi-agent LLM
- Router intelligente per classificazione intenti
- Agenti specializzati per dominio
- Context memory e conversation flow

---

## 🏢 Architettura Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                           │
│  Web Dashboard | Chat Widget | Mobile App | API Clients    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    LOAD BALANCER                            │
│                    (Heroku Router)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │   Backend    │ │  Scheduler   │ │  Backoffice  │
        │   API        │ │  Cron Jobs   │ │  Super Admin │
        │ (port 3001)  │ │              │ │ (port 3002)  │
        └──────────────┘ └──────────────┘ └──────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
    ┌─────────────┐ ┌──────────────┐
    │  AI Layer   │ │  Data Layer  │
    │ (Agents)    │ │ (Database)   │
    └─────────────┘ └──────────────┘
```

---

## 🔧 Stack Tecnologico Dettagliato

### **Frontend (React SPA)**
```typescript
// Core Technologies
React 18.x + TypeScript 5.x
Vite (Build Tool)
React Router v7 (Routing)

// State Management
React Context API
TanStack Query (Server State)
Zustand (Client State - optional)

// UI Framework
Tailwind CSS 3.x
shadcn/ui (Component Library)
Radix UI (Primitives)
Framer Motion (Animations)

// Form Management
React Hook Form
Zod (Validation)
@hookform/resolvers

// Utilities
Axios (HTTP Client)
date-fns (Date Utils)
React Hot Toast (Notifications)
Socket.io Client (Real-time)
```

### **Backend (Node.js API)**
```typescript
// Runtime & Framework
Node.js 18+ LTS
Express.js 4.x
TypeScript 5.x

// Database & ORM
PostgreSQL 15+
Prisma ORM 5.x
Redis (Caching & Sessions)

// Authentication & Security
JWT (JSON Web Tokens)
bcrypt (Password Hashing)
speakeasy (2FA TOTP)
helmet (Security Headers)
cors (CORS Management)

// File Management
Multer (File Upload)
Cloudinary (Cloud Storage)
Sharp (Image Processing)

// AI & External APIs
OpenAI SDK (LLM Integration)
OpenRouter API
Axios (HTTP Client)

// Process Management
PM2 (Production)
Winston (Logging)
node-cron (Scheduled Jobs)
Socket.io (Real-time)
```

### **Database Schema (Prisma)**
```prisma
// Core Models (47 tabelle totali)
- User (Utenti piattaforma)
- Workspace (Tenant/Canali)
- Customers (Clienti finali)
- Products/Services (Catalogo)
- Orders/OrderItems (E-commerce)
- Messages/ChatSessions (Conversazioni)
- AgentConfig (Configurazione AI)
- BillingTransaction (Fatturazione)

// Supporto Features
- FAQ (Knowledge Base)
- Campaigns (Marketing)
- SecureToken (Link pubblici)
- Usage (Analytics)
- Documents (File Management)
- MonthlyInvoice (Fatture mensili)
- SoftDeleteAuditLog (Compliance)
```

---

## 🤖 Architettura AI Multi-Agent

### **Router Agent (Orchestratore)**
```typescript
interface RouterAgent {
  order: 0
  responsibilities: [
    "Intent Classification",
    "FAQ Matching", 
    "Agent Selection",
    "Context Management"
  ]
  model: "openai/gpt-4o-mini"
  temperature: 0.3
}
```

### **Agenti Specializzati**
```typescript
const agents = {
  PRODUCT_SEARCH: {
    order: 2,
    domain: "Product Discovery & Search",
    functions: ["searchProducts", "getProductDetails", "filterByCategory"]
  },
  
  CART_MANAGEMENT: {
    order: 3,
    domain: "Shopping Cart Operations", 
    functions: ["addToCart", "removeFromCart", "getCart", "generateCartLink"]
  },
  
  ORDER_TRACKING: {
    order: 4,
    domain: "Order Management",
    functions: ["getOrders", "getOrderDetails", "trackShipment"]
  },
  
  CUSTOMER_SUPPORT: {
    order: 5,
    domain: "Support & Escalation",
    functions: ["contactOperator", "createTicket", "escalateIssue"]
  },
  
  SAFETY_TRANSLATION: {
    order: 99,
    domain: "Safety & Localization",
    functions: ["validateContent", "translateResponse", "detectLanguage"]
  }
}
```

### **Conversation Flow**
```
Customer Message
    │
    ▼
Router Agent (Intent Classification)
    │
    ├─→ Product Search Agent
    │   └─→ Query Database + AI Enhancement
    │
    ├─→ Cart Management Agent
    │   └─→ Modify Cart
    │
    ├─→ Order Tracking Agent
    │   └─→ Get Order Info
    │
    ├─→ Customer Support Agent
    │   └─→ Escalate to Operator
    │
    └─→ Safety & Translation Agent
        └─→ Validate + Translate Response
            │
            ▼
        Send to WhatsApp/Widget
```

---

## 🔒 Sicurezza e Multi-Tenancy

### **Isolamento Workspace**
```typescript
// Middleware di validazione workspace
const workspaceValidation = (req, res, next) => {
  const workspaceId = req.headers['x-workspace-id']
  const userWorkspaces = req.user.workspaces
  
  if (!userWorkspaces.includes(workspaceId)) {
    return res.status(403).json({ error: 'Workspace access denied' })
  }
  
  req.workspaceId = workspaceId
  next()
}

// Query con isolamento automatico
const getProducts = async (workspaceId: string) => {
  return prisma.products.findMany({
    where: { 
      workspaceId,
      deletedAt: null // Soft delete
    }
  })
}
```

### **Autenticazione Multi-Layer**
```typescript
interface AuthLayers {
  JWT: "Bearer token per API access"
  "2FA": "TOTP obbligatorio per admin"
  "Session": "Server-side session per security"
  "Workspace": "Per-tenant access control"
  "Public Tokens": "Temporary access per pagine pubbliche"
}
```

### **Token Pubblici Sicuri**
```typescript
interface SecureToken {
  token: string        // UUID v4
  type: "CART" | "ORDER" | "PROFILE" | "CHECKOUT"
  workspaceId: string  // Tenant isolation
  customerId?: string  // Customer binding
  expiresAt: Date      // Auto-expiry (24h default)
  payload?: object     // Encrypted additional data
  ipAddress?: string   // IP binding per security
}
```

---

## 💾 Gestione Dati e Performance

### **Database Design Patterns**

#### **Soft Delete System**
```typescript
// Tutti i modelli principali supportano soft delete
interface SoftDeletable {
  deletedAt: Date | null
  isDelete: boolean // Backward compatibility
}

// Query automatiche con soft delete
const findActiveRecords = {
  where: {
    deletedAt: null,
    workspaceId: currentWorkspace
  }
}
```

#### **Audit Trail Completo**
```typescript
interface AuditLog {
  entityType: string    // "USER", "ORDER", "PRODUCT"
  entityId: string      // ID del record modificato
  action: string        // "CREATE", "UPDATE", "DELETE"
  changes: object       // Diff delle modifiche
  userId: string        // Chi ha fatto la modifica
  workspaceId: string   // Tenant context
  timestamp: Date       // Quando è avvenuta
  ipAddress?: string    // Da dove è avvenuta
}
```

### **Caching Strategy**
```typescript
// Redis per performance
const cacheStrategy = {
  "User Sessions": "30 minutes TTL",
  "Product Catalog": "1 hour TTL, invalidate on update",
  "Agent Configurations": "24 hours TTL",
  "FAQ Responses": "6 hours TTL",
  "Conversation Context": "10 minutes TTL"
}
```

### **Database Indexing**
```sql
-- Indici critici per performance
CREATE INDEX idx_workspace_isolation ON products(workspaceId, deletedAt);
CREATE INDEX idx_conversation_lookup ON messages(chatSessionId, createdAt);
CREATE INDEX idx_billing_tracking ON billing_transactions(userId, createdAt);
CREATE INDEX idx_agent_logs ON agent_conversation_logs(workspaceId, customerId);
```

---

## 🚀 Deployment e Scalabilità

### **Heroku Multi-App Architecture**
```yaml
# Tre applicazioni Heroku separate
apps:
  echatbot-app:
    services: [backend, frontend]
    dynos: "web: node dist/src/index.js"
    
  echatbot-scheduler:
    services: [scheduler]
    dynos: "worker: node dist/src/scheduler.js"
    
  echatbot-backoffice:
    services: [backoffice]
    dynos: "web: npm run start"

# Database condiviso
addons:
  - heroku-postgresql:standard-0
  - heroku-redis:premium-0
```

### **Environment Configuration**
```typescript
// Configurazione per ambiente
interface EnvironmentConfig {
  development: {
    database: "postgresql://localhost:5434/echatbot_dev"
    redis: "redis://localhost:6379"
    cors: ["http://localhost:3000", "http://localhost:3002"]
  }
  
  production: {
    database: process.env.DATABASE_URL
    redis: process.env.REDIS_URL
    cors: ["https://echatbot.ai", "https://backoffice.echatbot.ai"]
  }
}
```

### **Monitoring e Observability**
```typescript
// Winston Logging Structure
const logLevels = {
  error: "System errors, exceptions",
  warn: "Business logic warnings", 
  info: "Important business events",
  debug: "Development debugging"
}

// Metriche chiave da monitorare
const metrics = {
  "API Response Time": "< 200ms p95",
  "Database Query Time": "< 50ms p95", 
  "LLM Response Time": "< 3s p95",
  "Error Rate": "< 1%",
  "Uptime": "> 99.9%"
}
```

---

## 🔄 Data Flow e Integrations

### **WhatsApp Integration Flow**
```
WhatsApp Message
    │
    ▼
Backend Webhook
    │
    ▼
Store in Database
    │
    ▼
LLM Router Processing
    │
    ▼
Put in MessageQueue
    │
    ▼
Scheduler Processing
    │
    ├─→ Security Check
    │
    ├─→ Send to WhatsApp API
    │
    └─→ Update Message Status
```

### **Billing System Flow**
```
User Action (Message, Order, etc.)
    │
    ▼
Calculate Cost
    │
    ▼
Check Credit Balance
    │
    ├─→ Sufficient? → Deduct Credit
    │
    └─→ Insufficient? → Block Action
    │
    ▼
Log Transaction
    │
    ▼
Execute Action
```

---

## 📊 Performance Targets

### **Response Time SLA**
```typescript
const performanceTargets = {
  "API Endpoints": "< 200ms p95",
  "Database Queries": "< 50ms p95",
  "LLM Agent Response": "< 3000ms p95",
  "File Upload": "< 5000ms p95",
  "Page Load Time": "< 2000ms p95"
}
```

### **Scalability Limits**
```typescript
const scalabilityLimits = {
  "Concurrent Users": "1000+ per workspace",
  "Messages per Second": "100+ per workspace", 
  "Database Connections": "100 max pool",
  "File Storage": "Unlimited (Cloudinary)",
  "Workspaces": "Unlimited multi-tenant"
}
```

---

## 🔮 Architettura Futura

### **Planned Enhancements**
1. **Kubernetes Migration**: Da Heroku a K8s per maggiore controllo
2. **Event Sourcing**: Per audit trail completo e replay capability
3. **GraphQL API**: Per query ottimizzate da frontend
4. **Microservices Split**: Separazione ulteriore dei domini
5. **AI Model Training**: Custom models per intent classification

### **Technology Roadmap**
```typescript
const roadmap = {
  "Q1 2025": ["Docker Production", "CI/CD Pipeline", "Performance Optimization"],
  "Q2 2025": ["Kubernetes Migration", "Event Sourcing", "Advanced Analytics"],
  "Q3 2025": ["GraphQL API", "Custom AI Models", "Mobile App"],
  "Q4 2025": ["Multi-Region Deployment", "Advanced Security", "Enterprise Features"]
}
```

---

*Documentazione architettura aggiornata il: 2025-01-10*
*Versione: 2.0*