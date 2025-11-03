# Frontend Best Practices

> **ShopME Frontend Development Standards**
>
> React 18 | TypeScript | TailwindCSS | shadcn/ui | Vite

---

## 🎯 Core Principles

### 1. Component Single Responsibility

**RULE**: One component = one clear purpose

```typescript
// ✅ GOOD: Single responsibility
const ProductCard = ({ product }: { product: Product }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{product.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">€{product.price}</p>
        <p className="text-sm text-gray-600">Stock: {product.stock}</p>
      </CardContent>
    </Card>
  )
}

// ❌ BAD: Multiple responsibilities
const ProductPage = () => {
  // Don't mix: data fetching, business logic, UI rendering, routing
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])

  useEffect(() => {
    fetch("/api/products").then(/* ... */)
  }, [])

  const calculateTotal = () => {
    /* business logic */
  }
  const handleCheckout = () => {
    /* checkout logic */
  }

  return <div>{/* Complex nested UI */}</div>
}
```

### 2. Props Interface First

**RULE**: Always define prop types explicitly

```typescript
// ✅ GOOD: Explicit interface
interface OrderCardProps {
  order: Order
  onStatusChange: (orderId: string, status: OrderStatus) => void
  showCustomer?: boolean
  compact?: boolean
}

const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onStatusChange,
  showCustomer = true,
  compact = false,
}) => {
  // Component implementation
}

// ❌ BAD: Inline types or 'any'
const OrderCard = (props: any) => {}
const OrderCard = ({ order, onStatusChange }) => {} // No types
```

### 3. Composition Over Inheritance

```typescript
// ✅ GOOD: Composition with children
const Card = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => <div className={cn("rounded-lg border p-4", className)}>{children}</div>

const ProductCard = ({ product }: { product: Product }) => (
  <Card>
    <h3>{product.name}</h3>
    <p>€{product.price}</p>
  </Card>
)

// ❌ BAD: Inheritance (not idiomatic in React)
class BaseCard extends React.Component {}
class ProductCard extends BaseCard {}
```

---

## 🏗️ Project Structure

```
frontend/src/
├── components/
│   ├── shared/              # Reusable across features
│   │   ├── DataTable.tsx
│   │   ├── PageHeader.tsx
│   │   └── StatusBadge.tsx
│   ├── layout/              # Layout components
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── Footer.tsx
│   ├── ui/                  # shadcn/ui primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── dialog.tsx
│   └── analytics/           # Feature-specific
│       ├── MonthlyRevenue.tsx
│       └── TopProducts.tsx
├── pages/                   # Route components (one per URL)
│   ├── DashboardPage.tsx
│   ├── ProductsPage.tsx
│   └── OrdersPage.tsx
├── services/                # API clients
│   ├── api.ts              # Axios instance
│   ├── productsApi.ts
│   └── ordersApi.ts
├── hooks/                   # Custom React hooks
│   ├── useAuth.ts
│   ├── useWorkspace.ts
│   └── useWebSocket.ts
├── contexts/                # Global state providers
│   ├── AuthContext.tsx
│   └── WorkspaceContext.tsx
├── utils/                   # Helper functions
│   ├── formatters.ts
│   ├── validators.ts
│   └── logger.ts
├── types/                   # TypeScript definitions
│   ├── api.types.ts
│   └── domain.types.ts
└── lib/                     # Third-party configs
    └── utils.ts            # cn() helper
```

### File Naming Conventions

- **Components**: `PascalCase.tsx` (e.g., `ProductCard.tsx`)
- **Hooks**: `camelCase.ts` (e.g., `useAuth.ts`)
- **Utils**: `camelCase.ts` (e.g., `formatters.ts`)
- **Pages**: `PascalCasePage.tsx` (e.g., `DashboardPage.tsx`)
- **Services**: `camelCaseApi.ts` (e.g., `productsApi.ts`)

---

## 🎨 Component Design Patterns

### 1. Container/Presentational Pattern

