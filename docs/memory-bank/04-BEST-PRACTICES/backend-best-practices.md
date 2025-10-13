# Backend Best Practices

> **ShopME Backend Development Standards**
>
> Clean Architecture / DDD Patterns | TypeScript | Node.js/Express | Prisma ORM

---

## 🎯 Core Principles

### 1. Database-First Architecture

**RULE**: NO hardcoded values, defaults, or fallbacks

```typescript
// ✅ GOOD: All config from database
const agentConfig = await prisma.agentConfig.findUnique({
  where: { workspaceId },
})
if (!agentConfig) {
  throw new Error("Agent configuration not found")
}
const prompt = agentConfig.systemPrompt

// ❌ BAD: Hardcoded fallback
const prompt = agentConfig?.systemPrompt || "Default prompt here..."
```

**Why?**

- Single source of truth (database)
- Dynamic configuration without redeployment
- Clear error handling for missing config
- Prevents prod/dev drift

### 2. Workspace Isolation (Multi-Tenancy)

**RULE**: EVERY database query MUST filter by `workspaceId`

```typescript
// ✅ GOOD: Workspace filtered
const products = await prisma.products.findMany({
  where: {
    workspaceId: workspaceId, // ← CRITICAL
    isActive: true,
    stock: { gt: 0 },
  },
})

// ❌ BAD: No workspace filter = SECURITY RISK
const products = await prisma.products.findMany({
  where: { isActive: true }, // ← Data leak across tenants!
})
```

**Pattern in Controllers**:

```typescript
async getProducts(req: Request, res: Response) {
  const workspaceId = (req as any).workspaceId // Set by middleware
  const userId = (req as any).user.id // Set by authMiddleware

  const products = await this.productService.findAll(workspaceId)
  return res.json(products)
}
```

### 3. Error Handling

**RULE**: Always log full error details, return user-friendly messages

```typescript
try {
  const order = await this.createOrder(data)
  return res.status(201).json(order)
} catch (error) {
  // ✅ GOOD: Full error context in logs
  logger.error("Failed to create order:", {
    error: error.message,
    stack: error.stack,
    data: data,
    workspaceId: req.workspaceId,
  })

  // User-friendly error response
  return res.status(500).json({
    error: "Failed to create order",
    message: error.message,
  })
}
```

**DON'T**:

- Swallow errors silently
- Return stack traces to clients (security risk)
- Use generic catch blocks without logging

---

## 🏗️ Architecture Patterns

### Clean Architecture / DDD Structure

```
backend/src/
├── application/services/    # Business logic orchestration
│   └── order.service.ts     # Example: Complex business rules
├── domain/                  # Core entities, value objects
│   ├── entities/            # Business entities
│   └── value-objects/       # Immutable domain objects
├── repositories/            # Database access layer (Prisma)
│   └── order.repository.ts  # CRUD + complex queries
├── interfaces/http/         # HTTP layer (Express)
│   ├── controllers/         # Request/response handling
│   │   └── order.controller.ts
│   ├── routes/              # Route definitions
│   │   └── orders.routes.ts
│   └── middlewares/         # Request processing
│       ├── auth.middleware.ts
│       └── workspace-validation.middleware.ts
├── services/                # External integrations
│   ├── llm.service.ts       # OpenRouter integration
│   ├── whatsapp.service.ts  # WhatsApp API
│   └── email.service.ts     # Email provider
└── utils/                   # Shared helpers
    ├── logger.ts            # Winston logger
    └── formatter.ts         # Data formatters
```

### Layer Responsibilities

#### Controllers (Interface Layer)

**Purpose**: Handle HTTP requests/responses, validation

```typescript
export class OrderController {
  constructor(private orderService: OrderService) {}

  async createOrder(req: Request, res: Response) {
    try {
      // 1. Extract data
      const workspaceId = (req as any).workspaceId
      const orderData = req.body

      // 2. Validate (using Zod)
      const validated = createOrderSchema.parse(orderData)

      // 3. Delegate to service
      const order = await this.orderService.create(workspaceId, validated)

      // 4. Return response
      return res.status(201).json({ data: order })
    } catch (error) {
      logger.error("Order creation failed:", error)
      return res.status(500).json({ error: error.message })
    }
  }
}
```

**Rules**:

- NO business logic in controllers
- Always validate input (Zod schemas)
- Delegate to services for business rules
- Handle errors and return proper HTTP status codes

#### Services (Application Layer)

**Purpose**: Business logic orchestration, cross-entity operations

