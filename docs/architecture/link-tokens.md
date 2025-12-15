# Link Token Reference

## ✅ VALID TOKENS (Currently Implemented)

| Token | Description | Service | Usage |
|-------|-------------|---------|-------|
| `[LINK_CHECKOUT_WITH_TOKEN]` | Cart/checkout page | SecureTokenService | When showing cart summary |
| `[LINK_PROFILE_WITH_TOKEN]` | Customer profile edit | SecureTokenService | When customer wants to update data |
| `[LINK_CATALOG]` | Product catalog | linkGeneratorService | When showing product list |
| `[LINK_REGISTRATION_WITH_TOKEN]` | Registration page | SecureTokenService | For new customer registration |
| `[LINK_ORDER_WITH_TOKEN]` | Order detail page | SecureTokenService | When showing order confirmation |

## ❌ DEPRECATED TOKENS (DO NOT USE)

| Token | Reason | Replacement |
|-------|--------|-------------|
| `[LINK_CART]` | Obsolete | Use `[LINK_CHECKOUT_WITH_TOKEN]` |
| `[LINK_ORDERS]` | Never implemented | N/A |
| `[LINK_ORDER_CODE]` | Never implemented | Use `[LINK_ORDER_WITH_TOKEN]` |
| `[LINK_INVOICE_DOWNLOAD]` | Never implemented | N/A |
| `[LINK_xxx]` generic | Never implemented | Use specific tokens above |

## Implementation Details

### Token Generation Flow
1. Agent includes token in response (e.g., `[LINK_CHECKOUT_WITH_TOKEN]`)
2. `link-replacement.service.ts` detects token
3. `secure-token.service.ts` generates JWT token
4. `link-generator.service.ts` creates short URL
5. Token replaced with actual URL (e.g., `http://localhost:3000/s/abc123`)

### Files Involved
- `apps/backend/src/application/services/link-replacement.service.ts`
- `apps/backend/src/application/services/secure-token.service.ts`
- `apps/backend/src/application/services/link-generator.service.ts`
- `apps/backend/src/services/llm.service.ts` (SUPPORTED_TOKENS array)

---
Last updated: December 4, 2025
