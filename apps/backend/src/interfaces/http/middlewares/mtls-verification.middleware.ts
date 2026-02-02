/**
 * 🔒 mTLS Verification Middleware for Meta Webhooks
 * 
 * Implements Mutual TLS (mTLS) client certificate verification as per Meta's requirements:
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started/#mtls-for-webhooks
 * 
 * CRITICAL SECURITY:
 * - Verifies client certificate is from Meta (CN = client.webhooks.fbclientcerts.com)
 * - Prevents spoofing attacks on WhatsApp webhook endpoint
 * - Required for production WhatsApp Business API compliance
 * 
 * TIMELINE:
 * - Current certificate (DigiCert CA): Valid until April 15, 2026
 * - New certificate (Meta CA): Active from March 31, 2026
 * - Both certificates must be trusted during transition period
 */

import { Request, Response, NextFunction } from "express"
import logger from "../../../utils/logger"

/**
 * Expected Common Name (CN) from Meta's client certificate
 * This is constant across all Meta webhook integrations
 */
const META_WEBHOOK_CN = "client.webhooks.fbclientcerts.com"

/**
 * Middleware to verify Meta webhook mTLS client certificate
 * 
 * Checks:
 * 1. Client certificate is present
 * 2. Certificate CN matches Meta's expected value
 * 3. Certificate chain is valid (handled by Node.js TLS layer)
 * 
 * @param req Express request object
 * @param res Express response object
 * @param next Express next function
 */
export const verifyMetaWebhookCertificate = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  try {
    // 🔍 Extract client certificate from TLS connection
    // Note: This requires Heroku to pass through the client certificate
    // Headers that might contain cert info (depending on reverse proxy):
    // - X-Client-Verify (Nginx)
    // - X-Client-DN (Nginx)
    // - X-Amzn-Mtls-Clientcert-Subject (AWS ALB)
    // - SSL_CLIENT_S_DN (Apache)

    const socket = (req as any).socket || (req as any).connection
    const clientCert = socket?.getPeerCertificate ? socket.getPeerCertificate() : null

    // 🧪 DEVELOPMENT/TESTING MODE: Skip mTLS check in non-production
    // This allows local testing without Meta certificates
    if (process.env.NODE_ENV !== "production") {
      logger.info("[mTLS] 🧪 Development mode - skipping certificate verification", {
        environment: process.env.NODE_ENV,
        hasClientCert: !!clientCert,
      })
      return next()
    }

    // 🚨 Check if running behind reverse proxy (Heroku, Nginx, AWS ALB)
    // In production, we might receive cert info via headers instead of direct TLS
    const clientDN = 
      req.headers["x-client-dn"] || 
      req.headers["x-amzn-mtls-clientcert-subject"] ||
      req.headers["ssl_client_s_dn"]

    if (clientDN && typeof clientDN === "string") {
      logger.info("[mTLS] 🔍 Certificate DN from reverse proxy", {
        source: req.headers["x-client-dn"] ? "Nginx" : req.headers["x-amzn-mtls-clientcert-subject"] ? "AWS ALB" : "Apache",
        dn: clientDN,
      })

      // Extract CN from DN string (format: "CN=client.webhooks.fbclientcerts.com,O=Meta,...")
      const cnMatch = clientDN.match(/CN=([^,]+)/)
      const cn = cnMatch ? cnMatch[1].trim() : null

      if (cn === META_WEBHOOK_CN) {
        logger.info("[mTLS] ✅ Client certificate verified via reverse proxy header", {
          cn,
          expectedCN: META_WEBHOOK_CN,
        })
        return next()
      } else {
        logger.error("[mTLS] ❌ Client certificate CN mismatch (reverse proxy)", {
          receivedCN: cn,
          expectedCN: META_WEBHOOK_CN,
          fullDN: clientDN,
        })
        return res.status(403).json({
          error: "Forbidden",
          message: "Invalid client certificate CN",
          code: "MTLS_CN_MISMATCH",
        })
      }
    }

    // 🔒 Direct TLS connection (no reverse proxy)
    if (!clientCert || !clientCert.subject) {
      logger.error("[mTLS] ❌ No client certificate provided", {
        hasSocket: !!socket,
        hasPeerCertificate: !!clientCert,
        url: req.originalUrl,
        ip: req.ip,
      })
      return res.status(403).json({
        error: "Forbidden",
        message: "Client certificate required for Meta webhooks",
        code: "MTLS_CERT_MISSING",
      })
    }

    // 🔍 Verify CN from direct certificate
    const cn = clientCert.subject.CN
    if (cn !== META_WEBHOOK_CN) {
      logger.error("[mTLS] ❌ Client certificate CN mismatch (direct TLS)", {
        receivedCN: cn,
        expectedCN: META_WEBHOOK_CN,
        issuer: clientCert.issuer,
        validFrom: clientCert.valid_from,
        validTo: clientCert.valid_to,
      })
      return res.status(403).json({
        error: "Forbidden",
        message: "Invalid client certificate CN",
        code: "MTLS_CN_MISMATCH",
      })
    }

    // ✅ Certificate is valid
    logger.info("[mTLS] ✅ Client certificate verified successfully", {
      cn,
      issuer: clientCert.issuer,
      validFrom: clientCert.valid_from,
      validTo: clientCert.valid_to,
    })

    next()
  } catch (error) {
    logger.error("[mTLS] 💥 Error verifying client certificate", {
      error: error.message,
      stack: error.stack,
    })
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to verify client certificate",
      code: "MTLS_VERIFICATION_ERROR",
    })
  }
}
