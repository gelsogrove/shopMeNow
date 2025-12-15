# Feature Specification: Complete Authentication Flow Fixes

**Feature Branch**: `183-complete-auth-flow-fixes`  
**Created**: 2025-11-24  
**Status**: ✅ **IMPLEMENTED** - Authentication simplified to JWT-only (sessionId removed)  
**Input**: Complete authentication flow fixes: registration, login, 2FA, recovery codes, multilingual support

## 🎯 **ARCHITECTURE DECISION**: JWT Token Only (No SessionId)

**Decision**: System uses **ONLY JWT tokens** for authentication. SessionId system has been **completely removed**.

**Rationale**:
- ✅ **Simpler**: One authentication mechanism instead of two overlapping systems
- ✅ **Stateless**: No database queries per request for session validation
- ✅ **Standard**: JWT is industry standard for API authentication
- ❌ **Trade-off**: Cannot force logout immediately (token valid until expiry)

**Implementation**:
- JWT Token stored in `localStorage` (7-day expiry)
- Header: `Authorization: Bearer <token>`
- Logout: Clear localStorage (client-side only)
- Middleware: `authMiddleware` validates JWT (no sessionValidationMiddleware)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - New User Registration Flow (Priority: P1)

A new user creates an account using email/password or Google OAuth, receives a welcome email in their language, and lands on the workspace selection page ready to start using the platform.

**Why this priority**: This is the entry point for all new users - without a working registration flow, no one can use the platform.

**Independent Test**: User can complete registration from start to finish, receive confirmation email, and access workspace selection page. Can be tested by creating a new test user and verifying the complete flow.

**Acceptance Scenarios**:

1. **Given** user is on registration page, **When** user fills email/password/name and submits, **Then** account is created, welcome email sent in user's selected language, and user redirected to workspace selection page
2. **Given** user clicks "Sign up with Google", **When** Google auth completes successfully, **Then** account is created with Google profile data, welcome email sent, and user redirected to workspace selection page
3. **Given** user registers with existing email, **When** form is submitted, **Then** user sees error message "Email already registered" in their selected language
4. **Given** user completes registration, **When** checking email inbox, **Then** welcome email is in the language selected during registration (IT/EN/ES/PT)

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Registration form with email/password/Google OAuth, language selector, error handling, loading states
- [ ] Backend API: POST /api/auth/register route, validation middleware, enhanced-auth.controller
- [ ] Service Layer: User creation, duplicate email check, workspace isolation, email sending with language support
- [ ] Repository: User creation query, email uniqueness validation
- [ ] Database: User table with all required fields (twoFactorEnabled=false by default)
- [ ] Security: Password hashing (bcrypt), OAuth2 token validation, no session creation before email verification
- [ ] Testing: Unit tests for user creation, duplicate email rejection, Google OAuth flow
- [ ] Documentation: Swagger updated with registration endpoint
- [ ] Concurrency: Handle simultaneous registrations with same email (unique constraint)
- [ ] Code Cleanliness: No temp files, clean imports, email templates organized by language

---

### User Story 2 - Standard Login Flow (Non-Admin Users) (Priority: P1)

Regular users (non-admin) login with email/password, complete 2FA verification if enabled, and are redirected to workspace selection page with a valid session.

**Why this priority**: Core authentication flow - users cannot access the platform without successful login.

**Independent Test**: Create test user without 2FA, login, verify redirect to workspace selection with active session. Then enable 2FA and verify TOTP requirement.

**Acceptance Scenarios**:

