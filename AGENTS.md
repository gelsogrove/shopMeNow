# AGENTS.md - Development Agents Instructions

This file defines 7 specialized development agents for the eChatbot project. Each agent has deep knowledge of a specific area of the codebase and can assist Andrea with specialized tasks.

**IMPORTANT**: These are NOT business logic agents (chatbot multi-agent system), but **development assistant agents** that understand the project architecture and can help with code development.

---

## 1. BACKEND AGENT

### Scope
Development of API endpoints, business logic orchestration, database access layer, and server-side architecture.

### Architecture Knowledge Required

**Clean Architecture/DDD Pattern:**
```
backend/src/
├── application/services/    # Business logic orchestration
├── domain/                  # Core entities, value objects
├── repositories/            # Data access layer (Prisma)
├── interfaces/http/         # Controllers, routes, middleware
├── services/                # External integrations (LLM, email)
└── utils/                   # Helpers, formatters, logger
```

**Key Principles:**
- **Controller → Service → Repository → Database** flow
- **Dependency Injection** in constructors
- **Workspace Isolation** mandatory (`where: { workspaceId }`)
- **3-Layer Middleware Stack** for protected routes
- **Transaction Pattern** with `prisma.$transaction()`
- **Domain Entity Mapping** for clean separation

### Common Tasks

1. **Add new API endpoint**
2. **Create new service with business logic**
3. **Create new repository for data access**
4. **Update Prisma schema + run migration**
5. **Implement workspace isolation**
6. **Add authentication/authorization**

### Code Patterns

#### 1. Controller Pattern

**Example from `workspace.controller.ts`:**
```typescript
import { Request, Response } from 'express';
import { WorkspaceService } from '../../application/services/workspace.service';
import logger from '../../utils/logger';

export class WorkspaceController {
  constructor(private workspaceService: WorkspaceService) {}

  async getWorkspace(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId; // Set by middleware
      const userId = (req as any).user.id; // Set by authMiddleware

      const workspace = await this.workspaceService.getWorkspaceById(
        workspaceId,
        userId
      );

      return res.json(workspace);
    } catch (error) {
      logger.error('Failed to get workspace:', error);
      return res.status(500).json({
        error: 'Failed to get workspace',
        message: error.message
      });
    }
  }
}
```

**Key Points:**
- ✅ Dependency injection in constructor
- ✅ Extract `workspaceId` and `userId` from request (set by middleware)
- ✅ Delegate to service layer
- ✅ Full error logging with `logger.error()`
- ✅ Structured error response

#### 2. Service Pattern with Transactions

**Example from `workspace.service.ts`:**
```typescript
import { PrismaClient } from '@prisma/client';
import logger from '../../utils/logger';

export class WorkspaceService {
  constructor(private prisma: PrismaClient) {}

  async createWorkspace(userId: string, data: CreateWorkspaceDto) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Create workspace
      const workspace = await tx.workspace.create({
        data: {
          name: data.name,
          slug: data.slug,
          type: data.type,
          ownerId: userId
        }
      });

      // 2. Create UserWorkspace relation
      await tx.userWorkspace.create({
        data: {
          userId,
          workspaceId: workspace.id,
          role: 'ADMIN'
        }
      });

      // 3. Create default agent config
      await tx.agentConfig.createMany({
        data: defaultAgentConfigs.map(config => ({
          ...config,
          workspaceId: workspace.id
        }))
      });

      logger.info(`Workspace created: ${workspace.id}`);
      return workspace;
    });
  }

  async getWorkspaceById(workspaceId: string, userId: string) {
    // Verify user has access
    const userWorkspace = await this.prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId }
      }
    });

    if (!userWorkspace) {
      throw new Error('Access denied');
    }

    return await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        channels: true,
        subscription: true
      }
    });
  }
}
```

**Key Points:**
- ✅ Transaction for atomic multi-step operations
- ✅ Always verify UserWorkspace relation (IDOR prevention)
- ✅ Log important operations
- ✅ Throw errors for service to handle

#### 3. Repository Pattern

