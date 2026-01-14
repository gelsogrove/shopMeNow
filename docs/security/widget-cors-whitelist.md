# Widget CORS Whitelist - Future Implementation

## Current Status: Dynamic CORS Allowlist

The widget API allows requests from:
- **Frontend/Backoffice domains** (static allowlist)
- **Workspace `websiteUrl`/`url` origins** (dynamic allowlist)

This means a customer must save a valid Website URL in Settings for their widget to work on that domain.

## Security Concern

**Problem**: Any website can call our widget API using any `workspaceId`, potentially causing:
- Spam/abuse (mitigated by rate limiting: 50 msg/hour per IP)
- Unauthorized usage
- Resource consumption

## Future Implementation (Phase 2)

### Option A: Domain Whitelist per Workspace

```typescript
// Workspace model - add field:
allowedWidgetDomains: string[]  // ['example.com', 'www.example.com', 'shop.example.com']

// Middleware check:
const origin = req.headers.origin
const workspace = await prisma.workspace.findUnique({
  where: { id: workspaceId },
  select: { allowedWidgetDomains: true }
})

if (!workspace.allowedWidgetDomains.includes(extractDomain(origin))) {
  return res.status(403).json({ error: 'Domain not whitelisted' })
}
```

### Option B: Token-based Authentication

```typescript
// Generate widget-specific token in backoffice:
const widgetToken = jwt.sign(
  { workspaceId, domain: 'example.com', type: 'widget' },
  SECRET,
  { expiresIn: '1y' }
)

// Widget init with token:
eChatbotWidget.init({
  workspaceId: 'abc-123',
  token: widgetToken  // Validated on every API call
})
```

### Option C: Hybrid (Recommended)

1. **Default**: CORS open + rate limiting (current)
2. **Enterprise**: Enable domain whitelist in workspace settings
3. **Paranoid**: Require widget token + domain whitelist

## Implementation Checklist

- [ ] Add `allowedWidgetDomains` field to Workspace model
- [ ] Create backoffice UI to manage allowed domains
- [ ] Add middleware to check origin against whitelist
- [ ] Add `enableWidgetDomainWhitelist` boolean flag per workspace
- [ ] Implement token generation for Option B
- [ ] Document in PRD and setup guides

## Monitoring

Track these metrics to decide when to implement:
- Widget API abuse incidents
- Customer requests for domain restrictions
- Unauthorized usage detected

## Notes

- Phase 1: Launch with CORS open (faster customer onboarding)
- Phase 2: Add optional whitelist (enterprise security requirement)
- Keep rate limiting regardless of whitelist status

---

**Created**: 2026-01-10  
**Status**: TODO - Not urgent, monitor for 3 months post-launch  
**Priority**: P2 (Security enhancement, not critical)
