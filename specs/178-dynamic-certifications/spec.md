# Feature Specification: Dynamic Product Certifications System

**Feature Branch**: `178-dynamic-certifications`  
**Created**: 2025-11-19  
**Status**: Draft  
**Input**: User description: "Dynamic product certifications system with CRUD management. Certifications stored in separate database table with many-to-many relationship to products. CRUD interface in Products page (top-right of certifications row). Cannot delete certifications in use by products. Filters dynamically generated from active certifications."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create and Manage Product Certifications (Priority: P1)

Admin needs to add new product certifications (e.g., "Kosher", "Fair Trade", "Organic EU") without touching code or database manually. The system should provide a simple interface to create certifications by name only.

**Why this priority**: Core functionality - without ability to create certifications, the entire feature is unusable. This is the foundation for all other stories.

**Independent Test**: Admin can open certifications management dialog, add a new certification "Kosher", save it, and see it appear in the list. No product assignment needed yet.

**Acceptance Scenarios**:

1. **Given** admin is on Products page, **When** admin clicks "Manage Certifications" button in certifications filter row, **Then** certifications management dialog opens showing all existing certifications
2. **Given** certifications dialog is open, **When** admin clicks "Add Certification" and enters name "Kosher", **Then** new certification is created and appears in the list
3. **Given** certification "Kosher" exists, **When** admin clicks edit on "Kosher" and changes name to "Kosher Certified", **Then** certification name is updated everywhere (products using it maintain the relationship)
4. **Given** certification "Test" exists and is NOT used by any products, **When** admin clicks delete on "Test", **Then** certification is permanently deleted
5. **Given** certification "DOP" is used by 5 products, **When** admin tries to delete "DOP", **Then** system shows error "Impossibile eliminare. Usata da 5 prodotti. Rimuovi prima dai prodotti."

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: CertificationsDialog component (similar to SalesPage CRUD), API service for certifications, error handling, loading states
- [ ] Backend API: `/api/workspaces/:workspaceId/certifications` (GET, POST, PUT, DELETE), auth+session+workspace middleware stack
- [ ] Service Layer: CertificationService with business logic, workspace isolation, validation (check product usage before delete)
- [ ] Repository: CertificationRepository with workspaceId filter, query to count products using certification
- [ ] Database: Migration to create Certifications table (id, name, workspaceId, createdAt, updatedAt)
- [ ] Security: 3-layer middleware on all endpoints, workspace isolation tests
- [ ] Testing: Unit tests for service logic, integration tests for API, security tests for workspace isolation
- [ ] Documentation: Swagger updated with certification endpoints
- [ ] Concurrency: Transaction for delete operation (check usage + delete if unused)
- [ ] Code Cleanliness: No temp files, extracted reusable components

---

### User Story 2 - Assign Certifications to Products (Priority: P1)

Admin needs to assign multiple certifications to products during creation or editing. The certifications list should be dynamic (loaded from database), not hardcoded in the UI.

**Why this priority**: Equal priority to P1 because product certification assignment is the primary use case. Without this, certifications are useless.

**Independent Test**: Admin edits product "Prosciutto di Parma", checks "DOP" and "Halal" certifications, saves product. Product detail shows both certifications. Can be tested without filtering feature.

**Acceptance Scenarios**:

1. **Given** certifications "DOP", "IGP", "Bio" exist in database, **When** admin opens "Add Product" form, **Then** certifications section shows 3 checkboxes (DOP, IGP, Bio)
2. **Given** admin is creating a new product, **When** admin checks "DOP" and "Bio" certifications and saves, **Then** product is created with both certifications assigned
3. **Given** product "Parmigiano Reggiano" has certifications ["DOP"], **When** admin edits product and adds "Bio" certification, **Then** product now has ["DOP", "Bio"]
4. **Given** product has certifications ["DOP", "IGP"], **When** admin unchecks "IGP" and saves, **Then** product has only ["DOP"]
5. **Given** admin creates new certification "Kosher", **When** admin refreshes Product form, **Then** "Kosher" checkbox appears automatically