**Example pattern:**
```typescript
export class ProductRepository {
  constructor(private prisma: PrismaClient) {}

  async findByWorkspace(workspaceId: string) {
    return await this.prisma.products.findMany({
      where: {
        workspaceId,
        isActive: true,
        deletedAt: null
      },
      include: {
        category: true,
        images: true
      },
      orderBy: { name: 'asc' }
    });
  }

  async findById(workspaceId: string, productId: string) {
    return await this.prisma.products.findFirst({
      where: {
        id: productId,
        workspaceId, // CRITICAL: workspace isolation
        deletedAt: null
      }
    });
  }

  async create(workspaceId: string, data: CreateProductDto) {
    return await this.prisma.products.create({
      data: {
        ...data,
        workspaceId // ALWAYS include workspaceId
      }
    });
  }
}
```

**Key Points:**
- ✅ ALWAYS filter by `workspaceId`
- ✅ Handle soft-delete (`deletedAt: null`)
- ✅ Use `findFirst` instead of `findUnique` when filtering by workspace
- ✅ Include related data if needed

#### 4. Middleware Stack Pattern

**Example protected route:**
```typescript
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { sessionValidationMiddleware } from '../middlewares/session-validation.middleware';
import { validateWorkspaceOperation } from '../middlewares/workspace-validation.middleware';

const router = Router();

// Protected endpoint with 3-layer stack
router.post(
  '/workspaces/:workspaceId/products',
  authMiddleware,                    // 1. JWT validation
  sessionValidationMiddleware,       // 2. x-session-id check
  validateWorkspaceOperation,        // 3. x-workspace-id + param validation
  productController.createProduct.bind(productController)
);

// Public endpoint (no auth)
router.get(
  '/public/products/:productId',
  productController.getPublicProduct.bind(productController)
);
```

**Key Points:**
- ✅ Use ALL 3 middleware for protected routes
- ✅ Use `.bind()` to preserve `this` context
- ✅ Public endpoints skip middleware

#### 5. Import Organization (MANDATORY)

**ALL files MUST organize imports in this order:**
```typescript
// 1. External dependencies (node_modules)
import { PrismaClient } from '@prisma/client';
import { Router, Request, Response } from 'express';

// 2. Internal core (config, types)
import { config } from '../config';
import logger from '../utils/logger';
import { CreateProductDto } from '../types/product.types';

// 3. Middleware
import { authMiddleware } from '../middlewares/auth.middleware';
import { workspaceValidationMiddleware } from '../middlewares/workspace-validation.middleware';

// 4. Services
import { ProductService } from '../application/services/product.service';
import { WorkspaceAccessService } from '../application/services/workspace-access.service';

// 5. Controllers
import { ProductController } from '../controllers/product.controller';

// 6. Routes (if applicable)
import { productRoutes } from '../routes/product.routes';
```

### Checklist for New Endpoint

When creating a new API endpoint, verify:

- [ ] **Controller** created with proper error handling (try-catch)
- [ ] **Middleware stack** applied (auth → session → workspace)
- [ ] **Service layer** separates business logic from controller
- [ ] **Repository** filters by `workspaceId` in ALL queries
- [ ] **Domain entity mapping** if needed
- [ ] **Swagger JSDoc comments** added to controller method
- [ ] **Error logging** with `logger.error()` includes full stack
- [ ] **Unit tests** written with SCENARIO/RULE comments
- [ ] **Imports organized** in 5 sections
- [ ] **Transaction used** if multiple DB operations
- [ ] **IDOR prevention** verified (UserWorkspace check)

### Complete Example: New Endpoint

**Task**: Add endpoint to get all orders for a workspace

**Step 1: Create Repository**
```typescript
// repositories/order.repository.ts
import { PrismaClient } from '@prisma/client';

export class OrderRepository {
  constructor(private prisma: PrismaClient) {}

  async findByWorkspace(workspaceId: string) {
    return await this.prisma.orders.findMany({
      where: {
        workspaceId,
        deletedAt: null
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
```

**Step 2: Create Service**
```typescript
// application/services/order.service.ts
import { OrderRepository } from '../../repositories/order.repository';
import logger from '../../utils/logger';

export class OrderService {
  constructor(private orderRepository: OrderRepository) {}

  async getWorkspaceOrders(workspaceId: string, userId: string) {
    // Verify workspace access
    const hasAccess = await this.verifyWorkspaceAccess(workspaceId, userId);
    if (!hasAccess) {
      throw new Error('Access denied to workspace');
    }

    const orders = await this.orderRepository.findByWorkspace(workspaceId);
    logger.info(`Retrieved ${orders.length} orders for workspace ${workspaceId}`);
    return orders;
  }
}
```

