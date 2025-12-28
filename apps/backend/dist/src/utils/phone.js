"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhoneNumber = normalizePhoneNumber;
/**
 * Phone utilities
 */
function normalizePhoneNumber(phone) {
    if (!phone)
        return null;
    let digits = phone.replace(/\D+/g, "");
    if (!digits)
        return null;
    // Strip international dialing prefixes (00, +) and country codes like 39
    if (digits.startsWith("00")) {
        digits = digits.replace(/^00+/, "");
    }
    if (digits.startsWith("39") && digits.length > 10) {
        digits = digits.substring(2);
    }
    // Trim extra leading zeros for safety
    digits = digits.replace(/^0+/, "");
    return digits || null;
}
//# sourceMappingURL=phone.js.map