**360-Degree Validation**:

- [ ] Frontend: ProductsPage updated to load certifications dynamically via API, render checkboxes dynamically, handle multi-select
- [ ] Backend API: Update Product POST/PUT to accept certifications array, create/update ProductCertifications pivot records
- [ ] Service Layer: ProductService updated to handle certification assignment (delete old pivot records, create new ones in transaction)
- [ ] Repository: ProductRepository creates/updates ProductCertifications records, loads product with certifications via JOIN
- [ ] Database: Migration to create ProductCertifications pivot table (productId, certificationId, unique constraint)
- [ ] Security: Workspace validation on certification IDs (prevent assigning certifications from other workspaces)
- [ ] Testing: Test multi-certification assignment, test removing certifications, test workspace isolation
- [ ] Documentation: Update Product API swagger with certifications field
- [ ] Concurrency: Transaction for product save (update product + update certifications atomically)

---

### User Story 3 - Filter Products by Certifications (Priority: P2)

Users (admin and potentially customers) need to filter products by certifications. Filters should be dynamically generated from active certifications in database, allowing multi-selection.

**Why this priority**: Secondary to creation/assignment - you need certifications and products first before filtering makes sense. But important for usability once data exists.

**Independent Test**: Admin creates certifications "DOP" and "Bio", assigns "DOP" to 3 products and "Bio" to 2 products. Filter sidebar shows both checkboxes. Selecting "DOP" shows only 3 products. Selecting both shows 5 products (union).

**Acceptance Scenarios**:

1. **Given** certifications "DOP", "IGP", "Bio" exist and are assigned to products, **When** admin loads Products page, **Then** filter sidebar shows 3 certification checkboxes dynamically
2. **Given** filter sidebar shows certification checkboxes, **When** admin checks "DOP" filter, **Then** only products with "DOP" certification are displayed
3. **Given** admin has "DOP" filter active, **When** admin also checks "IGP" filter, **Then** products with either "DOP" OR "IGP" are displayed (union logic)
4. **Given** admin has certification filters active, **When** admin unchecks all certification filters, **Then** all products are displayed again
5. **Given** admin creates new certification "Kosher" and assigns it to a product, **When** admin refreshes page, **Then** "Kosher" checkbox appears automatically in filter sidebar

**360-Degree Validation**:

- [ ] Frontend: ProductsPage filter logic updated to handle dynamic certifications, multi-checkbox state management
- [ ] Backend API: GET `/api/workspaces/:workspaceId/products` accepts certifications query param (array), filters via JOIN
- [ ] Service Layer: ProductService.findAll() filters by certifications if provided
- [ ] Repository: ProductRepository JOIN with ProductCertifications + Certifications tables, WHERE certificationId IN (...)
- [ ] Database: Index on ProductCertifications (certificationId) for filter performance
- [ ] Testing: Test filtering with single certification, multiple certifications, no filters
- [ ] Documentation: Update Product API swagger with certifications filter param

---

### User Story 4 - LLM Agent Access to Product Certifications (Priority: P3)

When customers ask about products via chat, the LLM agent should include certification information in responses (e.g., "Our Parmigiano Reggiano is DOP certified"). Prompt variables should reflect current certifications.

**Why this priority**: Nice-to-have enhancement - the chat already works, this adds more detail to responses. Lower priority than core CRUD and filtering.

**Independent Test**: Create product "Gorgonzola" with "DOP" certification. Customer asks chatbot "Tell me about your cheeses". LLM response includes "Gorgonzola (DOP certified)".

**Acceptance Scenarios**:

1. **Given** products have certifications assigned, **When** `{{PRODUCTS}}` variable is used in agent prompt, **Then** product list includes certifications for each product
2. **Given** customer asks about specific product in chat, **When** LLM retrieves product details, **Then** certifications are included in product description
3. **Given** product has no certifications, **When** product appears in chat response, **Then** no certification info is shown (graceful handling)