```typescript
// Container (logic)
const ProductsPageContainer = () => {
  const { workspaceId } = useWorkspace()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProducts()
  }, [workspaceId])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const data = await productsApi.getAllForWorkspace(workspaceId)
      setProducts(data)
    } catch (error) {
      toast.error("Failed to load products")
    } finally {
      setLoading(false)
    }
  }

  return <ProductsPageView products={products} loading={loading} />
}

// Presentational (UI)
interface ProductsPageViewProps {
  products: Product[]
  loading: boolean
}

const ProductsPageView: React.FC<ProductsPageViewProps> = ({
  products,
  loading,
}) => {
  if (loading) return <Spinner />

  return (
    <div className="grid grid-cols-3 gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
```

### 2. Compound Components

```typescript
// ✅ GOOD: Flexible composition
const Card = ({ children, className }: CardProps) => (
  <div className={cn("rounded-lg border", className)}>{children}</div>
)

const CardHeader = ({ children, className }: CardHeaderProps) => (
  <div className={cn("p-6", className)}>{children}</div>
)

const CardContent = ({ children, className }: CardContentProps) => (
  <div className={cn("p-6 pt-0", className)}>{children}</div>
)

// Usage
<Card>
  <CardHeader>
    <CardTitle>Product Details</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Price: €{product.price}</p>
  </CardContent>
</Card>
```

### 3. Render Props Pattern

```typescript
interface DataFetcherProps<T> {
  url: string
  children: (
    data: T | null,
    loading: boolean,
    error: Error | null
  ) => React.ReactNode
}

const DataFetcher = <T>({ url, children }: DataFetcherProps<T>) => {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    fetch(url)
      .then((res) => res.json())
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [url])

  return <>{children(data, loading, error)}</>
}

// Usage
;<DataFetcher<Product[]> url="/api/products">
  {(products, loading, error) => {
    if (loading) return <Spinner />
    if (error) return <Error message={error.message} />
    return products?.map((p) => <ProductCard key={p.id} product={p} />)
  }}
</DataFetcher>
```

---

## 🪝 Custom Hooks Best Practices

### 1. Hook Naming

```typescript
// ✅ GOOD: 'use' prefix, descriptive name
const useAuth = () => {}
const useWorkspace = () => {}
const useProductFilters = () => {}

// ❌ BAD: No 'use' prefix
const auth = () => {}
const getWorkspace = () => {}
```

### 2. Hook Structure

```typescript
// ✅ GOOD: Clear interface, proper cleanup
const useWebSocket = (url: string) => {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<any>(null)
  const socketRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    // Connect
    const socket = new WebSocket(url)
    socket.onopen = () => setIsConnected(true)
    socket.onmessage = (event) => setLastMessage(JSON.parse(event.data))
    socket.onerror = (error) => logger.error("WebSocket error:", error)
    socketRef.current = socket

    // Cleanup
    return () => {
      socket.close()
    }
  }, [url])

  const sendMessage = useCallback((message: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message))
    }
  }, [])

  return { isConnected, lastMessage, sendMessage }
}
```

### 3. Custom Hook Examples

```typescript
// useLocalStorage
const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      logger.error("Error reading localStorage:", error)
      return initialValue
    }
  })

  const setStoredValue = (newValue: T | ((val: T) => T)) => {
    try {
      const valueToStore =
        newValue instanceof Function ? newValue(value) : newValue
      setValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      logger.error("Error setting localStorage:", error)
    }
  }

  return [value, setStoredValue] as const
}

// useDebounce
const useDebounce = <T>(value: T, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

// useClickOutside
const useClickOutside = (ref: RefObject<HTMLElement>, handler: () => void) => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return
      }
      handler()
    }

    document.addEventListener("mousedown", listener)
    document.addEventListener("touchstart", listener)

    return () => {
      document.removeEventListener("mousedown", listener)
      document.removeEventListener("touchstart", listener)
    }
  }, [ref, handler])
}
```

---

## 🎭 State Management

### 1. Local State (useState)

**Use for**: Component-specific UI state

```typescript
const ProductForm = () => {
  const [name, setName] = useState("")
  const [price, setPrice] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Local form state
}
```

### 2. Context (useContext)

**Use for**: Shared state across component tree

