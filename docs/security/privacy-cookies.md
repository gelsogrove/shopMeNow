# 🔒 Privacy & Cookies - GDPR Compliance

**Version**: 1.1.0  
**Last Updated**: January 9, 2026  
**Status**: ✅ GDPR Compliant - No cookie banner required

---

## 📋 Cookie Usage Summary

### ONLY Essential Cookies (No Banner Required)

eChatbot uses **ONLY essential cookies** required for core functionality:

| Cookie/Storage | Purpose | Legal Basis | Consent Required |
|---|---|---|---|
| `token` (JWT) | Authentication - Keep user logged in | Contractual | ❌ No |
| `sessionId` | Session validation - Track active session | Contractual | ❌ No |
| `user` | User info - Display name, email | Contractual | ❌ No |
| `workspace` | Current workspace ID - Multi-workspace support | Contractual | ❌ No |
| `language` | User's preferred language - UI localization | Convenience | ❌ No |

### ❌ NO Google Analytics

eChatbot does **NOT** use:
- Google Analytics
- Facebook Pixel
- Any third-party tracking
- Any marketing cookies
- Any profiling tools

### ✅ Updated Privacy Policy

All language versions (Italian, English, Spanish, Portuguese, etc.) now state:

> **"We use ONLY essential cookies required for authentication and session management. We do NOT use Google Analytics, Facebook Pixel, or any third-party tracking."**

---

## 🏗️ Storage Architecture

### localStorage Structure

```javascript
// Authentication
localStorage['token']              // JWT token (expires server-side)
localStorage['sessionId']          // Session ID from header x-session-id

// User Context
localStorage['user']               // { id, email, name, role }
localStorage['workspace']          // { id, name, currency, language }
localStorage['language']           // "it" | "en" | "es" | "pt"

// Feature State (Non-sensitive)
localStorage['login_email_remembered']  // Email for "Remember Me" checkbox
localStorage['sidebar_collapsed']       // UI preference
localStorage['theme']                   // "light" | "dark"
```

### sessionStorage (Session Only)

```javascript
// Temporary data cleared on browser close
sessionStorage['chat_draft']            // Unsaved chat message
sessionStorage['upload_progress']       // File upload state
```

---

## 🔐 GDPR Compliance Checklist

### ✅ Article 7 - Consent

- [x] **Essential cookies**: NO consent required
- [x] **Policy transparency**: Clear explanation of what's stored
- [x] **User control**: Users can clear localStorage anytime

### ✅ Article 17 - Right to Erasure

- [x] **Upon request**: Delete all user data (request via email to privacy@echatbot.ai)
- [x] **Data export**: User can request full data export (21 days processing)
- [x] **Pseudonymization**: Session tokens do not identify individuals

### ✅ Article 21 - Right to Object

- [x] **Opt-out**: No tracking, so nothing to opt out from
- [x] **Preferences**: User controls language, theme, workspace

### ✅ Articles 13-14 - Transparency

- [x] **Privacy notice**: Visible in settings → "Privacy Policy"
- [x] **Data controller**: Company info on privacy page
- [x] **Processing purpose**: Clear explanation of each storage item

### ✅ Article 32 - Security

- [x] **HTTPS only**: All communication encrypted
- [x] **No sensitive data**: Passwords NEVER stored in localStorage
- [x] **Session expiry**: Tokens expire automatically
- [x] **XSS protection**: Framework sanitizes inputs

---

## 🚫 What We DON'T Do

| Forbidden Action | Status |
|---|---|
| Sell user data | ✅ Never |
| Share with third parties | ✅ Never |
| Create user profiles | ✅ Never |
| Track user behavior | ✅ Never |
| Use Google Analytics | ✅ Never |
| Use Facebook Pixel | ✅ Never |
| Store passwords in localStorage | ✅ Never |
| Store payment details in localStorage | ✅ Never |
| Use tracking pixels | ✅ Never |
| Create shadow profiles | ✅ Never |

---

## 📝 Privacy Policy Translations

### English (UK)

> We use ONLY essential cookies required for authentication and session management. These cookies are necessary for the platform to function and cannot be disabled without preventing the service from working. We do NOT use Google Analytics, Facebook Pixel, or any third-party tracking services.

### Italian (Italy)

> Utilizziamo SOLO cookie essenziali richiesti per l'autenticazione e la gestione della sessione. Questi cookie sono necessari affinché la piattaforma funzioni e non possono essere disabilitati senza impedire il funzionamento del servizio. NON utilizziamo Google Analytics, Facebook Pixel o qualsiasi altro servizio di tracciamento di terze parti.

### Spanish (Spain)

