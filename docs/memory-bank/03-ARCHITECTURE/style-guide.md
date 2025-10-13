# 🧠 MEMORY BANK - STYLE GUIDE

## 📋 **CODING STANDARDS**

### 🔧 **TypeScript Standards**

#### **Naming Conventions**
```typescript
// ✅ CORRECT
export class ProductService {}
export interface ProductRepository {}
export const createProduct = () => {};
export type ProductStatus = 'active' | 'inactive';

// ❌ INCORRECT
export class productService {}
export interface productRepository {}
export const CreateProduct = () => {};
export type productStatus = 'active' | 'inactive';
```

#### **File Naming**
```typescript
// ✅ CORRECT - kebab-case for directories, camelCase for files
src/
├── services/
│   ├── product.service.ts
│   └── customer.service.ts
├── controllers/
│   ├── product.controller.ts
│   └── order.controller.ts
└── types/
    ├── product.types.ts
    └── order.types.ts
```

#### **Import Organization**
```typescript
// ✅ CORRECT - Grouped imports
// 1. External libraries
import express from 'express';
import { PrismaClient } from '@prisma/client';

// 2. Internal modules
import { ProductService } from '../services/product.service';
import { ProductRepository } from '../repositories/product.repository';

// 3. Types and interfaces
import { CreateProductDto } from '../types/product.types';
import { ApiResponse } from '../types/common.types';
```

### ⚛️ **React Standards**

#### **Component Structure**
```typescript
// ✅ CORRECT - Functional components with TypeScript
interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string) => void;
  isLoading?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  isLoading = false
}) => {
  const handleAddToCart = () => {
    onAddToCart(product.id);
  };

  return (
    <div className="product-card">
      <img src={product.image} alt={product.name} />
      <h3>{product.name}</h3>
      <p>{product.description}</p>
      <button 
        onClick={handleAddToCart}
        disabled={isLoading}
        className="btn-primary"
      >
        Add to Cart
      </button>
    </div>
  );
};
```

#### **Hook Usage**
```typescript
// ✅ CORRECT - Custom hooks
export const useProducts = (workspaceId: string) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const data = await productApi.getProducts(workspaceId);
        setProducts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch products');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [workspaceId]);

  return { products, loading, error };
};
```

---

## 🎨 **UI/UX DESIGN STANDARDS**

### 🎯 **Color Palette**
```css
/* Primary Colors */
--primary-50: #eff6ff;
--primary-500: #3b82f6;
--primary-600: #2563eb;
--primary-700: #1d4ed8;

/* Secondary Colors */
--secondary-50: #f8fafc;
--secondary-500: #64748b;
--secondary-600: #475569;
--secondary-700: #334155;

/* Success Colors */
--success-50: #f0fdf4;
--success-500: #22c55e;
--success-600: #16a34a;

/* Error Colors */
--error-50: #fef2f2;
--error-500: #ef4444;
--error-600: #dc2626;

/* Warning Colors */
--warning-50: #fffbeb;
--warning-500: #f59e0b;
--warning-600: #d97706;
```

### 🎨 **Typography**
```css
/* Font Family */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

/* Font Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 🎨 **Component Design**

#### **Button Styles**
```typescript
// Primary Button
<button className="btn btn-primary">
  Primary Action
</button>

// Secondary Button
<button className="btn btn-secondary">
  Secondary Action
</button>

// Danger Button
<button className="btn btn-danger">
  Delete
</button>

// Disabled Button
<button className="btn btn-primary" disabled>
  Loading...
</button>
```

#### **Form Elements**
```typescript
// Input Field
<div className="form-group">
  <label htmlFor="productName" className="form-label">
    Product Name
  </label>
  <input
    type="text"
    id="productName"
    className="form-input"
    placeholder="Enter product name"
    value={productName}
    onChange={(e) => setProductName(e.target.value)}
  />
  {errors.productName && (
    <span className="form-error">{errors.productName}</span>
  )}
</div>

// Select Dropdown
<div className="form-group">
  <label htmlFor="category" className="form-label">
    Category
  </label>
  <select
    id="category"
    className="form-select"
    value={category}
    onChange={(e) => setCategory(e.target.value)}
  >
    <option value="">Select a category</option>
    {categories.map(cat => (
      <option key={cat.id} value={cat.id}>
        {cat.name}
      </option>
    ))}
  </select>
