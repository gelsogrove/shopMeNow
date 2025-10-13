# 🔒 HTTPS SSL/TLS SETUP - ShopME

**Author**: Andrea Gelso  
**Date**: 2025-01-13  
**Status**: Production Ready

---

## 🎯 OBIETTIVO

Blindare TUTTO con HTTPS obbligatorio:

- ✅ Certificati SSL per production (Let's Encrypt)
- ✅ Certificati self-signed per development
- ✅ HTTP redirect to HTTPS automatico
- ✅ HSTS headers (HTTP Strict Transport Security)
- ✅ TLS 1.3 only (no downgrade attacks)

---

## 📋 SETUP PRODUCTION (Let's Encrypt)

### Step 1: Install Certbot

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install certbot

# macOS
brew install certbot
```

### Step 2: Generate SSL Certificate

```bash
# Per dominio shopme.com
sudo certbot certonly --standalone -d shopme.com -d www.shopme.com

# Certificati salvati in:
# /etc/letsencrypt/live/shopme.com/fullchain.pem
# /etc/letsencrypt/live/shopme.com/privkey.pem
```

### Step 3: Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Setup auto-renewal (cron job)
sudo crontab -e

# Add this line (renew every day at 3 AM)
0 3 * * * certbot renew --quiet --post-hook "pm2 restart shopme-backend"
```

---

## 🔧 SETUP DEVELOPMENT (Self-Signed)

### Generate Self-Signed Certificate

```bash
# Create SSL directory
mkdir -p /Users/gelso/workspace/AI/shop/backend/ssl

# Generate certificate (valid 1 year)
cd /Users/gelso/workspace/AI/shop/backend/ssl

openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/C=IT/ST=Veneto/L=Venezia/O=ShopME/CN=localhost"

# Files created:
# - cert.pem (certificate)
# - key.pem (private key)
```

### Trust Certificate (macOS)

```bash
# Add to keychain
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain cert.pem

# Restart browser to apply
```

---

## 💻 BACKEND CONFIGURATION

### Update .env

```bash
# Add to backend/.env

# SSL Configuration
SSL_ENABLED=true
SSL_CERT_PATH=./ssl/cert.pem
SSL_KEY_PATH=./ssl/key.pem

# Production (Let's Encrypt)
# SSL_CERT_PATH=/etc/letsencrypt/live/shopme.com/fullchain.pem
# SSL_KEY_PATH=/etc/letsencrypt/live/shopme.com/privkey.pem

# Force HTTPS
FORCE_HTTPS=true

# HSTS (HTTP Strict Transport Security)
HSTS_MAX_AGE=31536000  # 1 year in seconds
```

### Update app.ts

```typescript
// File: backend/src/app.ts

import express from "express"
import https from "https"
import http from "http"
import fs from "fs"
import path from "path"

const app = express()

// ... existing middleware ...

// 🔒 FORCE HTTPS REDIRECT (Production only)
if (
  process.env.FORCE_HTTPS === "true" &&
  process.env.NODE_ENV === "production"
) {
  app.use((req, res, next) => {
    if (req.secure || req.headers["x-forwarded-proto"] === "https") {
      next()
    } else {
      res.redirect(301, `https://${req.headers.host}${req.url}`)
    }
  })
}

// 🔒 SECURITY HEADERS
app.use((req, res, next) => {
  // HSTS - Force HTTPS for 1 year
  if (process.env.SSL_ENABLED === "true") {
    res.setHeader(
      "Strict-Transport-Security",
      `max-age=${
        process.env.HSTS_MAX_AGE || 31536000
      }; includeSubDomains; preload`
    )
  }

  // X-Frame-Options - Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY")

  // X-Content-Type-Options - Prevent MIME sniffing
  res.setHeader("X-Content-Type-Options", "nosniff")

  // X-XSS-Protection - XSS filter
  res.setHeader("X-XSS-Protection", "1; mode=block")

  // Referrer-Policy - Control referrer information
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")

  // Content-Security-Policy - XSS protection
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  )

  next()
})

// ... existing routes ...