**Step 3: Create Controller**
```typescript
// interfaces/http/controllers/order.controller.ts
import { Request, Response } from 'express';
import { OrderService } from '../../../application/services/order.service';
import logger from '../../../utils/logger';

export class OrderController {
  constructor(private orderService: OrderService) {}

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/orders:
   *   get:
   *     summary: Get all orders for workspace
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of orders
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Server error
   */
  async getOrders(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId;
      const userId = (req as any).user.id;

      const orders = await this.orderService.getWorkspaceOrders(
        workspaceId,
        userId
      );

      return res.json(orders);
    } catch (error) {
      logger.error('Failed to get orders:', error);
      return res.status(500).json({
        error: 'Failed to get orders',
        message: error.message
      });
    }
  }
}
```

**Step 4: Create Route**
```typescript
// interfaces/http/routes/order.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { sessionValidationMiddleware } from '../middlewares/session-validation.middleware';
import { validateWorkspaceOperation } from '../middlewares/workspace-validation.middleware';
import { OrderController } from '../controllers/order.controller';

const router = Router();
const orderController = new OrderController(/* inject dependencies */);

router.get(
  '/workspaces/:workspaceId/orders',
  authMiddleware,
  sessionValidationMiddleware,
  validateWorkspaceOperation,
  orderController.getOrders.bind(orderController)
);

export default router;
```

**Step 5: Register Route in Main Router**
```typescript
// interfaces/http/routes/index.ts
import orderRoutes from './order.routes';

router.use('/api', orderRoutes);
```

---

## 2. FRONTEND AGENT

### Scope
React component development, UI/UX implementation, API integration, client-side state management.

### Architecture Knowledge Required

**Frontend Structure:**
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

**Key Technologies:**
- React 18 + TypeScript
- Vite for build/dev
- shadcn/ui component library
- TanStack Query for server state
- React Context for global state
- React Router v6 for routing

### Common Tasks

1. **Create new page component**
2. **Create reusable component**
3. **Add API service method**
4. **Implement form with shadcn/ui**
5. **Handle errors with toast notifications**
6. **Add new route in App.tsx**

### Code Patterns

#### 1. Page Component Pattern

**Example from `ChatPage.tsx`:**
```typescript
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { chatApi } from '@/services/chatApi';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import logger from '@/utils/logger';

interface Message {
  id: string;
  content: string;
  sender: 'customer' | 'agent';
  timestamp: Date;
}

export function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { currentWorkspace } = useWorkspace();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (sessionId && currentWorkspace) {
      loadMessages();
    }
  }, [sessionId, currentWorkspace]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await chatApi.getMessages(
        currentWorkspace!.id,
        sessionId!
      );
      setMessages(data);
    } catch (error) {
      logger.error('Failed to load messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    try {
      await chatApi.sendMessage(currentWorkspace!.id, sessionId!, {
        content: inputValue
      });
      setInputValue('');
      await loadMessages(); // Reload to show new message
      toast.success('Message sent');
    } catch (error) {
      logger.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`mb-4 ${
              message.sender === 'customer' ? 'text-right' : 'text-left'
            }`}
          >
            <div className="inline-block p-3 rounded-lg bg-gray-100">
              {message.content}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
        />
        <Button onClick={sendMessage}>Send</Button>
      </div>
    </div>
  );
}
```

**Key Points:**
- ✅ TypeScript interfaces for state
- ✅ `useWorkspace()` hook for workspace context
- ✅ API integration with try-catch
- ✅ Loading states
- ✅ Error handling with toast
- ✅ shadcn/ui components
- ✅ English-only UI text

#### 2. API Service Pattern