> Utilizamos SOLO cookies esenciales requeridas para la autenticación y la gestión de sesiones. Estas cookies son necesarias para que la plataforma funcione y no se pueden desactivar sin impedir que el servicio funcione. NO utilizamos Google Analytics, Facebook Pixel o ningún otro servicio de seguimiento de terceros.

### Portuguese (Portugal)

> Usamos APENAS cookies essenciais necessários para autenticação e gerenciamento de sessão. Esses cookies são necessários para o funcionamento da plataforma e não podem ser desabilitados sem impedir o funcionamento do serviço. NÃO usamos Google Analytics, Facebook Pixel ou qualquer outro serviço de rastreamento de terceiros.

---

## 🛠️ Implementation Details

### Frontend Cookie Management

**File**: `frontend/src/lib/storage.ts`

```typescript
// Centralized storage access (no direct localStorage calls)
export const storage = {
  getToken: () => localStorage.getItem('token'),
  setToken: (token: string) => localStorage.setItem('token', token),
  clearToken: () => localStorage.removeItem('token'),
  
  getUser: () => JSON.parse(localStorage.getItem('user') || '{}'),
  setUser: (user: any) => localStorage.setItem('user', JSON.stringify(user)),
  clearUser: () => localStorage.removeItem('user'),
  
  // ... similar for workspace, language, etc.
}
```

### No Cookie Library

❌ **NOT used**: 
- `js-cookie` library
- `cookie-consent` library
- Any banner library

✅ **Used**: 
- Browser native `localStorage` and `sessionStorage`
- Framework's built-in session handling

---

## 🔄 User Rights Implementation

### 1. Access Your Data

**How**: Admin panel → Settings → "Export my data"
- Generates JSON export of:
  - User profile
  - Workspaces
  - Messages
  - Orders
  - Credit history
- Sent via email within 7 days

### 2. Delete Your Data

**How**: Admin panel → Settings → "Delete my account"
- Marks user as soft-deleted
- All data retained 90 days (recovery window)
- Permanent delete after 90 days
- Or request via email for immediate deletion

### 3. Rectify Your Data

**How**: Admin panel → Settings → Edit profile
- Update: Email, name, language
- Changes apply immediately
- No processing delay

### 4. Data Portability

**How**: Admin panel → Settings → "Export my data"
- Same as "Access Your Data"
- Includes all workspace data
- Format: JSON (machine-readable)

---

## 📞 Contact for Privacy Questions

**Email**: privacy@echatbot.ai  
**Response Time**: Within 14 days (GDPR requirement)  
**Include**: Full name, workspace ID, specific request

### Common Requests

| Request | Processing Time | Method |
|---|---|---|
| Data export | 7 days | Email link or download |
| Data deletion | Immediate | Account settings or email |
| Policy clarification | 2 days | Email response |
| Cookie questions | 2 days | Email response |
| GDPR SAR | 30 days | Email with full data package |

---

## ⚠️ Important Notes

### Cookie Banner NOT Needed

According to GDPR Article 7 and ePrivacy Directive:
- ✅ Essential cookies do NOT need consent
- ✅ No need for cookie banner
- ✅ No need for "Accept All" / "Reject" buttons
- ⚠️ ONLY if third-party tracking is added, banner becomes required

### If We Add Third-Party Analytics

IF Google Analytics or similar is added in future:
1. Add cookie consent banner ❌ (Not done yet)
2. Get explicit user consent
3. Update privacy policy
4. Update all language versions
5. Audit for GDPR compliance

### Browser Storage Vs Cookies

**localStorage** (used by eChatbot):
- Not technically HTTP cookies
- Not sent with every request
- User can view/delete in DevTools
- More secure for sensitive data

**HTTP Cookies**:
- Sent with every request (overhead)
- Visible in HTTP headers
- Can be HttpOnly (not accessible to JS)
- Traditional browser storage

eChatbot uses **localStorage** which is MORE GDPR-friendly than cookies.

---

## 🔗 Related Documents

- [Billing Architecture](./billing.md) - How credit/subscription is handled
- [Storage System](./storage.md) - Technical storage implementation
- [Authentication Flow](./authentication.md) - Session management
- [Remember Me Feature](../features/remember-me.md) - Email persistence (localStorage usage)

---

## 📚 GDPR References

- **GDPR Article 7** - Consent conditions
- **GDPR Article 17** - Right to erasure ("right to be forgotten")
- **GDPR Article 20** - Data portability
- **GDPR Article 21** - Right to object
- **ePrivacy Directive 2002/58/EC** - Cookie regulations
- **EDPB Guidelines 05/2020** - Consent and cookies guidance

---

**Last Audit**: January 9, 2026 ✅ Fully Compliant
