/**
 * Workspace Settings Data - Auto-generated from database
 * Last updated: 2025-10-30T16:02:52.319Z
 * Seed data for eChatbot
 */

export interface WorkspaceSettingsData {
  name: string
  url?: string | null
  whatsappPhoneNumber?: string | null
  notificationEmail?: string | null
  welcomeMessages?: string // ✅ Simple English string (no JSON)
  wipMessages?: string // ✅ Simple English string (no JSON)
  afterRegistrationMessages?: any
  debugMode?: boolean
}

export const workspaceSettings: WorkspaceSettingsData = {
  name: "BellItalia",
  url: "http://localhost:3000",
  whatsappPhoneNumber: "+34654728753",
  notificationEmail: "info@altrogusto.com",
  welcomeMessages:
    "👋 Welcome to BellItalia! I'm SofiA, your digital assistant. I can help you discover Italian gourmet products, answer questions, and manage orders. Watch our presentation: https://www.youtube.com/watch?v=cmpRLQZkTb8 - How can I help you today?",
  wipMessages: "Work in progress. Please contact us later.",
  afterRegistrationMessages: {
    de: "Danke für Ihre Registrierung, [nome]! Wie kann ich Ihnen heute helfen?",
    en: "Thank you for registering, [nome]! How can I help you today?",
    es: "¡Gracias por registrarte, [nome]! ¿Cómo puedo ayudarte hoy?",
    fr: "Merci de vous être inscrit, [nome]! Comment puis-je vous aider aujourd'hui?",
    it: "Grazie per esserti registrato, [nome]! Come ti posso aiutare oggi?",
    pt: "Obrigado por se registrar, [nome]! Como posso ajudá-lo hoje?",
  },
  debugMode: true,
}
