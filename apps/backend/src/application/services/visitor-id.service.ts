/**
 * VisitorId Generation Service
 * Generates unique visitor IDs for anonymous widget users
 * 
 * Format: visitor_{timestamp}_{randomHash}
 * Example: visitor_1726262000000_a7k2m9x1
 * 
 * Storage: sessionStorage (NOT localStorage) - session-based lifetime
 * Privacy: No PII, expires after browser close
 */

import crypto from "crypto"
import logger from "../../utils/logger"

export class VisitorIdService {
  /**
   * Generate a new visitor ID
   * 
   * @returns {string} Format: visitor_1726262000000_a7k2m9x1
   */
  static generate(): string {
    const timestamp = Date.now() // 13-digit Unix milliseconds
    const randomHash = crypto.randomBytes(4).toString("hex") // 8 characters
    const visitorId = `visitor_${timestamp}_${randomHash}`

    logger.debug("Generated visitor ID", { visitorId })
    return visitorId
  }

  /**
   * Validate visitor ID format
   * 
   * @param visitorId - Visitor ID to validate
   * @returns {boolean} True if valid format
   */
  static validate(visitorId: string): boolean {
    const pattern = /^visitor_\d{13}_[a-zA-Z0-9]{6,10}$/
    return pattern.test(visitorId)
  }

  /**
   * Extract timestamp from visitor ID
   * 
   * @param visitorId - Visitor ID
   * @returns {number | null} Unix timestamp or null if invalid
   */
  static extractTimestamp(visitorId: string): number | null {
    if (!this.validate(visitorId)) {
      return null
    }

    const parts = visitorId.split("_")
    if (parts.length !== 3) {
      return null
    }

    const timestamp = parseInt(parts[1], 10)
    return isNaN(timestamp) ? null : timestamp
  }

  /**
   * Check if visitor ID is expired (older than 24 hours)
   * 
   * @param visitorId - Visitor ID
   * @param expiryHours - Expiry time in hours (default: 24)
   * @returns {boolean} True if expired
   */
  static isExpired(visitorId: string, expiryHours: number = 24): boolean {
    const timestamp = this.extractTimestamp(visitorId)
    if (!timestamp) {
      return true // Invalid = expired
    }

    const now = Date.now()
    const ageMs = now - timestamp
    const ageHours = ageMs / (1000 * 60 * 60)

    return ageHours >= expiryHours
  }

  /**
   * Get expiry date for visitor ID (24 hours from creation)
   * 
   * @param visitorId - Visitor ID
   * @returns {Date | null} Expiry date or null if invalid
   */
  static getExpiryDate(visitorId: string): Date | null {
    const timestamp = this.extractTimestamp(visitorId)
    if (!timestamp) {
      return null
    }

    const expiryMs = timestamp + 24 * 60 * 60 * 1000 // +24 hours
    return new Date(expiryMs)
  }
}
