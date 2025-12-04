import logger from "./logger"

/**
 * Parsed customer address structure
 */
export interface ParsedAddress {
  street: string
  city: string
  postalCode: string
  country: string
  state?: string
  additionalInfo?: string
  name?: string
  // Invoice address specific fields
  firstName?: string
  lastName?: string
  company?: string
  address?: string
  vatNumber?: string
  phone?: string
}

/**
 * Result of address parsing operation
 */
export interface AddressParseResult {
  success: boolean
  addresses: ParsedAddress[]
  error?: string
}

/**
 * Normalize address field names to consistent format
 * Maps various field name variations to standard names
 */
function normalizeAddress(address: any): ParsedAddress {
  return {
    // Standard fields
    street: address.street || address.address || '',
    city: address.city || '',
    // Normalize zip/zipCode/postal_code to postalCode
    postalCode: address.postalCode || address.zip || address.zipCode || address.postal_code || '',
    country: address.country || '',
    state: address.state || address.province || '',
    additionalInfo: address.additionalInfo || '',
    name: address.name || '',
    // Invoice address specific fields
    firstName: address.firstName || '',
    lastName: address.lastName || '',
    company: address.company || '',
    address: address.address || address.street || '',
    vatNumber: address.vatNumber || address.vat_number || '',
    phone: address.phone || '',
  }
}

/**
 * Parse customer addresses from JSON string or array
 *
 * Handles multiple formats:
 * - JSON string containing array of address objects
 * - Direct array of address objects
 * - Single address object (converted to array)
 * - null/undefined (returns empty array)
 *
 * @param addressData - Address data in JSON string or object format
 * @returns Parsed addresses array with success flag
 *
 * @example
 * ```typescript
 * // From JSON string
 * const result = parseCustomerAddresses('{"addresses":[{"street":"Via Roma"}]}')
 * if (result.success) {
 *   console.log(result.addresses) // [{ street: "Via Roma", ... }]
 * }
 *
 * // From object
 * const result2 = parseCustomerAddresses([{ street: "Via Roma" }])
 * ```
 */
export function parseCustomerAddresses(
  addressData: string | any
): AddressParseResult {
  try {
    // Handle null/undefined
    if (!addressData) {
      return {
        success: true,
        addresses: [],
      }
    }

    // Handle already parsed object
    if (typeof addressData === "object") {
      const rawAddresses = Array.isArray(addressData) ? addressData : [addressData]
      // Normalize all addresses
      const addresses = rawAddresses.map(normalizeAddress)
      return {
        success: true,
        addresses,
      }
    }

    // Handle JSON string
    if (typeof addressData === "string") {
      const parsed = JSON.parse(addressData)

      // Check if parsed data has "addresses" key
      if (parsed.addresses && Array.isArray(parsed.addresses)) {
        // Normalize all addresses
        const addresses = parsed.addresses.map(normalizeAddress)
        return {
          success: true,
          addresses,
        }
      }

      // Check if parsed data is direct array
      if (Array.isArray(parsed)) {
        // Normalize all addresses
        const addresses = parsed.map(normalizeAddress)
        return {
          success: true,
          addresses,
        }
      }

      // Single address object - normalize it
      return {
        success: true,
        addresses: [normalizeAddress(parsed)],
      }
    }

    // Unknown format
    logger.warn("[ADDRESS-PARSER] Unknown address format", {
      type: typeof addressData,
    })

    return {
      success: false,
      addresses: [],
      error: "Invalid address format",
    }
  } catch (error) {
    logger.error("[ADDRESS-PARSER] Failed to parse addresses:", error)

    return {
      success: false,
      addresses: [],
      error: error instanceof Error ? error.message : "Unknown parsing error",
    }
  }
}

/**
 * Format address object to human-readable string
 *
 * @param address - Parsed address object
 * @returns Formatted address string
 *
 * @example
 * ```typescript
 * const address = { street: "Via Roma 1", city: "Milano", postalCode: "20121", country: "IT" }
 * formatAddress(address) // "Via Roma 1, 20121 Milano, IT"
 * ```
 */
export function formatAddress(address: ParsedAddress): string {
  const parts = [
    address.street,
    address.postalCode && address.city
      ? `${address.postalCode} ${address.city}`
      : address.city || address.postalCode,
    address.state,
    address.country,
  ].filter(Boolean)

  return parts.join(", ")
}