1. **Given** user without 2FA enters valid credentials, **When** login submitted, **Then** sessionId + token created, user redirected to /workspace-selection
2. **Given** user with 2FA enabled enters valid credentials, **When** login submitted, **Then** user redirected to /auth/verify-2fa page (NO sessionId created yet)
3. **Given** user on 2FA verification page enters valid TOTP code, **When** code submitted, **Then** sessionId + token created, user redirected to /workspace-selection
4. **Given** user enters invalid credentials, **When** login submitted, **Then** error message "Invalid email or password" shown in user's language
5. **Given** login page loads, **When** user has previously selected Italian language, **Then** all UI text and error messages display in Italian

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Login form, language persistence, 2FA detection, proper redirect handling
- [ ] Backend API: POST /api/auth/login route, authMiddleware exemption, conditional sessionId creation
- [ ] Service Layer: User authentication, 2FA check BEFORE session creation, language detection from Accept-Language header
- [ ] Repository: User lookup by email with 2FA fields (twoFactorEnabled, twoFactorSecret)
- [ ] Database: User entity includes twoFactorEnabled, twoFactorSecret, twoFactorEnabledAt, recoveryCodes
- [ ] Security: CRITICAL - sessionId created ONLY after 2FA verification (if enabled), JWT token signing
- [ ] Testing: Unit test "should NOT create sessionId when 2FA enabled", integration test for complete login flow
- [ ] Documentation: Swagger updated with login endpoint responses (requires2FA vs normal login)
- [ ] Concurrency: Session creation race condition handling (unique constraint on active sessions)
- [ ] Code Cleanliness: Login flow clear separation between 2FA-required vs normal login

---

### User Story 3 - 2FA Recovery Code Flow (Priority: P1)

User with 2FA enabled but without access to their authenticator app uses a recovery code to login, the code is consumed after use, and user is redirected to workspace selection.

**Why this priority**: Critical fallback for users who lose access to their authenticator app - without this, they are locked out permanently.

**Independent Test**: Enable 2FA for test user, logout, login with email/password, choose "Use recovery code instead", verify code consumption and successful login.

**Acceptance Scenarios**:

1. **Given** user with 2FA enabled on verification page, **When** user clicks "Use recovery code instead", **Then** recovery code input field is shown
2. **Given** user enters valid recovery code, **When** code submitted, **Then** code is marked as consumed, sessionId + token created, user redirected to /workspace-selection
3. **Given** user enters already-used recovery code, **When** code submitted, **Then** error "Recovery code already used" shown in user's language (401 Unauthorized)
4. **Given** user enters invalid recovery code, **When** code submitted, **Then** error "Invalid recovery code" shown in user's language (401 Unauthorized)
5. **Given** user successfully uses recovery code, **When** checking response, **Then** response includes sessionId, token, user object, and valid=true field

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Recovery code input toggle, error handling, sessionId storage, redirect to workspace selection
- [ ] Backend API: POST /api/auth/verify-recovery-code route, session middleware exemption
- [ ] Service Layer: Recovery code verification (uppercase comparison), code consumption, sessionId creation
- [ ] Repository: Recovery code lookup and consumption update
- [ ] Database: User recoveryCodes array, bcrypt hashed with uppercase
- [ ] Security: Recovery codes hashed with bcrypt, uppercase normalization, one-time use enforcement, 401 for invalid/consumed codes
- [ ] Testing: Unit test recovery code consumption, duplicate usage rejection, invalid code rejection
- [ ] Documentation: Swagger updated with recovery code endpoint
- [ ] Concurrency: Transaction-based code consumption to prevent race conditions
- [ ] Code Cleanliness: Recovery code verification consistent with TOTP verification

---

### User Story 4 - Forgot Password Flow (Priority: P2)

User who forgot their password requests a password reset email, receives it in their language, clicks the reset link, sets a new password, and can login with the new credentials.

**Why this priority**: Essential recovery mechanism for users who forget passwords - prevents account lockout.

**Independent Test**: Request password reset, receive email in selected language, click link, set new password, verify login works with new password.

**Acceptance Scenarios**:

1. **Given** user on forgot-password page selects Italian language, **When** user enters email and submits, **Then** reset email sent in Italian with reset link
2. **Given** user clicks reset link from email, **When** link is valid and not expired, **Then** user sees password reset form in their language
3. **Given** user on reset form enters new password, **When** form submitted with valid token, **Then** password updated, user redirected to login page with success message
4. **Given** user clicks expired reset link, **When** link is opened, **Then** error "Reset link expired" shown in user's language
5. **Given** forgot-password page loads, **When** user has selected Portuguese, **Then** all UI text and email sent in Portuguese

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Forgot password form with language selector, Accept-Language header sent, error handling in user's language
- [ ] Backend API: POST /api/auth/forgot-password, POST /api/auth/reset-password routes
- [ ] Service Layer: Token generation (24h expiry), email sending with language support, password update
- [ ] Repository: User lookup by email, password hash update
- [ ] Database: Password reset token storage with expiry timestamp
- [ ] Security: Reset token cryptographically secure, single-use enforcement, 24-hour expiration
- [ ] Testing: Unit test token generation/validation, email language selection, expired token rejection
- [ ] Documentation: Swagger updated with forgot-password endpoints
- [ ] Concurrency: Token uniqueness, prevent multiple simultaneous resets
- [ ] Code Cleanliness: Email templates organized by language (IT/EN/ES/PT)