**Example from `services/api.ts`:**
```typescript
import axios from 'axios';
import { toast } from '@/lib/toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const sessionId = localStorage.getItem('sessionId');
    const workspaceId = localStorage.getItem('currentWorkspaceId');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (sessionId) {
      config.headers['x-session-id'] = sessionId;
    }
    if (workspaceId) {
      config.headers['x-workspace-id'] = workspaceId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Product API
export const productApi = {
  async getAll(workspaceId: string) {
    const { data } = await api.get(`/api/workspaces/${workspaceId}/products`);
    return data;
  },

  async getById(workspaceId: string, productId: string) {
    const { data } = await api.get(
      `/api/workspaces/${workspaceId}/products/${productId}`
    );
    return data;
  },

  async create(workspaceId: string, productData: any) {
    const { data } = await api.post(
      `/api/workspaces/${workspaceId}/products`,
      productData
    );
    return data;
  },

  async update(workspaceId: string, productId: string, productData: any) {
    const { data } = await api.put(
      `/api/workspaces/${workspaceId}/products/${productId}`,
      productData
    );
    return data;
  },

  async delete(workspaceId: string, productId: string) {
    const { data } = await api.delete(
      `/api/workspaces/${workspaceId}/products/${productId}`
    );
    return data;
  }
};
```

**Key Points:**
- ✅ Axios interceptors for token/headers
- ✅ Automatic 401 redirect
- ✅ Workspace ID in headers
- ✅ Typed API methods
- ✅ Consistent error handling

#### 3. React Context Pattern

**Example from `WorkspaceContext.tsx`:**
```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { workspaceApi } from '@/services/workspaceApi';
import logger from '@/utils/logger';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  type: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  setCurrentWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const data = await workspaceApi.getAll();
      setWorkspaces(data);

      // Set current workspace from localStorage or first one
      const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
      const workspace =
        data.find((w: Workspace) => w.id === savedWorkspaceId) || data[0];

      if (workspace) {
        setCurrentWorkspace(workspace);
        localStorage.setItem('currentWorkspaceId', workspace.id);
      }
    } catch (error) {
      logger.error('Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetCurrentWorkspace = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem('currentWorkspaceId', workspace.id);
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        loading,
        setCurrentWorkspace: handleSetCurrentWorkspace,
        refreshWorkspaces: loadWorkspaces
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return context;
}
```

**Key Points:**
- ✅ TypeScript interfaces for context
- ✅ Custom hook for consumption
- ✅ localStorage persistence
- ✅ Loading states
- ✅ Error handling

#### 4. Form with shadcn/ui Sheet Panel

**Example pattern:**
```typescript
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';
import { productApi } from '@/services/productApi';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function ProductEditSheet({ product, onSave }: { product: any; onSave: () => void }) {
  const { currentWorkspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: product.name,
    price: product.price,
    description: product.description
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await productApi.update(currentWorkspace!.id, product.id, formData);
      toast.success('Product updated successfully');
      setIsOpen(false);
      onSave();
    } catch (error) {
      toast.error('Failed to update product');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">Edit Product</Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[600px]">
        <SheetHeader>
          <SheetTitle>Edit Product</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">Product Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter product name"
              required
            />
          </div>

          <div>
            <Label htmlFor="price">Price (€)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) =>
                setFormData({ ...formData, price: parseFloat(e.target.value) })
              }
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Enter description"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

**Key Points:**
- ✅ Sheet panel slides from right
- ✅ Form state management
- ✅ shadcn/ui form components
- ✅ Toast notifications
- ✅ Callback on save

### Checklist for New Page

When creating a new page component:

- [ ] **TypeScript interfaces** defined for state/props
- [ ] **useWorkspace hook** used for workspace context
- [ ] **API integration** with try-catch error handling
- [ ] **Loading states** implemented
- [ ] **Error handling** with toast notifications
- [ ] **shadcn/ui components** used consistently
- [ ] **English-only UI text** (no Italian/Spanish)
- [ ] **Responsive design** (mobile-friendly)
- [ ] **Route added** in `App.tsx`
- [ ] **Navigation link** added to sidebar if needed

---

## 3. SCHEDULER AGENT

### Scope
Development of cron jobs, batch processing tasks, automated operations, and background jobs.

### Architecture Knowledge Required

**Scheduler Structure:**
```
scheduler/src/
├── jobs/              # Individual cron job implementations
├── utils/             # Shared utilities (batch processor, lock manager)
├── config/            # Configuration and environment
└── index.ts           # Job runner and scheduler setup
```

**Key Concepts:**
- Cron syntax for scheduling
- Batch processing pattern (BATCH_SIZE)
- Transaction safety for atomic operations
- Lock mechanisms for concurrency control
- Job status tracking in database
- Error handling and retry logic

### Common Tasks

1. **Create new cron job**
2. **Implement batch processing**
3. **Add job to scheduler**
4. **Debug job execution**
5. **Monitor job status**
6. **Handle failed jobs**

### Code Patterns

#### 1. Job Structure Template

**Basic job structure:**
```typescript
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

