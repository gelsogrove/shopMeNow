# 013 - Testing Strategy

## Unit Tests
- **Factory**: Test correct provider instantiation based on DB config.
- **Parsers**: Test webhook payload parsing for Meta and UltraMsg.
- **Normalization**: Ensure uniform message structure output.

## Mocks
- Mock `axios` for outbound calls.
- Mock `prisma` for DB lookups.

## Integration
- Test full webhook flow with simulated payloads.
- Verify `ConversationMessage` creation.
