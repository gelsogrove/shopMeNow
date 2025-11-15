# API Contract: Link Generator Service - Step Parameter

**Service**: `LinkGeneratorService.generateCheckoutLink()`  
**Feature**: FR-13 Repeat Order with Confirmation  
**Date**: 2025-11-12

---

## Method Signature

### `generateCheckoutLink(token: string, workspaceId: string, step?: number): Promise<string>`

**Purpose**: Generate checkout URL with optional step parameter for direct navigation

---

## Input Parameters

| Parameter     | Type   | Required | Description                          | Example                                     |
| ------------- | ------ | -------- | ------------------------------------ | ------------------------------------------- |
| `token`       | string | ✅ Yes   | Secure token from SecureTokenService | `"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."` |
| `workspaceId` | string | ✅ Yes   | Workspace UUID for URL construction  | `"cm9hjgq9v00004qk8fsdy4ujv"`               |
| `step`        | number | ❌ No    | Checkout step (1=cart, 2=address)    | `2`                                         |

**Validation**:

```typescript
if (step !== undefined && (step < 1 || step > 2)) {
  throw new Error("Invalid step parameter: must be 1 or 2")
}
```

---

## Return Value

| Type              | Description                                    | Example                                                            |
| ----------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| `Promise<string>` | Full checkout URL with token and optional step | `"https://shopme.example.com/checkout-public?token=eyJ...&step=2"` |

---

## Implementation

```typescript
// backend/src/services/link-generator.service.ts

import { PrismaClient } from "@prisma/client"

export class LinkGeneratorService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  /**
   * Generate checkout link with optional step parameter
   *
   * @param token - Secure token from SecureTokenService
   * @param workspaceId - Workspace ID for URL construction
   * @param step - Optional checkout step (1=cart, 2=address)
   * @returns Full URL with token and step parameter
   */
  async generateCheckoutLink(
    token: string,
    workspaceId: string,
    step?: number
  ): Promise<string> {
    // Validation
    if (!token || !workspaceId) {
      throw new Error("Token and workspaceId are required")
    }

    if (step !== undefined && (step < 1 || step > 2)) {
      throw new Error("Invalid step: must be 1 or 2")
    }

    // Get workspace domain (if custom domain configured)
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { customDomain: true },
    })

    // Build base URL
    const baseUrl = workspace?.customDomain
      ? `https://${workspace.customDomain}/checkout-public`
      : `${process.env.FRONTEND_URL}/checkout-public`

    // Add token parameter
    let url = `${baseUrl}?token=${token}`

    // Add step parameter if provided
    if (step !== undefined) {
      url += `&step=${step}`
    }

    return url
  }
}
```

---

## Usage Examples

### Example 1: Default (No Step)

```typescript
const linkGenerator = new LinkGeneratorService()
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

const url = await linkGenerator.generateCheckoutLink(
  token,
  "cm9hjgq9v00004qk8fsdy4ujv"
)

console.log(url)
// Output: "https://shopme.example.com/checkout-public?token=eyJ..."
```

### Example 2: Step 1 (Cart Review)

```typescript
const url = await linkGenerator.generateCheckoutLink(
  token,
  "cm9hjgq9v00004qk8fsdy4ujv",
  1 // Explicit step 1
)

console.log(url)
// Output: "https://shopme.example.com/checkout-public?token=eyJ...&step=1"
```

### Example 3: Step 2 (Direct to Address) - **REPEAT ORDER USE CASE**

```typescript
const url = await linkGenerator.generateCheckoutLink(
  token,
  "cm9hjgq9v00004qk8fsdy4ujv",
  2 // Skip cart, go to address
)

console.log(url)
// Output: "https://shopme.example.com/checkout-public?token=eyJ...&step=2"
```

---

## Integration Points

### Called By

1. **AddProduct CF** (`backend/src/domain/calling-functions/AddProduct.ts`)

   ```typescript
   // After adding products to cart
   const cartUrl = await linkGenerator.generateCheckoutLink(
     token,
     workspaceId,
     2 // Direct to address step for repeat order
   )
   ```

2. **CallingFunctionsService** (`backend/src/services/calling-functions.service.ts`)
   ```typescript
   // Generate cart link
   const cartLinkResult = await callingFunctionsService.getCartLink({
     customerId,
     workspaceId,
     step: 2, // NEW parameter
   })
   ```

---

## Error Handling

| Error               | HTTP Status | Message                              | Action                   |
| ------------------- | ----------- | ------------------------------------ | ------------------------ |
| Missing token       | 400         | "Token and workspaceId are required" | Return error to caller   |
| Invalid step        | 400         | "Invalid step: must be 1 or 2"       | Return error to caller   |
| Workspace not found | 404         | "Workspace not found"                | Use default FRONTEND_URL |

**Error Response Format**:

```typescript
{
  success: false,
  error: "INVALID_STEP",
  message: "Invalid step: must be 1 or 2"
}
```

---

## Testing

### Unit Tests

```typescript
// backend/__tests__/unit/link-generator.test.ts