```typescript
export class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private productRepo: ProductRepository,
    private customerRepo: CustomerRepository
  ) {}

  async create(workspaceId: string, data: CreateOrderDto) {
    // 1. Business validation
    const customer = await this.customerRepo.findById(
      data.customerId,
      workspaceId
    )
    if (!customer) throw new Error("Customer not found")

    // 2. Check product availability
    const products = await this.productRepo.findByIds(
      data.productIds,
      workspaceId
    )
    for (const product of products) {
      if (product.stock < data.quantities[product.id]) {
        throw new Error(`Insufficient stock for ${product.name}`)
      }
    }

    // 3. Calculate totals
    const subtotal = this.calculateSubtotal(products, data.quantities)
    const discount = (customer.discount / 100) * subtotal
    const total = subtotal - discount

    // 4. Create order (transaction)
    const order = await this.orderRepo.create({
      workspaceId,
      customerId: customer.id,
      items: data.productIds.map((id) => ({
        productId: id,
        quantity: data.quantities[id],
      })),
      subtotal,
      discount,
      total,
      status: OrderStatus.PENDING,
    })

    // 5. Update stock
    await this.productRepo.decrementStock(products, data.quantities)

    return order
  }
}
```

**Rules**:

- Coordinate multiple repositories
- Implement business rules
- Handle transactions
- NO HTTP concerns (req/res)

#### Repositories (Data Layer)

**Purpose**: Database access, queries

```typescript
export class OrderRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateOrderData) {
    return await this.prisma.orders.create({
      data: {
        workspaceId: data.workspaceId,
        customerId: data.customerId,
        status: data.status,
        subtotal: data.subtotal,
        discount: data.discount,
        total: data.total,
        items: {
          create: data.items,
        },
      },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
      },
    })
  }

  async findByWorkspace(workspaceId: string, filters?: OrderFilters) {
    return await this.prisma.orders.findMany({
      where: {
        workspaceId, // ← ALWAYS filter by workspace
        ...(filters?.status && { status: filters.status }),
        ...(filters?.customerId && { customerId: filters.customerId }),
      },
      include: {
        customer: true,
        items: true,
      },
      orderBy: { createdAt: "desc" },
    })
  }
}
```

**Rules**:

- Only Prisma calls here
- Always filter by `workspaceId`
- NO business logic
- Return domain entities, not raw Prisma objects

---

## 🔐 Security Best Practices

### 1. Authentication Flow

```typescript
// auth.middleware.ts
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "")
    if (!token) {
      return res.status(401).json({ error: "Missing authentication token" })
    }

    const decoded = (jwt.verify(
      token,
      process.env.JWT_SECRET!
    )(req as any).user = decoded)
    next()
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" })
  }
}

// workspace-validation.middleware.ts
export const workspaceValidationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const workspaceId = req.params.workspaceId || req.body.workspaceId
  const user = (req as any).user

  // Verify user has access to workspace
  const hasAccess = await checkWorkspaceAccess(user.id, workspaceId)
  if (!hasAccess) {
    return res.status(403).json({ error: "Workspace access denied" })
  }

  ;(req as any).workspaceId = workspaceId
  next()
}
```

### 2. Input Validation (Zod)

```typescript
import { z } from "zod"

const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  productIds: z.array(z.string().uuid()).min(1),
  quantities: z.record(z.string().uuid(), z.number().int().positive()),
  shippingAddress: z.string().min(10).max(500),
})

// In controller
try {
  const validated = createOrderSchema.parse(req.body)
  // proceed with validated data
} catch (error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: error.errors,
    })
  }
}
```

### 3. Rate Limiting

```typescript
// hard-rate-limit.middleware.ts
import rateLimit from "express-rate-limit"

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
})

// whatsapp-rate-limit.middleware.ts
export const whatsappRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 messages per minute per customer
  keyGenerator: (req) => req.body.from, // Rate limit by phone number
  message: "Too many messages, please slow down",
})
```

---

## 📝 Naming Conventions

### Controllers

```typescript
// ✅ GOOD: HTTP verb-based
class ProductController {
  getProducts() // GET /products
  getProductById() // GET /products/:id
  createProduct() // POST /products
  updateProduct() // PUT /products/:id
  deleteProduct() // DELETE /products/:id
}

// ❌ BAD: Generic names
class ProductController {
  list()
  find()
  add()
  modify()
  remove()
}
```

### Services

```typescript
// ✅ GOOD: Business action-based
class OrderService {
  processPayment()
  calculateTotal()
  sendConfirmationEmail()
  updateStatus()
}

// ❌ BAD: CRUD-focused
class OrderService {
  getOrder()
  createOrder()
  updateOrder()
  deleteOrder()
}
```

### Routes

```typescript
// ✅ GOOD: RESTful with workspace scoping
router.get("/workspaces/:workspaceId/products", productController.getProducts)
router.post("/workspaces/:workspaceId/orders", orderController.createOrder)

// ❌ BAD: No workspace isolation
router.get("/products", productController.getProducts)
router.post("/orders", orderController.createOrder)
```

---

## 🧪 Testing Standards

### Unit Tests

