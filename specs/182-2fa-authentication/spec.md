# Feature Specification: Multi-Provider Authentication with Mandatory 2FA + Password Reset

**Feature Branch**: `182-2fa-authentication`  
**Created**: November 21, 2025  
**Updated**: November 21, 2025  
**Status**: Implementation Ready  
**Input**: User requirements:
- "Spectacular multi-provider authentication system with mandatory 2FA"
- "Registration: Email/Password + Google OAuth + Facebook + Apple Sign In"
- "ALL users MUST set up 2FA (mandatory for everyone, including social login)"
- "Password Reset: Email-based with secure token, double password confirmation"
- "Profile Pictures: From OAuth providers (URL), default avatar if none"
- "Security: Rate limiting, brute force protection, SQL injection prevention, password strength validation"
- "Testing: Unit tests (validation, hashing, token gen, email) + Security tests (rate limit, brute force, SQL injection)"
- "Multi-user workspace: Prepare UserWorkspace table for future (multiple users per workspace with roles)"
- "After reset password → redirect to login → 2FA required (keeps existing 2FA secret)"
- "UI: Complete rewrite from scratch, aligned with GdprPage design (shadcn/ui + Card components)"
- "All text in ENGLISH"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Manual Registration with Email/Password (Priority: P1)

A new user wants to create an account manually using email and password, then set up mandatory 2FA.

**Why this priority**: Core traditional authentication flow - foundation for users who prefer manual registration over social login.

**Independent Test**: Can be fully tested by completing registration form, receiving welcome email, and scanning QR code. Delivers a secure, registered user account ready for login.

**Acceptance Scenarios**:

1. **Given** user is on registration page, **When** user selects "Sign up with Email", **Then** system displays registration form with fields: email, password, first name, last name, and GDPR consent checkbox
2. **Given** registration data is valid, **When** user submits registration, **Then** system creates user account, displays QR code for mandatory 2FA setup, and sends welcome email
3. **Given** QR code is displayed, **When** user scans QR code with authenticator app (Google Authenticator, Authy, etc.), **Then** authenticator app adds the account and starts generating 6-digit codes
4. **Given** 2FA is set up, **When** user enters first 6-digit code to verify, **Then** system confirms 2FA setup, generates recovery codes, and redirects to login page
5. **Given** user provides invalid data (missing fields, weak password, invalid email), **When** user submits registration, **Then** system displays clear error messages for each validation failure
6. **Given** user tries to skip 2FA setup, **When** user attempts to close QR code screen, **Then** system prevents progression and displays "2FA is mandatory for all accounts"

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Registration form with validation, QR code display component, provider selection UI, error handling, loading states
- [ ] Backend API: POST /auth/register route with validation middleware, QR code generation endpoint
- [ ] Service Layer: User creation logic, 2FA secret generation, email sending, password hashing (bcrypt)
- [ ] Repository: User table creation with 2FA fields, email uniqueness validation
- [ ] Database: Migration for users table with 2FA columns + OAuth fields, seed data for testing
- [ ] Security: Password strength validation, rate limiting on registration, secure secret storage
- [ ] Testing: Unit tests for validation, integration tests for registration flow, 2FA setup tests
- [ ] Documentation: Swagger docs for /auth/register and /auth/setup-2fa endpoints
- [ ] Concurrency: Unique constraint on email to prevent duplicate registrations
- [ ] Code Cleanliness: Separate validation logic, reusable form components, clear error messages

---

### User Story 2 - Social Login Registration (Google/Facebook/Apple) (Priority: P1)

A new user wants to register quickly using their Google, Facebook, or Apple account, then complete mandatory 2FA setup.

**Why this priority**: Modern authentication standard - reduces friction and improves conversion rates. Equally important as manual registration.

**Independent Test**: Can be tested by clicking social login button, authorizing provider, receiving user data, setting up mandatory 2FA, and confirming account creation.

**Acceptance Scenarios**:

