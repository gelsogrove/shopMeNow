# 007 - Outbound Messaging

## API Endpoint
`POST /api/workspaces/:workspaceId/messages/send`

## Payload
```json
{
  "to": "phone_number",
  "text": "message content"
}
```

## Logic
1. **Validation**: Check workspace exists and is active.
2. **Subscription Gate**: Check specific `messageLimit` and `subscriptionStatus`.
3. **Factory Resolution**: `WhatAppFactory.getProvider(workspaceId)`.
4. **Execution**: `await provider.sendMessage({ to, text })`.
5. **Persistence**: Save message to `ConversationMessage` table with `direction: OUTBOUND`.
6. **Quota Update**: Increment usage counter.
