# 🔒 eChatbot Backend Security Audit Report

**Date**: November 27, 2025  
**Auditor**: AI Security Audit System  
**Scope**: All route files in `/backend/src/interfaces/http/routes/`  
**Focus**: Authentication, Authorization, Workspace Isolation, Rate Limiting, Input Validation

---

## 📊 Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 5 | Immediate action required |
| 🟠 HIGH | 6 | Action required |
| 🟡 MEDIUM | 8 | Should be addressed |
| 🟢 LOW | 4 | Monitor/Consider |

---

## 🔴 CRITICAL Issues (Immediate Action Required)

### CRITICAL-001: Cart Token Routes Completely Unprotected
**File**: `/routes/index.ts` (lines 479-483)  
**Endpoint**: `POST /api/cart-tokens`, `GET /api/cart-tokens/:token/validate`  
**Vulnerability**: No authentication, no rate limiting, no input validation

```typescript
// CURRENT (VULNERABLE):
router.post("/cart-tokens", (req, res) =>
  cartTokenController.getCartToken(req, res)
)
router.get("/cart-tokens/:token/validate", (req, res) =>
  cartTokenController.validateCartToken(req, res)
)
```

**Risk**: 
- An attacker can generate unlimited cart tokens for any customer/phone number
- No rate limiting allows brute-force token generation
- Tokens can be used to access customer data

**Recommended Fix**:
```typescript
import { cartTokenLimiter } from '../config/rate-limiters';
import { validateCartTokenInput } from '../middlewares/validation.middleware';

router.post("/cart-tokens", 
  cartTokenLimiter, // Add rate limiting
  validateCartTokenInput, // Add input validation
  (req, res) => cartTokenController.getCartToken(req, res)
)
```

---

### CRITICAL-002: Feedback Routes Public Without Rate Limiting
**File**: `feedback.routes.ts`  
**Endpoints**: `GET /api/feedback`, `POST /api/feedback`  
**Vulnerability**: No authentication, no rate limiting

```typescript
// CURRENT (VULNERABLE):
router.get("/feedback", controller.getFeedback.bind(controller))
router.post("/feedback", controller.submitFeedback.bind(controller))
```

**Risk**:
- Spam attacks on feedback submission
- Data extraction through feedback GET endpoint
- Denial of service via flooding

**Recommended Fix**:
```typescript
import { feedbackLimiter } from '../../../config/rate-limiters';
import { validateFeedbackInput } from '../middlewares/validation.middleware';

router.post("/feedback", 
  feedbackLimiter,
  validateFeedbackInput,
  controller.submitFeedback.bind(controller)
)
```

---

### CRITICAL-003: Registration Routes Missing Rate Limiting
**File**: `registration.routes.ts`  
**Endpoints**: All registration endpoints  
**Vulnerability**: No rate limiting on registration flow

```typescript
// CURRENT (VULNERABLE):
router.get("/token/:token", asyncHandler(controller.validateToken.bind(controller)));
router.post("/register", asyncHandler(controller.register.bind(controller)));
router.get("/data-protection", asyncHandler(controller.getDataProtectionInfo.bind(controller)));
```

**Risk**:
- Brute-force token validation
- Mass registration attacks
- Resource exhaustion

**Recommended Fix**:
```typescript
import { registrationLimiter } from '../../../config/rate-limiters';

router.post("/register", 
  registrationLimiter,
  asyncHandler(controller.register.bind(controller))
);
```

---

### CRITICAL-004: Checkout Routes Missing Token Validation
**File**: `checkout.routes.ts`  
**Endpoint**: `GET /api/checkout/token`  
**Vulnerability**: Token validation endpoint without rate limiting

```typescript
// CURRENT (VULNERABLE):
router.get(
  "/token",
  asyncMiddleware(checkoutController.validateToken.bind(checkoutController))
)
```

**Risk**:
- Token brute-forcing
- Order information leakage
- Access to customer checkout data

**Recommended Fix**:
```typescript
router.get(
  "/token",
  checkoutLimiter, // Rate limit token validation
  asyncMiddleware(checkoutController.validateToken.bind(checkoutController))
)
```

---

### CRITICAL-005: Pricing Configuration Public Endpoint
**File**: `pricing.routes.ts`  
**Endpoints**: `GET /api/pricing/config`, `GET /api/pricing/config/:key`  
**Vulnerability**: Sensitive business pricing data exposed without authentication

