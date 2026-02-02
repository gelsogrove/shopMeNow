# mTLS Implementation for Meta Webhooks

## 📋 Overview

This implementation provides **Mutual TLS (mTLS)** client certificate verification for Meta (WhatsApp/Facebook) webhooks, following official Meta documentation:
https://developers.facebook.com/docs/graph-api/webhooks/getting-started/#mtls-for-webhooks

## 🔒 Security Benefits

- ✅ **Anti-Spoofing**: Only Meta can call our webhook (not hackers)
- ✅ **Certificate Validation**: Verifies CN = `client.webhooks.fbclientcerts.com`
- ✅ **Enterprise-Grade**: Industry standard for webhook security
- ✅ **Zero-Trust**: Never trusts unsigned requests

## ⏰ Timeline & Migration

### Current Status (February 2026)
- **Active Certificate**: DigiCert CA (valid until April 15, 2026)
- **Expected CN**: `client.webhooks.fbclientcerts.com`
- **Implementation**: Middleware-based verification

### Upcoming Changes (March 31, 2026)
- Meta will begin signing certificates with **new Meta CA** (owned by Meta)
- Old DigiCert certificate remains valid during transition
- **Action Required**: Add new Meta CA certificate to trust store

### Critical Deadline (April 15, 2026)
- Old DigiCert certificate **EXPIRES**
- Systems not trusting new Meta CA will **FAIL TLS handshake**
- **Result**: Complete webhook outage if not updated

## 🏗️ Architecture

```
Meta WhatsApp API
      ↓ (HTTPS + Client Certificate)
Heroku Load Balancer
      ↓ (Passes X-Client-DN header)
Node.js Express Server
      ↓ (Middleware: mtls-verification.middleware.ts)
WhatsApp Webhook Controller
```

## 📁 Files

### Core Implementation
- `apps/backend/src/interfaces/http/middlewares/mtls-verification.middleware.ts`
  - Main mTLS verification logic
  - Validates client certificate CN
  - Supports both direct TLS and reverse proxy scenarios

### Routes Updated
- `apps/backend/src/interfaces/http/routes/whatsapp.routes.ts`
  - POST `/api/whatsapp/webhook/:webhookId` → mTLS required
  - POST `/api/whatsapp/webhook` → mTLS required (playground)

### Certificates (Not Committed)
- `config/certs/DigiCert_High_Assurance_EV_Root_CA.pem` (current, expires Apr 15, 2026)
- `config/certs/meta-outbound-api-ca-2025-12.pem` (new, active Mar 31, 2026) - **TODO: Download when available**

## 🧪 Testing

### Development Mode
```bash
# Middleware automatically skips mTLS in non-production
NODE_ENV=development npm run dev
# ✅ Webhooks work without client certificate
```

### Production Mode
```bash
# Middleware enforces mTLS verification
NODE_ENV=production npm start
# ❌ Returns 403 if no valid Meta certificate
```

### Manual Test (Production)
```bash
# Send test WhatsApp message to your workspace
# Check logs for:
heroku logs --tail -a echatbot-app | grep "mTLS"

# Expected output (success):
# [mTLS] ✅ Client certificate verified successfully { cn: 'client.webhooks.fbclientcerts.com' }

# Expected output (failure):
# [mTLS] ❌ Client certificate CN mismatch { receivedCN: 'unknown', expectedCN: 'client.webhooks.fbclientcerts.com' }
```

## 🚀 Deployment Checklist

### Before March 31, 2026
- [x] Implement mTLS middleware in Node.js
- [x] Add middleware to WhatsApp webhook routes
- [x] Deploy to production
- [x] Monitor logs for certificate verification
- [ ] Download new Meta CA certificate when available
- [ ] Test with new certificate in staging environment

### After March 31, 2026
- [ ] Verify both certificates work (old DigiCert + new Meta CA)
- [ ] Monitor for any TLS handshake failures
- [ ] Prepare rollback plan if issues arise

### After April 15, 2026
- [ ] Remove old DigiCert certificate (no longer needed)
- [ ] Update documentation to remove DigiCert references

## 📊 Monitoring

### Key Metrics
```bash
# Certificate verification success rate
heroku logs -a echatbot-app | grep "mTLS.*✅" | wc -l

# Certificate verification failures
heroku logs -a echatbot-app | grep "mTLS.*❌" | wc -l

# CN mismatch errors (security alerts!)
heroku logs -a echatbot-app | grep "MTLS_CN_MISMATCH"
```

### Alerts to Configure
- ❌ **CRITICAL**: `MTLS_CN_MISMATCH` → Potential spoofing attempt
- ⚠️ **WARNING**: `MTLS_CERT_MISSING` → Meta changed their configuration
- ℹ️ **INFO**: Certificate verification success (should be 100% in production)

## 🔧 Troubleshooting

### Error: "Client certificate required"
**Cause**: Heroku not passing client certificate to Node.js  
**Solution**: Check if reverse proxy (Nginx/ALB) is configured to pass `X-Client-DN` header

### Error: "Client certificate CN mismatch"
**Cause**: Certificate CN != `client.webhooks.fbclientcerts.com`  
**Solution**: Verify certificate is from Meta, not a test/invalid cert

### Error: "Client certificate verification failed"
**Cause**: Certificate chain invalid or expired  
**Solution**: Update trust store with new Meta CA certificate

## 🛡️ Security Considerations

### What This Protects Against
- ✅ Webhook spoofing (attackers pretending to be Meta)
- ✅ Replay attacks (if combined with timestamp validation)
- ✅ Man-in-the-middle attacks (TLS layer)

### What This Does NOT Protect Against
- ❌ Application-level bugs (still need input validation)
- ❌ Compromised Meta infrastructure (trust Meta's security)
- ❌ Leaked WHATSAPP_VERIFY_TOKEN (rotate regularly)

## 📚 References

- [Meta mTLS Documentation](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/#mtls-for-webhooks)
- [DigiCert Root Certificates](https://www.digicert.com/kb/digicert-root-certificates.htm)
- [Meta CA Certificate Download](https://scontent-mrs2-2.xx.fbcdn.net/...) - **TODO: Update when link works**
- [WhatsApp Business API Webhooks](https://developers.facebook.com/docs/whatsapp/webhooks)

## 👤 Maintainer

Andrea Gelso (@shopmenow/shopME)  
Last Updated: February 2, 2026

---

**🚨 CRITICAL REMINDER**: Update Meta CA certificate BEFORE March 31, 2026 to avoid webhook outage!
