# Unit Testing Guide

> **Complete guide to writing unit tests in ShopME**
>
> Jest | React Testing Library | Vitest | TypeScript

---

## 🎯 Testing Philosophy

### Test Pyramid

```
        ┌────────┐
        │   E2E  │  ← Few, critical user flows
        ├────────┤
        │ Integr │  ← API endpoints, database
        ├────────┤
        │  Unit  │  ← Most tests here (services, utilities)
        └────────┘
```

**Distribution**:

- **70%** Unit tests (fast, isolated)
- **20%** Integration tests (API + DB)
- **10%** E2E tests (critical paths only)

### What to Test

✅ **DO Test**:

- Business logic (services)
- Data transformations (utilities)
- Complex algorithms
- Edge cases and error handling
- Security-critical functions

❌ **DON'T Test**:

- Third-party libraries
- Framework code (React, Express)
- Simple getters/setters
- Auto-generated code (Prisma)

---

## 🔧 Backend Testing (Jest)

### Setup

**jest.config.js**:

```javascript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.ts", "**/*.spec.ts", "**/*.test.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.interface.ts",
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
  },
}
```

### Test Structure

```typescript
describe("Feature/Component Name", () => {
  describe("Method/Function Name", () => {
    it("should do expected behavior", () => {
      // Arrange: Setup
      // Act: Execute
      // Assert: Verify
    })
  })
})
```

### Example: Service Test

```typescript
// order.service.spec.ts
import { OrderService } from "../order.service"
import { OrderRepository } from "../../repositories/order.repository"
import { ProductRepository } from "../../repositories/product.repository"

describe("OrderService", () => {
  let orderService: OrderService
  let mockOrderRepo: jest.Mocked<OrderRepository>
  let mockProductRepo: jest.Mocked<ProductRepository>

  beforeEach(() => {
    // Create mocks
    mockOrderRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByWorkspace: jest.fn(),
    } as any

    mockProductRepo = {
      findByIds: jest.fn(),
      decrementStock: jest.fn(),
    } as any

    // Inject mocks
    orderService = new OrderService(mockOrderRepo, mockProductRepo)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("create", () => {
    it("should create order with correct total", async () => {
      // Arrange
      const workspaceId = "workspace-123"
      const orderData = {
        customerId: "customer-1",
        productIds: ["product-1", "product-2"],
        quantities: { "product-1": 2, "product-2": 1 },
      }

      const mockProducts = [
        { id: "product-1", price: 10, stock: 100, name: "Product A" },
        { id: "product-2", price: 20, stock: 50, name: "Product B" },
      ]

      mockProductRepo.findByIds.mockResolvedValue(mockProducts)
      mockOrderRepo.create.mockResolvedValue({
        id: "order-1",
        total: 40,
        status: "PENDING",
      } as any)

      // Act
      const result = await orderService.create(workspaceId, orderData)

      // Assert
      expect(result.total).toBe(40) // (10*2) + (20*1)
      expect(mockOrderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          customerId: "customer-1",
          total: 40,
        })
      )
      expect(mockProductRepo.decrementStock).toHaveBeenCalledWith(
        mockProducts,
        orderData.quantities
      )
    })

    it("should throw error if product out of stock", async () => {
      // Arrange
      const orderData = {
        customerId: "customer-1",
        productIds: ["product-1"],
        quantities: { "product-1": 10 },
      }

      mockProductRepo.findByIds.mockResolvedValue([
        { id: "product-1", price: 10, stock: 5, name: "Product A" },
      ])

      // Act & Assert
      await expect(
        orderService.create("workspace-123", orderData)
      ).rejects.toThrow("Insufficient stock for Product A")
    })

    it("should apply customer discount", async () => {
      // Arrange
      const orderData = {
        customerId: "customer-1",
        productIds: ["product-1"],
        quantities: { "product-1": 1 },
      }

      mockProductRepo.findByIds.mockResolvedValue([
        { id: "product-1", price: 100, stock: 10, name: "Product A" },
      ])

      const mockCustomer = { id: "customer-1", discount: 10 } // 10% discount

      mockOrderRepo.create.mockResolvedValue({
        id: "order-1",
        subtotal: 100,
        discount: 10,
        total: 90,
        status: "PENDING",
      } as any)

      // Act
      const result = await orderService.create("workspace-123", orderData)

      // Assert
      expect(result.subtotal).toBe(100)
      expect(result.discount).toBe(10)
      expect(result.total).toBe(90)
    })
  })

  describe("calculateTotal", () => {
    it("should calculate total correctly", () => {
      const products = [
        { id: "1", price: 10 },
        { id: "2", price: 20 },
      ]
      const quantities = { "1": 2, "2": 3 }

      const total = orderService.calculateTotal(products, quantities)

      expect(total).toBe(80) // (10*2) + (20*3)
    })

    it("should return 0 for empty order", () => {
      const total = orderService.calculateTotal([], {})
      expect(total).toBe(0)
    })
  })
})
```

