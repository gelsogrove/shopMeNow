# Feature Specification: Public Registration & Profile Forms for WhatsApp Customers

**Feature Branch**: `193-public-registration-forms`  
**Created**: 2024-12-02  
**Status**: Draft  
**Input**: User description: "Restore public token-based registration and profile forms for WhatsApp customers - registration form, profile view/edit, shipping address modification"

## Overview

WhatsApp customers need public (non-authenticated) pages to:
1. Complete their registration when they first contact the chatbot
2. View and edit their profile information
3. Update their shipping address

These pages are accessed via secure time-limited token links sent through WhatsApp. The frontend components (`register.tsx`, `CustomerProfilePublicPage.tsx`) exist but the registration page is **not connected to the App.tsx routes**.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - New Customer Registration via WhatsApp Link (Priority: P1)

A new customer contacts the WhatsApp chatbot for the first time. The chatbot sends them a registration link with a secure token. The customer clicks the link and completes a registration form with their personal information.

**Why this priority**: This is the critical entry point for new customers. Without registration, customers cannot place orders or be tracked in the system.

**Independent Test**: Can be fully tested by clicking a registration link, filling the form, and verifying the customer is created in the database.

**Acceptance Scenarios**:

1. **Given** a new customer receives a registration link via WhatsApp, **When** they click the link with a valid token, **Then** they see the registration form pre-filled with their phone number.

2. **Given** a customer is on the registration form, **When** they fill in required fields (firstName, lastName, email) and accept GDPR consent, **Then** they can submit the form successfully.

3. **Given** a customer submits the registration form, **When** the submission is successful, **Then** they are redirected to `/registration-success` page with a confirmation message.

4. **Given** a customer clicks a registration link with an expired token, **When** the page loads, **Then** they see an error message indicating the link has expired.

5. **Given** a customer tries to submit the form without GDPR consent, **When** they click submit, **Then** form validation prevents submission and shows an error.

**360-Degree Validation** _(mandatory for implementation)_:

- [x] Frontend: `register.tsx` exists, needs route in App.tsx
- [x] Backend API: `/api/token/registration/*` routes exist
- [x] Service Layer: RegistrationService exists
- [x] Repository: Customer repository with workspaceId filter
- [x] Database: registration_tokens table exists
- [ ] Security: Token validation middleware
- [ ] Testing: Unit tests for registration flow
- [ ] Documentation: Update swagger for registration endpoints

---

### User Story 2 - Customer Profile View via Secure Link (Priority: P2)

An existing customer receives a link to view their profile. They click the link and see their current profile information including name, email, company, language preference, and shipping address.

**Why this priority**: Customers need to verify their information is correct before placing orders.

**Independent Test**: Can be tested by clicking a profile link and verifying all customer data is displayed correctly.

**Acceptance Scenarios**:

1. **Given** a customer receives a profile link via WhatsApp, **When** they click the link with a valid token, **Then** they see their complete profile information.

2. **Given** a customer is viewing their profile, **When** the page loads, **Then** they see: name, email, company (if any), phone, language, shipping address.

3. **Given** a customer clicks a profile link with an expired token, **When** the page loads, **Then** they are redirected to `/expired` page.

**360-Degree Validation** _(mandatory for implementation)_:

- [x] Frontend: `CustomerProfilePublicPage.tsx` exists with route `/customer-profile`
- [x] Backend API: `/api/token/customer-profile/*` routes exist
- [x] Service Layer: CustomerService exists
- [ ] Testing: Verify profile data displays correctly

---

### User Story 3 - Customer Profile Edit via Secure Link (Priority: P2)

An existing customer wants to update their profile information. They receive a link, click it, modify their details (name, email, company, language), and save the changes.

**Why this priority**: Customers need the ability to keep their information up-to-date.

**Independent Test**: Can be tested by editing a field and verifying the change is persisted in the database.

**Acceptance Scenarios**:

1. **Given** a customer is viewing their profile, **When** they click "Edit Profile" button, **Then** the form becomes editable.

2. **Given** a customer is editing their profile, **When** they change their email and click Save, **Then** the new email is saved and a success message is shown.

3. **Given** a customer tries to save an invalid email, **When** they click Save, **Then** form validation shows an error message.

**360-Degree Validation** _(mandatory for implementation)_:

- [x] Frontend: `ProfileForm.tsx` component exists
- [x] Backend API: PUT endpoint for profile update exists
- [ ] Testing: Verify profile updates persist correctly