1. **Given** user is on registration page, **When** user clicks "Continue with Google" (or Facebook/Apple), **Then** system opens OAuth consent screen in popup
2. **Given** user authorizes OAuth provider, **When** provider returns user data (email, name, profile picture), **Then** system checks if email already exists
3. **Given** email is new (first registration), **When** OAuth data received, **Then** system creates user account with: email, firstName, lastName, profilePicture, authProvider (google/facebook/apple), passwordHash = null
4. **Given** new social user created, **When** account creation completes, **Then** system displays QR code for MANDATORY 2FA setup (same as manual registration)
5. **Given** 2FA setup required, **When** user scans QR code and verifies first code, **Then** system confirms 2FA, generates recovery codes, sends welcome email, and redirects to login
6. **Given** email already exists from different provider, **When** user tries social login, **Then** system links accounts and prompts "Link this [Provider] account to existing account?"
7. **Given** user tries to skip 2FA after social login, **When** user attempts to close QR screen, **Then** system blocks and displays "2FA mandatory - required for all authentication methods"

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Social login buttons (Google/Facebook/Apple), OAuth popup handling, account linking UI
- [ ] Backend API: POST /auth/oauth/google, /auth/oauth/facebook, /auth/oauth/apple routes
- [ ] Service Layer: OAuth token validation, provider-specific data extraction, account linking logic
- [ ] Repository: User lookup by email, authProvider field updates, profile picture storage
- [ ] Database: User table with authProvider, profilePicture, linkedProviders JSON fields
- [ ] Security: OAuth state parameter validation, CSRF protection, secure token exchange
- [ ] Testing: OAuth flow tests (mock providers), account linking tests, 2FA enforcement tests
- [ ] Documentation: Swagger docs for OAuth endpoints, provider setup instructions
- [ ] Concurrency: Handle simultaneous OAuth callbacks, prevent duplicate account creation
- [ ] Code Cleanliness: Separate OAuth service per provider, reusable linking logic

---

### User Story 3 - Multi-Method Login with Mandatory 2FA (Priority: P1)

A registered user wants to log in using any of their linked authentication methods (email/password or social provider), followed by mandatory 2FA verification.

**Why this priority**: Essential for users to access the system after registration. Supports all authentication methods equally.

**Independent Test**: Can be tested by entering credentials (manual or OAuth), verifying 2FA code, confirming sessionID generation, and redirect to Channel Selection page.

**Acceptance Scenarios**:

1. **Given** user is on login page, **When** user sees options, **Then** system displays 4 login methods: "Email/Password", "Continue with Google", "Continue with Facebook", "Continue with Apple"
2. **Given** user selects email/password login, **When** user enters correct credentials, **Then** system validates credentials and prompts for 6-digit 2FA code
3. **Given** user selects social login (Google/Facebook/Apple), **When** OAuth authorization completes, **Then** system validates user exists and prompts for 6-digit 2FA code
4. **Given** user is prompted for 2FA code, **When** user enters valid code from authenticator app, **Then** system validates code, generates sessionID, and redirects to Channel Selection page
5. **Given** user enters incorrect 2FA code, **When** user submits code, **Then** system displays error message and allows retry (max 3 attempts before 15-minute lockout)
6. **Given** user enters incorrect email/password, **When** user submits credentials, **Then** system displays generic error "Invalid credentials" (no 2FA prompt for security)
7. **Given** social login user never set password, **When** user tries email/password login, **Then** system displays "No password set - use social login or reset password"
8. **Given** user successfully logs in, **When** sessionID is generated, **Then** sessionID stored in AdminSession table with userId, workspaceId=null, expiresAt=+24h
9. **Given** user enters recovery code instead of 2FA, **When** user submits valid recovery code, **Then** system accepts code, logs user in, and warns "Recovery code used - regenerate codes in settings"

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Unified login page with 4 auth methods, 2FA code input, OAuth popup handling, recovery code fallback
- [ ] Backend API: POST /auth/login (email/password), POST /auth/oauth/{provider}/callback routes, POST /auth/verify-2fa
- [ ] Service Layer: Multi-provider credential validation, 2FA code verification, recovery code validation, sessionID generation
- [ ] Repository: User lookup by email, AdminSession creation, authentication attempt logging
- [ ] Database: AdminSession table usage, indexes on sessionId and userId
- [ ] Security: Brute force protection (rate limiting), session expiration, secure sessionID generation (UUID v4)
- [ ] Testing: Login flow tests for all 4 methods, invalid credential tests, 2FA timeout tests, recovery code tests
- [ ] Documentation: Swagger docs for all login endpoints, OAuth callback URLs
- [ ] Concurrency: Session creation with unique constraint, handle simultaneous login attempts
- [ ] Code Cleanliness: Unified authentication service, provider-agnostic 2FA validation