### Example: Utility Test

```typescript
// formatters.spec.ts
import { formatCurrency, formatDate, truncateText } from "../formatters"

describe("Formatters", () => {
  describe("formatCurrency", () => {
    it("should format number as EUR currency", () => {
      expect(formatCurrency(100)).toBe("€100.00")
      expect(formatCurrency(99.99)).toBe("€99.99")
      expect(formatCurrency(0)).toBe("€0.00")
    })

    it("should handle negative numbers", () => {
      expect(formatCurrency(-50)).toBe("-€50.00")
    })

    it("should round to 2 decimal places", () => {
      expect(formatCurrency(99.999)).toBe("€100.00")
      expect(formatCurrency(99.994)).toBe("€99.99")
    })
  })

  describe("formatDate", () => {
    it("should format date in DD/MM/YYYY format", () => {
      const date = new Date("2025-10-14T10:00:00Z")
      expect(formatDate(date)).toBe("14/10/2025")
    })

    it("should handle string input", () => {
      expect(formatDate("2025-10-14")).toBe("14/10/2025")
    })
  })

  describe("truncateText", () => {
    it("should truncate long text", () => {
      const text = "This is a very long text that should be truncated"
      expect(truncateText(text, 20)).toBe("This is a very long...")
    })

    it("should not truncate short text", () => {
      const text = "Short text"
      expect(truncateText(text, 20)).toBe("Short text")
    })

    it("should handle empty string", () => {
      expect(truncateText("", 10)).toBe("")
    })
  })
})
```

### Mocking External Dependencies

#### Mock Prisma

```typescript
// __mocks__/@prisma/client.ts
export const PrismaClient = jest.fn().mockImplementation(() => ({
  products: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  orders: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
}))
```

#### Mock External API

```typescript
// Mock OpenRouter API
jest.mock("node-fetch", () => jest.fn())

import fetch from "node-fetch"
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

it("should call OpenRouter API", async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: "AI response" } }],
    }),
  } as any)

  const result = await llmService.generateResponse("Hello")

  expect(mockFetch).toHaveBeenCalledWith(
    "https://openrouter.ai/api/v1/chat/completions",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: expect.stringContaining("Bearer"),
      }),
    })
  )
  expect(result).toBe("AI response")
})
```

#### Mock Environment Variables

```typescript
describe("with OPENROUTER_API_KEY", () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv, OPENROUTER_API_KEY: "test-key" }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("should use API key from environment", () => {
    expect(process.env.OPENROUTER_API_KEY).toBe("test-key")
  })
})
```

---

## 🎨 Frontend Testing (Vitest + React Testing Library)

### Setup

**vitest.config.ts**:

```typescript
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
})
```

### Component Testing