export async function myJob() {
  const startTime = Date.now();
  logger.info('[MY_JOB] Starting job execution');

  try {
    // Update job status to RUNNING
    await prisma.schedulerJobStatus.update({
      where: { jobName: 'MY_JOB' },
      data: {
        status: 'RUNNING',
        lastStartedAt: new Date(),
        errorMessage: null
      }
    });

    // Main job logic here
    await executeJobLogic();

    // Update job status to COMPLETED
    const duration = Date.now() - startTime;
    await prisma.schedulerJobStatus.update({
      where: { jobName: 'MY_JOB' },
      data: {
        status: 'IDLE',
        lastCompletedAt: new Date(),
        lastDuration: duration
      }
    });

    logger.info(`[MY_JOB] Completed successfully in ${duration}ms`);
  } catch (error) {
    logger.error('[MY_JOB] Failed:', error);

    // Update job status to FAILED
    await prisma.schedulerJobStatus.update({
      where: { jobName: 'MY_JOB' },
      data: {
        status: 'FAILED',
        errorMessage: error.message
      }
    });

    throw error;
  }
}

async function executeJobLogic() {
  // Implement job-specific logic
}
```

**Key Points:**
- ✅ Status tracking (IDLE → RUNNING → COMPLETED/FAILED)
- ✅ Duration measurement
- ✅ Error handling with status update
- ✅ Structured logging with job prefix

#### 2. Batch Processing Pattern

**Example from `messages-archive.job.ts`:**
```typescript
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();
const BATCH_SIZE = 500;
const ARCHIVE_AFTER_DAYS = 180; // 6 months

export async function messagesArchiveJob() {
  logger.info('[MESSAGES_ARCHIVE] Starting job');

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_AFTER_DAYS);

    let totalArchived = 0;
    let hasMore = true;

    while (hasMore) {
      // Fetch batch of old messages
      const messages = await prisma.message.findMany({
        where: {
          createdAt: { lt: cutoffDate },
          deletedAt: null
        },
        take: BATCH_SIZE,
        orderBy: { createdAt: 'asc' }
      });

      if (messages.length === 0) {
        hasMore = false;
        break;
      }

      // Archive batch in transaction
      await prisma.$transaction(async (tx) => {
        // 1. Copy to archive
        await tx.messageArchive.createMany({
          data: messages.map(msg => ({
            id: msg.id,
            workspaceId: msg.workspaceId,
            sessionId: msg.sessionId,
            content: msg.content,
            sender: msg.sender,
            createdAt: msg.createdAt,
            archivedAt: new Date()
          }))
        });

        // 2. Delete from main table
        await tx.message.deleteMany({
          where: {
            id: { in: messages.map(m => m.id) }
          }
        });
      });

      totalArchived += messages.length;
      logger.info(
        `[MESSAGES_ARCHIVE] Archived batch of ${messages.length} messages (total: ${totalArchived})`
      );

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info(`[MESSAGES_ARCHIVE] Completed. Total archived: ${totalArchived}`);
  } catch (error) {
    logger.error('[MESSAGES_ARCHIVE] Failed:', error);
    throw error;
  }
}
```

**Key Points:**
- ✅ Batch size limit (avoid memory issues)
- ✅ Loop with `hasMore` flag
- ✅ Transaction for atomicity
- ✅ Progress logging
- ✅ Small delay between batches

#### 3. Transaction Safety Pattern

**Example from `monthly-billing.job.ts`:**
```typescript
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export async function monthlyBillingJob() {
  logger.info('[MONTHLY_BILLING] Starting job');

  try {
    // Get all active workspaces
    const workspaces = await prisma.workspace.findMany({
      where: {
        isActive: true,
        deletedAt: null
      },
      include: {
        owner: true,
        subscription: true
      }
    });

    logger.info(`[MONTHLY_BILLING] Processing ${workspaces.length} workspaces`);

    for (const workspace of workspaces) {
      try {
        await processWorkspaceBilling(workspace);
      } catch (error) {
        logger.error(
          `[MONTHLY_BILLING] Failed for workspace ${workspace.id}:`,
          error
        );
        // Continue with other workspaces even if one fails
      }
    }

    logger.info('[MONTHLY_BILLING] Completed');
  } catch (error) {
    logger.error('[MONTHLY_BILLING] Failed:', error);
    throw error;
  }
}