---

---

### User Story 4 - Session Management for Authenticated Requests (Priority: P1)

An authenticated user wants to make API calls using their sessionID without re-authenticating each time.

**Why this priority**: Required for all protected features. Without session management, users would need to re-authenticate for every action.

**Independent Test**: Can be tested by logging in, making API calls with sessionID header, verifying access granted, and testing session expiration.

**Acceptance Scenarios**:

1. **Given** user has valid sessionID, **When** user makes API request with sessionID in header, **Then** system validates session and grants access
2. **Given** user's session has expired (24 hours after creation), **When** user makes API request, **Then** system returns 401 Unauthorized and prompts re-login
3. **Given** user logs out, **When** user clicks logout, **Then** system invalidates sessionID and removes it from storage
4. **Given** user has no sessionID or invalid sessionID, **When** user attempts to access protected route, **Then** system redirects to login page
5. **Given** user is inactive for 30 minutes, **When** user attempts action, **Then** system extends session for another 24 hours (sliding window)

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Session storage management, sessionID header injection, automatic logout on 401
- [ ] Backend API: Session validation middleware applied to all protected routes
- [ ] Service Layer: Session lookup and validation, session expiration logic, session refresh
- [ ] Repository: Session queries with workspaceId isolation where applicable
- [ ] Database: Session status field (active/expired/logged_out), createdAt/expiresAt indexes
- [ ] Security: sessionMiddleware checks session validity before route access, secure session invalidation
- [ ] Testing: Session validation tests, expiration tests, logout tests, concurrent session tests
- [ ] Documentation: Document sessionID header requirement in Swagger for all protected endpoints
- [ ] Concurrency: Handle session refresh race conditions with optimistic locking
- [ ] Code Cleanliness: Centralized session middleware, clear error responses

---

---

### User Story 5 - Channel Selection After Login (Priority: P2)

An authenticated user without a workspace wants to see Channel Selection page where they can create a new workspace or select an existing one (if invited).

**Why this priority**: Important for user onboarding flow, but login itself (P1) can complete without this. Separates authentication from workspace management.

**Independent Test**: Can be tested by logging in and verifying redirect to Channel Selection page with "Create New Workspace" button visible.

**Acceptance Scenarios**:

1. **Given** user successfully logs in with 2FA, **When** authentication completes, **Then** system redirects to Channel Selection page
2. **Given** user is on Channel Selection page with no workspaces, **When** page loads, **Then** system displays "Create New Workspace" button prominently
3. **Given** user has been invited to workspaces, **When** page loads, **Then** system displays list of available workspaces plus "Create New Workspace" button
4. **Given** user clicks "Create New Workspace", **When** button is clicked, **Then** system navigates to workspace creation flow
5. **Given** user selects existing workspace, **When** workspace is clicked, **Then** system sets workspace context and redirects to main application

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Channel Selection page component, workspace list display, create button
- [ ] Backend API: GET /workspaces/available route to fetch user's workspaces
- [ ] Service Layer: Workspace access validation, user-workspace relationship queries
- [ ] Repository: UserWorkspace junction table queries
- [ ] Database: Ensure UserWorkspace table exists with proper foreign keys
- [ ] Security: Verify user can only see workspaces they have access to
- [ ] Testing: Access control tests, empty workspace list tests, invitation flow tests
- [ ] Documentation: Swagger docs for /workspaces/available endpoint
- [ ] Concurrency: Not applicable (read-only query)
- [ ] Code Cleanliness: Reusable workspace card component, clean routing logic

---

---

### User Story 6 - Add Password to Social Account (Priority: P2)

A user who registered via social login wants to add a password to enable email/password login as backup method.

**Why this priority**: Important for account flexibility and recovery, but not critical for initial login flow. User can add this later.

