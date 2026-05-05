# WaAPI Provider Integration

## 0. Executive Summary (What We Are Doing)
We are adding **WaAPI** as the **default WhatsApp provider** for onboarding while keeping **Meta** and **UltraMsg** available in Settings. The feature is not just a provider toggle: it introduces a full **instance lifecycle** (create → QR → ready → disconnect → delete → reconnect) and a **CRITICAL** safety flow for provider switching that irreversibly deletes the WaAPI instance.

This integration affects **DB**, **Backend**, **Frontend**, and **Scheduler**. The most critical UX is **Settings** and **New Channel Onboarding**.

## 1. Business Goal
- Remove third‑party subscription friction for end‑users.
- Make onboarding fast: user scans QR on your site.
- Allow safe provider switching without data loss (chat history stays, instance is deleted).

## 2. User Flows (High Level)
### 2.1 New Channel Onboarding (Default = WaAPI)
1. User selects WhatsApp onboarding (WaAPI preselected).
2. User enters **mandatory** phone number.
3. System creates a WaAPI **instance** and configures webhook.
4. User sees QR; scans via WhatsApp.
5. Status becomes `authenticated` → `ready`.

### 2.2 Settings: Switch Provider (Critical)
1. User attempts to switch away from WaAPI.
2. CRITICAL modal appears (type `CONFIRM`).
3. Confirm → delete WaAPI instance → switch provider.
4. Failure → provider unchanged and user sees error.

### 2.3 Settings: Disconnect & Reconnect
- Disconnect deletes instance and marks channel inactive.
- Reconnect starts a fresh onboarding (new instance + new QR).

### 2.4 Delete Channel (Hard Delete)
- Delete channel removes DB record and deletes WaAPI instance.
- Channel can later be recreated via onboarding.

## 3. What We Must Implement (By Layer)
### 3.1 Database
- Store WaAPI instance metadata (id, status, phone, webhook settings).
- QR data cached short‑term.
- Default provider set to WaAPI for new onboarding.

### 3.2 Backend
- WaAPI client wrapper (create, retrieve, update, delete).
- Instance lifecycle orchestration.
- Webhook receiver for `qr`, `authenticated`, `ready`, `disconnected`, `auth_failure`.
- Destructive provider switch flow with guardrails.

### 3.3 Frontend
- Onboarding UI with QR render, status live updates.
- Settings UI for switching provider with CRITICAL confirmation.
- Channel CRUD (create/update/delete/reconnect).

### 3.4 Scheduler
- Status reconciliation job.
- QR TTL cleanup.

## 4. Instance vs Channel (WaAPI)
- **Instance**: QR‑connected WhatsApp session (what we need to send/receive messages).
- **Channel**: WhatsApp Channels entity (not required for our onboarding).

## 5. Settings Fields (UI)
Fields to show and edit:
- `provider` (waapi | meta | ultramsg)
- `waapiInstanceId`
- `waapiInstanceStatus`
- `waapiPhoneNumber` (required)
- `waapiPhoneName` (optional)
- `waapiWebhookUrl`
- `waapiWebhookEvents`
- `waapiIsActive`

Do **not** store per-instance tokens; WaAPI uses a global API token.

## 6. Critical Risks & Guardrails
- **Provider switch is destructive** → must be guarded by typed `CONFIRM`.
- If WaAPI delete fails → provider must NOT switch.
- QR must be short‑lived; do not store long‑term.
- Webhook events can be retried → must be idempotent.

## 6.1 Security Requirements (Global)
- Validate webhook source (signature/header if provided).
- Enforce instance-to-workspace mapping for all webhook events.
- Mask sensitive data in logs (QR base64, phone numbers).
- Apply rate limiting to webhook endpoints.

## 6.2 Provider Isolation (Meta / UltraMsg / WaAPI)
- Each provider has its **own** webhook endpoint and handler.
- Provider-specific secrets and tokens are isolated and never shared.
- UI must never mix provider fields; switching providers clears fields of the previous provider.

## 7. Acceptance Criteria (Global)
1. WaAPI default in onboarding; other providers still available in settings.
2. Onboarding requires phone number, shows QR, and reaches `ready`.
3. Switching provider from WaAPI requires `CONFIRM` and deletes instance.
4. Deleting a channel hard deletes the WaAPI instance.
5. Webhooks update status and QR reliably.
6. Build and tests pass.
7. Documentation updated.

## 8. Task Index
See `/Users/gelso/workspace/shopME/docs/waapi/index.md` for the execution order and task map.

## 9. References
- API Token: https://waapi.readme.io/reference/api-token
- Retrieve instance: https://waapi.readme.io/reference/retrieve-instance
- Update instance: https://waapi.readme.io/reference/update-instance
- Delete instance: https://waapi.readme.io/reference/delete-instance
- QR event webhook: https://waapi.readme.io/reference/qr-event
- Create channel: https://waapi.readme.io/reference/create-channel