// 🔒 START SERVER WITH SSL
function startServer() {
  const PORT = process.env.PORT || 3001

  if (process.env.SSL_ENABLED === "true") {
    // HTTPS Server
    const sslOptions = {
      key: fs.readFileSync(
        path.resolve(__dirname, "..", process.env.SSL_KEY_PATH!)
      ),
      cert: fs.readFileSync(
        path.resolve(__dirname, "..", process.env.SSL_CERT_PATH!)
      ),
      // TLS 1.3 only (no downgrade)
      minVersion: "TLSv1.3" as const,
      // Strong ciphers only
      ciphers: [
        "TLS_AES_128_GCM_SHA256",
        "TLS_AES_256_GCM_SHA384",
        "TLS_CHACHA20_POLY1305_SHA256",
      ].join(":"),
    }

    const httpsServer = https.createServer(sslOptions, app)

    httpsServer.listen(PORT, () => {
      logger.info(`🔒 HTTPS Server running on https://localhost:${PORT}`)
      logger.info(`🔒 SSL/TLS 1.3 enabled`)
      logger.info(`🔒 HSTS enabled (max-age: ${process.env.HSTS_MAX_AGE}s)`)
    })

    // HTTP → HTTPS redirect server (port 80 → 443)
    if (process.env.FORCE_HTTPS === "true") {
      const httpApp = express()
      httpApp.use((req, res) => {
        res.redirect(301, `https://${req.headers.host}${req.url}`)
      })
      httpApp.listen(80, () => {
        logger.info("🔒 HTTP redirect server running on port 80 → HTTPS")
      })
    }
  } else {
    // HTTP Server (development only)
    const httpServer = http.createServer(app)
    httpServer.listen(PORT, () => {
      logger.info(`⚠️  HTTP Server running on http://localhost:${PORT}`)
      logger.warn("⚠️  SSL DISABLED - Development mode only!")
    })
  }
}

startServer()
```

---

## ✅ VERIFICATION

### Test HTTPS Connection

```bash
# Test certificate
curl -v https://localhost:3001/health

# Check TLS version
openssl s_client -connect localhost:3001 -tls1_3

# Check security headers
curl -I https://localhost:3001/health
# Should see:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
```

### Test HTTP → HTTPS Redirect

```bash
# Should redirect to HTTPS
curl -I http://localhost:3001/health
# HTTP/1.1 301 Moved Permanently
# Location: https://localhost:3001/health
```

---

## 🧪 FRONTEND CONFIGURATION

### Update .env

```bash
# frontend/.env

# Development (self-signed cert)
VITE_API_URL=https://localhost:3001

# Production
# VITE_API_URL=https://api.shopme.com
```

### Update vite.config.ts

```typescript
// frontend/vite.config.ts

import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import fs from "fs"
import path from "path"

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    https:
      process.env.NODE_ENV === "development"
        ? {
            key: fs.readFileSync(
              path.resolve(__dirname, "../backend/ssl/key.pem")
            ),
            cert: fs.readFileSync(
              path.resolve(__dirname, "../backend/ssl/cert.pem")
            ),
          }
        : undefined,
  },
})
```

---

## 📊 SSL MONITORING

### Check Certificate Expiration

```bash
# Check expiry date
openssl x509 -in /etc/letsencrypt/live/shopme.com/fullchain.pem -noout -dates

# Check with curl
curl -vI https://shopme.com 2>&1 | grep "expire"
```

### Setup Expiration Alerts

```bash
# Add to crontab
0 0 * * * /usr/local/bin/check-ssl-expiry.sh

# Create script: /usr/local/bin/check-ssl-expiry.sh
#!/bin/bash
DOMAIN="shopme.com"
EXPIRY_DATE=$(openssl x509 -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

if [ $DAYS_LEFT -lt 30 ]; then
  echo "⚠️  SSL certificate expires in $DAYS_LEFT days!" | mail -s "SSL Alert" admin@shopme.com
fi
```

---

## 🔒 BEST PRACTICES

### ✅ DO

- ✅ Use TLS 1.3 only
- ✅ Enable HSTS with long max-age (1 year+)
- ✅ Auto-renew certificates (Let's Encrypt)
- ✅ Use strong ciphers only
- ✅ Monitor certificate expiration
- ✅ Redirect HTTP → HTTPS (301)
- ✅ Set security headers (X-Frame-Options, CSP, etc.)

### ❌ DON'T

- ❌ Use self-signed certs in production
- ❌ Allow TLS 1.0/1.1 (deprecated)
- ❌ Use weak ciphers
- ❌ Forget to renew certificates
- ❌ Allow HTTP in production
- ❌ Skip HSTS headers
- ❌ Commit private keys to git

---

## 📝 CHECKLIST

- [ ] Generate SSL certificate (Let's Encrypt for prod, self-signed for dev)
- [ ] Update backend/.env with SSL paths
- [ ] Update backend/src/app.ts with HTTPS server
- [ ] Add security headers middleware
- [ ] Setup HTTP → HTTPS redirect
- [ ] Update frontend/.env with HTTPS URL
- [ ] Update frontend/vite.config.ts with HTTPS
- [ ] Setup auto-renewal cron job
- [ ] Setup expiration monitoring
- [ ] Test HTTPS connection
- [ ] Test HTTP redirect
- [ ] Test security headers
- [ ] Add SSL cert paths to .gitignore

---

**Status**: ✅ Ready to implement  
**Next**: Implement API Key + HMAC Signature
