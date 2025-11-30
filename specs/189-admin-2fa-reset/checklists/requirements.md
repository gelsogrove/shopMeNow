# 189: Auth Recovery & Multi-Provider Support - Requirements Checklist

## PART A: Recovery Codes Removal

### Backend - Remove Recovery Codes
- [ ] FR-1: Remove `recoveryCodes` field from User entity
- [ ] FR-2: Remove `/api/auth/verify-recovery-code` endpoint
- [ ] FR-3: Remove recovery code generation in `enable2FA()`
- [ ] FR-4: Remove recovery code storage in database

### Frontend - Remove Recovery Codes
- [ ] FR-5: Remove recovery codes page/component
- [ ] FR-6: Remove "Use recovery code" link from 2FA verify page
- [ ] FR-7: Update 2FA setup success page (no codes displayed)
- [ ] FR-8: Add "Contact admin for help" message on 2FA page

---

## PART A: Admin 2FA Reset

### Backend - 2FA Reset Endpoints
- [ ] FR-9: Add `POST /api/users/admin/:userId/reset-2fa` endpoint
- [ ] FR-10: Generate secure reset token (UUID + 1hr expiry)
- [ ] FR-11: Store reset token in database (TwoFactorResetToken table)
- [ ] FR-12: Send reset email via email service
- [ ] FR-13: Add `GET /api/auth/2fa-reset/:token` to validate token
- [ ] FR-14: Add `POST /api/auth/2fa-reset/:token/verify` - password verification
- [ ] FR-15: Add `POST /api/auth/2fa-reset/:token/complete` for 2FA setup
- [ ] FR-16: Mark token as used after successful reset
- [ ] FR-17: Create audit log entry

### Frontend - Backoffice
- [ ] FR-18: Add "Reset 2FA" button to user cards in ClientsPage
- [ ] FR-19: Confirmation dialog before reset
- [ ] FR-20: Success/error toast after action
- [ ] FR-21: Show 2FA status badge on user cards

### Frontend - 2FA Reset Flow
- [ ] FR-22: Create `/auth/2fa-reset/:token` page
- [ ] FR-23: Show error for invalid/expired token
- [ ] FR-24: Password verification form (email + password)
- [ ] FR-25: After password verified → redirect to 2FA setup
- [ ] FR-26: Force 2FA completion before any navigation
- [ ] FR-27: Redirect to login after successful setup

---

## PART B: OAuth Set Password

### Backend
- [ ] FR-28: Add `POST /api/users/set-password` endpoint
- [ ] FR-29: Only allow if `passwordHash` is null
- [ ] FR-30: Validate new password (8+ chars, rules)
- [ ] FR-31: Update `authProvider` to "multi"
- [ ] FR-32: Hash and store password

### Frontend - ProfilePage
- [ ] FR-33: Show "Set Password" if OAuth user without password
- [ ] FR-34: Show "Change Password" if user has password
- [ ] FR-35: Set Password modal: only newPassword + confirm (no current)
- [ ] FR-36: Success toast after setting password

---

## Non-Functional Requirements

### Security
- [ ] NFR-1: Reset tokens are cryptographically secure (UUID v4)
- [ ] NFR-2: Tokens expire after 1 hour
- [ ] NFR-3: Tokens can only be used once
- [ ] NFR-4: Only platformAdmin can initiate reset
- [ ] NFR-5: Password verification required before 2FA reset
- [ ] NFR-6: Audit log for all reset actions
- [ ] NFR-7: Rate limiting on reset requests (max 3/user/day)
- [ ] NFR-8: Set Password only if passwordHash is null
- [ ] NFR-9: Account lockout after 5 failed password attempts (15 min)
- [ ] NFR-10: Generic error messages (no email enumeration)
- [ ] NFR-11: Admin cannot reset own 2FA
- [ ] NFR-12: Rate limit per admin (max 10 resets/hour)
- [ ] NFR-13: Old 2FA secret invalidated immediately on reset initiation
- [ ] NFR-14: No JWT until 2FA complete (temp token only)
- [ ] NFR-15: Token validation rate limit (5 attempts/IP/hour)
- [ ] NFR-16: Never log full token (only first 8 chars)

### Performance
- [ ] NFR-17: Email delivery within 30 seconds
- [ ] NFR-18: Token validation response < 500ms

---

## Security Tests (MANDATORY - 18 tests)

### Token Security (SEC-1 to SEC-5)
- [ ] SEC-1: Token must be UUID v4 format
- [ ] SEC-2: Expired tokens (>1hr) must be rejected
- [ ] SEC-3: Used tokens must be rejected on second use
- [ ] SEC-4: Rate limit validation after 5 failed attempts per IP
- [ ] SEC-5: Full token never appears in logs

### Password Verification (SEC-6 to SEC-8)
- [ ] SEC-6: Account lockout after 5 failed password attempts
- [ ] SEC-7: Generic error message for invalid credentials (no user enumeration)
- [ ] SEC-8: No JWT issued before 2FA setup complete (only tempToken)

