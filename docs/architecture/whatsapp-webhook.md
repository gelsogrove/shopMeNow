# WhatsApp Webhook – Payload Mapping & Security

## Overview
The WhatsApp inbound webhook accepts Meta payloads and normalizes them into a single internal flow. There are **two entry modes**:

1) **Production**: `POST /api/whatsapp/webhook/:webhookId`
- `:webhookId` is the primary lookup key (WhatsAppSettings.webhookId)
- Signature verification is **required**

2) **Playground / simulator**: `POST /api/whatsapp/webhook`
- Uses `workspaceId` from payload (only for playground)
- `isPlayground=true` skips signature verification

---

## Meta Verification (GET)
`GET /api/whatsapp/webhook/:webhookId`

**Expected query params**:
- `hub.mode=subscribe`
- `hub.verify_token=<token>` (must match WhatsAppSettings.webhookToken)
- `hub.challenge=<challenge>`

**Response**: returns `hub.challenge` on success.

---

## Signature Verification (POST)
**Header**: `x-hub-signature-256`

We validate signature using the **app secret stored per channel** in `whatsapp_settings.appSecret`.

If missing, the webhook returns **500** with `webhook_signature_config_missing`.

**Important**: signature is computed on the **raw body** (not re-serialized JSON). If the raw body is unavailable, verification can fail. We rely on the Express JSON parser to populate `req.rawBody`.

---

## Payload Mapping (Meta → Internal)
We currently support these Meta fields:

### Required
- `entry[0].changes[0].value.messages[0].from`
- `entry[0].changes[0].value.messages[0].id`
- `entry[0].changes[0].value.messages[0].timestamp`

### Optional
- `entry[0].changes[0].value.contacts[0].profile.name` → customer name
- `entry[0].changes[0].value.metadata.display_phone_number` → channel "to" verification

### Supported message types
The controller extracts message text from:
- `text.body`
- `button.text`
- `interactive.button_reply.title`
- `interactive.list_reply.title`
- `interactive.body.text` (list)
- **media** (image/video/document/audio/sticker): caption or filename → fallback `"[type message]"`

If no text can be extracted, the message is ignored.

---

## Channel "To" Verification
If `metadata.display_phone_number` or `messages[0].to` is present, we normalize and compare against the channel phone number in WhatsAppSettings. If mismatch → return `404 channel_mismatch`.

---

## Anti-replay
If a message includes a timestamp, messages older than **5 minutes** are rejected with `409 stale_message`.

---

## Workspace Routing Rules
- **Production**: workspace is derived by `webhookId → WhatsAppSettings → workspaceId`.
- **Playground**: workspace is taken from `workspaceId` in payload (only for simulator/testing).

---

## Configuration Source & Sync (whatsapp_settings ↔ workspace)
- **Primary source**: `whatsapp_settings` (phoneNumber, apiKey, appSecret, webhookId, webhookToken, webhookUrl, adminEmail).
- **Legacy columns**: `workspace.whatsappPhoneNumber` / `workspace.whatsappApiKey` (and `workspace.webhookUrl`) still exist for backward compatibility.
- **Sync behavior**: backend update flow **upserts** `whatsapp_settings` and mirrors phone/apiKey back to `workspace` so older services keep working.
- **Migration note**: if a workspace only has data in `whatsapp_settings`, open Settings and save once to sync legacy fields (or run a backfill).

---

## Customer Name Capture
If Meta includes `contacts[0].profile.name`, the system updates the customer name (only when missing or default "New Customer").

---

## Message Send Flow (Outbound)
All outbound WhatsApp messages go through `MessageSendingService`:
- Applies **security layer** when required
- Enqueues to **WhatsApp Queue** (scheduler handles delivery)
- Admin manual sends can **skip security layer** explicitly
- Admin manual sends convert **Markdown → WhatsApp** formatting before enqueueing; DB stores the original markdown.

---

## Notes / Gaps
- Meta payloads may include multiple messages in a single webhook; we currently process **only the first** message.
- `workspaceId` is accepted only for playground; production relies on webhookId.
