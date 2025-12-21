# Link Token Reference

## ✅ VALID TOKENS (Currently Implemented)

| Token | Description | Service | Usage |
|-------|-------------|---------|-------|
| `[LINK_PROFILE_WITH_TOKEN]` | Customer profile edit / registration | SecureTokenService | When customer must update or submit personal data |

> ℹ️ **This is the only supported token.** Any other `[LINK_*]` placeholders are invalid and must not reappear in prompts, docs, or agent outputs.

## Implementation Details

### Token Generation Flow
1. Agent includes token in response (e.g., `[LINK_PROFILE_WITH_TOKEN]`)
2. `link-replacement.service.ts` detects token
3. `secure-token.service.ts` generates JWT token
4. `link-generator.service.ts` creates short URL
5. Token replaced with actual URL (e.g., `http://localhost:3000/s/abc123`)

### Files Involved
- `apps/backend/src/application/services/link-replacement.service.ts`
- `apps/backend/src/application/services/secure-token.service.ts`
- `apps/backend/src/application/services/link-generator.service.ts`
- `apps/backend/src/services/llm.service.ts` (delegates to LinkReplacementService)

---
Last updated: December 4, 2025