```typescript
describe("OrderService", () => {
  let orderService: OrderService
  let mockOrderRepo: jest.Mocked<OrderRepository>
  let mockProductRepo: jest.Mocked<ProductRepository>

  beforeEach(() => {
    mockOrderRepo = {
      create: jest.fn(),
      findById: jest.fn(),
    } as any

    mockProductRepo = {
      findByIds: jest.fn(),
      decrementStock: jest.fn(),
    } as any

    orderService = new OrderService(mockOrderRepo, mockProductRepo)
  })

  it("should create order with correct total", async () => {
    // Arrange
    const workspaceId = "workspace-123"
    const orderData = {
      /* test data */
    }
    mockProductRepo.findByIds.mockResolvedValue([
      /* products */
    ])

    // Act
    const result = await orderService.create(workspaceId, orderData)

    // Assert
    expect(result.total).toBe(expectedTotal)
    expect(mockOrderRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId })
    )
  })

  it("should throw error if product out of stock", async () => {
    // Arrange
    mockProductRepo.findByIds.mockResolvedValue([
      { id: "1", stock: 0, name: "Product A" },
    ])

    // Act & Assert
    await expect(orderService.create(workspaceId, orderData)).rejects.toThrow(
      "Insufficient stock for Product A"
    )
  })
})
```

### Integration Tests

```typescript
describe("Orders API", () => {
  let authToken: string
  let workspaceId: string

  beforeAll(async () => {
    // Setup test database
    await setupTestDB()

    // Get auth token
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@test.com", password: "password" })
    authToken = loginRes.body.token
    workspaceId = loginRes.body.workspace.id
  })

  it("should create order with valid data", async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/orders`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        customerId: "customer-123",
        productIds: ["product-1", "product-2"],
        quantities: { "product-1": 2, "product-2": 1 },
      })

    expect(res.status).toBe(201)
    expect(res.body.data).toHaveProperty("id")
    expect(res.body.data.status).toBe("PENDING")
  })

  it("should reject order without authentication", async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/orders`)
      .send({
        /* data */
      })

    expect(res.status).toBe(401)
  })
})
```

---

## 🚫 Anti-Patterns to Avoid

### ❌ God Objects

```typescript
// ❌ BAD: One service doing everything
class ApplicationService {
  createOrder() {}
  processPayment() {}
  sendEmail() {}
  generateInvoice() {}
  updateInventory() {}
  calculateTaxes() {}
}

// ✅ GOOD: Separate concerns
class OrderService {
  createOrder()
}
class PaymentService {
  processPayment()
}
class EmailService {
  sendEmail()
}
class InvoiceService {
  generateInvoice()
}
```

### ❌ Anemic Domain Model

```typescript
// ❌ BAD: Entities are just data bags
class Order {
  id: string
  total: number
  status: string
}

// Business logic in service
orderService.calculateTotal(order)
orderService.validateOrder(order)

// ✅ GOOD: Entities have behavior
class Order {
  id: string
  private total: number
  private status: OrderStatus

  calculateTotal(items: OrderItem[], discount: number): void {
    this.total = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )
    this.total -= discount
  }

  canBeCancelled(): boolean {
    return this.status === OrderStatus.PENDING
  }
}
```

### ❌ Magic Numbers/Strings

```typescript
// ❌ BAD
if (order.status === "pending") {
}
if (customer.discount > 50) {
}

// ✅ GOOD
enum OrderStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
}

const MAX_DISCOUNT_PERCENTAGE = 50

if (order.status === OrderStatus.PENDING) {
}
if (customer.discount > MAX_DISCOUNT_PERCENTAGE) {
}
```

---

## 🛠️ Development Workflow

### 1. Adding New Feature

```bash
# 1. Create feature branch
git checkout -b feature/add-payment-gateway

# 2. Create domain entities
touch src/domain/entities/payment.entity.ts

# 3. Create repository
touch src/repositories/payment.repository.ts

# 4. Create service
touch src/application/services/payment.service.ts

# 5. Create controller
touch src/interfaces/http/controllers/payment.controller.ts

# 6. Create routes
touch src/interfaces/http/routes/payment.routes.ts

# 7. Write tests
touch src/__tests__/unit/payment.service.spec.ts
touch src/__tests__/integration/payment.api.spec.ts

# 8. Run tests
npm run test:unit
npm run test:coverage

# 9. Update Swagger docs
# Add JSDoc comments with @swagger tags

# 10. Commit
git add .
git commit -m "feat: add payment gateway integration"
```

### 2. Modifying Database Schema

```bash
# 1. Edit schema
vim prisma/schema.prisma

# 2. Create migration
npx prisma migrate dev --name add_payment_table

# 3. Generate Prisma client
npx prisma generate

# 4. Update seed if needed
vim prisma/seed.ts

# 5. Test migration
npm run seed
npm run test:unit
```

### 3. Code Review Checklist

- [ ] Workspace isolation applied (`workspaceId` filter)
- [ ] No hardcoded values (all from database)
- [ ] Proper error handling with logging
- [ ] Input validation (Zod schemas)
- [ ] Unit tests written and passing
- [ ] Integration tests if API changed
- [ ] Swagger docs updated
- [ ] TypeScript strict mode passes
- [ ] ESLint/Prettier applied
- [ ] Security review (auth, rate limiting)

---

## 📚 Additional Resources

- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

---

**Last Updated**: October 14, 2025  
**Maintained by**: Andrea (gelsogrove)
