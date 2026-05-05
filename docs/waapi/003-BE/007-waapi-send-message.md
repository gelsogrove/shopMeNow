# 007-waapi-send-message

## Goal
Implement the `WaapiWhatsAppProvider` class to handle outbound messages via WaAPI. This class must implement the `WhatsAppProviderInterface`.

## Scope
- Implement `sendMessage` (text).
- Implement `sendTemplate` (if supported/needed, or fallback).
- Handle media messages if required.
- Validate credentials before sending.
- Error handling specific to WaAPI (mapping 4xx/5xx to internal errors).

## Interface
```typescript
export class WaapiWhatsAppProvider implements WhatsAppProviderInterface {
  async sendMessage(to: string, message: string): Promise<void> {
    // Call WaAPI /client/action/send-message
  }
}
```

## Critical details
- **Endpoint**: Verify exact endpoint in WaAPI docs (likely `/client/action/send-message` or `/chat/sendRequest`).
- **Payload**: JSON format usually requires `chatId` (phone + @c.us) and `text`.
- **Validation**: Ensure `waapiInstanceId` and `waapiInstanceStatus` are valid before attempting to send.

## Acceptance Criteria
1. Can send a text message to a valid number.
2. Throws typed errors on failure (auth, network, instance not ready).
3. Implements the full provider interface used by `WhatsappChannelQueue`.
4. Build and tests pass.
