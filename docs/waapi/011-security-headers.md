# 011 - Security Headers

## Standard Headers
- `X-Workspace-ID`: Identifies the tenant.
- `Authorization`: Bearer JWT.

## Webhook Security
- **Meta**: Verify `X-Hub-Signature-256` using `appSecret`.
- **UltraMsg**: No signature standard, verify `token` in payload or URL param.

## Internal Security
- API Rate Limiting: 100 req/min per IP.
- Payload Size Limit: 1MB.
