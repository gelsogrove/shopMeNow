/**
 * Simple toast utility for backoffice
 * Uses console logging only (no popups)
 */

export const toast = {
  success: (message: string) => {
    console.log("✅ SUCCESS:", message)
  },
  error: (message: string) => {
    console.error("❌ ERROR:", message)
  },
  info: (message: string) => {
    console.info("ℹ️ INFO:", message)
  },
  warning: (message: string) => {
    console.warn("⚠️ WARNING:", message)
  },
}
