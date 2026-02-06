# WaAPI Provider Integration

## Scope
Add WaAPI as the default WhatsApp provider for onboarding while keeping existing providers available in settings. The critical flows are:
- New channel onboarding with QR scan.
- Settings provider switch with irreversible instance deletion on WaAPI.
- Full channel CRUD in the UI with mandatory phone number.
- Webhook processing for QR and status updates.

## What We Touch
- Database: provider fields, WaAPI instance metadata, status, phone number, webhook configuration.
- Backend: WaAPI client, webhook handler, instance lifecycle, provider switch safety.
- Frontend: onboarding flow, settings switch modal, channel CRUD, QR rendering.
- Scheduler: reconciliation of instance status and stale QR cleanup.

## Provider Notes
- WaAPI exposes endpoints for instance lifecycle and QR webhook events. See docs:
  - API Token: https://waapi.readme.io/reference/api-token
  - Retrieve instance: https://waapi.readme.io/reference/retrieve-instance
  - Update instance: https://waapi.readme.io/reference/update-instance
  - Delete instance: https://waapi.readme.io/reference/delete-instance
  - QR event webhook: https://waapi.readme.io/reference/qr-event
  - Create channel: https://waapi.readme.io/reference/create-channel

## Instance vs Channel (WaAPI)
- Instance: a WhatsApp session connected via QR. This is what we need for onboarding and messaging.
- Channel: a separate WhatsApp Channels entity created by a connected instance. Not required for our onboarding flow.

## Critical Behavior
- Provider switch away from WaAPI must show a CRITICAL confirmation modal with text input `CONFIRM`.
- Confirmed switch must trigger WaAPI instance deletion. This is irreversible.
- Tests must cover the destructive flow and must be green before release.

## Data Fields (Draft, validate against docs)
We should align with WaAPI responses. Based on current docs, we expect:
- `provider` (enum)
- `provider_instance_id` (string)
- `instance_status` (string)
- `wa_number` (string, required)
- `wa_name` (string)
- `webhook_url` (string)
- `webhook_events` (string array)
- `qr_code_data` (string, base64 data URL; short-lived)
- `is_active` (boolean)

Notes:
- WaAPI uses a global API token (Bearer). Do not store per-instance tokens unless WaAPI returns one explicitly.
- `qr_code_data` should be treated as ephemeral and not stored long-term.

## Acceptance Criteria (Global)
1. WaAPI is default in onboarding, other providers still selectable in settings.
2. New channel onboarding shows QR and succeeds when instance is ready.
3. Settings provider switch requires `CONFIRM` and deletes WaAPI instance on success.
4. Deleting a channel hard deletes the WaAPI instance.
5. Webhooks update QR/status reliably and are idempotent.
6. Tests and build pass; documentation is updated.



IMPORTANT
code must be cleaned, please use service or share component with parameters for avoiding dulication of the code, naming is important ! clen code is important
remove dead code , avoid file too long split in utils helpers, service.compoenent

- remember that the uint test is our bible when you need to change the funcionality ask to the user
if you just need to change the mock go ahead without ask

- rember the flow user can connect easly and can manage eastly his channel this is the challenge!!!

- before start we need to save the userID session of our subscription because we need to pay first

