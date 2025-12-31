> ⚠️ **ARCHIVED DOCUMENTATION**  
> This plan describes UI/layout standardization work (completed).  
> **Status**: Completed - UI standards applied  
> **Date Archived**: December 31, 2025  
> **Current Documentation**: See [ui-standards.md](../architecture/ui-standards.md)  
>
> ---

# Layout Standardization Plan

## ✅ Completed
1. **WorkspaceSelectionPage**: Header h-14, max-w-7xl, py-6
2. **MinimalLayout**: Header h-14, max-w-7xl, py-6, footer sticky bottom
3. **UI Standards Documentation**: Created docs/ui-standards.md
4. **ProfilePage**: Title text-2xl text-green-600
5. **BillingPage**: Title text-2xl text-green-600, removed extra padding
6. **ClientsPage**: Standardized layout, title text-2xl text-green-600, search on right, removed grid system

## 🔄 In Progress

### Priority 1: Core Pages (User-facing)
- [ ] **ProfilePage** - Standardize header, container, title color
- [ ] **BillingPage** - Standardize header, container, title color
- [ ] **ChatPage** - Keep current layout (special case with sidebar)
- [ ] **ClientsPage** - Standardize + add search bar on right
- [ ] **SettingsPage** - Already has tabs, verify container width

### Priority 2: E-commerce Pages
- [ ] **ProductsPage** - Standardize + search on right
- [ ] **ServicesPage** - Standardize + search on right
- [ ] **OffersPage** - Standardize + search on right
- [ ] **SuppliersPage** - Standardize + search on right
- [ ] **OrdersPage** - Standardize + search/filters on right

### Priority 3: Other Pages
- [ ] **CampaignsPage** - Standardize
- [ ] **AnalyticsPage** - Standardize
- [ ] **AgentsPage** - Standardize
- [ ] **FAQPage** - Standardize + search on right
- [ ] **QueuePage** - Standardize

## Standard Pattern to Apply

```tsx
// Header (in Layout component)
<header className="bg-white border-b border-gray-200 sticky top-0 z-50">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex items-center justify-between h-14">
      {/* Header content */}
    </div>
  </div>
</header>

// Main Content
<main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
  {/* Page Title + Search */}
  <div className="flex items-center justify-between mb-6">
    <h1 className="text-2xl font-bold text-green-600">Page Title</h1>
    {/* Optional: Search or Actions */}
  </div>
  
  {/* Page Content */}
  <div className="space-y-6">
    {/* Cards, tables, etc. */}
  </div>
</main>
```

## Menu Context Rules

### Context 1: No Workspace (WorkspaceSelection, Profile, Billing)
- Profile
- Billing  
- Log out

### Context 2: Workspace Selected (All other pages)
- Chat History
- Clients
- FAQ
- E-commerce (if sellsProductsAndServices)
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

## Next Steps
1. Apply standard to ProfilePage
2. Apply standard to BillingPage
3. Apply standard to ClientsPage (add search)
4. Continue with E-commerce pages
5. Final review and testing