</div>
```

#### **Card Components**
```typescript
// Product Card
<div className="card product-card">
  <div className="card-header">
    <img src={product.image} alt={product.name} className="card-image" />
  </div>
  <div className="card-body">
    <h3 className="card-title">{product.name}</h3>
    <p className="card-description">{product.description}</p>
    <div className="card-price">€{product.price}</div>
  </div>
  <div className="card-footer">
    <button className="btn btn-primary btn-sm">
      Add to Cart
    </button>
  </div>
</div>
```

---

## 📱 **RESPONSIVE DESIGN**

### 📐 **Breakpoints**
```css
/* Mobile First Approach */
/* Base styles for mobile */
.container {
  padding: 1rem;
}

/* Tablet (768px and up) */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
  }
}

/* Desktop (1024px and up) */
@media (min-width: 1024px) {
  .container {
    padding: 3rem;
    max-width: 1200px;
    margin: 0 auto;
  }
}

/* Large Desktop (1280px and up) */
@media (min-width: 1280px) {
  .container {
    max-width: 1400px;
  }
}
```

### 📱 **Mobile-First Components**
```typescript
// Responsive Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {products.map(product => (
    <ProductCard key={product.id} product={product} />
  ))}
</div>

// Responsive Navigation
<nav className="navbar">
  <div className="navbar-brand">
    <img src="/logo.svg" alt="ShopMe" className="navbar-logo" />
  </div>
  
  {/* Mobile Menu Button */}
  <button className="navbar-toggle md:hidden">
    <span className="sr-only">Open menu</span>
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  </button>
  
  {/* Desktop Navigation */}
  <div className="navbar-menu hidden md:flex">
    <a href="/dashboard" className="navbar-link">Dashboard</a>
    <a href="/products" className="navbar-link">Products</a>
    <a href="/orders" className="navbar-link">Orders</a>
  </div>
</nav>
```

---

## 🎯 **ACCESSIBILITY STANDARDS**

### ♿ **WCAG Compliance**
```typescript
// ✅ CORRECT - Accessible components
<button
  aria-label="Add product to cart"
  aria-describedby="product-description"
  onClick={handleAddToCart}
>
  <span className="sr-only">Add to Cart</span>
  <ShoppingCartIcon className="w-5 h-5" />
</button>

// Form with proper labels
<div className="form-group">
  <label htmlFor="email" className="form-label">
    Email Address <span className="required" aria-label="required">*</span>
  </label>
  <input
    type="email"
    id="email"
    name="email"
    required
    aria-required="true"
    aria-describedby="email-help"
    className="form-input"
  />
  <div id="email-help" className="form-help">
    We'll never share your email with anyone else.
  </div>
</div>

// Error messages with proper ARIA
{errors.email && (
  <div id="email-error" className="form-error" role="alert" aria-live="polite">
    {errors.email}
  </div>
)}
```

### 🎨 **Color Contrast**
```css
/* ✅ CORRECT - High contrast ratios */
.text-primary {
  color: #1d4ed8; /* 4.5:1 contrast ratio */
}

.text-secondary {
  color: #475569; /* 7:1 contrast ratio */
}

.bg-primary {
  background-color: #eff6ff;
  color: #1e40af; /* 4.5:1 contrast ratio */
}
```

---

## 📊 **DATA VISUALIZATION**

### 📈 **Chart Components**
```typescript
// Sales Chart
<div className="chart-container">
  <h3 className="chart-title">Sales Overview</h3>
  <div className="chart-wrapper">
    <LineChart
      data={salesData}
      xAxis="date"
      yAxis="sales"
      color="#3b82f6"
      height={300}
    />
  </div>
  <div className="chart-legend">
    <span className="legend-item">
      <span className="legend-color" style={{ backgroundColor: '#3b82f6' }}></span>
      Sales
    </span>
  </div>
</div>

// Metrics Cards
<div className="metrics-grid">
  <div className="metric-card">
    <div className="metric-value">€12,450</div>
    <div className="metric-label">Total Sales</div>
    <div className="metric-change positive">+12.5%</div>
  </div>
  
  <div className="metric-card">
    <div className="metric-value">156</div>
    <div className="metric-label">Orders</div>
    <div className="metric-change positive">+8.2%</div>
  </div>
</div>
```

---

## 🔄 **LOADING STATES**

### ⏳ **Loading Components**
```typescript
// Skeleton Loading
<div className="skeleton-card">
  <div className="skeleton-image"></div>
  <div className="skeleton-content">
    <div className="skeleton-title"></div>
    <div className="skeleton-text"></div>
    <div className="skeleton-text short"></div>
  </div>
</div>

