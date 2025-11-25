/**
 * Multilingual Email Templates
 * 
 * Provides translations for all email types in IT, EN, ES, PT
 * Used by EmailService to send localized emails
 */

export type SupportedLanguage = 'it' | 'en' | 'es' | 'pt'

interface WelcomeEmailTranslations {
  subject: string
  greeting: string
  intro: string
  accountCreated: string
  features: string[]
  getStarted: string
  footer: string
  rights: string
  disclaimer: string
}

interface ResetPasswordEmailTranslations {
  subject: string
  greeting: string
  intro: string
  resetButton: string
  copyLink: string
  warningTitle: string
  warnings: string[]
  footer: string
  rights: string
}

interface EmailTranslations {
  welcome: WelcomeEmailTranslations
  resetPassword: ResetPasswordEmailTranslations
}

export const emailTranslations: Record<SupportedLanguage, EmailTranslations> = {
  it: {
    welcome: {
      subject: "Benvenuto su ShopME! 🎉",
      greeting: "Ciao",
      intro: "Benvenuto su <strong>ShopME</strong>! Siamo entusiasti di averti con noi. 🚀",
      accountCreated: "Il tuo account è stato creato con successo. Ora puoi:",
      features: [
        "Gestire prodotti e servizi",
        "Gestire ordini clienti via WhatsApp",
        "Usare il chatbot AI per supporto clienti",
        "Tracciare analisi e vendite"
      ],
      getStarted: "Inizia",
      footer: "Se hai domande, contatta il nostro team di supporto.",
      rights: "Tutti i diritti riservati",
      disclaimer: "Ricevi questa email perché ti sei registrato su ShopME."
    },
    resetPassword: {
      subject: "Reimposta la tua Password - ShopMe",
      greeting: "Ciao",
      intro: "Abbiamo ricevuto una richiesta per reimpostare la password del tuo account ShopMe. Se non hai fatto questa richiesta, puoi ignorare questa email.",
      resetButton: "Reimposta Password",
      copyLink: "Oppure copia e incolla questo link nel tuo browser:",
      warningTitle: "⚠️ Importante:",
      warnings: [
        "Questo link scadrà tra 1 ora",
        "Se non hai richiesto questo reset, ignora questa email",
        "Non condividere questo link con nessuno"
      ],
      footer: "Se hai problemi, contatta il nostro team di supporto.",
      rights: "Tutti i diritti riservati"
    }
  },
  en: {
    welcome: {
      subject: "Welcome to ShopME! 🎉",
      greeting: "Hi",
      intro: "Welcome to <strong>ShopME</strong>! We're excited to have you on board. 🚀",
      accountCreated: "Your account has been successfully created. You can now:",
      features: [
        "Manage your products and services",
        "Handle customer orders via WhatsApp",
        "Use AI-powered chatbot for customer support",
        "Track analytics and sales"
      ],
      getStarted: "Get Started",
      footer: "If you have any questions, feel free to reach out to our support team.",
      rights: "All rights reserved",
      disclaimer: "You're receiving this email because you registered for a ShopME account."
    },
    resetPassword: {
      subject: "Reset Your Password - ShopMe",
      greeting: "Hello",
      intro: "We received a request to reset the password for your ShopMe account. If you didn't make this request, you can safely ignore this email.",
      resetButton: "Reset My Password",
      copyLink: "Or copy and paste this link into your browser:",
      warningTitle: "⚠️ Important:",
      warnings: [
        "This link will expire in 1 hour",
        "If you didn't request this reset, please ignore this email",
        "Never share this link with anyone"
      ],
      footer: "If you have any issues, please contact our support team.",
      rights: "All rights reserved"
    }
  },
  es: {
    welcome: {
      subject: "¡Bienvenido a ShopME! 🎉",
      greeting: "Hola",
      intro: "¡Bienvenido a <strong>ShopME</strong>! Estamos emocionados de tenerte con nosotros. 🚀",
      accountCreated: "Tu cuenta ha sido creada exitosamente. Ahora puedes:",
      features: [
        "Gestionar tus productos y servicios",
        "Manejar pedidos de clientes vía WhatsApp",
        "Usar chatbot AI para soporte al cliente",
        "Rastrear analíticas y ventas"
      ],
      getStarted: "Empezar",
      footer: "Si tienes alguna pregunta, no dudes en contactar a nuestro equipo de soporte.",
      rights: "Todos los derechos reservados",
      disclaimer: "Estás recibiendo este correo porque te registraste en ShopME."
    },
    resetPassword: {
      subject: "Restablece tu Contraseña - ShopMe",
      greeting: "Hola",
      intro: "Recibimos una solicitud para restablecer la contraseña de tu cuenta ShopMe. Si no hiciste esta solicitud, puedes ignorar este correo.",
      resetButton: "Restablecer mi Contraseña",
      copyLink: "O copia y pega este enlace en tu navegador:",
      warningTitle: "⚠️ Importante:",
      warnings: [
        "Este enlace expirará en 1 hora",
        "Si no solicitaste este restablecimiento, ignora este correo",
        "Nunca compartas este enlace con nadie"
      ],
      footer: "Si tienes algún problema, contacta a nuestro equipo de soporte.",
      rights: "Todos los derechos reservados"
    }
  },
  pt: {
    welcome: {
      subject: "Bem-vindo ao ShopME! 🎉",
      greeting: "Olá",
      intro: "Bem-vindo ao <strong>ShopME</strong>! Estamos animados em tê-lo conosco. 🚀",
      accountCreated: "Sua conta foi criada com sucesso. Agora você pode:",
      features: [
        "Gerenciar seus produtos e serviços",
        "Gerenciar pedidos de clientes via WhatsApp",
        "Usar chatbot AI para suporte ao cliente",
        "Rastrear análises e vendas"
      ],
      getStarted: "Começar",
      footer: "Se você tiver alguma dúvida, entre em contato com nossa equipe de suporte.",
      rights: "Todos os direitos reservados",
      disclaimer: "Você está recebendo este e-mail porque se registrou no ShopME."
    },
    resetPassword: {
      subject: "Redefina sua Senha - ShopMe",
      greeting: "Olá",
      intro: "Recebemos uma solicitação para redefinir a senha da sua conta ShopMe. Se você não fez esta solicitação, pode ignorar este e-mail.",
      resetButton: "Redefinir minha Senha",
      copyLink: "Ou copie e cole este link no seu navegador:",
      warningTitle: "⚠️ Importante:",
      warnings: [
        "Este link expirará em 1 hora",
        "Se você não solicitou esta redefinição, ignore este e-mail",
        "Nunca compartilhe este link com ninguém"
      ],
      footer: "Se você tiver algum problema, entre em contato com nossa equipe de suporte.",
      rights: "Todos os direitos reservados"
    }
  }
}

/**
 * Get email translations for a specific language
 * Falls back to English if language not supported
 */
export function getEmailTranslation(language?: SupportedLanguage): EmailTranslations {
  const lang = language || 'en'
  return emailTranslations[lang] || emailTranslations.en
}

/**
 * Detect language from Accept-Language header
 */
export function detectLanguageFromHeader(acceptLanguage?: string): SupportedLanguage {
  if (!acceptLanguage) return 'en'
  
  const lower = acceptLanguage.toLowerCase()
  
  if (lower.includes('it')) return 'it'
  if (lower.includes('es')) return 'es'
  if (lower.includes('pt')) return 'pt'
  
  return 'en'
}
