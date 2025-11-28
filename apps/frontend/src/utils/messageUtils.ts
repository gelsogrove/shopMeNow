/**
 * Utility functions for WhatsApp chat messages
 */

/**
 * Get initials from a name
 * @param name - Full name
 * @returns Initials (2 characters)
 */
export function getInitials(name: string): string {
  if (!name) return ""
  const words = name.split(" ")
  if (words.length === 1) return name.substring(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * Validate phone number format
 * @param number - Phone number to validate
 * @returns true if valid (at least 10 digits)
 */
export function isValidPhoneNumber(number: string): boolean {
  return /^\+?[\d\s]{10,}$/.test(number.trim())
}

/**
 * Format WhatsApp message for display
 * Handles asterisks as bold, underscores as italic, line breaks
 * @param text - Raw text message
 * @returns Formatted HTML string
 */
export function formatWhatsAppMessage(text: string): string {
  // Replace single asterisks with <strong> tags for bold text
  let formattedText = text.replace(/\*(.*?)\*/g, "<strong>$1</strong>")

  // Replace underscores with <em> tags for italic text
  formattedText = formattedText.replace(/_(.*?)_/g, "<em>$1</em>")

  // Convert line breaks to <br> tags
  formattedText = formattedText.replace(/\n/g, "<br />")

  return formattedText
}

/**
 * Get message style classes based on message type and metadata
 */
export function getMessageStyle(
  isAgentMessage: boolean,
  metadata?: {
    agentSelected?: string
    isOperatorMessage?: boolean
    isOperatorControl?: boolean
    sentBy?: string
  },
  agentName?: string
): string {
  if (!isAgentMessage) {
    return metadata?.isOperatorControl
      ? "bg-orange-50 text-orange-900 border-l-4 border-orange-400" // Customer under control
      : "bg-white border border-gray-200" // Normal customer
  }

  // SE C'È IL BADGE CHATBOT → VERDE (controllo anche agentName)
  if (
    metadata?.agentSelected === "CHATBOT" ||
    metadata?.agentSelected?.startsWith("CHATBOT_") ||
    metadata?.agentSelected === "AI" ||
    metadata?.agentSelected === "LLM" ||
    agentName
  ) {
    // Se ha agentName è un chatbot!
    return "bg-green-100 text-green-900 border-l-4 border-green-500" // CHATBOT → VERDE
  }

  if (metadata?.agentSelected === "MANUAL_OPERATOR") {
    return "bg-blue-100 text-blue-900 border-l-4 border-blue-500" // MANUAL_OPERATOR → BLU
  }

  // Default fallback
  return "bg-green-100 text-green-900"
}