### Admin Endpoint (SEC-9 to SEC-12)
- [ ] SEC-9: Non-admin users get 403 on reset endpoint
- [ ] SEC-10: Admin cannot reset own 2FA (get 400)
- [ ] SEC-11: Admin rate limited after 10 resets/hour (get 429)
- [ ] SEC-12: Audit log created with admin ID and target user

### Flow Security (SEC-13 to SEC-15)
- [ ] SEC-13: Cannot access any endpoint with tempToken except 2FA setup
- [ ] SEC-14: Old 2FA secret nullified immediately on reset initiation
- [ ] SEC-15: 2FA setup can only be completed once per token

### Set Password (SEC-16 to SEC-18)
- [ ] SEC-16: Users with existing password get 400 on set-password
- [ ] SEC-17: Weak passwords rejected with specific error
- [ ] SEC-18: Unauthenticated requests get 401

---

## Unit Tests

### Backend Unit Tests
- [ ] TEST-1: `TwoFactorResetService.createResetToken()` - creates valid token
- [ ] TEST-2: `TwoFactorResetService.validateToken()` - validates token correctly
- [ ] TEST-3: `TwoFactorResetService.validateToken()` - rejects expired token
- [ ] TEST-4: `TwoFactorResetService.validateToken()` - rejects used token
- [ ] TEST-5: `TwoFactorResetService.verifyPassword()` - validates credentials
- [ ] TEST-6: `TwoFactorResetService.verifyPassword()` - handles lockout
- [ ] TEST-7: `TwoFactorResetService.complete2FASetup()` - enables 2FA
- [ ] TEST-8: `AuthService.setPassword()` - sets password for OAuth user
- [ ] TEST-9: `AuthService.setPassword()` - rejects if password exists
- [ ] TEST-10: Email template renders correctly

### Frontend Unit Tests
- [ ] TEST-11: ProfilePage shows "Set Password" for OAuth users
- [ ] TEST-12: ProfilePage shows "Change Password" for email users
- [ ] TEST-13: 2FA Reset page handles invalid token
- [ ] TEST-14: 2FA Reset page shows password form
- [ ] TEST-15: ClientsPage shows Reset 2FA button
- [ ] TEST-16: ClientsPage confirmation dialog works

---

## Integration Tests

- [ ] INT-1: Full reset flow: admin reset → email → verify password → 2FA setup
- [ ] INT-2: Full set-password flow: OAuth user → set password → login with email
- [ ] INT-3: Worst case: forgot password → reset 2FA → both flows complete
- [ ] INT-4: Rate limiting integration test

---

## Testing

## Database Changes

- [ ] DB-1: Migration to add `TwoFactorResetToken` table
- [ ] DB-2: Migration to remove `recoveryCodes` from User
- [ ] DB-3: Add relation User → TwoFactorResetToken
- [ ] DB-4: Update seed script if needed

---

## Documentation

- [ ] DOC-1: Update API documentation (Swagger)
- [ ] DOC-2: Update PRD with new flows
- [ ] DOC-3: Create user-facing help text
- [ ] DOC-4: Document authProvider values ("email", "google", "multi")

---

## Acceptance Criteria Verification

### Scenario A1: Admin Resets User 2FA (with password)
- [ ] AC-A1.1: Admin can reset 2FA for any non-admin user
- [ ] AC-A1.2: Email sent within 30 seconds
- [ ] AC-A1.3: Link expires after 1 hour
- [ ] AC-A1.4: User MUST enter correct password before 2FA setup
- [ ] AC-A1.5: User MUST complete 2FA setup before any navigation
- [ ] AC-A1.6: Audit log records: who reset, for whom, when

### Scenario A2: User Loses Phone AND Forgot Password
- [ ] AC-A2.1: Password reset flow works independently
- [ ] AC-A2.2: 2FA reset requires valid password (new or old)
- [ ] AC-A2.3: Both flows can be used in sequence

### Scenario A3: Registration Without Recovery Codes
- [ ] AC-A3.1: No recovery codes are generated
- [ ] AC-A3.2: No recovery codes page is shown
- [ ] AC-A3.3: 2FA setup ends after code verification

### Scenario A4: Login Without Recovery Option
- [ ] AC-A4.1: No recovery code option on 2FA page
- [ ] AC-A4.2: "Lost access? Contact admin" shown instead

### Scenario B1: Google User Sets Password
- [ ] AC-B1.1: "Set Password" button visible for OAuth users
- [ ] AC-B1.2: No current password field required
- [ ] AC-B1.3: Password validation rules applied
- [ ] AC-B1.4: authProvider changes to "multi"
- [ ] AC-B1.5: User can login with both methods

### Scenario B2: Multi-Auth User Changes Password
- [ ] AC-B2.1: Current password required
- [ ] AC-B2.2: Existing change password flow works