**Independent Test**: Can be tested by social user accessing account settings, creating password, and verifying email/password login works.

**Acceptance Scenarios**:

1. **Given** user registered via social login (passwordHash = null), **When** user accesses account settings, **Then** system displays "Add Password" option
2. **Given** user clicks "Add Password", **When** user enters new password twice, **Then** system validates password strength and saves hashed password
3. **Given** password added successfully, **When** save completes, **Then** system displays "Password added - you can now login with email/password" and sends confirmation email
4. **Given** social user now has password, **When** user attempts login, **Then** system shows both social login buttons AND email/password form
5. **Given** user enters weak password, **When** user submits, **Then** system displays password requirements (8+ chars, uppercase, lowercase, number, special)

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Account settings page, add password form, password strength indicator
- [ ] Backend API: POST /auth/add-password route with authentication middleware
- [ ] Service Layer: Password validation, bcrypt hashing, user update logic
- [ ] Repository: User update to set passwordHash field
- [ ] Database: User.passwordHash nullable field (supports null for social-only users)
- [ ] Security: Re-authentication required before adding password, password strength validation
- [ ] Testing: Add password tests, email/password login after adding password tests
- [ ] Documentation: Swagger docs for /auth/add-password endpoint
- [ ] Concurrency: Optimistic locking on user update
- [ ] Code Cleanliness: Reuse password validation logic from registration

---

### User Story 7 - Welcome Email Notification (Priority: P3)

A newly registered user wants to receive a welcome email confirming their registration and providing next steps.

**Why this priority**: Nice-to-have feature that improves user experience but not critical for core functionality. Email delivery can be asynchronous.

**Independent Test**: Can be tested by registering a new user and verifying welcome email is sent with correct content and recipient.

**Acceptance Scenarios**:

1. **Given** user completes registration successfully, **When** account is created, **Then** system sends welcome email to registered email address
2. **Given** welcome email is sent, **When** user checks inbox, **Then** email contains greeting with user's name, confirmation of registration, and link to login page
3. **Given** email service is unavailable, **When** registration completes, **Then** system logs error but does not block registration (email sent asynchronously)
4. **Given** user provides invalid email format, **When** user submits registration, **Then** system rejects registration before attempting to send email

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: No frontend changes required (handled server-side)
- [ ] Backend API: Email sending triggered in registration service
- [ ] Service Layer: Integration with EmailService, welcome email template creation
- [ ] Repository: Not applicable (uses existing EmailService)
- [ ] Database: Email audit log table for tracking sent emails (optional)
- [ ] Security: Ensure email contains no sensitive data, validate recipient email
- [ ] Testing: Email sending tests (mock EmailService), template rendering tests
- [ ] Documentation: Document email notification behavior in API docs
- [ ] Concurrency: Queue email sending to avoid blocking registration response
- [ ] Code Cleanliness: Separate email template file, reusable email service method

---

### Edge Cases

