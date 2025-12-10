# UI Standards - eChatbot Frontend

## Layout Standards

### Header
- **Height**: `h-14` (56px) - uniforme su tutte le pagine
- **Background**: `bg-white border-b border-gray-200`
- **Sticky**: `sticky top-0 z-50`

### Container
- **Max Width**: `max-w-7xl mx-auto`
- **Padding**: `px-4 sm:px-6 lg:px-8`
- **Vertical Spacing**: `py-6` (24px top/bottom)

### Page Title
- **Color**: `text-green-600` (brand color)
- **Size**: `text-2xl font-bold`
- **Spacing**: `mb-6` (24px bottom margin)

### Search Bar (quando presente)
- **Position**: Sempre a destra del titolo
- **Layout**: `flex items-center justify-between mb-6`
- **Width**: `max-w-md` per la search box

### Cards
- **Background**: `bg-white`
- **Border**: `border border-gray-200 rounded-lg`
- **Padding**: `p-6`
- **Shadow**: `shadow-sm` (opzionale)

### Spacing
- **Section Gap**: `space-y-6` (24px tra sezioni)
- **Card Gap**: `gap-6` (24px tra cards in grid)
- **Form Fields**: `space-y-4` (16px tra campi)

### Buttons
- **Primary**: `bg-green-600 hover:bg-green-700 text-white`
- **Secondary**: `bg-white border border-gray-300 hover:bg-gray-50`
- **Danger**: `bg-red-600 hover:bg-red-700 text-white`

### Footer
- **Position**: Sempre in fondo (flexbox: `flex-1` su main)
- **Style**: `py-4 text-center text-sm text-gray-500 border-t border-gray-200 bg-white`

## Menu Contexts

### Context 1: No Workspace Selected
**Pages**: WorkspaceSelection, Profile, Billing
**Menu Items**:
- Profile
- Billing
- Log out

### Context 2: Workspace Selected
**Pages**: Chat, Clients, Products, Services, etc.
**Menu Items**:
- Chat History
- Clients
- FAQ
- E-commerce (conditional: sellsProductsAndServices)
  - Products
  - Services
  - Offers
  - Suppliers
  - Orders
- Campaigns
- Analytics
- Agents Configuration
- Settings
- WhatsApp Queue
- Log out

## Component Patterns

### Page Header Pattern
```tsx
<div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-bold text-green-600">Page Title</h1>
  {/* Optional: Search or Actions */}
</div>
```

### Grid Pattern (Cards)
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Cards */}
</div>
```

### Form Pattern
```tsx
<div className="space-y-4">
  {/* Form fields */}
</div>
```
