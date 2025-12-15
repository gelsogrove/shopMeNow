# 🔒 eChatbot Security Audit Report
**Date**: December 1, 2025  
**Auditor**: GitHub Copilot  
**Scope**: `apps/backend/src/`, `apps/frontend/src/`, `package.json` files

---

## 📊 Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 **CRITICAL** | 1 |
| 🟠 **HIGH** | 2 |
| 🟡 **MEDIUM** | 5 |
| 🟢 **LOW** | 3 |

---

## 🔴 CRITICAL Issues

### 1. SQL Injection via `$queryRawUnsafe` (CRITICAL)

**File**: `apps/backend/src/application/services/agent.service.ts:46`

```typescript
const rawAgents = await this.prisma.$queryRawUnsafe(
  `SELECT * FROM "Prompts" WHERE "workspaceId" = $1`,
  workspaceId
)
```

**Risk**: While this specific usage uses parameterized query (`$1`), `$queryRawUnsafe` is inherently dangerous. If the pattern is copied elsewhere without proper parameterization, it creates SQL injection vulnerabilities.

**Recommendation**: 
- Replace with `$queryRaw` template literal which provides automatic escaping:
```typescript
const rawAgents = await this.prisma.$queryRaw`
  SELECT * FROM "Prompts" WHERE "workspaceId" = ${workspaceId}
`
```
- Remove this debug fallback code entirely - it's unnecessary since Prisma ORM queries already exist.

---

## 🟠 HIGH Issues

### 2. Weak JWT Secret Fallback (HIGH)

**File**: `apps/backend/src/config.ts:36`

```typescript
jwt: {
  secret: process.env.JWT_SECRET || "your-secret-key",
  expiresIn: "1d",
},
```

**Risk**: If `JWT_SECRET` environment variable is not set, the system falls back to a hardcoded, weak secret. This is extremely dangerous in production.

**Recommendations**:
1. NEVER provide a fallback for `JWT_SECRET` - fail hard if not set
2. In production, enforce minimum secret length (256 bits recommended)
3. Add startup validation:
```typescript
if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required')
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET must be at least 32 characters')
}
```

---

### 3. No CSRF Protection (HIGH)

**Finding**: No `csurf` or equivalent CSRF protection middleware found in the codebase.

**Search Result**: `grep_search` for `csrf|csurf|_csrf` returned **0 matches**.

**Risk**: State-changing endpoints (POST, PUT, DELETE) are vulnerable to Cross-Site Request Forgery attacks when users are authenticated via cookies.

**Files Affected**: All routes in `apps/backend/src/interfaces/http/routes/`

**Recommendations**:
1. Install and configure `csurf` or use `csrf-sync` package
2. Add CSRF tokens to all forms and AJAX requests
3. Alternative: Use `SameSite=Strict` cookie attribute (partially implemented with Helmet)

---

## 🟡 MEDIUM Issues

### 4. XSS via `dangerouslySetInnerHTML` in Debug Page (MEDIUM)

**File**: `apps/frontend/src/pages/debug/ProductSearchDebug.tsx`

**Lines**: 204, 221, 239, 254

```tsx
<h3 dangerouslySetInnerHTML={{
  __html: highlightText(product.name),
}} />
```

**Analysis**: The `highlightText` function creates `<mark>` tags from user search queries. While the product data comes from database, the search query is user-controlled and could inject malicious HTML.

**Risk**: Reflected XSS if a malicious query string is crafted.

**Recommendations**:
1. Use DOMPurify to sanitize output (like in `MessageRenderer.tsx`)
2. Or escape HTML entities in `highlightText`:
```typescript
const escapeHtml = (text: string) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
```

✅ **Good Practice Found**: `MessageRenderer.tsx` properly uses DOMPurify sanitization.

---

### 5. Overly Permissive CORS in Development (MEDIUM)

**File**: `apps/backend/src/app.ts:52-73`

```typescript
cors({
  origin:
    process.env.NODE_ENV === "production"
      ? [process.env.FRONTEND_URL || "http://localhost:3000"]
      : [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:3002",
          "http://localhost:5173",
        ],
  credentials: true,
  // ...
})
```

**Risk**: In development mode, multiple localhost ports are allowed. This is fine for dev, but ensure production CORS is properly configured.

**Concern**: The fallback `http://localhost:3000` in production is dangerous.

**Recommendation**:
```typescript
origin:
  process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL 
      ? [process.env.FRONTEND_URL]
      : (() => { throw new Error('FRONTEND_URL required in production') })()
    : [...devOrigins],
```

---

### 6. NPM Vulnerability: esbuild/vite (MEDIUM)

**Package**: `vite` (via `esbuild`)
**Severity**: Moderate (CVSS 5.3)
**Advisory**: GHSA-67mh-4wv8-2f99