```typescript
// CURRENT (POTENTIALLY VULNERABLE):
router.get("/config", controller.getConfig.bind(controller))
router.get("/config/:key", controller.getByKey.bind(controller))
```

**Risk**:
- Competitors can scrape pricing information
- Business intelligence leakage
- No audit trail of who accessed pricing data

**Recommended Fix**: Consider if this needs to remain public or add rate limiting at minimum:
```typescript
router.get("/config", 
  pricingRateLimiter, // At least add rate limiting
  controller.getConfig.bind(controller)
)
```

---

## 🟠 HIGH Risk Issues

### HIGH-001: GDPR Endpoint Partially Unprotected
**File**: `gdpr.routes.ts`  
**Endpoint**: `GET /api/workspaces/:workspaceId/gdpr`  
**Vulnerability**: GET endpoint is public (by design), but missing rate limiting

```typescript
// CURRENT:
router.get("/", (req: Request, res: Response) => gdprController.getGdpr(req, res))
```

**Risk**: Information disclosure, potential scraping of GDPR content

**Recommended Fix**: Add rate limiting to prevent abuse

---

### HIGH-002: Session Validate Endpoint Without Rate Limiting
**File**: `session.routes.ts`  
**Endpoint**: `GET /api/session/validate`  
**Vulnerability**: No rate limiting on session validation

```typescript
router.get("/validate", sessionController.validate.bind(sessionController))
```

**Risk**: Session token brute-forcing, enumeration attacks

---

### HIGH-003: Services Public Endpoint Missing Rate Limiting
**File**: `services.routes.ts`  
**Endpoint**: `GET /api/services/public`  
**Vulnerability**: Public endpoint without rate limiting

```typescript
router.get(
  "/public",
  workspaceValidationMiddleware,
  (req: WorkspaceRequest, res: Response, next: NextFunction): void => {
    controller.getServicesForWorkspace(req, res).catch(next)
  }
)
```

---

### HIGH-004: Public Invitation Routes Missing Rate Limiting
**File**: `invitation.routes.ts`  
**Endpoints**: `GET /api/invitations/validate/:token`, `POST /api/invitations/accept`  
**Vulnerability**: Invitation token validation without rate limiting

```typescript
// CURRENT:
router.get("/validate/:token", asyncHandler(invitationController.validateToken))
router.post("/accept", asyncHandler(invitationController.acceptInvitation))
```

**Risk**: Token brute-forcing, invitation hijacking

---

### HIGH-005: Auth Avatar Endpoint Without Rate Limiting
**File**: `auth.routes.ts`  
**Endpoint**: `GET /api/auth/avatar/:userId`  
**Vulnerability**: User enumeration via avatar endpoint

```typescript
router.get(
  "/avatar/:userId",
  asyncHandler(enhancedAuthController.getUserAvatar.bind(enhancedAuthController))
)
```

**Risk**: User ID enumeration, no rate limiting

---

### HIGH-006: Campaign Routes Missing Workspace Validation
**File**: `campaign.routes.ts`  
**All endpoints**  
**Vulnerability**: Only authMiddleware, no workspaceValidationMiddleware

```typescript
// CURRENT:
router.use(authMiddleware)
// Missing: workspaceValidationMiddleware

router.get("/:workspaceId/campaigns", controller.getCampaigns.bind(controller))
```

**Risk**: Cross-workspace access potential

**Recommended Fix**:
```typescript
router.use(authMiddleware)
router.use(workspaceValidationMiddleware) // ADD THIS
```

---

## 🟡 MEDIUM Risk Issues

### MEDIUM-001: Chat Debug Endpoint in Development
**File**: `chat.routes.ts`  
**Endpoint**: `GET /api/chat/debug/:sessionId`  
**Vulnerability**: Debug endpoint accessible without auth (dev only)

```typescript
if (process.env.NODE_ENV !== "production") {
  router.get(
    "/debug/:sessionId",
    asyncHandler(chatController.getChatSession.bind(chatController))
  )
}
```

**Risk**: Could be accidentally enabled in production, exposes chat session data

**Recommended Fix**: Remove or add additional safeguards

---

### MEDIUM-002: Settings Default GDPR Public
**File**: `settings.routes.ts`  
**Endpoint**: `GET /settings/default-gdpr`  
**Vulnerability**: No auth required for default GDPR content