```typescript
// ProductCard.test.tsx
import { render, screen, fireEvent } from "@testing-library/react"
import { ProductCard } from "./ProductCard"

describe("ProductCard", () => {
  const mockProduct = {
    id: "1",
    name: "Test Product",
    price: 99.99,
    stock: 10,
    imageUrl: "/images/product.jpg",
  }

  it("renders product information", () => {
    render(<ProductCard product={mockProduct} />)

    expect(screen.getByText("Test Product")).toBeInTheDocument()
    expect(screen.getByText("€99.99")).toBeInTheDocument()
    expect(screen.getByText(/Stock: 10/i)).toBeInTheDocument()
  })

  it("renders product image with correct alt text", () => {
    render(<ProductCard product={mockProduct} />)

    const image = screen.getByAltText("Test Product")
    expect(image).toHaveAttribute("src", "/images/product.jpg")
  })

  it("calls onAddToCart when button clicked", () => {
    const onAddToCart = jest.fn()
    render(<ProductCard product={mockProduct} onAddToCart={onAddToCart} />)

    const button = screen.getByRole("button", { name: /add to cart/i })
    fireEvent.click(button)

    expect(onAddToCart).toHaveBeenCalledWith(mockProduct.id)
    expect(onAddToCart).toHaveBeenCalledTimes(1)
  })

  it("disables button when out of stock", () => {
    const outOfStockProduct = { ...mockProduct, stock: 0 }
    render(<ProductCard product={outOfStockProduct} />)

    const button = screen.getByRole("button", { name: /add to cart/i })
    expect(button).toBeDisabled()
  })

  it("applies compact styling when compact prop is true", () => {
    const { container } = render(<ProductCard product={mockProduct} compact />)

    expect(container.firstChild).toHaveClass("compact")
  })
})
```

### Hook Testing

```typescript
// useAuth.test.ts
import { renderHook, act, waitFor } from "@testing-library/react"
import { useAuth } from "./useAuth"

describe("useAuth", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("should initialize with no user", () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it("should login successfully", async () => {
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.login("test@test.com", "password")
    })

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user).toEqual(
        expect.objectContaining({ email: "test@test.com" })
      )
    })
  })

  it("should logout and clear user", async () => {
    const { result } = renderHook(() => useAuth())

    // Login first
    await act(async () => {
      await result.current.login("test@test.com", "password")
    })

    // Then logout
    act(() => {
      result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorage.getItem("token")).toBeNull()
  })

  it("should throw error on failed login", async () => {
    const { result } = renderHook(() => useAuth())

    await expect(async () => {
      await act(async () => {
        await result.current.login("wrong@test.com", "wrong")
      })
    }).rejects.toThrow("Invalid credentials")
  })
})
```

### Testing with Context

```typescript
// Wrapper for tests that need context
import { AuthProvider } from "@/contexts/AuthContext"
import { WorkspaceProvider } from "@/contexts/WorkspaceContext"

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <AuthProvider>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </AuthProvider>
  )
}

const customRender = (ui: React.ReactElement, options = {}) =>
  render(ui, { wrapper: AllTheProviders, ...options })

// Usage
it("should display user name from context", () => {
  customRender(<UserProfile />)
  expect(screen.getByText("Andrea")).toBeInTheDocument()
})
```

### Async Testing

```typescript
it("should load products after mount", async () => {
  render(<ProductsList />)

  // Initially shows loading
  expect(screen.getByText(/loading/i)).toBeInTheDocument()

  // Wait for products to load
  await waitFor(() => {
    expect(screen.getByText("Product 1")).toBeInTheDocument()
  })

  // Loading should disappear
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
})
```

---

## 🔐 Security Testing

### Translation Security Test