**Description**: esbuild enables any website to send requests to the development server and read the response.

**Affected Versions**: `esbuild <=0.24.2`, `vite 0.11.0 - 6.1.6`

**Recommendation**: Upgrade vite to version 7.x or apply mitigations in vite config.

**Note**: This only affects development environment, not production builds.

---

### 7. Sensitive Data in Query Logs (MEDIUM)

**Files**: Multiple files contain debug logging that could expose sensitive data:
- `apps/backend/src/application/services/agent.service.ts` - logs raw SQL results
- `apps/backend/src/interfaces/http/controllers/workspace.controller.ts` - logs API keys partially

**Recommendation**:
1. Remove debug logging before production
2. Use log levels appropriately (DEBUG vs INFO)
3. Never log full API keys or tokens

---

### 8. Missing Input Validation on Some Endpoints (MEDIUM)

**Finding**: While `zod` validation exists for auth routes, not all endpoints have consistent validation.

**Examples of validated routes** ✅:
- `/auth/register` - validated with `registerSchema`
- `/auth/forgot-password` - validated with `forgotPasswordSchema`
- `/auth/reset-password` - validated with `resetPasswordSchema`

**Potentially unvalidated**: Some controller methods directly access `req.body` without schema validation.

**Recommendation**: Implement validation middleware for ALL endpoints that accept user input.

---

## 🟢 LOW Issues

### 9. bcrypt Salt Rounds Could Be Higher (LOW)

**File**: `apps/backend/src/utils/password.ts:4`

```typescript
const SALT_ROUNDS = 10;
```

**Analysis**: 10 rounds is the minimum recommended. Consider 12+ for higher security (at cost of performance).

**Recommendation**: Increase to 12 rounds for new passwords.

---

### 10. Wildcard CORS Pre-flight (LOW)

**File**: `apps/backend/src/app.ts:75`

```typescript
app.options("*", cors())
```

**Risk**: Allows pre-flight requests from any origin. Combined with the specific CORS config, this is mostly safe but could be tightened.

**Recommendation**: Apply the same origin restrictions to OPTIONS handler.

---

### 11. Math.random for Password Generation (LOW)

**File**: `apps/backend/src/utils/password.ts:39`

```typescript
password += chars.charAt(Math.floor(Math.random() * chars.length));
```

**Risk**: `Math.random()` is not cryptographically secure.

**Recommendation**: Use `crypto.randomBytes()` or `crypto.getRandomValues()`:
```typescript
import crypto from 'crypto';
const randomIndex = crypto.randomInt(chars.length);
```

---

## ✅ Security Controls PRESENT (Good Practices)

| Control | Status | Location |
|---------|--------|----------|
| **Rate Limiting** | ✅ Implemented | `auth.routes.ts` - login, 2FA, register, password reset |
| **Helmet Security Headers** | ✅ Implemented | `app.ts` with HSTS, CSP |
| **Password Hashing** | ✅ bcrypt | `utils/password.ts` |
| **JWT Expiration** | ✅ 1 day default | `config.ts` |
| **File Upload Validation** | ✅ MIME type + extension | `uploadMiddleware.ts` |
| **File Upload Size Limit** | ✅ 4MB max | `uploadMiddleware.ts` |
| **Path Traversal Prevention** | ✅ Sanitized filenames | `uploadMiddleware.ts` |
| **XSS Sanitization** | ✅ DOMPurify | `MessageRenderer.tsx` |
| **Workspace Isolation** | ✅ workspaceId filters | All repository queries |
| **Parameterized SQL** | ✅ Most queries | `$queryRaw` with template literals |
| **Input Validation** | ✅ Zod schemas | Auth routes |
| **HTTPS Redirect** | ✅ In production | `app.ts` |

---

## 📋 Remediation Priority

| Priority | Issue | Effort |
|----------|-------|--------|
| 🔴 P0 | Replace `$queryRawUnsafe` with `$queryRaw` | Low |
| 🔴 P0 | Remove JWT secret fallback, add validation | Low |
| 🟠 P1 | Implement CSRF protection | Medium |
| 🟡 P2 | Sanitize XSS in ProductSearchDebug | Low |
| 🟡 P2 | Fix production CORS fallback | Low |
| 🟡 P3 | Upgrade vite for dev server security | Low |
| 🟡 P3 | Remove debug logging before production | Low |
| 🟢 P4 | Use crypto.randomBytes for passwords | Low |

---

## 🔐 Recommended Security Hardening

1. **Enable 2FA enforcement** for admin accounts ✅ (already implemented)
2. **Add security headers monitoring** (Report-Only CSP)
3. **Implement API key rotation** for WhatsApp integration
4. **Add request ID tracking** for security incident investigation
5. **Consider WAF** (Web Application Firewall) for production

---

*Report generated by GitHub Copilot Security Audit*