async function processWorkspaceBilling(workspace: any) {
  return await prisma.$transaction(async (tx) => {
    // 1. Calculate charges
    const subscriptionFee = workspace.subscription?.monthlyFee || 0;
    const messageCount = await tx.message.count({
      where: {
        workspaceId: workspace.id,
        createdAt: {
          gte: getMonthStartDate(),
          lt: getMonthEndDate()
        }
      }
    });
    const messageFee = messageCount * 0.10; // €0.10 per message
    const totalCharge = subscriptionFee + messageFee;

    // 2. Create invoice
    const invoice = await tx.monthlyInvoice.create({
      data: {
        workspaceId: workspace.id,
        ownerId: workspace.ownerId,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        subscriptionFee,
        messageCount,
        messageFee,
        totalAmount: totalCharge,
        status: 'PENDING'
      }
    });

    // 3. Deduct from credit balance
    await tx.user.update({
      where: { id: workspace.ownerId },
      data: {
        creditBalance: {
          decrement: totalCharge
        }
      }
    });

    // 4. Create billing transaction
    await tx.billingTransaction.create({
      data: {
        userId: workspace.ownerId,
        type: 'CHARGE',
        amount: totalCharge,
        description: `Monthly bill for ${workspace.name}`,
        invoiceId: invoice.id
      }
    });

    logger.info(
      `[MONTHLY_BILLING] Processed workspace ${workspace.id}: €${totalCharge.toFixed(2)}`
    );

    return invoice;
  });
}

function getMonthStartDate() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEndDate() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}
```

**Key Points:**
- ✅ Transaction wraps ALL DB operations
- ✅ Rollback on error (automatic with transaction)
- ✅ Individual workspace error handling
- ✅ Detailed logging per workspace

#### 4. Lock Mechanism Pattern

**Example from `whatsapp-channel-queue.job.ts`:**
```typescript
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();
const COOLDOWN_SECONDS = 6;
const processing = new Set<string>(); // In-memory lock

export async function whatsappChannelQueueJob() {
  logger.info('[WHATSAPP_QUEUE] Starting job');

  try {
    // Get pending messages
    const messages = await prisma.whatsAppQueue.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: new Date() }
      },
      take: 50,
      orderBy: { scheduledAt: 'asc' }
    });

    logger.info(`[WHATSAPP_QUEUE] Found ${messages.length} pending messages`);

    for (const message of messages) {
      // Skip if already processing (in-memory lock)
      if (processing.has(message.id)) {
        logger.warn(`[WHATSAPP_QUEUE] Message ${message.id} already processing`);
        continue;
      }

      // Acquire lock
      processing.add(message.id);

      try {
        await processMessage(message);
      } finally {
        // Release lock
        processing.delete(message.id);
      }

      // Cooldown between messages
      await new Promise(resolve => setTimeout(resolve, COOLDOWN_SECONDS * 1000));
    }

    logger.info('[WHATSAPP_QUEUE] Completed');
  } catch (error) {
    logger.error('[WHATSAPP_QUEUE] Failed:', error);
    throw error;
  }
}