```typescript
// AuthContext.tsx
interface AuthContextValue {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password)
    setUser(response.user)
    localStorage.setItem("token", response.token)
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("token")
    localStorage.removeItem("user")
  }

  const value = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Custom hook
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
```

### 3. URL State (useSearchParams)

**Use for**: Shareable/bookmarkable filters

```typescript
const ProductsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const category = searchParams.get("category") || "all"
  const search = searchParams.get("search") || ""

  const updateFilters = (newCategory: string, newSearch: string) => {
    setSearchParams({ category: newCategory, search: newSearch })
  }

  // Filters persist in URL: /products?category=electronics&search=laptop
}
```

---

## 🌐 API Integration

### 1. Centralized API Client

```typescript
// services/api.ts
import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  timeout: 10000,
})

// Request interceptor (add auth token)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    const sessionId = sessionStorage.getItem("sessionId")
    if (sessionId) {
      config.headers["X-Session-Id"] = sessionId
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor (handle errors)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login
      localStorage.removeItem("token")
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)

export default api
```

### 2. Feature-Specific API Services

```typescript
// services/productsApi.ts
import api from "./api"

export interface Product {
  id: string
  name: string
  price: number
  stock: number
  workspaceId: string
}

export const productsApi = {
  async getAllForWorkspace(workspaceId: string): Promise<Product[]> {
    const { data } = await api.get(`/workspaces/${workspaceId}/products`)
    return data.data || data
  },

  async getById(workspaceId: string, productId: string): Promise<Product> {
    const { data } = await api.get(
      `/workspaces/${workspaceId}/products/${productId}`
    )
    return data.data || data
  },

  async create(
    workspaceId: string,
    product: Omit<Product, "id">
  ): Promise<Product> {
    const { data } = await api.post(
      `/workspaces/${workspaceId}/products`,
      product
    )
    return data.data || data
  },

  async update(
    workspaceId: string,
    productId: string,
    updates: Partial<Product>
  ): Promise<Product> {
    const { data } = await api.put(
      `/workspaces/${workspaceId}/products/${productId}`,
      updates
    )
    return data.data || data
  },

  async delete(workspaceId: string, productId: string): Promise<void> {
    await api.delete(`/workspaces/${workspaceId}/products/${productId}`)
  },
}
```

### 3. Error Handling

```typescript
// utils/errorHandler.ts
import { toast } from "@/lib/toast"

export const handleApiError = (error: any, context?: string) => {
  const message =
    error.response?.data?.error || error.message || "An error occurred"

  logger.error(`API Error ${context ? `[${context}]` : ""}:`, {
    message,
    status: error.response?.status,
    data: error.response?.data,
  })

  toast.error(message)
}

// Usage in component
const loadProducts = async () => {
  try {
    const data = await productsApi.getAllForWorkspace(workspaceId)
    setProducts(data)
  } catch (error) {
    handleApiError(error, "Load Products")
  }
}
```

---

## 🎨 Styling Best Practices

### 1. TailwindCSS Conventions

```typescript
// ✅ GOOD: Utility classes, logical order
<div className="flex items-center justify-between gap-4 rounded-lg bg-white p-6 shadow-md">
  <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
  <Button variant="primary" size="sm">Edit</Button>
</div>

// ❌ BAD: Inline styles
<div style={{ display: 'flex', padding: '24px', backgroundColor: 'white' }}>
```

### 2. cn() Helper for Conditional Classes

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Usage
;<Button
  className={cn(
    "rounded-lg px-4 py-2",
    variant === "primary" && "bg-blue-600 text-white",
    variant === "secondary" && "bg-gray-200 text-gray-900",
    disabled && "opacity-50 cursor-not-allowed"
  )}
>
  Click me
</Button>
```

### 3. Component Variants Pattern

```typescript
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary/90",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border border-gray-300 bg-white hover:bg-gray-50",
        ghost: "hover:bg-gray-100",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-11 px-6 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = ({ className, variant, size, ...props }: ButtonProps) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