// Spinner Component
<div className="loading-spinner">
  <div className="spinner"></div>
  <p className="loading-text">Loading products...</p>
</div>

// Button Loading State
<button 
  className="btn btn-primary" 
  disabled={isLoading}
  onClick={handleSubmit}
>
  {isLoading ? (
    <>
      <SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />
      Processing...
    </>
  ) : (
    'Submit Order'
  )}
</button>
```

---

## 🎨 **ANIMATIONS**

### ✨ **Micro-interactions**
```css
/* Button Hover Effects */
.btn {
  transition: all 0.2s ease-in-out;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Card Hover Effects */
.card {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

/* Form Input Focus */
.form-input {
  transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}

.form-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
```

### 🎭 **Page Transitions**
```typescript
// Fade In Animation
const FadeIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
};

// Stagger Animation for Lists
<motion.div
  initial="hidden"
  animate="visible"
  variants={{
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }}
>
  {products.map((product, index) => (
    <motion.div
      key={product.id}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
    >
      <ProductCard product={product} />
    </motion.div>
  ))}
</motion.div>
```

---

## 📝 **COMMENTING STANDARDS**

### 💬 **Code Comments**
```typescript
// ✅ CORRECT - Clear and helpful comments

/**
 * Creates a new product in the system
 * @param data - Product creation data
 * @param workspaceId - Workspace identifier for isolation
 * @returns Promise<Product> - Created product entity
 * @throws ValidationError - If product data is invalid
 * @throws BusinessRuleError - If business rules are violated
 */
export async function createProduct(
  data: CreateProductDto, 
  workspaceId: string
): Promise<Product> {
  // Validate business rules before creation
  ProductValidator.validateProductCreation(data, workspaceId);
  
  // Create product entity with generated ID
  const product = new Product(
    generateId(),
    data.name,
    data.price,
    data.stock,
    workspaceId
  );
  
  // Persist to database with workspace isolation
  return await productRepository.save(product);
}

// ✅ CORRECT - Inline comments for complex logic
const calculateTotal = (items: OrderItem[]): number => {
  return items.reduce((total, item) => {
    // Apply discount if quantity threshold is met
    const discount = item.quantity >= 10 ? 0.1 : 0;
    const itemTotal = item.price * item.quantity * (1 - discount);
    return total + itemTotal;
  }, 0);
};
```

### 📚 **Documentation Comments**
```typescript
/**
 * @fileoverview Product management service for e-commerce operations
 * @module services/ProductService
 * @author ShopMe Development Team
 * @version 1.0.0
 */

/**
 * Product service class handling all product-related business logic
 * 
 * This service implements the following features:
 * - Product CRUD operations with workspace isolation
 * - Inventory management and stock tracking
 * - Product search and filtering
 * - Category management
 * 
 * @example
 * ```typescript
 * const productService = new ProductService(productRepository);
 * const products = await productService.getProducts(workspaceId);
 * ```
 */
export class ProductService {
  // Implementation...
}
```

---

## 🧪 **TESTING STANDARDS**

### 🧪 **Test Structure**
```typescript
// ✅ CORRECT - Descriptive test structure
describe('ProductService', () => {
  describe('createProduct', () => {
    it('should create a product with valid data', async () => {
      // Arrange
      const productData: CreateProductDto = {
        name: 'Test Product',
        price: 29.99,
        stock: 10,
        categoryId: 'category-1'
      };
      const workspaceId = 'workspace-1';
      
      // Act
      const result = await productService.createProduct(productData, workspaceId);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe(productData.name);
      expect(result.price).toBe(productData.price);
      expect(result.workspaceId).toBe(workspaceId);
    });
    
    it('should throw error for negative price', async () => {
      // Arrange
      const productData: CreateProductDto = {
        name: 'Test Product',
        price: -10,
        stock: 10,
        categoryId: 'category-1'
      };
      
      // Act & Assert
      await expect(
        productService.createProduct(productData, 'workspace-1')
      ).rejects.toThrow('Product price cannot be negative');
    });
  });
});
```

### 🎯 **Test Naming**
```typescript
// ✅ CORRECT - Clear test descriptions
describe('Order Processing', () => {
  it('should create order when customer confirms purchase', async () => {
    // Test implementation
  });
  
  it('should reject order when product is out of stock', async () => {
    // Test implementation
  });
  
  it('should apply discount for orders over €100', async () => {
    // Test implementation
  });
  
  it('should send confirmation email after successful order', async () => {
    // Test implementation
  });
});
```