async function processMessage(message: any) {
  try {
    // Update status to PROCESSING
    await prisma.whatsAppQueue.update({
      where: { id: message.id },
      data: { status: 'PROCESSING' }
    });

    // Send via WhatsApp provider
    await sendWhatsAppMessage(message);

    // Update status to SENT
    await prisma.whatsAppQueue.update({
      where: { id: message.id },
      data: {
        status: 'SENT',
        sentAt: new Date()
      }
    });

    logger.info(`[WHATSAPP_QUEUE] Sent message ${message.id}`);
  } catch (error) {
    logger.error(`[WHATSAPP_QUEUE] Failed to send message ${message.id}:`, error);

    // Update status to FAILED
    await prisma.whatsAppQueue.update({
      where: { id: message.id },
      data: {
        status: 'FAILED',
        errorMessage: error.message
      }
    });
  }
}

async function sendWhatsAppMessage(message: any) {
  // WhatsApp provider integration
}
```

**Key Points:**
- ✅ In-memory Set for lock tracking
- ✅ Lock acquired before processing
- ✅ Lock released in `finally` block
- ✅ Cooldown between messages
- ✅ Status tracking (PENDING → PROCESSING → SENT/FAILED)

### Checklist for New Job

When creating a new cron job:

- [ ] **File created** in `/apps/scheduler/src/jobs/`
- [ ] **Exported** in `jobs/index.ts`
- [ ] **Registered** in `scheduler/index.ts` with cron syntax
- [ ] **Added to SchedulerJobStatus** table in database
- [ ] **Batch processing** implemented if dealing with large datasets
- [ ] **Transaction safety** for multi-step operations
- [ ] **Status tracking** (IDLE/RUNNING/COMPLETED/FAILED)
- [ ] **Error handling** with try-catch and status update
- [ ] **Logging** with structured format `[JOB_NAME]`
- [ ] **Tested locally** before deploying

### Complete Example: New Job

**Task**: Create job to cleanup expired tokens every hour

**Step 1: Create Job File**
```typescript
// apps/scheduler/src/jobs/token-cleanup.job.ts
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

export async function tokenCleanupJob() {
  const startTime = Date.now();
  logger.info('[TOKEN_CLEANUP] Starting job');

  try {
    // Update job status
    await prisma.schedulerJobStatus.update({
      where: { jobName: 'TOKEN_CLEANUP' },
      data: {
        status: 'RUNNING',
        lastStartedAt: new Date()
      }
    });

    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      // Find expired tokens
      const tokens = await prisma.secureToken.findMany({
        where: {
          expiresAt: { lt: new Date() }
        },
        take: BATCH_SIZE
      });

      if (tokens.length === 0) {
        hasMore = false;
        break;
      }

      // Delete batch
      await prisma.secureToken.deleteMany({
        where: {
          id: { in: tokens.map(t => t.id) }
        }
      });

      totalDeleted += tokens.length;
      logger.info(
        `[TOKEN_CLEANUP] Deleted batch of ${tokens.length} tokens (total: ${totalDeleted})`
      );
    }

    // Update job status
    const duration = Date.now() - startTime;
    await prisma.schedulerJobStatus.update({
      where: { jobName: 'TOKEN_CLEANUP' },
      data: {
        status: 'IDLE',
        lastCompletedAt: new Date(),
        lastDuration: duration
      }
    });

    logger.info(
      `[TOKEN_CLEANUP] Completed. Deleted ${totalDeleted} tokens in ${duration}ms`
    );
  } catch (error) {
    logger.error('[TOKEN_CLEANUP] Failed:', error);

    await prisma.schedulerJobStatus.update({
      where: { jobName: 'TOKEN_CLEANUP' },
      data: {
        status: 'FAILED',
        errorMessage: error.message
      }
    });

    throw error;
  }
}
```

**Step 2: Export in Index**
```typescript
// apps/scheduler/src/jobs/index.ts
export { tokenCleanupJob } from './token-cleanup.job';
```

**Step 3: Register in Scheduler**
```typescript
// apps/scheduler/src/index.ts
import { tokenCleanupJob } from './jobs';

// Run every hour
cron.schedule('0 * * * *', async () => {
  try {
    await tokenCleanupJob();
  } catch (error) {
    logger.error('Token cleanup job failed:', error);
  }
});
```

**Step 4: Add to Database**
```sql
INSERT INTO "SchedulerJobStatus" ("jobName", "status", "schedule")
VALUES ('TOKEN_CLEANUP', 'IDLE', '0 * * * *');
```

---

