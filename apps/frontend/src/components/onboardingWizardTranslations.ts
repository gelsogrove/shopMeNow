/**
 * Translations for OnboardingWizardModal
 * Supports: it, en, es, pt
 */

export const OWT = {
  it: {
    titleStep: ['1 di 4', '2 di 4', '3 di 4', '4 di 4'],
    next: 'Avanti', back: 'Indietro',
    business: {
      title: 'La tua attività',
      subtitle: 'Dicci come si chiama la tua attività',
      name: 'Nome attività o brand',
      namePh: 'es. Pizzeria Roma',
      industry: 'Settore',
    },
    channel: {
      title: 'Il tuo numero WhatsApp',
      subtitle: 'I clienti scriveranno a questo numero',
      phone: 'Numero di telefono',
      phonePh: '+393331234567',
      hint: "Formato internazionale con prefisso (+39 per l'Italia)",
    },
    auth: {
      title: 'Crea il tuo account',
      subtitle: 'Quasi fatto — registrati per iniziare',
      fname: 'Nome', lname: 'Cognome',
      email: 'Email', pass: 'Password',
      gdpr: 'Accetto i Termini di Servizio e la Privacy Policy',
      register: 'Crea Account', or: 'oppure',
    },
    totp: {
      title: 'Proteggi il tuo account',
      setupSubtitle: 'Scansiona il QR con Google Authenticator o Authy',
      setupInstructions: "Apri l'app → Aggiungi account → Scansiona QR",
      verifySubtitle: "Inserisci il codice dall'app di autenticazione",
      code: 'Codice (6 cifre)', verify: 'Verifica e continua',
    },
    creating: {
      title: 'Configurazione in corso...',
      phases: ['Creo il tuo workspace...', 'Configuro il canale WhatsApp...', 'Quasi pronto...'],
    },
    qr: {
      title: 'Scansiona per connettere WhatsApp',
      subtitle: 'WhatsApp → Dispositivi collegati → Collega dispositivo → Scansiona',
      expired: 'QR scaduto', newQr: 'Nuovo QR', wait: 'secondi',
    },
    done: {
      title: 'Tutto pronto!',
      subtitle: 'Il tuo workspace è configurato e WhatsApp è connesso.',
      cta: 'Vai alla Dashboard',
    },
    industries: {
      retail: 'Vendita al dettaglio', restaurant: 'Ristorazione', healthcare: 'Sanità',
      education: 'Educazione', finance: 'Finanza', realestate: 'Immobiliare',
      technology: 'Tecnologia', other: 'Altro',
    },
    errors: {
      required: 'Campo obbligatorio',
      phoneFormat: 'Usa il formato internazionale, es. +393331234567',
      emailRequired: 'Email obbligatoria', passwordRequired: 'Password obbligatoria',
      gdprRequired: 'Devi accettare i termini', invalidCode: 'Inserisci 6 cifre',
    },
  },
  en: {
    titleStep: ['1 of 4', '2 of 4', '3 of 4', '4 of 4'],
    next: 'Next', back: 'Back',
    business: {
      title: 'Your business',
      subtitle: 'Tell us what your business is called',
      name: 'Business or brand name',
      namePh: 'e.g. Roma Pizza',
      industry: 'Industry',
    },
    channel: {
      title: 'Your WhatsApp number',
      subtitle: 'Customers will message you at this number',
      phone: 'Phone number',
      phonePh: '+393331234567',
      hint: 'International format with country code (+1 for US, +39 for Italy)',
    },
    auth: {
      title: 'Create your account',
      subtitle: 'Almost done — register to get started',
      fname: 'First name', lname: 'Last name',
      email: 'Email', pass: 'Password',
      gdpr: 'I agree to the Terms of Service and Privacy Policy',
      register: 'Create Account', or: 'or',
    },
    totp: {
      title: 'Secure your account',
      setupSubtitle: 'Scan the QR with Google Authenticator or Authy',
      setupInstructions: 'Open app → Add account → Scan QR',
      verifySubtitle: 'Enter the code from your authenticator app',
      code: 'Code (6 digits)', verify: 'Verify and continue',
    },
    creating: {
      title: 'Setting everything up...',
      phases: ['Creating your workspace...', 'Configuring WhatsApp channel...', 'Almost ready...'],
    },
    qr: {
      title: 'Scan to connect WhatsApp',
      subtitle: 'WhatsApp → Linked Devices → Link a Device → Scan',
      expired: 'QR expired', newQr: 'New QR', wait: 'seconds',
    },
    done: {
      title: 'All set!',
      subtitle: 'Your workspace is configured and WhatsApp is connected.',
      cta: 'Go to Dashboard',
    },
    industries: {
      retail: 'Retail', restaurant: 'Restaurant', healthcare: 'Healthcare',
      education: 'Education', finance: 'Finance', realestate: 'Real Estate',
      technology: 'Technology', other: 'Other',
    },
    errors: {
      required: 'Required field',
      phoneFormat: 'Use international format, e.g. +393331234567',
      emailRequired: 'Email required', passwordRequired: 'Password required',
      gdprRequired: 'You must accept the terms', invalidCode: 'Enter 6 digits',
    },
  },
  es: {
    titleStep: ['1 de 4', '2 de 4', '3 de 4', '4 de 4'],
    next: 'Siguiente', back: 'Atrás',
    business: {
      title: 'Tu negocio',
      subtitle: 'Cuéntanos cómo se llama tu negocio',
      name: 'Nombre del negocio o marca',
      namePh: 'ej. Pizzería Roma',
      industry: 'Sector',
    },
    channel: {
      title: 'Tu número de WhatsApp',
      subtitle: 'Los clientes te escribirán a este número',
      phone: 'Número de teléfono',
      phonePh: '+34612345678',
      hint: 'Formato internacional con código de país (+34 para España)',
    },
    auth: {
      title: 'Crea tu cuenta',
      subtitle: 'Casi listo — regístrate para comenzar',
      fname: 'Nombre', lname: 'Apellido',
      email: 'Correo electrónico', pass: 'Contraseña',
      gdpr: 'Acepto los Términos de Servicio y la Política de Privacidad',
      register: 'Crear Cuenta', or: 'o',
    },
    totp: {
      title: 'Protege tu cuenta',
      setupSubtitle: 'Escanea el QR con Google Authenticator o Authy',
      setupInstructions: 'Abrir app → Agregar cuenta → Escanear QR',
      verifySubtitle: 'Ingresa el código de tu app de autenticación',
      code: 'Código (6 dígitos)', verify: 'Verificar y continuar',
    },
    creating: {
      title: 'Configurando todo...',
      phases: ['Creando tu workspace...', 'Configurando el canal WhatsApp...', '¡Casi listo!'],
    },
    qr: {
      title: 'Escanea para conectar WhatsApp',
      subtitle: 'WhatsApp → Dispositivos vinculados → Vincular dispositivo → Escanear',
      expired: 'QR expirado', newQr: 'Nuevo QR', wait: 'segundos',
    },
    done: {
      title: '¡Todo listo!',
      subtitle: 'Tu workspace está configurado y WhatsApp está conectado.',
      cta: 'Ir al Panel',
    },
    industries: {
      retail: 'Venta al detalle', restaurant: 'Restauración', healthcare: 'Salud',
      education: 'Educación', finance: 'Finanzas', realestate: 'Inmobiliario',
      technology: 'Tecnología', other: 'Otro',
    },
    errors: {
      required: 'Campo requerido',
      phoneFormat: 'Usa el formato internacional, ej. +34612345678',
      emailRequired: 'Email requerido', passwordRequired: 'Contraseña requerida',
      gdprRequired: 'Debes aceptar los términos', invalidCode: 'Ingresa 6 dígitos',
    },
  },
  pt: {
    titleStep: ['1 de 4', '2 de 4', '3 de 4', '4 de 4'],
    next: 'Próximo', back: 'Voltar',
    business: {
      title: 'Seu negócio',
      subtitle: 'Diga-nos o nome do seu negócio',
      name: 'Nome do negócio ou marca',
      namePh: 'ex. Pizzaria Roma',
      industry: 'Setor',
    },
    channel: {
      title: 'Seu número do WhatsApp',
      subtitle: 'Os clientes vão te escrever neste número',
      phone: 'Número de telefone',
      phonePh: '+553312345678',
      hint: 'Formato internacional com código do país (+55 para Brasil)',
    },
    auth: {
      title: 'Crie sua conta',
      subtitle: 'Quase lá — registre-se para começar',
      fname: 'Nome', lname: 'Sobrenome',
      email: 'Email', pass: 'Senha',
      gdpr: 'Aceito os Termos de Serviço e a Política de Privacidade',
      register: 'Criar Conta', or: 'ou',
    },
    totp: {
      title: 'Proteja sua conta',
      setupSubtitle: 'Escaneie o QR com Google Authenticator ou Authy',
      setupInstructions: 'Abrir app → Adicionar conta → Escanear QR',
      verifySubtitle: 'Digite o código do seu app de autenticação',
      code: 'Código (6 dígitos)', verify: 'Verificar e continuar',
    },
    creating: {
      title: 'Configurando tudo...',
      phases: ['Criando seu workspace...', 'Configurando o canal WhatsApp...', 'Quase pronto...'],
    },
    qr: {
      title: 'Escaneie para conectar WhatsApp',
      subtitle: 'WhatsApp → Dispositivos vinculados → Vincular dispositivo → Escanear',
      expired: 'QR expirado', newQr: 'Novo QR', wait: 'segundos',
    },
    done: {
      title: 'Tudo pronto!',
      subtitle: 'Seu workspace está configurado e o WhatsApp está conectado.',
      cta: 'Ir ao Painel',
    },
    industries: {
      retail: 'Varejo', restaurant: 'Restaurante', healthcare: 'Saúde',
      education: 'Educação', finance: 'Finanças', realestate: 'Imóveis',
      technology: 'Tecnologia', other: 'Outro',
    },
    errors: {
      required: 'Campo obrigatório',
      phoneFormat: 'Use o formato internacional, ex. +553312345678',
      emailRequired: 'Email obrigatório', passwordRequired: 'Senha obrigatória',
      gdprRequired: 'Você deve aceitar os termos', invalidCode: 'Digite 6 dígitos',
    },
  },
} as const

export type OWTLang = keyof typeof OWT
export type OWTTranslations = (typeof OWT)[OWTLang]

export const INDUSTRIES = ['retail', 'restaurant', 'healthcare', 'education', 'finance', 'realestate', 'technology', 'other'] as const
export type Industry = typeof INDUSTRIES[number]
