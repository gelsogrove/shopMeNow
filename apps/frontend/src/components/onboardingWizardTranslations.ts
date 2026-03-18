/**
 * Translations for OnboardingWizardModal
 * Supports: it, en, es, pt
 */

export const INDUSTRIES = [
  'retail', 'restaurant', 'healthcare', 'beauty', 'education',
  'tourism', 'fashion', 'fitness', 'transport', 'technology',
  'realestate', 'finance', 'legal', 'other',
] as const

export type Industry = (typeof INDUSTRIES)[number]

export const INDUSTRY_EMOJI: Record<Industry, string> = {
  retail: '🛍️', restaurant: '🍕', healthcare: '🏥', beauty: '💄',
  education: '📚', tourism: '✈️', fashion: '👗', fitness: '💪',
  transport: '🚚', technology: '💻', realestate: '🏠', finance: '💰',
  legal: '⚖️', other: '🏢',
}

export const WORKSPACE_TYPES = ['ecommerce', 'services', 'info'] as const
export type WorkspaceType = (typeof WORKSPACE_TYPES)[number]

export const WORKSPACE_TYPE_EMOJI: Record<WorkspaceType, string> = {
  ecommerce: '🛒', services: '🛎️', info: '💬',
}

export const OWT = {
  it: {
    back: 'Indietro',
    next: 'Avanti',
    intro: {
      title: 'Benvenuto in eChatbot',
      subtitle: 'Configura il tuo assistente WhatsApp\nin meno di 3 minuti',
      benefits: ['✅ Setup in 3 minuti', '✅ 14 giorni gratis', '✅ Nessuna carta richiesta'],
      cta: 'Inizia la configurazione →',
    },
    industry: {
      title: 'Qual è il tuo settore?',
      subtitle: 'Scegliamo le funzionalità più adatte\nalla tua attività',
    },
    business: {
      title: 'Come si chiama la tua attività?',
      subtitle: 'I tuoi clienti vedranno questo nome',
      name: 'Nome attività o brand',
      namePh: 'es. Pizzeria Roma',
    },
    workspaceType: {
      title: 'Come vuoi usare eChatbot?',
      subtitle: 'Configuriamo le funzionalità giuste per te',
      options: {
        ecommerce: { label: 'Vendo prodotti', desc: 'Catalogo prodotti, carrello e ordini online' },
        services: { label: 'Offro servizi', desc: 'Preventivi, appuntamenti e prenotazioni' },
        info: { label: 'Condivido informazioni', desc: 'Supporto clienti, FAQ e informazioni' },
      },
    },
    channelType: {
      title: 'Come vuoi ricevere i messaggi?',
      subtitle: 'Scegli dove il chatbot interagirà con i tuoi clienti',
      options: {
        whatsapp: { label: 'Solo WhatsApp', desc: 'Il chatbot risponde su WhatsApp', emoji: '💬' },
        widget: { label: 'Solo Widget web', desc: 'Chat integrata nel tuo sito web', emoji: '🌐' },
        both: { label: 'Entrambi', desc: 'WhatsApp + Widget sul sito web', emoji: '🔗' },
      },
    },
    humanSupport: {
      title: 'Supporto umano',
      subtitle: 'Una delle caratteristiche di eChatbot è il passaggio intelligente dal chatbot a un operatore umano, senza perdere il contesto della conversazione. Quando un cliente ha un problema complesso, il chatbot trasferisce la chat a un operatore che riceve una notifica WhatsApp con tutta la cronologia. Vuoi questa funzionalità?',
      yes: { label: 'Sì, voglio il passaggio a operatore umano', emoji: '✅' },
      no: { label: 'No, la gestione automatica va bene', emoji: '🤖' },
    },
    channel: {
      title: 'Il tuo numero WhatsApp',
      subtitle: 'I clienti ti scriveranno\na questo numero',
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
      phasesWhatsapp: ['Creo il tuo workspace...', 'Configuro il canale WhatsApp...', 'Quasi pronto...'],
      phasesWidget: ['Creo il tuo workspace...', 'Configuro il widget...', 'Quasi pronto...'],
      phasesBoth: ['Creo il tuo workspace...', 'Configuro WhatsApp e widget...', 'Quasi pronto...'],
    },
    qr: {
      title: 'Collega WhatsApp',
      subtitle: 'WhatsApp → Dispositivi collegati → Collega dispositivo → Scansiona',
      expired: 'QR scaduto', newQr: 'Nuovo QR', wait: 's',
    },
    done: {
      title: 'Tutto pronto!',
      subtitleWhatsapp: 'Il tuo workspace è configurato e WhatsApp è connesso.',
      subtitleWidget: 'Il tuo workspace è configurato. Trovi il codice widget nelle impostazioni.',
      subtitleBoth: 'Il tuo workspace è configurato. WhatsApp connesso e widget pronto.',
      cta: 'Vai alla Dashboard',
    },
    industries: {
      retail: 'Retail', restaurant: 'Ristorazione', healthcare: 'Sanità',
      beauty: 'Beauty', education: 'Educazione', tourism: 'Turismo',
      fashion: 'Moda', fitness: 'Fitness', transport: 'Trasporti',
      technology: 'Tecnologia', realestate: 'Immobiliare', finance: 'Finanza',
      legal: 'Legale', other: 'Altro',
    },
    errors: {
      required: 'Campo obbligatorio',
      phoneFormat: 'Usa il formato internazionale, es. +393331234567',
      emailRequired: 'Email obbligatoria', passwordRequired: 'Password obbligatoria',
      gdprRequired: 'Devi accettare i termini', invalidCode: 'Inserisci 6 cifre',
    },
  },
  en: {
    back: 'Back',
    next: 'Next',
    intro: {
      title: 'Welcome to eChatbot',
      subtitle: 'Set up your WhatsApp assistant\nin less than 3 minutes',
      benefits: ['✅ 3-minute setup', '✅ 14 days free', '✅ No credit card required'],
      cta: 'Start setup →',
    },
    industry: {
      title: 'What industry are you in?',
      subtitle: 'We\'ll pick the best features\nfor your business',
    },
    business: {
      title: 'What\'s your business name?',
      subtitle: 'Your customers will see this name',
      name: 'Business or brand name',
      namePh: 'e.g. Roma Pizza',
    },
    workspaceType: {
      title: 'How will you use eChatbot?',
      subtitle: 'We\'ll configure the right features for you',
      options: {
        ecommerce: { label: 'Sell products', desc: 'Product catalog, cart and online orders' },
        services: { label: 'Offer services', desc: 'Quotes, appointments and bookings' },
        info: { label: 'Share information', desc: 'Customer support, FAQ and information' },
      },
    },
    channelType: {
      title: 'How do you want to receive messages?',
      subtitle: 'Choose where your chatbot will interact with customers',
      options: {
        whatsapp: { label: 'WhatsApp only', desc: 'Chatbot replies on WhatsApp', emoji: '💬' },
        widget: { label: 'Web widget only', desc: 'Chat integrated in your website', emoji: '🌐' },
        both: { label: 'Both', desc: 'WhatsApp + website widget', emoji: '🔗' },
      },
    },
    humanSupport: {
      title: 'Human Support',
      subtitle: 'One of eChatbot\'s strengths is the intelligent handoff from AI to a human agent, without losing conversation context. When a customer has a complex issue, the AI agent instantly transfers the chat to an operator who receives a WhatsApp notification with the full conversation history. Would you like this capability integrated into your chatbot?',
      yes: { label: 'Yes, I want human handoff capability', emoji: '✅' },
      no: { label: 'Full automation works for me', emoji: '🤖' },
    },
    channel: {
      title: 'Your WhatsApp number',
      subtitle: 'Customers will message you\nat this number',
      phone: 'Phone number',
      phonePh: '+393331234567',
      hint: 'Add the country code, e.g. +1 (US) or +39 (Italy)',
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
      phasesWhatsapp: ['Creating your workspace...', 'Configuring WhatsApp channel...', 'Almost ready...'],
      phasesWidget: ['Creating your workspace...', 'Configuring web widget...', 'Almost ready...'],
      phasesBoth: ['Creating your workspace...', 'Configuring WhatsApp and widget...', 'Almost ready...'],
    },
    qr: {
      title: 'Connect WhatsApp',
      subtitle: 'WhatsApp → Linked Devices → Link a Device → Scan',
      expired: 'QR expired', newQr: 'New QR', wait: 's',
    },
    done: {
      title: 'All set!',
      subtitleWhatsapp: 'Your workspace is configured and WhatsApp is connected.',
      subtitleWidget: 'Your workspace is configured. Find the widget code in settings.',
      subtitleBoth: 'Your workspace is configured. WhatsApp connected and widget ready.',
      cta: 'Go to Dashboard',
    },
    industries: {
      retail: 'Retail', restaurant: 'Restaurant', healthcare: 'Healthcare',
      beauty: 'Beauty', education: 'Education', tourism: 'Tourism',
      fashion: 'Fashion', fitness: 'Fitness', transport: 'Transport',
      technology: 'Technology', realestate: 'Real Estate', finance: 'Finance',
      legal: 'Legal', other: 'Other',
    },
    errors: {
      required: 'Required field',
      phoneFormat: 'Use international format, e.g. +393331234567',
      emailRequired: 'Email required', passwordRequired: 'Password required',
      gdprRequired: 'You must accept the terms', invalidCode: 'Enter 6 digits',
    },
  },
  es: {
    back: 'Atrás',
    next: 'Siguiente',
    intro: {
      title: 'Bienvenido a eChatbot',
      subtitle: 'Configura tu asistente WhatsApp\nen menos de 3 minutos',
      benefits: ['✅ Setup en 3 minutos', '✅ 14 días gratis', '✅ Sin tarjeta de crédito'],
      cta: 'Comenzar configuración →',
    },
    industry: {
      title: '¿En qué sector operas?',
      subtitle: 'Elegiremos las funciones más adecuadas\npara tu negocio',
    },
    business: {
      title: '¿Cómo se llama tu negocio?',
      subtitle: 'Tus clientes verán este nombre',
      name: 'Nombre del negocio o marca',
      namePh: 'ej. Pizzería Roma',
    },
    workspaceType: {
      title: '¿Cómo usarás eChatbot?',
      subtitle: 'Configuraremos las funciones adecuadas para ti',
      options: {
        ecommerce: { label: 'Vendo productos', desc: 'Catálogo, carrito y pedidos online' },
        services: { label: 'Ofrezco servicios', desc: 'Presupuestos, citas y reservas' },
        info: { label: 'Comparto información', desc: 'Soporte al cliente, FAQ e información' },
      },
    },
    channelType: {
      title: '¿Cómo quieres recibir mensajes?',
      subtitle: 'Elige dónde interactuará el chatbot con tus clientes',
      options: {
        whatsapp: { label: 'Solo WhatsApp', desc: 'El chatbot responde en WhatsApp', emoji: '💬' },
        widget: { label: 'Solo widget web', desc: 'Chat integrado en tu sitio web', emoji: '🌐' },
        both: { label: 'Ambos', desc: 'WhatsApp + widget en el sitio web', emoji: '🔗' },
      },
    },
    humanSupport: {
      title: 'Soporte humano',
      subtitle: 'Una de las fortalezas de eChatbot es la transferencia inteligente del chatbot a un agente humano, sin perder el contexto. ¿Quieres esta capacidad integrada?',
      yes: { label: 'Sí, quiero transferencia a agente humano', emoji: '✅' },
      no: { label: 'La automatización completa me sirve', emoji: '🤖' },
    },
    channel: {
      title: 'Tu número de WhatsApp',
      subtitle: 'Los clientes te escribirán\na este número',
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
      phasesWhatsapp: ['Creando tu workspace...', 'Configurando canal WhatsApp...', '¡Casi listo!'],
      phasesWidget: ['Creando tu workspace...', 'Configurando el widget...', '¡Casi listo!'],
      phasesBoth: ['Creando tu workspace...', 'Configurando WhatsApp y widget...', '¡Casi listo!'],
    },
    qr: {
      title: 'Conectar WhatsApp',
      subtitle: 'WhatsApp → Dispositivos vinculados → Vincular dispositivo → Escanear',
      expired: 'QR expirado', newQr: 'Nuevo QR', wait: 's',
    },
    done: {
      title: '¡Todo listo!',
      subtitleWhatsapp: 'Tu workspace está configurado y WhatsApp está conectado.',
      subtitleWidget: 'Tu workspace está configurado. Encuentra el código del widget en ajustes.',
      subtitleBoth: 'Tu workspace está configurado. WhatsApp conectado y widget listo.',
      cta: 'Ir al Panel',
    },
    industries: {
      retail: 'Retail', restaurant: 'Restauración', healthcare: 'Salud',
      beauty: 'Belleza', education: 'Educación', tourism: 'Turismo',
      fashion: 'Moda', fitness: 'Fitness', transport: 'Transporte',
      technology: 'Tecnología', realestate: 'Inmobiliario', finance: 'Finanzas',
      legal: 'Legal', other: 'Otro',
    },
    errors: {
      required: 'Campo requerido',
      phoneFormat: 'Usa el formato internacional, ej. +34612345678',
      emailRequired: 'Email requerido', passwordRequired: 'Contraseña requerida',
      gdprRequired: 'Debes aceptar los términos', invalidCode: 'Ingresa 6 dígitos',
    },
  },
  pt: {
    back: 'Voltar',
    next: 'Próximo',
    intro: {
      title: 'Bem-vindo ao eChatbot',
      subtitle: 'Configure seu assistente WhatsApp\nem menos de 3 minutos',
      benefits: ['✅ Setup em 3 minutos', '✅ 14 dias grátis', '✅ Sem cartão de crédito'],
      cta: 'Iniciar configuração →',
    },
    industry: {
      title: 'Qual é o seu setor?',
      subtitle: 'Escolheremos as melhores funcionalidades\npara o seu negócio',
    },
    business: {
      title: 'Qual é o nome do seu negócio?',
      subtitle: 'Seus clientes verão este nome',
      name: 'Nome do negócio ou marca',
      namePh: 'ex. Pizzaria Roma',
    },
    workspaceType: {
      title: 'Como você vai usar o eChatbot?',
      subtitle: 'Configuraremos as funcionalidades certas para você',
      options: {
        ecommerce: { label: 'Vendo produtos', desc: 'Catálogo, carrinho e pedidos online' },
        services: { label: 'Ofereço serviços', desc: 'Orçamentos, agendamentos e reservas' },
        info: { label: 'Compartilho informações', desc: 'Suporte ao cliente, FAQ e informações' },
      },
    },
    channelType: {
      title: 'Como você quer receber mensagens?',
      subtitle: 'Escolha onde o chatbot vai interagir com seus clientes',
      options: {
        whatsapp: { label: 'Só WhatsApp', desc: 'O chatbot responde no WhatsApp', emoji: '💬' },
        widget: { label: 'Só widget web', desc: 'Chat integrado no seu site', emoji: '🌐' },
        both: { label: 'Ambos', desc: 'WhatsApp + widget no site', emoji: '🔗' },
      },
    },
    humanSupport: {
      title: 'Suporte humano',
      subtitle: 'Um dos pontos fortes do eChatbot é a transferência inteligente do chatbot para um agente humano, sem perder o contexto. Quer essa capacidade integrada?',
      yes: { label: 'Sim, quero transferência para agente humano', emoji: '✅' },
      no: { label: 'Automação completa está bem para mim', emoji: '🤖' },
    },
    channel: {
      title: 'Seu número do WhatsApp',
      subtitle: 'Os clientes vão te escrever\nneste número',
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
      phasesWhatsapp: ['Criando seu workspace...', 'Configurando canal WhatsApp...', 'Quase pronto...'],
      phasesWidget: ['Criando seu workspace...', 'Configurando o widget...', 'Quase pronto...'],
      phasesBoth: ['Criando seu workspace...', 'Configurando WhatsApp e widget...', 'Quase pronto...'],
    },
    qr: {
      title: 'Conectar WhatsApp',
      subtitle: 'WhatsApp → Dispositivos vinculados → Vincular dispositivo → Escanear',
      expired: 'QR expirado', newQr: 'Novo QR', wait: 's',
    },
    done: {
      title: 'Tudo pronto!',
      subtitleWhatsapp: 'Seu workspace está configurado e o WhatsApp está conectado.',
      subtitleWidget: 'Seu workspace está configurado. Encontre o código do widget nas configurações.',
      subtitleBoth: 'Seu workspace está configurado. WhatsApp conectado e widget pronto.',
      cta: 'Ir ao Painel',
    },
    industries: {
      retail: 'Varejo', restaurant: 'Restaurante', healthcare: 'Saúde',
      beauty: 'Beleza', education: 'Educação', tourism: 'Turismo',
      fashion: 'Moda', fitness: 'Fitness', transport: 'Transporte',
      technology: 'Tecnologia', realestate: 'Imóveis', finance: 'Finanças',
      legal: 'Jurídico', other: 'Outro',
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