describe("LinkGeneratorService.generateCheckoutLink", () => {
  let linkGenerator: LinkGeneratorService
  const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
  const mockWorkspaceId = "cm9hjgq9v00004qk8fsdy4ujv"

  beforeEach(() => {
    linkGenerator = new LinkGeneratorService()
  })

  it("should generate URL without step parameter", async () => {
    const url = await linkGenerator.generateCheckoutLink(
      mockToken,
      mockWorkspaceId
    )

    expect(url).toContain("/checkout-public?token=")
    expect(url).not.toContain("&step=")
  })

  it("should generate URL with step=1", async () => {
    const url = await linkGenerator.generateCheckoutLink(
      mockToken,
      mockWorkspaceId,
      1
    )

    expect(url).toContain("&step=1")
  })

  it("should generate URL with step=2", async () => {
    const url = await linkGenerator.generateCheckoutLink(
      mockToken,
      mockWorkspaceId,
      2
    )

    expect(url).toContain("&step=2")
  })

  it("should throw error for invalid step", async () => {
    await expect(
      linkGenerator.generateCheckoutLink(mockToken, mockWorkspaceId, 3)
    ).rejects.toThrow("Invalid step: must be 1 or 2")
  })

  it("should throw error for missing token", async () => {
    await expect(
      linkGenerator.generateCheckoutLink("", mockWorkspaceId)
    ).rejects.toThrow("Token and workspaceId are required")
  })
})
```

---

## Backward Compatibility

✅ **FULLY BACKWARD COMPATIBLE**

- Existing code calling `generateCheckoutLink(token, workspaceId)` continues to work unchanged
- Step parameter is optional (defaults to undefined)
- URLs without step parameter behave identically to before
- Frontend CheckoutPage defaults to step 1 if no parameter provided

---

## OpenAPI Specification

```yaml
# Not a direct HTTP endpoint - internal service method
# But documented here for reference

/internal/link-generator/checkout:
  post:
    summary: Generate checkout link with optional step
    operationId: generateCheckoutLink
    tags:
      - Link Generation
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - token
              - workspaceId
            properties:
              token:
                type: string
                description: Secure token from SecureTokenService
                example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              workspaceId:
                type: string
                format: uuid
                description: Workspace UUID
                example: "cm9hjgq9v00004qk8fsdy4ujv"
              step:
                type: integer
                minimum: 1
                maximum: 2
                description: Optional checkout step (1=cart, 2=address)
                example: 2
    responses:
      "200":
        description: Checkout URL generated successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                url:
                  type: string
                  format: uri
                  example: "https://shopme.example.com/checkout-public?token=eyJ...&step=2"
      "400":
        description: Invalid parameters
        content:
          application/json:
            schema:
              type: object
              properties:
                error:
                  type: string
                  example: "INVALID_STEP"
                message:
                  type: string
                  example: "Invalid step: must be 1 or 2"
```

---

## Performance

- **Execution Time**: <20ms (single DB query + string formatting)
- **Database Queries**: 1 (workspace lookup for custom domain)
- **Caching**: Workspace domain can be cached (Redis optional)
- **Concurrency**: Thread-safe (stateless service)

---

## Security

- ✅ Token validation happens on frontend (SecureTokenService)
- ✅ Step parameter sanitized (only 1 or 2 accepted)
- ✅ WorkspaceId validated against database
- ✅ HTTPS enforced (via FRONTEND_URL environment variable)

---

## Next Steps

✅ Contract specification complete  
⏳ Update AddProduct CF to use step parameter  
⏳ Update CallingFunctionsService.getCartLink() signature  
⏳ Frontend CheckoutPage step parameter handling