- What happens when user loses access to authenticator app (2FA device)? → User can use recovery codes (10 single-use codes generated during 2FA setup, stored in User.recoveryCodes array)
- How does system handle user attempting to register with existing email? → Display clear error "Email already registered" without revealing if account exists (security)
- What happens when user enters 2FA code at exact moment it expires? → System accepts codes with 30-second grace period (time-window validation with ±1 step tolerance)
- How does system prevent brute force attacks on 2FA codes? → Implement rate limiting: 3 failed attempts = 15-minute lockout, log suspicious activity in AuthenticationAttempt table
- What happens when sessionID is stolen/compromised? → Implement session invalidation on password change, "logout from all devices" option in settings
- How does system handle concurrent login from multiple devices? → Allow multiple active sessions per user (AdminSession table supports it), track device/IP for each session
- What happens when user forgets which email was used? → No "forgot email" feature - user must remember email used for registration
- How does system handle special characters in email/password? → Email validated with RFC 5322 regex, password allows all printable ASCII, input sanitized to prevent injection
- What happens when email service fails during registration? → Registration succeeds, email queued for retry (background job), user can request resend from account settings
- How does system handle timezone differences for session expiration? → Use UTC timestamps for all session operations (AdminSession.expiresAt), consistent across all servers
- **What happens when OAuth provider is down during login?** → Display error "Google/Facebook/Apple temporarily unavailable - try email/password login or try again later"
- **What happens when user revokes OAuth permissions after registration?** → Next login attempt via that provider fails, user must re-authorize or use different login method
- **What happens when OAuth provider returns different email than original registration?** → Treat as new account or prompt "Link this account to existing [Provider] account?"
- **What happens when user registers with Google then tries Facebook with same email?** → System detects matching email, prompts "Link Facebook account to existing account?" with confirmation step
- **What happens when user has no password but tries email/password login?** → Display "No password set for this account - use Google/Facebook/Apple login or click 'Add Password' in settings"
- **What happens when social provider doesn't return profile picture?** → Use default avatar, allow user to upload custom picture in settings
- **What happens when user tries to register with social login but manually closes OAuth popup?** → Display "Authorization cancelled - please complete sign-in to continue"
- **What happens when 2FA mandatory but user refuses to set it up?** → Account created but cannot proceed to app - stuck on 2FA setup screen with "2FA required to access your account"
- **What happens when recovery code is used?** → Code is removed from User.recoveryCodes array (single-use), user warned "X recovery codes remaining - regenerate codes in settings"
- **What happens when all recovery codes are exhausted?** → User must contact support for manual account recovery (admin override)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide multiple registration methods: Email/Password form, "Continue with Google" button, "Continue with Facebook" button, "Continue with Apple" button
- **FR-002**: System MUST validate password strength for manual registration (minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special character)
- **FR-003**: System MUST enforce unique email addresses across all users (regardless of registration method)
- **FR-004**: System MUST support OAuth 2.0 authentication flows for Google, Facebook, and Apple Sign In
- **FR-005**: System MUST extract user data from OAuth providers: email (required), firstName, lastName, profilePicture URL
- **FR-006**: System MUST save profilePicture URL from social providers to User.profilePicture field
- **FR-007**: System MUST create user account with passwordHash=null for social-only registrations
- **FR-008**: System MUST generate QR code containing TOTP secret immediately after successful registration (manual OR social)
- **FR-009**: System MUST enforce MANDATORY 2FA setup for ALL users (manual and social login) before allowing app access
- **FR-010**: System MUST display QR code to user with instructions to scan using authenticator app (Google Authenticator, Authy, Microsoft Authenticator)
- **FR-011**: System MUST verify 2FA setup by requiring user to enter first 6-digit code before completing registration
- **FR-012**: System MUST generate 10 single-use recovery codes during 2FA setup and store in User.recoveryCodes array
- **FR-013**: System MUST display recovery codes to user with instruction "Save these codes - they can only be viewed once"
- **FR-014**: System MUST send welcome email to registered email address after successful registration (all methods)
- **FR-015**: System MUST provide unified login page with 4 authentication options: Email/Password, Google, Facebook, Apple
- **FR-016**: System MUST validate email/password credentials OR OAuth tokens before prompting for 2FA
- **FR-017**: System MUST prompt for 6-digit 2FA code only after valid credential/token verification
- **FR-018**: System MUST validate 2FA codes using TOTP algorithm with 30-second time window
- **FR-019**: System MUST accept 2FA codes with one time-step tolerance (current ± 30-second window)
- **FR-020**: System MUST accept recovery codes as alternative to 2FA code (single-use, remove from array after use)
- **FR-021**: System MUST generate unique sessionID (UUID v4 format) upon successful 2FA verification
- **FR-022**: System MUST store sessionID in AdminSession table with: userId, workspaceId (null initially), createdAt, expiresAt (+24h), ipAddress, userAgent, isActive=true
- **FR-023**: System MUST require sessionID in request header (x-session-id) for all protected API endpoints
- **FR-024**: System MUST validate sessionID on each protected request and reject invalid/expired sessions
- **FR-025**: System MUST extend session expiration by 24 hours on each successful request (sliding window via lastActivityAt update)
- **FR-026**: System MUST redirect authenticated users to Channel Selection page after successful login
- **FR-027**: System MUST display "Create New Workspace" button on Channel Selection page
- **FR-028**: System MUST implement rate limiting: max 5 login attempts per email per 15 minutes (across all auth methods)
- **FR-029**: System MUST implement 2FA verification rate limiting: max 3 failed attempts before 15-minute lockout
- **FR-030**: System MUST hash passwords using bcrypt with minimum 10 salt rounds before storage (when password provided)
- **FR-031**: System MUST store 2FA secrets encrypted at rest in User.twoFactorSecret field
- **FR-032**: System MUST provide logout functionality that sets AdminSession.isActive=false immediately
- **FR-033**: System MUST log all authentication events in AuthenticationAttempt table: email, attemptType (registration/login/2fa/oauth), success, failureReason, ipAddress, timestamp
- **FR-034**: System MUST prevent registration if GDPR consent checkbox is not checked (manual registration only)
- **FR-035**: System MUST support account linking: allow user to link multiple OAuth providers to same email
- **FR-036**: System MUST store authProvider field in User table (values: "email", "google", "facebook", "apple", "multi" if linked)
- **FR-037**: System MUST allow social-only users to add password later via "Add Password" feature in account settings
- **FR-038**: System MUST display appropriate login methods based on user's account type (show all methods if password exists, show "Add Password" prompt if social-only)
- **FR-039**: System MUST handle OAuth errors gracefully (provider down, authorization cancelled, invalid token)
- **FR-040**: System MUST prevent 2FA bypass attempts (cannot access app without completing 2FA setup)