**360-Degree Validation**:

- [ ] Service Layer: PromptProcessorService.replaceProductsVariable() includes certifications in product formatting
- [ ] Repository: ProductRepository loads certifications when fetching products for LLM
- [ ] Testing: Test prompt variable replacement with certifications, test products without certifications
- [ ] Documentation: Update prompt variable docs to mention certification inclusion

---

### User Story 5 - Seed Data Migration (Priority: P1)

Existing products with hardcoded certifications (current `certifications: ["DOP", "IGP"]` array) need to be migrated to the new many-to-many structure without data loss.

**Why this priority**: Blocking priority - migration must work before deploying feature, otherwise existing data is lost.

**Independent Test**: Run seed script. Verify "Spaghetti di Gragnano IGP" product has IGP certification in new Certifications table and ProductCertifications pivot record exists.

**Acceptance Scenarios**:

1. **Given** seed data defines product with `certifications: ["DOP"]`, **When** seed script runs, **Then** "DOP" certification is created in Certifications table (if not exists) and pivot record links product to certification
2. **Given** multiple products have "DOP" certification, **When** seed runs, **Then** only ONE "DOP" record exists in Certifications table (reused across products)
3. **Given** product has no certifications in seed data, **When** seed runs, **Then** product is created without certification links (no error)
4. **Given** seed runs twice, **When** second run executes, **Then** no duplicate certifications or pivot records are created (idempotent)

**360-Degree Validation**:

- [ ] Database: Update seed script to create Certifications records, create ProductCertifications pivot records
- [ ] Testing: Test seed idempotency, test migration of all existing certifications
- [ ] Documentation: Document seed data format for certifications

---

### Edge Cases

- **Empty certification name**: What happens when admin tries to create certification with empty string? → Validation error "Nome certificazione obbligatorio"
- **Duplicate certification name**: What happens when admin creates "DOP" and it already exists? → Validation error "Certificazione già esistente" (case-insensitive check)
- **Certification name too long**: What happens when admin enters 500 character name? → Validation error "Nome troppo lungo (max 50 caratteri)"
- **Delete certification in use**: Admin tries to delete "DOP" used by 10 products → Error message shows count: "Usata da 10 prodotti"
- **Concurrent certification creation**: Two admins create same certification simultaneously → Database unique constraint prevents duplicate, second admin sees error
- **Product with deleted certification**: If certification is deleted (when not in use), what happens to product edit form? → No issue, product never had that certification
- **Filter with no results**: Admin filters by "Kosher" but no products have it → Empty state: "Nessun prodotto trovato con i filtri selezionati"
- **Workspace isolation**: Admin in workspace A tries to assign certification from workspace B → Validation error, only certifications from same workspace allowed
- **Migration of unknown certification**: Product seed has `certifications: ["XYZ"]` that doesn't match standard list → Creates "XYZ" certification in database

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST store certifications in separate `Certifications` table with fields: id, name, workspaceId, createdAt, updatedAt
- **FR-002**: System MUST implement many-to-many relationship between Products and Certifications via `ProductCertifications` pivot table (productId, certificationId, unique constraint)
- **FR-003**: Admin MUST be able to create new certification with only a name (no ID required in UI)
- **FR-004**: Admin MUST be able to edit certification name, with changes reflected in all products using it
- **FR-005**: System MUST prevent deletion of certifications that are assigned to one or more products
- **FR-006**: System MUST show error message "Impossibile eliminare. Usata da N prodotti. Rimuovi prima dai prodotti." when delete is blocked, where N is the count
- **FR-007**: System MUST allow deletion of certifications with zero product assignments
- **FR-008**: Admin MUST be able to assign multiple certifications to a product during create or edit
- **FR-009**: System MUST load certification list dynamically from database (not hardcoded in UI)
- **FR-010**: Product list API MUST return certifications for each product (via JOIN)
- **FR-011**: Product filter API MUST accept certifications query parameter (array of certification IDs) and filter via JOIN
- **FR-012**: Frontend MUST generate certification filter checkboxes dynamically from active certifications
- **FR-013**: Frontend MUST support multi-select on certification filters (union/OR logic)
- **FR-014**: Certifications CRUD UI MUST be accessible via button in top-right of certifications filter row on Products page
- **FR-015**: Certifications CRUD UI MUST follow same patterns as Sales CRUD (dialog/modal with table)
- **FR-016**: Seed script MUST migrate existing products with `certifications: ["DOP"]` array format to new many-to-many structure
- **FR-017**: Seed script MUST be idempotent (running twice produces same result, no duplicates)
- **FR-018**: All certification operations MUST enforce workspace isolation (workspaceId filter on all queries)
- **FR-019**: System MUST validate certification name: non-empty, max 50 characters, unique within workspace (case-insensitive)
- **FR-020**: LLM prompt variable `{{PRODUCTS}}` MUST include certifications in product formatting
- **FR-021**: Product creation/update MUST use transaction to update product and certifications atomically
- **FR-022**: Certification deletion MUST use transaction to check usage count and delete if zero
- **FR-023**: All certification API endpoints MUST use 3-layer middleware: authMiddleware → sessionValidationMiddleware → validateWorkspaceOperation