---

### User Story 5 - Admin 2FA Setup Flow (Priority: P2)

Admin user enables 2FA from settings page, scans QR code with Google Authenticator, saves 10 recovery codes, and verifies setup by entering a TOTP code.

**Why this priority**: Admins have elevated privileges - 2FA is essential for security. This is the setup flow that precedes the login flow.

**Independent Test**: Login as admin, go to Settings → Enable 2FA, scan QR code, save recovery codes, verify TOTP, logout and login again to confirm 2FA works.

**Acceptance Scenarios**:

1. **Given** admin on settings page, **When** admin clicks "Enable 2FA", **Then** QR code and secret key displayed with instructions in admin's language
2. **Given** QR code displayed, **When** admin scans with Google Authenticator, **Then** 6-digit TOTP codes appear in authenticator app
3. **Given** admin enters valid TOTP code, **When** code submitted, **Then** 2FA enabled, 10 recovery codes generated and displayed
4. **Given** recovery codes displayed, **When** admin saves codes, **Then** warning shown: "Save these codes - each can only be used once"
5. **Given** 2FA setup complete, **When** admin logs out and logs in again, **Then** TOTP code required before access granted

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Settings page with 2FA enable button, QR code display, recovery codes modal, TOTP verification
- [ ] Backend API: POST /api/auth/setup-2fa, POST /api/auth/verify-2fa-setup routes
- [ ] Service Layer: TOTP secret generation (speakeasy), QR code generation, recovery code generation (10 codes)
- [ ] Repository: User update with twoFactorSecret, twoFactorEnabled, twoFactorEnabledAt, recoveryCodes
- [ ] Database: User table with 2FA fields, recovery codes bcrypt hashed
- [ ] Security: TOTP secret cryptographically secure, recovery codes bcrypt hashed with uppercase, QR code short-lived
- [ ] Testing: Unit test 2FA setup flow, recovery code generation, TOTP verification
- [ ] Documentation: Swagger updated with 2FA setup endpoints
- [ ] Concurrency: Prevent multiple simultaneous 2FA setups for same user
- [ ] Code Cleanliness: 2FA logic separated into EnhancedAuthService

---

### User Story 6 - Session Management & Security (Priority: P1)

Sessions are created only after complete authentication (including 2FA if enabled), stored in sessionStorage (expires on tab close), validated on every protected API call, and cleared on logout.

**Why this priority**: Core security requirement - improper session handling leads to authentication bypass vulnerabilities.

**Independent Test**: Login, verify sessionId in sessionStorage, close tab and verify session expired, make API call without sessionId and verify 401 error.

**Acceptance Scenarios**:

1. **Given** user completes login (with or without 2FA), **When** authentication succeeds, **Then** sessionId saved to sessionStorage and included in all subsequent API calls via x-session-id header
2. **Given** user with active session closes browser tab, **When** user opens new tab and visits site, **Then** session is expired, user must login again
3. **Given** API call to protected endpoint, **When** x-session-id header missing or invalid, **Then** 401 Unauthorized returned with error "Session required"
4. **Given** user with 2FA enabled logs in with email/password, **When** checking backend logs, **Then** NO sessionId created until TOTP/recovery code verified
5. **Given** user clicks logout, **When** logout completes, **Then** sessionId removed from sessionStorage, token removed from localStorage, user redirected to login page

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: sessionStorage for sessionId (not localStorage), x-session-id header in all API calls, clearSessionId on logout
- [ ] Backend API: sessionValidationMiddleware on all protected routes, SESSION_EXEMPT_ROUTES list
- [ ] Service Layer: AdminSessionService.createSession (only after complete auth), session validation logic
- [ ] Repository: Session creation with unique constraint (customerId + status="active")
- [ ] Database: ChatSession table with workspaceId, customerId, status, createdAt, updatedAt
- [ ] Security: Session created AFTER 2FA (CRITICAL), session expires on tab close (sessionStorage), workspace isolation enforced
- [ ] Testing: Unit test "should NOT create sessionId before 2FA", session expiration tests, concurrent session handling
- [ ] Documentation: Swagger documents x-session-id header requirement
- [ ] Concurrency: Session creation race condition prevention (transaction + unique constraint)
- [ ] Code Cleanliness: Session middleware clearly documented with exemption list

