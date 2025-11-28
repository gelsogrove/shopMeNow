import crypto from "crypto"

/**
 * WhatsApp Signature Verification Utility
 *
 * Single Responsibility: Verify HMAC SHA256 signature from WhatsApp webhooks
 *
 * Security: CRITICAL - This prevents unauthorized webhook calls
 * All webhook requests MUST be verified before processing
 */

/**
 * Verify WhatsApp webhook signature using HMAC SHA256
 *
 * @param payload - Raw request body (as object or string)
 * @param signature - Signature from 'x-hub-signature-256' header
 * @param appSecret - WhatsApp App Secret from environment
 * @returns true if signature is valid, false otherwise
 *
 * @example
 * const signature = req.headers['x-hub-signature-256']
 * const isValid = verifyWhatsAppSignature(req.body, signature, process.env.WHATSAPP_APP_SECRET)
 * if (!isValid) return res.status(403).json({ error: 'Invalid signature' })
 */
export function verifyWhatsAppSignature(
  payload: any,
  signature: string | undefined,
  appSecret: string
): boolean {
  // 1. Validate inputs
  if (!signature || !appSecret) {
    return false
  }

  // 2. Convert payload to string if object
  const payloadString =
    typeof payload === "string" ? payload : JSON.stringify(payload)

  // 3. Calculate HMAC SHA256
  const hmac = crypto.createHmac("sha256", appSecret)
  const digest = hmac.update(payloadString).digest("hex")
  const expectedSignature = `sha256=${digest}`

  // 4. Compare signatures (constant-time comparison for security)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}