---

### User Story 4 - Shipping Address Update via Secure Link (Priority: P3)

A customer wants to update their shipping address before placing an order. They receive a link, click it, update their address (street, city, postal code, country), and save the changes.

**Why this priority**: Correct shipping address is essential for order delivery but can be done as part of checkout flow.

**Independent Test**: Can be tested by editing the shipping address and verifying the update in the database.

**Acceptance Scenarios**:

1. **Given** a customer is viewing their profile, **When** they click "Edit Shipping Address", **Then** the address form becomes editable.

2. **Given** a customer is editing their address, **When** they update the street address and click Save, **Then** the new address is saved.

3. **Given** a customer leaves required address fields empty, **When** they click Save, **Then** form validation prevents submission.

**360-Degree Validation** _(mandatory for implementation)_:

- [x] Frontend: Address fields exist in ProfileForm
- [x] Backend API: Address update endpoint exists
- [ ] Testing: Verify address updates persist correctly

---

### Edge Cases

- What happens when a token is used after expiration? → Show `/expired` page with message to request a new link via WhatsApp.
- What happens when a token is reused? → Registration tokens should be single-use; profile tokens can be reused until expiry.
- How does the system handle concurrent profile edits? → Last write wins (acceptable for customer self-service).
- What if the customer's phone number is already registered? → Show error message and suggest requesting a profile link instead.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a public registration page accessible via `/registration?token=xxx&workspace=xxx&phone=xxx&lang=xx`
- **FR-002**: System MUST validate the registration token before displaying the form
- **FR-003**: Registration form MUST collect: firstName, lastName, email, company (optional), language preference
- **FR-004**: Registration form MUST require GDPR consent checkbox before submission
- **FR-005**: System MUST create a new Customer record on successful registration
- **FR-006**: System MUST redirect to `/registration-success` after successful registration
- **FR-007**: System MUST display error message for expired/invalid tokens
- **FR-008**: System MUST provide profile view/edit page accessible via `/customer-profile?token=xxx`
- **FR-009**: Profile page MUST allow editing: name, email, company, language, shipping address
- **FR-010**: System MUST validate and save profile changes with proper error handling
- **FR-011**: All public pages MUST be translated based on `lang` URL parameter

### Key Entities

- **Customer**: Represents a WhatsApp customer with profile data (name, email, phone, company, language, address, gdprConsent)
- **RegistrationToken**: Time-limited token for new customer registration (token, workspaceId, phone, expiresAt, used)
- **SecureToken**: Generic secure token for profile/checkout access (token, customerId, workspaceId, type, expiresAt)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: New customers can complete registration in under 2 minutes from clicking the link
- **SC-002**: 100% of valid registration tokens successfully display the registration form
- **SC-003**: 100% of expired tokens redirect to appropriate error page
- **SC-004**: Profile changes are saved and visible immediately after page refresh
- **SC-005**: All form validations work correctly (email format, required fields, GDPR consent)

## Implementation Notes

### Current State Analysis

**Files that exist and work:**
- `apps/frontend/src/pages/register.tsx` - Complete registration form with token validation
- `apps/frontend/src/pages/CustomerProfilePublicPage.tsx` - Profile view/edit page
- `apps/frontend/src/components/profile/ProfileForm.tsx` - Reusable profile form
- `apps/frontend/src/hooks/useTokenValidation.ts` - Token validation hook
- `apps/frontend/src/services/tokenApi.ts` - API client for token routes
- `apps/backend/src/routes/token/index.ts` - Token-based routes
- `apps/backend/src/interfaces/http/routes/registration.routes.ts` - Registration API

**What's missing:**
- Route in `App.tsx` for `/registration` pointing to `register.tsx`
- Verification that all token validation flows work end-to-end

### Task 1: Connect Registration Page Route (P1)

1. Add import for `register.tsx` in `App.tsx`
2. Add route: `/registration` → `RegisterPage` (public, no auth)
3. Test the full registration flow with a valid token

## Assumptions

- Registration tokens are generated by the backend when a new customer contacts WhatsApp
- Token expiration time is configurable via environment variable `TOKEN_EXPIRATION`
- GDPR consent is required for all new registrations
- Profile tokens (for view/edit) can be reused multiple times until expiry
- Registration tokens are single-use (marked as `used` after successful registration)