---

### User Story 7 - Multilingual Support (Priority: P2)

All authentication pages (login, register, forgot-password, 2FA, recovery codes) and all emails (welcome, password reset) display in the user's selected language (IT/EN/ES/PT).

**Why this priority**: International user base - users must understand authentication flow in their language.

**Independent Test**: Change language to Spanish, register new user, verify UI and emails in Spanish. Repeat for all languages.

**Acceptance Scenarios**:

1. **Given** user selects Italian on homepage, **When** user navigates to login page, **Then** all UI text (labels, buttons, errors) display in Italian
2. **Given** user with Italian language preference registers, **When** registration completes, **Then** welcome email sent in Italian
3. **Given** user on forgot-password page with Portuguese selected, **When** user requests reset, **Then** reset email sent in Portuguese
4. **Given** user sees error "Invalid email or password", **When** user has English selected, **Then** error displays as "Invalid email or password"
5. **Given** user switches language from English to Spanish, **When** user clicks logout and returns, **Then** language preference persisted (Italian remains selected)

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: LanguageContext with IT/EN/ES/PT, default language "it", language persisted in localStorage
- [ ] Backend API: Accept-Language header detection, language parameter in email sending
- [ ] Service Layer: Email templates with language support, translation function for error messages
- [ ] Repository: N/A (language is not stored in database, it's session-based)
- [ ] Database: N/A (language preference in frontend localStorage)
- [ ] Security: Language selection does not affect authentication logic
- [ ] Testing: Unit test language detection from Accept-Language header, email template selection
- [ ] Documentation: Swagger documents Accept-Language header usage
- [ ] Concurrency: Language selection per-user, no global state
- [ ] Code Cleanliness: Email templates organized in email-templates.ts with IT/EN/ES/PT sections

---

### User Story 8 - Workspace Selection After Authentication (Priority: P1)

After successful authentication (with sessionId + token), user is redirected to workspace selection page, can see their workspaces, and can select one to enter the main application.

**Why this priority**: Critical redirect target - all authentication flows end here. Without this working, users are stuck in login loop.

**Independent Test**: Complete any authentication flow (login, register, 2FA), verify redirect to /workspace-selection, verify user can select workspace and enter application.

**Acceptance Scenarios**:

1. **Given** user completes authentication, **When** redirect to /workspace-selection occurs, **Then** user's workspaces loaded from API using sessionId
2. **Given** user on workspace selection page, **When** page loads, **Then** sessionId verified in sessionStorage (if missing, show error)
3. **Given** user selects a workspace, **When** workspace selected, **Then** workspaceId saved to localStorage and context, user redirected to dashboard
4. **Given** user lands on workspace selection after registration, **When** no workspaces exist, **Then** "Create New Workspace" form shown
5. **Given** workspace selection API call fails, **When** sessionId invalid or expired, **Then** user redirected to login page with "Session expired" message

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: WorkspaceSelectionPage checks sessionId in sessionStorage, loads workspaces via API, handles redirect to dashboard
- [ ] Backend API: GET /api/workspaces route with authMiddleware + sessionValidationMiddleware
- [ ] Service Layer: Workspace loading with userId from JWT token
- [ ] Repository: Workspace query filtered by user association
- [ ] Database: UserWorkspace junction table for user-workspace relationships
- [ ] Security: Workspace data filtered by authenticated user, session validation enforced
- [ ] Testing: Integration test for workspace selection after login, session validation test
- [ ] Documentation: Swagger updated with workspace selection endpoint
- [ ] Concurrency: Workspace loading concurrent-safe (read-only operation)
- [ ] Code Cleanliness: Workspace selection logic clearly separated from authentication

---

### Edge Cases

- **What happens when user enables 2FA but loses all recovery codes?**
  - System provides "Contact Support" link on recovery code page
  - Admin can manually disable 2FA for locked-out users via database

- **What happens when user tries to register with Google but email already exists?**
  - System links Google account to existing user account (if email matches)
  - User can then login with either email/password OR Google OAuth

- **What happens when sessionId expires during active use?**
  - API returns 401 Unauthorized
  - Frontend intercepts 401, clears session, redirects to login
  - User sees toast: "Session expired, please login again"

- **What happens when user has 2FA enabled but browser doesn't support sessionStorage?**
  - Fallback to localStorage for sessionId (less secure but functional)
  - Warning shown to user about security implications

- **What happens when user tries to use same recovery code twice?**
  - Second attempt returns 401 Unauthorized
  - Error message: "This recovery code has already been used"

- **What happens when password reset link is clicked multiple times?**
  - First use marks token as consumed
  - Subsequent uses return "Reset link already used or expired"

- **What happens when user switches language mid-authentication flow?**
  - Language change applies immediately to UI
  - Backend respects Accept-Language header for emails
  - No authentication state lost

- **What happens when multiple tabs are open with same user?**
  - All tabs share same sessionId (sessionStorage is tab-specific but we sync via localStorage events)
  - Logout in one tab triggers logout in all tabs

- **What happens when user loses authenticator device and uses recovery code?**
  - User can login with one of remaining recovery codes
  - After login, user should go to Settings → "Re-configure 2FA"
  - System generates NEW QR code (new TOTP secret)
  - User scans with new device/authenticator app
  - Recovery codes remain UNCHANGED (same codes, just fewer remaining)

## Requirements _(mandatory)_

### Functional Requirements

**FR1: Registration**
- System MUST create new user accounts via email/password or Google OAuth
- System MUST send welcome email in user's selected language (IT/EN/ES/PT)
- System MUST prevent duplicate email registrations
- System MUST redirect successful registration to workspace selection page
- System MUST NOT create sessionId until after email verification (future enhancement)

**FR2: Login**
- System MUST authenticate users with email/password
- System MUST check if 2FA is enabled BEFORE creating sessionId
- If 2FA enabled: System MUST redirect to /auth/verify-2fa (NO sessionId created)
- If 2FA disabled: System MUST create sessionId + token and redirect to /workspace-selection
- System MUST display all error messages in user's selected language

**FR3: 2FA Authentication**
- System MUST require TOTP code from Google Authenticator if user has 2FA enabled
- System MUST create sessionId + token ONLY after valid TOTP code verified
- System MUST redirect to /workspace-selection after successful 2FA verification
- System MUST provide "Use recovery code instead" option on 2FA page

**FR4: Recovery Codes**
- System MUST accept recovery codes as alternative to TOTP
- System MUST mark recovery code as consumed after successful use
- System MUST reject already-used recovery codes with 401 Unauthorized
- System MUST reject invalid recovery codes with 401 Unauthorized
- System MUST create sessionId + token after valid recovery code verified
- System MUST compare recovery codes in uppercase (normalized)

**FR5: Forgot Password**
- System MUST send password reset email with 24-hour expiry token
- System MUST send reset email in user's selected language
- System MUST allow password reset with valid token
- System MUST reject expired or already-used tokens
- System MUST redirect to login page after successful password reset

**FR6: 2FA Setup**
- System MUST generate TOTP secret and QR code for Google Authenticator
- System MUST generate 10 recovery codes (bcrypt hashed, uppercase)
- System MUST display recovery codes to user with "save these" warning
- System MUST enable 2FA only after valid TOTP code verified
- System MUST update user record with twoFactorEnabled, twoFactorSecret, recoveryCodes

**FR6b: 2FA Re-configuration**
- System MUST allow users to regenerate QR code (new TOTP secret) if device lost
- System MUST invalidate old TOTP secret when new QR code generated
- System MUST keep existing recovery codes unchanged during re-configuration
- System MUST require valid TOTP from new device before activating new secret
- System SHOULD show warning: "You have X recovery codes remaining" in settings

**FR7: Session Management**
- System MUST create sessionId ONLY after complete authentication (including 2FA if enabled)
- System MUST store sessionId in sessionStorage (expires on tab close)
- System MUST validate x-session-id header on all protected API calls
- System MUST return 401 Unauthorized if sessionId missing or invalid
- System MUST clear sessionId on logout

**FR8: Multilingual Support**
- System MUST support IT/EN/ES/PT languages
- System MUST default to Italian ("it") if no language selected
- System MUST detect language from Accept-Language header for emails
- System MUST display all UI text and error messages in user's language
- System MUST persist language selection in localStorage

**FR9: Redirects**
- System MUST redirect to /workspace-selection after successful authentication
- System MUST redirect to /auth/verify-2fa if 2FA required
- System MUST redirect to /login if session expired or invalid
- System MUST redirect to /dashboard after workspace selected

**FR10: Error Handling**
- System MUST return 401 for invalid credentials, expired tokens, invalid recovery codes
- System MUST return 400 for validation errors (missing fields, weak passwords)
- System MUST return 409 for duplicate email registration
- System MUST display all errors in user's selected language
- System MUST log all authentication attempts with success/failure reason

### Non-Functional Requirements

**NFR1: Security**
- Passwords MUST be hashed with bcrypt (salt rounds >= 10)
- Recovery codes MUST be bcrypt hashed with uppercase normalization
- JWT tokens MUST expire after 24 hours
- Password reset tokens MUST expire after 24 hours
- TOTP secrets MUST be cryptographically secure (speakeasy library)
- SessionId MUST be unique and cryptographically random

**NFR2: Performance**
- Login response time MUST be under 2 seconds
- 2FA verification MUST complete in under 1 second
- Email sending MUST not block authentication flow (async)
- Database queries MUST use indexes on email, sessionId

**NFR3: Reliability**
- System MUST handle concurrent login attempts (unique session constraint)
- System MUST handle race conditions in recovery code consumption (transactions)
- System MUST recover gracefully from email service failures (log error, continue)

**NFR4: Testability**
- MUST have unit tests for all authentication flows (target: >80% coverage)
- MUST have integration tests for complete end-to-end flows
- MUST have security tests for session creation timing (before vs after 2FA)
- MUST have concurrency tests for simultaneous logins

**NFR5: Maintainability**
- Authentication logic MUST be separated into services (EnhancedAuthService, AdminSessionService)
- Email templates MUST be organized by language in email-templates.ts
- Session middleware MUST have clear exemption list (SESSION_EXEMPT_ROUTES)

## Success Criteria _(mandatory)_

1. **Registration Success**: 95% of users complete registration within 2 minutes and receive welcome email in their language within 30 seconds
2. **Login Success**: Users without 2FA can login and reach workspace selection in under 5 seconds
3. **2FA Login Success**: Users with 2FA can complete authentication (including TOTP entry) in under 30 seconds
4. **Recovery Code Success**: Users can successfully use recovery code to login when authenticator unavailable (100% success rate for valid codes)
5. **Password Reset Success**: Users receive reset email within 1 minute and can complete password reset in under 3 minutes
6. **Session Security**: Zero instances of sessionId created before 2FA verification (100% security compliance)
7. **Language Support**: 100% of UI text and emails display in user's selected language (no English fallbacks)
8. **Test Coverage**: Minimum 80% code coverage for authentication-related code
9. **Error Rate**: Less than 1% of authentication attempts fail due to system errors (excluding invalid credentials)
10. **User Satisfaction**: Post-authentication survey shows >90% find process clear and straightforward

## Assumptions

1. Users have access to email for verification and password reset
2. Users with 2FA have access to smartphone with Google Authenticator or similar TOTP app
3. Users will save recovery codes in secure location when presented
4. SessionStorage is available in all target browsers (fallback to localStorage if not)
5. Email service (SMTP) is reliable and available
6. Database supports transactions for concurrent operation safety
7. Frontend and backend are deployed on same domain (or CORS configured)
8. JWT secret is securely stored in environment variables

## Dependencies

- **External Services**: Email service (SMTP), Google OAuth API
- **Libraries**: bcrypt (password hashing), speakeasy (TOTP), jsonwebtoken (JWT), nodemailer (email)
- **Database**: PostgreSQL with Prisma ORM
- **Frontend**: React with React Router, Axios for API calls
- **Backend**: Express.js with middleware stack

## Out of Scope

- Email verification before first login (future enhancement)
- SMS-based 2FA (only TOTP supported)
- Biometric authentication
- Social login providers other than Google (Facebook, Apple, etc.)
- Account deletion by users (admin-only feature)
- Multi-device session management dashboard
- CAPTCHA for login attempts (future security enhancement)
- Rate limiting for authentication endpoints (future security enhancement)

## Key Entities

**User**
- id (UUID, primary key)
- email (string, unique)
- passwordHash (string, bcrypt)
- firstName (string)
- lastName (string)
- status (enum: ACTIVE, SUSPENDED)
- role (enum: USER, ADMIN)
- twoFactorEnabled (boolean, default: false)
- twoFactorSecret (string, nullable)
- twoFactorEnabledAt (timestamp, nullable)
- recoveryCodes (string array, bcrypt hashed, nullable)
- createdAt (timestamp)
- updatedAt (timestamp)

**ChatSession** (represents user session)
- id (UUID, primary key)
- customerId (UUID, references User.id)
- workspaceId (UUID, references Workspace.id, nullable initially)
- status (enum: active, expired, closed)
- createdAt (timestamp)
- updatedAt (timestamp)
- Unique constraint: (customerId, status) where status='active'

**PasswordResetToken**
- id (UUID, primary key)
- userId (UUID, references User.id)
- token (string, cryptographically secure)
- expiresAt (timestamp, +24 hours)
- used (boolean, default: false)
- createdAt (timestamp)

**AuthAttempt** (audit log)
- id (UUID, primary key)
- userId (UUID, references User.id, nullable)
- email (string)
- attemptType (enum: login, 2fa, recovery_code, password_reset)
- success (boolean)
- failureReason (string, nullable)
- ipAddress (string)
- userAgent (string)
- createdAt (timestamp)

## Testing Strategy

### Unit Tests
- User creation with duplicate email detection
- Password hashing and verification
- 2FA secret generation and TOTP validation
- Recovery code generation and verification
- Recovery code consumption (single-use enforcement)
- Password reset token generation and validation
- Language detection from Accept-Language header
- Email template selection by language
- SessionId creation timing (MUST NOT create before 2FA)

### Integration Tests
- Complete registration flow (email/password)
- Complete registration flow (Google OAuth)
- Login without 2FA → workspace selection
- Login with 2FA → TOTP verification → workspace selection
- Login with 2FA → recovery code → workspace selection
- Forgot password → reset email → password change → login
- 2FA setup → QR code → recovery codes → verification
- Session validation on protected endpoints
- Language switching across authentication flows

### Security Tests
- **CRITICAL**: SessionId NOT created before 2FA verification
- Recovery code cannot be reused
- Password reset token cannot be reused
- Expired tokens rejected
- Invalid credentials return 401
- Session validation on protected routes
- Workspace isolation in session queries

### Concurrency Tests
- Simultaneous registrations with same email (unique constraint)
- Simultaneous logins creating multiple sessions (unique active session constraint)
- Simultaneous recovery code usage (transaction-based consumption)
- Simultaneous password reset requests

### End-to-End Tests
- New user journey: register → receive email → workspace selection → create workspace → dashboard
- Returning user journey: login → (optional 2FA) → workspace selection → dashboard
- Lost password journey: forgot password → email → reset → login → dashboard
- Lost authenticator journey: login → recovery code → workspace selection → dashboard

## Implementation Plan

### Phase 1: Core Authentication & Session Management (CRITICAL)
**Priority**: P1  
**Duration**: 2-3 days

**Tasks**:
1. Fix User entity to include all 2FA fields (twoFactorEnabled, twoFactorSecret, twoFactorEnabledAt, recoveryCodes)
2. Fix UserRepository.mapToDomain() to include 2FA fields
3. Fix auth.controller.ts login() to check twoFactorEnabled BEFORE creating sessionId
4. Fix SESSION_EXEMPT_ROUTES to include /auth/verify-2fa and /auth/verify-recovery-code
5. Fix enhanced-auth.controller.ts verifyRecoveryCode() to create sessionId after verification
6. Fix enhanced-auth.controller.ts to return 401 (not 400) for invalid/consumed recovery codes
7. Update seed.ts to NOT enable 2FA by default (allow testing setup flow)

**Deliverables**:
- SessionId created ONLY after complete authentication
- All authentication endpoints working with proper session management
- Unit tests passing for session creation timing

**Success Criteria**:
- Test "should NOT create sessionId when 2FA enabled" passes
- Login flow redirects correctly based on 2FA status
- Recovery code flow creates sessionId and redirects to workspace selection

---

### Phase 2: Multilingual Support
**Priority**: P2  
**Duration**: 1-2 days

**Tasks**:
1. Fix LanguageContext default language to "it"
2. Add Accept-Language header to all authentication API calls
3. Update email-templates.ts with IT/EN/ES/PT sections
4. Update all frontend pages to use translation context
5. Update error messages to support all languages

**Deliverables**:
- All UI text in user's selected language
- All emails in user's selected language
- Language persisted across authentication flow

**Success Criteria**:
- User selects Italian, all pages and emails in Italian
- User switches to Spanish, UI updates immediately
- Language preference persists after logout/login

---

### Phase 3: Redirects & User Flow
**Priority**: P1  
**Duration**: 1 day

**Tasks**:
1. Fix redirect to /workspace-selection after successful authentication
2. Fix redirect to /auth/verify-2fa when 2FA required
3. Fix WorkspaceSelectionPage to check sessionId before loading workspaces
4. Fix logout to clear sessionId and redirect to login
5. Add error handling for expired sessions (401 → clear session → redirect to login)

**Deliverables**:
- All authentication flows end at correct page
- No redirect loops
- Session expiration handled gracefully

**Success Criteria**:
- User completes registration → workspace selection
- User completes login (no 2FA) → workspace selection
- User completes 2FA → workspace selection
- User session expires → login page with message

---

### Phase 4: Comprehensive Testing
**Priority**: P1  
**Duration**: 2-3 days

**Tasks**:
1. Write unit tests for all authentication services
2. Write integration tests for complete authentication flows
3. Write security tests for session management
4. Write concurrency tests for race conditions
5. Write E2E tests for user journeys
6. Fix any failing tests

**Deliverables**:
- Minimum 80% code coverage for authentication code
- All unit tests passing
- All integration tests passing
- All security tests passing
- Test documentation updated

**Success Criteria**:
- `npm run test:unit` passes with >80% coverage
- `npm run test:integration` passes all authentication tests
- `npm run test:security` passes all session security tests
- No authentication flow breaks under concurrent load

---

### Phase 5: Documentation & Code Cleanup
**Priority**: P2  
**Duration**: 1 day

**Tasks**:
1. Update Swagger documentation for all authentication endpoints
2. Add JSDoc comments with @swagger tags
3. Clean up temporary files and unused code
4. Organize imports in all files
5. Update README with authentication flow diagrams

**Deliverables**:
- Swagger UI shows all authentication endpoints
- Code is clean and well-documented
- No temporary files or dead code
- README includes authentication diagrams

**Success Criteria**:
- Swagger UI accessible and accurate
- Code review finds no cleanliness issues
- README provides clear authentication documentation

## Risks & Mitigations

**Risk**: Users lose all recovery codes and authenticator access
- **Mitigation**: Provide "Contact Support" workflow for manual 2FA reset by admin

**Risk**: Email service fails during critical flows
- **Mitigation**: Log email failures, continue authentication, retry email sending async

**Risk**: SessionId conflicts during concurrent logins
- **Mitigation**: Unique constraint on (customerId, status='active'), transaction-based creation

**Risk**: Recovery code race condition (two simultaneous uses)
- **Mitigation**: Database transaction wrapping recovery code verification and consumption

**Risk**: Language detection fails or is unsupported
- **Mitigation**: Fallback to default language "it", log warning

**Risk**: Frontend sessionStorage not available
- **Mitigation**: Fallback to localStorage, show security warning to user

**Risk**: JWT token expiration during active session
- **Mitigation**: Frontend intercepts 401, refreshes token or redirects to login

**Risk**: Test coverage insufficient to catch bugs
- **Mitigation**: Enforce minimum 80% coverage, mandatory integration tests for all flows

## Notes

This specification is a comprehensive fix for the authentication system. The primary focus is:

1. **Security First**: SessionId must ONLY be created after complete authentication (including 2FA)
2. **User Experience**: All flows must be smooth with proper redirects and language support
3. **Testability**: Every flow must have unit, integration, and security tests
4. **Code Quality**: No temporary files, clean imports, organized structure

The implementation must follow the **360-Degree Thinking** principle from the constitution:
- Frontend → API → Middleware → Controller → Service → Repository → Database
- Security tests for workspace isolation and session management
- Comprehensive testing at every layer

**CRITICAL**: The sessionId creation timing is the most important security fix. All tests must verify this behavior.