### Key Entities

- **Certification**: Represents a product certification type (e.g., "DOP", "IGP", "Bio"). Attributes: unique name per workspace, workspace ownership, timestamps. Relationships: many-to-many with Products.
- **ProductCertification** (Pivot): Links products to certifications. Attributes: productId, certificationId. Unique constraint on combination. Enables many-to-many relationship.
- **Product**: Updated to have many-to-many relationship with Certifications. No longer stores certifications as string array in product table.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Admin can create, edit, and delete certifications without writing code or database queries (100% UI-driven)
- **SC-002**: System prevents accidental deletion of certifications in use, showing exact product count in error message
- **SC-003**: Product edit form loads all certifications in under 500ms (no performance degradation from JOIN queries)
- **SC-004**: Filter sidebar updates automatically when new certifications are created (no manual UI updates required)
- **SC-005**: Seed migration completes successfully with zero data loss (all existing product certifications preserved)
- **SC-006**: 100% of certification operations enforce workspace isolation (verified by security tests)
- **SC-007**: LLM chat responses include product certifications when relevant (verified by manual testing)
- **SC-008**: Admin can filter products by multiple certifications simultaneously (union logic works correctly)
- **SC-009**: Certification CRUD interface follows existing Sales CRUD patterns (consistent UX across admin features)
- **SC-010**: Product API with 100 products and 10 certifications returns results in under 1 second (JOIN performance acceptable)

## Assumptions

- Certification names are simple strings (no icons, colors, or metadata beyond name)
- Certifications are workspace-scoped (no global certifications shared across workspaces)
- Filter logic uses OR (union) when multiple certifications selected (product must have ANY selected certification)
- Certification checkboxes rendered in alphabetical order in filters and product forms
- Maximum 50 certifications per workspace (reasonable limit for checkbox UI)
- Editing certification name does NOT require re-approval of products using it (auto-updates everywhere)
- LLM prompt includes certifications in parentheses after product name: "Gorgonzola (DOP certified)"
- Deleted certifications do not maintain historical record (hard delete when not in use)

## Out of Scope

- Certification icons or visual indicators beyond name
- Certification categories or hierarchies (e.g., "Quality Certifications" vs "Dietary Certifications")
- Certification expiry dates or renewal tracking
- Certification documentation uploads (PDFs, certificates)
- Public-facing certification badge display on storefront (future feature)
- Certification-based pricing rules or discounts
- Bulk assignment of certifications to multiple products
- Import/export of certifications from external sources
- Certification approval workflow (admin creates, immediately active)
- Multi-language certification names (single name in database)