### Key Entities _(include if feature involves data)_

- **User** (existing table - extends): System user with NEW attributes: twoFactorEnabled (Boolean), twoFactorEnabledAt (DateTime), recoveryCodes (String array), authProvider (String: email/google/facebook/apple/multi), profilePicture (String URL), linkedProviders (Json array). EXISTING: id, email, passwordHash (nullable for social-only users), firstName, lastName, twoFactorSecret, gdprAccepted, role, status, createdAt, updatedAt
- **AdminSession** (existing table - reuse): Active user session with attributes: id, sessionId (unique), userId, workspaceId (nullable), createdAt, expiresAt, lastActivityAt, isActive, ipAddress, userAgent
- **UserWorkspace** (existing table - extends for future invites): User-workspace relationship. NEW for invite feature: invitedBy (userId), invitedAt (DateTime), status (PENDING/ACTIVE/REVOKED), permissions (Json). EXISTING: userId, workspaceId, role
- **AuthenticationAttempt** (new table): Audit log with attributes: id, email, attemptType (registration/login/2fa/oauth-google/oauth-facebook/oauth-apple), success, failureReason, ipAddress, userAgent, timestamp
- **OAuthToken** (optional new table): OAuth refresh tokens with attributes: id, userId, provider (google/facebook/apple), accessToken (encrypted), refreshToken (encrypted), expiresAt, createdAt

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: New users can complete registration (any method) and mandatory 2FA setup in under 3 minutes
- **SC-002**: Social login users (Google/Facebook/Apple) complete registration in under 1 minute (faster than manual)
- **SC-003**: Returning users can log in with any method + 2FA code in under 30 seconds
- **SC-004**: System blocks 99.9% of brute force attacks through rate limiting and mandatory 2FA
- **SC-005**: Session validation adds less than 50ms latency to protected API requests
- **SC-006**: Welcome emails are delivered within 2 minutes of registration for 95% of users
- **SC-007**: Zero successful unauthorized access attempts using stolen passwords alone (2FA enforcement prevents this)
- **SC-008**: 90% of users successfully set up 2FA on first attempt without support (clear QR code instructions)
- **SC-009**: Session management supports 10,000 concurrent authenticated users without degradation
- **SC-010**: Account lockout mechanisms reduce failed login attempts by 80% compared to systems without 2FA
- **SC-011**: Users can access Channel Selection page immediately after login (under 1 second redirect time)
- **SC-012**: OAuth login flows complete authorization in under 5 seconds (provider popup → callback → 2FA prompt)
- **SC-013**: 70% of new users choose social login over manual registration (measure conversion rate)
- **SC-014**: Account linking success rate above 95% when user tries to register with same email via different provider
- **SC-015**: Recovery code usage rate stays below 5% of all login attempts (indicates low 2FA device loss)