```

---

## ⚡ Performance Optimization

### 1. React.memo for Expensive Components

```typescript
// ✅ GOOD: Memoize pure components
const ProductCard = React.memo(({ product }: { product: Product }) => {
  return (
    <Card>
      <CardHeader>{product.name}</CardHeader>
      <CardContent>€{product.price}</CardContent>
    </Card>
  )
})

// Only re-renders if product changes
```

### 2. useMemo for Expensive Calculations

```typescript
const ProductsList = ({ products }: { products: Product[] }) => {
  // ✅ GOOD: Memoize expensive calculation
  const totalValue = useMemo(() => {
    return products.reduce((sum, p) => sum + p.price * p.stock, 0)
  }, [products])

  // ❌ BAD: Recalculates on every render
  const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0)
}
```

### 3. useCallback for Event Handlers

```typescript
const ProductForm = ({ onSubmit }: { onSubmit: (data: Product) => void }) => {
  const [name, setName] = useState("")

  // ✅ GOOD: Stable function reference
  const handleSubmit = useCallback(() => {
    onSubmit({ name, price: 0 })
  }, [name, onSubmit])

  return <form onSubmit={handleSubmit}>...</form>
}
```

### 4. Code Splitting

```typescript
// ✅ GOOD: Lazy load heavy components
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))

<Suspense fallback={<Spinner />}>
  <Routes>
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/analytics" element={<AnalyticsPage />} />
  </Routes>
</Suspense>
```

---

## 🧪 Testing Guidelines

### 1. Component Testing

```typescript
import { render, screen, fireEvent } from "@testing-library/react"
import { ProductCard } from "./ProductCard"

describe("ProductCard", () => {
  const mockProduct = {
    id: "1",
    name: "Test Product",
    price: 99.99,
    stock: 10,
  }

  it("renders product information correctly", () => {
    render(<ProductCard product={mockProduct} />)

    expect(screen.getByText("Test Product")).toBeInTheDocument()
    expect(screen.getByText("€99.99")).toBeInTheDocument()
    expect(screen.getByText("Stock: 10")).toBeInTheDocument()
  })

  it("calls onAddToCart when button clicked", () => {
    const onAddToCart = jest.fn()
    render(<ProductCard product={mockProduct} onAddToCart={onAddToCart} />)

    const button = screen.getByRole("button", { name: /add to cart/i })
    fireEvent.click(button)

    expect(onAddToCart).toHaveBeenCalledWith(mockProduct.id)
  })
})
```

### 2. Hook Testing

```typescript
import { renderHook, act } from "@testing-library/react"
import { useAuth } from "./useAuth"

describe("useAuth", () => {
  it("should login successfully", async () => {
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.login("test@test.com", "password")
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toBeDefined()
  })
})
```

---

## 🚫 Anti-Patterns to Avoid

### ❌ Prop Drilling

```typescript
// ❌ BAD: Passing props through many levels
<GrandParent user={user}>
  <Parent user={user}>
    <Child user={user}>
      <GrandChild user={user} />
    </Child>
  </Parent>
</GrandParent>

// ✅ GOOD: Use Context
const UserContext = createContext(null)

<UserContext.Provider value={user}>
  <GrandParent>
    <Parent>
      <Child>
        <GrandChild />
      </Child>
    </Parent>
  </GrandParent>
</UserContext.Provider>

// In GrandChild
const user = useContext(UserContext)
```

### ❌ Unnecessary useEffect

```typescript
// ❌ BAD: Derived state in useEffect
const [price, setPrice] = useState(0)
const [tax, setTax] = useState(0)

useEffect(() => {
  setTax(price * 0.2)
}, [price])

// ✅ GOOD: Calculate directly
const tax = price * 0.2
```

### ❌ Massive Components

```typescript
// ❌ BAD: 500+ line component
const ProductsPage = () => {
  // Too much logic
  // Too many useState
  // Too many useEffect
  // Nested JSX
}

// ✅ GOOD: Split into smaller components
const ProductsPage = () => {
  return (
    <>
      <ProductsHeader />
      <ProductsFilters />
      <ProductsGrid />
      <ProductsPagination />
    </>
  )
}
```

---

## 📚 Additional Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)

---

**Last Updated**: October 14, 2025  
**Maintained by**: Andrea (gelsogrove)