```typescript
// translation-security.spec.ts
import { TranslationSecurityService } from "../services/translation-security.service"

describe("TranslationSecurityService", () => {
  let service: TranslationSecurityService

  beforeEach(() => {
    service = new TranslationSecurityService()
  })

  describe("Profanity Filtering", () => {
    it("should block Italian profanity", async () => {
      const result = await service.processAndTranslate(
        "Sei un cazzo",
        "it",
        "en"
      )

      expect(result.blocked).toBe(true)
      expect(result.reason).toBe("profanity")
      expect(result.output).toContain("Mi dispiace")
    })

    it("should block Spanish profanity", async () => {
      const result = await service.processAndTranslate(
        "Eres un pendejo",
        "es",
        "en"
      )

      expect(result.blocked).toBe(true)
      expect(result.reason).toBe("profanity")
    })
  })

  describe("Phishing Protection", () => {
    it("should block external links", async () => {
      const result = await service.processAndTranslate(
        "Visit https://fake-site.com for prizes",
        "en",
        "it"
      )

      expect(result.blocked).toBe(true)
      expect(result.reason).toBe("phishing")
    })

    it("should allow official system links", async () => {
      const result = await service.processAndTranslate(
        "Complete order: http://localhost:3000/orders-public?token=xxx",
        "en",
        "it"
      )

      expect(result.blocked).toBe(false)
    })
  })

  describe("Spam Detection", () => {
    it("should block spam content", async () => {
      const result = await service.processAndTranslate(
        "FREE MONEY!!! Click here NOW!!! WIN WIN WIN!!!",
        "en",
        "it"
      )

      expect(result.blocked).toBe(true)
      expect(result.reason).toBe("spam")
    })
  })
})
```

### Rate Limiting Test

```typescript
// rate-limit.spec.ts
import request from "supertest"
import app from "../app"

describe("Rate Limiting", () => {
  it("should allow requests under limit", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app).get("/api/products")
      expect(res.status).not.toBe(429)
    }
  })

  it("should block requests over limit", async () => {
    // Make 100 requests (limit)
    for (let i = 0; i < 100; i++) {
      await request(app).get("/api/products")
    }

    // 101st request should be blocked
    const res = await request(app).get("/api/products")
    expect(res.status).toBe(429)
    expect(res.body.error).toContain("Too many requests")
  })
})
```

---

## 📊 Coverage Reports

### Generate Coverage

```bash
# Backend
cd backend
npm run test:coverage

# Frontend
cd frontend
npm run test -- --coverage
```

### View HTML Report

```bash
# Backend
open backend/coverage/lcov-report/index.html

# Frontend
open frontend/coverage/index.html
```

### Coverage Thresholds

```javascript
// jest.config.js or vitest.config.ts
coverageThreshold: {
  global: {
    statements: 80,  // 80% of statements must be covered
    branches: 75,    // 75% of branches (if/else)
    functions: 80,   // 80% of functions
    lines: 80        // 80% of lines
  }
}
```

---

## 🚫 Common Mistakes

### ❌ Testing Implementation Details

```typescript
// ❌ BAD: Testing internal state
it("should set loading to true", () => {
  const { result } = renderHook(() => useProducts())
  expect(result.current.loading).toBe(true) // Implementation detail
})

// ✅ GOOD: Testing behavior
it("should show loading spinner", () => {
  render(<ProductsList />)
  expect(screen.getByRole("progressbar")).toBeInTheDocument()
})
```

### ❌ Not Cleaning Up

```typescript
// ❌ BAD: No cleanup
describe("OrderService", () => {
  const mockRepo = { create: jest.fn() }
  // Mock persists across tests
})

// ✅ GOOD: Clean after each test
describe("OrderService", () => {
  let mockRepo: jest.Mocked<OrderRepository>

  beforeEach(() => {
    mockRepo = { create: jest.fn() } as any
  })

  afterEach(() => {
    jest.clearAllMocks()
  })
})
```

### ❌ Testing Multiple Things

```typescript
// ❌ BAD: Multiple assertions unrelated
it("should work correctly", () => {
  expect(result.total).toBe(100)
  expect(result.status).toBe("PENDING")
  expect(result.customer.name).toBe("Andrea")
  expect(mockRepo.create).toHaveBeenCalled()
})

// ✅ GOOD: One concept per test
it("should calculate total correctly", () => {
  expect(result.total).toBe(100)
})

it("should set status to PENDING", () => {
  expect(result.status).toBe("PENDING")
})
```

---

**Last Updated**: October 14, 2025  
**Maintained by**: Andrea (gelsogrove)