## Assumptions

- Existing EmailService in codebase supports sending HTML emails with templates
- Channel Selection page component already exists and can be reused
- Users have access to smartphone or device capable of running authenticator apps
- QR code will encode TOTP URI format: `otpauth://totp/eChatbot:email?secret=SECRET&issuer=eChatbot`
- Session storage will use existing AdminSession table (already has sessionId, userId, workspaceId, expiration)
- User table already exists with: email, passwordHash, firstName, lastName, twoFactorSecret, gdprAccepted
- OAuth providers (Google, Facebook, Apple) require app registration and API credentials setup
- Google OAuth uses `@react-oauth/google` library on frontend
- Facebook OAuth uses official Facebook SDK or OAuth 2.0 flow
- Apple Sign In uses Apple's OAuth 2.0 flow with JWT verification
- OAuth callback URLs will be whitelisted in provider console (e.g., https://echatbot.ai/auth/oauth/google/callback)
- Password is optional for social-only users (passwordHash can be null)
- Password reset flow will be handled in separate feature (not included here)
- Account recovery uses recovery codes (10 codes generated during 2FA setup, stored in User.recoveryCodes array)
- Multi-device login is allowed (same user can have multiple active AdminSession records)
- SessionID will be passed in custom header `x-session-id` (already used by AdminSession)
- Email is used as unique identifier (no separate username field)
- GDPR consent uses existing gdprAccepted field (DateTime, null = not accepted)
- Welcome email template will use existing EmailService template system
- 2FA implementation will use industry-standard TOTP (Time-based One-Time Password) compatible with RFC 6238
- No workspace is created automatically - users must explicitly create one after login via Channel Selection page
- Rate limiting will use in-memory store (Redis recommended for production but not required in spec)
- UserWorkspace table will be extended in future feature to support invites (invitedBy, invitedAt, status, permissions)
- Profile pictures from OAuth providers are stored as URLs (not downloaded/stored locally)
- OAuth tokens can be stored for future API calls to provider (optional OAuthToken table)

## Dependencies

- Existing EmailService must support `sendWelcomeEmail()` method or similar
- GdprContent table must be populated with consent text in supported languages (for display during registration)
- Channel Selection page component must be available in frontend routing
- User table exists with fields: email, passwordHash (nullable), firstName, lastName, twoFactorSecret, gdprAccepted
- AdminSession table exists for session management
- UserWorkspace table exists for workspace access control
- OAuth provider credentials (Client ID, Client Secret) for Google, Facebook, Apple must be configured
- Google OAuth Client ID registered in Google Cloud Console with authorized redirect URIs
- Facebook App ID and App Secret registered in Facebook Developer Portal
- Apple Developer account with Sign In with Apple enabled and Service ID configured
- Frontend has @react-oauth/google library installed (or equivalent for Facebook/Apple)
- Database migration system must support adding new fields and creating new tables
- Frontend routing must support protected routes with session validation
- Frontend routing must support OAuth callback routes (/auth/oauth/{provider}/callback)

## Out of Scope

- Password reset/forgot password flow (separate feature)
- Account recovery for exhausted recovery codes (requires admin/support intervention)
- Additional social providers beyond Google, Facebook, Apple (e.g., Twitter, LinkedIn, GitHub)
- Multi-factor authentication beyond 2FA (e.g., biometrics, hardware keys like YubiKey)
- Workspace creation flow (exists separately - this feature only handles redirect to Channel Selection)
- User profile editing (name, email change, profile picture upload)
- Account deletion/deactivation
- Admin user management (approvals, role assignment)
- SMS-based 2FA (authenticator app only)
- Email verification link (account is active immediately after 2FA setup)
- "Remember this device" option (2FA required on every login for maximum security)
- Session management UI (view active sessions, logout from all devices)
- OAuth token refresh logic (if storing tokens for provider API calls - marked as optional)
- Account migration (merging duplicate accounts with same email from different providers)
- Custom OAuth scopes beyond basic profile data (email, name, picture)
- Enterprise SSO (SAML, LDAP, Azure AD - only consumer OAuth providers)