```typescript
router.get("/default-gdpr", controller.getDefaultGdprContent.bind(controller));
```

---

### MEDIUM-003: WhatsApp Webhook HMAC Validation Only
**File**: `whatsapp.routes.ts`  
**Endpoint**: `POST /api/whatsapp/webhook`  
**Status**: ✅ Has rate limiting, ⚠️ HMAC validation implementation needs verification

```typescript
router.post(
  "/webhook",
  whatsappRateLimitMiddleware,
  webhookController.receiveMessage.bind(webhookController)
)
```

**Recommendation**: Verify HMAC signature validation is correctly implemented in controller

---

### MEDIUM-004: Prompts Routes Missing Workspace Validation
**File**: `prompts.routes.ts`  
**All endpoints**  
**Vulnerability**: Has auth but no workspace validation

```typescript
router.use(wrapController(authMiddleware))
router.get("/", wrapController(promptsController.getAllPrompts.bind(promptsController)))
```

---

### MEDIUM-005: Cart Routes Token-Based Access
**File**: `cart.routes.ts`  
**All endpoints**  
**Status**: Uses token-based access, but missing strict token ownership validation

```typescript
router.get("/:token", asyncMiddleware(cartController.getCartByToken.bind(cartController)))
router.post("/:token/items", asyncMiddleware(cartController.addItemToCart.bind(cartController)))
```

**Recommendation**: Ensure cart token can only be used by its owner

---

### MEDIUM-006: Languages Routes Only Auth, No Workspace Validation
**File**: `languages.routes.ts`  
**Endpoint**: `GET /api/languages`  
**Vulnerability**: Returns languages based on x-workspace-id header without validation

```typescript
router.get('/', authMiddleware, asyncHandler(languageController.getAllLanguages));
```

---

### MEDIUM-007: Orders Public Routes JWT-Based
**File**: `orders.routes.ts`  
**All endpoints**  
**Status**: Uses jwtAuthMiddleware instead of standard authMiddleware

```typescript
router.get("/", jwtAuthMiddleware, ordersController.getCustomerOrders.bind(ordersController))
```

**Recommendation**: Verify jwtAuthMiddleware provides equivalent security

---

### MEDIUM-008: Short URL Redirect No Rate Limiting
**File**: `short-url.routes.ts`  
**Endpoint**: `GET /s/:shortCode`  
**Vulnerability**: Public redirect without rate limiting

```typescript
router.get("/s/:shortCode", shortUrlController.redirect)
```

---

## 🟢 LOW Risk Issues

### LOW-001: Test Route in Production Code
**File**: `routes/index.ts` (line 656)  
**Endpoint**: `GET /api/workspaces/:workspaceId/test`  
**Issue**: Test route should be removed for production

```typescript
router.get("/workspaces/:workspaceId/test", authMiddleware, (req, res) => {
  res.json({ success: true, workspaceId: req.params.workspaceId, ... })
})
```

---

### LOW-002: Rate Limiter Values for Development
**File**: `auth.routes.ts`  
**Issue**: Rate limiter set to development values

```typescript
const loginLimiter = rateLimit({
  max: 50, // Max 50 login attempts per IP per 15 minutes (increased for development)
})

const twoFactorLimiter = rateLimit({
  max: 10, // 🧪 INCREASED for testing (was 3) - CHANGE BACK TO 3 IN PRODUCTION
})
```

**Recommendation**: Ensure production uses stricter limits (5 for login, 3 for 2FA)

---

### LOW-003: Health Check Verbose Response
**File**: `routes/index.ts`  
**Endpoint**: `GET /api/health`  
**Issue**: Exposes version information

```typescript
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0", // Information disclosure
    apiVersion: "v1",
  })
})
```

---

### LOW-004: Agent Test Route Protected but Unnecessary
**File**: `routes/index.ts`  
**Endpoint**: `GET /api/workspaces/:workspaceId/agent-test`  
**Issue**: Debug route should be removed

---

## ✅ Well-Protected Routes (Good Practices)

The following routes demonstrate good security practices:

| Route File | Security Stack | Rate Limiting |
|------------|----------------|---------------|
| `products.routes.ts` | ✅ auth + workspace + billing check | ❌ Missing |
| `categories.routes.ts` | ✅ auth + workspace | ❌ Missing |
| `orders.routes.ts` (workspace) | ✅ auth + workspace | ❌ Missing |
| `offers.routes.ts` | ✅ auth + workspace | ❌ Missing |
| `faqs.routes.ts` | ✅ auth + workspace | ❌ Missing |
| `sales.routes.ts` | ✅ auth + workspace | ❌ Missing |
| `analytics.routes.ts` | ✅ auth + workspace | ❌ Missing |
| `push.routes.ts` | ✅ auth + workspace | ❌ Missing |
| `whatsapp-queue.routes.ts` | ✅ auth + workspace | ❌ Missing |
| `agent-config.routes.ts` | ✅ auth + workspace | ❌ Missing |
| `agent.routes.ts` | ✅ auth + workspace | ❌ Missing |
| `billing.routes.ts` | ✅ auth + workspace | ❌ Missing |
| `subscription-billing.routes.ts` | ✅ auth + session + workspace + owner check | ❌ Missing |
| `certification.routes.ts` | ✅ auth + validateWorkspaceOperation | ❌ Missing |
| `transport-type.routes.ts` | ✅ auth + validateWorkspaceOperation | ❌ Missing |
| `member.routes.ts` | ✅ auth + workspace + role check | ❌ Missing |
| `invitation.routes.ts` (protected) | ✅ auth + workspace + role check | ❌ Missing |
| `workspace.routes.ts` | ✅ auth + workspace + role check | ❌ Missing |
| `supplier.routes.ts` | ✅ auth + workspace | ❌ Missing |
| `debug.routes.ts` | ✅ auth + workspace | ❌ Missing |
| `customers.routes.ts` | ✅ auth | ⚠️ Missing workspace |
| `user.routes.ts` | ✅ auth | ❌ Missing |

---

## 📋 Remediation Priority Matrix

### Immediate Actions (Week 1)

1. **Add rate limiting to cart-tokens endpoint**
2. **Add rate limiting to feedback routes**
3. **Add rate limiting to registration routes**
4. **Add rate limiting to checkout token validation**
5. **Add workspaceValidationMiddleware to campaign routes**

### Short-term Actions (Week 2-3)

6. **Add rate limiting to all public endpoints** (GDPR, services/public, pricing)
7. **Add rate limiting to invitation public routes**
8. **Review and secure session validate endpoint**
9. **Add rate limiting to avatar endpoint**

### Medium-term Actions (Month 1)

10. **Review all routes for consistent middleware stack**
11. **Remove debug/test routes from production builds**
12. **Update rate limiter values for production**
13. **Add input validation to all endpoints**
14. **Add rate limiting to all protected routes**

---

## 🛡️ Recommended Security Middleware Stack

For consistency, all protected routes should follow this pattern:

```typescript
// Full protection (for sensitive operations)
router.post(
  "/sensitive-endpoint",
  rateLimiter,                    // 1. Rate limiting
  authMiddleware,                 // 2. JWT authentication
  sessionValidationMiddleware,    // 3. Session validation (if needed)
  validateWorkspaceOperation,     // 4. Workspace isolation
  inputValidationMiddleware,      // 5. Input validation
  controller.action
)

// Standard protection (for regular CRUD)
router.get(
  "/resource",
  rateLimiter,
  authMiddleware,
  workspaceValidationMiddleware,
  controller.action
)

// Public routes (still need protection)
router.post(
  "/public-action",
  strictRateLimiter,             // 1. Strict rate limiting
  inputValidationMiddleware,      // 2. Input validation
  controller.action
)
```

---

## 📝 Notes

1. **Token-Based Routes**: Routes using token-based authentication (cart, checkout, public-orders) need proper token validation and rate limiting to prevent abuse.

2. **WhatsApp Webhooks**: HMAC signature verification is currently disabled in `whatsapp-webhook.controller.ts` (dev flow). **TODO (must-do before production)**: re-enable HMAC validation when real WhatsApp integration is live.

3. **Multi-tenant Isolation**: All routes handling workspace data MUST include `workspaceValidationMiddleware` or `validateWorkspaceOperation` to prevent cross-tenant data access.

4. **Rate Limiting Gaps**: Many protected routes lack rate limiting. While authentication provides some protection, rate limiting is still important to prevent:
   - Credential stuffing attacks
   - Resource exhaustion
   - Automated scraping by authenticated users

---

**Report Generated**: November 27, 2025  
**Next Audit Due**: December 27, 2025
