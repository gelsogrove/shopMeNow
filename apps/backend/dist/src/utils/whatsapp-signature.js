"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWhatsAppSignature = verifyWhatsAppSignature;
const crypto_1 = __importDefault(require("crypto"));
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
function verifyWhatsAppSignature(payload, signature, appSecret) {
    // 1. Validate inputs
    if (!signature || !appSecret) {
        return false;
    }
    // 2. Convert payload to string if object
    const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);
    // 3. Calculate HMAC SHA256
    const hmac = crypto_1.default.createHmac("sha256", appSecret);
    const digest = hmac.update(payloadString).digest("hex");
    const expectedSignature = `sha256=${digest}`;
    // 4. Compare signatures (constant-time comparison for security)
    return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
//# sourceMappingURL=whatsapp-signature.js.map